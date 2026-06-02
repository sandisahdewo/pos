import {
  listUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  type ApiUnit,
  type UnitInput as ApiUnitInput
} from '$lib/api/units';

export type Unit = {
  id: string;
  name: string;
  code: string;
  description: string;
};

export type UnitInput = Omit<Unit, 'id'>;

function toUnit(u: ApiUnit): Unit {
  return {
    id: u.id,
    name: u.name,
    code: u.code,
    description: u.description
  };
}

function toApiInput(u: UnitInput): ApiUnitInput {
  return { name: u.name, code: u.code, description: u.description };
}

class UnitsStore {
  items = $state<Unit[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listUnits();
      this.items = list.map(toUnit);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: UnitInput): Promise<Unit> {
    const created = await createUnit(toApiInput(input));
    const u = toUnit(created);
    this.items = [...this.items, u];
    return u;
  }

  async update(id: string, patch: Partial<UnitInput>): Promise<Unit | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const next: UnitInput = {
      name: patch.name ?? current.name,
      code: patch.code ?? current.code,
      description: patch.description ?? current.description
    };
    const updated = await updateUnit(id, toApiInput(next));
    const u = toUnit(updated);
    this.items = this.items.map((x) => (x.id === id ? u : x));
    return u;
  }

  async remove(id: string): Promise<void> {
    await deleteUnit(id);
    this.items = this.items.filter((u) => u.id !== id);
  }

  getById(id: string): Unit | undefined {
    return this.items.find((u) => u.id === id);
  }
}

export const units = new UnitsStore();
