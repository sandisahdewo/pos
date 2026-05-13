import { taxRates } from './taxRates.svelte';

export type CategoryColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: CategoryColor;
  taxRateId: string;
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
