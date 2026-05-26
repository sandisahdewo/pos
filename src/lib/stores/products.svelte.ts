import { pricelists } from './pricelists.svelte';
import { categories, type Category } from './categories.svelte';
import { taxRates, type TaxRate } from './taxRates.svelte';
import { suppliers, type Supplier } from './suppliers.svelte';
import { batches, stockOf } from './batches.svelte';
import { units as unitsStore } from './units.svelte';
import {
  priceChanges,
  type PriceChangeInput,
  type PriceChangeSource
} from './priceChanges.svelte';

export type ProductStatus = 'active' | 'archived';

export type ProductKind = 'goods' | 'composite';

export const productKindOptions: { value: ProductKind; label: string; description: string }[] = [
  {
    value: 'goods',
    label: 'Barang',
    description: 'Dibeli dari pemasok, dijual apa adanya. Bisa punya pilihan warna/ukuran atau dijual dalam dus.'
  },
  {
    value: 'composite',
    label: 'Resep / Paket',
    description: 'Dibuat atau dirakit dari produk lain. Contoh: mie ayam = mie + ayam + saus, atau paket combo.'
  }
];

// Cost basis that markup-based pricing reads from. Fixed-price strategies
// ignore this — they're absolute. Affects markup_pct + markup_amount only.
//   'manual'       — Product.cost (manual baseline, current behaviour).
//                    Sale price never moves on its own; operator adjusts it.
//   'fifo-current' — unitCost of the OLDEST owned batch with stock left
//                    (the next one FIFO will consume). Sale price snaps to
//                    the next batch's cost when the current one depletes.
//   'batch-avg'    — weighted-avg of all owned batches' unitCost. Sale price
//                    drifts gradually as old/new stock blends.
// All three fall back to Product.cost when no owned batch exists yet.
export type MarkupCostSource = 'manual' | 'fifo-current' | 'batch-avg';

export const markupCostSourceOptions: {
  value: MarkupCostSource;
  label: string;
  description: string;
}[] = [
  {
    value: 'manual',
    label: 'Biaya beli yang saya isi sendiri',
    description:
      'Sistem pakai angka di kolom "Biaya beli" di atas. Harga jual hanya berubah kalau saya update angka biayanya.'
  },
  {
    value: 'fifo-current',
    label: 'Harga beli stok yang sedang dijual',
    description:
      'Sistem otomatis pakai harga beli stok lama dulu. Saat stok itu habis, harga jual loncat ke harga beli stok berikutnya. Cocok kalau harga pemasok sering naik-turun.'
  },
  {
    value: 'batch-avg',
    label: 'Rata-rata harga beli semua stok',
    description:
      'Sistem hitung rata-rata harga beli dari semua stok yang masih ada. Harga jual bergeser halus saat stok lama bercampur dengan stok baru.'
  }
];

// How a composite reaches the customer:
//   'flexible' — produced ahead when convenient; if no produced batch is available
//     at sale, components are deducted on-the-fly. Suits cafe combos, fried chicken
//     (pre-fry batches that fall back to fresh-make when warmer empties).
//   'strict'   — must be produced before it can be sold. No component fallback.
//     Suits hampers, kotak nasi, kits where "fresh-make at till" is nonsensical.
export type ProductionMode = 'flexible' | 'strict';

export const productionModeOptions: {
  value: ProductionMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'flexible',
    label: 'Fleksibel',
    description:
      'Bisa disiapkan duluan, atau dibuat saat ada pesanan. Kalau stok produksi habis, sistem otomatis hitung dari bahan baku. Cocok untuk gorengan, ayam goreng, menu kafe.'
  },
  {
    value: 'strict',
    label: 'Wajib disiapkan dulu',
    description:
      'Harus dibuat sebelum bisa dijual. Tidak otomatis pakai bahan baku — kalau belum disiapkan, tidak bisa dijual. Cocok untuk hampers, paket gift box, kotak nasi.'
  }
];

export const productionModeLabels: Record<ProductionMode, string> = {
  flexible: 'Fleksibel',
  strict: 'Wajib disiapkan dulu'
};

export type PricingKind = 'fixed' | 'markup_amount' | 'markup_pct';

export type PricingStrategy =
  | { kind: 'fixed'; value: number }
  | { kind: 'markup_amount'; value: number }
  | { kind: 'markup_pct'; value: number };

export type PricingTier = {
  minQty: number;
  pricing: PricingStrategy;
};

export type PricelistEntry = {
  pricelistId: string;
  pricing: PricingStrategy;
  tiers: PricingTier[];
};

export type ProductPackaging = {
  unitId: string;
  factor: number;
  prices: PricelistEntry[];
  barcode: string;
};

export type ProductAttribute = {
  id: string;
  name: string;
  values: string[];
};

export type CompositeComponent = {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  // Optional packaging selector. When operator wants to express the recipe in
  // a non-base unit (e.g., "1 ekor ayam" instead of "8 potong"), pick a
  // packaging of the component product. Stock math, cost math, and
  // consumption all multiply by `unitFactor` to convert back to base.
  // Defaults: unitId = component product's base unit, unitFactor = 1.
  unitId?: string;
  unitFactor?: number;
};

// Resolve the base-unit quantity of a recipe component, honouring the
// optional packaging selector. Used by cost math, producibility checks, and
// consumption flows (deductComponents in orders, production runs, etc.).
export function componentBaseQty(c: CompositeComponent): number {
  return c.quantity * (c.unitFactor ?? 1);
}

export type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  cost: number;
  prices: PricelistEntry[];
  barcode: string;
  values: Record<string, string>;
  imageUrl: string;
  components: CompositeComponent[];
  // When set, overrides the parent composite's productionMode for this variant only.
  productionMode?: ProductionMode;
};

