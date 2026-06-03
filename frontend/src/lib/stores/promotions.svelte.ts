import {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  incrementPromotionUsage
} from '$lib/api/promotions';

export type PromoKind = 'discount' | 'combo' | 'bogo' | 'member-tier' | 'expiring-batch';
export type PromoStatus = 'active' | 'scheduled' | 'expired' | 'archived';
export type PromoLevel = 'line' | 'order';
export type DiscountUnit = 'percent' | 'fixed';

export type ComboItem = {
  productId: string;
  variantId?: string;
  unitId?: string;       // when set: strict unit match; when unset: any unit, qty in base
  unitFactor?: number;   // base units per unitId (default 1)
  quantity: number;      // in unitId (or base if unitId unset)
};

// Per-product scope entry — each scoped product can carry its own variant
// and/or unit constraint. Empty variantId/unitId = any.
export type ProductScope = {
  productId: string;
  variantId?: string;
  unitId?: string;
  unitFactor?: number;
};

export type Promotion = {
  id: string;
  code: string;
  name: string;
  kind: PromoKind;
  level: PromoLevel;

  // 'discount' fields
  discountUnit?: DiscountUnit;
  discountValue?: number;

  // 'combo' fields
  comboItems?: ComboItem[];
  comboPrice?: number;

  // 'bogo' fields — beli buyQuantity dapat getQuantity gratis. Buy-side and
  // get-side can be in different units (e.g., buy 1 box, get 1 pcs).
  buyQuantity?: number;
  getQuantity?: number;
  bogoProductId?: string;
  bogoVariantId?: string;
  buyUnitId?: string;       // when set: buy line must be in this unit
  buyUnitFactor?: number;   // base units per buyUnit (default 1)
  getUnitId?: string;       // when set: free units measured in this unit
  getUnitFactor?: number;   // base units per getUnit (default 1)

  // 'member-tier' fields
  memberPricelistId?: string;
  memberPercentOff?: number;

  // 'expiring-batch' fields — discount applies to units coming from batches
  // whose expiresAt is within `daysToExpiryThreshold` of today.
  daysToExpiryThreshold?: number;
  expiryDiscountUnit?: DiscountUnit;
  expiryDiscountValue?: number;

  // Scope. productScopes can carry per-product variant + unit constraints;
  // a line matches if it's in ANY productScope OR ANY categoryIds entry.
  productScopes?: ProductScope[];
  categoryIds?: string[];
  minimumPurchase?: number;

  // Activation window
  startDate?: string;
  endDate?: string;
  daysOfWeek?: number[];
  hourStart?: string;
  hourEnd?: string;

  // Tracking
  status: PromoStatus;
  usageCount: number;
  usageLimit?: number;

  description: string;
  notes: string;
};

export type PromotionInput = Omit<Promotion, 'id' | 'code' | 'usageCount'>;

export const promoKindLabels: Record<PromoKind, string> = {
  discount: 'Diskon',
  combo: 'Paket combo',
  bogo: 'Beli N gratis M',
  'member-tier': 'Diskon member',
  'expiring-batch': 'Diskon mau expired'
};

export const promoStatusLabels: Record<PromoStatus, string> = {
  active: 'Aktif',
  scheduled: 'Terjadwal',
  expired: 'Berakhir',
  archived: 'Diarsipkan'
};

export const promoStatusVariant: Record<
  PromoStatus,
  'success' | 'info' | 'neutral' | 'warning'
> = {
  active: 'success',
  scheduled: 'info',
  expired: 'neutral',
  archived: 'warning'
};

export const promoLevelLabels: Record<PromoLevel, string> = {
  line: 'Per-baris',
  order: 'Per-transaksi'
};

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Returns true when the promo's date / day-of-week / time-of-day window
// includes `at`. Status === 'active' is enforced separately.
export function isWithinPromoWindow(p: Promotion, at: Date): boolean {
  const date = at.toISOString().slice(0, 10);
  if (p.startDate && date < p.startDate) return false;
  if (p.endDate && date > p.endDate) return false;
  if (p.daysOfWeek && p.daysOfWeek.length > 0) {
    if (!p.daysOfWeek.includes(at.getDay())) return false;
  }
  if (p.hourStart || p.hourEnd) {
    const minsNow = at.getHours() * 60 + at.getMinutes();
    if (p.hourStart) {
      const start = timeToMinutes(p.hourStart);
      const end = p.hourEnd ? timeToMinutes(p.hourEnd) : 24 * 60;
      // Handle overnight wrap (e.g. 22:00 → 02:00).
      if (start <= end) {
        if (minsNow < start || minsNow > end) return false;
      } else {
        if (minsNow < start && minsNow > end) return false;
      }
    }
  }
  return true;
}

