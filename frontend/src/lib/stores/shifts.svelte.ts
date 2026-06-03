import { employees } from './employees.svelte';
import { orders } from './orders.svelte';
import {
  listShiftSessions,
  createShiftSession,
  updateShiftSession
} from '$lib/api/shifts';

export type ShiftStatus = 'open' | 'closed' | 'cancelled';

export type CashEntryKind = 'in' | 'out';

export type CashEntryCategory =
  | 'modal-tambahan'
  | 'setoran-owner'
  | 'beli-bahan'
  | 'operasional'
  | 'transportasi'
  | 'gaji-harian'
  | 'kebersihan'
  | 'lain';

export const cashEntryCategoryLabels: Record<CashEntryCategory, string> = {
  'modal-tambahan': 'Modal tambahan',
  'setoran-owner': 'Setoran pemilik',
  'beli-bahan': 'Beli bahan',
  operasional: 'Operasional (gas, es, listrik)',
  transportasi: 'Transportasi / parkir',
  'gaji-harian': 'Gaji harian',
  kebersihan: 'Kebersihan / sampah',
  lain: 'Lain-lain'
};

export const cashInCategories: CashEntryCategory[] = [
  'modal-tambahan',
  'setoran-owner',
  'lain'
];

export const cashOutCategories: CashEntryCategory[] = [
  'beli-bahan',
  'operasional',
  'transportasi',
  'gaji-harian',
  'kebersihan',
  'lain'
];

export type CashDenomination = {
  unit: number;
  count: number;
};

export const IDR_DENOMINATIONS: number[] = [
  100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100
];

export type CashCount = {
  total: number;
  denominations?: CashDenomination[];
};

export type CashEntry = {
  id: string;
  at: string;
  kind: CashEntryKind;
  category: CashEntryCategory;
  amount: number;
  notes: string;
  performedBy: string;
};

export type ShiftSession = {
  id: string;
  code: string;
  employeeId: string;
  templateId?: string;
  openedAt: string;
  closedAt?: string;
  status: ShiftStatus;
  openingCash: CashCount;
  closingCash?: CashCount;
  expectedClosingCash?: number;
  variance?: number;
  entries: CashEntry[];
  notes: string;
};

export function denominationTotal(denoms?: CashDenomination[]): number {
  if (!denoms) return 0;
  return denoms.reduce((sum, d) => sum + d.unit * d.count, 0);
}

export function emptyCashCount(): CashCount {
  return { total: 0, denominations: undefined };
}

export function cashSalesIn(shift: ShiftSession): number {
  const start = new Date(shift.openedAt).getTime();
  const end = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();
  let total = 0;
  for (const o of orders.items) {
    if (o.status === 'cancelled') continue;
    for (const p of o.payments) {
      if (p.method !== 'cash') continue;
      const t = new Date(p.at).getTime();
      if (Number.isNaN(t)) continue;
      if (t < start || t > end) continue;
      if (o.shiftId && o.shiftId !== shift.id) continue;
      total += p.amount;
    }
  }
  return total;
}

export function ordersIn(shift: ShiftSession) {
  const start = new Date(shift.openedAt).getTime();
  const end = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();
  return orders.items.filter((o) => {
    if (o.status === 'cancelled') return false;
    if (o.shiftId && o.shiftId !== shift.id) return false;
    const t = new Date(o.createdAt).getTime();
    if (Number.isNaN(t)) return false;
    return t >= start && t <= end;
  });
}

export type ShiftSalesSummary = {
  orderCount: number;
  grossTotal: number;
  byMethod: Record<'cash' | 'card' | 'qris' | 'transfer', number>;
  outstandingCredit: number;
};

export function salesSummary(shift: ShiftSession): ShiftSalesSummary {
  const matching = ordersIn(shift);
  const byMethod: ShiftSalesSummary['byMethod'] = { cash: 0, card: 0, qris: 0, transfer: 0 };
  let grossTotal = 0;
  let outstandingCredit = 0;
  for (const o of matching) {
    grossTotal += o.total;
    if (o.status === 'credit') outstandingCredit += o.total - o.paidAmount;
    for (const p of o.payments) {
      const t = new Date(p.at).getTime();
      const start = new Date(shift.openedAt).getTime();
      const end = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();
      if (Number.isNaN(t) || t < start || t > end) continue;
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    }
  }
  return { orderCount: matching.length, grossTotal, byMethod, outstandingCredit };
}

