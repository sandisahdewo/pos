import { settings } from './settings.svelte';
import { user } from './user.svelte';
import {
  listStockMovements,
  createStockMovement
} from '$lib/api/stock-movements';

export type StockMovementKind =
  | 'receive'
  | 'sale'
  | 'sale-cancel'
  | 'adjust-in'
  | 'adjust-out'
  | 'move-out'
  | 'move-in'
  | 'move-relocate'
  | 'return-consignor'
  | 'production-in'
  | 'production-out';

export type StockMovementReferenceKind =
  | 'po'
  | 'order'
  | 'opname'
  | 'manual'
  | 'transfer'
  | 'return'
  | 'production';

export type StockMovementReference = {
  kind: StockMovementReferenceKind;
  id: string;
  code?: string;
};

export type StockAdjustmentReason =
  | 'damaged'
  | 'expired'
  | 'lost'
  | 'sample'
  | 'found'
  | 'initial-seed'
  | 'correction'
  | 'other';

export const adjustmentReasonLabels: Record<StockAdjustmentReason, string> = {
  damaged: 'Rusak / pecah',
  expired: 'Kedaluwarsa',
  lost: 'Hilang',
  sample: 'Sampel / promo',
  found: 'Ditemukan',
  'initial-seed': 'Stok awal',
  correction: 'Koreksi sistem',
  other: 'Lainnya'
};

export const adjustmentReasonsForOut: StockAdjustmentReason[] = [
  'damaged',
  'expired',
  'lost',
  'sample',
  'correction',
  'other'
];

export const adjustmentReasonsForIn: StockAdjustmentReason[] = [
  'found',
  'initial-seed',
  'correction',
  'other'
];

export type StockMovement = {
  id: string;
  code: string;
  at: string;
  kind: StockMovementKind;
  productId: string;
  variantId?: string;
  locationId: string;
  batchId: string;
  qtyDelta: number;
  qtyAfter: number;
  unitCost: number;
  reference?: StockMovementReference;
  reason?: StockAdjustmentReason;
  imageUrl?: string;
  performedBy: string;
  notes: string;
};

export type StockMovementInput = Omit<StockMovement, 'id' | 'code' | 'at' | 'performedBy'> & {
  performedBy?: string;
  at?: string;
};

function normalizeMovement(raw: unknown): StockMovement {
  const r = raw as Partial<StockMovement> & Record<string, unknown>;
  const ref = r.reference as
    | { kind?: string; id?: string; code?: string }
    | undefined;
  const hasRef = ref && ref.kind && ref.id;
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    at: String(r.at ?? ''),
    kind: (r.kind ?? 'adjust-in') as StockMovementKind,
    productId: String(r.productId ?? ''),
    variantId: (r.variantId as string | undefined) || undefined,
    locationId: String(r.locationId ?? ''),
    batchId: String(r.batchId ?? ''),
    qtyDelta: Number(r.qtyDelta ?? 0),
    qtyAfter: Number(r.qtyAfter ?? 0),
    unitCost: Number(r.unitCost ?? 0),
    reference: hasRef
      ? {
          kind: ref!.kind as StockMovementReferenceKind,
          id: String(ref!.id),
          code: ref!.code
        }
      : undefined,
    reason: (r.reason as StockAdjustmentReason | undefined) || undefined,
    imageUrl: (r.imageUrl as string | undefined) || undefined,
    performedBy: String(r.performedBy ?? ''),
    notes: (r.notes ?? '') as string
  };
}

function toMovementPayload(input: StockMovementInput, performedBy: string): Record<string, unknown> {
  return {
    kind: input.kind,
    productId: input.productId,
    variantId: input.variantId || null,
    locationId: input.locationId,
    batchId: input.batchId,
    qtyDelta: input.qtyDelta,
    qtyAfter: input.qtyAfter,
    unitCost: input.unitCost,
    reference: input.reference ?? { kind: 'manual', id: '' },
    reason: input.reason ?? null,
    imageUrl: input.imageUrl ?? '',
    performedBy,
    notes: input.notes,
    at: input.at ?? new Date().toISOString()
  };
}

class StockMovementsStore {
  items = $state<StockMovement[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listStockMovements({ limit: 500 });
      this.items = list.map(normalizeMovement);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async log(input: StockMovementInput): Promise<StockMovement | undefined> {
    if (!settings.value.inventory.auditTrailEnabled) return undefined;
    const performedBy = input.performedBy ?? user.current?.name ?? 'System';
    const created = await createStockMovement(toMovementPayload(input, performedBy));
    const m = normalizeMovement(created);
    this.items = [...this.items, m];
    return m;
  }

  getById(id: string): StockMovement | undefined {
    return this.items.find((m) => m.id === id);
  }

  recent(limit = 50): StockMovement[] {
    return [...this.items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  forProduct(
    productId: string,
    variantId?: string,
    opts?: { locationId?: string; since?: string; until?: string; limit?: number }
  ): StockMovement[] {
    const out = this.items.filter((m) => {
      if (m.productId !== productId) return false;
      if (variantId !== undefined && m.variantId !== variantId) return false;
      if (opts?.locationId && m.locationId !== opts.locationId) return false;
      if (opts?.since && m.at < opts.since) return false;
      if (opts?.until && m.at > opts.until) return false;
      return true;
    });
    out.sort((a, b) => b.at.localeCompare(a.at));
    return opts?.limit ? out.slice(0, opts.limit) : out;
  }

  forLocation(
    locationId: string,
    opts?: { since?: string; until?: string }
  ): StockMovement[] {
    return this.items
      .filter((m) => {
        if (m.locationId !== locationId) return false;
        if (opts?.since && m.at < opts.since) return false;
        if (opts?.until && m.at > opts.until) return false;
        return true;
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  forReference(kind: StockMovementReferenceKind, id: string): StockMovement[] {
    return this.items
      .filter((m) => m.reference?.kind === kind && m.reference.id === id)
      .sort((a, b) => a.at.localeCompare(b.at));
  }
}

export const stockMovements = new StockMovementsStore();

export const movementKindLabels: Record<StockMovementKind, string> = {
  receive: 'Penerimaan',
  sale: 'Penjualan',
  'sale-cancel': 'Pembatalan',
  'adjust-in': 'Penyesuaian +',
  'adjust-out': 'Penyesuaian −',
  'move-out': 'Pindah keluar',
  'move-in': 'Pindah masuk',
  'move-relocate': 'Relokasi',
  'return-consignor': 'Retur konsinyasi',
  'production-in': 'Produksi · hasil',
  'production-out': 'Produksi · konsumsi'
};

export const movementKindOptions: { value: StockMovementKind; label: string }[] =
  (Object.keys(movementKindLabels) as StockMovementKind[]).map((k) => ({
    value: k,
    label: movementKindLabels[k]
  }));
