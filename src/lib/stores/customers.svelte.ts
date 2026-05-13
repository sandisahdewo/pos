import { pricelists } from './pricelists.svelte';

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
  notes: string;
  joinedAt: string;
};

export type CustomerInput = Omit<Customer, 'id'>;

const seed: Customer[] = [
  {
    id: 'cust_1',
    name: 'Andi Pratama',
    type: 'individual',
    email: 'andi.pratama@example.id',
    phone: '+62 812 5550 0143',
    address: 'Jl. Sudirman No. 12, Jakarta Pusat',
    pricelistId: 'pl_vip',
    taxId: '',
    status: 'active',
    notes: 'VIP member since 2024. Prefers iced coffee.',
    joinedAt: '2024-06-15'
  },
  {
    id: 'cust_2',
    name: 'PT Distributor Maju',
    type: 'business',
    email: 'orders@distributormaju.id',
    phone: '+62 21 5550 0188',
    address: 'Jl. Diponegoro No. 45, Jakarta Selatan',
    pricelistId: 'pl_wholesale',
    taxId: '01.234.567.8-901.000',
    status: 'active',
    notes: 'Net-30 terms. Bulk beverage orders.',
    joinedAt: '2025-02-20'
  },
  {
    id: 'cust_3',
    name: 'Toko Berkah',
    type: 'business',
    email: 'tokoberkah@example.id',
    phone: '+62 22 5550 0173',
    address: 'Jl. Setiabudi No. 88, Bandung',
    pricelistId: 'pl_wholesale',
    taxId: '02.345.678.9-012.000',
    status: 'active',
    notes: 'Reseller. Weekly cola case orders.',
    joinedAt: '2025-04-10'
  },
  {
    id: 'cust_4',
    name: 'Siti Rahayu',
    type: 'individual',
    email: '',
    phone: '+62 813 5550 0102',
    address: '',
    pricelistId: 'pl_retail',
    taxId: '',
    status: 'active',
    notes: 'Regular Saturday customer.',
    joinedAt: '2025-08-04'
  }
];

class CustomersStore {
  items = $state<Customer[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: CustomerInput): Customer {
    const customer: Customer = {
      ...input,
      id: `cust_${this.nextId++}`,
      pricelistId: input.pricelistId || pricelists.defaultId()
    };
    this.items.push(customer);
    return customer;
  }

  update(id: string, patch: Partial<CustomerInput>): Customer | undefined {
    const idx = this.items.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string) {
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
