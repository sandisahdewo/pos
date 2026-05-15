import { pricelists } from './pricelists.svelte';
import { categories, type Category } from './categories.svelte';
import { taxRates, type TaxRate } from './taxRates.svelte';
import { suppliers, type Supplier } from './suppliers.svelte';
import { stockOf } from './batches.svelte';

export type ProductStatus = 'active' | 'archived';

export type ProductKind = 'goods' | 'composite';

export const productKindOptions: { value: ProductKind; label: string; description: string }[] = [
  {
    value: 'goods',
    label: 'Barang',
    description: 'Dibeli jadi, dijual apa adanya. Mendukung varian dan satuan kemasan.'
  },
  {
    value: 'composite',
    label: 'Komposit',
    description: 'Dibuat atau dirakit dari produk lain (resep / paket).'
  }
];

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
};

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
  suppliers: ProductSupplier[];   // multi-supplier list; at most one isPrimary
  imageUrl: string;
  units: ProductPackaging[];
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  components: CompositeComponent[];
  extras: ProductExtra[];
  requiresBatchLabel?: boolean;   // print a thermal label per received batch (perishables, lot-tracked items)
  requiresExpiration?: boolean;   // capture expiration date on every batch; FIFO walks expiration ASC
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
  const cat: Category | undefined = categories.getById(product.categoryId);
  if (cat?.taxRateId) {
    const fromCat = taxRates.getById(cat.taxRateId);
    if (fromCat) return fromCat;
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
    if (v) return v.cost;
  }
  return product.cost;
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
  return comps.reduce((sum, c) => sum + c.quantity * componentBaseCost(c), 0);
}

function componentsProducible(comps: CompositeComponent[]): number {
  if (comps.length === 0) return 0;
  if (comps.some((c) => c.quantity <= 0)) return 0;
  return Math.min(
    ...comps.map((c) => Math.floor(componentAvailableStock(c) / c.quantity))
  );
}

export function effectiveVariantCost(v: ProductVariant): number {
  if (v.components.length > 0) return componentsCost(v.components);
  return v.cost;
}

export function producibleVariantStock(productId: string, v: ProductVariant): number {
  if (v.components.length > 0) return componentsProducible(v.components);
  return stockOf(productId, v.id);
}

export function effectiveCost(p: Product): number {
  if (p.components.length === 0) return p.cost;
  return componentsCost(p.components);
}

export function producibleStock(p: Product): number {
  if (p.components.length === 0) return stockOf(p.id);
  return componentsProducible(p.components);
}

export type ProductInput = Omit<Product, 'id'>;

export const pricingKindOptions: { value: PricingKind; label: string }[] = [
  { value: 'fixed', label: 'Fixed price' },
  { value: 'markup_amount', label: 'Cost + amount' },
  { value: 'markup_pct', label: 'Markup %' }
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
    description: 'Whole milk latte with single-origin espresso.',
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

  update(id: string, patch: Partial<ProductInput>): Product | undefined {
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string) {
    this.items = this.items.filter((p) => p.id !== id);
  }

  getById(id: string): Product | undefined {
    return this.items.find((p) => p.id === id);
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
    const sale = computeSalePrice(effectiveVariantCost(v), entry.pricing);
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
