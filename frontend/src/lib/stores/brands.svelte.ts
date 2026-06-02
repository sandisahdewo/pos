import {
  listBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  type ApiBrand,
  type BrandInput as ApiBrandInput
} from '$lib/api/brands';

export type BrandStatus = 'active' | 'archived';

export type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  status: BrandStatus;
};

export type BrandInput = Omit<Brand, 'id' | 'slug'> & { slug?: string };

function toBrand(b: ApiBrand): Brand {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    imageUrl: b.imageUrl,
    status: b.status
  };
}

function toApiInput(b: BrandInput): ApiBrandInput {
  return {
    name: b.name,
    slug: b.slug,
    description: b.description,
    imageUrl: b.imageUrl,
    status: b.status
  };
}

class BrandsStore {
  items = $state<Brand[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listBrands();
      this.items = list.map(toBrand);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: BrandInput): Promise<Brand> {
    const created = await createBrand(toApiInput(input));
    const b = toBrand(created);
    this.items = [...this.items, b];
    return b;
  }

  async update(id: string, patch: Partial<BrandInput>): Promise<Brand | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const next: BrandInput = {
      name: patch.name ?? current.name,
      slug: patch.slug,
      description: patch.description ?? current.description,
      imageUrl: patch.imageUrl ?? current.imageUrl,
      status: patch.status ?? current.status
    };
    const updated = await updateBrand(id, toApiInput(next));
    const b = toBrand(updated);
    this.items = this.items.map((x) => (x.id === id ? b : x));
    return b;
  }

  async remove(id: string): Promise<void> {
    await deleteBrand(id);
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
