export type ShiftTemplateStatus = 'active' | 'archived';

export type ShiftTemplate = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  notes: string;
  status: ShiftTemplateStatus;
};

export type ShiftTemplateInput = Omit<ShiftTemplate, 'id'>;

const seed: ShiftTemplate[] = [
  {
    id: 'shf_tpl_1',
    name: 'Pagi',
    startTime: '06:00',
    endTime: '14:00',
    notes: 'Buka toko, sarapan, makan siang awal.',
    status: 'active'
  },
  {
    id: 'shf_tpl_2',
    name: 'Sore',
    startTime: '14:00',
    endTime: '22:00',
    notes: 'Makan siang lanjutan, jam pulang kantor, makan malam.',
    status: 'active'
  },
  {
    id: 'shf_tpl_3',
    name: 'Malam',
    startTime: '22:00',
    endTime: '06:00',
    notes: 'Pelanggan begadang, ojol shift malam.',
    status: 'active'
  }
];

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function plannedDurationHours(t: { startTime: string; endTime: string }): number {
  const start = timeToMinutes(t.startTime);
  const end = timeToMinutes(t.endTime);
  const diff = end >= start ? end - start : end + 24 * 60 - start;
  return Math.round((diff / 60) * 10) / 10;
}

export function formatShiftRange(t: { startTime: string; endTime: string }): string {
  return `${t.startTime}–${t.endTime}`;
}

class ShiftTemplatesStore {
  items = $state<ShiftTemplate[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: ShiftTemplateInput): ShiftTemplate {
    const tpl: ShiftTemplate = { ...input, id: `shf_tpl_${this.nextId++}` };
    this.items.push(tpl);
    return tpl;
  }

  update(id: string, patch: Partial<ShiftTemplateInput>): ShiftTemplate | undefined {
    const idx = this.items.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string) {
    this.items = this.items.filter((t) => t.id !== id);
  }

  getById(id: string): ShiftTemplate | undefined {
    return this.items.find((t) => t.id === id);
  }

  active(): ShiftTemplate[] {
    return this.items.filter((t) => t.status === 'active');
  }
}

export const shiftTemplates = new ShiftTemplatesStore();