export function isPromoUsable(p: Promotion, at: Date): boolean {
  if (p.status !== 'active') return false;
  if (p.usageLimit !== undefined && p.usageCount >= p.usageLimit) return false;
  return isWithinPromoWindow(p, at);
}

// Does this promo specifically target the given product? Returns false for
// "applies to all products" promos and for order-level kinds (member-tier),
// which the POS card UI surfaces only at checkout.
export function promoTargetsProduct(
  promo: Promotion,
  productId: string,
  productCategoryId: string | undefined
): boolean {
  switch (promo.kind) {
    case 'combo':
      return (promo.comboItems ?? []).some((c) => c.productId === productId);
    case 'bogo': {
      if (promo.bogoProductId) return promo.bogoProductId === productId;
      // Fall through: bogo without bogoProductId only "targets" via scope.
      return scopeIncludes(promo, productId, productCategoryId);
    }
    case 'discount':
    case 'expiring-batch':
      return scopeIncludes(promo, productId, productCategoryId);
    case 'member-tier':
    default:
      return false;
  }
}

function scopeIncludes(
  promo: Promotion,
  productId: string,
  productCategoryId: string | undefined
): boolean {
  const hasProd = !!(promo.productScopes && promo.productScopes.length > 0);
  const hasCat = !!(promo.categoryIds && promo.categoryIds.length > 0);
  if (!hasProd && !hasCat) return false;
  if (hasProd && promo.productScopes!.some((s) => s.productId === productId)) return true;
  if (hasCat && productCategoryId && promo.categoryIds!.includes(productCategoryId)) return true;
  return false;
}

// Short label for a promo, suitable for a small card badge.
export function shortPromoLabel(p: Promotion): string {
  switch (p.kind) {
    case 'discount':
      if (p.discountUnit === 'percent') return `${p.discountValue ?? 0}%`;
      if (p.discountUnit === 'fixed') {
        const v = p.discountValue ?? 0;
        if (v >= 1000) return `−${Math.round(v / 1000)}k`;
        return `−${v}`;
      }
      return 'Promo';
    case 'combo':
      return 'Combo';
    case 'bogo':
      return `${p.buyQuantity ?? 1}+${p.getQuantity ?? 1}`;
    case 'member-tier':
      return `${p.memberPercentOff ?? 0}%`;
    case 'expiring-batch':
      if (p.expiryDiscountUnit === 'percent') return `Exp −${p.expiryDiscountValue ?? 0}%`;
      if (p.expiryDiscountUnit === 'fixed') {
        const v = p.expiryDiscountValue ?? 0;
        if (v >= 1000) return `Exp −${Math.round(v / 1000)}k`;
        return `Exp −${v}`;
      }
      return 'Mau exp';
  }
}

function numOpt(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizePromotion(raw: unknown): Promotion {
  const r = raw as Partial<Promotion> & Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    name: String(r.name ?? ''),
    kind: (r.kind ?? 'discount') as PromoKind,
    level: (r.level ?? 'line') as PromoLevel,
    discountUnit: r.discountUnit as DiscountUnit | undefined,
    discountValue: numOpt(r.discountValue),
    comboItems: ((r.comboItems as ComboItem[] | undefined) ?? []).map((c) => ({
      productId: c.productId,
      variantId: c.variantId ?? undefined,
      unitId: c.unitId ?? undefined,
      unitFactor: c.unitFactor ?? undefined,
      quantity: Number(c.quantity ?? 0)
    })),
    comboPrice: numOpt(r.comboPrice),
    buyQuantity: numOpt(r.buyQuantity),
    getQuantity: numOpt(r.getQuantity),
    bogoProductId: (r.bogoProductId as string | undefined) || undefined,
    bogoVariantId: (r.bogoVariantId as string | undefined) || undefined,
    buyUnitId: (r.buyUnitId as string | undefined) || undefined,
    buyUnitFactor: numOpt(r.buyUnitFactor),
    getUnitId: (r.getUnitId as string | undefined) || undefined,
    getUnitFactor: numOpt(r.getUnitFactor),
    memberPricelistId: (r.memberPricelistId as string | undefined) || undefined,
    memberPercentOff: numOpt(r.memberPercentOff),
    daysToExpiryThreshold: numOpt(r.daysToExpiryThreshold),
    expiryDiscountUnit: r.expiryDiscountUnit as DiscountUnit | undefined,
    expiryDiscountValue: numOpt(r.expiryDiscountValue),
    productScopes: ((r.productScopes as ProductScope[] | undefined) ?? []).map((s) => ({
      productId: s.productId,
      variantId: s.variantId ?? undefined,
      unitId: s.unitId ?? undefined,
      unitFactor: s.unitFactor ?? undefined
    })),
    categoryIds: (r.categoryIds as string[] | undefined) ?? [],
    minimumPurchase: numOpt(r.minimumPurchase),
    startDate: (r.startDate as string | undefined) || undefined,
    endDate: (r.endDate as string | undefined) || undefined,
    daysOfWeek: (r.daysOfWeek as number[] | undefined) ?? [],
    hourStart: (r.hourStart as string | undefined) || undefined,
    hourEnd: (r.hourEnd as string | undefined) || undefined,
    status: (r.status ?? 'active') as PromoStatus,
    usageCount: Number(r.usageCount ?? 0),
    usageLimit: numOpt(r.usageLimit),
    description: (r.description ?? '') as string,
    notes: (r.notes ?? '') as string
  };
}

