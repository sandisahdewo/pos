export type Unit = {
  id: string;
  name: string;
  code: string;
  description: string;
};

export type UnitInput = Omit<Unit, 'id'>;

const seed: Unit[] = [
  { id: 'unit_1', name: 'Pcs', code: 'pcs', description: 'Dijual satuan.' },
  { id: 'unit_2', name: 'Box', code: 'box', description: 'Dikemas dalam box (jumlah bervariasi).' },
  { id: 'unit_3', name: 'Kilogram', code: 'kg', description: '1.000 gram berdasarkan berat.' },
  { id: 'unit_4', name: 'Gram', code: 'g', description: 'Satu gram berdasarkan berat.' },
  { id: 'unit_5', name: 'Liter', code: 'L', description: '1.000 mililiter berdasarkan volume.' },
  { id: 'unit_6', name: 'Mililiter', code: 'mL', description: 'Seperseribu liter.' },
  { id: 'unit_7', name: 'Lusin', code: 'lusin', description: 'Satuan tradisional 12 pcs (tekstil/garmen).' },
  { id: 'unit_8', name: 'Kodi', code: 'kodi', description: 'Satuan tradisional 20 pcs (tekstil/garmen).' },
  { id: 'unit_9', name: 'Gross', code: 'gross', description: 'Satuan tradisional 144 pcs (12 lusin).' },
  { id: 'unit_10', name: 'Batang', code: 'btg', description: 'Satuan rokok terkecil — satu batang.' },
  { id: 'unit_11', name: 'Bungkus', code: 'bks', description: 'Pak rokok. Isi bervariasi per merek (mis. 12, 16, atau 20 batang).' },
  { id: 'unit_12', name: 'Slop', code: 'slop', description: 'Karton rokok berisi 10 bungkus.' }
];

class UnitsStore {
  items = $state<Unit[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: UnitInput): Unit {
    const unit: Unit = { ...input, id: `unit_${this.nextId++}` };
    this.items.push(unit);
    return unit;
  }

  update(id: string, patch: Partial<UnitInput>): Unit | undefined {
    const idx = this.items.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string) {
    this.items = this.items.filter((u) => u.id !== id);
  }

  getById(id: string): Unit | undefined {
    return this.items.find((u) => u.id === id);
  }
}

export const units = new UnitsStore();
