import { taxRates } from './taxRates.svelte';

export type CategoryColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: CategoryColor;
  taxRateId: string;
  parentId?: string; // when set, this is a sub-category — undefined/empty = root
};

export type CategoryInput = Omit<Category, 'id' | 'slug'> & { slug?: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const seed: Category[] = [
  {
    id: 'cat_1',
    name: 'Minuman',
    slug: 'minuman',
    description: 'Kopi, teh, minuman ringan, dan air kemasan.',
    color: 'info',
    taxRateId: 'tax_ppn11'
  },
  {
    id: 'cat_2',
    name: 'Makanan',
    slug: 'makanan',
    description: 'Pastry, roti, dan makanan siap saji.',
    color: 'warning',
    taxRateId: 'tax_exempt'
  },
  {
    id: 'cat_3',
    name: 'Merchandise',
    slug: 'merchandise',
    description: 'Mug, kaos, dan suvenir berlogo.',
    color: 'brand',
    taxRateId: 'tax_ppn11'
  },
  {
    id: 'cat_4',
    name: 'Perlengkapan',
    slug: 'perlengkapan',
    description: 'Gelas, tutup, sedotan, dan habis pakai lainnya.',
    color: 'neutral',
    taxRateId: 'tax_ppn11'
  },
  {
    id: 'cat_5',
    name: 'Bahan Segar',
    slug: 'bahan-segar',
    description: 'Bahan baku perishable: telur, daging, sayur. Wajib pakai pelacakan batch + kedaluwarsa.',
    color: 'success',
    taxRateId: 'tax_exempt'
  },
  {
    id: 'cat_6',
    name: 'Kopi',
    slug: 'kopi',
    description: 'Sub-kategori minuman — kopi panas/dingin.',
    color: 'info',
    taxRateId: '',
    parentId: 'cat_1'
  },
  {
    id: 'cat_7',
    name: 'Single Origin',
    slug: 'kopi-single-origin',
    description: 'Sub-sub-kategori — biji single origin (Sumatra, Toraja, dll.).',
    color: 'info',
    taxRateId: '',
    parentId: 'cat_6'
  },
  {
    id: 'cat_8',
    name: 'Pastry',
    slug: 'pastry',
    description: 'Sub-kategori makanan — croissant, donut, kue.',
    color: 'warning',
    taxRateId: '',
    parentId: 'cat_2'
  },
  {
    id: 'cat_9',
    name: 'Rokok',
    slug: 'rokok',
    description: 'Rokok kretek dan filter — dijual ecer per batang, per bungkus, atau per slop.',
    color: 'danger',
    taxRateId: 'tax_ppn11'
  }
];

class CategoriesStore {
  items = $state<Category[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: CategoryInput): Category {
    const category: Category = {
      id: `cat_${this.nextId++}`,
      name: input.name,
      slug: input.slug?.trim() || slugify(input.name),
      description: input.description,
      color: input.color,
      taxRateId: input.taxRateId || taxRates.defaultId()
    };
    this.items.push(category);
    return category;
  }

  update(id: string, patch: Partial<CategoryInput>): Category | undefined {
    const idx = this.items.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    const next = { ...this.items[idx], ...patch };
    if (patch.name && !patch.slug) next.slug = slugify(patch.name);
    this.items[idx] = next;
    return next;
  }

  remove(id: string) {
    this.items = this.items.filter((c) => c.id !== id);
  }

  getById(id: string): Category | undefined {
    return this.items.find((c) => c.id === id);
  }

  // Walk up from this category to root. Order: root first, this last.
  // Defensive against cycles (caps at 16 hops).
  path(id: string): Category[] {
    const out: Category[] = [];
    let current = this.getById(id);
    const seen = new Set<string>();
    while (current && !seen.has(current.id) && out.length < 16) {
      seen.add(current.id);
      out.unshift(current);
      current = current.parentId ? this.getById(current.parentId) : undefined;
    }
    return out;
  }

  // All descendants of this category, recursively. Excludes the input id.
  descendantsOf(id: string): Category[] {
    const out: Category[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const next = stack.pop()!;
      for (const c of this.items) {
        if (c.parentId === next && !out.find((o) => o.id === c.id)) {
          out.push(c);
          stack.push(c.id);
        }
      }
    }
    return out;
  }

  // Cycle prevention: is `ancestorId` an ancestor of `descendantId`? Used to
  // block setting parent to self or to one's own descendant.
  isAncestorOf(ancestorId: string, descendantId: string): boolean {
    let current = this.getById(descendantId);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.parentId === ancestorId) return true;
      current = current.parentId ? this.getById(current.parentId) : undefined;
    }
    return false;
  }
}

export const categories = new CategoriesStore();

export const colorOptions: { value: CategoryColor; label: string }[] = [
  { value: 'brand', label: 'Brand (blue)' },
  { value: 'success', label: 'Success (green)' },
  { value: 'warning', label: 'Warning (amber)' },
  { value: 'danger', label: 'Danger (rose)' },
  { value: 'info', label: 'Info (sky)' },
  { value: 'neutral', label: 'Neutral (slate)' }
];
