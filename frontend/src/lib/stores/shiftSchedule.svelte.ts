import { shiftTemplates, type ShiftTemplate } from './shiftTemplates.svelte';
import {
  listShiftAssignments,
  createShiftAssignment,
  updateShiftAssignment,
  deleteShiftAssignment,
  bulkShiftAssignments,
  type ApiShiftAssignment,
  type ShiftAssignmentInput as ApiShiftAssignmentInput
} from '$lib/api/shift-assignments';

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
  0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu'
};

export const dayOfWeekShort: Record<number, string> = {
  0: 'Min', 1: 'Sen', 2: 'Sel', 3: 'Rab', 4: 'Kam', 5: 'Jum', 6: 'Sab'
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

function toAssignment(a: ApiShiftAssignment): ShiftAssignment {
  return {
    id: a.id,
    date: a.date,
    templateId: a.templateId,
    employeeId: a.employeeId,
    notes: a.notes,
    status: a.status,
    actualShiftId: a.actualShiftId
  };
}

function toApiInput(a: ShiftAssignmentInput): ApiShiftAssignmentInput {
  return {
    date: a.date,
    templateId: a.templateId,
    employeeId: a.employeeId,
    notes: a.notes,
    status: a.status,
    actualShiftId: a.actualShiftId ?? null
  };
}

class ShiftScheduleStore {
  items = $state<ShiftAssignment[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listShiftAssignments();
      this.items = list.map(toAssignment);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: ShiftAssignmentInput): Promise<ShiftAssignment> {
    const created = await createShiftAssignment(toApiInput(input));
    const a = toAssignment(created);
    this.items = [...this.items, a];
    return a;
  }

  async update(
    id: string,
    patch: Partial<ShiftAssignmentInput>
  ): Promise<ShiftAssignment | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const merged: ShiftAssignmentInput = {
      date: patch.date ?? current.date,
      templateId: patch.templateId ?? current.templateId,
      employeeId: patch.employeeId ?? current.employeeId,
      notes: patch.notes ?? current.notes,
      status: patch.status ?? current.status,
      actualShiftId: patch.actualShiftId ?? current.actualShiftId
    };
    const updated = await updateShiftAssignment(id, toApiInput(merged));
    const a = toAssignment(updated);
    this.items = this.items.map((x) => (x.id === id ? a : x));
    return a;
  }

  async remove(id: string): Promise<void> {
    await deleteShiftAssignment(id);
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

  // Bulk generate weekday-pattern assignments via backend's POST /bulk
  // endpoint, which ON CONFLICT DO NOTHING on the (date, template, employee)
  // unique. Returns counts so callers can show "X created, Y skipped".
  async bulkGenerate(args: {
    startDate: string;
    endDate: string;
    pattern: Record<number, WeekdayPattern[]>;
    notes?: string;
  }): Promise<{ created: number; skipped: number }> {
    const patternByString: Record<string, WeekdayPattern[]> = {};
    for (const [k, v] of Object.entries(args.pattern)) {
      patternByString[String(k)] = v;
    }
    const res = await bulkShiftAssignments({
      startDate: args.startDate,
      endDate: args.endDate,
      pattern: patternByString,
      notes: args.notes
    });
    await this.load();
    return res;
  }

  async removeRange(start: string, end: string): Promise<number> {
    const matching = this.items.filter((a) => a.date >= start && a.date <= end);
    let removed = 0;
    for (const a of matching) {
      try {
        await deleteShiftAssignment(a.id);
        removed++;
      } catch {
        // best-effort
      }
    }
    if (removed > 0) {
      const ids = new Set(matching.map((m) => m.id));
      this.items = this.items.filter((a) => !ids.has(a.id));
    }
    return removed;
  }

  async markCompleted(
    assignmentId: string,
    shiftSessionId: string
  ): Promise<ShiftAssignment | undefined> {
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
      matchedAssignment?: ShiftAssignment;
      matchedTemplate?: ShiftTemplate;
      todayAssignments: Array<{ assignment: ShiftAssignment; template: ShiftTemplate | undefined }>;
    }
  | {
      ok: false;
      reason: string;
      nextAssignment?: ShiftAssignment;
      nextTemplate?: ShiftTemplate;
      todayAssignments: Array<{ assignment: ShiftAssignment; template: ShiftTemplate | undefined }>;
    };

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
        return {
          ok: true,
          matchedAssignment: assignment,
          matchedTemplate: template,
          todayAssignments
        };
      }
    } else if (nowMin >= startMin - SHIFT_OPEN_GRACE_BEFORE_MIN && nowMin <= endMin) {
      return {
        ok: true,
        matchedAssignment: assignment,
        matchedTemplate: template,
        todayAssignments
      };
    }
  }

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