export type ProductExtra = {
  id: string;
  name: string;
  priceDelta: number;
  components: CompositeComponent[];
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  kind: ProductKind;
  categoryId: string;
  unitId: string;
  cost: number;
  prices: PricelistEntry[];
  status: ProductStatus;
  description: string;
  taxRateId?: string;
  brandId?: string;              // optional FK -> brands store
  tags?: string[];                // tag names (match against tags store for color/visibility); default []
  suppliers: ProductSupplier[];   // multi-supplier list; at most one isPrimary
  imageUrl: string;
  // Barcode for the base unit (pcs). For simple products this is the only
  // place to put a UPC/EAN. For products with packagings, this is the can /
  // bottle code; dus / karton get pack.barcode instead. For variant products
  // this is usually empty (variant.barcode is the per-variant code); if set,
  // it acts as a parent GTIN that auto-picks the first variant on scan.
  barcode?: string;
  units: ProductPackaging[];
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  components: CompositeComponent[];
  extras: ProductExtra[];
  requiresBatchLabel?: boolean;   // print a thermal label per received batch (perishables, lot-tracked items)
  requiresExpiration?: boolean;   // capture expiration date on every batch; FIFO walks expiration ASC
  // Regulatory / warranty info — optional, only used for regulated categories
  // (kosmetik, makanan, obat) or durable goods (elektronik).
  bpomNumber?: string;            // nomor izin edar BPOM (mis. "POM NA 18101200123")
  halalCertNumber?: string;       // nomor sertifikat MUI Halal
  warrantyMonths?: number;        // masa garansi dalam bulan (untuk elektronik/perabot)
  // Free-form additional info — operator can put anything here that doesn't fit
  // a structured field. Used as a per-product key-value bag.
  metadata?: Record<string, string>;
  markupCostSource?: MarkupCostSource;  // cost basis for markup_* strategies; default 'manual'
  // Composite-only. Default 'flexible' (the existing behaviour for any seeded
  // composite that omits the field). Variants may override per-variant.
  productionMode?: ProductionMode;
  // Composite-only. When set, the production modal pre-fills `expiresAt` on the
  // produced batch as (now + N hours). Pairs with the expiring-batch promo so
  // warmer-batches that age out get marked down automatically.
  shelfLifeAfterProductionHours?: number;
};

// Per-(product, supplier) sourcing config. A product can have multiple supplier
// rows — one marked primary, others as alternatives. PO creation uses the
// primary by default but admin can pick any in the Buat PO modals.
export type ProductSupplier = {
  supplierId: string;
  isPrimary: boolean;
  unitCost: number;              // this supplier's unit cost (overrides product.cost for PO autofill)
  leadTimeDays?: number;         // override Supplier.leadTimeDays for this product (undefined = use supplier's default)
  supplierSku: string;            // supplier's catalog code / their SKU for this product
  minOrderQty?: number;          // supplier-side MOQ in base units; PO form warns when qty < this
  notes: string;
};

export function isAdvanced(p: Product): boolean {
  return p.units.length > 0 || p.variants.length > 0 || p.attributes.length > 0;
}

export function isComposite(p: Product): boolean {
  return p.components.length > 0;
}

export function taxRateFor(product: Product): TaxRate | undefined {
  if (product.taxRateId) {
    const own = taxRates.getById(product.taxRateId);
    if (own) return own;
  }
  // Walk the category chain from the product's category up to root, returning
  // the first ancestor that has a taxRateId set. Lets a sub-category inherit
  // tax from its parent without having to repeat the field.
  const chain = categories.path(product.categoryId);
  for (let i = chain.length - 1; i >= 0; i--) {
    const cat = chain[i];
    if (cat.taxRateId) {
      const fromCat = taxRates.getById(cat.taxRateId);
      if (fromCat) return fromCat;
    }
  }
  return taxRates.default();
}

export function priceWithTax(price: number, rate: TaxRate | undefined): number {
  if (!rate) return price;
  return price * (1 + rate.rate / 100);
}

// The "primary" supplier entry on this product, or undefined when none set.
// If none flagged primary but at least one supplier row exists, falls back to
// the first row so callers always have something sensible.
export function primarySupplier(p: Product): ProductSupplier | undefined {
  if (!p.suppliers || p.suppliers.length === 0) return undefined;
  return p.suppliers.find((s) => s.isPrimary) ?? p.suppliers[0];
}

// Backward-compatible: same shape as before (returns the Supplier object for
// the primary entry), so existing call sites keep working without changes.
export function defaultSupplier(p: Product): Supplier | undefined {
  const ps = primarySupplier(p);
  if (!ps) return undefined;
  return suppliers.getById(ps.supplierId);
}

// Resolve all active Supplier objects for this product, in order (primary first).
export function suppliersFor(p: Product): Supplier[] {
  const rows = [...(p.suppliers ?? [])].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
  );
  const out: Supplier[] = [];
  for (const ps of rows) {
    const s = suppliers.getById(ps.supplierId);
    if (s) out.push(s);
  }
  return out;
}

// Per-supplier unit cost for this product (falls back to product.cost when the
// product doesn't have a matching supplier row).
export function costFromSupplier(p: Product, supplierId: string): number {
  const ps = (p.suppliers ?? []).find((s) => s.supplierId === supplierId);
  return ps?.unitCost ?? p.cost ?? 0;
}

// Per-(product, supplier) lead-time. Uses the override on the ProductSupplier
// row when set, otherwise falls back to Supplier.leadTimeDays.
export function productLeadDays(p: Product, supplierId?: string): number {
  const target = supplierId
    ? (p.suppliers ?? []).find((s) => s.supplierId === supplierId)
    : primarySupplier(p);
  if (!target) return 0;
  if (typeof target.leadTimeDays === 'number' && target.leadTimeDays >= 0) {
    return target.leadTimeDays;
  }
  return suppliers.getById(target.supplierId)?.leadTimeDays ?? 0;
}

function componentBaseCost(c: CompositeComponent): number {
  const product = products.getById(c.productId);
  if (!product) return 0;
  if (c.variantId) {
    const v = product.variants.find((vv) => vv.id === c.variantId);
    if (v) return effectiveVariantCost(v, product);
  }
  return effectiveCost(product);
}

function componentAvailableStock(c: CompositeComponent): number {
  if (c.variantId) {
    return stockOf(c.productId, c.variantId);
  }
  const product = products.getById(c.productId);
  if (!product) return 0;
  if (product.variants.length > 0) {
    return product.variants.reduce((s, v) => s + stockOf(product.id, v.id), 0);
  }
  return stockOf(c.productId);
}

function componentsCost(comps: CompositeComponent[]): number {
  return comps.reduce((sum, c) => sum + componentBaseQty(c) * componentBaseCost(c), 0);
}

function componentsProducible(comps: CompositeComponent[]): number {
  if (comps.length === 0) return 0;
  if (comps.some((c) => c.quantity <= 0)) return 0;
  return Math.min(
    ...comps.map((c) => Math.floor(componentAvailableStock(c) / componentBaseQty(c)))
  );
}

