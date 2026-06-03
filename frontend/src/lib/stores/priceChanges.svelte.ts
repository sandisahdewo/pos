import type { PricingStrategy } from './products.svelte';
import { user } from './user.svelte';
import { listPriceChanges, createPriceChanges } from '$lib/api/price-changes';

export type PriceChangeSource = 'manual' | 'bulk-adjust' | 'system';

export type PriceChange = {
  id: string;
  code: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  packagingIndex?: number;
  packagingLabel?: string;
  pricelistId: string;
  pricelistName: string;
  tierMinQty?: number;
  oldStrategy: PricingStrategy;
  newStrategy: PricingStrategy;
  oldSale: number;
  newSale: number;
  cost: number;
  source: PriceChangeSource;
  notes: string;
  performedBy: string;
  at: string;
};

export type PriceChangeInput = Omit<PriceChange, 'id' | 'code' | 'at' | 'performedBy'> & {
  performedBy?: string;
  at?: string;
};

function normalizeChange(raw: unknown): PriceChange {
  const r = raw as Partial<PriceChange> & Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    productId: String(r.productId ?? ''),
    productName: (r.productName ?? '') as string,
    variantId: (r.variantId as string | undefined) || undefined,
    variantName: (r.variantName as string | undefined) || undefined,
    packagingIndex:
      r.packagingIndex === null || r.packagingIndex === undefined
        ? undefined
        : Number(r.packagingIndex),
    packagingLabel: (r.packagingLabel as string | undefined) || undefined,
    pricelistId: String(r.pricelistId ?? ''),
    pricelistName: (r.pricelistName ?? '') as string,
    tierMinQty:
      r.tierMinQty === null || r.tierMinQty === undefined ? undefined : Number(r.tierMinQty),
    oldStrategy: (r.oldStrategy ?? { kind: 'fixed', value: 0 }) as PricingStrategy,
    newStrategy: (r.newStrategy ?? { kind: 'fixed', value: 0 }) as PricingStrategy,
    oldSale: Number(r.oldSale ?? 0),
    newSale: Number(r.newSale ?? 0),
    cost: Number(r.cost ?? 0),
    source: (r.source ?? 'manual') as PriceChangeSource,
    notes: (r.notes ?? '') as string,
    performedBy: (r.performedBy ?? '') as string,
    at: String(r.at ?? '')
  };
}

function toPayload(input: PriceChangeInput, performedBy: string, at: string): Record<string, unknown> {
  return {
    productId: input.productId || null,
    productName: input.productName,
    variantId: input.variantId ?? null,
    variantName: input.variantName ?? '',
    packagingIndex: input.packagingIndex ?? null,
    packagingLabel: input.packagingLabel ?? '',
    pricelistId: input.pricelistId || null,
    pricelistName: input.pricelistName,
    tierMinQty: input.tierMinQty ?? null,
    oldStrategy: input.oldStrategy,
    newStrategy: input.newStrategy,
    oldSale: input.oldSale,
    newSale: input.newSale,
    cost: input.cost,
    source: input.source,
    notes: input.notes,
    performedBy,
    at
  };
}

class PriceChangesStore {
  items = $state<PriceChange[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listPriceChanges({ limit: 2000 });
      this.items = list.map(normalizeChange);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: PriceChangeInput): Promise<PriceChange> {
    const at = input.at ?? new Date().toISOString();
    const performedBy = input.performedBy ?? user.current?.name ?? 'System';
    const list = await createPriceChanges([toPayload(input, performedBy, at)]);
    const items = list.map(normalizeChange);
    if (items.length > 0) this.items = [...this.items, ...items];
    return items[0];
  }

  // Bulk-add — single backend call. All rows share timestamp & performedBy
  // unless overridden in their input.
  async addMany(inputs: PriceChangeInput[]): Promise<PriceChange[]> {
    if (inputs.length === 0) return [];
    const defaultAt = new Date().toISOString();
    const defaultBy = user.current?.name ?? 'System';
    const payloads = inputs.map((input) =>
      toPayload(input, input.performedBy ?? defaultBy, input.at ?? defaultAt)
    );
    const list = await createPriceChanges(payloads);
    const items = list.map(normalizeChange);
    this.items = [...this.items, ...items];
    return items;
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
