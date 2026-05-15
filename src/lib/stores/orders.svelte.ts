import { products, type CompositeComponent } from './products.svelte';
import { batches, type BatchAllocation } from './batches.svelte';
import { stockMovements, type StockMovementReference } from './stockMovements.svelte';

export type OrderStatus = 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'qris' | 'transfer';

export type OrderLineExtra = {
  extraId: string;
  name: string;
  priceDelta: number;
};

export type OrderLine = {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;          // snapshot
  variantName: string;          // snapshot, or ''
  unitId: string;               // chosen unit
  unitFactor: number;           // snapshot
  unitCode: string;             // snapshot, e.g. 'pc' or 'box'
  quantity: number;             // in chosen unit
  unitPrice: number;            // resolved sale price per chosen unit (after tier)
  extras: OrderLineExtra[];     // picked extras with snapshotted prices
  taxRatePct: number;           // snapshot of tax % at sale time
  lineSubtotal: number;         // = quantity × (unitPrice + sum extras)
  lineTax: number;              // = lineSubtotal × taxRatePct / 100
  lineTotal: number;            // = lineSubtotal + lineTax
  batchAllocations: BatchAllocation[];  // populated by applyOrderToStock at charge time
};

export type Order = {
  id: string;
  code: string;                 // ORD-YYYY-NNN
  pricelistId: string;
  customerId?: string;
  employeeId?: string;
  paymentMethod: PaymentMethod;
  lines: OrderLine[];
  subtotal: number;             // sum of line subtotals (pre-tax)
  taxTotal: number;             // sum of line tax
  total: number;                // subtotal + taxTotal
  status: OrderStatus;
  notes: string;
  createdAt: string;            // ISO datetime
};

export type OrderInput = Omit<Order, 'id' | 'code' | 'createdAt'>;

function fmtCodeNumber(n: number): string {
  return n.toString().padStart(3, '0');
}

const seed: Order[] = [];

class OrdersStore {
  items = $state<Order[]>([...seed]);
  private nextId = seed.length + 1;
  private nextCodeNum = seed.length + 1;

  private generateCode(): string {
    const year = new Date().getFullYear();
    return `ORD-${year}-${fmtCodeNumber(this.nextCodeNum++)}`;
  }

  add(input: OrderInput): Order {
    const order: Order = {
      ...input,
      id: `ord_${this.nextId++}`,
      code: this.generateCode(),
      createdAt: new Date().toISOString()
    };
    this.items.push(order);
    return order;
  }

  getById(id: string): Order | undefined {
    return this.items.find((o) => o.id === id);
  }

  cancel(id: string): { ok: boolean; reason?: string } {
    const order = this.getById(id);
    if (!order) return { ok: false, reason: 'Order not found.' };
    if (order.status === 'cancelled') return { ok: false, reason: 'Already cancelled.' };
    const idx = this.items.findIndex((o) => o.id === id);
    if (idx === -1) return { ok: false, reason: 'Order not found.' };

    const reference: StockMovementReference = { kind: 'order', id: order.id, code: order.code };

    // Restore each line's stamped batch allocations. Silently skip batches that
    // no longer exist (e.g. deleted manually) — qtyReceived stays as the historical
    // record on the batch; qtyRemaining can technically exceed it briefly which is fine.
    for (const line of order.lines) {
      for (const alloc of line.batchAllocations) {
        const batch = batches.getById(alloc.batchId);
        if (!batch) continue;
        const updated = batches.update(batch.id, {
          qtyRemaining: batch.qtyRemaining + alloc.qtyTaken
        });
        stockMovements.log({
          kind: 'sale-cancel',
          productId: line.productId,
          variantId: line.variantId,
          locationId: batch.locationId,
          batchId: batch.id,
          qtyDelta: alloc.qtyTaken,
          qtyAfter: updated?.qtyRemaining ?? batch.qtyRemaining + alloc.qtyTaken,
          unitCost: alloc.unitCost,
          reference,
          notes: `Pembatalan pesanan · ${order.code}`
        });
      }
    }

    this.items[idx] = { ...order, status: 'cancelled' };
    return { ok: true };
  }
}

export const orders = new OrdersStore();

