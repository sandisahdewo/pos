import { listPayouts, createPayout, deletePayout } from '$lib/api/payouts';

export type PayoutMethod = 'cash' | 'transfer' | 'other';

export type Payout = {
  id: string;
  code: string;
  supplierId: string;
  amount: number;
  paidAt: string;
  method: PayoutMethod;
  coversPeriodStart: string;
  coversPeriodEnd: string;
  notes: string;
};

export type PayoutInput = Omit<Payout, 'id' | 'code'>;

function normalizePayout(raw: unknown): Payout {
  const r = raw as Partial<Payout> & Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    supplierId: String(r.supplierId ?? ''),
    amount: Number(r.amount ?? 0),
    paidAt: (r.paidAt ?? '') as string,
    method: (r.method ?? 'cash') as PayoutMethod,
    coversPeriodStart: (r.coversPeriodStart ?? '') as string,
    coversPeriodEnd: (r.coversPeriodEnd ?? '') as string,
    notes: (r.notes ?? '') as string
  };
}

class PayoutsStore {
  items = $state<Payout[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listPayouts();
      this.items = list.map(normalizePayout);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: PayoutInput): Promise<Payout> {
    const created = await createPayout({
      supplierId: input.supplierId,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method,
      coversPeriodStart: input.coversPeriodStart,
      coversPeriodEnd: input.coversPeriodEnd,
      notes: input.notes
    });
    const p = normalizePayout(created);
    this.items = [...this.items, p];
    return p;
  }

  async remove(id: string): Promise<boolean> {
    try {
      await deletePayout(id);
      const before = this.items.length;
      this.items = this.items.filter((p) => p.id !== id);
      return this.items.length < before;
    } catch {
      return false;
    }
  }

  getById(id: string): Payout | undefined {
    return this.items.find((p) => p.id === id);
  }

  // Sum of payouts already made to a supplier, optionally up to a cutoff date.
  paidToSupplier(supplierId: string, asOf?: string): number {
    return this.items.reduce((s, p) => {
      if (p.supplierId !== supplierId) return s;
      if (asOf && p.paidAt > asOf) return s;
      return s + p.amount;
    }, 0);
  }

  countBySupplier(supplierId: string): number {
    return this.items.reduce((n, p) => (p.supplierId === supplierId ? n + 1 : n), 0);
  }
}

export const payouts = new PayoutsStore();

export const payoutMethodLabels: Record<PayoutMethod, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  other: 'Lainnya'
};

export const payoutMethodOptions: { value: PayoutMethod; label: string }[] = [
  { value: 'cash', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'other', label: 'Lainnya' }
];
