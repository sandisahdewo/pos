import { pricelists } from './pricelists.svelte';
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type ApiCustomer,
  type CustomerInput as ApiCustomerInput
} from '$lib/api/customers';

export type CustomerType = 'individual' | 'business';
export type CustomerStatus = 'active' | 'archived';

export type Customer = {
  id: string;
  name: string;
  type: CustomerType;
  email: string;
  phone: string;
  address: string;
  pricelistId: string;
  taxId: string;
  status: CustomerStatus;
  creditAllowed: boolean;
  notes: string;
  joinedAt: string;
};

export type CustomerInput = Omit<Customer, 'id'>;

function toCustomer(c: ApiCustomer): Customer {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    email: c.email,
    phone: c.phone,
    address: c.address,
    pricelistId: c.pricelistId ?? '',
    taxId: c.taxId,
    status: c.status,
    creditAllowed: c.creditAllowed,
    notes: c.notes,
    joinedAt: c.joinedAt
  };
}

function toApiInput(c: CustomerInput): ApiCustomerInput {
  return {
    name: c.name,
    type: c.type,
    email: c.email,
    phone: c.phone,
    address: c.address,
    pricelistId: c.pricelistId || null,
    taxId: c.taxId,
    status: c.status,
    creditAllowed: c.creditAllowed,
    notes: c.notes,
    joinedAt: c.joinedAt
  };
}

class CustomersStore {
  items = $state<Customer[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listCustomers();
      this.items = list.map(toCustomer);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: CustomerInput): Promise<Customer> {
    const payload: CustomerInput = {
      ...input,
      pricelistId: input.pricelistId || pricelists.defaultId()
    };
    const created = await createCustomer(toApiInput(payload));
    const c = toCustomer(created);
    this.items = [...this.items, c];
    return c;
  }

  async update(id: string, patch: Partial<CustomerInput>): Promise<Customer | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const next: CustomerInput = { ...current, ...patch };
    const updated = await updateCustomer(id, toApiInput(next));
    const c = toCustomer(updated);
    this.items = this.items.map((x) => (x.id === id ? c : x));
    return c;
  }

  async remove(id: string): Promise<void> {
    await deleteCustomer(id);
    this.items = this.items.filter((c) => c.id !== id);
  }

  getById(id: string): Customer | undefined {
    return this.items.find((c) => c.id === id);
  }

  countByPricelist(pricelistId: string): number {
    return this.items.reduce((n, c) => (c.pricelistId === pricelistId ? n + 1 : n), 0);
  }
}

export const customers = new CustomersStore();

export const customerTypeLabels: Record<CustomerType, string> = {
  individual: 'Individu',
  business: 'Bisnis'
};
