import { products } from '$lib/stores/products.svelte';
import {
  promotions,
  isPromoUsable,
  type PromoKind,
  type PromoLevel,
  type Promotion
} from '$lib/stores/promotions.svelte';
import type { Customer } from '$lib/stores/customers.svelte';

export type CartLineForPromo = {
  id: string;
  productId: string;
  variantId?: string;
  unitFactor: number;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  subtotal: number;
};

export type AppliedPromo = {
  promoId: string;
  promoCode: string;
  promoName: string;
  kind: PromoKind;
  level: PromoLevel;
  affectedLineIds: string[];
  discountAmount: number;
  description: string;
};

export type ResolverContext = {
  lines: CartLineForPromo[];
  customer?: Customer;
  at: Date;
  dismissedPromoIds?: string[];
};

function categoryOf(productId: string): string | undefined {
  return products.getById(productId)?.categoryId;
}

function matchesScope(promo: Promotion, line: CartLineForPromo): boolean {
  if (promo.productIds && promo.productIds.length > 0) {
    if (!promo.productIds.includes(line.productId)) return false;
  }
  if (promo.categoryIds && promo.categoryIds.length > 0) {
    const cat = categoryOf(line.productId);
    if (!cat || !promo.categoryIds.includes(cat)) return false;
  }
  return true;
}

// Returns the number of complete bundles this combo can claim against the
// remaining base quantities in `remaining`. Mutates `consumed` to reflect
// what would be taken if applied.
function comboBundleCount(
  promo: Promotion,
  remaining: Map<string, number>
): number {
  if (!promo.comboItems || promo.comboItems.length === 0) return 0;
  let min = Infinity;
  for (const item of promo.comboItems) {
    const key = `${item.productId}|${item.variantId ?? ''}`;
    const avail = remaining.get(key) ?? 0;
    const bundles = Math.floor(avail / item.quantity);
    if (bundles < min) min = bundles;
    if (min === 0) return 0;
  }
  return Number.isFinite(min) ? min : 0;
}

// Walks `lines` and decrements `remaining` based on the per-product key.
function keyForLine(line: CartLineForPromo): string {
  return `${line.productId}|${line.variantId ?? ''}`;
}

function originalPriceForComboItems(
  promo: Promotion,
  lines: CartLineForPromo[]
): number {
  if (!promo.comboItems) return 0;
  let total = 0;
  for (const item of promo.comboItems) {
    // Find a representative line for this (product, variant?) to derive unit price.
    const line = lines.find(
      (l) => l.productId === item.productId && (item.variantId ? l.variantId === item.variantId : true)
    );
    if (!line) continue;
    total += line.unitPrice * item.quantity;
  }
  return total;
}

