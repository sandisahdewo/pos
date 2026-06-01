import { shiftTemplates, type ShiftTemplate } from './shiftTemplates.svelte';
import { employees } from './employees.svelte';

/** Minutes a kasir is allowed to open their shift before its scheduled start time. */
export const SHIFT_OPEN_GRACE_BEFORE_MIN = 30;

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

function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export type ShiftOpenValidation =
  | {
      ok: true;
      /** Today's planned assignment whose window contains `now`, if any. */
      matchedAssignment?: ShiftAssignment;
      matchedTemplate?: ShiftTemplate;
      /** All of today's planned assignments for this employee (may be empty). */
      todayAssignments: Array<{ assignment: ShiftAssignment; template: ShiftTemplate | undefined }>;
    }
  | {
      ok: false;
      reason: string;
      /** Closest planned assignment that explains the rejection. */
      nextAssignment?: ShiftAssignment;
      nextTemplate?: ShiftTemplate;
      todayAssignments: Array<{ assignment: ShiftAssignment; template: ShiftTemplate | undefined }>;
    };

/**
 * Decide whether the given employee is allowed to open a shift right now.
 *
 * Rules:
 * - No planned assignment today → allowed (ad-hoc open).
 * - Planned assignment(s) today → must be within window [start − grace, end]; cross-midnight
 *   templates accept any time at-or-after start − grace on the schedule date.
 * - Otherwise rejected with a reason that names the next/last scheduled shift.
 */
export function validateShiftOpenForEmployee(
  employeeId: string,
  now: Date = new Date()
): ShiftOpenValidation {
  const today = toISODate(now);
  const planned = shiftSchedule.items.filter(
    (a) => a.employeeId === employeeId && a.date === today && a.status === 'planned'
  );
  const todayAssignments = planned.map((a) => ({
    assignment: a,
    template: shiftTemplates.getById(a.templateId)
  }));

  if (planned.length === 0) {
    return { ok: true, todayAssignments };
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const { assignment, template } of todayAssignments) {
    if (!template) continue;
    const startMin = timeToMin(template.startTime);
    const endMin = timeToMin(template.endTime);
    const crossesMidnight = endMin <= startMin;

    if (crossesMidnight) {
      if (nowMin >= startMin - SHIFT_OPEN_GRACE_BEFORE_MIN) {
        return { ok: true, matchedAssignment: assignment, matchedTemplate: template, todayAssignments };
      }
    } else if (nowMin >= startMin - SHIFT_OPEN_GRACE_BEFORE_MIN && nowMin <= endMin) {
      return { ok: true, matchedAssignment: assignment, matchedTemplate: template, todayAssignments };
    }
  }

  // Outside every window — find the next/last assignment to explain why.
  const sorted = todayAssignments
    .filter((x) => x.template)
    .map((x) => ({ ...x, startMin: timeToMin(x.template!.startTime) }))
    .sort((a, b) => a.startMin - b.startMin);

  const upcoming = sorted.find((u) => u.startMin > nowMin);
  if (upcoming) {
    return {
      ok: false,
      reason: `Anda dijadwalkan shift ${upcoming.template!.name} pukul ${upcoming.template!.startTime}–${upcoming.template!.endTime} hari ini. Buka shift bisa dilakukan paling cepat ${SHIFT_OPEN_GRACE_BEFORE_MIN} menit sebelum jam mulai.`,
      nextAssignment: upcoming.assignment,
      nextTemplate: upcoming.template,
      todayAssignments
    };
  }

  const last = sorted[sorted.length - 1];
  return {
    ok: false,
    reason: `Jadwal shift Anda hari ini (${last?.template?.name}, ${last?.template?.startTime}–${last?.template?.endTime}) sudah lewat. Hubungi admin jika perlu pengecualian.`,
    nextAssignment: last?.assignment,
    nextTemplate: last?.template,
    todayAssignments
  };
}

