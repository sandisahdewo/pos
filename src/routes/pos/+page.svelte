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
    RotateCcw
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    Collapsible,
    ConfirmDialog,
    Input,
    Modal,
    MoneyInput,
    PageHeader,
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
    type OrderLine,
    type OrderLineExtra
  } from '$lib/stores/orders.svelte';
  import { batches, stockByLocation } from '$lib/stores/batches.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { cartSessions, type CartLine } from '$lib/stores/cartSessions.svelte';
  import { promotions, type Promotion } from '$lib/stores/promotions.svelte';
  import {
    resolvePromos,
    distributePromosAcrossLines,
    type CartLineForPromo,
    type AppliedPromo
  } from '$lib/utils/promoResolver';
  import { shifts, salesSummary } from '$lib/stores/shifts.svelte';
  import { employees } from '$lib/stores/employees.svelte';
  import { shiftTemplates } from '$lib/stores/shiftTemplates.svelte';
  import OpenShiftModal from '$lib/components/shifts/OpenShiftModal.svelte';
  import CloseShiftModal from '$lib/components/shifts/CloseShiftModal.svelte';
  import CashEntryModal from '$lib/components/shifts/CashEntryModal.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let searchQuery = $state('');
  let categoryFilter = $state('');
  let confirmChargeOpen = $state(false);
  let confirmClearOpen = $state(false);
  let confirmCloseTabOpen = $state(false);
  let pendingCloseTabId = $state<string | null>(null);

  let openShiftModalOpen = $state(false);
  let closeShiftModalOpen = $state(false);
  let cashEntryModalOpen = $state(false);

  const shiftsOn = $derived(settings.value.operations.shiftsEnabled);
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
      cost = effectiveVariantCost(variant);
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

  const cashShortcuts = [100_000, 50_000, 20_000, 10_000];
  const paymentChange = $derived(session.paymentAmount - cartTotal);
  const isCash = $derived(session.paymentMethod === 'cash');

  function addPaymentAmount(amount: number) {
    session.paymentAmount = (session.paymentAmount || 0) + amount;
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
    unitFactor: number = 1
  ) {
    const useVariantId = variantId ?? p.variants[0]?.id;
    session.lines.push({
      id: crypto.randomUUID(),
      productId: p.id,
      variantId: useVariantId,
      unitId: unitId ?? p.unitId,
      unitFactor,
      quantity: 1,
      extras: [],
      notes: ''
    });
    cartSessions.touch();
  }

  function unitNameFor(unitId: string): string {
    return units.getById(unitId)?.name ?? units.getById(unitId)?.code ?? '';
  }

  // Resolve a scanned/typed token to a product + (optional) variant.
  // Priority: product SKU → variant SKU → batch code. Returns null if no exact match.
  function resolveScanToken(
    raw: string
  ): { product: Product; variantId?: string; source: 'sku' | 'variantSku' | 'batchCode' } | null {
    const token = raw.trim();
    if (!token) return null;
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
    const match = resolveScanToken(searchQuery);
    if (!match) return; // fall through — text remains as a filter
    e.preventDefault();
    addToCart(match.product, match.variantId);
    const variantName = match.variantId
      ? match.product.variants.find((v) => v.id === match.variantId)?.name
      : '';
    const label = variantName
      ? `${match.product.name} — ${variantName}`
      : match.product.name;
    toast.success(
      match.source === 'batchCode' ? 'Ditambahkan dari batch' : 'Ditambahkan ke keranjang',
      match.source === 'batchCode' ? `${label} · ${searchQuery.trim()}` : label
    );
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

  function charge() {
    if (session.lines.length === 0) return;
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

    const created = orders.add({
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
      notes: ''
    });

    // Increment usage counter on each unique applied promo.
    for (const p of orderAppliedPromos) {
      promotions.incrementUsage(p.promoId);
    }

    applyOrderToStock(created);

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

  function saveNewCustomer() {
    newCustomerError = '';
    if (!newCustomerForm.name.trim()) {
      newCustomerError = 'Nama pelanggan wajib diisi.';
      return;
    }
    const created = customers.add({
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
    // Auto-select the new customer for the active session
    session.customerId = created.id;
    cartSessions.touch();
    addCustomerOpen = false;
    toast.success('Pelanggan ditambahkan', `${created.name} aktif di tab saat ini.`);
  }
</script>

<svelte:head>
  <title>Kasir · POS Admin</title>
</svelte:head>

<PageHeader title="Kasir" description="Catat transaksi penjualan. Gunakan tab untuk menahan beberapa pelanggan sekaligus.">
  {#snippet actions()}
    <Button variant="outline" href="/orders">
      <History class="h-4 w-4" />
      Riwayat transaksi
    </Button>
  {/snippet}
</PageHeader>

{#if shiftsOn}
  {#if activeShift}
    {@const summary = salesSummary(activeShift)}
    <div class="mb-4 rounded-card border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
      <div class="flex flex-wrap items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
        >
          <Clock class="h-5 w-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-slate-900">
              {activeShiftEmployee?.name ?? 'Kasir'}
            </span>
            <Badge variant="success" size="sm" dot>Shift terbuka</Badge>
          </div>
          <div class="mt-0.5 truncate text-xs text-slate-600">
            {activeShift.code} ·
            {activeShiftTemplate?.name ?? 'Bebas'} ·
            mulai {fmtShiftStart(activeShift.openedAt)} ·
            {summary.orderCount} pesanan · tunai {formatRupiah(summary.byMethod.cash)}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onclick={() => (cashEntryModalOpen = true)}>
            <Wallet class="h-4 w-4" />
            Tambah kas
          </Button>
          <Button size="sm" variant="outline" href="/shifts/{activeShift.id}">Detail</Button>
          <Button size="sm" onclick={() => (closeShiftModalOpen = true)}>
            <LogOut class="h-4 w-4" />
            Tutup shift
          </Button>
        </div>
      </div>
    </div>
  {:else}
    <div class="mb-4 rounded-card border-2 border-amber-200 bg-amber-50 px-4 py-3">
      <div class="flex flex-wrap items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700"
        >
          <AlertCircle class="h-5 w-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-slate-900">Belum ada shift terbuka</div>
          <p class="mt-0.5 text-xs text-slate-600">
            Penjualan tetap bisa dicatat, tapi tidak akan terhubung ke shift tertentu.
            Buka shift untuk rekap kas & pegawai yang lebih akurat.
          </p>
        </div>
        <Button size="sm" onclick={() => (openShiftModalOpen = true)}>
          <Clock class="h-4 w-4" />
          Buka shift
        </Button>
      </div>
    </div>
  {/if}
{/if}

<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
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
        <div
          class="group flex flex-col rounded-lg border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-soft
            {disabled ? 'opacity-50' : ''}"
        >
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

  <!-- CART (with tabs) -->
  <div class="lg:sticky lg:top-4 lg:self-start">
    <Card padded={false}>
      <!-- TAB STRIP -->
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

      <div class="border-b border-slate-100 p-4">
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

      <div class="max-h-[50vh] overflow-y-auto p-4 space-y-3">
        {#if session.lines.length === 0}
          <div class="flex flex-col items-center gap-2 py-12 text-center text-sm text-slate-400">
            <ShoppingCart class="h-8 w-8" />
            <p>Tab ini kosong. Klik produk untuk menambahkan.</p>
          </div>
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
              {@const showExtras = product.extras.length > 0}
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

                <div class="mt-2 grid grid-cols-2 gap-2">
                  {#if showVariant}
                    <Select
                      value={line.variantId ?? ''}
                      options={variantOpts}
                      onchange={(e) =>
                        updateLineVariant(line.id, (e.currentTarget as HTMLSelectElement).value)}
                    />
                  {/if}
                  {#if showUnit}
                    <Select
                      value={`${line.unitId}|${line.unitFactor}`}
                      options={unitOpts}
                      onchange={(e) =>
                        updateLineUnit(line.id, (e.currentTarget as HTMLSelectElement).value)}
                    />
                  {/if}
                </div>

                <div class="mt-2 flex items-center justify-between gap-2">
                  <div class="inline-flex items-center gap-1 rounded-md border border-slate-200">
                    <button
                      type="button"
                      class="px-2 py-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      aria-label="Kurangi"
                      onclick={() => updateLineQty(line.id, -1)}
                    >
                      <Minus class="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      class="w-12 border-0 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      oninput={(e) =>
                        setLineQty(
                          line.id,
                          parseInt((e.currentTarget as HTMLInputElement).value, 10) || 1
                        )}
                    />
                    <button
                      type="button"
                      class="px-2 py-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      aria-label="Tambah"
                      onclick={() => updateLineQty(line.id, 1)}
                    >
                      <Plus class="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-semibold text-slate-900">{formatRupiah(sub)}</div>
                    {#if tax > 0}
                      <div class="text-[10px] text-slate-400">+ {formatRupiah(tax)} pajak</div>
                    {/if}
                  </div>
                </div>

                {#if showExtras}
                  <div class="mt-2 border-t border-slate-100 pt-2">
                    <Collapsible
                      title={line.extras.length > 0
                        ? `${line.extras.length} ekstra`
                        : 'Tambah ekstra'}
                    >
                      <div class="space-y-1">
                        {#each product.extras as extra (extra.id)}
                          <label
                            class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50"
                          >
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
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      <div class="border-t border-slate-100 bg-slate-50/40 p-4">
        <dl class="space-y-1 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Subtotal</dt>
            <dd class="text-slate-700">{formatRupiah(cartSubtotal)}</dd>
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
                    <span class="text-sm font-semibold text-emerald-700">
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
              <dd class="text-slate-700">{formatRupiah(cartTax)}</dd>
            </div>
          {/if}
          <div class="flex items-baseline justify-between border-t border-slate-200 pt-2 mt-2">
            <dt class="text-base font-semibold text-slate-900">Total</dt>
            <dd class="text-xl font-bold text-slate-900">{formatRupiah(cartTotal)}</dd>
          </div>
          {#if promoDiscount > 0}
            <div class="-mt-1 text-right text-xs text-emerald-600">
              Hemat {formatRupiah(promoDiscount)}
            </div>
          {/if}
        </dl>

        <div class="mt-3">
          <span class="mb-1 block text-xs font-medium text-slate-500">Pembayaran</span>
          <div class="grid grid-cols-4 gap-1">
            {#each paymentMethodOptions as opt}
              <button
                type="button"
                class="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium transition-colors {session.paymentMethod ===
                opt.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50'}"
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
            <MoneyInput bind:value={session.paymentAmount} />
            <div class="mt-2 grid grid-cols-4 gap-1">
              {#each cashShortcuts as amount (amount)}
                <button
                  type="button"
                  class="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 active:bg-brand-100"
                  onclick={() => addPaymentAmount(amount)}
                >
                  +{formatRupiah(amount)}
                </button>
              {/each}
            </div>
            {#if session.paymentAmount > 0}
              <div
                class="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2"
              >
                <dt class="text-sm font-medium text-slate-600">
                  {paymentChange >= 0 ? 'Kembalian' : 'Sisa piutang'}
                </dt>
                <dd
                  class="text-base font-semibold {paymentChange >= 0
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
              <p class="font-semibold">
                Transaksi piutang · {formatRupiah(creditOutstanding)}
              </p>
              <p class="mt-0.5">
                Sisa {formatRupiah(creditOutstanding)} akan dicatat sebagai piutang
                {selectedCustomer ? `untuk ${selectedCustomer.name}` : ''}. Bisa dilunasi nanti di Piutang Pelanggan.
              </p>
            </div>
          {/if}
        {/if}

        <div class="mt-3 grid grid-cols-[auto_1fr] gap-2">
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
            {isPartialCash && !creditBlocker ? 'Catat piutang' : `Bayar ${formatRupiah(cartTotal)}`}
          </Button>
        </div>
      </div>
    </Card>
  </div>
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
