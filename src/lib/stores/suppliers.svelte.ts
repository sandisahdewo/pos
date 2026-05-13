export type SupplierStatus = 'active' | 'archived';

export type Supplier = {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  status: SupplierStatus;
  notes: string;
};

export type SupplierInput = Omit<Supplier, 'id'>;

const seed: Supplier[] = [
  {
    id: 'sup_1',
    name: 'PT Kopi Nusantara',
    contactPerson: 'Budi Santoso',
    email: 'orders@kopinusantara.id',
    phone: '+62 21 5550 0142',
    address: 'Jl. Sudirman No. 45, Jakarta Pusat',
    leadTimeDays: 7,
    status: 'active',
    notes: 'Single-origin beans, monthly invoice terms.'
  },
  {
    id: 'sup_2',
    name: 'CV Roti Sejahtera',
    contactPerson: 'Sri Wahyuni',
    email: 'sri@rotisejahtera.id',
    phone: '+62 22 5550 0188',
    address: 'Jl. Setiabudi No. 12, Bandung',
    leadTimeDays: 1,
    status: 'active',
    notes: 'Daily pastry delivery. Cash on delivery.'
  },
  {
    id: 'sup_3',
    name: 'Studio Karya Lokal',
    contactPerson: 'Aulia Pratama',
    email: 'aulia@karyalokal.id',
    phone: '+62 813 5550 0173',
    address: 'Jl. Kemang Raya No. 8, Jakarta Selatan',
    leadTimeDays: 14,
    status: 'active',
    notes: 'Consignment merchandise — branded mugs, totes, prints.'
  },
  {
    id: 'sup_4',
    name: 'Toko Grosir Aneka',
    contactPerson: 'Hendra Wijaya',
    email: 'orders@grosirineka.id',
    phone: '+62 31 5550 0107',
    address: 'Jl. Diponegoro No. 99, Surabaya',
    leadTimeDays: 3,
    status: 'active',
    notes: 'Beverages, snacks, supplies. Net-14 terms.'
  }
];

class SuppliersStore {
  items = $state<Supplier[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: SupplierInput): Supplier {
    const supplier: Supplier = { ...input, id: `sup_${this.nextId++}` };
    this.items.push(supplier);
    return supplier;
  }

  update(id: string, patch: Partial<SupplierInput>): Supplier | undefined {
    const idx = this.items.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string) {
    this.items = this.items.filter((s) => s.id !== id);
  }

  getById(id: string): Supplier | undefined {
    return this.items.find((s) => s.id === id);
  }

  active(): Supplier[] {
    return this.items.filter((s) => s.status === 'active');
  }
}

export const suppliers = new SuppliersStore();
