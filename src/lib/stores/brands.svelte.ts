export type BrandStatus = 'active' | 'archived';

export type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string; // logo URL; empty string when none
  status: BrandStatus;
};

export type BrandInput = Omit<Brand, 'id' | 'slug'> & { slug?: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const seed: Brand[] = [
  {
    id: 'brand_indofood',
    name: 'Indofood',
    slug: 'indofood',
    description: 'Mie instan, bumbu, dan produk konsumen masal.',
    imageUrl: 'https://picsum.photos/seed/brand-indofood/120/120',
    status: 'active'
  },
  {
    id: 'brand_aqua',
    name: 'Aqua',
    slug: 'aqua',
    description: 'Air minum dalam kemasan.',
    imageUrl: 'https://picsum.photos/seed/brand-aqua/120/120',
    status: 'active'
  },
  {
    id: 'brand_coca-cola',
    name: 'Coca-Cola',
    slug: 'coca-cola',
    description: 'Minuman berkarbonasi.',
    imageUrl: 'https://picsum.photos/seed/brand-cola/120/120',
    status: 'active'
  }
];

class BrandsStore {
  items = $state<Brand[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: BrandInput): Brand {
    const brand: Brand = {
      id: `brand_${this.nextId++}`,
      name: input.name,
      slug: input.slug?.trim() || slugify(input.name),
      description: input.description,
      imageUrl: input.imageUrl,
      status: input.status
    };
    this.items.push(brand);
    return brand;
  }

  update(id: string, patch: Partial<BrandInput>): Brand | undefined {
    const idx = this.items.findIndex((b) => b.id === id);
    if (idx === -1) return undefined;
    const next = { ...this.items[idx], ...patch };
    if (patch.name && !patch.slug) next.slug = slugify(patch.name);
    this.items[idx] = next;
    return next;
  }

  remove(id: string) {
    this.items = this.items.filter((b) => b.id !== id);
  }

  getById(id: string): Brand | undefined {
    return this.items.find((b) => b.id === id);
  }

  active(): Brand[] {
    return this.items.filter((b) => b.status === 'active');
  }
}

export const brands = new BrandsStore();
