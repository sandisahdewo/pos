import type { PricingStrategy } from './products.svelte';
import { user } from './user.svelte';

// Source attribution for a single price-change record.
//   'manual'      — direct save from the product form (operator typed values).
//   'bulk-adjust' — applied via the Sesuaikan harga modal; carries a human
//                   summary in `notes` describing the adjustment params.
//   'system'      — reserved for future auto-changes (none today).
export type PriceChangeSource = 'manual' | 'bulk-adjust' | 'system';

// One row per (scope × pricelistId × optional tierMinQty) whose pricing
// strategy actually changed between old and new product state. Snapshotted
// at the moment of save — the strategy objects are stored verbatim so the
// record stays meaningful even if the product is later renamed/deleted.
export type PriceChange = {
  id: string;
  code: string; // PCH-YYYY-NNN
  productId: string;
  productName: string;        // snapshot for surviving renames
  variantId?: string;
  variantName?: string;
  packagingIndex?: number;
  packagingLabel?: string;    // e.g. "Box · isi 6"
  pricelistId: string;
  pricelistName: string;      // snapshot
  tierMinQty?: number;        // present when the change is on a tier
  oldStrategy: PricingStrategy;
  newStrategy: PricingStrategy;
  oldSale: number;            // computeSalePrice(cost, oldStrategy) at change time
  newSale: number;
  cost: number;               // base-unit cost snapshot at change time
  source: PriceChangeSource;
  notes: string;
  performedBy: string;
  at: string;                 // ISO timestamp
};

export type PriceChangeInput = Omit<PriceChange, 'id' | 'code' | 'at' | 'performedBy'> & {
  performedBy?: string;
  at?: string;
};

function fmtCodeNumber(n: number): string {
  return n.toString().padStart(4, '0');
}

class PriceChangesStore {
  items = $state<PriceChange[]>([]);
  private nextId = 1;
  private nextCodeNum = 1;

  private generateCode(at: string): string {
    const year = at.slice(0, 4);
    return `PCH-${year}-${fmtCodeNumber(this.nextCodeNum++)}`;
  }

  add(input: PriceChangeInput): PriceChange {
    const at = input.at ?? new Date().toISOString();
    const performedBy = input.performedBy ?? user.current?.name ?? 'System';
    const change: PriceChange = {
      id: `pch_${this.nextId++}`,
      code: this.generateCode(at),
      at,
      performedBy,
      ...input
    };
    this.items.push(change);
    return change;
  }

  // Bulk-add — used by `products.update()` when a single save produces many
  // changes at once. All rows share the same timestamp & performedBy so the
  // history view can group them visually if it wants.
  addMany(inputs: PriceChangeInput[]): PriceChange[] {
    const at = new Date().toISOString();
    const performedBy = user.current?.name ?? 'System';
    const out: PriceChange[] = [];
    for (const input of inputs) {
      out.push(
        this.add({
          ...input,
          at: input.at ?? at,
          performedBy: input.performedBy ?? performedBy
        })
      );
    }
    return out;
  }

  forProduct(productId: string, variantId?: string): PriceChange[] {
    return this.items
      .filter(
        (c) =>
          c.productId === productId &&
          (variantId === undefined || c.variantId === variantId)
      )
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  recent(limit = 500): PriceChange[] {
    return [...this.items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  countSince(sinceISO: string): number {
    return this.items.reduce((n, c) => (c.at >= sinceISO ? n + 1 : n), 0);
  }

  productsAffectedSince(sinceISO: string): number {
    const set = new Set<string>();
    for (const c of this.items) if (c.at >= sinceISO) set.add(c.productId);
    return set.size;
  }

  // Top operator by change count since a given ISO date.
  topPerformerSince(sinceISO: string): { name: string; count: number } | undefined {
    const tally = new Map<string, number>();
    for (const c of this.items) {
      if (c.at < sinceISO) continue;
      tally.set(c.performedBy, (tally.get(c.performedBy) ?? 0) + 1);
    }
    let best: { name: string; count: number } | undefined;
    for (const [name, count] of tally) {
      if (!best || count > best.count) best = { name, count };
    }
    return best;
  }
}

export const priceChanges = new PriceChangesStore();

export const priceChangeSourceLabels: Record<PriceChangeSource, string> = {
  manual: 'Manual',
  'bulk-adjust': 'Bulk adjust',
  system: 'Sistem'
};

export const priceChangeSourceVariant: Record<
  PriceChangeSource,
  'neutral' | 'brand' | 'info'
> = {
  manual: 'neutral',
  'bulk-adjust': 'brand',
  system: 'info'
};

// Short, human-readable description of the strategy. Used in the history UI
// so the user can read "10%" / "+Rp 5.000" / "Rp 12.500" without parsing
// the underlying object.
export function describePricing(s: PricingStrategy): string {
  switch (s.kind) {
    case 'fixed':
      return formatRp(s.value);
    case 'markup_pct':
      return `${formatNumber(s.value)}%`;
    case 'markup_amount':
      return `+${formatRp(s.value)}`;
  }
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  // Match Indonesian locale digit grouping but keep a max of 2 fractional digits
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
}

function formatRp(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(n);
}
