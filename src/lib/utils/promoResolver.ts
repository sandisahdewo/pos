import { products } from '$lib/stores/products.svelte';
import {
  promotions,
  type PromoKind,
  type PromoLevel,
  type Promotion
} from '$lib/stores/promotions.svelte';
import type { Customer } from '$lib/stores/customers.svelte';

export type CartLineForPromo = {
  id: string;
  productId: string;
  variantId?: string;
  unitId: string;
  unitFactor: number;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;     // price per chosen-unit (e.g. per box if line is in box)
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
  const hasProductFilter = !!(promo.productIds && promo.productIds.length > 0);
  const hasCategoryFilter = !!(promo.categoryIds && promo.categoryIds.length > 0);
  if (!hasProductFilter && !hasCategoryFilter) return true;
  if (hasProductFilter && promo.productIds!.includes(line.productId)) return true;
  if (hasCategoryFilter) {
    const cat = categoryOf(line.productId);
    if (cat && promo.categoryIds!.includes(cat)) return true;
  }
  return false;
}

// Match a cart line against optional (variant + unit) filters. unitFactor is
// the source of truth for packaging match — two packagings sharing a unitId
// (different factors) are distinct.
function lineMatches(
  line: CartLineForPromo,
  productId: string,
  variantId: string | undefined,
  unitId: string | undefined,
  unitFactor: number | undefined
): boolean {
  if (line.productId !== productId) return false;
  if ((variantId ?? '') !== '' && (line.variantId ?? '') !== variantId) return false;
  if (unitId && line.unitId !== unitId) return false;
  if (unitFactor !== undefined && line.unitFactor !== unitFactor) return false;
  return true;
}

// Sum remaining base units across cart lines matching the filter.
function availableFor(
  lines: CartLineForPromo[],
  remaining: Map<string, number>,
  productId: string,
  variantId: string | undefined,
  unitId: string | undefined,
  unitFactor: number | undefined
): number {
  let total = 0;
  for (const line of lines) {
    if (!lineMatches(line, productId, variantId, unitId, unitFactor)) continue;
    total += remaining.get(line.id) ?? 0;
  }
  return total;
}

// Consume `baseUnits` from matching lines (FIFO over cart order). Mutates
// `remaining`. Returns the list of affected line ids.
function consume(
  lines: CartLineForPromo[],
  remaining: Map<string, number>,
  productId: string,
  variantId: string | undefined,
  unitId: string | undefined,
  unitFactor: number | undefined,
  baseUnits: number
): string[] {
  const affected: string[] = [];
  let need = baseUnits;
  for (const line of lines) {
    if (need <= 0) break;
    if (!lineMatches(line, productId, variantId, unitId, unitFactor)) continue;
    const rem = remaining.get(line.id) ?? 0;
    if (rem <= 0) continue;
    const take = Math.min(rem, need);
    remaining.set(line.id, rem - take);
    need -= take;
    affected.push(line.id);
  }
  return affected;
}

// Pick a representative unit price from cart lines matching the filter.
// Falls back to 0 if no matching line is present.
function unitPriceForMatch(
  lines: CartLineForPromo[],
  productId: string,
  variantId: string | undefined,
  unitId: string | undefined,
  unitFactor: number | undefined
): number {
  for (const line of lines) {
    if (lineMatches(line, productId, variantId, unitId, unitFactor)) return line.unitPrice;
  }
  return 0;
}

// Sum the original price of one combo bundle. Per item: quantity × unitPrice
// of the (matching unit) cart line; falls back to 0 when no matching line.
function originalBundlePrice(promo: Promotion, lines: CartLineForPromo[]): number {
  if (!promo.comboItems) return 0;
  let total = 0;
  for (const item of promo.comboItems) {
    const unitPrice = unitPriceForMatch(
      lines,
      item.productId,
      item.variantId,
      item.unitId,
      item.unitFactor
    );
    total += unitPrice * item.quantity;
  }
  return total;
}

