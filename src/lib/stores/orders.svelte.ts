import { products, type CompositeComponent } from './products.svelte';
import { batches, type BatchAllocation } from './batches.svelte';
import { stockMovements, type StockMovementReference } from './stockMovements.svelte';

export type OrderStatus = 'paid' | 'credit' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'qris' | 'transfer';

export type OrderPayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  at: string;        // ISO datetime
  notes: string;
};

export type OrderLineExtra = {
  extraId: string;
  name: string;
  priceDelta: number;
};

export type OrderLine = {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;          // snapshot
  variantName: string;          // snapshot, or ''
  unitId: string;               // chosen unit
  unitFactor: number;           // snapshot
  unitCode: string;             // snapshot, e.g. 'pc' or 'box'
  quantity: number;             // in chosen unit
  unitPrice: number;            // resolved sale price per chosen unit (after tier)
  extras: OrderLineExtra[];     // picked extras with snapshotted prices
  taxRatePct: number;           // snapshot of tax % at sale time
  lineSubtotal: number;         // = quantity × (unitPrice + sum extras)
  lineTax: number;              // = lineSubtotal × taxRatePct / 100
  lineTotal: number;            // = lineSubtotal + lineTax
  batchAllocations: BatchAllocation[];  // populated by applyOrderToStock at charge time
};

export type Order = {
  id: string;
  code: string;                 // ORD-YYYY-NNN
  pricelistId: string;
  customerId?: string;
  employeeId?: string;
  paymentMethod: PaymentMethod; // method used at charge time (first payment)
  lines: OrderLine[];
  subtotal: number;             // sum of line subtotals (pre-tax)
  taxTotal: number;             // sum of line tax
  total: number;                // subtotal + taxTotal
  paidAmount: number;           // cumulative payments received; total when fully paid
  payments: OrderPayment[];     // chronological list of partial payments (incl. initial)
  status: OrderStatus;          // 'credit' when paidAmount < total, 'paid' when full, 'cancelled' otherwise
  notes: string;
  createdAt: string;            // ISO datetime
};

export type OrderInput = Omit<Order, 'id' | 'code' | 'createdAt' | 'paidAmount' | 'payments'> & {
  paidAmount?: number;
  payments?: OrderPayment[];
};

function fmtCodeNumber(n: number): string {
  return n.toString().padStart(3, '0');
}

// Seed orders cover three scenarios:
// 1. Movement-referenced (ORD-001 cancelled + ORD-005..008 paid Telur/Daging) —
//    keeps the /stock-movements ledger links resolvable.
// 2. Paid consignment-mug sales (ORD-002/003/004/009/010/011/012) — drives the
//    /payouts owedMap (sup_3 has Rp 510k owed).
// 3. Credit orders (ORD-013/014) — drives /piutang.
// Batch qtyRemaining in batches.svelte.ts is the final state AFTER these
// hypothetical sales already happened (e.g., batch_4 13/18, batch_5 8/12).

