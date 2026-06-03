import {
  listShiftTemplates,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
  type ApiShiftTemplate,
  type ShiftTemplateInput as ApiShiftTemplateInput
} from '$lib/api/shift-templates';

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

function toTemplate(t: ApiShiftTemplate): ShiftTemplate {
  return {
    id: t.id,
    name: t.name,
    startTime: t.startTime,
    endTime: t.endTime,
    notes: t.notes,
    status: t.status
  };
}

function toApiInput(t: ShiftTemplateInput): ApiShiftTemplateInput {
  return {
    name: t.name,
    startTime: t.startTime,
    endTime: t.endTime,
    notes: t.notes,
    status: t.status
  };
}

class ShiftTemplatesStore {
  items = $state<ShiftTemplate[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listShiftTemplates();
      this.items = list.map(toTemplate);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: ShiftTemplateInput): Promise<ShiftTemplate> {
    const created = await createShiftTemplate(toApiInput(input));
    const t = toTemplate(created);
    this.items = [...this.items, t];
    return t;
  }

  async update(id: string, patch: Partial<ShiftTemplateInput>): Promise<ShiftTemplate | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const merged: ShiftTemplateInput = {
      name: patch.name ?? current.name,
      startTime: patch.startTime ?? current.startTime,
      endTime: patch.endTime ?? current.endTime,
      notes: patch.notes ?? current.notes,
      status: patch.status ?? current.status
    };
    const updated = await updateShiftTemplate(id, toApiInput(merged));
    const t = toTemplate(updated);
    this.items = this.items.map((x) => (x.id === id ? t : x));
    return t;
  }

  async remove(id: string): Promise<void> {
    await deleteShiftTemplate(id);
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
