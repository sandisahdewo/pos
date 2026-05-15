import { batches, currentCost, stockByLocation, stockOf } from './batches.svelte';
import { products } from './products.svelte';
import { user } from './user.svelte';

export type OpnameStatus = 'draft' | 'completed' | 'cancelled';

export type OpnameLine = {
  id: string;
  productId: string;
  variantId?: string;
  expectedQty: number;
  countedQty: number | null;
  unitCost: number;
  notes: string;
};

export type StockOpname = {
  id: string;
  code: string;
  locationId?: string;
  startedAt: string;
  completedAt?: string;
  status: OpnameStatus;
  lines: OpnameLine[];
  performedBy: string;
  notes: string;
};

function fmtCodeNumber(n: number): string {
  return n.toString().padStart(3, '0');
}

export function lineVariance(line: OpnameLine): number {
  if (line.countedQty === null) return 0;
  return line.countedQty - line.expectedQty;
}

export function lineVarianceValue(line: OpnameLine): number {
  return lineVariance(line) * line.unitCost;
}

export type OpnameTotals = {
  totalExpected: number;
  totalCounted: number;
  totalVariance: number;
  totalShrinkageValue: number;   // |negative variance| × unitCost, summed
  totalSurplusValue: number;     // positive variance × unitCost, summed
  countedLines: number;
  uncountedLines: number;
};

export function opnameTotals(opname: StockOpname): OpnameTotals {
  let totalExpected = 0;
  let totalCounted = 0;
  let totalVariance = 0;
  let totalShrinkageValue = 0;
  let totalSurplusValue = 0;
  let countedLines = 0;
  let uncountedLines = 0;
  for (const l of opname.lines) {
    totalExpected += l.expectedQty;
    if (l.countedQty === null) {
      uncountedLines++;
      continue;
    }
    countedLines++;
    totalCounted += l.countedQty;
    const v = l.countedQty - l.expectedQty;
    totalVariance += v;
    if (v < 0) totalShrinkageValue += -v * l.unitCost;
    if (v > 0) totalSurplusValue += v * l.unitCost;
  }
  return {
    totalExpected,
    totalCounted,
    totalVariance,
    totalShrinkageValue,
    totalSurplusValue,
    countedLines,
    uncountedLines
  };
}