const seed: Order[] = [
  // === 1. Cancelled order — referenced by mov_seed_2 + mov_seed_3 ===
  {
    id: 'ord_seed_cancelled',
    code: 'ORD-2026-001',
    pricelistId: 'pl_retail',
    paymentMethod: 'cash',
    lines: [
      {
        id: 'orl_s1_1',
        productId: 'prd_1',
        productName: 'Espresso',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 10,
        unitPrice: 25000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 250000,
        lineTax: 27500,
        lineTotal: 277500,
        batchAllocations: [
          { batchId: 'batch_1', qtyTaken: 10, ownership: 'owned', unitCost: 5000, supplierId: 'sup_1' }
        ]
      }
    ],
    subtotal: 250000,
    taxTotal: 27500,
    total: 277500,
    paidAmount: 277500,
    payments: [],
    status: 'cancelled',
    notes: 'Dibatalkan pelanggan tidak lama setelah pembelian.',
    createdAt: '2026-05-05T14:22:00.000Z'
  },

  // === 2. Paid consignment-mug sales (drive /payouts owedMap[sup_3]) ===
  {
    id: 'ord_seed_2',
    code: 'ORD-2026-002',
    pricelistId: 'pl_vip',
    customerId: 'cust_1',
    paymentMethod: 'cash',
    lines: [
      {
        id: 'orl_s2_1',
        productId: 'prd_4',
        variantId: 'v_1',
        productName: 'Logo Mug 12oz',
        variantName: 'White',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 2,
        unitPrice: 120000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 240000,
        lineTax: 26400,
        lineTotal: 266400,
        batchAllocations: [
          { batchId: 'batch_4', qtyTaken: 2, ownership: 'consignment', unitCost: 50000, supplierId: 'sup_3' }
        ]
      }
    ],
    subtotal: 240000,
    taxTotal: 26400,
    total: 266400,
    paidAmount: 266400,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-04-25T10:30:00.000Z'
  },
  {
    id: 'ord_seed_3',
    code: 'ORD-2026-003',
    pricelistId: 'pl_wholesale',
    customerId: 'cust_2',
    paymentMethod: 'transfer',
    lines: [
      {
        id: 'orl_s3_1',
        productId: 'prd_4',
        variantId: 'v_2',
        productName: 'Logo Mug 12oz',
        variantName: 'Black',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 1,
        unitPrice: 110000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 110000,
        lineTax: 12100,
        lineTotal: 122100,
        batchAllocations: [
          { batchId: 'batch_5', qtyTaken: 1, ownership: 'consignment', unitCost: 50000, supplierId: 'sup_3' }
        ]
      }
    ],
    subtotal: 110000,
    taxTotal: 12100,
    total: 122100,
    paidAmount: 122100,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-04-28T13:15:00.000Z'
  },
  {
    id: 'ord_seed_4',
    code: 'ORD-2026-004',
    pricelistId: 'pl_retail',
    paymentMethod: 'qris',
    lines: [
      {
        id: 'orl_s4_1',
        productId: 'prd_4',
        variantId: 'v_1',
        productName: 'Logo Mug 12oz',
        variantName: 'White',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 1,
        unitPrice: 120000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 120000,
        lineTax: 13200,
        lineTotal: 133200,
        batchAllocations: [
          { batchId: 'batch_4', qtyTaken: 1, ownership: 'consignment', unitCost: 50000, supplierId: 'sup_3' }
        ]
      }
    ],
    subtotal: 120000,
    taxTotal: 13200,
    total: 133200,
    paidAmount: 133200,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-05-05T11:00:00.000Z'
  },

  // === Paid bahan-segar sales — referenced by movements seed ===
  {
    id: 'ord_seed_5',
    code: 'ORD-2026-005',
    pricelistId: 'pl_retail',
    paymentMethod: 'cash',
    lines: [
      {
        id: 'orl_s5_1',
        productId: 'prd_8',
        productName: 'Telur Ayam',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 8,
        unitPrice: 3500,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 28000,
        lineTax: 0,
        lineTotal: 28000,
        batchAllocations: [
          { batchId: 'batch_8', qtyTaken: 8, ownership: 'owned', unitCost: 2500, supplierId: 'sup_2' }
        ]
      }
    ],
    subtotal: 28000,
    taxTotal: 0,
    total: 28000,
    paidAmount: 28000,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-05-09T08:45:00.000Z'
  },
  {
    id: 'ord_seed_6',
    code: 'ORD-2026-006',
    pricelistId: 'pl_retail',
    paymentMethod: 'cash',
    lines: [
      {
        id: 'orl_s6_1',
        productId: 'prd_8',
        productName: 'Telur Ayam',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 5,
        unitPrice: 3500,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 17500,
        lineTax: 0,
        lineTotal: 17500,
        batchAllocations: [
          { batchId: 'batch_8', qtyTaken: 5, ownership: 'owned', unitCost: 2500, supplierId: 'sup_2' }
        ]
      }
    ],
    subtotal: 17500,
    taxTotal: 0,
    total: 17500,
    paidAmount: 17500,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-05-10T10:20:00.000Z'
  },
  {
    id: 'ord_seed_7',
    code: 'ORD-2026-007',
    pricelistId: 'pl_retail',
    paymentMethod: 'qris',
    lines: [
      {
        id: 'orl_s7_1',
        productId: 'prd_9',
        productName: 'Daging Sapi Cincang',
        variantName: '',
        unitId: 'unit_4',
        unitFactor: 1,
        unitCode: 'g',
        quantity: 150,
        unitPrice: 150,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 22500,
        lineTax: 0,
        lineTotal: 22500,
        batchAllocations: [
          { batchId: 'batch_11', qtyTaken: 150, ownership: 'owned', unitCost: 130, supplierId: 'sup_2' }
        ]
      }
    ],
    subtotal: 22500,
    taxTotal: 0,
    total: 22500,
    paidAmount: 22500,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-05-13T11:15:00.000Z'
  },
  {
    id: 'ord_seed_8',
    code: 'ORD-2026-008',
    pricelistId: 'pl_retail',
    paymentMethod: 'cash',
    lines: [
      {
        id: 'orl_s8_1',
        productId: 'prd_9',
        productName: 'Daging Sapi Cincang',
        variantName: '',
        unitId: 'unit_4',
        unitFactor: 1,
        unitCode: 'g',
        quantity: 200,
        unitPrice: 150,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 30000,
        lineTax: 0,
        lineTotal: 30000,
        batchAllocations: [
          { batchId: 'batch_11', qtyTaken: 200, ownership: 'owned', unitCost: 130, supplierId: 'sup_2' }
        ]
      }
    ],
    subtotal: 30000,
    taxTotal: 0,
    total: 30000,
    paidAmount: 30000,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-05-14T09:30:00.000Z'
  },

  // === More consignment mug sales ===
  {
    id: 'ord_seed_9',
    code: 'ORD-2026-009',
    pricelistId: 'pl_wholesale',
    customerId: 'cust_3',
    paymentMethod: 'transfer',
    lines: [
      {
        id: 'orl_s9_1',
        productId: 'prd_4',
        variantId: 'v_2',
        productName: 'Logo Mug 12oz',
        variantName: 'Black',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 2,
        unitPrice: 110000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 220000,
        lineTax: 24200,
        lineTotal: 244200,
        batchAllocations: [
          { batchId: 'batch_5', qtyTaken: 2, ownership: 'consignment', unitCost: 50000, supplierId: 'sup_3' }
        ]
      }
    ],
    subtotal: 220000,
    taxTotal: 24200,
    total: 244200,
    paidAmount: 244200,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-05-08T15:42:00.000Z'
  },
  {
    id: 'ord_seed_10',
    code: 'ORD-2026-010',
    pricelistId: 'pl_vip',
    customerId: 'cust_1',
    paymentMethod: 'qris',
    lines: [
      {
        id: 'orl_s10_1',
        productId: 'prd_4',
        variantId: 'v_3',
        productName: 'Logo Mug 12oz',
        variantName: 'Brand Blue',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 1,
        unitPrice: 150000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 150000,
        lineTax: 16500,
        lineTotal: 166500,
        batchAllocations: [
          { batchId: 'batch_6', qtyTaken: 1, ownership: 'consignment', unitCost: 60000, supplierId: 'sup_3' }
        ]
      }
    ],
    subtotal: 150000,
    taxTotal: 16500,
    total: 166500,
    paidAmount: 166500,
    payments: [],
    status: 'paid',
    notes: 'Edisi premium, hadiah ulang tahun.',
    createdAt: '2026-05-10T16:20:00.000Z'
  },
  {
    id: 'ord_seed_11',
    code: 'ORD-2026-011',
    pricelistId: 'pl_retail',
    paymentMethod: 'cash',
    lines: [
      {
        id: 'orl_s11_1',
        productId: 'prd_4',
        variantId: 'v_1',
        productName: 'Logo Mug 12oz',
        variantName: 'White',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 2,
        unitPrice: 120000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 240000,
        lineTax: 26400,
        lineTotal: 266400,
        batchAllocations: [
          { batchId: 'batch_4', qtyTaken: 2, ownership: 'consignment', unitCost: 50000, supplierId: 'sup_3' }
        ]
      }
    ],
    subtotal: 240000,
    taxTotal: 26400,
    total: 266400,
    paidAmount: 266400,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-05-12T12:00:00.000Z'
  },
  {
    id: 'ord_seed_12',
    code: 'ORD-2026-012',
    pricelistId: 'pl_wholesale',
    customerId: 'cust_2',
    paymentMethod: 'transfer',
    lines: [
      {
        id: 'orl_s12_1',
        productId: 'prd_4',
        variantId: 'v_2',
        productName: 'Logo Mug 12oz',
        variantName: 'Black',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 1,
        unitPrice: 110000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 110000,
        lineTax: 12100,
        lineTotal: 122100,
        batchAllocations: [
          { batchId: 'batch_5', qtyTaken: 1, ownership: 'consignment', unitCost: 50000, supplierId: 'sup_3' }
        ]
      }
    ],
    subtotal: 110000,
    taxTotal: 12100,
    total: 122100,
    paidAmount: 122100,
    payments: [],
    status: 'paid',
    notes: '',
    createdAt: '2026-05-14T11:00:00.000Z'
  },

  // === 3. Credit orders (piutang) — partial and full credit ===
  {
    id: 'ord_seed_13',
    code: 'ORD-2026-013',
    pricelistId: 'pl_vip',
    customerId: 'cust_1',
    paymentMethod: 'cash',
    lines: [
      {
        id: 'orl_s13_1',
        productId: 'prd_1',
        productName: 'Espresso',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 4,
        unitPrice: 22500,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 90000,
        lineTax: 9900,
        lineTotal: 99900,
        batchAllocations: [
          { batchId: 'batch_1', qtyTaken: 4, ownership: 'owned', unitCost: 5000, supplierId: 'sup_1' }
        ]
      },
      {
        id: 'orl_s13_2',
        productId: 'prd_2',
        productName: 'Latte',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 2,
        unitPrice: 30000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 60000,
        lineTax: 6600,
        lineTotal: 66600,
        batchAllocations: [
          { batchId: 'batch_2', qtyTaken: 2, ownership: 'owned', unitCost: 12000, supplierId: 'sup_1' }
        ]
      }
    ],
    subtotal: 150000,
    taxTotal: 16500,
    total: 166500,
    paidAmount: 100000,
    payments: [
      {
        id: 'opay_seed_13_1',
        amount: 100000,
        method: 'cash',
        at: '2026-05-13T10:00:00.000Z',
        notes: 'Pembayaran awal (DP), sisa minggu depan'
      }
    ],
    status: 'credit',
    notes: 'Andi Pratama nge-bon dulu, akan dilunasi minggu depan.',
    createdAt: '2026-05-13T10:00:00.000Z'
  },
  {
    id: 'ord_seed_14',
    code: 'ORD-2026-014',
    pricelistId: 'pl_wholesale',
    customerId: 'cust_2',
    paymentMethod: 'cash',
    lines: [
      {
        id: 'orl_s14_1',
        productId: 'prd_4',
        variantId: 'v_1',
        productName: 'Logo Mug 12oz',
        variantName: 'White',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 1,
        unitPrice: 110000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 110000,
        lineTax: 12100,
        lineTotal: 122100,
        batchAllocations: [
          { batchId: 'batch_4', qtyTaken: 1, ownership: 'consignment', unitCost: 50000, supplierId: 'sup_3' }
        ]
      }
    ],
    subtotal: 110000,
    taxTotal: 12100,
    total: 122100,
    paidAmount: 0,
    payments: [],
    status: 'credit',
    notes: 'PT Distributor Maju ambil dulu, ditagih akhir bulan (Net-30).',
    createdAt: '2026-05-15T09:30:00.000Z'
  },

  // === 4. Forecast-band drivers — three catering orders create high velocities ===
  // These orders use empty batchAllocations (no specific batch consumed); they
  // represent fictitious "past consumption" so the forecast page shows
  // Croissant → Kritis, Telur → Menipis, Espresso → Perhatikan without
  // requiring us to re-seed the batch ledger. Current batch stock is what's
  // left after all this historical activity.
  {
    id: 'ord_seed_15',
    code: 'ORD-2026-015',
    pricelistId: 'pl_wholesale',
    customerId: 'cust_2',
    paymentMethod: 'transfer',
    lines: [
      {
        id: 'orl_s15_1',
        productId: 'prd_3',
        productName: 'Butter Croissant',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 100,
        unitPrice: 12000,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 1200000,
        lineTax: 0,
        lineTotal: 1200000,
        batchAllocations: []
      },
      {
        id: 'orl_s15_2',
        productId: 'prd_1',
        productName: 'Espresso',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 80,
        unitPrice: 25000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 2000000,
        lineTax: 220000,
        lineTotal: 2220000,
        batchAllocations: []
      },
      {
        id: 'orl_s15_3',
        productId: 'prd_8',
        productName: 'Telur Ayam',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 80,
        unitPrice: 3500,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 280000,
        lineTax: 0,
        lineTotal: 280000,
        batchAllocations: []
      }
    ],
    subtotal: 3480000,
    taxTotal: 220000,
    total: 3700000,
    paidAmount: 3700000,
    payments: [],
    status: 'paid',
    notes: 'Catering pesanan kantor — pengiriman pagi 22 April.',
    createdAt: '2026-04-22T07:00:00.000Z'
  },
  {
    id: 'ord_seed_16',
    code: 'ORD-2026-016',
    pricelistId: 'pl_wholesale',
    customerId: 'cust_3',
    paymentMethod: 'transfer',
    lines: [
      {
        id: 'orl_s16_1',
        productId: 'prd_3',
        productName: 'Butter Croissant',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 80,
        unitPrice: 12000,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 960000,
        lineTax: 0,
        lineTotal: 960000,
        batchAllocations: []
      },
      {
        id: 'orl_s16_2',
        productId: 'prd_8',
        productName: 'Telur Ayam',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 100,
        unitPrice: 3500,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 350000,
        lineTax: 0,
        lineTotal: 350000,
        batchAllocations: []
      },
      {
        id: 'orl_s16_3',
        productId: 'prd_1',
        productName: 'Espresso',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 70,
        unitPrice: 25000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 1750000,
        lineTax: 192500,
        lineTotal: 1942500,
        batchAllocations: []
      }
    ],
    subtotal: 3060000,
    taxTotal: 192500,
    total: 3252500,
    paidAmount: 3252500,
    payments: [],
    status: 'paid',
    notes: 'Catering Toko Berkah — event ulang tahun mall, 1 Mei.',
    createdAt: '2026-05-01T06:30:00.000Z'
  },
  {
    id: 'ord_seed_17',
    code: 'ORD-2026-017',
    pricelistId: 'pl_wholesale',
    customerId: 'cust_2',
    paymentMethod: 'transfer',
    lines: [
      {
        id: 'orl_s17_1',
        productId: 'prd_3',
        productName: 'Butter Croissant',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 70,
        unitPrice: 12000,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 840000,
        lineTax: 0,
        lineTotal: 840000,
        batchAllocations: []
      },
      {
        id: 'orl_s17_2',
        productId: 'prd_8',
        productName: 'Telur Ayam',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 100,
        unitPrice: 3500,
        extras: [],
        taxRatePct: 0,
        lineSubtotal: 350000,
        lineTax: 0,
        lineTotal: 350000,
        batchAllocations: []
      },
      {
        id: 'orl_s17_3',
        productId: 'prd_1',
        productName: 'Espresso',
        variantName: '',
        unitId: 'unit_1',
        unitFactor: 1,
        unitCode: 'pcs',
        quantity: 100,
        unitPrice: 25000,
        extras: [],
        taxRatePct: 11,
        lineSubtotal: 2500000,
        lineTax: 275000,
        lineTotal: 2775000,
        batchAllocations: []
      }
    ],
    subtotal: 3690000,
    taxTotal: 275000,
    total: 3965000,
    paidAmount: 3965000,
    payments: [],
    status: 'paid',
    notes: 'Catering meeting PT Distributor — 8 Mei.',
    createdAt: '2026-05-08T05:30:00.000Z'
  }
];

