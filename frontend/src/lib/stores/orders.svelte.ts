import {
  products,
  productionModeOf,
  recipeOf,
  type CompositeComponent
} from './products.svelte';
import { batches, type BatchAllocation } from './batches.svelte';
import { stockMovements, type StockMovementReference } from './stockMovements.svelte';
import { listOrders, createOrder, updateOrder } from '$lib/api/orders';

export type OrderStatus = 'paid' | 'credit' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'qris' | 'transfer';

export type OrderPayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  at: string;        // ISO datetime
  notes: string;
};

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
  linePromoDiscount?: number;   // discount applied to this line (line + order share); omitted means 0
  lineSubtotalNet?: number;     // = lineSubtotal - linePromoDiscount; omitted means lineSubtotal
  lineTax: number;              // = lineSubtotalNet × taxRatePct / 100
  lineTotal: number;            // = lineSubtotalNet + lineTax
  batchAllocations: BatchAllocation[];  // populated by applyOrderToStock at charge time
};

export type OrderPromoApplication = {
  promoId: string;
  promoCode: string;
  promoName: string;
  kind: 'discount' | 'combo' | 'bogo' | 'member-tier' | 'expiring-batch';
  level: 'line' | 'order';
  affectedLineIds: string[];
  discountAmount: number;
  description: string;
};

export type Order = {
  id: string;
  code: string;                 // ORD-YYYY-NNN
  pricelistId: string;
  customerId?: string;
  employeeId?: string;
  shiftId?: string;             // attribution when shifts feature is on
  paymentMethod: PaymentMethod; // method used at charge time (first payment)
  lines: OrderLine[];
  appliedPromos?: OrderPromoApplication[];  // snapshot of promo applications at sale time; omitted means none
  promoDiscount?: number;       // total discount across all promos; omitted means 0
  subtotal: number;             // sum of line subtotals (gross, pre-promo, pre-tax)
  netSubtotal?: number;         // subtotal - promoDiscount; omitted means subtotal
  taxTotal: number;             // sum of line tax (computed on net)
  total: number;                // netSubtotal + taxTotal
  paidAmount: number;           // cumulative payments received; total when fully paid
  payments: OrderPayment[];     // chronological list of partial payments (incl. initial)
  status: OrderStatus;          // 'credit' when paidAmount < total, 'paid' when full, 'cancelled' otherwise
  notes: string;
  // F&B service metadata. Snapshotted at charge time when settings.operations.fnb.enabled.
  // Legacy orders (charged before the feature was on) omit both fields.
  serviceType?: 'dineIn' | 'takeAway';
  tableNumber?: string;
  createdAt: string;            // ISO datetime
};

export type OrderInput = Omit<Order, 'id' | 'code' | 'createdAt' | 'paidAmount' | 'payments'> & {
  paidAmount?: number;
  payments?: OrderPayment[];
};

