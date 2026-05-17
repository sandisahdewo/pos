export type PromoKind = 'discount' | 'combo' | 'bogo' | 'member-tier';
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

  // Scope (applies to discount kind primarily)
  productIds?: string[];
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
  'member-tier': 'Diskon member'
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

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

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
  const hasProd = !!(promo.productIds && promo.productIds.length > 0);
  const hasCat = !!(promo.categoryIds && promo.categoryIds.length > 0);
  if (!hasProd && !hasCat) return false;
  if (hasProd && promo.productIds!.includes(productId)) return true;
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
  }
}

// Seed: a mix to demonstrate each kind.
const seed: Promotion[] = [
  {
    id: 'prm_1',
    code: 'PRM-001',
    name: 'Diskon 10% Minuman',
    kind: 'discount',
    level: 'line',
    discountUnit: 'percent',
    discountValue: 10,
    categoryIds: ['cat_1'],
    status: 'active',
    usageCount: 0,
    description: 'Diskon 10% untuk semua minuman.',
    notes: ''
  },
  {
    id: 'prm_2',
    code: 'PRM-002',
    name: 'Combo Latte + Cola',
    kind: 'combo',
    level: 'line',
    comboItems: [
      { productId: 'prd_2', quantity: 1 },
      { productId: 'prd_5', quantity: 1 }
    ],
    comboPrice: 18000,
    status: 'active',
    usageCount: 0,
    description: 'Paket hemat Latte + Cola hanya Rp 18.000 (dari Rp 41.000).',
    notes: ''
  },
  {
    id: 'prm_3',
    code: 'PRM-003',
    name: 'Beli 2 Gratis 1 Croissant',
    kind: 'bogo',
    level: 'line',
    buyQuantity: 2,
    getQuantity: 1,
    bogoProductId: 'prd_3',
    status: 'active',
    usageCount: 0,
    description: 'Beli 2 croissant, dapat 1 croissant gratis.',
    notes: ''
  },
  {
    id: 'prm_4',
    code: 'PRM-004',
    name: 'Diskon Pelanggan VIP',
    kind: 'member-tier',
    level: 'order',
    memberPricelistId: 'pl_wholesale',
    memberPercentOff: 5,
    status: 'active',
    usageCount: 0,
    description: 'Pelanggan dengan daftar harga grosir otomatis dapat 5% off total.',
    notes: ''
  },
  {
    id: 'prm_5',
    code: 'PRM-005',
    name: 'Hari Senin Diskon Rp 5.000',
    kind: 'discount',
    level: 'order',
    discountUnit: 'fixed',
    discountValue: 5000,
    minimumPurchase: 30000,
    daysOfWeek: [1],
    status: 'active',
    usageCount: 0,
    description: 'Setiap hari Senin, diskon Rp 5.000 untuk minimum belanja Rp 30.000.',
    notes: ''
  },
  {
    id: 'prm_6',
    code: 'PRM-006',
    name: 'Beli 1 Box Cola Gratis 1 Pcs',
    kind: 'bogo',
    level: 'line',
    bogoProductId: 'prd_5',
    buyQuantity: 1,
    buyUnitId: 'unit_2',
    buyUnitFactor: 6,
    getQuantity: 1,
    getUnitId: 'unit_1',
    getUnitFactor: 1,
    status: 'active',
    usageCount: 0,
    description: 'Beli 1 box (isi 6) Cola, dapat tambahan 1 pcs Cola gratis.',
    notes: ''
  },
  {
    id: 'prm_7',
    code: 'PRM-007',
    name: 'Diskon 15% Minuman Khusus Member',
    kind: 'discount',
    level: 'line',
    discountUnit: 'percent',
    discountValue: 15,
    categoryIds: ['cat_1'],
    memberPricelistId: 'pl_wholesale',
    status: 'active',
    usageCount: 0,
    description: 'Pelanggan dengan daftar harga grosir dapat 15% diskon untuk semua minuman.',
    notes: ''
  }
];

class PromotionsStore {
  items = $state<Promotion[]>([...seed]);
  private nextId = seed.length + 1;
  private nextCodeNum = seed.length + 1;

  add(input: PromotionInput): Promotion {
    const promo: Promotion = {
      ...input,
      id: `prm_${this.nextId++}`,
      code: `PRM-${pad3(this.nextCodeNum++)}`,
      usageCount: 0
    };
    this.items.push(promo);
    return promo;
  }

  update(id: string, patch: Partial<PromotionInput>): Promotion | undefined {
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string): void {
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

  incrementUsage(id: string): void {
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) return;
    this.items[idx] = {
      ...this.items[idx],
      usageCount: this.items[idx].usageCount + 1
    };
  }
}

export const promotions = new PromotionsStore();
