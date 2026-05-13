export type PayoutMethod = 'cash' | 'transfer' | 'other';

export type Payout = {
  id: string;
  code: string;                // PAYOUT-YYYY-NNN
  supplierId: string;
  amount: number;              // IDR
  paidAt: string;              // ISO date (yyyy-mm-dd)
  method: PayoutMethod;
  coversPeriodStart: string;   // ISO date
  coversPeriodEnd: string;     // ISO date
  notes: string;
};

export type PayoutInput = Omit<Payout, 'id' | 'code'>;

// One seed payout so the History card isn't empty out of the box. Tied to sup_3
// (Studio Karya Lokal), matching the consignment-mug seed batches.
const seed: Payout[] = [
  {
    id: 'payout_1',
    code: 'PAYOUT-2026-001',
    supplierId: 'sup_3',
    amount: 200000,
    paidAt: '2026-04-30',
    method: 'transfer',
    coversPeriodStart: '2026-04-01',
    coversPeriodEnd: '2026-04-30',
    notes: 'Pembayaran awal untuk penjualan konsinyasi April.'
  }
];

function fmtCodeNumber(n: number): string {
  return n.toString().padStart(3, '0');
}

class PayoutsStore {
  items = $state<Payout[]>([...seed]);
  private nextId = seed.length + 1;
  private nextCodeNum = seed.length + 1;

  private generateCode(): string {
    const year = new Date().getFullYear();
    return `PAYOUT-${year}-${fmtCodeNumber(this.nextCodeNum++)}`;
  }

  add(input: PayoutInput): Payout {
    const payout: Payout = {
      ...input,
      id: `payout_${this.nextId++}`,
      code: this.generateCode()
    };
    this.items.push(payout);
    return payout;
  }

  remove(id: string): boolean {
    const before = this.items.length;
    this.items = this.items.filter((p) => p.id !== id);
    return this.items.length < before;
  }

  getById(id: string): Payout | undefined {
    return this.items.find((p) => p.id === id);
  }

  // Sum of payouts already made to a supplier, optionally up to a cutoff date
  // (paidAt <= asOf). Used by the Outstanding column on the report.
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