class OrdersStore {
  items = $state<Order[]>([...seed]);
  private nextId = seed.length + 1;
  private nextCodeNum = seed.length + 1;

  private generateCode(): string {
    const year = new Date().getFullYear();
    return `ORD-${year}-${fmtCodeNumber(this.nextCodeNum++)}`;
  }

  add(input: OrderInput): Order {
    const createdAt = new Date().toISOString();
    const paidAmount = input.paidAmount ?? (input.status === 'paid' ? input.total : 0);
    const payments: OrderPayment[] =
      input.payments && input.payments.length > 0
        ? input.payments
        : paidAmount > 0
          ? [
              {
                id: `opay_${crypto.randomUUID()}`,
                amount: paidAmount,
                method: input.paymentMethod,
                at: createdAt,
                notes: input.status === 'credit' ? 'Pembayaran awal (DP)' : 'Pembayaran tunai/lunas saat penjualan'
              }
            ]
          : [];
    const order: Order = {
      ...input,
      id: `ord_${this.nextId++}`,
      code: this.generateCode(),
      createdAt,
      paidAmount,
      payments
    };
    this.items.push(order);
    return order;
  }

  getById(id: string): Order | undefined {
    return this.items.find((o) => o.id === id);
  }

  // Record a payment toward an outstanding (credit) order. Flips status to
  // 'paid' once paidAmount >= total. Returns the updated order or an error.
  recordPayment(
    orderId: string,
    args: { amount: number; method: PaymentMethod; notes?: string; at?: string }
  ): { ok: boolean; reason?: string; order?: Order } {
    const idx = this.items.findIndex((o) => o.id === orderId);
    if (idx === -1) return { ok: false, reason: 'Order not found.' };
    const order = this.items[idx];
    if (order.status === 'cancelled')
      return { ok: false, reason: 'Order sudah dibatalkan.' };
    if (!Number.isFinite(args.amount) || args.amount <= 0)
      return { ok: false, reason: 'Jumlah pembayaran harus lebih dari 0.' };
    const outstanding = order.total - order.paidAmount;
    if (args.amount > outstanding + 0.0001)
      return {
        ok: false,
        reason: `Jumlah melebihi sisa piutang (${outstanding}).`
      };
    const payment: OrderPayment = {
      id: `opay_${crypto.randomUUID()}`,
      amount: args.amount,
      method: args.method,
      at: args.at ?? new Date().toISOString(),
      notes: args.notes ?? ''
    };
    const nextPaid = order.paidAmount + args.amount;
    const nextStatus: OrderStatus = nextPaid >= order.total ? 'paid' : 'credit';
    this.items[idx] = {
      ...order,
      paidAmount: nextPaid,
      payments: [...order.payments, payment],
      status: nextStatus
    };
    return { ok: true, order: this.items[idx] };
  }