function normalizeOrder(raw: unknown): Order {
  const r = raw as Partial<Order> & Record<string, unknown>;
  const lines = ((r.lines as OrderLine[] | undefined) ?? []).map((l) => ({
    id: l.id,
    productId: l.productId,
    variantId: l.variantId ?? undefined,
    productName: l.productName,
    variantName: l.variantName ?? '',
    unitId: l.unitId ?? '',
    unitFactor: Number(l.unitFactor ?? 1),
    unitCode: l.unitCode ?? '',
    quantity: Number(l.quantity ?? 0),
    unitPrice: Number(l.unitPrice ?? 0),
    extras: l.extras ?? [],
    taxRatePct: Number(l.taxRatePct ?? 0),
    lineSubtotal: Number(l.lineSubtotal ?? 0),
    linePromoDiscount: l.linePromoDiscount,
    lineSubtotalNet: l.lineSubtotalNet,
    lineTax: Number(l.lineTax ?? 0),
    lineTotal: Number(l.lineTotal ?? 0),
    batchAllocations: l.batchAllocations ?? []
  }));
  const payments = ((r.payments as OrderPayment[] | undefined) ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount ?? 0),
    method: p.method ?? 'cash',
    at: p.at ?? '',
    notes: p.notes ?? ''
  }));
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    pricelistId: (r.pricelistId ?? '') as string,
    customerId: (r.customerId as string | undefined) || undefined,
    employeeId: (r.employeeId as string | undefined) || undefined,
    shiftId: (r.shiftId as string | undefined) || undefined,
    paymentMethod: (r.paymentMethod ?? 'cash') as PaymentMethod,
    lines,
    appliedPromos: r.appliedPromos as OrderPromoApplication[] | undefined,
    promoDiscount: Number(r.promoDiscount ?? 0) || undefined,
    subtotal: Number(r.subtotal ?? 0),
    netSubtotal: r.netSubtotal as number | undefined,
    taxTotal: Number(r.taxTotal ?? 0),
    total: Number(r.total ?? 0),
    paidAmount: Number(r.paidAmount ?? 0),
    payments,
    status: (r.status ?? 'paid') as OrderStatus,
    notes: (r.notes ?? '') as string,
    serviceType: r.serviceType as 'dineIn' | 'takeAway' | undefined,
    tableNumber: (r.tableNumber as string | undefined) || undefined,
    createdAt: (r.createdAt ?? '') as string
  };
}

function toPayload(o: Partial<Order>): Record<string, unknown> {
  return {
    pricelistId: o.pricelistId || null,
    customerId: o.customerId || null,
    employeeId: o.employeeId || null,
    shiftId: o.shiftId || null,
    paymentMethod: o.paymentMethod ?? 'cash',
    appliedPromos: o.appliedPromos ?? [],
    promoDiscount: o.promoDiscount ?? 0,
    subtotal: o.subtotal ?? 0,
    netSubtotal: o.netSubtotal ?? (o.subtotal ?? 0),
    taxTotal: o.taxTotal ?? 0,
    total: o.total ?? 0,
    paidAmount: o.paidAmount ?? 0,
    status: o.status ?? 'paid',
    notes: o.notes ?? '',
    serviceType: o.serviceType || null,
    tableNumber: o.tableNumber || '',
    lines: (o.lines ?? []).map((l) => ({
      id: l.id || undefined,
      productId: l.productId,
      variantId: l.variantId || null,
      productName: l.productName,
      variantName: l.variantName ?? '',
      unitId: l.unitId || null,
      unitFactor: l.unitFactor || 1,
      unitCode: l.unitCode ?? '',
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      extras: l.extras ?? [],
      taxRatePct: l.taxRatePct ?? 0,
      lineSubtotal: l.lineSubtotal ?? 0,
      linePromoDiscount: l.linePromoDiscount ?? 0,
      lineSubtotalNet: l.lineSubtotalNet ?? (l.lineSubtotal ?? 0),
      lineTax: l.lineTax ?? 0,
      lineTotal: l.lineTotal ?? 0,
      batchAllocations: l.batchAllocations ?? []
    })),
    payments: (o.payments ?? []).map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      at: p.at,
      notes: p.notes
    }))
  };
}

