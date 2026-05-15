import { products, type Product, type ProductVariant } from './products.svelte';
import { batches } from './batches.svelte';
import { locations } from './locations.svelte';
import { stockMovements } from './stockMovements.svelte';

export type PurchaseOrderType = 'standard' | 'consignment';
export type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export type PurchaseOrderPaymentMethod = 'cash' | 'transfer' | 'other';

export type PurchaseOrderPayment = {
  id: string;
  amount: number;
  method: PurchaseOrderPaymentMethod;
  at: string;        // ISO datetime
  notes: string;
};

export type PurchaseOrderLine = {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;        // ordered quantity (chosen unit)
  receivedQty: number;     // already received (chosen unit); 0 ≤ receivedQty ≤ quantity
  unitId: string;          // base unit or one of the product's packaging units
  unitFactor: number;      // base units per 1 of unitId (snapshot at PO creation)
  unitPrice: number;       // price per chosen unit
  notes: string;
};

export type PurchaseOrder = {
  id: string;
  code: string;
  type: PurchaseOrderType;
  supplierId: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string;
  receivedDate: string;
  lines: PurchaseOrderLine[];
  paidAmount: number;                   // cumulative payments to supplier (for standard POs only)
  payments: PurchaseOrderPayment[];     // chronological partial payments
  notes: string;
};

export type PurchaseOrderInput = Omit<PurchaseOrder, 'id' | 'code' | 'paidAmount' | 'payments'> & {
  paidAmount?: number;
  payments?: PurchaseOrderPayment[];
};

const seed: PurchaseOrder[] = [
  {
    id: 'po_1',
    code: 'PO-2026-001',
    type: 'standard',
    supplierId: 'sup_1',
    status: 'received',
    orderDate: '2026-04-15',
    expectedDate: '2026-04-22',
    receivedDate: '2026-04-22',
    lines: [
      {
        id: 'pol_1',
        productId: 'prd_1',
        quantity: 50,
        receivedQty: 50,
        unitId: 'unit_1',
        unitFactor: 1,
        unitPrice: 5000,
        notes: ''
      },
      {
        id: 'pol_2',
        productId: 'prd_2',
        quantity: 20,
        receivedQty: 20,
        unitId: 'unit_1',
        unitFactor: 1,
        unitPrice: 12000,
        notes: ''
      }
    ],
    paidAmount: 200000,
    payments: [
      {
        id: 'popay_seed_1',
        amount: 200000,
        method: 'transfer',
        at: '2026-04-23T09:00:00.000Z',
        notes: 'DP 40% setelah barang diterima — sisa Net-14 dari supplier.'
      }
    ],
    notes: 'Monthly coffee order.'
  },
  {
    id: 'po_2',
    code: 'PO-2026-002',
    type: 'standard',
    supplierId: 'sup_2',
    status: 'draft',
    orderDate: '2026-05-12',
    expectedDate: '2026-05-13',
    receivedDate: '',
    lines: [
      {
        id: 'pol_3',
        productId: 'prd_3',
        quantity: 24,
        receivedQty: 0,
        unitId: 'unit_1',
        unitFactor: 1,
        unitPrice: 8000,
        notes: ''
      }
    ],
    paidAmount: 0,
    payments: [],
    notes: 'Pastry delivery, cash on delivery.'
  },
  {
    id: 'po_3',
    code: 'PO-2026-003',
    type: 'consignment',
    supplierId: 'sup_3',
    status: 'sent',
    orderDate: '2026-05-10',
    expectedDate: '2026-05-24',
    receivedDate: '',
    lines: [
      {
        id: 'pol_4',
        productId: 'prd_4',
        variantId: 'v_1',
        quantity: 8,
        receivedQty: 0,
        unitId: 'unit_1',
        unitFactor: 1,
        unitPrice: 50000,
        notes: 'White colorway'
      },
      {
        id: 'pol_5',
        productId: 'prd_4',
        variantId: 'v_2',
        quantity: 8,
        receivedQty: 0,
        unitId: 'unit_1',
        unitFactor: 1,
        unitPrice: 50000,
        notes: 'Black colorway'
      },
      {
        id: 'pol_6',
        productId: 'prd_4',
        variantId: 'v_3',
        quantity: 4,
        receivedQty: 0,
        unitId: 'unit_1',
        unitFactor: 1,
        unitPrice: 60000,
        notes: 'Brand Blue, premium'
      }
    ],
    paidAmount: 0,
    payments: [],
    notes: 'Quarterly consignment refresh. Pay only as items sell.'
  },
  {
    id: 'po_4',
    code: 'PO-2026-004',
    type: 'standard',
    supplierId: 'sup_4',
    status: 'draft',
    orderDate: '2026-05-13',
    expectedDate: '2026-05-16',
    receivedDate: '',
    lines: [
      {
        id: 'pol_7',
        productId: 'prd_5',
        quantity: 20,
        receivedQty: 0,
        unitId: 'unit_2',
        unitFactor: 24,
        unitPrice: 78000,
        notes: '24-can case'
      },
      {
        id: 'pol_8',
        productId: 'prd_5',
        quantity: 30,
        receivedQty: 0,
        unitId: 'unit_2',
        unitFactor: 6,
        unitPrice: 21000,
        notes: '6-pack'
      }
    ],
    paidAmount: 0,
    payments: [],
    notes: 'Weekly beverage restock.'
  },
  {
    id: 'po_5',
    code: 'PO-2026-005',
    type: 'standard',
    supplierId: 'sup_2',
    status: 'sent',
    orderDate: '2026-05-13',
    expectedDate: '2026-05-13',
    receivedDate: '',
    lines: [
      {
        id: 'pol_9',
        productId: 'prd_8',
        quantity: 60,
        receivedQty: 0,
        unitId: 'unit_1',
        unitFactor: 1,
        unitPrice: 2500,
        notes: '60 butir, segar hari ini'
      },
      {
        id: 'pol_10',
        productId: 'prd_9',
        quantity: 1,
        receivedQty: 0,
        unitId: 'unit_3',
        unitFactor: 1000,
        unitPrice: 135000,
        notes: '1 kg daging cincang'
      },
      {
        id: 'pol_11',
        productId: 'prd_3',
        quantity: 24,
        receivedQty: 0,
        unitId: 'unit_1',
        unitFactor: 1,
        unitPrice: 8000,
        notes: 'Croissant baru'
      }
    ],
    paidAmount: 100000,
    payments: [
      {
        id: 'popay_seed_2',
        amount: 100000,
        method: 'cash',
        at: '2026-05-13T07:30:00.000Z',
        notes: 'DP tunai saat order — sisa dibayar saat antar besok.'
      }
    ],
    notes: 'Pengiriman bahan segar pagi — semua butuh tanggal kedaluwarsa saat diterima.'
  }
];