  cancel(id: string): { ok: boolean; reason?: string } {
    const order = this.getById(id);
    if (!order) return { ok: false, reason: 'Order not found.' };
    if (order.status === 'cancelled') return { ok: false, reason: 'Already cancelled.' };
    const idx = this.items.findIndex((o) => o.id === id);
    if (idx === -1) return { ok: false, reason: 'Order not found.' };

    const reference: StockMovementReference = { kind: 'order', id: order.id, code: order.code };

    // Restore each line's stamped batch allocations. Silently skip batches that
    // no longer exist (e.g. deleted manually) — qtyReceived stays as the historical
    // record on the batch; qtyRemaining can technically exceed it briefly which is fine.
    for (const line of order.lines) {
      for (const alloc of line.batchAllocations) {
        const batch = batches.getById(alloc.batchId);
        if (!batch) continue;
        const updated = batches.update(batch.id, {
          qtyRemaining: batch.qtyRemaining + alloc.qtyTaken
        });
        stockMovements.log({
          kind: 'sale-cancel',
          productId: line.productId,
          variantId: line.variantId,
          locationId: batch.locationId,
          batchId: batch.id,
          qtyDelta: alloc.qtyTaken,
          qtyAfter: updated?.qtyRemaining ?? batch.qtyRemaining + alloc.qtyTaken,
          unitCost: alloc.unitCost,
          reference,
          notes: `Pembatalan pesanan · ${order.code}`
        });
      }
    }

    this.items[idx] = { ...order, status: 'cancelled' };
    return { ok: true };
  }
}