// Seed opname history. Mostly zero-variance counts at Gudang plus one with a
// real shrinkage on Telur (linked from mov_seed_10 in stockMovements seed).
// Demonstrates the full lifecycle: completed (with and without variance), draft,
// and cancelled. Dates run 2026-05-06 → 2026-05-15.
const seedOpnames: StockOpname[] = [
  // 1. Variance opname (Telur shrinkage) — reconciled by mov_seed_10 in movements ledger
  {
    id: 'opn_seed_1',
    code: 'OPN-2026-001',
    locationId: 'loc_gudang',
    startedAt: '2026-05-11T12:00:00.000Z',
    completedAt: '2026-05-11T14:00:00.000Z',
    status: 'completed',
    performedBy: 'Sandi Reyes',
    notes: 'Audit harian bahan segar — kedapatan beberapa telur sudah pecah.',
    lines: [
      {
        id: 'opl_seed_1_1',
        productId: 'prd_8',
        expectedQty: 17,
        countedQty: 12,
        unitCost: 2500,
        notes: 'Cangkang retak/pecah, dibuang.'
      },
      {
        id: 'opl_seed_1_2',
        productId: 'prd_9',
        expectedQty: 1850,
        countedQty: 1850,
        unitCost: 130,
        notes: ''
      }
    ]
  },

  // 2. Completed zero-variance (minuman)
  {
    id: 'opn_seed_2',
    code: 'OPN-2026-002',
    locationId: 'loc_gudang',
    startedAt: '2026-05-10T08:00:00.000Z',
    completedAt: '2026-05-10T08:35:00.000Z',
    status: 'completed',
    performedBy: 'Sandi Reyes',
    notes: 'Cek stok minuman pagi.',
    lines: [
      {
        id: 'opl_seed_2_1',
        productId: 'prd_1',
        expectedQty: 120,
        countedQty: 120,
        unitCost: 5000,
        notes: ''
      },
      {
        id: 'opl_seed_2_2',
        productId: 'prd_2',
        expectedQty: 80,
        countedQty: 80,
        unitCost: 12000,
        notes: ''
      }
    ]
  },

  // 3. Completed zero-variance (croissant)
  {
    id: 'opn_seed_3',
    code: 'OPN-2026-003',
    locationId: 'loc_gudang',
    startedAt: '2026-05-12T07:30:00.000Z',
    completedAt: '2026-05-12T07:48:00.000Z',
    status: 'completed',
    performedBy: 'Sandi Reyes',
    notes: 'Cek roti baked-fresh sebelum buka.',
    lines: [
      {
        id: 'opl_seed_3_1',
        productId: 'prd_3',
        expectedQty: 24,
        countedQty: 24,
        unitCost: 8000,
        notes: ''
      }
    ]
  },

  // 4. Completed zero-variance (mug variants, consignment)
  {
    id: 'opn_seed_4',
    code: 'OPN-2026-004',
    locationId: 'loc_gudang',
    startedAt: '2026-05-13T15:00:00.000Z',
    completedAt: '2026-05-13T15:30:00.000Z',
    status: 'completed',
    performedBy: 'Sandi Reyes',
    notes: 'Audit konsinyasi merchandise (akan dilaporkan ke Studio Karya Lokal).',
    lines: [
      {
        id: 'opl_seed_4_1',
        productId: 'prd_4',
        variantId: 'v_1',
        expectedQty: 13,
        countedQty: 13,
        unitCost: 50000,
        notes: '5 unit terjual sebelum opname.'
      },
      {
        id: 'opl_seed_4_2',
        productId: 'prd_4',
        variantId: 'v_2',
        expectedQty: 9,
        countedQty: 9,
        unitCost: 50000,
        notes: '3 unit terjual sebelum opname.'
      },
      {
        id: 'opl_seed_4_3',
        productId: 'prd_4',
        variantId: 'v_3',
        expectedQty: 3,
        countedQty: 3,
        unitCost: 60000,
        notes: '2 unit dikembalikan, 1 unit terjual.'
      }
    ]
  },

  // 5. Completed zero-variance (perlengkapan)
  {
    id: 'opn_seed_5',
    code: 'OPN-2026-005',
    locationId: 'loc_gudang',
    startedAt: '2026-05-09T16:00:00.000Z',
    completedAt: '2026-05-09T16:12:00.000Z',
    status: 'completed',
    performedBy: 'Sandi Reyes',
    notes: 'Stok perlengkapan sebelum tutup.',
    lines: [
      {
        id: 'opl_seed_5_1',
        productId: 'prd_5',
        expectedQty: 360,
        countedQty: 360,
        unitCost: 3500,
        notes: ''
      }
    ]
  },

  // 6. Draft (in-progress) opname — admin started counting today
  {
    id: 'opn_seed_6',
    code: 'OPN-2026-006',
    locationId: 'loc_gudang',
    startedAt: '2026-05-15T09:00:00.000Z',
    status: 'draft',
    performedBy: 'Sandi Reyes',
    notes: 'Audit mingguan Gudang.',
    lines: [
      {
        id: 'opl_seed_6_1',
        productId: 'prd_1',
        expectedQty: 120,
        countedQty: 120,
        unitCost: 5000,
        notes: 'Sudah dihitung pagi tadi.'
      },
      {
        id: 'opl_seed_6_2',
        productId: 'prd_2',
        expectedQty: 80,
        countedQty: null,
        unitCost: 12000,
        notes: ''
      },
      {
        id: 'opl_seed_6_3',
        productId: 'prd_8',
        expectedQty: 62,
        countedQty: null,
        unitCost: 2500,
        notes: ''
      }
    ]
  },

  // 7. Completed zero-variance — earlier (week before)
  {
    id: 'opn_seed_7',
    code: 'OPN-2026-007',
    locationId: 'loc_gudang',
    startedAt: '2026-05-07T08:00:00.000Z',
    completedAt: '2026-05-07T08:22:00.000Z',
    status: 'completed',
    performedBy: 'Sandi Reyes',
    notes: 'Snapshot awal minggu.',
    lines: [
      {
        id: 'opl_seed_7_1',
        productId: 'prd_1',
        expectedQty: 120,
        countedQty: 120,
        unitCost: 5000,
        notes: ''
      },
      {
        id: 'opl_seed_7_2',
        productId: 'prd_3',
        expectedQty: 24,
        countedQty: 24,
        unitCost: 8000,
        notes: ''
      },
      {
        id: 'opl_seed_7_3',
        productId: 'prd_5',
        expectedQty: 360,
        countedQty: 360,
        unitCost: 3500,
        notes: ''
      }
    ]
  },

  // 8. Cancelled opname
  {
    id: 'opn_seed_8',
    code: 'OPN-2026-008',
    locationId: 'loc_gudang',
    startedAt: '2026-05-09T13:00:00.000Z',
    completedAt: '2026-05-09T13:05:00.000Z',
    status: 'cancelled',
    performedBy: 'Sandi Reyes',
    notes: 'Dibatalkan — kasir kepanggil tamu, lanjutkan besok.',
    lines: [
      {
        id: 'opl_seed_8_1',
        productId: 'prd_2',
        expectedQty: 80,
        countedQty: null,
        unitCost: 12000,
        notes: ''
      }
    ]
  },

  // 9. Draft (in-progress, started yesterday, still open)
  {
    id: 'opn_seed_9',
    code: 'OPN-2026-009',
    locationId: 'loc_gudang',
    startedAt: '2026-05-14T17:30:00.000Z',
    status: 'draft',
    performedBy: 'Sandi Reyes',
    notes: 'Audit konsinyasi end-of-week — sebagian baru dihitung.',
    lines: [
      {
        id: 'opl_seed_9_1',
        productId: 'prd_4',
        variantId: 'v_1',
        expectedQty: 13,
        countedQty: 13,
        unitCost: 50000,
        notes: ''
      },
      {
        id: 'opl_seed_9_2',
        productId: 'prd_4',
        variantId: 'v_2',
        expectedQty: 8,
        countedQty: null,
        unitCost: 50000,
        notes: ''
      },
      {
        id: 'opl_seed_9_3',
        productId: 'prd_4',
        variantId: 'v_3',
        expectedQty: 3,
        countedQty: null,
        unitCost: 60000,
        notes: ''
      }
    ]
  },

  // 10. Completed zero-variance (earliest, single line)
  {
    id: 'opn_seed_10',
    code: 'OPN-2026-010',
    locationId: 'loc_gudang',
    startedAt: '2026-05-06T07:30:00.000Z',
    completedAt: '2026-05-06T07:40:00.000Z',
    status: 'completed',
    performedBy: 'Sandi Reyes',
    notes: 'Cek stok daging cincang (datang besoknya dari PO-2026-002).',
    lines: [
      {
        id: 'opl_seed_10_1',
        productId: 'prd_9',
        expectedQty: 0,
        countedQty: 0,
        unitCost: 130,
        notes: 'Stok belum datang, masih 0.'
      }
    ]
  }
];

