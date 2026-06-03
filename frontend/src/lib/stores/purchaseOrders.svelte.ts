import { products, type Product, type ProductVariant } from './products.svelte';
import { batches } from './batches.svelte';
import { locations } from './locations.svelte';
import { stockMovements } from './stockMovements.svelte';
import {
  listPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder
} from '$lib/api/purchase-orders';

export type PurchaseOrderType = 'standard' | 'consignment';
export type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export type PurchaseOrderPaymentMethod = 'cash' | 'transfer' | 'other';

export type PurchaseOrderPayment = {
  id: string;
  amount: number;
  method: PurchaseOrderPaymentMethod;
  at: string;
  notes: string;
};

export type PurchaseOrderLine = {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  receivedQty: number;
  unitId: string;
  unitFactor: number;
  unitPrice: number;
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
  paidAmount: number;
  payments: PurchaseOrderPayment[];
  notes: string;
};

export type PurchaseOrderInput = Omit<PurchaseOrder, 'id' | 'code' | 'paidAmount' | 'payments'> & {
  paidAmount?: number;
  payments?: PurchaseOrderPayment[];
};

class PurchaseOrdersStore {
  items = $state<PurchaseOrder[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listPurchaseOrders();
      this.items = list.map(normalizeIncoming);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: PurchaseOrderInput): Promise<PurchaseOrder> {
    const payload = toPayload({
      ...input,
      id: '',
      code: '',
      paidAmount: input.paidAmount ?? 0,
      payments: input.payments ?? []
    });
    const created = await createPurchaseOrder(payload);
    const po = normalizeIncoming(created);
    this.items = [...this.items, po];
    return po;
  }