export const orders = new OrdersStore();

// Walk batches FIFO (oldest receivedAt first), decrement qtyRemaining, and return
// one BatchAllocation per batch touched. Each allocation is snapshotted so the
// Consignor Payout report stays correct even if the underlying batch is later
// mutated or its supplier renamed. See docs/CONSIGNMENT.md §"Sale flow".
function deductBatchesFIFO(
  productId: string,
  variantId: string | undefined,
  qty: number,
  context?: { reference?: StockMovementReference; notes?: string }
): BatchAllocation[] {
  const allocations: BatchAllocation[] = [];
  let remaining = qty;
  for (const batch of batches.forStock(productId, variantId)) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.qtyRemaining);
    const updated = batches.update(batch.id, { qtyRemaining: batch.qtyRemaining - take });
    allocations.push({
      batchId: batch.id,
      qtyTaken: take,
      ownership: batch.ownership,
      unitCost: batch.unitCost,
      supplierId: batch.supplierId
    });
    if (context?.reference) {
      stockMovements.log({
        kind: 'sale',
        productId,
        variantId,
        locationId: batch.locationId,
        batchId: batch.id,
        qtyDelta: -take,
        qtyAfter: updated?.qtyRemaining ?? batch.qtyRemaining - take,
        unitCost: batch.unitCost,
        reference: context.reference,
        notes: context.notes ?? 'Penjualan'
      });
    }
    remaining -= take;
  }
  return allocations;
}