export function expectedClosingCash(shift: ShiftSession): number {
  let total = shift.openingCash.total;
  total += cashSalesIn(shift);
  for (const e of shift.entries) {
    if (e.kind === 'in') total += e.amount;
    else total -= e.amount;
  }
  return total;
}

function normalizeShift(raw: unknown): ShiftSession {
  const r = raw as Partial<ShiftSession> & Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    employeeId: String(r.employeeId ?? ''),
    templateId: (r.templateId as string | undefined) || undefined,
    openedAt: String(r.openedAt ?? ''),
    closedAt: (r.closedAt as string | undefined) || undefined,
    status: (r.status ?? 'open') as ShiftStatus,
    openingCash: (r.openingCash as CashCount) ?? { total: 0 },
    closingCash: (r.closingCash as CashCount | undefined) || undefined,
    expectedClosingCash: (r.expectedClosingCash as number | undefined) ?? undefined,
    variance: (r.variance as number | undefined) ?? undefined,
    entries: ((r.entries as CashEntry[] | undefined) ?? []).map((e) => ({
      id: e.id,
      at: e.at,
      kind: e.kind,
      category: e.category,
      amount: Number(e.amount ?? 0),
      notes: e.notes ?? '',
      performedBy: e.performedBy ?? ''
    })),
    notes: (r.notes ?? '') as string
  };
}

function toPayload(s: Partial<ShiftSession>): Record<string, unknown> {
  return {
    employeeId: s.employeeId,
    templateId: s.templateId || null,
    openedAt: s.openedAt,
    closedAt: s.closedAt || null,
    status: s.status ?? 'open',
    openingCash: s.openingCash ?? { total: 0 },
    closingCash: s.closingCash ?? null,
    expectedClosingCash: s.expectedClosingCash ?? null,
    variance: s.variance ?? null,
    notes: s.notes ?? '',
    entries: (s.entries ?? []).map((e) => ({
      id: e.id,
      at: e.at,
      kind: e.kind,
      category: e.category,
      amount: e.amount,
      notes: e.notes,
      performedBy: e.performedBy
    }))
  };
}