// Given (already-resolved usable promos), return the applied list.
export function resolvePromos(ctx: ResolverContext): AppliedPromo[] {
  const usable = promotions
    .usableAt(ctx.at)
    .filter((p) => !ctx.dismissedPromoIds?.includes(p.id));

  const applied: AppliedPromo[] = [];

  // remaining base quantity per (productId|variantId?) — used so each base unit
  // gets at most one line-level promo applied to it.
  const remaining = new Map<string, number>();
  for (const line of ctx.lines) {
    const key = keyForLine(line);
    remaining.set(key, (remaining.get(key) ?? 0) + line.baseQuantity);
  }

  // 1. Combos consume across lines (best-first by discount magnitude).
  const combos = usable
    .filter((p) => p.kind === 'combo' && p.level === 'line')
    .slice();
  let comboProgress = true;
  while (comboProgress) {
    comboProgress = false;
    for (const combo of combos) {
      const bundles = comboBundleCount(combo, remaining);
      if (bundles <= 0) continue;
      const originalPrice = originalPriceForComboItems(combo, ctx.lines);
      const comboPrice = combo.comboPrice ?? 0;
      const perBundleDiscount = Math.max(0, originalPrice - comboPrice);
      if (perBundleDiscount <= 0) continue;

      const affected = new Set<string>();
      for (const item of combo.comboItems ?? []) {
        const k = `${item.productId}|${item.variantId ?? ''}`;
        remaining.set(k, Math.max(0, (remaining.get(k) ?? 0) - item.quantity * bundles));
        for (const line of ctx.lines) {
          if (keyForLine(line) === k) affected.add(line.id);
        }
      }

      applied.push({
        promoId: combo.id,
        promoCode: combo.code,
        promoName: combo.name,
        kind: 'combo',
        level: 'line',
        affectedLineIds: Array.from(affected),
        discountAmount: perBundleDiscount * bundles,
        description: `${bundles}× ${combo.name}`
      });
      // Only one application per combo per resolve (already maxed bundles).
    }
  }

  // 2. BOGO per (product, variant) — operates on remaining quantity.
  const bogos = usable.filter((p) => p.kind === 'bogo' && p.level === 'line');
  for (const promo of bogos) {
    const buy = promo.buyQuantity ?? 0;
    const getQ = promo.getQuantity ?? 0;
    const bundleSize = buy + getQ;
    if (bundleSize <= 0) continue;

    // Group remaining qty by relevant product key.
    // If bogoProductId is set, only that product qualifies.
    const candidates: Array<{ line: CartLineForPromo; remaining: number }> = [];
    for (const line of ctx.lines) {
      if (promo.bogoProductId && line.productId !== promo.bogoProductId) continue;
      if (!matchesScope(promo, line)) continue;
      const rem = remaining.get(keyForLine(line)) ?? 0;
      if (rem > 0) candidates.push({ line, remaining: rem });
    }
    if (candidates.length === 0) continue;

    let totalDiscount = 0;
    const affected: string[] = [];
    for (const c of candidates) {
      const bundles = Math.floor(c.remaining / bundleSize);
      if (bundles <= 0) continue;
      const freeQty = bundles * getQ;
      const lineDiscount = freeQty * c.line.unitPrice;
      if (lineDiscount <= 0) continue;
      totalDiscount += lineDiscount;
      affected.push(c.line.id);
      remaining.set(
        keyForLine(c.line),
        Math.max(0, c.remaining - bundles * bundleSize)
      );
    }
    if (totalDiscount > 0) {
      applied.push({
        promoId: promo.id,
        promoCode: promo.code,
        promoName: promo.name,
        kind: 'bogo',
        level: 'line',
        affectedLineIds: affected,
        discountAmount: totalDiscount,
        description: promo.description || promo.name
      });
    }
  }

  // 3. Line-level discount (% or fixed). Apply to remaining qty share per line.
  // Pick the *single best* line-level discount per line.
  const lineDiscounts = usable.filter(
    (p) => p.kind === 'discount' && p.level === 'line'
  );
  if (lineDiscounts.length > 0) {
    for (const line of ctx.lines) {
      const rem = remaining.get(keyForLine(line)) ?? 0;
      if (rem <= 0) continue;
      const remShare = rem / line.baseQuantity; // 0..1 portion of this line still eligible
      const remainingSubtotal = line.subtotal * remShare;

      let bestPromo: Promotion | undefined;
      let bestAmt = 0;
      for (const promo of lineDiscounts) {
        if (!matchesScope(promo, line)) continue;
        let amt = 0;
        if (promo.discountUnit === 'percent') {
          amt = (remainingSubtotal * (promo.discountValue ?? 0)) / 100;
        } else if (promo.discountUnit === 'fixed') {
          amt = Math.min(promo.discountValue ?? 0, remainingSubtotal);
        }
        if (amt > bestAmt) {
          bestAmt = amt;
          bestPromo = promo;
        }
      }
      if (bestPromo && bestAmt > 0) {
        applied.push({
          promoId: bestPromo.id,
          promoCode: bestPromo.code,
          promoName: bestPromo.name,
          kind: 'discount',
          level: 'line',
          affectedLineIds: [line.id],
          discountAmount: bestAmt,
          description: bestPromo.description || bestPromo.name
        });
        remaining.set(keyForLine(line), 0);
      }
    }
  }

  // 4. Order-level promo (best of all applicable).
  const orderSubtotalGross = ctx.lines.reduce((s, l) => s + l.subtotal, 0);
  const lineDiscountTotal = applied.reduce((s, a) => s + a.discountAmount, 0);
  const orderSubtotalNet = Math.max(0, orderSubtotalGross - lineDiscountTotal);

  const orderPromos = usable.filter((p) => p.level === 'order');
  let bestOrderPromo: Promotion | undefined;
  let bestOrderDiscount = 0;
  for (const promo of orderPromos) {
    if (promo.minimumPurchase && orderSubtotalNet < promo.minimumPurchase) continue;

    let amt = 0;
    if (promo.kind === 'discount') {
      if (promo.discountUnit === 'percent') {
        amt = (orderSubtotalNet * (promo.discountValue ?? 0)) / 100;
      } else if (promo.discountUnit === 'fixed') {
        amt = Math.min(promo.discountValue ?? 0, orderSubtotalNet);
      }
    } else if (promo.kind === 'member-tier') {
      if (!ctx.customer) continue;
      if (promo.memberPricelistId && ctx.customer.pricelistId !== promo.memberPricelistId) continue;
      amt = (orderSubtotalNet * (promo.memberPercentOff ?? 0)) / 100;
    }
    if (amt > bestOrderDiscount) {
      bestOrderDiscount = amt;
      bestOrderPromo = promo;
    }
  }
  if (bestOrderPromo && bestOrderDiscount > 0) {
    applied.push({
      promoId: bestOrderPromo.id,
      promoCode: bestOrderPromo.code,
      promoName: bestOrderPromo.name,
      kind: bestOrderPromo.kind,
      level: 'order',
      affectedLineIds: ctx.lines.map((l) => l.id),
      discountAmount: bestOrderDiscount,
      description: bestOrderPromo.description || bestOrderPromo.name
    });
  }

  return applied;
}