function deductComponents(
  comps: CompositeComponent[],
  multiplier: number,
  context?: { reference?: StockMovementReference; notes?: string }
): BatchAllocation[] {
  const allocations: BatchAllocation[] = [];
  for (const c of comps) {
    allocations.push(
      ...deductBatchesFIFO(c.productId, c.variantId, c.quantity * multiplier, context)
    );
  }
  return allocations;
}

/**
 * Apply a completed order to inventory.
 * Goods: deplete batches FIFO. Composites: deplete each component's batches via the recipe.
 * Extras with stock impact: deplete the extra's components per quantity sold.
 * Every batch touched is stamped onto the line's batchAllocations for downstream reports.
 */
export function applyOrderToStock(order: Order): void {
  const context = {
    reference: { kind: 'order' as const, id: order.id, code: order.code },
    notes: `Penjualan · ${order.code}`
  };
  for (const line of order.lines) {
    const product = products.getById(line.productId);
    if (!product) continue;
    const baseQty = line.quantity * (line.unitFactor || 1);
    const allocations: BatchAllocation[] = [];

    if (product.kind === 'composite') {
      const variant = line.variantId
        ? product.variants.find((v) => v.id === line.variantId)
        : undefined;
      const recipe = variant && variant.components.length > 0
        ? variant.components
        : product.components;
      allocations.push(...deductComponents(recipe, baseQty, context));
    } else {
      allocations.push(...deductBatchesFIFO(product.id, line.variantId, baseQty, context));
    }

    for (const ex of line.extras) {
      const extraDef = product.extras.find((e) => e.id === ex.extraId);
      if (extraDef && extraDef.components.length > 0) {
        allocations.push(...deductComponents(extraDef.components, line.quantity, context));
      }
    }

    line.batchAllocations = allocations;
  }
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  card: 'Kartu',
  qris: 'QRIS',
  transfer: 'Transfer'
};