class OrdersStore {
  items = $state<Order[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listOrders();
      this.items = list.map(normalizeOrder);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Create an order on the backend. The stock side-effects (FIFO batch
   * deduction + stockMovements logging + persisting line.batchAllocations)
   * are handled by applyOrderToStock(order), called by the caller after add()
   * returns. Two-step flow because applyOrderToStock still mutates frontend-
   * only stores (batches, stockMovements) until those migrate.
   */
  async add(input: OrderInput): Promise<Order> {
    const createdAt = new Date().toISOString();
    const paidAmount = input.paidAmount ?? (input.status === 'paid' ? input.total : 0);
    const payments: OrderPayment[] =
      input.payments && input.payments.length > 0
        ? input.payments
        : paidAmount > 0
          ? [
              {
                id: crypto.randomUUID(),
                amount: paidAmount,
                method: input.paymentMethod,
                at: createdAt,
                notes:
                  input.status === 'credit'
                    ? 'Pembayaran awal (DP)'
                    : 'Pembayaran tunai/lunas saat penjualan'
              }
            ]
          : [];
    const payload: Order = {
      id: '',
      code: '',
      pricelistId: input.pricelistId,
      customerId: input.customerId,
      employeeId: input.employeeId,
      shiftId: input.shiftId,
      paymentMethod: input.paymentMethod,
      lines: input.lines,
      appliedPromos: input.appliedPromos,
      promoDiscount: input.promoDiscount,
      subtotal: input.subtotal,
      netSubtotal: input.netSubtotal,
      taxTotal: input.taxTotal,
      total: input.total,
      paidAmount,
      payments,
      status: input.status,
      notes: input.notes,
      serviceType: input.serviceType,
      tableNumber: input.tableNumber,
      createdAt
    };
    const created = await createOrder(toPayload(payload));
    const order = normalizeOrder(created);
    this.items = [order, ...this.items];
    return order;
  }

  getById(id: string): Order | undefined {
    return this.items.find((o) => o.id === id);
  }

  /**
   * Append a payment toward an outstanding order. Flips status to 'paid'
   * when paidAmount >= total. Persists via full PATCH.
   */
  async recordPayment(
    orderId: string,
    args: { amount: number; method: PaymentMethod; notes?: string; at?: string }
  ): Promise<{ ok: boolean; reason?: string; order?: Order }> {
    const order = this.getById(orderId);
    if (!order) return { ok: false, reason: 'Order tidak ditemukan.' };
    if (order.status === 'cancelled')
      return { ok: false, reason: 'Order sudah dibatalkan.' };
    if (!Number.isFinite(args.amount) || args.amount <= 0)
      return { ok: false, reason: 'Jumlah pembayaran harus lebih dari 0.' };
    const outstanding = order.total - order.paidAmount;
    if (args.amount > outstanding + 0.0001)
      return { ok: false, reason: `Jumlah melebihi sisa piutang (${outstanding}).` };

    const payment: OrderPayment = {
      id: crypto.randomUUID(),
      amount: args.amount,
      method: args.method,
      at: args.at ?? new Date().toISOString(),
      notes: args.notes ?? ''
    };
    const nextPaid = order.paidAmount + args.amount;
    const nextStatus: OrderStatus = nextPaid >= order.total ? 'paid' : 'credit';
    try {
      const updated = await updateOrder(
        orderId,
        toPayload({
          ...order,
          paidAmount: nextPaid,
          status: nextStatus,
          payments: [...order.payments, payment]
        })
      );
      const o = normalizeOrder(updated);
      this.items = this.items.map((x) => (x.id === orderId ? o : x));
      return { ok: true, order: o };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Gagal.' };
    }
  }

  /**
   * Cancel an order: restore batch quantities (frontend), log sale-cancel
   * movements (frontend), then PATCH status='cancelled' to the backend.
   */
  async cancel(id: string): Promise<{ ok: boolean; reason?: string }> {
    const order = this.getById(id);
    if (!order) return { ok: false, reason: 'Order tidak ditemukan.' };
    if (order.status === 'cancelled') return { ok: false, reason: 'Sudah dibatalkan.' };

    const reference: StockMovementReference = { kind: 'order', id: order.id, code: order.code };
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

    try {
      const updated = await updateOrder(id, toPayload({ ...order, status: 'cancelled' }));
      const o = normalizeOrder(updated);
      this.items = this.items.map((x) => (x.id === id ? o : x));
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Gagal.' };
    }
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
    // Component qty may be expressed in a packaging unit (mis. 1 ekor = 8 pcs);
    // convert to base via unitFactor before charging stock.
    const baseQty = c.quantity * (c.unitFactor ?? 1) * multiplier;
    allocations.push(
      ...deductCompositeOrGoods(c.productId, c.variantId, baseQty, context)
    );
  }
  return allocations;
}

// Mode-aware deduction for one (product, variant?, qty) tuple. Used by the
// composite-sale branch below and by deductComponents for nested composites.
//
//   • Goods → straight FIFO from batches.
//   • Composite with produced stock → straight FIFO from those batches
//     (treat the composite like any goods product once it's been produced).
//   • Composite without produced stock:
//       - mode 'flexible' → recurse into the recipe (cafe / fried-chicken
//         fallback). Variant override on the recipe is honored via recipeOf.
//       - mode 'strict'   → no fallback; allocation list comes back short
//         and the caller logs an out-of-stock at that line.
function deductCompositeOrGoods(
  productId: string,
  variantId: string | undefined,
  qty: number,
  context?: { reference?: StockMovementReference; notes?: string }
): BatchAllocation[] {
  if (qty <= 0) return [];
  const product = products.getById(productId);
  if (!product || product.kind !== 'composite') {
    return deductBatchesFIFO(productId, variantId, qty, context);
  }
  // Composite. First try its own produced batches.
  const fromOwn = deductBatchesFIFO(productId, variantId, qty, context);
  const taken = fromOwn.reduce((s, a) => s + a.qtyTaken, 0);
  const shortfall = qty - taken;
  if (shortfall <= 0) return fromOwn;
  // Composite ran short — mode decides what happens.
  const mode = productionModeOf(product, variantId);
  if (mode === 'strict') {
    // No fallback. We may have taken some real composite batches above; that
    // stays consumed. The remaining shortfall just isn't fulfilled — this is
    // an inventory underrun, not a normal happy path. Operators see it as
    // qtyAfter going to 0 with no further allocations.
    return fromOwn;
  }
  // Flexible: recurse into the recipe. Multiplier is `shortfall` because the
  // recipe quantities are per-unit of the composite.
  const recipe = recipeOf(product, variantId);
  if (recipe.length === 0) return fromOwn;
  return [...fromOwn, ...deductComponents(recipe, shortfall, context)];
}

/**
 * Apply a completed order to inventory.
 * Goods: deplete batches FIFO. Composites: deplete each component's batches via the recipe.
 * Extras with stock impact: deplete the extra's components per quantity sold.
 * Every batch touched is stamped onto the line's batchAllocations for downstream reports,
 * then PATCH'd back to the backend so the snapshot survives a reload.
 *
 * The batches/stockMovements mutations stay frontend-only until those stores
 * migrate — see docs/CONSIGNMENT.md for the snapshot rationale.
 */
export async function applyOrderToStock(order: Order): Promise<void> {
  const context = {
    reference: { kind: 'order' as const, id: order.id, code: order.code },
    notes: `Penjualan · ${order.code}`
  };
  for (const line of order.lines) {
    const product = products.getById(line.productId);
    if (!product) continue;
    const baseQty = line.quantity * (line.unitFactor || 1);
    const allocations: BatchAllocation[] = [];

    // Both branches share the same mode-aware deductor — composites that have
    // produced batches behave just like goods at the till; only when they run
    // out does the mode decide whether to fall back to components (flexible)
    // or stop (strict).
    allocations.push(
      ...deductCompositeOrGoods(product.id, line.variantId, baseQty, context)
    );

    for (const ex of line.extras) {
      const extraDef = product.extras.find((e) => e.id === ex.extraId);
      if (extraDef && extraDef.components.length > 0) {
        allocations.push(...deductComponents(extraDef.components, line.quantity, context));
      }
    }

    line.batchAllocations = allocations;
  }

  // Persist the populated allocations back to the order row. Best-effort —
  // if it fails, the allocations live only in the in-memory cache until the
  // next reload. Acceptable since batches/stockMovements are still local too.
  try {
    await updateOrder(order.id, toPayload(order));
  } catch {
    /* allocations stay client-side; reload will lose them until backend persists */
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
  credit: 'Piutang',
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
