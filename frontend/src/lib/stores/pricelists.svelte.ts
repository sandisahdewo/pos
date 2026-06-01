export type Pricelist = {
  id: string;
  name: string;
  isDefault: boolean;
  description: string;
};

export type PricelistInput = Omit<Pricelist, 'id'>;

const seed: Pricelist[] = [
  {
    id: 'pl_retail',
    name: 'Retail',
    isDefault: true,
    description: 'Walk-in customers, standard pricing.'
  },
  {
    id: 'pl_wholesale',
    name: 'Wholesale',
    isDefault: false,
    description: 'B2B customers buying in bulk.'
  },
  {
    id: 'pl_vip',
    name: 'VIP',
    isDefault: false,
    description: 'Members and loyalty-tier customers.'
  }
];

class PricelistsStore {
  items = $state<Pricelist[]>([...seed]);
  private nextId = seed.length + 1;

  default(): Pricelist | undefined {
    return this.items.find((p) => p.isDefault) ?? this.items[0];
  }

  defaultId(): string {
    return this.default()?.id ?? '';
  }

  add(input: PricelistInput): Pricelist {
    const pricelist: Pricelist = { ...input, id: `pl_${this.nextId++}` };
    if (pricelist.isDefault) {
      this.items = this.items.map((p) => ({ ...p, isDefault: false }));
    }
    this.items.push(pricelist);
    return pricelist;
  }

  update(id: string, patch: Partial<PricelistInput>): Pricelist | undefined {
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    if (patch.isDefault) {
      this.items = this.items.map((p) => ({
        ...p,
        ...(p.id === id ? patch : {}),
        isDefault: p.id === id
      }));
      return this.items.find((p) => p.id === id);
    }
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string): boolean {
    const p = this.getById(id);
    if (!p) return false;
    if (p.isDefault) return false;
    if (this.items.length <= 1) return false;
    this.items = this.items.filter((p) => p.id !== id);
    return true;
  }

  getById(id: string): Pricelist | undefined {
    return this.items.find((p) => p.id === id);
  }
}

export const pricelists = new PricelistsStore();