// Walk batches FIFO (oldest receivedAt first), decrement qtyRemaining, and return
// one BatchAllocation per batch touched. Each allocation is snapshotted so the
// Consignor Payout report stays correct even if the underlying batch is later
// mutated or its supplier renamed. See docs/CONSIGNMENT.md §"Sale flow".
function deductBatchesFIFO(
  productId: string,
  variantId: string | undefined,
  qty: number,
  context?: { reference?: StockMovementReference; notes?: string }
): BatchAllocation[] {
  const allocations: BatchAllocation[] = [];
  let remaining = qty;
  for (const batch of batches.forStock(productId, variantId)) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.qtyRemaining);
    const updated = batches.update(batch.id, { qtyRemaining: batch.qtyRemaining - take });
    allocations.push({
      batchId: batch.id,
      qtyTaken: take,
      ownership: batch.ownership,
      unitCost: batch.unitCost,
      supplierId: batch.supplierId
    });
    if (context?.reference) {
      stockMovements.log({
        kind: 'sale',
        productId,
        variantId,
        locationId: batch.locationId,
        batchId: batch.id,
        qtyDelta: -take,
        qtyAfter: updated?.qtyRemaining ?? batch.qtyRemaining - take,
        unitCost: batch.unitCost,
        reference: context.reference,
        notes: context.notes ?? 'Penjualan'
      });
    }
    remaining -= take;
  }
  return allocations;
}

function deductComponents(
  comps: CompositeComponent[],
  multiplier: number,
  context?: { reference?: StockMovementReference; notes?: string }
): BatchAllocation[] {
  const allocations: BatchAllocation[] = [];
  for (const c of comps) {
    allocations.push(
      ...deductBatchesFIFO(c.productId, c.variantId, c.quantity * multiplier, context)
    );
  }
  return allocations;
}

/**
 * Apply a completed order to inventory.
 * Goods: deplete batches FIFO. Composites: deplete each component's batches via the recipe.
 * Extras with stock impact: deplete the extra's components per quantity sold.
 * Every batch touched is stamped onto the line's batchAllocations for downstream reports.
 */
export function applyOrderToStock(order: Order): void {
  const context = {
    reference: { kind: 'order' as const, id: order.id, code: order.code },
    notes: `Penjualan · ${order.code}`
  };
  for (const line of order.lines) {
    const product = products.getById(line.productId);
    if (!product) continue;
    const baseQty = line.quantity * (line.unitFactor || 1);
    const allocations: BatchAllocation[] = [];

    if (product.kind === 'composite') {
      const variant = line.variantId
        ? product.variants.find((v) => v.id === line.variantId)
        : undefined;
      const recipe = variant && variant.components.length > 0
        ? variant.components
        : product.components;
      allocations.push(...deductComponents(recipe, baseQty, context));
    } else {
      allocations.push(...deductBatchesFIFO(product.id, line.variantId, baseQty, context));
    }

    for (const ex of line.extras) {
      const extraDef = product.extras.find((e) => e.id === ex.extraId);
      if (extraDef && extraDef.components.length > 0) {
        allocations.push(...deductComponents(extraDef.components, line.quantity, context));
      }
    }

    line.batchAllocations = allocations;
  }
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  card: 'Kartu',
  qris: 'QRIS',
  transfer: 'Transfer'
};

export const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'card', label: 'Kartu' },
  { value: 'transfer', label: 'Transfer' }
];

export const orderStatusLabels: Record<OrderStatus, string> = {
  paid: 'Lunas',
  cancelled: 'Dibatalkan'
};

export function orderItemCount(order: Order): number {
  return order.lines.reduce((s, l) => s + l.quantity, 0);
}

// Walks paid orders (optionally restricted by date range) and aggregates
// consignment-owed amounts per supplier from each line's batchAllocations.
// Drives the Outstanding payables table on /payouts.
export function consignmentOwedBySupplier(args: {
  start?: string;
  end?: string;
}): Map<string, { units: number; amount: number }> {
  const result = new Map<string, { units: number; amount: number }>();
  for (const order of orders.items) {
    if (order.status !== 'paid') continue;
    const orderDate = order.createdAt.slice(0, 10);
    if (args.start && orderDate < args.start) continue;
    if (args.end && orderDate > args.end) continue;
    for (const line of order.lines) {
      for (const alloc of line.batchAllocations) {
        if (alloc.ownership !== 'consignment') continue;
        if (!alloc.supplierId) continue;
        const cur = result.get(alloc.supplierId) ?? { units: 0, amount: 0 };
        cur.units += alloc.qtyTaken;
        cur.amount += alloc.qtyTaken * alloc.unitCost;
        result.set(alloc.supplierId, cur);
      }
    }
  }
  return result;
}
