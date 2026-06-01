import { orders } from '$lib/stores/orders.svelte';
import { stockOf } from '$lib/stores/batches.svelte';
import {
  isComposite,
  primarySupplier,
  productLeadDays,
  products,
  producibleStock,
  producibleVariantStock
} from '$lib/stores/products.svelte';
import { suppliers } from '$lib/stores/suppliers.svelte';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Average daily sales rate in BASE units over the trailing `windowDays`.
// Reads orders.items directly (skipping cancelled), multiplies each line's
// quantity by its unitFactor so packaging sales convert to base units.
// Composite products work the same way — their own line counts as "1 combo"
// regardless of how many ingredient units it consumed.
export function dailySalesRate(
  productId: string,
  variantId?: string,
  windowDays: number = 30
): number {
  if (windowDays <= 0) return 0;
  const cutoff = Date.now() - windowDays * MS_PER_DAY;
  let total = 0;
  for (const order of orders.items) {
    if (order.status === 'cancelled') continue;
    const t = new Date(order.createdAt).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    for (const line of order.lines) {
      if (line.productId !== productId) continue;
      if (variantId !== undefined && line.variantId !== variantId) continue;
      total += line.quantity * (line.unitFactor || 1);
    }
  }
  return total / windowDays;
}

// Current stock in base units, using producibleStock for composites and the
// regular stockOf path for goods.
export function currentStockFor(productId: string, variantId?: string): number {
  const p = products.getById(productId);
  if (!p) return 0;
  if (p.kind === 'composite') {
    if (variantId) {
      const v = p.variants.find((vv) => vv.id === variantId);
      return v ? producibleVariantStock(productId, v) : 0;
    }
    return producibleStock(p);
  }
  return stockOf(productId, variantId);
}

// Days of supply: current stock divided by daily rate. Returns Infinity when
// there are no sales in the window (so we can render "Tidak ada penjualan").
export function daysOfSupply(
  productId: string,
  variantId?: string,
  windowDays: number = 30
): number {
  const rate = dailySalesRate(productId, variantId, windowDays);
  if (rate <= 0) return Infinity;
  return currentStockFor(productId, variantId) / rate;
}

// Suggested reorder qty in base units. Formula: dailyRate × (leadTime + buffer).
// Falls back to a 7-day default buffer. Returns 0 when there are no sales.
export function suggestedReorderQty(args: {
  productId: string;
  variantId?: string;
  windowDays?: number;
  leadDays?: number;
  bufferDays?: number;
}): number {
  const rate = dailySalesRate(args.productId, args.variantId, args.windowDays ?? 30);
  if (rate <= 0) return 0;
  const lead = Math.max(0, args.leadDays ?? 7);
  const buffer = Math.max(0, args.bufferDays ?? 7);
  return Math.ceil(rate * (lead + buffer));
}

export type RunwayBand = 'critical' | 'low' | 'watch' | 'ok' | 'inactive';

export const runwayBandLabels: Record<RunwayBand, string> = {
  critical: 'Kritis',
  low: 'Menipis',
  watch: 'Perhatikan',
  ok: 'Aman',
  inactive: 'Tidak ada penjualan'
};

export const runwayBandVariant: Record<
  RunwayBand,
  'danger' | 'warning' | 'info' | 'success' | 'neutral'
> = {
  critical: 'danger',
  low: 'warning',
  watch: 'info',
  ok: 'success',
  inactive: 'neutral'
};

export function runwayBandFor(days: number): RunwayBand {
  if (!Number.isFinite(days)) return 'inactive';
  if (days < 0) return 'critical';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'low';
  if (days <= 14) return 'watch';
  return 'ok';
}

export function formatRunway(days: number): string {
  if (!Number.isFinite(days)) return 'Tidak ada penjualan';
  if (days < 0) return 'Sudah habis';
  if (days < 1) return '<1 hari';
  if (days < 10) return `${days.toFixed(1)} hari`;
  return `${Math.round(days)} hari`;
}

// Resolve the lead-time for a product. When supplierId is given, uses that
// supplier's per-product override (or its global leadTimeDays). When omitted,
// uses the product's primary supplier. Returns 0 when no supplier is set.
export function leadDaysFor(productId: string, supplierId?: string): number {
  const p = products.getById(productId);
  if (!p) return 0;
  return productLeadDays(p, supplierId);
}

// Iterate every (product, variant?) pair that has BATCHES backing it (i.e.,
// goods + variants) plus composites which derive from components. Useful for
// the /forecast page to populate rows.
export type ForecastSubject = {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  unitId: string;
  kind: 'goods' | 'composite';
  categoryId: string;
  defaultSupplierId?: string;     // primary supplier id (for back-compat + filtering)
};

export function forecastSubjects(): ForecastSubject[] {
  const out: ForecastSubject[] = [];
  for (const p of products.items) {
    if (p.status !== 'active') continue;
    const ps = primarySupplier(p);
    const base: Omit<ForecastSubject, 'variantId' | 'variantName'> = {
      productId: p.id,
      productName: p.name,
      unitId: p.unitId,
      kind: p.kind,
      categoryId: p.categoryId,
      defaultSupplierId: ps?.supplierId
    };
    if (p.variants.length === 0) {
      out.push({ ...base });
      continue;
    }
    for (const v of p.variants) {
      out.push({ ...base, variantId: v.id, variantName: v.name });
    }
  }
  return out;
}

// Whether the composite has its sales tracked at the composite-product line
// level (yes — applyOrderToStock records line.productId regardless of kind).
// Helper kept for clarity; not currently used externally.
export function isCompositeLine(productId: string): boolean {
  return isComposite(products.getById(productId) ?? ({} as never));
}
