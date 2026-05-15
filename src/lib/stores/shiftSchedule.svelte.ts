import { shiftTemplates } from './shiftTemplates.svelte';
import { employees } from './employees.svelte';

export type AssignmentStatus = 'planned' | 'completed' | 'absent' | 'replaced';

export type ShiftAssignment = {
  id: string;
  date: string;
  templateId: string;
  employeeId: string;
  notes: string;
  status: AssignmentStatus;
  actualShiftId?: string;
};

export type ShiftAssignmentInput = Omit<ShiftAssignment, 'id' | 'status'> & {
  status?: AssignmentStatus;
};

export type WeekdayPattern = {
  templateId: string;
  employeeId: string;
};

export const dayOfWeekLabels: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu'
};

export const dayOfWeekShort: Record<number, string> = {
  0: 'Min',
  1: 'Sen',
  2: 'Sel',
  3: 'Rab',
  4: 'Kam',
  5: 'Jum',
  6: 'Sab'
};

export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  planned: 'Terjadwal',
  completed: 'Selesai',
  absent: 'Tidak hadir',
  replaced: 'Digantikan'
};

export const assignmentStatusVariant: Record<
  AssignmentStatus,
  'info' | 'success' | 'danger' | 'warning'
> = {
  planned: 'info',
  completed: 'success',
  absent: 'danger',
  replaced: 'warning'
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(d: Date): string {
  const yr = d.getFullYear();
  const mo = (d.getMonth() + 1).toString().padStart(2, '0');
  const da = d.getDate().toString().padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

class ShiftScheduleStore {
  items = $state<ShiftAssignment[]>([]);
  private nextId = 1;

  add(input: ShiftAssignmentInput): ShiftAssignment {
    const assignment: ShiftAssignment = {
      id: `sasg_${this.nextId++}`,
      status: input.status ?? 'planned',
      date: input.date,
      templateId: input.templateId,
      employeeId: input.employeeId,
      notes: input.notes,
      actualShiftId: input.actualShiftId
    };
    this.items.push(assignment);
    return assignment;
  }

  update(id: string, patch: Partial<ShiftAssignmentInput>): ShiftAssignment | undefined {
    const idx = this.items.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string): void {
    this.items = this.items.filter((a) => a.id !== id);
  }

  getById(id: string): ShiftAssignment | undefined {
    return this.items.find((a) => a.id === id);
  }

  forDate(date: string): ShiftAssignment[] {
    return this.items.filter((a) => a.date === date);
  }

  forRange(start: string, end: string): ShiftAssignment[] {
    return this.items
      .filter((a) => a.date >= start && a.date <= end)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  forEmployee(
    employeeId: string,
    opts?: { start?: string; end?: string }
  ): ShiftAssignment[] {
    return this.items.filter((a) => {
      if (a.employeeId !== employeeId) return false;
      if (opts?.start && a.date < opts.start) return false;
      if (opts?.end && a.date > opts.end) return false;
      return true;
    });
  }

  bulkGenerate(args: {
    startDate: string;
    endDate: string;
    pattern: Record<number, WeekdayPattern[]>;
    skipExisting?: boolean;
    notes?: string;
  }): { created: ShiftAssignment[]; skipped: number; invalid: number } {
    const start = parseISODate(args.startDate);
    const end = parseISODate(args.endDate);
    if (end < start) return { created: [], skipped: 0, invalid: 0 };

    const skipExisting = args.skipExisting ?? true;
    const created: ShiftAssignment[] = [];
    let skipped = 0;
    let invalid = 0;

    let cursor = start;
    while (cursor <= end) {
      const date = toISODate(cursor);
      const dow = cursor.getDay();
      const slots = args.pattern[dow] ?? [];
      for (const slot of slots) {
        if (!slot.templateId || !slot.employeeId) {
          invalid++;
          continue;
        }
        if (!shiftTemplates.getById(slot.templateId)) {
          invalid++;
          continue;
        }
        if (!employees.getById(slot.employeeId)) {
          invalid++;
          continue;
        }
        if (skipExisting) {
          const dup = this.items.find(
            (a) =>
              a.date === date &&
              a.templateId === slot.templateId &&
              a.employeeId === slot.employeeId
          );
          if (dup) {
            skipped++;
            continue;
          }
        }
        created.push(
          this.add({
            date,
            templateId: slot.templateId,
            employeeId: slot.employeeId,
            notes: args.notes ?? '',
            status: 'planned'
          })
        );
      }
      cursor = addDays(cursor, 1);
    }

    return { created, skipped, invalid };
  }

  removeRange(start: string, end: string): number {
    const before = this.items.length;
    this.items = this.items.filter((a) => a.date < start || a.date > end);
    return before - this.items.length;
  }

  markCompleted(assignmentId: string, shiftSessionId: string): ShiftAssignment | undefined {
    return this.update(assignmentId, {
      status: 'completed',
      actualShiftId: shiftSessionId
    });
  }
}

export const shiftSchedule = new ShiftScheduleStore();

export { toISODate, parseISODate, addDays };