function toPromoPayload(input: PromotionInput): Record<string, unknown> {
  return {
    name: input.name,
    kind: input.kind,
    level: input.level,
    status: input.status,
    usageLimit: input.usageLimit ?? null,
    discountUnit: input.discountUnit ?? null,
    discountValue: input.discountValue ?? null,
    comboPrice: input.comboPrice ?? null,
    buyQuantity: input.buyQuantity ?? null,
    getQuantity: input.getQuantity ?? null,
    bogoProductId: input.bogoProductId ?? null,
    bogoVariantId: input.bogoVariantId ?? null,
    buyUnitId: input.buyUnitId ?? null,
    buyUnitFactor: input.buyUnitFactor ?? null,
    getUnitId: input.getUnitId ?? null,
    getUnitFactor: input.getUnitFactor ?? null,
    memberPricelistId: input.memberPricelistId ?? null,
    memberPercentOff: input.memberPercentOff ?? null,
    daysToExpiryThreshold: input.daysToExpiryThreshold ?? null,
    expiryDiscountUnit: input.expiryDiscountUnit ?? null,
    expiryDiscountValue: input.expiryDiscountValue ?? null,
    minimumPurchase: input.minimumPurchase ?? null,
    startDate: input.startDate ?? '',
    endDate: input.endDate ?? '',
    daysOfWeek: input.daysOfWeek ?? [],
    hourStart: input.hourStart ?? '',
    hourEnd: input.hourEnd ?? '',
    description: input.description ?? '',
    notes: input.notes ?? '',
    comboItems: (input.comboItems ?? []).map((c) => ({
      productId: c.productId,
      variantId: c.variantId ?? null,
      unitId: c.unitId ?? null,
      unitFactor: c.unitFactor ?? null,
      quantity: c.quantity
    })),
    productScopes: (input.productScopes ?? []).map((s) => ({
      productId: s.productId,
      variantId: s.variantId ?? null,
      unitId: s.unitId ?? null,
      unitFactor: s.unitFactor ?? null
    })),
    categoryIds: input.categoryIds ?? []
  };
}

class PromotionsStore {
  items = $state<Promotion[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listPromotions();
      this.items = list.map(normalizePromotion);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: PromotionInput): Promise<Promotion> {
    const created = await createPromotion(toPromoPayload(input));
    const promo = normalizePromotion(created);
    this.items = [...this.items, promo];
    return promo;
  }

  async update(id: string, patch: PromotionInput): Promise<Promotion | undefined> {
    const updated = await updatePromotion(id, toPromoPayload(patch));
    const promo = normalizePromotion(updated);
    this.items = this.items.map((p) => (p.id === id ? promo : p));
    return promo;
  }

  async remove(id: string): Promise<void> {
    await deletePromotion(id);
    this.items = this.items.filter((p) => p.id !== id);
  }

  getById(id: string): Promotion | undefined {
    return this.items.find((p) => p.id === id);
  }

  active(): Promotion[] {
    return this.items.filter((p) => p.status === 'active');
  }

  usableAt(at: Date): Promotion[] {
    return this.items.filter((p) => isPromoUsable(p, at));
  }

  async incrementUsage(id: string): Promise<void> {
    try {
      await incrementPromotionUsage(id);
    } catch {
      // Best-effort — POS UX must not block on this.
    }
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) return;
    this.items[idx] = {
      ...this.items[idx],
      usageCount: this.items[idx].usageCount + 1
    };
  }
}

export const promotions = new PromotionsStore();