export function resolvePromos(ctx: ResolverContext): AppliedPromo[] {
  const usable = promotions
    .usableAt(ctx.at)
    .filter((p) => !ctx.dismissedPromoIds?.includes(p.id));

  const applied: AppliedPromo[] = [];

  // remaining base units per cart line — each base unit can be claimed by at
  // most ONE line-level promo (predictable, no double-discounting).
  const remaining = new Map<string, number>();
  for (const line of ctx.lines) remaining.set(line.id, line.baseQuantity);

  // 1. Combos consume across lines, possibly with strict unit matching.
  const combos = usable.filter((p) => p.kind === 'combo' && p.level === 'line');
  for (const combo of combos) {
    if (!combo.comboItems || combo.comboItems.length === 0) continue;

    // Bundle count = min across items of floor(avail / baseUnitsPerBundle).
    let bundles = Infinity;
    for (const item of combo.comboItems) {
      const baseUnitsPerBundle = item.quantity * (item.unitFactor ?? 1);
      const avail = availableFor(
        ctx.lines,
        remaining,
        item.productId,
        item.variantId,
        item.unitId,
        item.unitFactor
      );
      const itemBundles = Math.floor(avail / baseUnitsPerBundle);
      if (itemBundles < bundles) bundles = itemBundles;
      if (bundles === 0) break;
    }
    if (!Number.isFinite(bundles) || bundles <= 0) continue;

    const original = originalBundlePrice(combo, ctx.lines);
    const comboPrice = combo.comboPrice ?? 0;
    const perBundleDiscount = Math.max(0, original - comboPrice);
    if (perBundleDiscount <= 0) continue;

    const affected = new Set<string>();
    for (const item of combo.comboItems) {
      const baseUnits = item.quantity * (item.unitFactor ?? 1) * bundles;
      const ids = consume(
        ctx.lines,
        remaining,
        item.productId,
        item.variantId,
        item.unitId,
        item.unitFactor,
        baseUnits
      );
      ids.forEach((id) => affected.add(id));
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
  }

  // 2. BOGO per (product, variant, buy-unit) — buy and get sides can have
  //    different units (e.g. buy 1 box → get 1 pcs).
  const bogos = usable.filter((p) => p.kind === 'bogo' && p.level === 'line');
  for (const promo of bogos) {
    const buyQty = promo.buyQuantity ?? 0;
    const getQty = promo.getQuantity ?? 0;
    if (buyQty <= 0 || getQty <= 0) continue;

    const buyUnitFactor = promo.buyUnitFactor ?? 1;
    const getUnitFactor = promo.getUnitFactor ?? 1;
    const buyBaseUnitsPerBundle = buyQty * buyUnitFactor;
    const getBaseUnitsPerBundle = getQty * getUnitFactor;

    const productId = promo.bogoProductId;
    const variantId = promo.bogoVariantId;

    let affectedLines: string[] = [];
    let totalDiscount = 0;

    if (productId) {
      const availBuy = availableFor(
        ctx.lines,
        remaining,
        productId,
        variantId,
        promo.buyUnitId,
        promo.buyUnitFactor
      );
      // Cross-unit BOGO needs separate "get" pool. When buy and get units differ,
      // bundle count is the min over (buy availability, get availability).
      const sameUnit =
        (promo.buyUnitId ?? '') === (promo.getUnitId ?? '') &&
        (promo.buyUnitFactor ?? 1) === (promo.getUnitFactor ?? 1);

      let bundles: number;
      if (sameUnit) {
        // Same unit on both sides: total claim from one pool, bundle = buy+get.
        const bundleBase = buyBaseUnitsPerBundle + getBaseUnitsPerBundle;
        bundles = Math.floor(availBuy / bundleBase);
      } else {
        const availGet = availableFor(
          ctx.lines,
          remaining,
          productId,
          variantId,
          promo.getUnitId,
          promo.getUnitFactor
        );
        bundles = Math.min(
          Math.floor(availBuy / buyBaseUnitsPerBundle),
          Math.floor(availGet / getBaseUnitsPerBundle)
        );
      }

      if (bundles > 0) {
        // Consume buy side first.
        const buyAffected = consume(
          ctx.lines,
          remaining,
          productId,
          variantId,
          promo.buyUnitId,
          promo.buyUnitFactor,
          bundles * buyBaseUnitsPerBundle
        );
        // Consume get side.
        const getAffected = consume(
          ctx.lines,
          remaining,
          productId,
          variantId,
          promo.getUnitId,
          promo.getUnitFactor,
          bundles * getBaseUnitsPerBundle
        );
        // Discount value comes from the get side's per-unit price.
        const getUnitPrice = unitPriceForMatch(
          ctx.lines,
          productId,
          variantId,
          promo.getUnitId,
          promo.getUnitFactor
        );
        totalDiscount = bundles * getQty * getUnitPrice;
        affectedLines = Array.from(new Set([...buyAffected, ...getAffected]));
      }
    } else {
      // No specific product — fall back to scope filter, single-unit BOGO.
      const bundleSize = buyBaseUnitsPerBundle + getBaseUnitsPerBundle;
      for (const line of ctx.lines) {
        if (!matchesScope(promo, line)) continue;
        const rem = remaining.get(line.id) ?? 0;
        const bundles = Math.floor(rem / bundleSize);
        if (bundles <= 0) continue;
        const freeBase = bundles * getBaseUnitsPerBundle;
        // Discount = (freeBase / line.unitFactor) × line.unitPrice = freeBase / line.unitFactor × line.unitPrice
        const freeInLineUnit = freeBase / line.unitFactor;
        const lineDiscount = freeInLineUnit * line.unitPrice;
        if (lineDiscount <= 0) continue;
        totalDiscount += lineDiscount;
        affectedLines.push(line.id);
        remaining.set(line.id, Math.max(0, rem - bundles * bundleSize));
      }
    }

    if (totalDiscount > 0) {
      applied.push({
        promoId: promo.id,
        promoCode: promo.code,
        promoName: promo.name,
        kind: 'bogo',
        level: 'line',
        affectedLineIds: affectedLines,
        discountAmount: totalDiscount,
        description: promo.description || promo.name
      });
    }
  }

  // 3. Line-level discount (% or fixed). Pick the single best per line.
  const lineDiscounts = usable.filter(
    (p) => p.kind === 'discount' && p.level === 'line'
  );
  if (lineDiscounts.length > 0) {
    for (const line of ctx.lines) {
      const rem = remaining.get(line.id) ?? 0;
      if (rem <= 0) continue;
      const remShare = rem / line.baseQuantity;
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
        remaining.set(line.id, 0);
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

// Suggestion for a combo that's partially in the cart (at least one item
// present) but missing others. Includes unit-aware "Tambah 1 box" labels.
export type ComboSuggestion = {
  promoId: string;
  promoName: string;
  promoDescription: string;
  needed: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    unitLabel?: string;     // e.g. "box × 6" when unit-strict
    quantity: number;
  }>;
  potentialDiscount: number;
};

function unitLabelFor(productId: string, unitId?: string, unitFactor?: number): string | undefined {
  if (!unitId) return undefined;
  const p = products.getById(productId);
  if (!p) return undefined;
  // For base unit (factor 1 + matching unitId), no label needed.
  const isBase = unitId === p.unitId && (unitFactor ?? 1) === 1;
  if (isBase) return undefined;
  if (unitFactor === undefined) return undefined;
  return `${unitId} × ${unitFactor}`;
}

export function suggestCombos(
  ctx: {
    lines: CartLineForPromo[];
    at: Date;
    dismissedPromoIds?: string[];
  },
  unitPriceFor: (productId: string, variantId?: string, unitId?: string, unitFactor?: number) => number
): ComboSuggestion[] {
  const usable = promotions
    .usableAt(ctx.at)
    .filter((p) => !ctx.dismissedPromoIds?.includes(p.id))
    .filter((p) => p.kind === 'combo');

  const remaining = new Map<string, number>();
  for (const line of ctx.lines) remaining.set(line.id, line.baseQuantity);

  const out: ComboSuggestion[] = [];
  for (const combo of usable) {
    if (!combo.comboItems || combo.comboItems.length === 0) continue;

    // Need at least one combo item present to suggest.
    const hasAny = combo.comboItems.some((item) => {
      const avail = availableFor(
        ctx.lines,
        remaining,
        item.productId,
        item.variantId,
        item.unitId,
        item.unitFactor
      );
      return avail > 0;
    });
    if (!hasAny) continue;

    const needed: ComboSuggestion['needed'] = [];
    let originalBundlePrice = 0;
    for (const item of combo.comboItems) {
      const baseUnitsPerBundle = item.quantity * (item.unitFactor ?? 1);
      const avail = availableFor(
        ctx.lines,
        remaining,
        item.productId,
        item.variantId,
        item.unitId,
        item.unitFactor
      );
      const haveBundles = Math.floor(avail / baseUnitsPerBundle);
      const unitPrice = unitPriceFor(item.productId, item.variantId, item.unitId, item.unitFactor);
      originalBundlePrice += unitPrice * item.quantity;
      if (haveBundles < 1) {
        const missingBase = baseUnitsPerBundle - avail;
        const missingInUnit = Math.ceil(missingBase / (item.unitFactor ?? 1));
        const product = products.getById(item.productId);
        let productName = product?.name ?? 'Produk';
        if (item.variantId) {
          const v = product?.variants.find((v) => v.id === item.variantId);
          if (v) productName += ` ${v.name}`;
        }
        needed.push({
          productId: item.productId,
          variantId: item.variantId,
          productName,
          unitLabel: unitLabelFor(item.productId, item.unitId, item.unitFactor),
          quantity: missingInUnit
        });
      }
    }
    if (needed.length === 0) continue;

    const potentialDiscount = Math.max(0, originalBundlePrice - (combo.comboPrice ?? 0));
    if (potentialDiscount <= 0) continue;

    out.push({
      promoId: combo.id,
      promoName: combo.name,
      promoDescription: combo.description,
      needed,
      potentialDiscount
    });
  }
  return out;
}

export type BogoSuggestion = {
  promoId: string;
  promoName: string;
  promoDescription: string;
  productId: string;
  variantId?: string;
  unitsNeeded: number;
  unitLabel?: string;        // unit of "needed" qty (defaults to product base)
  freeUnits: number;
  freeUnitLabel?: string;    // unit of free qty
  potentialDiscount: number;
};

export function suggestBogos(ctx: {
  lines: CartLineForPromo[];
  at: Date;
  dismissedPromoIds?: string[];
}): BogoSuggestion[] {
  const usable = promotions
    .usableAt(ctx.at)
    .filter((p) => !ctx.dismissedPromoIds?.includes(p.id))
    .filter((p) => p.kind === 'bogo');

  const remaining = new Map<string, number>();
  for (const line of ctx.lines) remaining.set(line.id, line.baseQuantity);

  const out: BogoSuggestion[] = [];
  for (const promo of usable) {
    const buyQty = promo.buyQuantity ?? 0;
    const getQty = promo.getQuantity ?? 0;
    if (buyQty <= 0 || getQty <= 0) continue;

    const buyBaseUnitsPerBundle = buyQty * (promo.buyUnitFactor ?? 1);
    const getBaseUnitsPerBundle = getQty * (promo.getUnitFactor ?? 1);

    const productId = promo.bogoProductId;
    if (!productId) continue; // scope-only BOGO doesn't suggest cleanly here
    const variantId = promo.bogoVariantId;

    const availBuy = availableFor(
      ctx.lines,
      remaining,
      productId,
      variantId,
      promo.buyUnitId,
      promo.buyUnitFactor
    );
    const sameUnit =
      (promo.buyUnitId ?? '') === (promo.getUnitId ?? '') &&
      (promo.buyUnitFactor ?? 1) === (promo.getUnitFactor ?? 1);

    if (availBuy === 0) continue;

    if (sameUnit) {
      // Customer needs (buy + get) base units to claim 1 bundle. Suggest the
      // remainder to next bundle when partial.
      const bundleBase = buyBaseUnitsPerBundle + getBaseUnitsPerBundle;
      const inCurrentBundle = availBuy % bundleBase;
      if (inCurrentBundle === 0) continue;
      const neededBase = bundleBase - inCurrentBundle;
      const factor = promo.buyUnitFactor ?? 1;
      const neededInUnit = Math.ceil(neededBase / factor);
      const getUnitPrice = unitPriceForMatch(
        ctx.lines,
        productId,
        variantId,
        promo.getUnitId,
        promo.getUnitFactor
      );
      out.push({
        promoId: promo.id,
        promoName: promo.name,
        promoDescription: promo.description,
        productId,
        variantId,
        unitsNeeded: neededInUnit,
        unitLabel: unitLabelFor(productId, promo.buyUnitId, promo.buyUnitFactor),
        freeUnits: getQty,
        freeUnitLabel: unitLabelFor(productId, promo.getUnitId, promo.getUnitFactor),
        potentialDiscount: getQty * getUnitPrice
      });
    } else {
      // Different units. Suggest based on whichever side is short of a full bundle.
      const availGet = availableFor(
        ctx.lines,
        remaining,
        productId,
        variantId,
        promo.getUnitId,
        promo.getUnitFactor
      );
      const buyBundles = Math.floor(availBuy / buyBaseUnitsPerBundle);
      const getBundles = Math.floor(availGet / getBaseUnitsPerBundle);
      const claimable = Math.min(buyBundles, getBundles);
      // If already fully claimable for as many bundles as buy can supply, skip.
      if (claimable >= buyBundles && claimable >= getBundles && availBuy > 0 && availGet > 0) {
        // If both sides have surplus rounding to same bundles, nothing more to suggest.
        // Otherwise (one side short), suggest filling it.
        if (buyBundles === getBundles) continue;
      }
      // Identify shortage:
      if (buyBundles > getBundles) {
        // Need more get-side to claim remaining buy bundles.
        const targetBundles = buyBundles;
        const neededGetBase = targetBundles * getBaseUnitsPerBundle - availGet;
        if (neededGetBase <= 0) continue;
        const factor = promo.getUnitFactor ?? 1;
        const neededInUnit = Math.ceil(neededGetBase / factor);
        const getUnitPrice = unitPriceForMatch(
          ctx.lines,
          productId,
          variantId,
          promo.getUnitId,
          promo.getUnitFactor
        );
        out.push({
          promoId: promo.id,
          promoName: promo.name,
          promoDescription: promo.description,
          productId,
          variantId,
          unitsNeeded: neededInUnit,
          unitLabel: unitLabelFor(productId, promo.getUnitId, promo.getUnitFactor),
          freeUnits: getQty * (targetBundles - getBundles),
          freeUnitLabel: unitLabelFor(productId, promo.getUnitId, promo.getUnitFactor),
          potentialDiscount: (targetBundles - getBundles) * getQty * getUnitPrice
        });
      } else if (getBundles > buyBundles) {
        // Need more buy-side.
        const targetBundles = getBundles;
        const neededBuyBase = targetBundles * buyBaseUnitsPerBundle - availBuy;
        if (neededBuyBase <= 0) continue;
        const factor = promo.buyUnitFactor ?? 1;
        const neededInUnit = Math.ceil(neededBuyBase / factor);
        const getUnitPrice = unitPriceForMatch(
          ctx.lines,
          productId,
          variantId,
          promo.getUnitId,
          promo.getUnitFactor
        );
        out.push({
          promoId: promo.id,
          promoName: promo.name,
          promoDescription: promo.description,
          productId,
          variantId,
          unitsNeeded: neededInUnit,
          unitLabel: unitLabelFor(productId, promo.buyUnitId, promo.buyUnitFactor),
          freeUnits: getQty * (targetBundles - buyBundles),
          freeUnitLabel: unitLabelFor(productId, promo.getUnitId, promo.getUnitFactor),
          potentialDiscount: (targetBundles - buyBundles) * getQty * getUnitPrice
        });
      } else {
        // Equal bundles claimable. Suggest one more bundle for upsell.
        const neededBuy = buyBaseUnitsPerBundle;
        const factor = promo.buyUnitFactor ?? 1;
        const neededInUnit = Math.ceil(neededBuy / factor);
        const getUnitPrice = unitPriceForMatch(
          ctx.lines,
          productId,
          variantId,
          promo.getUnitId,
          promo.getUnitFactor
        );
        out.push({
          promoId: promo.id,
          promoName: promo.name,
          promoDescription: promo.description,
          productId,
          variantId,
          unitsNeeded: neededInUnit,
          unitLabel: unitLabelFor(productId, promo.buyUnitId, promo.buyUnitFactor),
          freeUnits: getQty,
          freeUnitLabel: unitLabelFor(productId, promo.getUnitId, promo.getUnitFactor),
          potentialDiscount: getQty * getUnitPrice
        });
      }
    }
  }
  return out;
}

// Compute net-of-promo subtotal per line. Each line's share of order-level
// discount is proportional to its post-line-discount subtotal.
export function distributePromosAcrossLines(
  lines: CartLineForPromo[],
  applied: AppliedPromo[]
): Map<string, { lineDiscount: number; orderDiscountShare: number }> {
  const out = new Map<string, { lineDiscount: number; orderDiscountShare: number }>();
  for (const l of lines) out.set(l.id, { lineDiscount: 0, orderDiscountShare: 0 });

  for (const a of applied) {
    if (a.level !== 'line') continue;
    if (a.affectedLineIds.length === 0) continue;
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