function maxLineSeq(): number {
  let max = 0;
  for (const op of seedOpnames) {
    for (const l of op.lines) {
      const num = parseInt(l.id.replace(/[^0-9]/g, '').slice(-3), 10) || 0;
      if (num > max) max = num;
    }
  }
  return max;
}

class StockOpnamesStore {
  items = $state<StockOpname[]>([...seedOpnames]);
  private nextId = seedOpnames.length + 1;
  private nextCodeNum = seedOpnames.length + 1;
  private lineSeq = maxLineSeq() + 1;

  private generateCode(): string {
    const year = new Date().getFullYear();
    return `OPN-${year}-${fmtCodeNumber(this.nextCodeNum++)}`;
  }

  // Build a draft opname covering the given location and (optionally) narrowed
  // by category or specific product picks. Snapshots expectedQty and unitCost
  // per line. Composite products are excluded — they have no batches to count.
  buildDraft(args: {
    locationId?: string;
    categoryIds?: string[];
    productIds?: string[];      // explicit picks; overrides category filter
    notes?: string;
  }): StockOpname {
    const pickedSet = args.productIds ? new Set(args.productIds) : null;
    const catSet = args.categoryIds && args.categoryIds.length > 0 ? new Set(args.categoryIds) : null;

    const candidates = products.items.filter((p) => {
      if (p.status !== 'active') return false;
      if (p.kind === 'composite') return false; // no batches → nothing to count
      if (pickedSet) return pickedSet.has(p.id);
      if (catSet) return catSet.has(p.categoryId);
      return true;
    });

    const lines: OpnameLine[] = [];
    for (const p of candidates) {
      const variantList = p.variants.length > 0 ? p.variants : [undefined];
      for (const v of variantList) {
        const variantId = v?.id;
        const expectedQty = args.locationId
          ? stockByLocation(p.id, variantId).get(args.locationId) ?? 0
          : stockOf(p.id, variantId);
        // Skip lines with no stock unless explicitly picked
        if (!pickedSet && expectedQty <= 0) continue;
        const unitCost = currentCost(p.id, variantId);
        lines.push({
          id: `opl_${this.lineSeq++}`,
          productId: p.id,
          variantId,
          expectedQty,
          countedQty: null,
          unitCost,
          notes: ''
        });
      }
    }

    const opname: StockOpname = {
      id: `opn_${this.nextId++}`,
      code: this.generateCode(),
      locationId: args.locationId,
      startedAt: new Date().toISOString(),
      status: 'draft',
      lines,
      performedBy: user.current.name ?? 'System',
      notes: args.notes ?? ''
    };
    this.items.push(opname);
    return opname;
  }