  async update(id: string, patch: Partial<PurchaseOrderInput>): Promise<PurchaseOrder | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const merged: PurchaseOrder = { ...current, ...patch } as PurchaseOrder;
    const updated = await updatePurchaseOrder(id, toPayload(merged));
    const po = normalizeIncoming(updated);
    this.items = this.items.map((p) => (p.id === id ? po : p));
    return po;
  }

  async remove(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const po = this.getById(id);
    if (!po) return { ok: false, reason: 'PO tidak ditemukan.' };
    if (po.status !== 'draft') return { ok: false, reason: 'Hanya draft yang bisa dihapus.' };
    try {
      await deletePurchaseOrder(id);
      this.items = this.items.filter((p) => p.id !== id);
      return { ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Gagal menghapus PO.';
      return { ok: false, reason };
    }
  }

  getById(id: string): PurchaseOrder | undefined {
    return this.items.find((p) => p.id === id);
  }

  async markSent(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const po = this.getById(id);
    if (!po) return { ok: false, reason: 'PO tidak ditemukan.' };
    if (po.status !== 'draft') return { ok: false, reason: 'Hanya draft yang bisa dikirim.' };
    if (po.lines.length === 0) return { ok: false, reason: 'Tambahkan minimal satu item.' };
    try {
      await this.update(id, { status: 'sent' });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Gagal.' };
    }
  }

  async cancel(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const po = this.getById(id);
    if (!po) return { ok: false, reason: 'PO tidak ditemukan.' };
    if (po.status === 'received') return { ok: false, reason: 'PO yang sudah diterima tidak bisa dibatalkan.' };
    if (po.status === 'cancelled') return { ok: false, reason: 'Sudah dibatalkan.' };
    try {
      await this.update(id, { status: 'cancelled' });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Gagal.' };
    }
  }

  // Record a supplier payment. Validates locally, then PATCHes the PO with
  // the appended payment + updated paidAmount.
  async recordPayment(
    poId: string,
    args: { amount: number; method: PurchaseOrderPaymentMethod; notes?: string; at?: string }
  ): Promise<{ ok: boolean; reason?: string; po?: PurchaseOrder }> {
    const po = this.getById(poId);
    if (!po) return { ok: false, reason: 'PO tidak ditemukan.' };
    if (po.type === 'consignment')
      return { ok: false, reason: 'PO konsinyasi memakai Pembayaran Konsinyasi, bukan Utang.' };
    if (po.status === 'cancelled') return { ok: false, reason: 'PO sudah dibatalkan.' };
    if (!Number.isFinite(args.amount) || args.amount <= 0)
      return { ok: false, reason: 'Jumlah pembayaran harus lebih dari 0.' };
    const total = poTotal(po);
    const outstanding = total - po.paidAmount;
    if (args.amount > outstanding + 0.0001)
      return { ok: false, reason: `Jumlah melebihi sisa utang (${outstanding}).` };

    const payment: PurchaseOrderPayment = {
      id: crypto.randomUUID(),
      amount: args.amount,
      method: args.method,
      at: args.at ?? new Date().toISOString(),
      notes: args.notes ?? ''
    };
    try {
      const updated = await this.update(poId, {
        paidAmount: po.paidAmount + args.amount,
        payments: [...po.payments, payment]
      } as Partial<PurchaseOrderInput>);
      return { ok: true, po: updated };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Gagal.' };
    }
  }

  // Receive flow: persist new PO state to backend, then run the stock-side
  // effects (batches + stockMovements + optional supplier cost update) on the
  // frontend. The latter still rely on frontend-only stores; will move to
  // backend when batches/stockMovements migrate.
  async receive(
    id: string,
    opts?: {
      receivedDate?: string;
      receiveQty?: Record<string, number>;
      expiresAt?: Record<string, string>;
      actualPrices?: Record<string, number>;
      updateSupplierCost?: Record<string, boolean>;
    }
  ): Promise<{ ok: boolean; reason?: string }> {
    const po = this.getById(id);
    if (!po) return { ok: false, reason: 'PO tidak ditemukan.' };
    if (po.status === 'received') return { ok: false, reason: 'PO sudah diterima sepenuhnya.' };
    if (po.status === 'cancelled') return { ok: false, reason: 'PO sudah dibatalkan.' };
    if (po.status === 'draft') return { ok: false, reason: 'Kirim PO terlebih dulu.' };
    if (po.lines.length === 0) return { ok: false, reason: 'Tidak ada item untuk diterima.' };

    const effectiveReceivedDate = opts?.receivedDate || new Date().toISOString().slice(0, 10);
    type SideEffect = {
      line: PurchaseOrderLine;
      baseQty: number;
      perBaseUnitCost: number;
      expiresAt?: string;
    };
    const sideEffects: SideEffect[] = [];

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
      const effectiveUnitPrice = opts?.actualPrices?.[line.id] ?? line.unitPrice;
      const perBaseUnitCost = effectiveUnitPrice / factor;

      sideEffects.push({
        line,
        baseQty,
        perBaseUnitCost,
        expiresAt: opts?.expiresAt?.[line.id] || undefined
      });

      touched++;
      return { ...line, receivedQty: line.receivedQty + qtyToReceive };
    });

    if (touched === 0) return { ok: false, reason: 'Tidak ada kuantitas untuk diterima.' };

    const allReceived = nextLines.every((l) => l.receivedQty >= l.quantity);
    const nextStatus: PurchaseOrderStatus = allReceived ? 'received' : 'partial';
    const patch: Partial<PurchaseOrderInput> = { status: nextStatus, lines: nextLines };
    if (allReceived) patch.receivedDate = effectiveReceivedDate;

    try {
      await this.update(id, patch);
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Gagal simpan PO.' };
    }

    for (const fx of sideEffects) {
      const newBatch = await batches.add({
        productId: fx.line.productId,
        variantId: fx.line.variantId,
        ownership: po.type === 'consignment' ? 'consignment' : 'owned',
        supplierId: po.supplierId,
        sourcePurchaseOrderId: po.id,
        sourcePurchaseOrderLineId: fx.line.id,
        unitCost: fx.perBaseUnitCost,
        qtyReceived: fx.baseQty,
        qtyRemaining: fx.baseQty,
        receivedAt: effectiveReceivedDate,
        expiresAt: fx.expiresAt,
        locationId: locations.defaultId(),
        notes: ''
      });
      await stockMovements.log({
        kind: 'receive',
        productId: fx.line.productId,
        variantId: fx.line.variantId,
        locationId: newBatch.locationId,
        batchId: newBatch.id,
        qtyDelta: fx.baseQty,
        qtyAfter: newBatch.qtyRemaining,
        unitCost: fx.perBaseUnitCost,
        reference: { kind: 'po', id: po.id, code: po.code },
        notes: po.type === 'consignment' ? 'Penerimaan konsinyasi' : 'Penerimaan PO'
      });

      if (opts?.updateSupplierCost?.[fx.line.id] && po.type !== 'consignment') {
        const product = products.getById(fx.line.productId);
        const existing = product?.suppliers ?? [];
        const idx = existing.findIndex((s) => s.supplierId === po.supplierId);
        if (idx >= 0) {
          const updated = existing.map((s, i) =>
            i === idx ? { ...s, unitCost: fx.perBaseUnitCost } : s
          );
          void products.update(fx.line.productId, { suppliers: updated });
        }
      }
    }

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