class ShiftsStore {
  items = $state<ShiftSession[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listShiftSessions();
      this.items = list.map(normalizeShift);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  active(): ShiftSession | undefined {
    return this.items.find((s) => s.status === 'open');
  }

  getById(id: string): ShiftSession | undefined {
    return this.items.find((s) => s.id === id);
  }

  /** Most recently closed shift for an employee (excludes cancelled). */
  lastClosedFor(employeeId: string): ShiftSession | undefined {
    let best: ShiftSession | undefined;
    for (const s of this.items) {
      if (s.employeeId !== employeeId) continue;
      if (s.status !== 'closed') continue;
      if (!s.closedAt) continue;
      if (!best || s.closedAt > (best.closedAt ?? '')) best = s;
    }
    return best;
  }

  async open(args: {
    employeeId: string;
    templateId?: string;
    openingCash: CashCount;
    notes?: string;
    at?: string;
  }): Promise<{ ok: true; shift: ShiftSession } | { ok: false; reason: string }> {
    const emp = employees.getById(args.employeeId);
    if (!emp) return { ok: false, reason: 'Pegawai tidak ditemukan.' };
    if (emp.status !== 'active') return { ok: false, reason: 'Pegawai tidak aktif.' };
    if (this.active()) return { ok: false, reason: 'Masih ada shift terbuka. Tutup dulu shift sebelumnya.' };
    if (args.openingCash.total < 0) return { ok: false, reason: 'Kas awal tidak boleh negatif.' };
    try {
      const created = await createShiftSession({
        employeeId: args.employeeId,
        templateId: args.templateId || null,
        openedAt: args.at ?? new Date().toISOString(),
        status: 'open',
        openingCash: args.openingCash,
        notes: args.notes ?? '',
        entries: []
      });
      const shift = normalizeShift(created);
      this.items = [shift, ...this.items];
      return { ok: true, shift };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Gagal membuka shift.';
      return { ok: false, reason };
    }
  }

  async addEntry(
    shiftId: string,
    input: Omit<CashEntry, 'id' | 'at'> & { at?: string }
  ): Promise<{ ok: true; entry: CashEntry } | { ok: false; reason: string }> {
    const shift = this.getById(shiftId);
    if (!shift) return { ok: false, reason: 'Shift tidak ditemukan.' };
    if (shift.status !== 'open') return { ok: false, reason: 'Shift sudah tutup.' };
    if (input.amount <= 0) return { ok: false, reason: 'Jumlah harus lebih dari nol.' };
    const entry: CashEntry = {
      id: crypto.randomUUID(),
      at: input.at ?? new Date().toISOString(),
      kind: input.kind,
      category: input.category,
      amount: input.amount,
      notes: input.notes,
      performedBy: input.performedBy
    };
    try {
      const updated = await updateShiftSession(
        shiftId,
        toPayload({ ...shift, entries: [...shift.entries, entry] })
      );
      const s = normalizeShift(updated);
      this.items = this.items.map((x) => (x.id === shiftId ? s : x));
      const last = s.entries[s.entries.length - 1] ?? entry;
      return { ok: true, entry: last };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Gagal menambah catatan.';
      return { ok: false, reason };
    }
  }

  async removeEntry(shiftId: string, entryId: string): Promise<{ ok: boolean; reason?: string }> {
    const shift = this.getById(shiftId);
    if (!shift) return { ok: false, reason: 'Shift tidak ditemukan.' };
    if (shift.status !== 'open') return { ok: false, reason: 'Shift sudah tutup, tidak bisa diubah.' };
    const before = shift.entries.length;
    const nextEntries = shift.entries.filter((e) => e.id !== entryId);
    if (nextEntries.length === before) return { ok: false };
    try {
      const updated = await updateShiftSession(shiftId, toPayload({ ...shift, entries: nextEntries }));
      const s = normalizeShift(updated);
      this.items = this.items.map((x) => (x.id === shiftId ? s : x));
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Gagal.' };
    }
  }

  async close(
    shiftId: string,
    args: { closingCash: CashCount; notes?: string; at?: string }
  ): Promise<{ ok: true; shift: ShiftSession } | { ok: false; reason: string }> {
    const shift = this.getById(shiftId);
    if (!shift) return { ok: false, reason: 'Shift tidak ditemukan.' };
    if (shift.status !== 'open') return { ok: false, reason: 'Shift bukan dalam status terbuka.' };
    if (args.closingCash.total < 0) return { ok: false, reason: 'Kas akhir tidak boleh negatif.' };
    const closedAt = args.at ?? new Date().toISOString();
    const expected = expectedClosingCash(shift);
    const variance = args.closingCash.total - expected;
    try {
      const updated = await updateShiftSession(
        shiftId,
        toPayload({
          ...shift,
          status: 'closed',
          closedAt,
          closingCash: args.closingCash,
          expectedClosingCash: expected,
          variance,
          notes: args.notes ?? shift.notes
        })
      );
      const s = normalizeShift(updated);
      this.items = this.items.map((x) => (x.id === shiftId ? s : x));
      return { ok: true, shift: s };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Gagal menutup shift.' };
    }
  }

  async cancel(shiftId: string): Promise<{ ok: boolean; reason?: string }> {
    const shift = this.getById(shiftId);
    if (!shift) return { ok: false, reason: 'Shift tidak ditemukan.' };
    if (shift.status !== 'open') return { ok: false, reason: 'Hanya shift terbuka yang bisa dibatalkan.' };
    try {
      const updated = await updateShiftSession(
        shiftId,
        toPayload({ ...shift, status: 'cancelled', closedAt: new Date().toISOString() })
      );
      const s = normalizeShift(updated);
      this.items = this.items.map((x) => (x.id === shiftId ? s : x));
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Gagal.' };
    }
  }
}

export const shifts = new ShiftsStore();

export const shiftStatusLabels: Record<ShiftStatus, string> = {
  open: 'Terbuka',
  closed: 'Selesai',
  cancelled: 'Dibatalkan'
};

export const shiftStatusVariant: Record<
  ShiftStatus,
  'success' | 'neutral' | 'danger'
> = {
  open: 'success',
  closed: 'neutral',
  cancelled: 'danger'
};

export function shiftDurationHours(s: ShiftSession): number {
  const start = new Date(s.openedAt).getTime();
  const end = s.closedAt ? new Date(s.closedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round(((end - start) / (60 * 60 * 1000)) * 10) / 10;
}

export function formatDuration(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins} menit`;
  }
  return `${hours} jam`;
}