  update(id: string, patch: Partial<StockOpname>): StockOpname | undefined {
    const idx = this.items.findIndex((o) => o.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  updateLine(opnameId: string, lineId: string, patch: Partial<OpnameLine>): void {
    const idx = this.items.findIndex((o) => o.id === opnameId);
    if (idx === -1) return;
    const opname = this.items[idx];
    this.items[idx] = {
      ...opname,
      lines: opname.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l))
    };
  }

  getById(id: string): StockOpname | undefined {
    return this.items.find((o) => o.id === id);
  }

  // Reconcile variances: per line with countedQty set and variance != 0, call
  // batches.adjustStock with an opname reference so the resulting adjust-in /
  // adjust-out movement rows are stamped to this opname.
  complete(
    id: string,
    opts?: { skipUncounted?: boolean }
  ): { ok: boolean; reason?: string; adjusted: number; skipped: number } {
    const opname = this.getById(id);
    if (!opname) return { ok: false, reason: 'Opname tidak ditemukan.', adjusted: 0, skipped: 0 };
    if (opname.status !== 'draft')
      return { ok: false, reason: 'Opname sudah selesai atau dibatalkan.', adjusted: 0, skipped: 0 };

    const reference = { kind: 'opname' as const, id: opname.id, code: opname.code };
    let adjusted = 0;
    let skipped = 0;

    for (const line of opname.lines) {
      if (line.countedQty === null) {
        if (opts?.skipUncounted) {
          skipped++;
          continue;
        }
        return {
          ok: false,
          reason: 'Masih ada baris yang belum dihitung. Aktifkan skipUncounted untuk melewatinya.',
          adjusted,
          skipped
        };
      }
      const variance = line.countedQty - line.expectedQty;
      if (variance === 0) continue;
      batches.adjustStock({
        productId: line.productId,
        variantId: line.variantId,
        delta: variance,
        unitCost: line.unitCost,
        locationId: opname.locationId,
        reference,
        notes:
          variance < 0
            ? `Shrinkage dari opname ${opname.code}${line.notes ? ` · ${line.notes}` : ''}`
            : `Surplus dari opname ${opname.code}${line.notes ? ` · ${line.notes}` : ''}`
      });
      adjusted++;
    }

    this.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    return { ok: true, adjusted, skipped };
  }

  cancel(id: string): { ok: boolean; reason?: string } {
    const opname = this.getById(id);
    if (!opname) return { ok: false, reason: 'Opname tidak ditemukan.' };
    if (opname.status !== 'draft')
      return { ok: false, reason: 'Hanya draft yang bisa dibatalkan.' };
    this.update(id, { status: 'cancelled', completedAt: new Date().toISOString() });
    return { ok: true };
  }
}

export const stockOpnames = new StockOpnamesStore();

export const opnameStatusLabels: Record<OpnameStatus, string> = {
  draft: 'Draft',
  completed: 'Selesai',
  cancelled: 'Dibatalkan'
};
