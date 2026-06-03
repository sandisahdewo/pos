<script lang="ts">
  import {
    Search,
    Package,
    Trash2,
    Plus,
    Minus,
    ShoppingCart,
    User as UserIcon,
    Receipt,
    History,
    X,
    Clock,
    LogOut,
    Wallet,
    AlertCircle,
    BadgePercent,
    RotateCcw,
    Sparkles,
    ChevronDown,
    ExternalLink,
    ScanLine,
    LayoutGrid,
    Maximize,
    Minimize
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    Collapsible,
    ConfirmDialog,
    Dropdown,
    DropdownItem,
    Input,
    Modal,
    MoneyInput,
    PageHeader,
    Radio,
    Select,
    Textarea,
    Toggle
  } from '$lib/components/ui';
  import {
    computeSalePrice,
    effectiveCost,
    effectiveEntry,
    effectiveVariantCost,
    isComposite,
    priceForQty,
    producibleVariantStock,
    products,
    taxRateFor,
    totalStock,
    type PricelistEntry,
    type Product,
    type ProductVariant
  } from '$lib/stores/products.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { customers, type CustomerType } from '$lib/stores/customers.svelte';
  import {
    applyOrderToStock,
    orders,
    paymentMethodOptions,
    type Order,
    type OrderLine,
    type OrderLineExtra
  } from '$lib/stores/orders.svelte';
  import { batches, stockByLocation } from '$lib/stores/batches.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { settings, serviceTypeLabels, type ServiceType } from '$lib/stores/settings.svelte';
  import { cartSessions, type CartLine } from '$lib/stores/cartSessions.svelte';
  import {
    promotions,
    isPromoUsable,
    promoTargetsProduct,
    shortPromoLabel,
    type Promotion
  } from '$lib/stores/promotions.svelte';
  import {
    resolvePromos,
    distributePromosAcrossLines,
    suggestCombos,
    suggestBogos,
    type CartLineForPromo,
    type AppliedPromo,
    type ComboSuggestion,
    type BogoSuggestion
  } from '$lib/utils/promoResolver';
  import { shifts, salesSummary } from '$lib/stores/shifts.svelte';
  import { employees } from '$lib/stores/employees.svelte';
  import { shiftTemplates } from '$lib/stores/shiftTemplates.svelte';
  import OpenShiftModal from '$lib/components/shifts/OpenShiftModal.svelte';
  import CloseShiftModal from '$lib/components/shifts/CloseShiftModal.svelte';
  import CashEntryModal from '$lib/components/shifts/CashEntryModal.svelte';
  import ReceiptModal from '$lib/components/pos/ReceiptModal.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type Props = {
    /** 'scan' = barcode/search-first, no grid (default). 'grid' = full product browser. */
    mode?: 'grid' | 'scan';
  };
  let { mode = 'scan' }: Props = $props();
  const isScan = $derived(mode === 'scan');

  // Fullscreen toggle via the browser Fullscreen API — hides the browser
  // toolbar for a bigger till while keeping the app sidebar/topbar intact.
  let isFullscreen = $state(false);
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }
  $effect(() => {
    const onChange = () => {
      isFullscreen = !!document.fullscreenElement;
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  });

  // Scan-first input handling: keep the field focused so a USB/Bluetooth
  // scanner types straight into it, and refocus after a manual pick.
  let scanInputEl: HTMLInputElement | null = null;
  function bindScanInput(node: HTMLElement) {
    const el = node.querySelector('input');
    scanInputEl = el;
    el?.focus();
    return {
      destroy() {
        if (scanInputEl === el) scanInputEl = null;
      }
    };
  }
  function addFromSearch(
    p: Product,
    variantId?: string,
    unitId?: string,
    unitFactor: number = 1
  ) {
    addToCart(p, variantId, unitId, unitFactor);
    searchQuery = '';
    scanInputEl?.focus();
  }

  let searchQuery = $state('');
  // Most-recently-added cart line — flashed briefly so a scan visibly lands.
  let lastAddedLineId = $state('');

  // Audible + visual scan feedback: a high beep on a hit, a low beep + red
  // shake on the scan field when a code isn't found.
  let scanError = $state(false);
  let scanErrorTimer: ReturnType<typeof setTimeout> | undefined;
  let audioCtx: AudioContext | null = null;
  function beep(kind: 'success' | 'error') {
    try {
      audioCtx ??= new AudioContext();
      const ctx = audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const dur = kind === 'success' ? 0.1 : 0.22;
      osc.type = kind === 'success' ? 'sine' : 'square';
      osc.frequency.value = kind === 'success' ? 1040 : 200;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Audio unavailable (autoplay policy, etc.) — feedback degrades silently.
    }
  }
  function flashScanError() {
    scanError = true;
    clearTimeout(scanErrorTimer);
    scanErrorTimer = setTimeout(() => (scanError = false), 500);
  }
  let categoryFilter = $state('');
  let confirmChargeOpen = $state(false);
  let confirmClearOpen = $state(false);
  let confirmCloseTabOpen = $state(false);
  let pendingCloseTabId = $state<string | null>(null);

  let openShiftModalOpen = $state(false);
  let closeShiftModalOpen = $state(false);
  let cashEntryModalOpen = $state(false);

  // Nota pembelian shown right after a sale is charged.
  let receiptOpen = $state(false);
  let receiptOrder = $state<Order | null>(null);
  let receiptReceived = $state<number | undefined>(undefined);
  let receiptChange = $state<number | undefined>(undefined);

  const shiftsOn = $derived(settings.value.operations.shiftsEnabled);
  const fnbOn = $derived(settings.value.operations.fnb.enabled);
  const fnbRequireTable = $derived(settings.value.operations.fnb.requireTableNumber);
  const activeShift = $derived(shifts.active());
  const activeShiftEmployee = $derived(
    activeShift ? employees.getById(activeShift.employeeId) : undefined
  );
  const activeShiftTemplate = $derived(
    activeShift?.templateId ? shiftTemplates.getById(activeShift.templateId) : undefined
  );

  function fmtShiftStart(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  const session = $derived(cartSessions.active);

  const activePricelistId = $derived.by(() => {
    if (session.customerId) {
      const c = customers.getById(session.customerId);
      if (c?.pricelistId) return c.pricelistId;
    }
    return pricelists.defaultId();
  });

  const activePricelist = $derived(pricelists.getById(activePricelistId));

  const customerOptions = $derived([
    { value: '', label: 'Pelanggan walk-in' },
    ...customers.items
      .filter((c) => c.status === 'active')
      .map((c) => ({
        value: c.id,
        label: `${c.name} (${pricelists.getById(c.pricelistId)?.name ?? '?'})`
      }))
  ]);

  const categoryFilterOptions = $derived([
    { value: '', label: 'Semua kategori' },
    ...categories.items.map((c) => ({ value: c.id, label: c.name }))
  ]);

  const filteredProducts = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.items.filter((p) => {
      if (p.status !== 'active') return false;
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.variants.some(
          (v) =>
            v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)
        )
      );
    });
  });

  function productStock(p: Product): number {
    return totalStock(p);
  }

  const locationsOn = $derived(settings.value.inventory.locationsEnabled);
  const sortedLocations = $derived(locations.sortedActive());

  // Compact list of (location, qty) for a product, summed across variants. Used
  // by the POS card to tell the cashier where to fetch the product from.
  function productLocationChips(
    p: Product
  ): { name: string; qty: number; customerVisible: boolean }[] {
    const totals = new Map<string, number>();
    if (p.variants.length === 0) {
      for (const [locId, qty] of stockByLocation(p.id)) totals.set(locId, qty);
    } else {
      for (const v of p.variants) {
        for (const [locId, qty] of stockByLocation(p.id, v.id)) {
          totals.set(locId, (totals.get(locId) ?? 0) + qty);
        }
      }
    }
    const out: { name: string; qty: number; customerVisible: boolean }[] = [];
    for (const loc of sortedLocations) {
      const qty = totals.get(loc.id) ?? 0;
      if (qty <= 0) continue;
      out.push({ name: loc.name, qty, customerVisible: loc.customerVisible });
    }
    return out;
  }

  function unitCodeFor(unitId: string): string {
    return units.getById(unitId)?.code ?? '';
  }

  function resolveLine(line: CartLine): {
    product: Product | undefined;
    variant: ProductVariant | undefined;
    unitPrice: number;
    extras: OrderLineExtra[];
    taxRatePct: number;
  } {
    const product = products.getById(line.productId);
    if (!product)
      return { product: undefined, variant: undefined, unitPrice: 0, extras: [], taxRatePct: 0 };

    const variant = line.variantId
      ? product.variants.find((v) => v.id === line.variantId)
      : undefined;

    const isBaseUnit = line.unitId === product.unitId && line.unitFactor === 1;
    const packaging = !isBaseUnit
      ? product.units.find((u) => u.unitId === line.unitId && u.factor === line.unitFactor)
      : undefined;

    let entry: PricelistEntry | undefined;
    let cost: number;
    if (packaging) {
      entry = effectiveEntry(packaging.prices, activePricelistId, pricelists.defaultId());
      cost = line.unitFactor * effectiveCost(product);
    } else if (variant) {
      entry = effectiveEntry(variant.prices, activePricelistId, pricelists.defaultId());
      cost = effectiveVariantCost(variant, product);
    } else {
      entry = effectiveEntry(product.prices, activePricelistId, pricelists.defaultId());
      cost = effectiveCost(product);
    }

    const unitPrice = entry ? priceForQty(entry, line.quantity, cost) : 0;

    const extras: OrderLineExtra[] = [];
    for (const extraId of line.extras) {
      const def = product.extras.find((e) => e.id === extraId);
      if (def) {
        extras.push({ extraId: def.id, name: def.name, priceDelta: def.priceDelta });
      }
    }

    const taxRate = taxRateFor(product);
    return {
      product,
      variant,
      unitPrice,
      extras,
      taxRatePct: taxRate?.rate ?? 0
    };
  }

  function lineSubtotalFor(line: CartLine): number {
    const r = resolveLine(line);
    const extrasSum = r.extras.reduce((s, e) => s + e.priceDelta, 0);
    return line.quantity * (r.unitPrice + extrasSum);
  }

  function lineTaxFor(line: CartLine): number {
    const r = resolveLine(line);
    return (lineSubtotalFor(line) * r.taxRatePct) / 100;
  }

  const cartSubtotal = $derived(
    session.lines.reduce((s, l) => s + lineSubtotalFor(l), 0)
  );

  // Build per-line input for the promo resolver, then resolve against active promos.
  const linesForPromo = $derived.by<CartLineForPromo[]>(() => {
    return session.lines.map((line) => {
      const r = resolveLine(line);
      const subtotal = lineSubtotalFor(line);
      return {
        id: line.id,
        productId: line.productId,
        variantId: line.variantId,
        unitId: line.unitId,
        unitFactor: line.unitFactor,
        quantity: line.quantity,
        baseQuantity: line.quantity * line.unitFactor,
        unitPrice: r.unitPrice,
        subtotal
      };
    });
  });

  const cartCustomer = $derived(session.customerId ? customers.getById(session.customerId) : undefined);

  const appliedPromos = $derived<AppliedPromo[]>(
    resolvePromos({
      lines: linesForPromo,
      customer: cartCustomer,
      at: new Date(),
      dismissedPromoIds: session.dismissedPromoIds ?? []
    })
  );

  // Active promos right now, used to badge product cards. Member-only promos
  // are hidden unless the cart's customer is on the matching pricelist.
  const activePromosNow = $derived(
    promotions.items
      .filter((p) => isPromoUsable(p, new Date()))
      .filter((p) => {
        if (!p.memberPricelistId) return true;
        return cartCustomer?.pricelistId === p.memberPricelistId;
      })
  );

  function promosForProductCard(product: Product): Promotion[] {
    return activePromosNow.filter((promo) =>
      promoTargetsProduct(promo, product.id, product.categoryId)
    );
  }

  // Lookup unit price for (product, variant?, unitId?, unitFactor?). Uses a
  // cart line's resolved price if present and matching unit; otherwise computes
  // from product + active pricelist (including packaging entries).
  function unitPriceFor(
    productId: string,
    variantId?: string,
    unitId?: string,
    unitFactor?: number
  ): number {
    const existing = session.lines.find(
      (l) =>
        l.productId === productId &&
        (l.variantId ?? '') === (variantId ?? '') &&
        (unitId === undefined || l.unitId === unitId) &&
        (unitFactor === undefined || l.unitFactor === unitFactor)
    );
    if (existing) {
      return resolveLine(existing).unitPrice;
    }
    const p = products.getById(productId);
    if (!p) return 0;
    const variant = variantId ? p.variants.find((v) => v.id === variantId) : undefined;
    // If a non-base packaging is requested, resolve from product.units[]
    if (unitId && unitFactor && (unitId !== p.unitId || unitFactor !== 1)) {
      const pkg = p.units.find((u) => u.unitId === unitId && u.factor === unitFactor);
      if (pkg) {
        const entry = effectiveEntry(pkg.prices, activePricelistId, pricelists.defaultId());
        if (entry) {
          return computeSalePrice(unitFactor * effectiveCost(p), entry.pricing);
        }
      }
    }
    const entry = variant
      ? effectiveEntry(variant.prices, activePricelistId, pricelists.defaultId())
      : effectiveEntry(p.prices, activePricelistId, pricelists.defaultId());
    if (!entry) return 0;
    const cost = variant ? effectiveVariantCost(variant, p) : effectiveCost(p);
    return computeSalePrice(cost, entry.pricing);
  }

  const comboSuggestions = $derived<ComboSuggestion[]>(
    suggestCombos(
      {
        lines: linesForPromo,
        customer: cartCustomer,
        at: new Date(),
        dismissedPromoIds: session.dismissedPromoIds ?? []
      },
      unitPriceFor
    )
  );

  const bogoSuggestions = $derived<BogoSuggestion[]>(
    suggestBogos({
      lines: linesForPromo,
      customer: cartCustomer,
      at: new Date(),
      dismissedPromoIds: session.dismissedPromoIds ?? []
    })
  );

  function comboSuggestionsForLine(line: CartLine): ComboSuggestion[] {
    return comboSuggestions.filter((sug) => {
      const promo = promotions.getById(sug.promoId);
      if (!promo?.comboItems) return false;
      return promo.comboItems.some(
        (item) =>
          item.productId === line.productId &&
          (item.variantId ?? '') === (line.variantId ?? '')
      );
    });
  }

  function bogoSuggestionsForLine(line: CartLine): BogoSuggestion[] {
    return bogoSuggestions.filter(
      (sug) =>
        sug.productId === line.productId &&
        (sug.variantId ?? '') === (line.variantId ?? '')
    );
  }

  function appliedPromosForLine(line: CartLine): AppliedPromo[] {
    // Use cart-line id (the same id passed to resolver via linesForPromo).
    return appliedPromos.filter(
      (p) => p.level === 'line' && p.affectedLineIds.includes(line.id)
    );
  }


  const promoDiscount = $derived(
    appliedPromos.reduce((s, p) => s + p.discountAmount, 0)
  );


  // Distribute discount across lines, then recompute per-line tax on the NET subtotal.
  const promoDistribution = $derived(
    distributePromosAcrossLines(linesForPromo, appliedPromos)
  );

  function lineDiscountFor(line: CartLine): number {
    const d = promoDistribution.get(line.id);
    return (d?.lineDiscount ?? 0) + (d?.orderDiscountShare ?? 0);
  }

  function lineNetSubtotalFor(line: CartLine): number {
    return Math.max(0, lineSubtotalFor(line) - lineDiscountFor(line));
  }

  function lineTaxNetFor(line: CartLine): number {
    const r = resolveLine(line);
    return (lineNetSubtotalFor(line) * r.taxRatePct) / 100;
  }

  const cartTax = $derived(session.lines.reduce((s, l) => s + lineTaxNetFor(l), 0));
  const cartNetSubtotal = $derived(Math.max(0, cartSubtotal - promoDiscount));
  const cartTotal = $derived(cartNetSubtotal + cartTax);

  // Compute potentially-applicable promos that the user has dismissed, so we can
  // offer a "Pulihkan" affordance for each.
  const dismissedPromoEntries = $derived<Promotion[]>(
    (session.dismissedPromoIds ?? [])
      .map((id) => promotions.getById(id))
      .filter((p): p is Promotion => p !== undefined)
  );

  function dismissPromo(promoId: string) {
    if (!session.dismissedPromoIds) session.dismissedPromoIds = [];
    if (!session.dismissedPromoIds.includes(promoId)) {
      session.dismissedPromoIds = [...session.dismissedPromoIds, promoId];
      cartSessions.touch();
    }
  }

  function restorePromo(promoId: string) {
    session.dismissedPromoIds = (session.dismissedPromoIds ?? []).filter(
      (id) => id !== promoId
    );
    cartSessions.touch();
  }

  const cashShortcuts = [500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000];
  const paymentChange = $derived(session.paymentAmount - cartTotal);
  const isCash = $derived(session.paymentMethod === 'cash');

  // Suggested cash tendered: round the total UP to the next 1rb / 5rb / 10rb /
  // 50rb / 100rb, so the cashier can one-tap the amount the customer likely
  // hands over (e.g. total 104.000 → 105.000, 110.000, 150.000).
  const cashSuggestions = $derived.by<number[]>(() => {
    if (cartTotal <= 0) return [];
    const steps = [1_000, 5_000, 10_000, 50_000, 100_000];
    const set = new Set<number>();
    for (const step of steps) {
      const up = Math.ceil(cartTotal / step) * step;
      if (up > cartTotal) set.add(up);
    }
    return [...set].sort((a, b) => a - b).slice(0, 3);
  });

  function addPaymentAmount(amount: number) {
    session.paymentAmount = (session.paymentAmount || 0) + amount;
    cartSessions.touch();
  }

  function setPaymentAmount(amount: number) {
    session.paymentAmount = amount;
    cartSessions.touch();
  }

  function resetPaymentAmount() {
    session.paymentAmount = 0;
    cartSessions.touch();
  }

  // For cash sales, paymentAmount drives outcome: < total → credit (piutang),
  // >= total → paid. Non-cash always treated as full payment.
  const isPartialCash = $derived(isCash && session.paymentAmount < cartTotal);
  const selectedCustomer = $derived(
    session.customerId ? customers.getById(session.customerId) : undefined
  );
  const customerCreditAllowed = $derived(!!selectedCustomer?.creditAllowed);
  const creditOutstanding = $derived(
    isPartialCash ? Math.max(0, cartTotal - Math.max(0, session.paymentAmount)) : 0
  );

  const chargeConfirmMessage = $derived.by(() => {
    const head = `${session.lines.length} item · ${formatRupiah(cartTotal)} via ${session.paymentMethod.toUpperCase()}`;
    if (isCash && session.paymentAmount > 0) {
      const diff = session.paymentAmount - cartTotal;
      const tail =
        diff >= 0
          ? `Kembalian ${formatRupiah(diff)}`
          : `Sisa ${formatRupiah(Math.abs(diff))} jadi piutang`;
      return `${head} · Diterima ${formatRupiah(session.paymentAmount)} · ${tail}. Stok akan dikurangi.`;
    }
    if (isPartialCash) {
      return `${head} · Semua jadi piutang (${formatRupiah(cartTotal)}). Stok akan dikurangi.`;
    }
    return `${head}. Stok akan dikurangi.`;
  });

  // Validation hint shown next to the Bayar button when credit is needed but
  // the selected customer / payment combo doesn't allow it.
  const creditBlocker = $derived.by(() => {
    if (!isPartialCash) return '';
    if (!session.customerId)
      return 'Sisa kurang dari total. Pilih pelanggan yang diizinkan kredit untuk transaksi piutang.';
    if (!customerCreditAllowed)
      return `${selectedCustomer?.name ?? 'Pelanggan'} belum diizinkan transaksi piutang. Lengkapi pembayaran atau ubah izin di Pelanggan.`;
    return '';
  });

  function addToCart(
    p: Product,
    variantId?: string,
    unitId?: string,
    unitFactor: number = 1,
    quantity: number = 1
  ) {
    const useVariantId = variantId ?? p.variants[0]?.id;
    const useUnitId = unitId ?? p.unitId;
    const add = Math.max(1, Math.floor(quantity));
    // Scanning/clicking the same item again bumps the existing line's qty
    // instead of stacking duplicate rows (only when that line has no extras).
    const existing = session.lines.find(
      (l) =>
        l.productId === p.id &&
        (l.variantId ?? '') === (useVariantId ?? '') &&
        l.unitId === useUnitId &&
        l.unitFactor === unitFactor &&
        l.extras.length === 0
    );
    if (existing) {
      existing.quantity += add;
      lastAddedLineId = existing.id;
      cartSessions.touch();
      return;
    }
    const id = crypto.randomUUID();
    session.lines.push({
      id,
      productId: p.id,
      variantId: useVariantId,
      unitId: useUnitId,
      unitFactor,
      quantity: add,
      extras: [],
      notes: ''
    });
    lastAddedLineId = id;
    cartSessions.touch();
  }

  function unitNameFor(unitId: string): string {
    return units.getById(unitId)?.name ?? units.getById(unitId)?.code ?? '';
  }

  // Human label for a cart line's chosen unit: base unit shows just its code
  // (e.g. "pcs"); a packaging unit shows the conversion (e.g. "Box · isi 6 pcs").
  function lineUnitLabel(line: CartLine): string {
    const p = products.getById(line.productId);
    if (!p) return unitCodeFor(line.unitId);
    const isBase = line.unitId === p.unitId && line.unitFactor === 1;
    if (isBase) return unitCodeFor(line.unitId) || unitNameFor(line.unitId);
    return `${unitNameFor(line.unitId)} · isi ${line.unitFactor} ${unitCodeFor(p.unitId)}`;
  }

  // Deterministic pastel monogram for cart line items without a photo — gives
  // each product a stable color/initials chip so the cashier recognizes it fast.
  function hueFromString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function monogramOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // Resolve a scanned/typed token to a product + (optional) variant + (optional) packaging unit.
  // Priority — most specific first:
  //   1. variant.barcode    → exact variant
  //   2. packaging.barcode  → product + specific packaging (unit + factor)
  //   3. product.barcode    → product base unit (auto-picks first variant if product has variants)
  //   4. product.sku        → existing fallback
  //   5. variant.sku        → existing fallback
  //   6. batch.code         → existing fallback (BATCH-YYYY-NNN)
  // Returns null if no exact match.
  function resolveScanToken(
    raw: string
  ): {
    product: Product;
    variantId?: string;
    unitId?: string;
    unitFactor?: number;
    source:
      | 'productBarcode'
      | 'variantBarcode'
      | 'packagingBarcode'
      | 'sku'
      | 'variantSku'
      | 'batchCode';
  } | null {
    const token = raw.trim();
    if (!token) return null;

    // 1. Variant barcode
    for (const p of products.items) {
      if (p.status !== 'active') continue;
      const v = p.variants.find((vv) => vv.barcode && vv.barcode === token);
      if (v) return { product: p, variantId: v.id, source: 'variantBarcode' };
    }

    // 2. Packaging barcode
    for (const p of products.items) {
      if (p.status !== 'active') continue;
      const pack = p.units.find((u) => u.barcode && u.barcode === token);
      if (pack) {
        return {
          product: p,
          unitId: pack.unitId,
          unitFactor: pack.factor,
          source: 'packagingBarcode'
        };
      }
    }

    // 3. Product barcode (base unit)
    for (const p of products.items) {
      if (p.status !== 'active') continue;
      if (p.barcode && p.barcode === token) {
        return { product: p, source: 'productBarcode' };
      }
    }

    // 4–5. SKU fallbacks (case-insensitive)
    const lower = token.toLowerCase();
    const byProductSku = products.items.find(
      (p) => p.status === 'active' && p.sku.toLowerCase() === lower
    );
    if (byProductSku) return { product: byProductSku, source: 'sku' };

    for (const p of products.items) {
      if (p.status !== 'active') continue;
      const v = p.variants.find((vv) => vv.sku.toLowerCase() === lower);
      if (v) return { product: p, variantId: v.id, source: 'variantSku' };
    }

    // 6. Batch code
    const batch = batches.getByCode(token);
    if (batch) {
      const p = products.getById(batch.productId);
      if (p && p.status === 'active') {
        return { product: p, variantId: batch.variantId, source: 'batchCode' };
      }
    }

    return null;
  }

  function handleSearchKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    // Quantity multiplier: "<n>x" or "<n>*" before a code adds n at once
    // (e.g. "12x<barcode>"). No prefix → quantity 1.
    let qty = 1;
    let token = searchQuery;
    const mult = searchQuery.match(/^\s*(\d+)\s*[*xX]\s*(.+)$/);
    if (mult) {
      qty = Math.min(999, Math.max(1, parseInt(mult[1], 10) || 1));
      token = mult[2];
    }
    const match = resolveScanToken(token);
    if (!match) {
      // No exact barcode/SKU/batch match. If name search is also empty, this is
      // a genuine "not found" → beep + shake. Otherwise leave the list for the
      // cashier to pick from.
      const q = searchQuery.trim();
      if (q && filteredProducts.length === 0) {
        e.preventDefault();
        beep('error');
        flashScanError();
        toast.error('Tidak ditemukan', `Tidak ada produk untuk "${q}".`);
      }
      return;
    }
    e.preventDefault();
    addToCart(match.product, match.variantId, match.unitId, match.unitFactor, qty);
    const variantName = match.variantId
      ? match.product.variants.find((v) => v.id === match.variantId)?.name
      : '';
    const packagingUnit =
      match.unitId && match.unitId !== match.product.unitId
        ? units.getById(match.unitId)
        : undefined;
    const packagingLabel = packagingUnit
      ? `${packagingUnit.name} · isi ${match.unitFactor}`
      : '';
    const detail = variantName
      ? `${match.product.name} — ${variantName}`
      : packagingLabel
        ? `${match.product.name} (${packagingLabel})`
        : match.product.name;
    const base = match.source === 'batchCode' ? `${detail} · ${token.trim()}` : detail;
    toast.success(
      match.source === 'batchCode' ? 'Ditambahkan dari batch' : 'Ditambahkan ke keranjang',
      qty > 1 ? `${qty} × ${base}` : base
    );
    beep('success');
    searchQuery = '';
  }

  function updateLineQty(lineId: string, delta: number) {
    const idx = session.lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    const next = Math.max(1, session.lines[idx].quantity + delta);
    session.lines[idx].quantity = next;
    cartSessions.touch();
  }

  function setLineQty(lineId: string, qty: number) {
    const idx = session.lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    session.lines[idx].quantity = Math.max(1, Math.floor(qty));
    cartSessions.touch();
  }

  function updateLineUnit(lineId: string, value: string) {
    const idx = session.lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    const [unitId, factorStr] = value.split('|');
    session.lines[idx].unitId = unitId;
    session.lines[idx].unitFactor = Number(factorStr) || 1;
    cartSessions.touch();
  }

  function updateLineVariant(lineId: string, variantId: string) {
    const idx = session.lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    session.lines[idx].variantId = variantId || undefined;
    cartSessions.touch();
  }

  function toggleLineExtra(lineId: string, extraId: string) {
    const idx = session.lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    const line = session.lines[idx];
    line.extras = line.extras.includes(extraId)
      ? line.extras.filter((e) => e !== extraId)
      : [...line.extras, extraId];
    cartSessions.touch();
  }

  function removeLine(lineId: string) {
    session.lines = session.lines.filter((l) => l.id !== lineId);
    cartSessions.touch();
  }

  function clearCart() {
    session.lines = [];
    session.customerId = '';
    session.paymentMethod = 'cash';
    session.paymentAmount = 0;
    cartSessions.touch();
  }

  function unitOptionsFor(p: Product): { value: string; label: string }[] {
    const baseUnit = units.getById(p.unitId);
    const baseCode = baseUnit?.code ?? '?';
    const opts = [
      { value: `${p.unitId}|1`, label: `${baseUnit?.name ?? '?'} (${baseCode})` }
    ];
    for (const pack of p.units) {
      const u = units.getById(pack.unitId);
      if (!u) continue;
      opts.push({
        value: `${pack.unitId}|${pack.factor}`,
        label: `${u.name} — 1 = ${pack.factor} ${baseCode}`
      });
    }
    return opts;
  }

  function variantOptionsFor(p: Product): { value: string; label: string }[] {
    return p.variants.map((v) => ({ value: v.id, label: v.name }));
  }

  async function charge() {
    if (session.lines.length === 0) return;
    // F&B validation: dine-in dengan requireTableNumber wajib isi nomor meja.
    if (fnbOn && fnbRequireTable && session.serviceType === 'dineIn' && !session.tableNumber.trim()) {
      toast.error(
        'Nomor meja kosong',
        'Order dine-in butuh nomor meja. Isi nomor meja atau ganti ke take-away.'
      );
      return;
    }
    // Piutang validation: partial cash payment requires a customer who's
    // explicitly allowed to take credit. Block with a clear toast otherwise.
    if (isPartialCash) {
      if (!session.customerId) {
        toast.error(
          'Piutang ditolak',
          'Pelanggan walk-in tidak diizinkan transaksi piutang. Pilih pelanggan terdaftar atau lengkapi pembayaran.'
        );
        return;
      }
      const cust = customers.getById(session.customerId);
      if (!cust?.creditAllowed) {
        toast.error(
          'Piutang ditolak',
          `${cust?.name ?? 'Pelanggan'} belum diizinkan transaksi piutang. Aktifkan opsi "Boleh berbelanja secara kredit" di profil pelanggan.`
        );
        return;
      }
    }
    // Map cart-line ids to fresh order-line ids so we can rewrite promo applications
    // to point at the persisted order lines.
    const orderLineIdByCart = new Map<string, string>();
    const lines: OrderLine[] = session.lines.map((cl) => {
      const orderLineId = crypto.randomUUID();
      orderLineIdByCart.set(cl.id, orderLineId);
      const r = resolveLine(cl);
      if (!r.product) {
        return {
          id: orderLineId,
          productId: cl.productId,
          variantId: cl.variantId,
          productName: 'Unknown',
          variantName: '',
          unitId: cl.unitId,
          unitFactor: cl.unitFactor,
          unitCode: unitCodeFor(cl.unitId),
          quantity: cl.quantity,
          unitPrice: 0,
          extras: [],
          taxRatePct: 0,
          lineSubtotal: 0,
          linePromoDiscount: 0,
          lineSubtotalNet: 0,
          lineTax: 0,
          lineTotal: 0,
          batchAllocations: []
        };
      }
      const sub = lineSubtotalFor(cl);
      const disc = lineDiscountFor(cl);
      const subNet = Math.max(0, sub - disc);
      const tax = (subNet * r.taxRatePct) / 100;
      return {
        id: orderLineId,
        productId: r.product.id,
        variantId: r.variant?.id,
        productName: r.product.name,
        variantName: r.variant?.name ?? '',
        unitId: cl.unitId,
        unitFactor: cl.unitFactor,
        unitCode: unitCodeFor(cl.unitId),
        quantity: cl.quantity,
        unitPrice: r.unitPrice,
        extras: r.extras,
        taxRatePct: r.taxRatePct,
        lineSubtotal: sub,
        linePromoDiscount: disc,
        lineSubtotalNet: subNet,
        lineTax: tax,
        lineTotal: subNet + tax,
        batchAllocations: []
      };
    });

    // Translate cart-line ids in appliedPromos to the new order-line ids.
    const orderAppliedPromos = appliedPromos.map((p) => ({
      promoId: p.promoId,
      promoCode: p.promoCode,
      promoName: p.promoName,
      kind: p.kind,
      level: p.level,
      affectedLineIds: p.affectedLineIds
        .map((id) => orderLineIdByCart.get(id))
        .filter((x): x is string => !!x),
      discountAmount: p.discountAmount,
      description: p.description
    }));

    // Determine payment outcome:
    // - Non-cash (qris/card/transfer): always treated as paid in full.
    // - Cash >= total: paid in full (excess = change, not stored).
    // - Cash < total (incl. 0): credit. paidAmount = paymentAmount.
    const receivedNow = isCash ? Math.max(0, Math.min(session.paymentAmount, cartTotal)) : cartTotal;
    const willBePaid = isCash ? session.paymentAmount >= cartTotal : true;
    const orderStatus: 'paid' | 'credit' = willBePaid ? 'paid' : 'credit';

    let created: Order;
    try {
      created = await orders.add({
        pricelistId: activePricelistId,
        customerId: session.customerId || undefined,
        employeeId: shiftsOn && activeShift ? activeShift.employeeId : undefined,
        shiftId: shiftsOn && activeShift ? activeShift.id : undefined,
        lines,
        appliedPromos: orderAppliedPromos.length > 0 ? orderAppliedPromos : undefined,
        promoDiscount: promoDiscount > 0 ? promoDiscount : undefined,
        paymentMethod: session.paymentMethod,
        subtotal: cartSubtotal,
        netSubtotal: cartNetSubtotal,
        taxTotal: cartTax,
        total: cartTotal,
        paidAmount: willBePaid ? cartTotal : receivedNow,
        status: orderStatus,
        notes: '',
        serviceType: fnbOn ? session.serviceType : undefined,
        tableNumber:
          fnbOn && session.serviceType === 'dineIn' && session.tableNumber.trim()
            ? session.tableNumber.trim()
            : undefined
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan transaksi', msg);
      return;
    }

    // Increment usage counter on each unique applied promo (best-effort).
    for (const p of orderAppliedPromos) {
      void promotions.incrementUsage(p.promoId);
    }

    await applyOrderToStock(created);

    if (orderStatus === 'credit') {
      const sisa = cartTotal - (willBePaid ? cartTotal : receivedNow);
      toast.success(
        `Transaksi piutang · ${created.code}`,
        `Diterima ${formatRupiah(receivedNow)}, sisa piutang ${formatRupiah(sisa)}`
      );
    } else {
      toast.success(
        `Transaksi selesai · ${created.code}`,
        `${formatRupiah(cartTotal)} via ${session.paymentMethod.toUpperCase()}`
      );
    }

    // Capture the cash figures before the session resets, then pop the nota.
    receiptReceived = isCash ? session.paymentAmount : undefined;
    receiptChange = isCash ? Math.max(0, session.paymentAmount - cartTotal) : undefined;
    receiptOrder = created;
    receiptOpen = true;

    cartSessions.completeActive();
  }

  function requestCloseTab(id: string) {
    const sess = cartSessions.sessions.find((s) => s.id === id);
    if (!sess) return;
    if (sess.lines.length === 0 && !sess.customerId) {
      cartSessions.close(id);
      return;
    }
    pendingCloseTabId = id;
    confirmCloseTabOpen = true;
  }

  function doCloseTab() {
    if (!pendingCloseTabId) return;
    cartSessions.close(pendingCloseTabId);
    pendingCloseTabId = null;
  }

  // === Quick-add customer modal ===
  let addCustomerOpen = $state(false);
  type NewCustomerForm = {
    name: string;
    phone: string;
    type: CustomerType;
    pricelistId: string;
    creditAllowed: boolean;
    notes: string;
  };
  const blankNewCustomer = (): NewCustomerForm => ({
    name: '',
    phone: '',
    type: 'individual',
    pricelistId: pricelists.defaultId(),
    creditAllowed: false,
    notes: ''
  });
  let newCustomerForm = $state<NewCustomerForm>(blankNewCustomer());
  let newCustomerError = $state<string>('');

  const newCustomerTypeOptions = [
    { value: 'individual' as const, label: 'Individu' },
    { value: 'business' as const, label: 'Bisnis' }
  ];

  const newCustomerPricelistOptions = $derived(
    pricelists.items.map((p) => ({
      value: p.id,
      label: p.isDefault ? `${p.name} (utama)` : p.name
    }))
  );

  function openAddCustomer() {
    newCustomerForm = blankNewCustomer();
    newCustomerError = '';
    addCustomerOpen = true;
  }

  async function saveNewCustomer() {
    newCustomerError = '';
    if (!newCustomerForm.name.trim()) {
      newCustomerError = 'Nama pelanggan wajib diisi.';
      return;
    }
    let created;
    try {
      created = await customers.add({
        name: newCustomerForm.name.trim(),
        type: newCustomerForm.type,
        email: '',
        phone: newCustomerForm.phone.trim(),
        address: '',
        pricelistId: newCustomerForm.pricelistId,
        taxId: '',
        status: 'active',
        creditAllowed: newCustomerForm.creditAllowed,
        notes: newCustomerForm.notes.trim(),
        joinedAt: new Date().toISOString().slice(0, 10)
      });
    } catch (err) {
      newCustomerError = err instanceof Error ? err.message : 'Gagal menyimpan pelanggan.';
      return;
    }
    // Auto-select the new customer for the active session
    session.customerId = created.id;
    cartSessions.touch();
    addCustomerOpen = false;
    toast.success('Pelanggan ditambahkan', `${created.name} aktif di tab saat ini.`);
  }
</script>

<PageHeader
  title="Kasir"
  description={isScan
    ? 'Scan barcode untuk menambah barang, atau ketik nama produk untuk mencari.'
    : 'Catat transaksi penjualan. Gunakan tab untuk menahan beberapa pelanggan sekaligus.'}
>
  {#snippet actions()}
    <Button variant="outline" onclick={toggleFullscreen} title="Tampilkan layar penuh">
      {#if isFullscreen}
        <Minimize class="h-4 w-4" />
        Keluar layar penuh
      {:else}
        <Maximize class="h-4 w-4" />
        Layar penuh
      {/if}
    </Button>
    {#if isScan}
      <Button variant="outline" href="/pos/grid">
        <LayoutGrid class="h-4 w-4" />
        Tampilan lengkap
      </Button>
    {:else}
      <Button variant="outline" href="/pos">
        <ScanLine class="h-4 w-4" />
        Mode scan
      </Button>
    {/if}
    {#if shiftsOn}
      {#if activeShift}
        {@const summary = salesSummary(activeShift)}
        <Dropdown align="right">
          {#snippet trigger({ toggle, open })}
            <button
              type="button"
              onclick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
              class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-soft hover:bg-slate-50"
            >
              <span class="relative flex h-2 w-2 shrink-0">
                <span
                  class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
                ></span>
                <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>{activeShiftTemplate?.name ?? 'Shift bebas'}</span>
              <span class="hidden text-xs font-normal text-slate-500 sm:inline">
                · {formatRupiah(summary.byMethod.cash)}
              </span>
              <ChevronDown
                class="h-4 w-4 text-slate-400 transition-transform {open ? 'rotate-180' : ''}"
              />
            </button>
          {/snippet}
          {#snippet children({ close })}
            <div class="border-b border-slate-100 px-4 py-3">
              <div class="text-[11px] font-semibold tracking-wider text-emerald-600 uppercase">
                Shift aktif
              </div>
              <div class="mt-0.5 text-sm font-semibold text-slate-900">
                {activeShiftTemplate?.name ?? 'Shift bebas'}
              </div>
              <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-slate-500">
                <span>Kode</span>
                <span class="text-right font-medium text-slate-700">{activeShift.code}</span>
                <span>Mulai</span>
                <span class="text-right font-medium text-slate-700">
                  {fmtShiftStart(activeShift.openedAt)}
                </span>
                <span>Pesanan</span>
                <span class="text-right font-medium text-slate-700">{summary.orderCount}</span>
                <span>Tunai masuk</span>
                <span class="text-right font-medium text-slate-700">
                  {formatRupiah(summary.byMethod.cash)}
                </span>
              </div>
            </div>
            <DropdownItem
              onclick={() => {
                close();
                cashEntryModalOpen = true;
              }}
            >
              <Wallet class="h-4 w-4 text-slate-400" />
              Tambah kas
            </DropdownItem>
            <DropdownItem href="/shifts/{activeShift.id}">
              <ExternalLink class="h-4 w-4 text-slate-400" />
              Lihat detail shift
            </DropdownItem>
            <DropdownItem
              danger
              onclick={() => {
                close();
                closeShiftModalOpen = true;
              }}
            >
              <LogOut class="h-4 w-4" />
              Tutup shift
            </DropdownItem>
          {/snippet}
        </Dropdown>
      {:else}
        <Button size="sm" variant="outline" onclick={() => (openShiftModalOpen = true)}>
          <Clock class="h-4 w-4" />
          Buka shift
        </Button>
      {/if}
    {/if}
    <Button variant="outline" href="/orders">
      <History class="h-4 w-4" />
      Riwayat transaksi
    </Button>
  {/snippet}
</PageHeader>

<!-- Tab strip + customer picker. In grid mode they sit atop the cart card; in
     scan mode they're lifted above the search so the cart focuses on products. -->
{#snippet tabStrip()}
  <div
    class="scrollbar-thin flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/60 px-2 py-1.5"
  >
    {#each cartSessions.sessions as s (s.id)}
      {@const isActive = s.id === cartSessions.activeSessionId}
      {@const label = cartSessions.labelFor(s)}
      {@const showClose = cartSessions.sessions.length > 1 || s.lines.length > 0 || !!s.customerId}
      <div
        class="inline-flex shrink-0 items-center rounded-md border text-xs font-medium transition-colors
          {isActive
          ? 'border-brand-300 bg-white text-brand-700 shadow-soft'
          : 'border-transparent text-slate-600 hover:bg-white hover:text-slate-900'}"
      >
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 {showClose ? 'pr-1.5' : ''}"
          onclick={() => cartSessions.switchTo(s.id)}
        >
          <span class="max-w-[120px] truncate">{label}</span>
          {#if s.lines.length > 0}
            <span
              class="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-brand-100 px-1 text-[10px] font-semibold text-brand-700"
            >
              {s.lines.length}
            </span>
          {/if}
        </button>
        {#if showClose}
          <button
            type="button"
            class="mr-1 ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Tutup tab"
            onclick={() => requestCloseTab(s.id)}
          >
            <X class="h-3 w-3" />
          </button>
        {/if}
      </div>
    {/each}
    <button
      type="button"
      class="inline-flex shrink-0 items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-500 hover:border-brand-400 hover:bg-white hover:text-brand-700"
      onclick={() => cartSessions.create()}
    >
      <Plus class="h-3 w-3" />
      Tab baru
    </button>
  </div>
{/snippet}

{#snippet customerPicker(bordered: boolean)}
  <div class="p-4 {bordered ? 'border-b border-slate-100' : ''}">
    <div class="grid gap-4 {fnbOn ? 'md:grid-cols-2' : ''}">
      <div>
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-700">Pelanggan</span>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
            onclick={openAddCustomer}
            title="Tambah pelanggan baru"
          >
            <Plus class="h-3 w-3" />
            Tambah
          </button>
        </div>
        <Select
          value={session.customerId}
          options={customerOptions}
          onchange={(e) => {
            session.customerId = (e.currentTarget as HTMLSelectElement).value;
            cartSessions.touch();
          }}
        />
        {#if activePricelist}
          <p class="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
            <UserIcon class="h-3 w-3" />
            Harga: <span class="font-medium text-slate-700">{activePricelist.name}</span>
            {#if activePricelist.isDefault}
              <span class="text-slate-400">(utama)</span>
            {/if}
          </p>
        {/if}
      </div>
      {#if fnbOn}
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Tipe layanan
            </p>
            <Radio
              name="serviceType"
              value="dineIn"
              bind:group={session.serviceType}
              label="Dine-in"
              description="Disajikan & dimakan di tempat"
              onchange={() => cartSessions.touch()}
            />
            <Radio
              name="serviceType"
              value="takeAway"
              bind:group={session.serviceType}
              label="Take-away"
              description="Dibawa pulang oleh pelanggan"
              onchange={() => cartSessions.touch()}
            />
          </div>
          {#if session.serviceType === 'dineIn'}
            <Input
              placeholder="mis. 5"
              label={fnbRequireTable ? 'Nomor meja (wajib)' : 'Nomor meja'}
              bind:value={session.tableNumber}
              oninput={() => cartSessions.touch()}
            />
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<!-- Shared cart-line pieces, reused by the compact card layout (grid mode) and
     the table layout (scan mode) so behavior stays identical in both. -->
{#snippet qtyStepper(line: CartLine, large: boolean)}
  <div class="inline-flex items-center gap-1 rounded-md border border-slate-200">
    <button
      type="button"
      class="text-slate-500 hover:bg-slate-50 hover:text-slate-700 {large ? 'px-2.5 py-1.5' : 'px-2 py-1'}"
      aria-label="Kurangi"
      onclick={() => updateLineQty(line.id, -1)}
    >
      <Minus class={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
    </button>
    <input
      type="number"
      min="1"
      value={line.quantity}
      class="border-0 bg-transparent text-center font-medium focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none {large ? 'w-14 text-lg' : 'w-12 text-sm'}"
      oninput={(e) =>
        setLineQty(line.id, parseInt((e.currentTarget as HTMLInputElement).value, 10) || 1)}
    />
    <button
      type="button"
      class="text-slate-500 hover:bg-slate-50 hover:text-slate-700 {large ? 'px-2.5 py-1.5' : 'px-2 py-1'}"
      aria-label="Tambah"
      onclick={() => updateLineQty(line.id, 1)}
    >
      <Plus class={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
    </button>
  </div>
{/snippet}

{#snippet lineSelects(line: CartLine, product: Product)}
  {@const variantOpts = variantOptionsFor(product)}
  {@const unitOpts = unitOptionsFor(product)}
  {#if variantOpts.length > 0}
    <Select
      value={line.variantId ?? ''}
      options={variantOpts}
      onchange={(e) => updateLineVariant(line.id, (e.currentTarget as HTMLSelectElement).value)}
    />
  {/if}
  {#if unitOpts.length > 1}
    <Select
      value={`${line.unitId}|${line.unitFactor}`}
      options={unitOpts}
      onchange={(e) => updateLineUnit(line.id, (e.currentTarget as HTMLSelectElement).value)}
    />
  {/if}
{/snippet}

{#snippet lineDetails(line: CartLine, product: Product)}
  {#if appliedPromosForLine(line).length > 0 || comboSuggestionsForLine(line).length > 0 || bogoSuggestionsForLine(line).length > 0}
    <div class="mt-2 space-y-1">
      {#each appliedPromosForLine(line) as p (p.promoId)}
        <div class="flex w-fit max-w-full items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50/70 px-2 py-1">
          <BadgePercent class="h-3 w-3 shrink-0 text-emerald-600" />
          <span class="truncate text-[11px] font-medium text-emerald-800" title={p.description}>
            {p.promoName} aktif
          </span>
        </div>
      {/each}
      {#each comboSuggestionsForLine(line) as sug (sug.promoId)}
        <div class="flex w-fit max-w-full items-start gap-1.5 rounded-md border border-amber-100 bg-amber-50/60 px-2 py-1 text-[11px]">
          <Sparkles class="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          <div class="min-w-0 leading-tight">
            <span class="text-amber-800">Tambah </span>
            {#each sug.needed as need, i (need.productId + (need.variantId ?? ''))}
              <span class="font-semibold text-amber-900">{need.quantity} {need.unitLabel ? need.unitLabel + ' ' : ''}{need.productName}</span>{#if i < sug.needed.length - 1}<span class="text-amber-800"> dan </span>{/if}
            {/each}
            <span class="text-amber-800"> → {sug.promoName} (hemat {formatRupiah(sug.potentialDiscount)})</span>
          </div>
        </div>
      {/each}
      {#each bogoSuggestionsForLine(line) as sug (sug.promoId + (sug.variantId ?? ''))}
        <div class="flex w-fit max-w-full items-start gap-1.5 rounded-md border border-amber-100 bg-amber-50/60 px-2 py-1 text-[11px]">
          <Sparkles class="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          <div class="min-w-0 leading-tight">
            <span class="text-amber-800">Tambah </span>
            <span class="font-semibold text-amber-900">{sug.unitsNeeded} {sug.unitLabel ?? ''} lagi</span>
            <span class="text-amber-800"> untuk dapat {sug.freeUnits} {sug.freeUnitLabel ?? ''} gratis ({sug.promoName})</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if product.extras.length > 0}
    <div class="mt-2 border-t border-slate-100 pt-2">
      <Collapsible
        title={line.extras.length > 0 ? `${line.extras.length} ekstra` : 'Tambah ekstra'}
      >
        <div class="space-y-1">
          {#each product.extras as extra (extra.id)}
            <label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
              <input
                type="checkbox"
                class="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
                checked={line.extras.includes(extra.id)}
                onchange={() => toggleLineExtra(line.id, extra.id)}
              />
              <span class="flex-1 text-slate-700">{extra.name}</span>
              <span class="text-slate-500">
                {extra.priceDelta >= 0 ? '+' : ''}{formatRupiah(extra.priceDelta)}
              </span>
            </label>
          {/each}
        </div>
      </Collapsible>
    </div>
  {/if}
{/snippet}

{#snippet cartTable()}
  <table class="w-full border-collapse text-sm">
    <thead>
      <tr class="border-b border-slate-200 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
        <th class="py-2 pr-3 pl-2 text-left font-semibold">Produk</th>
        <th class="w-[1%] px-3 py-2 text-center font-semibold whitespace-nowrap">Jumlah</th>
        <th class="w-[1%] px-3 py-2 text-right font-semibold whitespace-nowrap">Harga</th>
        <th class="w-[1%] px-3 py-2 text-right font-semibold whitespace-nowrap">Diskon</th>
        <th class="w-[1%] px-3 py-2 text-right font-semibold whitespace-nowrap">Subtotal</th>
        <th class="w-[1%] py-2 pr-2 pl-1"></th>
      </tr>
    </thead>
    <tbody>
      {#each session.lines as line (line.id)}
        {@const r = resolveLine(line)}
        {@const product = r.product}
        {#if product}
          {@const sub = lineSubtotalFor(line)}
          {@const tax = lineTaxFor(line)}
          {@const hasSelects =
            variantOptionsFor(product).length > 0 || unitOptionsFor(product).length > 1}
          {@const lineSku = r.variant?.sku || product.sku}
          {@const disc = lineDiscountFor(line)}
          {@const hue = hueFromString(product.id + (r.variant?.id ?? ''))}
          <tr
            class="group border-b border-slate-100 align-top transition-colors hover:bg-slate-50/70 {line.id ===
            lastAddedLineId
              ? 'just-added'
              : ''}"
          >
            <td class="py-3 pr-3 pl-2">
              <div class="flex gap-3">
                {#if product.imageUrl}
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    class="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-slate-200/70"
                    loading="lazy"
                  />
                {:else}
                  <div
                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                    style="background: hsl({hue} 72% 95%); color: hsl({hue} 45% 38%);"
                  >
                    {monogramOf(product.name)}
                  </div>
                {/if}
                <div class="min-w-0">
                  <div class="font-medium text-slate-900">{product.name}</div>
                  {#if r.variant}
                    <div class="text-xs text-slate-500">{r.variant.name}</div>
                  {/if}
                  {#if lineSku}
                    <div class="mt-0.5 font-mono text-[11px] text-slate-400">{lineSku}</div>
                  {/if}
                  {#if hasSelects}
                    <div class="mt-2 flex flex-wrap gap-2">
                      {@render lineSelects(line, product)}
                    </div>
                  {/if}
                  {@render lineDetails(line, product)}
                </div>
              </div>
            </td>
            <td class="w-[1%] px-3 py-3 whitespace-nowrap">
              <div class="flex flex-col items-center gap-1">
                {@render qtyStepper(line, true)}
                <span class="text-xs font-medium text-slate-500">{lineUnitLabel(line)}</span>
              </div>
            </td>
            <td class="w-[1%] px-3 py-3 text-right text-base font-medium whitespace-nowrap text-slate-600 [font-variant-numeric:tabular-nums]">
              {formatRupiah(r.unitPrice)}
            </td>
            <td class="w-[1%] px-3 py-3 text-right whitespace-nowrap [font-variant-numeric:tabular-nums]">
              {#if disc > 0}
                <span
                  class="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-sm font-semibold text-emerald-700"
                >
                  −{formatRupiah(disc)}
                </span>
              {:else}
                <span class="text-slate-300">—</span>
              {/if}
            </td>
            <td class="w-[1%] px-3 py-3 text-right whitespace-nowrap [font-variant-numeric:tabular-nums]">
              <div class="text-lg font-bold text-slate-900">{formatRupiah(sub)}</div>
              {#if tax > 0}
                <div class="text-[10px] text-slate-400">+ {formatRupiah(tax)} pajak</div>
              {/if}
            </td>
            <td class="w-[1%] py-3 pr-2 pl-1 text-right align-middle">
              <button
                type="button"
                class="rounded-md p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Hapus {product.name}"
                onclick={() => removeLine(line.id)}
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
{/snippet}

{#snippet cartLines()}
  <div class="overflow-y-auto p-4 {isScan ? '' : 'max-h-[50vh] space-y-3'}">
    {#if session.lines.length === 0}
      <div class="flex flex-col items-center gap-2 py-12 text-center text-sm text-slate-400">
        <ShoppingCart class="h-8 w-8" />
        <p>
          Tab ini kosong. {isScan
            ? 'Scan barcode untuk menambahkan.'
            : 'Klik produk untuk menambahkan.'}
        </p>
      </div>
    {:else if isScan}
      {@render cartTable()}
    {:else}
      {#each session.lines as line (line.id)}
        {@const r = resolveLine(line)}
        {@const product = r.product}
        {#if product}
          {@const variantOpts = variantOptionsFor(product)}
          {@const unitOpts = unitOptionsFor(product)}
          {@const sub = lineSubtotalFor(line)}
          {@const tax = lineTaxFor(line)}
          {@const showVariant = variantOpts.length > 0}
          {@const showUnit = unitOpts.length > 1}
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-slate-900">{product.name}</div>
                {#if r.variant}
                  <div class="text-xs text-slate-500">{r.variant.name}</div>
                {/if}
              </div>
              <button
                type="button"
                class="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Hapus"
                onclick={() => removeLine(line.id)}
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>

            {#if showVariant || showUnit}
              <div class="mt-2 grid grid-cols-2 gap-2">
                {@render lineSelects(line, product)}
              </div>
            {/if}

            <div class="mt-2 flex items-center justify-between gap-2">
              {@render qtyStepper(line, false)}
              <div class="text-right">
                <div class="text-sm font-semibold text-slate-900">{formatRupiah(sub)}</div>
                {#if tax > 0}
                  <div class="text-[10px] text-slate-400">+ {formatRupiah(tax)} pajak</div>
                {/if}
              </div>
            </div>

            {@render lineDetails(line, product)}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
{/snippet}

{#snippet summaryPanel()}
  <div class="border-t border-slate-100 bg-slate-50/40 p-4">
    <dl class="space-y-1 text-sm">
      <div class="flex justify-between">
        <dt class="text-slate-500">Subtotal</dt>
        <dd class="text-slate-700 [font-variant-numeric:tabular-nums]">{formatRupiah(cartSubtotal)}</dd>
      </div>

      {#if appliedPromos.length > 0}
        <div class="space-y-1 rounded-md border border-emerald-100 bg-emerald-50/70 px-2 py-1.5">
          {#each appliedPromos as p (p.promoId)}
            <div class="flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-1.5">
                <BadgePercent class="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span class="truncate text-xs font-medium text-emerald-800" title={p.description}>
                  {p.promoName}
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-semibold text-emerald-700 [font-variant-numeric:tabular-nums]">
                  −{formatRupiah(p.discountAmount)}
                </span>
                <button
                  type="button"
                  class="rounded p-0.5 text-emerald-700/70 hover:bg-emerald-100 hover:text-rose-600"
                  aria-label="Hapus promo dari transaksi"
                  title="Hapus promo dari transaksi ini"
                  onclick={() => dismissPromo(p.promoId)}
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if dismissedPromoEntries.length > 0}
        <div class="space-y-1">
          {#each dismissedPromoEntries as p (p.id)}
            <div class="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span class="truncate line-through" title={p.description}>{p.name}</span>
              <button
                type="button"
                class="flex items-center gap-1 rounded px-1 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                onclick={() => restorePromo(p.id)}
              >
                <RotateCcw class="h-3 w-3" />
                Pulihkan
              </button>
            </div>
          {/each}
        </div>
      {/if}

      {#if cartTax > 0}
        <div class="flex justify-between">
          <dt class="text-slate-500">Pajak</dt>
          <dd class="text-slate-700 [font-variant-numeric:tabular-nums]">{formatRupiah(cartTax)}</dd>
        </div>
      {/if}
      <div class="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2">
        <dt class="text-base font-semibold text-slate-900">Total</dt>
        <dd class="text-2xl font-bold text-slate-900 [font-variant-numeric:tabular-nums]">
          {formatRupiah(cartTotal)}
        </dd>
      </div>
      {#if promoDiscount > 0}
        <div class="-mt-1 text-right text-xs text-emerald-600">
          Hemat {formatRupiah(promoDiscount)}
        </div>
      {/if}
    </dl>

    <div class="mt-3">
      <span class="mb-1 block text-xs font-medium text-slate-500">Pembayaran</span>
      <div class="grid grid-cols-2 gap-1.5">
        {#each paymentMethodOptions as opt}
          <button
            type="button"
            class="rounded-md border px-2 py-2 text-xs font-medium transition-colors {session.paymentMethod ===
            opt.value
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'}"
            onclick={() => {
              session.paymentMethod = opt.value;
              cartSessions.touch();
            }}
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </div>

    {#if isCash}
      <div class="mt-3">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs font-medium text-slate-500">Uang diterima</span>
          {#if session.paymentAmount > 0}
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-600"
              onclick={resetPaymentAmount}
            >
              <X class="h-3 w-3" />
              Reset
            </button>
          {/if}
        </div>
        <MoneyInput
          bind:value={session.paymentAmount}
          class="[&_input]:h-14 [&_input]:pl-11 [&_input]:text-lg [&_input]:font-semibold [&_span]:text-base"
        />
        {#if cartTotal > 0}
          <!-- Uang pas + saran nominal (set exact tendered amount) -->
          <div class="mt-2 grid grid-cols-4 gap-1">
            <button
              type="button"
              class="rounded-md border border-brand-300 bg-brand-50 px-1 py-1.5 text-[11px] font-semibold whitespace-nowrap text-brand-700 transition-colors hover:bg-brand-100"
              onclick={() => setPaymentAmount(cartTotal)}
            >
              Uang pas
            </button>
            {#each cashSuggestions as amount (amount)}
              <button
                type="button"
                class="rounded-md border border-brand-200 bg-white px-1 py-1.5 text-[11px] font-medium whitespace-nowrap text-brand-700 transition-colors [font-variant-numeric:tabular-nums] hover:border-brand-300 hover:bg-brand-50"
                onclick={() => setPaymentAmount(amount)}
              >
                {formatRupiah(amount)}
              </button>
            {/each}
          </div>
        {/if}
        <div class="mt-1 grid grid-cols-4 gap-1">
          {#each cashShortcuts as amount (amount)}
            <button
              type="button"
              class="rounded-md border border-slate-200 px-1 py-1.5 text-[11px] font-medium whitespace-nowrap text-slate-700 transition-colors [font-variant-numeric:tabular-nums] hover:border-brand-300 hover:bg-brand-50 active:bg-brand-100"
              onclick={() => addPaymentAmount(amount)}
            >
              +{formatRupiah(amount)}
            </button>
          {/each}
        </div>
        {#if session.paymentAmount > 0}
          <div class="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2">
            <dt class="text-base font-semibold text-slate-700">
              {paymentChange >= 0 ? 'Kembalian' : 'Sisa piutang'}
            </dt>
            <dd
              class="text-2xl font-bold [font-variant-numeric:tabular-nums] {paymentChange >= 0
                ? 'text-emerald-600'
                : 'text-amber-700'}"
            >
              {formatRupiah(Math.abs(paymentChange))}
            </dd>
          </div>
        {/if}
      </div>
    {/if}

    {#if isPartialCash}
      {#if creditBlocker}
        <div class="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <p class="font-semibold">Piutang tidak diizinkan</p>
          <p class="mt-0.5">{creditBlocker}</p>
        </div>
      {:else}
        <div class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p class="font-semibold">Transaksi piutang · {formatRupiah(creditOutstanding)}</p>
          <p class="mt-0.5">
            Sisa {formatRupiah(creditOutstanding)} akan dicatat sebagai piutang
            {selectedCustomer ? `untuk ${selectedCustomer.name}` : ''}. Bisa dilunasi nanti di Piutang
            Pelanggan.
          </p>
        </div>
      {/if}
    {/if}

    <div class="mt-4 grid grid-cols-[auto_1fr] gap-2">
      <Button
        variant="outline"
        onclick={() => (confirmClearOpen = true)}
        disabled={session.lines.length === 0}
      >
        Bersihkan
      </Button>
      <Button
        size="lg"
        onclick={() => (confirmChargeOpen = true)}
        disabled={session.lines.length === 0 || !!creditBlocker}
      >
        <Receipt class="h-4 w-4" />
        {isPartialCash && !creditBlocker ? 'Catat piutang' : 'Bayar'}
      </Button>
    </div>
  </div>
{/snippet}

<div
  class={isScan
    ? 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(320px,360px)] lg:items-start'
    : 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]'}
>
  {#if isScan}
    <!-- LEFT pane: tabs + customer + scan + product list -->
    <div class="flex min-w-0 flex-col gap-4">
      <Card padded={false}>
        {@render tabStrip()}
        {@render customerPicker(false)}
      </Card>
    <!-- SCAN BAR — sticky at top; search results float over the cart, never shifting it -->
    <Card padded={false} class="sticky top-16 z-30">
      <div class="p-4" use:bindScanInput>
        <div class="relative">
          <ScanLine
            class="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Scan barcode / QR batch — atau ketik nama produk"
            bind:value={searchQuery}
            onkeydown={handleSearchKeyDown}
            class="h-14 w-full rounded-xl border bg-white pr-28 pl-12 text-base font-medium text-slate-900 shadow-soft transition placeholder:font-normal placeholder:text-slate-400 focus:outline-none {scanError
              ? 'scan-shake border-rose-400 ring-4 ring-rose-200'
              : 'border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100'}"
          />
          <span
            class="absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
          >
            <span class="relative flex h-2 w-2">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70"
              ></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            Siap
          </span>
        </div>
        <p class="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
          <AlertCircle class="h-3.5 w-3.5 shrink-0" />
          <span>Scan untuk menambah, atau ketik nama lalu pilih dari daftar.</span>
          <span class="text-slate-300">·</span>
          <span>
            Ketik
            <kbd class="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-[10px] text-slate-600">2x</kbd>
            atau
            <kbd class="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-[10px] text-slate-600">2*</kbd>
            sebelum scan untuk menambah 2 sekaligus.
          </span>
        </p>
      </div>

      {#if searchQuery.trim()}
        <!-- Floating results: overlays the cart instead of pushing it down -->
        <div
          class="scrollbar-thin absolute top-full right-0 left-0 z-10 mt-1 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {#each filteredProducts.slice(0, 50) as p (p.id)}
            {@const stock = productStock(p)}
            {@const baseEntry = effectiveEntry(p.prices, activePricelistId, pricelists.defaultId())}
            {@const cost = effectiveCost(p)}
            {@const sale = baseEntry ? computeSalePrice(cost, baseEntry.pricing) : NaN}
            {@const disabled = stock <= 0 && !isComposite(p)}
            {@const baseCode = unitCodeFor(p.unitId)}
            <div class="p-3 {disabled ? 'opacity-50' : ''}">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                  {disabled}
                  onclick={() => addFromSearch(p)}
                  title="Tambah {p.name}"
                >
                  {#if p.imageUrl}
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      class="h-10 w-10 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  {:else}
                    <div
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-300"
                    >
                      <Package class="h-5 w-5" />
                    </div>
                  {/if}
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium text-slate-900">{p.name}</div>
                    <div class="truncate text-xs text-slate-500">{p.sku} · {stock} {baseCode}</div>
                  </div>
                </button>
                <div class="shrink-0 text-sm font-semibold text-slate-900">
                  {Number.isFinite(sale) ? formatRupiah(sale) : '—'}
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-soft hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                  {disabled}
                  aria-label="Tambah {p.name}"
                  onclick={() => addFromSearch(p)}
                >
                  <Plus class="h-4 w-4" />
                </button>
              </div>

              {#if p.variants.length > 0}
                <div class="mt-2 flex flex-wrap gap-1">
                  {#each p.variants as v (v.id)}
                    {@const vStock = producibleVariantStock(p.id, v)}
                    {@const vDisabled = vStock <= 0 && !isComposite(p)}
                    <button
                      type="button"
                      class="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={vDisabled}
                      onclick={() => addFromSearch(p, v.id)}
                    >
                      <Plus class="h-2.5 w-2.5" />
                      {v.name}
                      {#if vStock > 0}<span class="text-slate-400">·{vStock}</span>{/if}
                    </button>
                  {/each}
                </div>
              {:else if p.units.length > 0}
                <div class="mt-2 flex flex-wrap gap-1">
                  {#each p.units as pkg (`${pkg.unitId}|${pkg.factor}`)}
                    <button
                      type="button"
                      class="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                      {disabled}
                      onclick={() => addFromSearch(p, undefined, pkg.unitId, pkg.factor)}
                    >
                      <Plus class="h-2.5 w-2.5" />
                      {unitNameFor(pkg.unitId)}
                      <span class="text-slate-400">·{pkg.factor}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}

          {#if filteredProducts.length === 0}
            <div class="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-slate-500">
              <Search class="h-7 w-7 text-slate-300" />
              <p>Tidak ada produk cocok dengan "{searchQuery}".</p>
              <p class="text-xs text-slate-400">Coba scan barcode atau periksa ejaan nama.</p>
            </div>
          {/if}
        </div>
      {/if}
      </Card>

      <!-- product list (left pane, below the sticky search) -->
      <Card padded={false}>
        {@render cartLines()}
      </Card>
    </div>

    <!-- RIGHT pane: sticky checkout summary -->
    <div class="lg:sticky lg:top-16 lg:self-start">
      <Card padded={false}>
        {@render summaryPanel()}
      </Card>
    </div>
  {:else}
  <!-- PRODUCT BROWSER -->
  <Card padded={false}>
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
      <div class="min-w-[220px] flex-1">
        <Input
          placeholder="Cari nama / SKU / scan barcode / QR batch (tekan Enter)…"
          bind:value={searchQuery}
          onkeydown={handleSearchKeyDown}
        >
          {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
        </Input>
      </div>
      <Select bind:value={categoryFilter} options={categoryFilterOptions} class="w-44" />
    </div>

    <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {#each filteredProducts as p (p.id)}
        {@const stock = productStock(p)}
        {@const baseEntry = effectiveEntry(p.prices, activePricelistId, pricelists.defaultId())}
        {@const cost = effectiveCost(p)}
        {@const sale = baseEntry ? computeSalePrice(cost, baseEntry.pricing) : NaN}
        {@const disabled = stock <= 0 && !isComposite(p)}
        {@const baseCode = unitCodeFor(p.unitId)}
        {@const cardPromos = promosForProductCard(p)}
        <div
          class="group relative flex flex-col rounded-lg border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-soft
            {disabled ? 'opacity-50' : ''}"
        >
          {#if cardPromos.length > 0}
            <div class="pointer-events-none absolute top-1.5 right-1.5 z-10 flex flex-wrap justify-end gap-1">
              {#each cardPromos.slice(0, 2) as promo (promo.id)}
                <span
                  class="inline-flex items-center gap-0.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                  title={`${promo.name}${promo.description ? ' — ' + promo.description : ''}`}
                >
                  <BadgePercent class="h-3 w-3" />
                  {shortPromoLabel(promo)}
                </span>
              {/each}
              {#if cardPromos.length > 2}
                <span
                  class="inline-flex items-center rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                  title={cardPromos.slice(2).map((p) => p.name).join(', ')}
                >
                  +{cardPromos.length - 2}
                </span>
              {/if}
            </div>
          {/if}
          <button
            type="button"
            class="flex flex-1 flex-col gap-1 p-2 text-left disabled:cursor-not-allowed"
            {disabled}
            onclick={() => addToCart(p)}
            title="Tambah 1 {baseCode || 'unit'}"
          >
            {#if p.imageUrl}
              <img
                src={p.imageUrl}
                alt={p.name}
                class="h-24 w-full rounded-md object-cover"
                loading="lazy"
              />
            {:else}
              <div
                class="flex h-24 w-full items-center justify-center rounded-md bg-slate-50 text-slate-300"
              >
                <Package class="h-8 w-8" />
              </div>
            {/if}
            <div class="mt-1 flex-1">
              <div class="line-clamp-2 text-sm font-medium text-slate-900">{p.name}</div>
            </div>
            {#if locationsOn}
              {@const chips = productLocationChips(p)}
              {#if chips.length > 0}
                {@const visibleQty = chips
                  .filter((c) => c.customerVisible)
                  .reduce((s, c) => s + c.qty, 0)}
                {#if visibleQty === 0}
                  <div class="mt-0.5 inline-flex items-center self-start rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    Ambil dari: {chips.map((c) => `${c.name} · ${c.qty}`).join(' / ')}
                  </div>
                {:else}
                  <div class="mt-0.5 flex flex-wrap gap-x-1.5 text-[10px] leading-tight text-slate-500">
                    {#each chips as c (c.name)}
                      <span class={c.customerVisible ? 'text-emerald-700' : ''}>
                        {c.name} · <span class="font-medium">{c.qty}</span>
                      </span>
                    {/each}
                  </div>
                {/if}
              {/if}
            {/if}
            <div class="flex items-center justify-between gap-1">
              <span class="text-sm font-semibold text-slate-900">
                {Number.isFinite(sale) ? formatRupiah(sale) : '—'}
              </span>
              <span class="text-[10px] text-slate-500">
                {stock} {baseCode}
              </span>
            </div>
          </button>

          {#if p.variants.length > 0}
            <div class="flex flex-wrap gap-1 border-t border-slate-100 p-1.5">
              {#each p.variants as v (v.id)}
                {@const vStock = producibleVariantStock(p.id, v)}
                {@const vDisabled = vStock <= 0 && !isComposite(p)}
                <button
                  type="button"
                  class="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={vDisabled}
                  onclick={() => addToCart(p, v.id)}
                  title="Tambah {v.name}{baseCode ? ` · ${vStock} ${baseCode}` : ''}"
                >
                  <Plus class="h-2.5 w-2.5" />
                  {v.name}
                  {#if vStock > 0}
                    <span class="text-slate-400">·{vStock}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {:else if p.units.length > 0}
            <div class="flex flex-wrap gap-1 border-t border-slate-100 p-1.5">
              <button
                type="button"
                class="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                {disabled}
                onclick={() => addToCart(p)}
                title="Tambah 1 {baseCode}"
              >
                <Plus class="h-2.5 w-2.5" />
                {baseCode || unitNameFor(p.unitId)}
              </button>
              {#each p.units as pkg (`${pkg.unitId}|${pkg.factor}`)}
                <button
                  type="button"
                  class="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                  {disabled}
                  onclick={() => addToCart(p, undefined, pkg.unitId, pkg.factor)}
                  title="Tambah 1 {unitNameFor(pkg.unitId)} = {pkg.factor} {baseCode}"
                >
                  <Plus class="h-2.5 w-2.5" />
                  {unitNameFor(pkg.unitId)}
                  <span class="text-slate-400">·{pkg.factor}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}

      {#if filteredProducts.length === 0}
        <div
          class="col-span-full flex flex-col items-center gap-2 py-12 text-center text-sm text-slate-500"
        >
          <Package class="h-8 w-8 text-slate-300" />
          <p>Tidak ada produk yang cocok.</p>
        </div>
      {/if}
    </div>
  </Card>
    <!-- cart on the right (grid mode): tabs + customer + lines + checkout -->
    <div class="lg:sticky lg:top-4 lg:self-start">
      <Card padded={false}>
        {@render tabStrip()}
        {@render customerPicker(true)}
        {@render cartLines()}
        {@render summaryPanel()}
      </Card>
    </div>
  {/if}
</div>

<ConfirmDialog
  bind:open={confirmChargeOpen}
  title="Selesaikan transaksi?"
  message={chargeConfirmMessage}
  confirmLabel="Bayar"
  variant="primary"
  onConfirm={charge}
/>

<ConfirmDialog
  bind:open={confirmClearOpen}
  title="Bersihkan tab ini?"
  message="Semua item dan pilihan pelanggan pada tab ini akan dihapus. Tab lain tidak terpengaruh."
  confirmLabel="Bersihkan tab"
  onConfirm={clearCart}
/>

<ConfirmDialog
  bind:open={confirmCloseTabOpen}
  title="Tutup tab?"
  message={pendingCloseTabId
    ? (() => {
        const s = cartSessions.sessions.find((x) => x.id === pendingCloseTabId);
        if (!s) return '';
        return `"${cartSessions.labelFor(s)}" memiliki ${s.lines.length} item yang akan dibuang.`;
      })()
    : ''}
  confirmLabel="Tutup tab"
  onConfirm={doCloseTab}
  onCancel={() => (pendingCloseTabId = null)}
/>

<Modal
  bind:open={addCustomerOpen}
  size="md"
  title="Tambah pelanggan"
  description="Pelanggan baru akan langsung dipilih untuk tab Kasir saat ini. Lengkapi detail lain nanti di menu Pelanggan."
>
  <div class="grid gap-4">
    <Input
      label="Nama"
      placeholder="mis. Budi Santoso"
      bind:value={newCustomerForm.name}
      error={newCustomerError && !newCustomerForm.name.trim() ? newCustomerError : ''}
    />
    <Input
      label="Telepon"
      placeholder="+62 ..."
      bind:value={newCustomerForm.phone}
    />
    <div class="grid gap-3 sm:grid-cols-2">
      <Select label="Tipe" bind:value={newCustomerForm.type} options={newCustomerTypeOptions} />
      <Select
        label="Daftar harga"
        bind:value={newCustomerForm.pricelistId}
        options={newCustomerPricelistOptions}
      />
    </div>
    <Toggle
      bind:checked={newCustomerForm.creditAllowed}
      label="Izinkan transaksi piutang/bon"
      description="Saat aktif, kasir bisa menyelesaikan transaksi dengan pembayaran kurang dari total."
    />
    <Textarea
      label="Catatan (opsional)"
      placeholder="Preferensi, termin pembayaran, dll."
      bind:value={newCustomerForm.notes}
    />
    {#if newCustomerError && newCustomerForm.name.trim()}
      <p class="text-sm text-rose-600">{newCustomerError}</p>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (addCustomerOpen = false)}>Batal</Button>
    <Button onclick={saveNewCustomer}>Tambah & pilih</Button>
  {/snippet}
</Modal>

<OpenShiftModal bind:open={openShiftModalOpen} />
<CloseShiftModal bind:open={closeShiftModalOpen} shift={activeShift} />
<CashEntryModal bind:open={cashEntryModalOpen} shift={activeShift} />

<ReceiptModal
  bind:open={receiptOpen}
  order={receiptOrder}
  received={receiptReceived}
  change={receiptChange}
  closeLabel="Transaksi baru"
/>

<style>
  /* Brief emerald flash when a scanned/added item lands in the cart table. */
  @keyframes -global-just-added-flash {
    from {
      background-color: rgb(209 250 229);
    }
    to {
      background-color: transparent;
    }
  }
  :global(tr.just-added) {
    animation: just-added-flash 1.1s ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(tr.just-added) {
      animation: none;
    }
  }

  /* Red shake on the scan field when a scanned code isn't found. */
  @keyframes -global-scan-shake {
    0%,
    100% {
      transform: translateX(0);
    }
    20% {
      transform: translateX(-5px);
    }
    40% {
      transform: translateX(5px);
    }
    60% {
      transform: translateX(-3px);
    }
    80% {
      transform: translateX(3px);
    }
  }
  :global(.scan-shake) {
    animation: scan-shake 0.35s ease-in-out;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.scan-shake) {
      animation: none;
    }
  }
</style>
