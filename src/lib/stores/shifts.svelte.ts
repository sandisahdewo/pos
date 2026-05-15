import { employees } from './employees.svelte';
import { orders } from './orders.svelte';
import { shiftTemplates } from './shiftTemplates.svelte';

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

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

function todayCode(seq: number): string {
  const year = new Date().getFullYear();
  return `SHF-${year}-${pad3(seq)}`;
}

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

class ShiftsStore {
  items = $state<ShiftSession[]>([]);
  private nextId = 1;
  private nextCodeNum = 1;

  active(): ShiftSession | undefined {
    return this.items.find((s) => s.status === 'open');
  }

  getById(id: string): ShiftSession | undefined {
    return this.items.find((s) => s.id === id);
  }

  open(args: {
    employeeId: string;
    templateId?: string;
    openingCash: CashCount;
    notes?: string;
    at?: string;
  }): { ok: true; shift: ShiftSession } | { ok: false; reason: string } {
    const emp = employees.getById(args.employeeId);
    if (!emp) return { ok: false, reason: 'Pegawai tidak ditemukan.' };
    if (emp.status !== 'active') return { ok: false, reason: 'Pegawai tidak aktif.' };
    if (this.active()) return { ok: false, reason: 'Masih ada shift terbuka. Tutup dulu shift sebelumnya.' };
    if (args.templateId) {
      const tpl = shiftTemplates.getById(args.templateId);
      if (!tpl) return { ok: false, reason: 'Template shift tidak ditemukan.' };
    }
    if (args.openingCash.total < 0) return { ok: false, reason: 'Kas awal tidak boleh negatif.' };
    const shift: ShiftSession = {
      id: `shf_${this.nextId++}`,
      code: todayCode(this.nextCodeNum++),
      employeeId: args.employeeId,
      templateId: args.templateId,
      openedAt: args.at ?? new Date().toISOString(),
      status: 'open',
      openingCash: args.openingCash,
      entries: [],
      notes: args.notes ?? ''
    };
    this.items.push(shift);
    return { ok: true, shift };
  }

  addEntry(
    shiftId: string,
    input: Omit<CashEntry, 'id' | 'at'> & { at?: string }
  ): { ok: true; entry: CashEntry } | { ok: false; reason: string } {
    const shift = this.getById(shiftId);
    if (!shift) return { ok: false, reason: 'Shift tidak ditemukan.' };
    if (shift.status !== 'open') return { ok: false, reason: 'Shift sudah tutup.' };
    if (input.amount <= 0) return { ok: false, reason: 'Jumlah harus lebih dari nol.' };
    const entry: CashEntry = {
      id: `cse_${crypto.randomUUID().slice(0, 8)}`,
      at: input.at ?? new Date().toISOString(),
      kind: input.kind,
      category: input.category,
      amount: input.amount,
      notes: input.notes,
      performedBy: input.performedBy
    };
    shift.entries.push(entry);
    return { ok: true, entry };
  }

  removeEntry(shiftId: string, entryId: string): { ok: boolean; reason?: string } {
    const shift = this.getById(shiftId);
    if (!shift) return { ok: false, reason: 'Shift tidak ditemukan.' };
    if (shift.status !== 'open') return { ok: false, reason: 'Shift sudah tutup, tidak bisa diubah.' };
    const before = shift.entries.length;
    shift.entries = shift.entries.filter((e) => e.id !== entryId);
    return { ok: shift.entries.length < before };
  }

  close(
    shiftId: string,
    args: { closingCash: CashCount; notes?: string; at?: string }
  ): { ok: true; shift: ShiftSession } | { ok: false; reason: string } {
    const shift = this.getById(shiftId);
    if (!shift) return { ok: false, reason: 'Shift tidak ditemukan.' };
    if (shift.status !== 'open') return { ok: false, reason: 'Shift bukan dalam status terbuka.' };
    if (args.closingCash.total < 0) return { ok: false, reason: 'Kas akhir tidak boleh negatif.' };
    shift.closedAt = args.at ?? new Date().toISOString();
    shift.status = 'closed';
    shift.closingCash = args.closingCash;
    shift.expectedClosingCash = expectedClosingCash(shift);
    shift.variance = args.closingCash.total - shift.expectedClosingCash;
    if (args.notes) shift.notes = args.notes;
    return { ok: true, shift };
  }

  cancel(shiftId: string): { ok: boolean; reason?: string } {
    const shift = this.getById(shiftId);
    if (!shift) return { ok: false, reason: 'Shift tidak ditemukan.' };
    if (shift.status !== 'open') return { ok: false, reason: 'Hanya shift terbuka yang bisa dibatalkan.' };
    shift.status = 'cancelled';
    shift.closedAt = new Date().toISOString();
    return { ok: true };
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
