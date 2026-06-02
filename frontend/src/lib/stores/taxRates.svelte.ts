import {
  listTaxRates,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
  type ApiTaxRate,
  type TaxRateInput as ApiTaxRateInput
} from '$lib/api/tax-rates';

export type TaxRate = {
  id: string;
  name: string;
  rate: number;
  description: string;
  isDefault: boolean;
};

export type TaxRateInput = Omit<TaxRate, 'id'> & { id?: string };

function toTaxRate(t: ApiTaxRate): TaxRate {
  return {
    id: t.id,
    name: t.name,
    rate: t.rate,
    description: t.description,
    isDefault: t.isDefault
  };
}

function toApiInput(t: TaxRateInput): ApiTaxRateInput {
  return {
    id: t.id,
    name: t.name,
    rate: t.rate,
    description: t.description,
    isDefault: t.isDefault
  };
}

class TaxRatesStore {
  items = $state<TaxRate[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listTaxRates();
      this.items = list.map(toTaxRate);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: TaxRateInput): Promise<TaxRate> {
    // Tax rates use TEXT slug IDs by convention (tax_ppn11, tax_exempt).
    // If the caller didn't provide one, derive a `tax_<slug-of-name>` id.
    const id =
      input.id?.trim() ||
      'tax_' +
        input.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
    const created = await createTaxRate(toApiInput({ ...input, id }));
    const t = toTaxRate(created);
    this.items = [...this.items, t];
    return t;
  }

  async update(id: string, patch: Partial<TaxRateInput>): Promise<TaxRate | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const next: TaxRateInput = {
      name: patch.name ?? current.name,
      rate: patch.rate ?? current.rate,
      description: patch.description ?? current.description,
      isDefault: patch.isDefault ?? current.isDefault
    };
    const updated = await updateTaxRate(id, toApiInput(next));
    const t = toTaxRate(updated);
    // Promoting a row to default also demotes the previous default in the
    // backend — reflect that locally so the UI stays in sync.
    this.items = this.items.map((x) => {
      if (x.id === id) return t;
      if (t.isDefault) return { ...x, isDefault: false };
      return x;
    });
    return t;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await deleteTaxRate(id);
      this.items = this.items.filter((t) => t.id !== id);
      return true;
    } catch {
      return false;
    }
  }

  default(): TaxRate | undefined {
    return this.items.find((t) => t.isDefault) ?? this.items[0];
  }

  defaultId(): string {
    return this.default()?.id ?? '';
  }

  getById(id: string): TaxRate | undefined {
    return this.items.find((t) => t.id === id);
  }
}

export const taxRates = new TaxRatesStore();