// ─── Shape coercion ────────────────────────────────────────────────────────
// Backend uses TEXT for dates ("" when unset). Frontend already expects that
// shape — but variantId/unitId come back as undefined when null at DB level,
// and frontend expects string (empty when unset). Normalize on the boundary.

function normalizeIncoming(raw: unknown): PurchaseOrder {
  const r = raw as Partial<PurchaseOrder> & Record<string, unknown>;
  const lines = ((r.lines as PurchaseOrderLine[] | undefined) ?? []).map((l) => ({
    id: l.id,
    productId: l.productId,
    variantId: l.variantId ?? undefined,
    quantity: Number(l.quantity ?? 0),
    receivedQty: Number(l.receivedQty ?? 0),
    unitId: l.unitId ?? '',
    unitFactor: Number(l.unitFactor ?? 1),
    unitPrice: Number(l.unitPrice ?? 0),
    notes: l.notes ?? ''
  }));
  const payments = ((r.payments as PurchaseOrderPayment[] | undefined) ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount ?? 0),
    method: (p.method ?? 'cash') as PurchaseOrderPaymentMethod,
    at: p.at ?? '',
    notes: p.notes ?? ''
  }));
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    type: (r.type ?? 'standard') as PurchaseOrderType,
    supplierId: String(r.supplierId ?? ''),
    status: (r.status ?? 'draft') as PurchaseOrderStatus,
    orderDate: (r.orderDate ?? '') as string,
    expectedDate: (r.expectedDate ?? '') as string,
    receivedDate: (r.receivedDate ?? '') as string,
    lines,
    paidAmount: Number(r.paidAmount ?? 0),
    payments,
    notes: (r.notes ?? '') as string
  };
}

function toPayload(po: Partial<PurchaseOrder>): Record<string, unknown> {
  return {
    type: po.type ?? 'standard',
    supplierId: po.supplierId,
    status: po.status ?? 'draft',
    orderDate: po.orderDate ?? '',
    expectedDate: po.expectedDate ?? '',
    receivedDate: po.receivedDate ?? '',
    paidAmount: po.paidAmount ?? 0,
    notes: po.notes ?? '',
    lines: (po.lines ?? []).map((l) => ({
      id: l.id,
      productId: l.productId,
      variantId: l.variantId || null,
      quantity: l.quantity,
      receivedQty: l.receivedQty,
      unitId: l.unitId || null,
      unitFactor: l.unitFactor,
      unitPrice: l.unitPrice,
      notes: l.notes
    })),
    payments: (po.payments ?? []).map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      at: p.at,
      notes: p.notes
    }))
  };
}

export const purchaseOrders = new PurchaseOrdersStore();

export function lineSubtotal(line: PurchaseOrderLine): number {
  return line.quantity * line.unitPrice;
}

export function lineBaseQuantity(line: PurchaseOrderLine): number {
  return line.quantity * (line.unitFactor || 1);
}

export function lineBaseUnitCost(line: PurchaseOrderLine): number {
  return line.unitPrice / (line.unitFactor || 1);
}

export function poTotal(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + lineSubtotal(l), 0);
}

export function variantOptionsFor(product: Product | undefined): ProductVariant[] {
  return product?.variants ?? [];
}

export const purchaseOrderTypeLabels: Record<PurchaseOrderType, string> = {
  standard: 'Standard',
  consignment: 'Konsinyasi'
};

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  partial: 'Sebagian diterima',
  received: 'Diterima',
  cancelled: 'Dibatalkan'
};
