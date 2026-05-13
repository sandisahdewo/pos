export type TaxRate = {
  id: string;
  name: string;
  rate: number;
  description: string;
  isDefault: boolean;
};

export type TaxRateInput = Omit<TaxRate, 'id'>;

const seed: TaxRate[] = [
  {
    id: 'tax_ppn11',
    name: 'PPN 11%',
    rate: 11,
    description: 'Standard Indonesian VAT (Pajak Pertambahan Nilai).',
    isDefault: true
  },
  {
    id: 'tax_exempt',
    name: 'Tax-exempt',
    rate: 0,
    description:
      'Items exempt from PPN (e.g., basic foodstuffs, education, healthcare per UU HPP).',
    isDefault: false
  },
  {
    id: 'tax_zero',
    name: 'Zero-rated',
    rate: 0,
    description: 'Zero-rated for export goods and certain services.',
    isDefault: false
  }
];

class TaxRatesStore {
  items = $state<TaxRate[]>([...seed]);
  private nextId = seed.length + 1;

  default(): TaxRate | undefined {
    return this.items.find((t) => t.isDefault) ?? this.items[0];
  }

  defaultId(): string {
    return this.default()?.id ?? '';
  }

  add(input: TaxRateInput): TaxRate {
    const next: TaxRate = { ...input, id: `tax_${this.nextId++}` };
    if (next.isDefault) {
      this.items = this.items.map((t) => ({ ...t, isDefault: false }));
    }
    this.items.push(next);
    return next;
  }

  update(id: string, patch: Partial<TaxRateInput>): TaxRate | undefined {
    const idx = this.items.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    if (patch.isDefault) {
      this.items = this.items.map((t) => ({
        ...t,
        ...(t.id === id ? patch : {}),
        isDefault: t.id === id
      }));
      return this.items.find((t) => t.id === id);
    }
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string): boolean {
    const t = this.getById(id);
    if (!t) return false;
    if (t.isDefault) return false;
    if (this.items.length <= 1) return false;
    this.items = this.items.filter((t) => t.id !== id);
    return true;
  }

  getById(id: string): TaxRate | undefined {
    return this.items.find((t) => t.id === id);
  }
}

export const taxRates = new TaxRatesStore();
