import { settings } from './settings.svelte';
import { user } from './user.svelte';

export type StockMovementKind =
  | 'receive'
  | 'sale'
  | 'sale-cancel'
  | 'adjust-in'
  | 'adjust-out'
  | 'move-out'
  | 'move-in'
  | 'move-relocate'
  | 'return-consignor';

export type StockMovementReferenceKind =
  | 'po'
  | 'order'
  | 'opname'
  | 'manual'
  | 'transfer'
  | 'return';

export type StockMovementReference = {
  kind: StockMovementReferenceKind;
  id: string;
  code?: string;
};

// Why a manual adjust-in/out happened. Only meaningful for adjust-in / adjust-out
// rows authored via the /inventory Atur modal — sales / receives / moves / opname
// reconciliations carry their own context via `reference` instead.
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

function fmtCodeNumber(n: number): string {
  return n.toString().padStart(4, '0');
}

// Seed example movements — anchored to existing seed batches in `batches.svelte`.
// The qtyAfter values on each batch's LAST seeded movement match that batch's
// current qtyRemaining, so /inventory and /stock-movements stay consistent.
const seed: StockMovement[] = [
  // === Espresso Beans (prd_1, batch_1) — receive + sale that was later cancelled (net zero) ===
  {
    id: 'mov_seed_1',
    code: 'MOV-2026-0001',
    at: '2026-04-22T09:15:00.000Z',
    kind: 'receive',
    productId: 'prd_1',
    locationId: 'loc_gudang',
    batchId: 'batch_1',
    qtyDelta: 120,
    qtyAfter: 120,
    unitCost: 5000,
    reference: { kind: 'po', id: 'po_1', code: 'PO-2026-001' },
    performedBy: 'Sandi Reyes',
    notes: 'Penerimaan PO'
  },
  {
    id: 'mov_seed_2',
    code: 'MOV-2026-0002',
    at: '2026-05-05T14:22:00.000Z',
    kind: 'sale',
    productId: 'prd_1',
    locationId: 'loc_gudang',
    batchId: 'batch_1',
    qtyDelta: -10,
    qtyAfter: 110,
    unitCost: 5000,
    reference: { kind: 'order', id: 'ord_seed_cancelled', code: 'ORD-2026-001' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-001'
  },
  {
    id: 'mov_seed_3',
    code: 'MOV-2026-0003',
    at: '2026-05-05T16:01:00.000Z',
    kind: 'sale-cancel',
    productId: 'prd_1',
    locationId: 'loc_gudang',
    batchId: 'batch_1',
    qtyDelta: 10,
    qtyAfter: 120,
    unitCost: 5000,
    reference: { kind: 'order', id: 'ord_seed_cancelled', code: 'ORD-2026-001' },
    performedBy: 'Sandi Reyes',
    notes: 'Pembatalan pesanan · ORD-2026-001'
  },

  // === Latte (prd_2, batch_2) — receive only ===
  {
    id: 'mov_seed_4',
    code: 'MOV-2026-0004',
    at: '2026-04-22T09:15:00.000Z',
    kind: 'receive',
    productId: 'prd_2',
    locationId: 'loc_gudang',
    batchId: 'batch_2',
    qtyDelta: 80,
    qtyAfter: 80,
    unitCost: 12000,
    reference: { kind: 'po', id: 'po_1', code: 'PO-2026-001' },
    performedBy: 'Sandi Reyes',
    notes: 'Penerimaan PO'
  },

  // === Logo Mug Brand Blue (prd_4, v_3, batch_6) — consignment + return (6 → 4) ===
  {
    id: 'mov_seed_5',
    code: 'MOV-2026-0005',
    at: '2026-03-01T10:00:00.000Z',
    kind: 'receive',
    productId: 'prd_4',
    variantId: 'v_3',
    locationId: 'loc_gudang',
    batchId: 'batch_6',
    qtyDelta: 6,
    qtyAfter: 6,
    unitCost: 60000,
    reference: { kind: 'po', id: 'po_3', code: 'PO-2026-003' },
    performedBy: 'Sandi Reyes',
    notes: 'Penerimaan konsinyasi'
  },
  {
    id: 'mov_seed_6',
    code: 'MOV-2026-0006',
    at: '2026-04-15T11:30:00.000Z',
    kind: 'return-consignor',
    productId: 'prd_4',
    variantId: 'v_3',
    locationId: 'loc_gudang',
    batchId: 'batch_6',
    qtyDelta: -2,
    qtyAfter: 4,
    unitCost: 60000,
    reference: { kind: 'return', id: 'batch_6', code: 'BATCH-2026-006' },
    performedBy: 'Sandi Reyes',
    notes: 'Retur konsinyasi · BATCH-2026-006 — sample tidak sesuai standar'
  },

  // === Telur Ayam (prd_8, batch_8) — explains 30 → 12 via sale + opname shrinkage ===
  {
    id: 'mov_seed_7',
    code: 'MOV-2026-0007',
    at: '2026-05-08T07:30:00.000Z',
    kind: 'receive',
    productId: 'prd_8',
    locationId: 'loc_gudang',
    batchId: 'batch_8',
    qtyDelta: 30,
    qtyAfter: 30,
    unitCost: 2500,
    reference: { kind: 'po', id: 'po_2', code: 'PO-2026-002' },
    performedBy: 'Sandi Reyes',
    notes: 'Penerimaan PO'
  },
  {
    id: 'mov_seed_8',
    code: 'MOV-2026-0008',
    at: '2026-05-09T08:45:00.000Z',
    kind: 'sale',
    productId: 'prd_8',
    locationId: 'loc_gudang',
    batchId: 'batch_8',
    qtyDelta: -8,
    qtyAfter: 22,
    unitCost: 2500,
    reference: { kind: 'order', id: 'ord_seed_telur_1', code: 'ORD-2026-005' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-005'
  },
  {
    id: 'mov_seed_9',
    code: 'MOV-2026-0009',
    at: '2026-05-10T10:20:00.000Z',
    kind: 'sale',
    productId: 'prd_8',
    locationId: 'loc_gudang',
    batchId: 'batch_8',
    qtyDelta: -5,
    qtyAfter: 17,
    unitCost: 2500,
    reference: { kind: 'order', id: 'ord_seed_telur_2', code: 'ORD-2026-006' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-006'
  },
  {
    id: 'mov_seed_10',
    code: 'MOV-2026-0010',
    at: '2026-05-11T14:00:00.000Z',
    kind: 'adjust-out',
    productId: 'prd_8',
    locationId: 'loc_gudang',
    batchId: 'batch_8',
    qtyDelta: -5,
    qtyAfter: 12,
    unitCost: 2500,
    reference: { kind: 'opname', id: 'opn_seed_1', code: 'OPN-2026-001' },
    reason: 'expired',
    performedBy: 'Sandi Reyes',
    notes: 'Shrinkage dari opname OPN-2026-001 · 5 telur kedaluwarsa hari ini'
  },

  // === Daging Sapi Cincang (prd_9, batch_11) — explains 2000g → 1450g ===
  {
    id: 'mov_seed_11',
    code: 'MOV-2026-0011',
    at: '2026-05-12T07:00:00.000Z',
    kind: 'receive',
    productId: 'prd_9',
    locationId: 'loc_gudang',
    batchId: 'batch_11',
    qtyDelta: 2000,
    qtyAfter: 2000,
    unitCost: 130,
    reference: { kind: 'po', id: 'po_2', code: 'PO-2026-002' },
    performedBy: 'Sandi Reyes',
    notes: 'Penerimaan PO · 2 kg'
  },
  {
    id: 'mov_seed_12',
    code: 'MOV-2026-0012',
    at: '2026-05-13T11:15:00.000Z',
    kind: 'sale',
    productId: 'prd_9',
    locationId: 'loc_gudang',
    batchId: 'batch_11',
    qtyDelta: -150,
    qtyAfter: 1850,
    unitCost: 130,
    reference: { kind: 'order', id: 'ord_seed_daging_1', code: 'ORD-2026-007' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-007 (3 porsi)'
  },
  {
    id: 'mov_seed_13',
    code: 'MOV-2026-0013',
    at: '2026-05-14T09:30:00.000Z',
    kind: 'sale',
    productId: 'prd_9',
    locationId: 'loc_gudang',
    batchId: 'batch_11',
    qtyDelta: -200,
    qtyAfter: 1650,
    unitCost: 130,
    reference: { kind: 'order', id: 'ord_seed_daging_2', code: 'ORD-2026-008' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-008 (4 porsi)'
  },
  {
    id: 'mov_seed_14',
    code: 'MOV-2026-0014',
    at: '2026-05-14T15:45:00.000Z',
    kind: 'adjust-out',
    productId: 'prd_9',
    locationId: 'loc_gudang',
    batchId: 'batch_11',
    qtyDelta: -200,
    qtyAfter: 1450,
    unitCost: 130,
    reference: { kind: 'manual', id: 'inventory' },
    reason: 'damaged',
    performedBy: 'Sandi Reyes',
    notes: 'Freezer sempat mati semalam, 200g rusak terbuang'
  },

  // === Mug White (prd_4 v_1, batch_4) — receive + 4 sales explaining 18 → 12 ===
  {
    id: 'mov_seed_15',
    code: 'MOV-2026-0015',
    at: '2026-03-01T10:00:00.000Z',
    kind: 'receive',
    productId: 'prd_4',
    variantId: 'v_1',
    locationId: 'loc_gudang',
    batchId: 'batch_4',
    qtyDelta: 18,
    qtyAfter: 18,
    unitCost: 50000,
    reference: { kind: 'po', id: 'po_3', code: 'PO-2026-003' },
    performedBy: 'Sandi Reyes',
    notes: 'Penerimaan konsinyasi · White colorway'
  },
  {
    id: 'mov_seed_16',
    code: 'MOV-2026-0016',
    at: '2026-04-25T10:30:00.000Z',
    kind: 'sale',
    productId: 'prd_4',
    variantId: 'v_1',
    locationId: 'loc_gudang',
    batchId: 'batch_4',
    qtyDelta: -2,
    qtyAfter: 16,
    unitCost: 50000,
    reference: { kind: 'order', id: 'ord_seed_2', code: 'ORD-2026-002' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-002'
  },
  {
    id: 'mov_seed_17',
    code: 'MOV-2026-0017',
    at: '2026-05-05T11:00:00.000Z',
    kind: 'sale',
    productId: 'prd_4',
    variantId: 'v_1',
    locationId: 'loc_gudang',
    batchId: 'batch_4',
    qtyDelta: -1,
    qtyAfter: 15,
    unitCost: 50000,
    reference: { kind: 'order', id: 'ord_seed_4', code: 'ORD-2026-004' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-004'
  },
  {
    id: 'mov_seed_18',
    code: 'MOV-2026-0018',
    at: '2026-05-12T12:00:00.000Z',
    kind: 'sale',
    productId: 'prd_4',
    variantId: 'v_1',
    locationId: 'loc_gudang',
    batchId: 'batch_4',
    qtyDelta: -2,
    qtyAfter: 13,
    unitCost: 50000,
    reference: { kind: 'order', id: 'ord_seed_11', code: 'ORD-2026-011' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-011'
  },
  {
    id: 'mov_seed_19',
    code: 'MOV-2026-0019',
    at: '2026-05-15T09:30:00.000Z',
    kind: 'sale',
    productId: 'prd_4',
    variantId: 'v_1',
    locationId: 'loc_gudang',
    batchId: 'batch_4',
    qtyDelta: -1,
    qtyAfter: 12,
    unitCost: 50000,
    reference: { kind: 'order', id: 'ord_seed_14', code: 'ORD-2026-014' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan piutang · ORD-2026-014 (belum dibayar)'
  },

  // === Mug Black (prd_4 v_2, batch_5) — receive + 3 sales explaining 12 → 8 ===
  {
    id: 'mov_seed_20',
    code: 'MOV-2026-0020',
    at: '2026-03-01T10:00:00.000Z',
    kind: 'receive',
    productId: 'prd_4',
    variantId: 'v_2',
    locationId: 'loc_gudang',
    batchId: 'batch_5',
    qtyDelta: 12,
    qtyAfter: 12,
    unitCost: 50000,
    reference: { kind: 'po', id: 'po_3', code: 'PO-2026-003' },
    performedBy: 'Sandi Reyes',
    notes: 'Penerimaan konsinyasi · Black colorway'
  },
  {
    id: 'mov_seed_21',
    code: 'MOV-2026-0021',
    at: '2026-04-28T13:15:00.000Z',
    kind: 'sale',
    productId: 'prd_4',
    variantId: 'v_2',
    locationId: 'loc_gudang',
    batchId: 'batch_5',
    qtyDelta: -1,
    qtyAfter: 11,
    unitCost: 50000,
    reference: { kind: 'order', id: 'ord_seed_3', code: 'ORD-2026-003' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-003'
  },
  {
    id: 'mov_seed_22',
    code: 'MOV-2026-0022',
    at: '2026-05-08T15:42:00.000Z',
    kind: 'sale',
    productId: 'prd_4',
    variantId: 'v_2',
    locationId: 'loc_gudang',
    batchId: 'batch_5',
    qtyDelta: -2,
    qtyAfter: 9,
    unitCost: 50000,
    reference: { kind: 'order', id: 'ord_seed_9', code: 'ORD-2026-009' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-009'
  },
  {
    id: 'mov_seed_23',
    code: 'MOV-2026-0023',
    at: '2026-05-14T11:00:00.000Z',
    kind: 'sale',
    productId: 'prd_4',
    variantId: 'v_2',
    locationId: 'loc_gudang',
    batchId: 'batch_5',
    qtyDelta: -1,
    qtyAfter: 8,
    unitCost: 50000,
    reference: { kind: 'order', id: 'ord_seed_12', code: 'ORD-2026-012' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-012'
  },

  // === Mug Brand Blue (prd_4 v_3, batch_6) — 1 sale completing 4 → 3 ===
  {
    id: 'mov_seed_24',
    code: 'MOV-2026-0024',
    at: '2026-05-10T16:20:00.000Z',
    kind: 'sale',
    productId: 'prd_4',
    variantId: 'v_3',
    locationId: 'loc_gudang',
    batchId: 'batch_6',
    qtyDelta: -1,
    qtyAfter: 3,
    unitCost: 60000,
    reference: { kind: 'order', id: 'ord_seed_10', code: 'ORD-2026-010' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan · ORD-2026-010 (edisi premium)'
  },

  // === Credit sale ORD-013 (Espresso + Latte, piutang) ===
  {
    id: 'mov_seed_25',
    code: 'MOV-2026-0025',
    at: '2026-05-13T10:00:00.000Z',
    kind: 'sale',
    productId: 'prd_1',
    locationId: 'loc_gudang',
    batchId: 'batch_1',
    qtyDelta: -4,
    qtyAfter: 116,
    unitCost: 5000,
    reference: { kind: 'order', id: 'ord_seed_13', code: 'ORD-2026-013' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan piutang · ORD-2026-013 (DP 100k, sisa nyusul)'
  },
  {
    id: 'mov_seed_26',
    code: 'MOV-2026-0026',
    at: '2026-05-13T10:00:00.000Z',
    kind: 'sale',
    productId: 'prd_2',
    locationId: 'loc_gudang',
    batchId: 'batch_2',
    qtyDelta: -2,
    qtyAfter: 78,
    unitCost: 12000,
    reference: { kind: 'order', id: 'ord_seed_13', code: 'ORD-2026-013' },
    performedBy: 'Sandi Reyes',
    notes: 'Penjualan piutang · ORD-2026-013 (DP 100k, sisa nyusul)'
  }
];

class StockMovementsStore {
  items = $state<StockMovement[]>([...seed]);
  private nextId = seed.length + 1;
  private nextCodeNum = seed.length + 1;

  private generateCode(at: string): string {
    const year = at.slice(0, 4);
    return `MOV-${year}-${fmtCodeNumber(this.nextCodeNum++)}`;
  }

  log(input: StockMovementInput): StockMovement | undefined {
    if (!settings.value.inventory.auditTrailEnabled) return undefined;
    const at = input.at ?? new Date().toISOString();
    const performedBy = input.performedBy ?? user.current.name ?? 'System';
    const movement: StockMovement = {
      id: `mov_${this.nextId++}`,
      code: this.generateCode(at),
      at,
      kind: input.kind,
      productId: input.productId,
      variantId: input.variantId,
      locationId: input.locationId,
      batchId: input.batchId,
      qtyDelta: input.qtyDelta,
      qtyAfter: input.qtyAfter,
      unitCost: input.unitCost,
      reference: input.reference,
      reason: input.reason,
      imageUrl: input.imageUrl,
      performedBy,
      notes: input.notes
    };
    this.items.push(movement);
    return movement;
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
  'return-consignor': 'Retur konsinyasi'
};

export const movementKindOptions: { value: StockMovementKind; label: string }[] =
  (Object.keys(movementKindLabels) as StockMovementKind[]).map((k) => ({
    value: k,
    label: movementKindLabels[k]
  }));