function fmtCodeNumber(n: number): string {
  return n.toString().padStart(3, '0');
}

class PurchaseOrdersStore {
  items = $state<PurchaseOrder[]>([...seed]);
  private nextId = seed.length + 1;
  private nextCodeNum = seed.length + 1;

  private generateCode(): string {
    const year = new Date().getFullYear();
    return `PO-${year}-${fmtCodeNumber(this.nextCodeNum++)}`;
  }

  add(input: PurchaseOrderInput): PurchaseOrder {
    const po: PurchaseOrder = {
      ...input,
      id: `po_${this.nextId++}`,
      code: this.generateCode(),
      paidAmount: input.paidAmount ?? 0,
      payments: input.payments ?? []
    };
    this.items.push(po);
    return po;
  }

  // Record a payment toward a standard (non-consignment) PO. Tracks supplier
  // utang separately from receive() — paying doesn't affect stock; receiving
  // doesn't affect payments. Consignment POs use /payouts instead.
  recordPayment(
    poId: string,
    args: {
      amount: number;
      method: PurchaseOrderPaymentMethod;
      notes?: string;
      at?: string;
    }
  ): { ok: boolean; reason?: string; po?: PurchaseOrder } {
    const idx = this.items.findIndex((p) => p.id === poId);
    if (idx === -1) return { ok: false, reason: 'PO not found.' };
    const po = this.items[idx];
    if (po.type === 'consignment')
      return {
        ok: false,
        reason: 'PO konsinyasi memakai Pembayaran Konsinyasi, bukan Utang.'
      };
    if (po.status === 'cancelled')
      return { ok: false, reason: 'PO sudah dibatalkan.' };
    if (!Number.isFinite(args.amount) || args.amount <= 0)
      return { ok: false, reason: 'Jumlah pembayaran harus lebih dari 0.' };
    const total = poTotal(po);
    const outstanding = total - po.paidAmount;
    if (args.amount > outstanding + 0.0001)
      return {
        ok: false,
        reason: `Jumlah melebihi sisa utang (${outstanding}).`
      };
    const payment: PurchaseOrderPayment = {
      id: `popay_${crypto.randomUUID()}`,
      amount: args.amount,
      method: args.method,
      at: args.at ?? new Date().toISOString(),
      notes: args.notes ?? ''
    };
    this.items[idx] = {
      ...po,
      paidAmount: po.paidAmount + args.amount,
      payments: [...po.payments, payment]
    };
    return { ok: true, po: this.items[idx] };
  }

  update(id: string, patch: Partial<PurchaseOrderInput>): PurchaseOrder | undefined {
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string): boolean {
    const po = this.getById(id);
    if (!po) return false;
    if (po.status !== 'draft') return false;
    this.items = this.items.filter((p) => p.id !== id);
    return true;
  }

  getById(id: string): PurchaseOrder | undefined {
    return this.items.find((p) => p.id === id);
  }

  markSent(id: string): { ok: boolean; reason?: string } {
    const po = this.getById(id);
    if (!po) return { ok: false, reason: 'PO not found.' };
    if (po.status !== 'draft') return { ok: false, reason: 'Only drafts can be sent.' };
    if (po.lines.length === 0) return { ok: false, reason: 'Add at least one line first.' };
    this.update(id, { status: 'sent' });
    return { ok: true };
  }