// Resolve cost from the configured source. All sources fall back to the given
// `manualFallback` when no owned batch is available — that keeps newly-created
// products usable before the first PO lands, and (importantly) lets the
// product-edit form preview reflect an unsaved cost edit.
//
// Exported so the form can call it with the source picked in the form (which
// may differ from the saved value), enabling honest preview of sale prices.
export function costFromSource(
  productId: string,
  variantId: string | undefined,
  source: MarkupCostSource,
  manualFallback: number
): number {
  if (source === 'manual') return manualFallback;
  // Resolve the owned-batches scope. Mirrors currentCost's variant aggregation:
  // when variantId is omitted on a variant-bearing product, aggregate across
  // all variants rather than matching variantId === undefined (which would
  // find nothing).
  let ownedBatches;
  if (variantId !== undefined) {
    ownedBatches = batches
      .forStock(productId, variantId)
      .filter((b) => b.ownership === 'owned');
  } else {
    const product = products.getById(productId);
    if (product && product.variants.length > 0) {
      ownedBatches = batches
        .forProduct(productId)
        .filter((b) => b.ownership === 'owned' && b.qtyRemaining > 0);
    } else {
      ownedBatches = batches.forStock(productId).filter((b) => b.ownership === 'owned');
    }
  }
  if (ownedBatches.length === 0) return manualFallback;
  if (source === 'fifo-current') {
    // forStock already sorts FIFO; forProduct (variant-aggregate path) only
    // sorts by receivedAt, so re-sort to honour expiry-first ordering.
    const fifoSorted = [...ownedBatches].sort((a, b) => {
      const aExp = a.expiresAt ?? '9999-12-31';
      const bExp = b.expiresAt ?? '9999-12-31';
      if (aExp !== bExp) return aExp.localeCompare(bExp);
      return a.receivedAt.localeCompare(b.receivedAt);
    });
    return fifoSorted[0].unitCost;
  }
  // batch-avg
  const totalQty = ownedBatches.reduce((s, b) => s + b.qtyRemaining, 0);
  if (totalQty <= 0) return manualFallback;
  return ownedBatches.reduce((s, b) => s + b.qtyRemaining * b.unitCost, 0) / totalQty;
}

export function effectiveVariantCost(v: ProductVariant, p?: Product): number {
  // Composite variant — cost from its recipe, each component honoring its own source.
  if (v.components.length > 0) {
    const recipeCost = componentsCost(v.components);
    if (!p) return recipeCost;
    return costFromSource(
      p.id,
      v.id,
      p.markupCostSource ?? 'manual',
      recipeCost
    );
  }
  // Goods variant — source decides; fall back to v.cost when no batch yet.
  if (!p) return v.cost;
  return costFromSource(p.id, v.id, p.markupCostSource ?? 'manual', v.cost);
}

// Resolve the active production mode for a (composite, variant?) pair. Variant
// override wins; falls back to product-level mode; default 'flexible'.
export function productionModeOf(p: Product, variantId?: string): ProductionMode {
  if (variantId) {
    const v = p.variants.find((vv) => vv.id === variantId);
    if (v?.productionMode) return v.productionMode;
  }
  return p.productionMode ?? 'flexible';
}

// Resolve the recipe for a (composite, variant?) pair. Variant `components`
// override the product's recipe when non-empty.
export function recipeOf(p: Product, variantId?: string): CompositeComponent[] {
  if (variantId) {
    const v = p.variants.find((vv) => vv.id === variantId);
    if (v && v.components.length > 0) return v.components;
  }
  return p.components;
}

// Pure component-derived producibility. Exposed for the production-modal
// planner ("how many can I make right now?") and for the flexible-mode fallback
// inside producibleStock.
export function componentsProducibleFor(comps: CompositeComponent[]): number {
  return componentsProducible(comps);
}

export function producibleVariantStock(productId: string, v: ProductVariant): number {
  const p = products.getById(productId);
  if (!p || p.kind !== 'composite') {
    // Goods variant — just batch stock.
    return stockOf(productId, v.id);
  }
  // Composite variant: real batch stock first; in flexible mode fall back to
  // component-derived capacity when no produced stock exists.
  const real = stockOf(productId, v.id);
  if (real > 0) return real;
  const mode = productionModeOf(p, v.id);
  if (mode === 'strict') return 0;
  const recipe = v.components.length > 0 ? v.components : p.components;
  return componentsProducible(recipe);
}

export function effectiveCost(p: Product): number {
  // Composite — recipe-derived cost, then source-aware lookup (so a composite
  // with produced batches can also track FIFO / batch-avg).
  if (p.components.length > 0) {
    const recipeCost = componentsCost(p.components);
    return costFromSource(p.id, undefined, p.markupCostSource ?? 'manual', recipeCost);
  }
  // Goods — source-aware lookup; manual fallback to product.cost.
  return costFromSource(p.id, undefined, p.markupCostSource ?? 'manual', p.cost);
}

export function producibleStock(p: Product): number {
  if (p.kind !== 'composite') return stockOf(p.id);
  // Composite without variants: real batch stock first; flexible mode falls
  // back to component-derived capacity. Variant-bearing composites should
  // route through producibleVariantStock per-variant instead.
  if (p.variants.length === 0) {
    const real = stockOf(p.id);
    if (real > 0) return real;
    if (productionModeOf(p) === 'strict') return 0;
    return componentsProducible(p.components);
  }
  return p.variants.reduce((s, v) => s + producibleVariantStock(p.id, v), 0);
}

export type ProductInput = Omit<Product, 'id'>;

export const pricingKindOptions: { value: PricingKind; label: string }[] = [
  { value: 'fixed', label: 'Harga tetap' },
  { value: 'markup_amount', label: 'Biaya + nominal' },
  { value: 'markup_pct', label: 'Persen untung' }
];

export function isPercentKind(kind: PricingKind): boolean {
  return kind === 'markup_pct';
}

export function computeSalePrice(cost: number, s: PricingStrategy): number {
  if (!Number.isFinite(s.value)) return NaN;
  switch (s.kind) {
    case 'fixed':
      return s.value;
    case 'markup_amount':
      return cost + s.value;
    case 'markup_pct':
      return cost * (1 + s.value / 100);
  }
}

export function validatePricing(s: PricingStrategy): string | null {
  if (!Number.isFinite(s.value)) return 'Enter a number.';
  if (s.value < 0) return 'Must be 0 or greater.';
  return null;
}

export function defaultPricing(value = 0): PricingStrategy {
  return { kind: 'fixed', value };
}

export function findEntry(
  entries: PricelistEntry[],
  pricelistId: string
): PricelistEntry | undefined {
  return entries.find((e) => e.pricelistId === pricelistId);
}

export function effectiveEntry(
  entries: PricelistEntry[],
  pricelistId: string,
  fallbackId?: string
): PricelistEntry | undefined {
  return (
    findEntry(entries, pricelistId) ??
    (fallbackId ? findEntry(entries, fallbackId) : undefined)
  );
}

export function emptyEntry(pricelistId: string): PricelistEntry {
  return { pricelistId, pricing: defaultPricing(), tiers: [] };
}

export function cloneEntry(entry: PricelistEntry): PricelistEntry {
  return {
    pricelistId: entry.pricelistId,
    pricing: { ...entry.pricing } as PricingStrategy,
    tiers: entry.tiers.map((t) => ({ ...t, pricing: { ...t.pricing } as PricingStrategy }))
  };
}

