import { batches, currentCost, stockByLocation, stockOf } from './batches.svelte';
import { products } from './products.svelte';
import { user } from './user.svelte';
import {
  listStockOpnames,
  createStockOpname,
  updateStockOpname
} from '$lib/api/stock-opnames';

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

function normalizeOpname(raw: unknown): StockOpname {
  const r = raw as Partial<StockOpname> & Record<string, unknown>;
  const lines = ((r.lines as OpnameLine[] | undefined) ?? []).map((l) => ({
    id: String(l.id ?? ''),
    productId: String(l.productId ?? ''),
    variantId: (l.variantId as string | undefined) || undefined,
    expectedQty: Number(l.expectedQty ?? 0),
    countedQty: l.countedQty === null || l.countedQty === undefined ? null : Number(l.countedQty),
    unitCost: Number(l.unitCost ?? 0),
    notes: (l.notes ?? '') as string
  }));
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    locationId: (r.locationId as string | undefined) || undefined,
    startedAt: String(r.startedAt ?? ''),
    completedAt: (r.completedAt as string | undefined) || undefined,
    status: (r.status ?? 'draft') as OpnameStatus,
    lines,
    performedBy: (r.performedBy ?? '') as string,
    notes: (r.notes ?? '') as string
  };
}

function linesToPayload(lines: OpnameLine[]): Array<Record<string, unknown>> {
  return lines.map((l) => ({
    id: l.id,
    productId: l.productId,
    variantId: l.variantId ?? null,
    expectedQty: l.expectedQty,
    countedQty: l.countedQty,
    unitCost: l.unitCost,
    notes: l.notes
  }));
}

class StockOpnamesStore {
  items = $state<StockOpname[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listStockOpnames();
      this.items = list.map(normalizeOpname);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  // Build a draft opname (server-persisted). Snapshots expectedQty + unitCost
  // per line. Composite products excluded — no batches to count.
  async buildDraft(args: {
    locationId?: string;
    categoryIds?: string[];
    productIds?: string[];
    notes?: string;
  }): Promise<StockOpname> {
    const pickedSet = args.productIds ? new Set(args.productIds) : null;
    const catSet = args.categoryIds && args.categoryIds.length > 0 ? new Set(args.categoryIds) : null;

    const candidates = products.items.filter((p) => {
      if (p.status !== 'active') return false;
      if (p.kind === 'composite') return false;
      if (pickedSet) return pickedSet.has(p.id);
      if (catSet) return catSet.has(p.categoryId);
      return true;
    });

    const lines: Array<Omit<OpnameLine, 'id'>> = [];
    for (const p of candidates) {
      const variantList = p.variants.length > 0 ? p.variants : [undefined];
      for (const v of variantList) {
        const variantId = v?.id;
        const expectedQty = args.locationId
          ? stockByLocation(p.id, variantId).get(args.locationId) ?? 0
          : stockOf(p.id, variantId);
        if (!pickedSet && expectedQty <= 0) continue;
        const unitCost = currentCost(p.id, variantId);
        lines.push({
          productId: p.id,
          variantId,
          expectedQty,
          countedQty: null,
          unitCost,
          notes: ''
        });
      }
    }

    const created = await createStockOpname({
      locationId: args.locationId ?? null,
      performedBy: user.current?.name ?? 'System',
      status: 'draft',
      notes: args.notes ?? '',
      lines: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId ?? null,
        expectedQty: l.expectedQty,
        countedQty: l.countedQty,
        unitCost: l.unitCost,
        notes: l.notes
      }))
    });
    const opname = normalizeOpname(created);
    this.items = [...this.items, opname];
    return opname;
  }

  async updateLine(
    opnameId: string,
    lineId: string,
    patch: Partial<OpnameLine>
  ): Promise<void> {
    const opname = this.getById(opnameId);
    if (!opname) return;
    const nextLines = opname.lines.map((l) =>
      l.id === lineId ? { ...l, ...patch } : l
    );
    const updated = await updateStockOpname(opnameId, {
      lines: linesToPayload(nextLines)
    });
    const o = normalizeOpname(updated);
    this.items = this.items.map((x) => (x.id === opnameId ? o : x));
  }

  getById(id: string): StockOpname | undefined {
    return this.items.find((o) => o.id === id);
  }

  // Reconcile variances: per line with countedQty set + variance != 0, call
  // batches.adjustStock with an opname reference. Resulting movement rows
  // reference this opname.
  async complete(
    id: string,
    opts?: { skipUncounted?: boolean }
  ): Promise<{ ok: boolean; reason?: string; adjusted: number; skipped: number }> {
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
      await batches.adjustStock({
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

    const updated = await updateStockOpname(id, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    const o = normalizeOpname(updated);
    this.items = this.items.map((x) => (x.id === id ? o : x));

    return { ok: true, adjusted, skipped };
  }

  async cancel(id: string): Promise<{ ok: boolean; reason?: string }> {
    const opname = this.getById(id);
    if (!opname) return { ok: false, reason: 'Opname tidak ditemukan.' };
    if (opname.status !== 'draft')
      return { ok: false, reason: 'Hanya draft yang bisa dibatalkan.' };
    const updated = await updateStockOpname(id, {
      status: 'cancelled',
      completedAt: new Date().toISOString()
    });
    const o = normalizeOpname(updated);
    this.items = this.items.map((x) => (x.id === id ? o : x));
    return { ok: true };
  }
}

export const stockOpnames = new StockOpnamesStore();

export const opnameStatusLabels: Record<OpnameStatus, string> = {
  draft: 'Draft',
  completed: 'Selesai',
  cancelled: 'Dibatalkan'
};