// Compute net-of-promo subtotal per line. Each line's share of order-level
// discount is proportional to its post-line-discount subtotal.
export function distributePromosAcrossLines(
  lines: CartLineForPromo[],
  applied: AppliedPromo[]
): Map<string, { lineDiscount: number; orderDiscountShare: number }> {
  const out = new Map<string, { lineDiscount: number; orderDiscountShare: number }>();
  for (const l of lines) out.set(l.id, { lineDiscount: 0, orderDiscountShare: 0 });

  // Line-level discounts go to specific lines.
  for (const a of applied) {
    if (a.level !== 'line') continue;
    if (a.affectedLineIds.length === 0) continue;
    // Distribute proportionally to those lines' subtotals.
    const totalSubtotal = a.affectedLineIds.reduce((s, id) => {
      const ln = lines.find((l) => l.id === id);
      return s + (ln?.subtotal ?? 0);
    }, 0);
    if (totalSubtotal <= 0) continue;
    for (const id of a.affectedLineIds) {
      const ln = lines.find((l) => l.id === id);
      if (!ln) continue;
      const share = (ln.subtotal / totalSubtotal) * a.discountAmount;
      out.get(id)!.lineDiscount += share;
    }
  }

  // Order-level discount distributed proportionally across ALL lines by net subtotal.
  const orderApplied = applied.find((a) => a.level === 'order');
  if (orderApplied) {
    const netByLine = lines.map((l) => ({
      id: l.id,
      net: Math.max(0, l.subtotal - (out.get(l.id)?.lineDiscount ?? 0))
    }));
    const totalNet = netByLine.reduce((s, x) => s + x.net, 0);
    if (totalNet > 0) {
      for (const { id, net } of netByLine) {
        const share = (net / totalNet) * orderApplied.discountAmount;
        out.get(id)!.orderDiscountShare += share;
      }
    }
  }

  return out;
}
