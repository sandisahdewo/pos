import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type ApiSupplier,
  type SupplierInput as ApiSupplierInput
} from '$lib/api/suppliers';

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

function toSupplier(s: ApiSupplier): Supplier {
  return {
    id: s.id,
    name: s.name,
    contactPerson: s.contactPerson,
    email: s.email,
    phone: s.phone,
    address: s.address,
    leadTimeDays: s.leadTimeDays,
    status: s.status,
    notes: s.notes
  };
}

function toApiInput(s: SupplierInput): ApiSupplierInput {
  return {
    name: s.name,
    contactPerson: s.contactPerson,
    email: s.email,
    phone: s.phone,
    address: s.address,
    leadTimeDays: s.leadTimeDays,
    status: s.status,
    notes: s.notes
  };
}

class SuppliersStore {
  items = $state<Supplier[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listSuppliers();
      this.items = list.map(toSupplier);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: SupplierInput): Promise<Supplier> {
    const created = await createSupplier(toApiInput(input));
    const s = toSupplier(created);
    this.items = [...this.items, s];
    return s;
  }

  async update(id: string, patch: SupplierInput): Promise<Supplier | undefined> {
    const updated = await updateSupplier(id, toApiInput(patch));
    const s = toSupplier(updated);
    this.items = this.items.map((x) => (x.id === id ? s : x));
    return s;
  }

  async remove(id: string): Promise<void> {
    await deleteSupplier(id);
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
