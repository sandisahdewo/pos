import { orders, type Order, type PaymentMethod } from '$lib/stores/orders.svelte';
import { products } from '$lib/stores/products.svelte';

export type SalesPeriod = {
  startISO: string;  // inclusive YYYY-MM-DD
  endISO: string;    // inclusive YYYY-MM-DD
};

export type SalesSummary = {
  orderCount: number;
  grossRevenue: number;       // sum of order.total (post-promo)
  itemsSold: number;          // sum of line.quantity × unitFactor (base units)
  averageOrderValue: number;
  promoDiscountTotal: number;
  cogs: number;               // sum of allocation qtyTaken × unitCost
  grossMargin: number;
  marginPct: number;          // 0..100
  taxTotal: number;
  byPaymentMethod: Record<PaymentMethod, number>;
  outstandingCredit: number;  // sum of unpaid for credit orders in period
};

export type DayBucket = {
  date: string;
  orderCount: number;
  revenue: number;
  byMethod: Record<PaymentMethod, number>;
};

export type HourBucket = {
  hour: number;
  orderCount: number;
  revenue: number;
};

export type ProductBucket = {
  productId: string;
  variantId?: string;
  productName: string;
  variantName: string;
  qtyBase: number;       // in base units
  unitCode: string;
  revenue: number;
  orderCount: number;    // distinct orders containing this product/variant
};

export type CashierBucket = {
  employeeId: string;
  orderCount: number;
  revenue: number;
};

function inPeriod(o: Order, p: SalesPeriod): boolean {
  if (o.status === 'cancelled') return false;
  const date = o.createdAt.slice(0, 10);
  return date >= p.startISO && date <= p.endISO;
}

function ordersIn(p: SalesPeriod): Order[] {
  return orders.items.filter((o) => inPeriod(o, p));
}

const emptyByMethod = (): Record<PaymentMethod, number> => ({
  cash: 0,
  card: 0,
  qris: 0,
  transfer: 0
});

export function salesSummary(p: SalesPeriod): SalesSummary {
  const list = ordersIn(p);
  let grossRevenue = 0;
  let itemsSold = 0;
  let promoDiscountTotal = 0;
  let cogs = 0;
  let taxTotal = 0;
  let outstandingCredit = 0;
  const byMethod = emptyByMethod();

  for (const o of list) {
    grossRevenue += o.total;
    taxTotal += o.taxTotal;
    promoDiscountTotal += o.promoDiscount ?? 0;
    if (o.status === 'credit') outstandingCredit += o.total - o.paidAmount;
    for (const line of o.lines) {
      itemsSold += line.quantity * line.unitFactor;
      for (const alloc of line.batchAllocations) {
        cogs += alloc.qtyTaken * alloc.unitCost;
      }
    }
    // Payment method totals based on actual payments in window (the order itself
    // can span multiple payments). For simplicity, attribute the order total to
    // the primary paymentMethod when paid in one shot.
    if (o.payments && o.payments.length > 0) {
      for (const pay of o.payments) {
        byMethod[pay.method] += pay.amount;
      }
    } else {
      byMethod[o.paymentMethod] += o.total;
    }
  }
  const orderCount = list.length;
  const averageOrderValue = orderCount > 0 ? grossRevenue / orderCount : 0;
  const grossMargin = grossRevenue - cogs;
  const marginPct = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;
  return {
    orderCount,
    grossRevenue,
    itemsSold,
    averageOrderValue,
    promoDiscountTotal,
    cogs,
    grossMargin,
    marginPct,
    taxTotal,
    byPaymentMethod: byMethod,
    outstandingCredit
  };
}

export function dayBuckets(p: SalesPeriod): DayBucket[] {
  const list = ordersIn(p);
  const byDay = new Map<string, DayBucket>();
  for (const o of list) {
    const date = o.createdAt.slice(0, 10);
    let bucket = byDay.get(date);
    if (!bucket) {
      bucket = { date, orderCount: 0, revenue: 0, byMethod: emptyByMethod() };
      byDay.set(date, bucket);
    }
    bucket.orderCount += 1;
    bucket.revenue += o.total;
    bucket.byMethod[o.paymentMethod] += o.total;
  }
  // Fill missing days with zero buckets so charts have continuous x-axis.
  const start = new Date(p.startISO + 'T00:00:00');
  const end = new Date(p.endISO + 'T00:00:00');
  const days: DayBucket[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    days.push(
      byDay.get(key) ?? { date: key, orderCount: 0, revenue: 0, byMethod: emptyByMethod() }
    );
  }
  return days;
}

export function hourBuckets(p: SalesPeriod): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    orderCount: 0,
    revenue: 0
  }));
  for (const o of ordersIn(p)) {
    const d = new Date(o.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const h = d.getHours();
    buckets[h].orderCount += 1;
    buckets[h].revenue += o.total;
  }
  return buckets;
}

export function topProducts(p: SalesPeriod, limit = 10): ProductBucket[] {
  const map = new Map<string, ProductBucket>();
  for (const o of ordersIn(p)) {
    for (const line of o.lines) {
      const key = `${line.productId}|${line.variantId ?? ''}`;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          productId: line.productId,
          variantId: line.variantId,
          productName: line.productName,
          variantName: line.variantName,
          qtyBase: 0,
          unitCode: products.getById(line.productId)?.unitId ?? line.unitCode,
          revenue: 0,
          orderCount: 0
        };
        map.set(key, bucket);
      }
      bucket.qtyBase += line.quantity * line.unitFactor;
      bucket.revenue += line.lineTotal;
      bucket.orderCount += 1;
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function cashierBuckets(p: SalesPeriod): CashierBucket[] {
  const map = new Map<string, CashierBucket>();
  for (const o of ordersIn(p)) {
    if (!o.employeeId) continue;
    let bucket = map.get(o.employeeId);
    if (!bucket) {
      bucket = { employeeId: o.employeeId, orderCount: 0, revenue: 0 };
      map.set(o.employeeId, bucket);
    }
    bucket.orderCount += 1;
    bucket.revenue += o.total;
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

// Date helpers — return ISO YYYY-MM-DD.
export function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function isoStartOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
