import {
  listPricelists,
  createPricelist,
  updatePricelist,
  deletePricelist,
  type ApiPricelist,
  type PricelistInput as ApiPricelistInput
} from '$lib/api/pricelists';

export type Pricelist = {
  id: string;
  name: string;
  isDefault: boolean;
  description: string;
};

export type PricelistInput = Omit<Pricelist, 'id'> & { id?: string };

function toPricelist(p: ApiPricelist): Pricelist {
  return { id: p.id, name: p.name, isDefault: p.isDefault, description: p.description };
}

function toApiInput(p: PricelistInput): ApiPricelistInput {
  return { id: p.id, name: p.name, description: p.description, isDefault: p.isDefault };
}

class PricelistsStore {
  items = $state<Pricelist[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listPricelists();
      this.items = list.map(toPricelist);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  default(): Pricelist | undefined {
    return this.items.find((p) => p.isDefault) ?? this.items[0];
  }

  defaultId(): string {
    return this.default()?.id ?? '';
  }

  async add(input: PricelistInput): Promise<Pricelist> {
    const id =
      input.id?.trim() ||
      'pl_' +
        input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const created = await createPricelist(toApiInput({ ...input, id }));
    const p = toPricelist(created);
    this.items = [...this.items.map((x) => (p.isDefault ? { ...x, isDefault: false } : x)), p];
    return p;
  }

  async update(id: string, patch: Partial<PricelistInput>): Promise<Pricelist | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const next: PricelistInput = {
      name: patch.name ?? current.name,
      description: patch.description ?? current.description,
      isDefault: patch.isDefault ?? current.isDefault
    };
    const updated = await updatePricelist(id, toApiInput(next));
    const p = toPricelist(updated);
    this.items = this.items.map((x) => {
      if (x.id === id) return p;
      if (p.isDefault) return { ...x, isDefault: false };
      return x;
    });
    return p;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await deletePricelist(id);
      this.items = this.items.filter((p) => p.id !== id);
      return true;
    } catch {
      return false;
    }
  }

  getById(id: string): Pricelist | undefined {
    return this.items.find((p) => p.id === id);
  }
}

export const pricelists = new PricelistsStore();