  cancel(id: string): { ok: boolean; reason?: string } {
    const po = this.getById(id);
    if (!po) return { ok: false, reason: 'PO not found.' };
    if (po.status === 'received') return { ok: false, reason: 'Received POs cannot be cancelled.' };
    if (po.status === 'cancelled') return { ok: false, reason: 'Already cancelled.' };
    this.update(id, { status: 'cancelled' });
    return { ok: true };
  }

  // Receive supports partial fulfillment. `receiveQty` maps line.id → qty to receive
  // this round (in the line's chosen unit). Omitted lines receive their full remaining
  // quantity. `expiresAt` maps line.id → ISO date for batches whose product
  // requiresExpiration. Status transitions to 'partial' if some but not all lines
  // are fully done, or 'received' when every line is complete.
  receive(
    id: string,
    opts?: {
      receivedDate?: string;
      receiveQty?: Record<string, number>;
      expiresAt?: Record<string, string>;
    }
  ): { ok: boolean; reason?: string } {
    const po = this.getById(id);
    if (!po) return { ok: false, reason: 'PO not found.' };
    if (po.status === 'received') return { ok: false, reason: 'Already received.' };
    if (po.status === 'cancelled') return { ok: false, reason: 'PO is cancelled.' };
    if (po.status === 'draft') return { ok: false, reason: 'Mark as sent first.' };
    if (po.lines.length === 0) return { ok: false, reason: 'No lines to receive.' };

    const effectiveReceivedDate = opts?.receivedDate || new Date().toISOString().slice(0, 10);
    let touched = 0;
    const nextLines = po.lines.map((line) => {
      if (line.quantity <= 0) return line;
      const product = products.getById(line.productId);
      if (!product) return line;

      const remaining = line.quantity - line.receivedQty;
      if (remaining <= 0) return line;

      const requested = opts?.receiveQty?.[line.id];
      const qtyToReceive = Math.max(
        0,
        Math.min(remaining, requested === undefined ? remaining : requested)
      );
      if (qtyToReceive === 0) return line;

      const factor = line.unitFactor > 0 ? line.unitFactor : 1;
      const baseQty = qtyToReceive * factor;
      const perBaseUnitCost = line.unitPrice / factor;

      const newBatch = batches.add({
        productId: line.productId,
        variantId: line.variantId,
        ownership: po.type === 'consignment' ? 'consignment' : 'owned',
        supplierId: po.supplierId,
        sourcePurchaseOrderId: po.id,
        sourcePurchaseOrderLineId: line.id,
        unitCost: perBaseUnitCost,
        qtyReceived: baseQty,
        qtyRemaining: baseQty,
        receivedAt: effectiveReceivedDate,
        expiresAt: opts?.expiresAt?.[line.id] || undefined,
        locationId: locations.defaultId(),
        notes: ''
      });

      stockMovements.log({
        kind: 'receive',
        productId: line.productId,
        variantId: line.variantId,
        locationId: newBatch.locationId,
        batchId: newBatch.id,
        qtyDelta: baseQty,
        qtyAfter: newBatch.qtyRemaining,
        unitCost: perBaseUnitCost,
        reference: { kind: 'po', id: po.id, code: po.code },
        notes: po.type === 'consignment' ? 'Penerimaan konsinyasi' : 'Penerimaan PO'
      });

      touched++;
      return { ...line, receivedQty: line.receivedQty + qtyToReceive };
    });

    if (touched === 0) return { ok: false, reason: 'No quantities to receive.' };

    const allReceived = nextLines.every((l) => l.receivedQty >= l.quantity);
    const nextStatus: PurchaseOrderStatus = allReceived ? 'received' : 'partial';
    const patch: Partial<PurchaseOrderInput> = { status: nextStatus, lines: nextLines };
    if (allReceived) patch.receivedDate = effectiveReceivedDate;
    this.update(id, patch);
    return { ok: true };
  }

  countBySupplier(supplierId: string): number {
    return this.items.reduce((n, p) => (p.supplierId === supplierId ? n + 1 : n), 0);
  }

  hasConsignmentFor(productId: string): boolean {
    return this.items.some(
      (po) =>
        po.type === 'consignment' &&
        po.status !== 'cancelled' &&
        po.lines.some((l) => l.productId === productId)
    );
  }
}

export const purchaseOrders = new PurchaseOrdersStore();

export function lineSubtotal(line: PurchaseOrderLine): number {
  return line.quantity * line.unitPrice;
}

export function lineBaseQuantity(line: PurchaseOrderLine): number {
  const factor = line.unitFactor > 0 ? line.unitFactor : 1;
  return line.quantity * factor;
}

export function lineBaseUnitCost(line: PurchaseOrderLine): number {
  const factor = line.unitFactor > 0 ? line.unitFactor : 1;
  return line.unitPrice / factor;
}

export function poTotal(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + lineSubtotal(l), 0);
}

export function variantOptionsFor(product: Product | undefined): ProductVariant[] {
  return product?.variants ?? [];
}

export const purchaseOrderTypeLabels: Record<PurchaseOrderType, string> = {
  standard: 'Standar',
  consignment: 'Konsinyasi'
};

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  partial: 'Sebagian diterima',
  received: 'Diterima',
  cancelled: 'Dibatalkan'
};