export const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'card', label: 'Kartu' },
  { value: 'transfer', label: 'Transfer' }
];

export const orderStatusLabels: Record<OrderStatus, string> = {
  paid: 'Lunas',
  credit: 'Piutang',
  cancelled: 'Dibatalkan'
};

export function orderItemCount(order: Order): number {
  return order.lines.reduce((s, l) => s + l.quantity, 0);
}

// Walks paid orders (optionally restricted by date range) and aggregates
// consignment-owed amounts per supplier from each line's batchAllocations.
// Drives the Outstanding payables table on /payouts.
export function consignmentOwedBySupplier(args: {
  start?: string;
  end?: string;
}): Map<string, { units: number; amount: number }> {
  const result = new Map<string, { units: number; amount: number }>();
  for (const order of orders.items) {
    if (order.status !== 'paid') continue;
    const orderDate = order.createdAt.slice(0, 10);
    if (args.start && orderDate < args.start) continue;
    if (args.end && orderDate > args.end) continue;
    for (const line of order.lines) {
      for (const alloc of line.batchAllocations) {
        if (alloc.ownership !== 'consignment') continue;
        if (!alloc.supplierId) continue;
        const cur = result.get(alloc.supplierId) ?? { units: 0, amount: 0 };
        cur.units += alloc.qtyTaken;
        cur.amount += alloc.qtyTaken * alloc.unitCost;
        result.set(alloc.supplierId, cur);
      }
    }
  }
  return result;
}