export function tierFor(entry: PricelistEntry, qty: number): PricingTier | null {
  const sorted = [...entry.tiers].sort((a, b) => b.minQty - a.minQty);
  for (const tier of sorted) {
    if (qty >= tier.minQty) return tier;
  }
  return null;
}

export function priceForQty(entry: PricelistEntry, qty: number, cost: number): number {
  const tier = tierFor(entry, qty);
  return computeSalePrice(cost, tier?.pricing ?? entry.pricing);
}

function slugifyValue(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function activeAttributes(attrs: ProductAttribute[]): ProductAttribute[] {
  return attrs.filter((a) => a.name.trim() && a.values.length > 0);
}

export function variantCombinations(
  attrs: ProductAttribute[]
): Array<Record<string, string>> {
  const active = activeAttributes(attrs);
  if (active.length === 0) return [];
  let combos: Array<Record<string, string>> = [{}];
  for (const attr of active) {
    const next: Array<Record<string, string>> = [];
    for (const combo of combos) {
      for (const value of attr.values) {
        next.push({ ...combo, [attr.name]: value });
      }
    }
    combos = next;
  }
  return combos;
}

export function valuesMatch(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  const keys = Object.keys(a);
  const otherKeys = Object.keys(b);
  if (keys.length !== otherKeys.length) return false;
  return keys.every((k) => a[k] === b[k]);
}

export function generateVariants(
  attrs: ProductAttribute[],
  defaults: {
    baseSku: string;
    cost: number;
    prices: PricelistEntry[];
    components?: CompositeComponent[];
  }
): ProductVariant[] {
  const active = activeAttributes(attrs);
  const combos = variantCombinations(active);
  return combos.map((values) => {
    const names = active.map((a) => values[a.name]);
    const slug = names.map(slugifyValue).join('-');
    const skuTail = slug.toUpperCase();
    return {
      id: crypto.randomUUID(),
      name: names.join(' / '),
      sku: defaults.baseSku ? `${defaults.baseSku}-${skuTail}` : skuTail,
      cost: defaults.cost,
      prices: defaults.prices.map(cloneEntry),
      barcode: '',
      values,
      imageUrl: '',
      components: defaults.components?.map((c) => ({ ...c, id: crypto.randomUUID() })) ?? []
    };
  });
}

export function regenerateVariants(
  attrs: ProductAttribute[],
  existing: ProductVariant[],
  defaults: {
    baseSku: string;
    cost: number;
    prices: PricelistEntry[];
    components?: CompositeComponent[];
  }
): ProductVariant[] {
  const fresh = generateVariants(attrs, defaults);
  return fresh.map((next) => {
    const match = existing.find(
      (e) => Object.keys(e.values).length > 0 && valuesMatch(e.values, next.values)
    );
    if (!match) return next;
    return {
      ...match,
      name: next.name,
      values: next.values
    };
  });
}

const RETAIL = 'pl_retail';
const WHOLESALE = 'pl_wholesale';

function retail(pricing: PricingStrategy, tiers: PricingTier[] = []): PricelistEntry {
  return { pricelistId: RETAIL, pricing, tiers };
}

function wholesale(pricing: PricingStrategy, tiers: PricingTier[] = []): PricelistEntry {
  return { pricelistId: WHOLESALE, pricing, tiers };
}

const seed: Product[] = [
  {
    id: 'prd_1',
    kind: 'goods',
    sku: 'BEV-ESP-001',
    name: 'Espresso',
    categoryId: 'cat_1',
    unitId: 'unit_1',
    cost: 5000,
    prices: [retail({ kind: 'fixed', value: 25000 })],
    status: 'active',
    description: 'Double-shot espresso, 60ml.',
    suppliers: [
      {
        supplierId: 'sup_1',
        isPrimary: true,
        unitCost: 5000,
        leadTimeDays: 7,
        supplierSku: 'KN-ESP-2026',
        notes: 'Single-origin Sumatra blend; bulanan.'
      },
      {
        supplierId: 'sup_4',
        isPrimary: false,
        unitCost: 5400,
        leadTimeDays: 3,
        supplierSku: '',
        notes: 'Cadangan saat Kopi Nusantara overdue.'
      }
    ],
    imageUrl: 'https://picsum.photos/seed/pos-espresso/240/240',
    units: [],
    attributes: [],
    variants: [],
    components: [],
    extras: []
  },
  {
    id: 'prd_2',
    kind: 'goods',
    sku: 'BEV-LAT-001',
    name: 'Latte',
    categoryId: 'cat_1',
    unitId: 'unit_1',
    cost: 12000,
    prices: [retail({ kind: 'markup_pct', value: 175 })],
    status: 'active',
    description: 'Whole milk latte — markup follows current FIFO batch cost.',
    markupCostSource: 'fifo-current',
    suppliers: [
      {
        supplierId: 'sup_1',
        isPrimary: true,
        unitCost: 12000,
        supplierSku: 'KN-LAT-2026',
        notes: ''
      }
    ],
    imageUrl: 'https://picsum.photos/seed/pos-latte/240/240',
    units: [],
    attributes: [],
    variants: [],
    components: [],
    extras: []
  },
  {
    id: 'prd_3',
    kind: 'goods',
    sku: 'FOO-CRO-001',
    name: 'Butter Croissant',
    categoryId: 'cat_2',
    unitId: 'unit_1',
    cost: 8000,
    prices: [retail({ kind: 'markup_amount', value: 17000 })],
    status: 'active',
    description: 'Flaky all-butter croissant, baked daily.',
    suppliers: [
      {
        supplierId: 'sup_2',
        isPrimary: true,
        unitCost: 8000,
        leadTimeDays: 1,
        supplierSku: 'RS-CRO-PLAIN',
        notes: 'Pengiriman pagi setiap hari.'
      },
      {
        supplierId: 'sup_4',
        isPrimary: false,
        unitCost: 9200,
        leadTimeDays: 3,
        supplierSku: '',
        notes: 'Frozen, hanya untuk darurat (kualitas turun).'
      }
    ],
    imageUrl: 'https://picsum.photos/seed/pos-croissant/240/240',
    units: [],
    attributes: [],
    variants: [],
    components: [],
    extras: [],
    requiresBatchLabel: true,
    requiresExpiration: true
  },
  {
    id: 'prd_4',
    kind: 'goods',
    sku: 'MER-MUG-001',
    name: 'Logo Mug 12oz',
    categoryId: 'cat_3',
    unitId: 'unit_1',
    cost: 50000,
    prices: [retail({ kind: 'fixed', value: 150000 })],
    status: 'active',
    description: 'Ceramic mug with embossed logo. Three colorways. Supplied on consignment.',
    suppliers: [
      {
        supplierId: 'sup_3',
        isPrimary: true,
        unitCost: 50000,
        leadTimeDays: 14,
        supplierSku: 'KL-MUG-12OZ',
        notes: 'Konsinyasi quarterly refresh.'
      }
    ],
    imageUrl: 'https://picsum.photos/seed/pos-mug/240/240',
    units: [],
    attributes: [
      { id: 'attr_mug_color', name: 'Color', values: ['White', 'Black', 'Brand Blue'] }
    ],
    variants: [
      {
        id: 'v_1',
        name: 'White',
        sku: 'MER-MUG-001-WHITE',
        cost: 50000,
        prices: [retail({ kind: 'fixed', value: 150000 })],
        barcode: '',
        values: { Color: 'White' },
        imageUrl: 'https://picsum.photos/seed/pos-mug-white/240/240',
        components: []
      },
      {
        id: 'v_2',
        name: 'Black',
        sku: 'MER-MUG-001-BLACK',
        cost: 50000,
        prices: [retail({ kind: 'markup_pct', value: 200 })],
        barcode: '',
        values: { Color: 'Black' },
        imageUrl: 'https://picsum.photos/seed/pos-mug-black/240/240',
        components: []
      },
      {
        id: 'v_3',
        name: 'Brand Blue',
        sku: 'MER-MUG-001-BRAND-BLUE',
        cost: 60000,
        prices: [retail({ kind: 'markup_amount', value: 95000 })],
        barcode: '',
        values: { Color: 'Brand Blue' },
        imageUrl: 'https://picsum.photos/seed/pos-mug-blue/240/240',
        components: []
      }
    ],
    components: [],
    extras: []
  },
  {
    id: 'prd_5',
    kind: 'goods',
    sku: 'BEV-CKA-330',
    name: 'Cola 330mL',
    categoryId: 'cat_1',
    brandId: 'brand_coca-cola',
    tags: ['Best Seller', 'Promo'],
    unitId: 'unit_1',
    cost: 3500,
    prices: [
      retail({ kind: 'fixed', value: 8000 }, [
        { minQty: 12, pricing: { kind: 'fixed', value: 7500 } }
      ]),
      wholesale({ kind: 'fixed', value: 7000 }, [
        { minQty: 24, pricing: { kind: 'fixed', value: 6500 } },
        { minQty: 100, pricing: { kind: 'fixed', value: 6000 } }
      ])
    ],
    status: 'active',
    description: 'Classic cola, 330mL can. Sold individually, by 6-pack or by case.',
    suppliers: [
      {
        supplierId: 'sup_4',
        isPrimary: true,
        unitCost: 3500,
        leadTimeDays: 3,
        supplierSku: 'GA-COLA-330',
        notes: ''
      }
    ],
    imageUrl: 'https://picsum.photos/seed/pos-cola/240/240',
    units: [
      {
        unitId: 'unit_2',
        factor: 6,
        prices: [
          retail({ kind: 'markup_pct', value: 90 }),
          wholesale({ kind: 'markup_pct', value: 67 })
        ],
        barcode: ''
      },
      {
        unitId: 'unit_2',
        factor: 24,
        prices: [
          retail({ kind: 'markup_pct', value: 75 }),
          wholesale({ kind: 'markup_pct', value: 50 })
        ],
        barcode: ''
      }
    ],
    attributes: [],
    variants: [],
    components: [],
    extras: []
  },
  {
    id: 'prd_6',
    kind: 'goods',
    sku: 'BEV-WTR-500',
    name: 'Spring Water 500mL',
    categoryId: 'cat_1',
    brandId: 'brand_aqua',
    unitId: 'unit_5',
    cost: 2500,
    prices: [retail({ kind: 'fixed', value: 5000 })],
    status: 'archived',
    description: 'Discontinued sparkling water SKU.',
    suppliers: [
      {
        supplierId: 'sup_4',
        isPrimary: true,
        unitCost: 2500,
        supplierSku: '',
        notes: ''
      }
    ],
    imageUrl: '',
    units: [],
    attributes: [],
    variants: [],
    components: [],
    extras: []
  },
  {
    id: 'prd_7',
    kind: 'composite',
    sku: 'BDL-COMBO-001',
    name: 'Coffee & Croissant Combo',
    categoryId: 'cat_2',
    unitId: 'unit_1',
    cost: 0,
    prices: [retail({ kind: 'fixed', value: 40000 })],
    status: 'active',
    description: 'One espresso + one butter croissant. Save Rp 10.000 vs buying separately.',
    suppliers: [],
    imageUrl: 'https://picsum.photos/seed/pos-combo/240/240',
    units: [],
    attributes: [],
    variants: [],
    components: [
      { id: 'cmp_1', productId: 'prd_1', quantity: 1 },
      { id: 'cmp_2', productId: 'prd_3', quantity: 1 }
    ],
    extras: [
      { id: 'ext_1', name: 'Extra shot of espresso', priceDelta: 5000, components: [] },
      { id: 'ext_2', name: 'Almond milk upgrade', priceDelta: 4000, components: [] }
    ]
  },
  {
    id: 'prd_8',
    kind: 'goods',
    sku: 'BHN-TLR-001',
    name: 'Telur Ayam',
    categoryId: 'cat_5',
    unitId: 'unit_1',
    cost: 2500,
    prices: [retail({ kind: 'fixed', value: 4000 })],
    status: 'active',
    description: 'Telur ayam segar — bahan baku untuk olahan dapur. Pelacakan batch wajib karena perishable.',
    suppliers: [
      {
        supplierId: 'sup_2',
        isPrimary: true,
        unitCost: 2500,
        leadTimeDays: 1,
        supplierSku: 'RS-TLR-30',
        notes: 'Datang dalam tray 30 butir.'
      },
      {
        supplierId: 'sup_4',
        isPrimary: false,
        unitCost: 2700,
        leadTimeDays: 3,
        supplierSku: '',
        notes: 'Cadangan saat Roti Sejahtera sold out.'
      }
    ],
    imageUrl: 'https://picsum.photos/seed/pos-telur/240/240',
    units: [
      {
        unitId: 'unit_2',
        factor: 30,
        prices: [retail({ kind: 'markup_pct', value: 50 })],
        barcode: ''
      }
    ],
    attributes: [],
    variants: [],
    components: [],
    extras: [],
    requiresBatchLabel: true,
    requiresExpiration: true
  },
  {
    id: 'prd_9',
    kind: 'goods',
    sku: 'BHN-DGC-001',
    name: 'Daging Sapi Cincang',
    categoryId: 'cat_5',
    unitId: 'unit_4',
    cost: 130,
    prices: [retail({ kind: 'markup_pct', value: 30 })],
    status: 'active',
    description: 'Daging sapi giling segar dalam gram. Disimpan dingin; cek tanggal kedaluwarsa per batch.',
    suppliers: [
      {
        supplierId: 'sup_2',
        isPrimary: true,
        unitCost: 130,
        leadTimeDays: 1,
        supplierSku: 'RS-DGC-KG',
        notes: 'Pesan per kg, dikirim chilled pagi.'
      }
    ],
    imageUrl: 'https://picsum.photos/seed/pos-daging/240/240',
    units: [
      {
        unitId: 'unit_3',
        factor: 1000,
        prices: [retail({ kind: 'markup_pct', value: 25 })],
        barcode: ''
      }
    ],
    attributes: [],
    variants: [],
    components: [],
    extras: [],
    requiresBatchLabel: true,
    requiresExpiration: true
  },
  // === prd_10: Ayam Mentah (goods, variant per cut) ===
  // Raw side of the fried-chicken flow. Each cut is its own variant with its
  // own cost, price, and seeded batch stock — production runs draw from these.
  {
    id: 'prd_10',
    kind: 'goods',
    sku: 'BHN-AYM-001',
    name: 'Ayam Mentah',
    categoryId: 'cat_5',
    unitId: 'unit_1',
    cost: 10000,
    prices: [retail({ kind: 'markup_pct', value: 30 })],
    status: 'active',
    description: 'Ayam potong segar — bahan baku untuk ayam goreng. Tiap cut adalah varian sendiri.',
    suppliers: [
      {
        supplierId: 'sup_2',
        isPrimary: true,
        unitCost: 10000,
        leadTimeDays: 1,
        supplierSku: 'RS-AYM',
        notes: 'Datang chilled tiap pagi.'
      }
    ],
    imageUrl: 'https://picsum.photos/seed/pos-ayam-mentah/240/240',
    units: [],
    attributes: [{ id: 'attr_chk_cut', name: 'Cut', values: ['Paha', 'Dada', 'Sayap', 'Drumstick'] }],
    variants: [
      {
        id: 'v_chk_paha',
        name: 'Paha',
        sku: 'BHN-AYM-PHA',
        cost: 12000,
        prices: [retail({ kind: 'fixed', value: 18000 })],
        barcode: '',
        values: { Cut: 'Paha' },
        imageUrl: '',
        components: []
      },
      {
        id: 'v_chk_dada',
        name: 'Dada',
        sku: 'BHN-AYM-DDA',
        cost: 15000,
        prices: [retail({ kind: 'fixed', value: 22000 })],
        barcode: '',
        values: { Cut: 'Dada' },
        imageUrl: '',
        components: []
      },
      {
        id: 'v_chk_sayap',
        name: 'Sayap',
        sku: 'BHN-AYM-SYP',
        cost: 5000,
        prices: [retail({ kind: 'fixed', value: 10000 })],
        barcode: '',
        values: { Cut: 'Sayap' },
        imageUrl: '',
        components: []
      },
      {
        id: 'v_chk_drum',
        name: 'Drumstick',
        sku: 'BHN-AYM-DRM',
        cost: 8000,
        prices: [retail({ kind: 'fixed', value: 14000 })],
        barcode: '',
        values: { Cut: 'Drumstick' },
        imageUrl: '',
        components: []
      }
    ],
    components: [],
    extras: [],
    requiresBatchLabel: true,
    requiresExpiration: true
  },
  // === prd_11: Ayam Goreng (composite, flexible mode, variant per cut) ===
  // Fried side. Each variant references the matching raw cut. Mode 'flexible'
  // means you can pre-fry batches into the warmer and they're preferred at
  // sale, but if the warmer empties the system falls back to deducting raw
  // chicken on the fly (the cafe-style fresh-make path).
  {
    id: 'prd_11',
    kind: 'composite',
    sku: 'MKN-AYG-001',
    name: 'Ayam Goreng',
    categoryId: 'cat_2',
    unitId: 'unit_1',
    cost: 0,
    prices: [retail({ kind: 'fixed', value: 25000 })],
    status: 'active',
    description:
      'Ayam goreng krispi. Pilih cut — paha, dada, sayap, atau drumstick. Bisa pre-fry untuk display warmer.',
    suppliers: [],
    imageUrl: 'https://picsum.photos/seed/pos-ayam-goreng/240/240',
    units: [],
    attributes: [{ id: 'attr_ayg_cut', name: 'Cut', values: ['Paha', 'Dada', 'Sayap', 'Drumstick'] }],
    variants: [
      {
        id: 'v_ayg_paha',
        name: 'Paha',
        sku: 'MKN-AYG-PHA',
        cost: 0,
        prices: [retail({ kind: 'fixed', value: 25000 })],
        barcode: '',
        values: { Cut: 'Paha' },
        imageUrl: '',
        components: [{ id: 'cmp_ayg_paha', productId: 'prd_10', variantId: 'v_chk_paha', quantity: 1 }]
      },
      {
        id: 'v_ayg_dada',
        name: 'Dada',
        sku: 'MKN-AYG-DDA',
        cost: 0,
        prices: [retail({ kind: 'fixed', value: 30000 })],
        barcode: '',
        values: { Cut: 'Dada' },
        imageUrl: '',
        components: [{ id: 'cmp_ayg_dada', productId: 'prd_10', variantId: 'v_chk_dada', quantity: 1 }]
      },
      {
        id: 'v_ayg_sayap',
        name: 'Sayap',
        sku: 'MKN-AYG-SYP',
        cost: 0,
        prices: [retail({ kind: 'fixed', value: 13000 })],
        barcode: '',
        values: { Cut: 'Sayap' },
        imageUrl: '',
        components: [{ id: 'cmp_ayg_sayap', productId: 'prd_10', variantId: 'v_chk_sayap', quantity: 1 }]
      },
      {
        id: 'v_ayg_drum',
        name: 'Drumstick',
        sku: 'MKN-AYG-DRM',
        cost: 0,
        prices: [retail({ kind: 'fixed', value: 18000 })],
        barcode: '',
        values: { Cut: 'Drumstick' },
        imageUrl: '',
        components: [{ id: 'cmp_ayg_drum', productId: 'prd_10', variantId: 'v_chk_drum', quantity: 1 }]
      }
    ],
    components: [],
    extras: [],
    productionMode: 'flexible',
    shelfLifeAfterProductionHours: 2,
    requiresExpiration: true
  },
  // === prd_12: Hampers Lebaran (composite, strict mode, no variants) ===
  // Demonstrates the other end of the spectrum — the operator must produce
  // these before they can be sold. No fallback to components, because making
  // a hamper at the till in front of the customer doesn't make sense.
  {
    id: 'prd_12',
    kind: 'composite',
    sku: 'MER-HMP-001',
    name: 'Hampers Lebaran',
    categoryId: 'cat_3',
    unitId: 'unit_1',
    cost: 0,
    prices: [retail({ kind: 'fixed', value: 150000 })],
    status: 'active',
    description: 'Paket hampers — 4 croissant + 6 cola. Harus dirakit lebih dulu sebelum dijual.',
    suppliers: [],
    imageUrl: 'https://picsum.photos/seed/pos-hampers/240/240',
    units: [],
    attributes: [],
    variants: [],
    components: [
      { id: 'cmp_hmp_crs', productId: 'prd_3', quantity: 4 },
      { id: 'cmp_hmp_cola', productId: 'prd_5', quantity: 6 }
    ],
    extras: [],
    productionMode: 'strict'
  }
];

class ProductsStore {
  items = $state<Product[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: ProductInput): Product {
    const product: Product = { ...input, id: `prd_${this.nextId++}` };
    this.items.push(product);
    return product;
  }

  update(
    id: string,
    patch: Partial<ProductInput>,
    options?: { source?: PriceChangeSource; notes?: string }
  ): Product | undefined {
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    const before = this.items[idx];
    const after = { ...before, ...patch };
    this.items[idx] = after;
    // Compute the price diff against the *new* state — pricing reads from
    // batches/source which all live outside the product itself; we want to
    // capture how the resulting sale price moved, not just the literal field.
    const diffs = diffPriceEntries(before, after);
    if (diffs.length > 0) {
      const source: PriceChangeSource = options?.source ?? 'manual';
      const notes = options?.notes ?? '';
      priceChanges.addMany(
        diffs.map((d) => ({ ...d, source, notes }))
      );
    }
    return after;
  }

  remove(id: string) {
    this.items = this.items.filter((p) => p.id !== id);
  }

  getById(id: string): Product | undefined {
    return this.items.find((p) => p.id === id);
  }

  countByBrand(brandId: string): number {
    return this.items.reduce((n, p) => (p.brandId === brandId ? n + 1 : n), 0);
  }

  countByCategory(categoryId: string): number {
    return this.items.reduce((n, p) => (p.categoryId === categoryId ? n + 1 : n), 0);
  }

  countByUnit(unitId: string): number {
    return this.items.reduce(
      (n, p) =>
        p.unitId === unitId || p.units.some((u) => u.unitId === unitId) ? n + 1 : n,
      0
    );
  }

  countByPricelist(pricelistId: string): number {
    return this.items.reduce((n, p) => {
      const inProduct = findEntry(p.prices, pricelistId) ? 1 : 0;
      const inVariants = p.variants.some((v) => findEntry(v.prices, pricelistId)) ? 1 : 0;
      const inUnits = p.units.some((u) => findEntry(u.prices, pricelistId)) ? 1 : 0;
      return n + (inProduct || inVariants || inUnits ? 1 : 0);
    }, 0);
  }
}

export const products = new ProductsStore();

// ─── Price-change diffing ────────────────────────────────────────────────
// Compares old vs new product price entries (product-level + variant-level +
// packaging-level + tiers) and produces one PriceChangeInput per actually-
// changed strategy. Same `(scope, pricelistId, tierMinQty?)` tuple identifies
// a row across old and new.

function strategyEq(a: PricingStrategy, b: PricingStrategy): boolean {
  if (a.kind !== b.kind) return false;
  return Math.abs(a.value - b.value) < 0.0001;
}

function packagingLabelFor(pack: ProductPackaging): string {
  const u = unitsStore.getById(pack.unitId);
  const name = u?.name ?? pack.unitId;
  return `${name} · isi ${pack.factor}`;
}

function compareEntries(
  before: PricelistEntry[],
  after: PricelistEntry[],
  context: {
    productId: string;
    productName: string;
    variantId?: string;
    variantName?: string;
    packagingIndex?: number;
    packagingLabel?: string;
    oldCost: number;
    newCost: number;
  }
): Omit<PriceChangeInput, 'source' | 'notes'>[] {
  const out: Omit<PriceChangeInput, 'source' | 'notes'>[] = [];
  const afterByPid = new Map<string, PricelistEntry>();
  for (const e of after) afterByPid.set(e.pricelistId, e);
  for (const oldEntry of before) {
    const newEntry = afterByPid.get(oldEntry.pricelistId);
    if (!newEntry) continue; // pricelist entry removed — we don't log deletions yet
    const pl = pricelists.getById(oldEntry.pricelistId);
    const pricelistName = pl?.name ?? oldEntry.pricelistId;
    // Base entry diff
    if (!strategyEq(oldEntry.pricing, newEntry.pricing)) {
      out.push({
        productId: context.productId,
        productName: context.productName,
        variantId: context.variantId,
        variantName: context.variantName,
        packagingIndex: context.packagingIndex,
        packagingLabel: context.packagingLabel,
        pricelistId: oldEntry.pricelistId,
        pricelistName,
        oldStrategy: oldEntry.pricing,
        newStrategy: newEntry.pricing,
        oldSale: computeSalePrice(context.oldCost, oldEntry.pricing),
        newSale: computeSalePrice(context.newCost, newEntry.pricing),
        cost: context.newCost
      });
    }
    // Tier diff — match by minQty. Added/removed tiers are skipped for v1.
    const newTiersByMin = new Map<number, PricingTier>();
    for (const t of newEntry.tiers) newTiersByMin.set(t.minQty, t);
    for (const oldTier of oldEntry.tiers) {
      const newTier = newTiersByMin.get(oldTier.minQty);
      if (!newTier) continue;
      if (strategyEq(oldTier.pricing, newTier.pricing)) continue;
      out.push({
        productId: context.productId,
        productName: context.productName,
        variantId: context.variantId,
        variantName: context.variantName,
        packagingIndex: context.packagingIndex,
        packagingLabel: context.packagingLabel,
        pricelistId: oldEntry.pricelistId,
        pricelistName,
        tierMinQty: oldTier.minQty,
        oldStrategy: oldTier.pricing,
        newStrategy: newTier.pricing,
        oldSale: computeSalePrice(context.oldCost, oldTier.pricing),
        newSale: computeSalePrice(context.newCost, newTier.pricing),
        cost: context.newCost
      });
    }
  }
  return out;
}

function diffPriceEntries(
  before: Product,
  after: Product
): Omit<PriceChangeInput, 'source' | 'notes'>[] {
  const out: Omit<PriceChangeInput, 'source' | 'notes'>[] = [];
  const oldCostProduct = effectiveCost(before);
  const newCostProduct = effectiveCost(after);
  // Product-level prices
  out.push(
    ...compareEntries(before.prices, after.prices, {
      productId: after.id,
      productName: after.name,
      oldCost: oldCostProduct,
      newCost: newCostProduct
    })
  );
  // Variant-level prices — match by variant id
  const oldVariants = new Map(before.variants.map((v) => [v.id, v]));
  for (const v of after.variants) {
    const ov = oldVariants.get(v.id);
    if (!ov) continue;
    const oldVCost = effectiveVariantCost(ov, before);
    const newVCost = effectiveVariantCost(v, after);
    out.push(
      ...compareEntries(ov.prices, v.prices, {
        productId: after.id,
        productName: after.name,
        variantId: v.id,
        variantName: v.name,
        oldCost: oldVCost,
        newCost: newVCost
      })
    );
  }
  // Packaging-level prices — match by index (packagings are positional)
  for (let i = 0; i < after.units.length; i++) {
    const np = after.units[i];
    const op = before.units[i];
    if (!op) continue;
    const label = packagingLabelFor(np);
    out.push(
      ...compareEntries(op.prices, np.prices, {
        productId: after.id,
        productName: after.name,
        packagingIndex: i,
        packagingLabel: label,
        // For packaging, the cost driving markup math is factor × productCost.
        oldCost: op.factor * oldCostProduct,
        newCost: np.factor * newCostProduct
      })
    );
  }
  return out;
}

export function totalStock(p: Product): number {
  if (p.variants.length > 0) {
    return p.variants.reduce((s, v) => s + producibleVariantStock(p.id, v), 0);
  }
  if (p.components.length > 0) {
    return producibleStock(p);
  }
  return stockOf(p.id);
}

function activePricelistFor(pricelistId?: string): string {
  return pricelistId ?? pricelists.defaultId();
}

export function basePrice(p: Product, pricelistId?: string): number {
  const pid = activePricelistFor(pricelistId);
  const fallback = pricelists.defaultId();
  const entry = effectiveEntry(p.prices, pid, fallback);
  if (!entry) return NaN;
  return computeSalePrice(effectiveCost(p), entry.pricing);
}

export function priceRange(
  p: Product,
  pricelistId?: string
): { min: number; max: number } {
  const pid = activePricelistFor(pricelistId);
  const fallback = pricelists.defaultId();
  const prices: number[] = [];
  const baseCost = effectiveCost(p);

  const base = effectiveEntry(p.prices, pid, fallback);
  if (base) {
    const baseSale = computeSalePrice(baseCost, base.pricing);
    if (Number.isFinite(baseSale)) prices.push(baseSale);
  }

  for (const v of p.variants) {
    const entry = effectiveEntry(v.prices, pid, fallback) ?? base;
    if (!entry) continue;
    const sale = computeSalePrice(effectiveVariantCost(v, p), entry.pricing);
    if (Number.isFinite(sale)) prices.push(sale);
  }
  for (const u of p.units) {
    const entry = effectiveEntry(u.prices, pid, fallback) ?? base;
    if (!entry) continue;
    const sale = computeSalePrice(u.factor * baseCost, entry.pricing);
    if (Number.isFinite(sale)) prices.push(sale);
  }

  if (prices.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function pricelistEntries(p: Product): Set<string> {
  const ids = new Set<string>();
  for (const e of p.prices) ids.add(e.pricelistId);
  for (const v of p.variants) for (const e of v.prices) ids.add(e.pricelistId);
  for (const u of p.units) for (const e of u.prices) ids.add(e.pricelistId);
  return ids;
}

export function hasAnyTier(p: Product): boolean {
  if (p.prices.some((e) => e.tiers.length > 0)) return true;
  if (p.variants.some((v) => v.prices.some((e) => e.tiers.length > 0))) return true;
  if (p.units.some((u) => u.prices.some((e) => e.tiers.length > 0))) return true;
  return false;
}

// Classify a product's pricing mode for at-a-glance review in the product list.
//   'fixed'           — every entry uses kind: 'fixed'. Operator owns price changes.
//   'manual-markup'   — has markup_* entries; markupCostSource = 'manual'. Operator
//                       updates Biaya beli (or markup) to move the sale price.
//   'dynamic-markup'  — has markup_* entries; markupCostSource = 'fifo-current' or
//                       'batch-avg'. Sale price tracks batch cost automatically.
//   'mixed'           — both fixed and markup entries exist (e.g. retail = markup,
//                       wholesale = fixed). Behaviour depends on the row.
export type PricingMode = 'fixed' | 'manual-markup' | 'dynamic-markup' | 'mixed';

export function pricingMode(p: Product): PricingMode {
  let hasMarkup = false;
  let hasFixed = false;
  const visit = (entries: PricelistEntry[]) => {
    for (const e of entries) {
      const kinds: PricingKind[] = [e.pricing.kind, ...e.tiers.map((t) => t.pricing.kind)];
      for (const k of kinds) {
        if (k === 'fixed') hasFixed = true;
        else hasMarkup = true;
      }
    }
  };
  visit(p.prices);
  for (const v of p.variants) visit(v.prices);
  for (const u of p.units) visit(u.prices);
  if (hasMarkup && hasFixed) return 'mixed';
  if (hasMarkup) {
    return (p.markupCostSource ?? 'manual') === 'manual' ? 'manual-markup' : 'dynamic-markup';
  }
  return 'fixed';
}

// Where a barcode is registered. Used by the form validator to point the
// admin at the conflicting source ("already used in [Product X] (variant Black)").
export type BarcodeOwner = {
  productId: string;
  productName: string;
  scope: 'product' | 'variant' | 'packaging';
  // Human label for the inner scope: variant name (variant) or
  // "{unitName} · isi {factor}" (packaging). Empty for product-level.
  scopeLabel?: string;
};

// Walk the catalog to find who currently owns this barcode. Pass excludeProductId
// while editing a product so its own rows don't trigger a conflict against itself.
// Returns null when the barcode is free or empty.
export function findBarcodeOwner(
  barcode: string,
  excludeProductId?: string
): BarcodeOwner | null {
  if (!barcode) return null;
  for (const p of products.items) {
    if (p.id === excludeProductId) continue;
    if (p.barcode && p.barcode === barcode) {
      return { productId: p.id, productName: p.name, scope: 'product' };
    }
    for (const v of p.variants) {
      if (v.barcode && v.barcode === barcode) {
        return {
          productId: p.id,
          productName: p.name,
          scope: 'variant',
          scopeLabel: v.name || v.sku
        };
      }
    }
    for (const u of p.units) {
      if (u.barcode && u.barcode === barcode) {
        const unit = unitsStore.getById(u.unitId);
        const unitLabel = unit ? `${unit.name} · isi ${u.factor}` : `kemasan · isi ${u.factor}`;
        return {
          productId: p.id,
          productName: p.name,
          scope: 'packaging',
          scopeLabel: unitLabel
        };
      }
    }
  }
  return null;
}

export const pricingModeLabels: Record<PricingMode, string> = {
  fixed: 'Statis',
  'manual-markup': 'Markup manual',
  'dynamic-markup': 'Ikut PO',
  mixed: 'Campur'
};
