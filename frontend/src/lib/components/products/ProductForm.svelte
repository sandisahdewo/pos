<script lang="ts">
  import {
    Plus,
    Trash2,
    Layers,
    Shapes,
    Wand2,
    Tags,
    BadgePercent,
    Star,
    X,
    Package,
    Boxes,
    Factory,
    History,
    Image as ImageIcon,
    ChevronRight
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ChipInput,
    Collapsible,
    ConfirmDialog,
    Input,
    MoneyInput,
    PricingInput,
    Select,
    Textarea,
    Toggle,
    Tooltip
  } from '$lib/components/ui';
  import { categories } from '$lib/stores/categories.svelte';
  import { brands } from '$lib/stores/brands.svelte';
  import { tags } from '$lib/stores/tags.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { taxRates } from '$lib/stores/taxRates.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { formatRupiah } from '$lib/utils/currency';
  import { shortenForReceipt } from '$lib/utils/receiptName';
  import { supplierComparison } from '$lib/utils/supplierAnalytics';
  import { toast } from '$lib/stores/toast.svelte';
  import {
    activeAttributes,
    cloneEntry,
    computeSalePrice,
    costFromSource,
    emptyEntry,
    findBarcodeOwner,
    findEntry,
    priceWithTax,
    productKindOptions,
    productionModeOptions,
    markupCostSourceOptions,
    products,
    regenerateVariants,
    validatePricing,
    variantCombinations,
    type CompositeComponent,
    type MarkupCostSource,
    type PricelistEntry,
    type Product,
    type ProductAttribute,
    type ProductExtra,
    type ProductInput,
    type ProductKind,
    type ProductPackaging,
    type ProductStatus,
    type ProductSupplier,
    type ProductVariant,
    type ProductionMode
  } from '$lib/stores/products.svelte';
  import { stockOf } from '$lib/stores/batches.svelte';
  import type { PriceChangeSource } from '$lib/stores/priceChanges.svelte';
  import TierEditor from './TierEditor.svelte';
  import PriceAdjustmentModal, {
    type PriceChangePatch
  } from './PriceAdjustmentModal.svelte';

  type Props = {
    product?: Product | null;
    submitLabel?: string;
    onSubmit: (
      data: ProductInput,
      context?: { priceChangeSource?: PriceChangeSource; priceChangeNotes?: string }
    ) => Product | Promise<Product>;
    onCancel: () => void;
  };


  let {
    product = null,
    submitLabel = 'Save product',
    onSubmit,
    onCancel
  }: Props = $props();

  type FormState = {
    sku: string;
    name: string;
    printName: string;
    barcode: string;
    kind: ProductKind;
    categoryId: string;
    brandId: string;
    tags: string[];
    unitId: string;
    cost: number;
    prices: PricelistEntry[];
    status: ProductStatus;
    description: string;
    taxRateId: string;
    suppliers: ProductSupplier[];
    imageUrl: string;
    units: ProductPackaging[];
    attributes: ProductAttribute[];
    variants: ProductVariant[];
    components: CompositeComponent[];
    extras: ProductExtra[];
    requiresBatchLabel: boolean;
    requiresExpiration: boolean;
    productionMode: ProductionMode;
    shelfLifeAfterProductionHours: number; // 0 = unset
    markupCostSource: MarkupCostSource;
    bpomNumber: string;
    halalCertNumber: string;
    warrantyMonths: number; // 0 = unset
    metadataPairs: { key: string; value: string }[];
  };

  function initial(): FormState {
    const defaultId = pricelists.defaultId();
    return {
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      printName: product?.printName ?? '',
      barcode: product?.barcode ?? '',
      kind: product?.kind ?? 'goods',
      categoryId: product?.categoryId ?? categories.items[0]?.id ?? '',
      brandId: product?.brandId ?? '',
      tags: product?.tags ? [...product.tags] : [],
      unitId: product?.unitId ?? units.items[0]?.id ?? '',
      cost: product?.cost ?? 0,
      prices: product?.prices?.map(cloneEntry) ?? [emptyEntry(defaultId)],
      status: product?.status ?? 'active',
      description: product?.description ?? '',
      taxRateId: product?.taxRateId ?? '',
      suppliers: product?.suppliers?.map((s) => ({ ...s })) ?? [],
      imageUrl: product?.imageUrl ?? '',
      units:
        product?.units?.map((u) => ({
          ...u,
          prices: u.prices.map(cloneEntry)
        })) ?? [],
      attributes:
        product?.attributes?.map((a) => ({ ...a, values: [...a.values] })) ?? [],
      variants:
        product?.variants?.map((v) => ({
          ...v,
          prices: v.prices.map(cloneEntry),
          values: { ...v.values },
          components: v.components?.map((c) => ({ ...c })) ?? []
        })) ?? [],
      components: product?.components?.map((c) => ({ ...c })) ?? [],
      extras:
        product?.extras?.map((e) => ({
          ...e,
          components: e.components.map((c) => ({ ...c }))
        })) ?? [],
      requiresBatchLabel: product?.requiresBatchLabel ?? false,
      requiresExpiration: product?.requiresExpiration ?? false,
      productionMode: product?.productionMode ?? 'flexible',
      shelfLifeAfterProductionHours: product?.shelfLifeAfterProductionHours ?? 0,
      markupCostSource: product?.markupCostSource ?? 'manual',
      bpomNumber: product?.bpomNumber ?? '',
      halalCertNumber: product?.halalCertNumber ?? '',
      warrantyMonths: product?.warrantyMonths ?? 0,
      metadataPairs: product?.metadata
        ? Object.entries(product.metadata).map(([key, value]) => ({ key, value }))
        : []
    };
  }

  let form = $state<FormState>(initial());
  let errors = $state<Record<string, string>>({});

  const categoryOptions = $derived(
    categories.items.map((c) => ({
      value: c.id,
      label: categories.path(c.id).map((p) => p.name).join(' › ')
    }))
  );
  const brandOptions = $derived([
    { value: '', label: 'Tanpa brand' },
    ...brands.active().map((b) => ({ value: b.id, label: b.name }))
  ]);
  const unitOptions = $derived(
    units.items.map((u) => ({ value: u.id, label: `${u.name} (${u.code})` }))
  );
  const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'archived', label: 'Diarsipkan' }
  ];

  const baseUnit = $derived(units.getById(form.unitId));
  const baseCode = $derived(baseUnit?.code ?? 'base');

  const availablePricelists = $derived(
    pricelists.items.filter((pl) => !findEntry(form.prices, pl.id))
  );

  const orderedProductEntries = $derived(
    [...form.prices].sort((a, b) => {
      const ap = pricelists.getById(a.pricelistId);
      const bp = pricelists.getById(b.pricelistId);
      if (ap?.isDefault && !bp?.isDefault) return -1;
      if (!ap?.isDefault && bp?.isDefault) return 1;
      return 0;
    })
  );

  function pricelistName(id: string): string {
    return pricelists.getById(id)?.name ?? id;
  }

  function priceSummary(entries: PricelistEntry[], cost: number): string {
    const defaultId = pricelists.defaultId();
    const def = findEntry(entries, defaultId) ?? entries[0];
    if (!def) return '—';
    const sale = computeSalePrice(cost, def.pricing);
    const main = `${formatRupiah(sale)} (${pricelistName(def.pricelistId)})`;
    const extras = entries.length - 1;
    return extras > 0 ? `${main} +${extras}` : main;
  }

  function addProductPricelist(pricelistId: string) {
    const fallback =
      findEntry(form.prices, pricelists.defaultId()) ?? form.prices[0];
    const next: PricelistEntry = fallback
      ? { ...cloneEntry(fallback), pricelistId }
      : emptyEntry(pricelistId);
    form.prices = [...form.prices, next];
    for (const pack of form.units) {
      if (!findEntry(pack.prices, pricelistId)) {
        const f = findEntry(pack.prices, pricelists.defaultId()) ?? pack.prices[0];
        pack.prices.push(
          f ? { ...cloneEntry(f), pricelistId } : emptyEntry(pricelistId)
        );
      }
    }
    for (const v of form.variants) {
      if (!findEntry(v.prices, pricelistId)) {
        const f = findEntry(v.prices, pricelists.defaultId()) ?? v.prices[0];
        v.prices.push(
          f ? { ...cloneEntry(f), pricelistId } : emptyEntry(pricelistId)
        );
      }
    }
  }

  function removeProductPricelist(pricelistId: string) {
    form.prices = form.prices.filter((e) => e.pricelistId !== pricelistId);
    for (const pack of form.units) {
      pack.prices = pack.prices.filter((e) => e.pricelistId !== pricelistId);
    }
    for (const v of form.variants) {
      v.prices = v.prices.filter((e) => e.pricelistId !== pricelistId);
    }
  }

  function addPackaging() {
    form.units = [
      ...form.units,
      {
        unitId: units.items[0]?.id ?? '',
        factor: 1,
        prices: form.prices.map(cloneEntry),
        barcode: ''
      }
    ];
  }

  function removePackaging(i: number) {
    form.units = form.units.filter((_, idx) => idx !== i);
  }

  function addVariant() {
    form.variants = [
      ...form.variants,
      {
        id: crypto.randomUUID(),
        name: '',
        printName: '',
        sku: '',
        cost: form.cost,
        prices: form.prices.map(cloneEntry),
        barcode: '',
        values: {},
        imageUrl: '',
        components: form.kind === 'composite'
          ? form.components.map((c) => ({ ...c, id: crypto.randomUUID() }))
          : []
      }
    ];
  }

  function removeVariant(i: number) {
    form.variants = form.variants.filter((_, idx) => idx !== i);
  }

  function addAttribute() {
    form.attributes = [
      ...form.attributes,
      { id: crypto.randomUUID(), name: '', values: [] }
    ];
  }

  function removeAttribute(i: number) {
    form.attributes = form.attributes.filter((_, idx) => idx !== i);
  }

  function runGenerate() {
    const generated = regenerateVariants(form.attributes, form.variants, {
      baseSku: form.sku.trim(),
      cost: form.cost,
      prices: form.prices.map(cloneEntry)
    });
    form.variants = generated;
  }

  const generatorReady = $derived(activeAttributes(form.attributes).length > 0);
  const projectedCount = $derived(variantCombinations(form.attributes).length);

  const showPackagings = $derived(form.kind === 'goods' && form.units.length > 0);
  const showVariants = $derived(form.variants.length > 0 || form.attributes.length > 0);

  function validateEntries(
    entries: PricelistEntry[],
    keyPrefix: string,
    next: Record<string, string>
  ) {
    for (const entry of entries) {
      const ePrefix = `${keyPrefix}${entry.pricelistId}_`;
      const err = validatePricing(entry.pricing);
      if (err) next[`${ePrefix}pricing`] = err;
      entry.tiers.forEach((tier, ti) => {
        if (!Number.isInteger(tier.minQty) || tier.minQty < 1)
          next[`${ePrefix}t${ti}_qty`] = 'Kuantitas minimum harus bilangan bulat positif.';
        const tErr = validatePricing(tier.pricing);
        if (tErr) next[`${ePrefix}t${ti}_pricing`] = tErr;
      });
    }
  }

  // Check barcode uniqueness — both within the form (operator typo) and across
  // the rest of the catalog (cross-product collision). Empty barcodes are
  // ignored; same code reused at multiple scopes within this product is also
  // flagged because the scan resolver would only ever resolve to one of them.
  function validateBarcodes(next: Record<string, string>) {
    const inForm: { key: string; code: string; scopeLabel: string }[] = [];
    if (form.barcode.trim()) {
      inForm.push({ key: 'barcode', code: form.barcode.trim(), scopeLabel: 'produk' });
    }
    form.variants.forEach((v, i) => {
      const code = v.barcode.trim();
      if (!code) return;
      inForm.push({
        key: `v_${i}_barcode`,
        code,
        scopeLabel: `varian ${v.name || `#${i + 1}`}`
      });
    });
    form.units.forEach((u, i) => {
      const code = u.barcode.trim();
      if (!code) return;
      const unit = units.getById(u.unitId);
      const unitLabel = unit ? `${unit.name} · isi ${u.factor}` : `kemasan #${i + 1}`;
      inForm.push({ key: `u_${i}_barcode`, code, scopeLabel: unitLabel });
    });

    // 1. Internal duplicates (within this form).
    const seen = new Map<string, string>();
    for (const entry of inForm) {
      const prior = seen.get(entry.code);
      if (prior) {
        next[entry.key] = `Barcode sama dengan ${prior} di produk ini.`;
      } else {
        seen.set(entry.code, entry.scopeLabel);
      }
    }

    // 2. Cross-product collisions.
    for (const entry of inForm) {
      if (next[entry.key]) continue;
      const owner = findBarcodeOwner(entry.code, product?.id);
      if (owner) {
        const detail = owner.scopeLabel ? ` (${owner.scopeLabel})` : '';
        next[entry.key] = `Barcode sudah dipakai di "${owner.productName}"${detail}.`;
      }
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    if (!form.sku.trim()) next.sku = 'SKU wajib diisi.';
    if (!form.categoryId) next.categoryId = 'Pilih kategori.';
    if (!form.unitId) next.unitId = 'Pilih satuan dasar.';
    if (!Number.isFinite(form.cost) || form.cost < 0)
      next.cost = 'Biaya harus 0 atau lebih.';


    validateEntries(form.prices, 'prod_', next);

    form.units.forEach((u, i) => {
      if (!u.unitId) next[`u_${i}_unitId`] = 'Pilih satuan.';
      if (u.unitId === form.unitId && u.factor === 1)
        next[`u_${i}_factor`] =
          'Itu satuan dasar — pilih satuan lain atau ubah faktornya.';
      if (!Number.isFinite(u.factor) || u.factor <= 0)
        next[`u_${i}_factor`] = 'Harus lebih besar dari 0.';
      validateEntries(u.prices, `u_${i}_`, next);
    });

    form.components.forEach((c, i) => {
      if (!c.productId) next[`c_${i}_product`] = 'Pilih produk komponen.';
      const compProduct = products.getById(c.productId);
      if (compProduct && compProduct.variants.length > 0 && !c.variantId)
        next[`c_${i}_variant`] = 'Pilih varian.';
      if (!Number.isFinite(c.quantity) || c.quantity <= 0)
        next[`c_${i}_quantity`] = 'Kuantitas harus lebih besar dari 0.';
    });

    form.extras.forEach((e, i) => {
      if (!e.name.trim()) next[`ex_${i}_name`] = 'Nama wajib diisi.';
      if (!Number.isFinite(e.priceDelta))
        next[`ex_${i}_price`] = 'Selisih harga harus berupa angka.';
      e.components.forEach((c, ci) => {
        if (!c.productId) next[`ex_${i}_c${ci}_product`] = 'Pilih produk komponen.';
        if (!Number.isFinite(c.quantity) || c.quantity <= 0)
          next[`ex_${i}_c${ci}_quantity`] = 'Kuantitas harus lebih besar dari 0.';
      });
    });

    if (form.kind === 'composite') {
      form.variants.forEach((v, i) => {
        v.components.forEach((c, ci) => {
          if (!c.productId) next[`v_${i}_c${ci}_product`] = 'Pilih produk komponen.';
          if (!Number.isFinite(c.quantity) || c.quantity <= 0)
            next[`v_${i}_c${ci}_quantity`] = 'Kuantitas harus lebih besar dari 0.';
        });
      });
    }
    form.variants.forEach((v, i) => {
      if (!v.name.trim()) next[`v_${i}_name`] = 'Wajib diisi.';
      if (!v.sku.trim()) next[`v_${i}_sku`] = 'Wajib diisi.';
      if (!Number.isFinite(v.cost) || v.cost < 0)
        next[`v_${i}_cost`] = 'Harus 0 atau lebih.';
      validateEntries(v.prices, `v_${i}_`, next);
    });

    validateBarcodes(next);

    errors = next;
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (!validate()) {
      toast.error('Mohon perbaiki kolom yang ditandai', 'Beberapa input perlu diperhatikan.');
      return;
    }
    const payload: ProductInput = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      printName: form.printName.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      categoryId: form.categoryId,
      brandId: form.brandId || undefined,
      tags: form.tags.length > 0 ? form.tags : undefined,
      unitId: form.unitId,
      cost: form.cost,
      prices: form.prices,
      status: form.status,
      description: form.description.trim(),
      taxRateId: form.taxRateId || undefined,
      suppliers: form.suppliers,
      imageUrl: form.imageUrl.trim(),
      kind: form.kind,
      units: form.kind === 'goods' ? form.units : [],
      attributes: form.attributes,
      variants: form.variants,
      components: form.kind === 'composite' ? form.components : [],
      extras: form.extras,
      requiresBatchLabel: form.requiresBatchLabel || undefined,
      requiresExpiration: form.requiresExpiration || undefined,
      productionMode: form.kind === 'composite' ? form.productionMode : undefined,
      shelfLifeAfterProductionHours:
        form.kind === 'composite' && form.shelfLifeAfterProductionHours > 0
          ? form.shelfLifeAfterProductionHours
          : undefined,
      markupCostSource: form.markupCostSource === 'manual' ? undefined : form.markupCostSource,
      bpomNumber: form.bpomNumber.trim() || undefined,
      halalCertNumber: form.halalCertNumber.trim() || undefined,
      warrantyMonths: form.warrantyMonths > 0 ? form.warrantyMonths : undefined,
      metadata: (() => {
        const obj = form.metadataPairs.reduce<Record<string, string>>((acc, pair) => {
          const k = pair.key.trim();
          const v = pair.value.trim();
          if (k && v) acc[k] = v;
          return acc;
        }, {});
        return Object.keys(obj).length > 0 ? obj : undefined;
      })()
    };
    const context = pendingPriceChangeSummary
      ? { priceChangeSource: 'bulk-adjust' as const, priceChangeNotes: pendingPriceChangeSummary }
      : undefined;
    onSubmit(payload, context);
    pendingPriceChangeSummary = '';
  }

  const supplierOptions = $derived([
    { value: '', label: 'Tanpa pemasok utama' },
    ...suppliers.active().map((s) => ({ value: s.id, label: s.name }))
  ]);

  // === Suppliers card helpers ===
  function supplierOptionsFor(index: number): { value: string; label: string }[] {
    const takenElsewhere = new Set(
      form.suppliers
        .map((s, i) => (i === index ? null : s.supplierId))
        .filter((v): v is string => !!v)
    );
    return [
      { value: '', label: 'Pilih pemasok…' },
      ...suppliers
        .active()
        .filter((s) => !takenElsewhere.has(s.id))
        .map((s) => ({
          value: s.id,
          label: s.leadTimeDays > 0 ? `${s.name} (tunggu ${s.leadTimeDays}h)` : s.name
        }))
    ];
  }

  // Per-row expand state. Indices match form.suppliers. New rows auto-expand;
  // rows with a selected supplier collapse by default to a one-line summary.
  let expandedSuppliers = $state<Set<number>>(new Set());

  function isSupplierExpanded(i: number): boolean {
    // Force-expand rows that don't have a supplier picked yet (admin needs to choose).
    if (!form.suppliers[i]?.supplierId) return true;
    return expandedSuppliers.has(i);
  }

  function toggleSupplierExpanded(i: number) {
    const next = new Set(expandedSuppliers);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    expandedSuppliers = next;
  }

  function addSupplierRow() {
    const isFirst = form.suppliers.length === 0;
    form.suppliers = [
      ...form.suppliers,
      {
        supplierId: '',
        isPrimary: isFirst,
        unitCost: form.cost ?? 0,
        leadTimeDays: undefined,
        supplierSku: '',
        notes: ''
      }
    ];
    // Auto-expand the newly added row so admin sees the form fields immediately.
    expandedSuppliers = new Set([...expandedSuppliers, form.suppliers.length - 1]);
  }

  function removeSupplierRow(index: number) {
    const wasPrimary = form.suppliers[index]?.isPrimary;
    form.suppliers = form.suppliers.filter((_, i) => i !== index);
    // Promote first row to primary if we removed the primary
    if (wasPrimary && form.suppliers.length > 0) {
      form.suppliers = form.suppliers.map((s, i) => ({ ...s, isPrimary: i === 0 }));
    }
    // Rebuild expanded set: drop the removed index, shift higher ones down by 1.
    const next = new Set<number>();
    for (const idx of expandedSuppliers) {
      if (idx < index) next.add(idx);
      else if (idx > index) next.add(idx - 1);
    }
    expandedSuppliers = next;
  }

  function setPrimarySupplier(index: number) {
    form.suppliers = form.suppliers.map((s, i) => ({ ...s, isPrimary: i === index }));
  }

  function supplierLeadFallback(supplierId: string): number {
    return suppliers.getById(supplierId)?.leadTimeDays ?? 0;
  }

  function effectiveLeadDays(ps: ProductSupplier): number {
    if (typeof ps.leadTimeDays === 'number' && ps.leadTimeDays >= 0) return ps.leadTimeDays;
    return supplierLeadFallback(ps.supplierId);
  }

  function supplierNameFor(supplierId: string): string {
    return suppliers.getById(supplierId)?.name ?? 'Pemasok belum dipilih';
  }

  function addComponent() {
    const candidates = products.items.filter(
      (p) => p.status === 'active' && p.id !== product?.id && p.components.length === 0
    );
    const first = candidates[0];
    form.components = [
      ...form.components,
      {
        id: crypto.randomUUID(),
        productId: first?.id ?? '',
        variantId: undefined,
        quantity: 1
      }
    ];
  }

  function removeComponent(i: number) {
    form.components = form.components.filter((_, idx) => idx !== i);
  }

  const componentProductOptions = $derived(
    products.items
      .filter((p) => p.status === 'active' && p.id !== product?.id && p.components.length === 0)
      .map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))
  );

  function componentVariantOptionsFor(productId: string): { value: string; label: string }[] {
    const p = products.getById(productId);
    if (!p || p.variants.length === 0) return [];
    return [
      { value: '', label: '— Pilih varian —' },
      ...p.variants.map((v) => ({ value: v.id, label: `${v.name} (${v.sku})` }))
    ];
  }

  function componentUnitLabel(productId: string): string {
    const p = products.getById(productId);
    if (!p) return '';
    return units.getById(p.unitId)?.code ?? '';
  }

  // Pilihan satuan untuk komponen — satuan dasar + tiap kemasan produk
  // komponen. Value encoded sebagai `${unitId}|${factor}` (sama pola dengan
  // PO line) supaya onchange bisa langsung set kedua field di komponen.
  function componentUnitOptionsFor(productId: string): { value: string; label: string }[] {
    const p = products.getById(productId);
    if (!p) return [];
    const baseUnit = units.getById(p.unitId);
    const baseCode = baseUnit?.code ?? '?';
    const baseName = baseUnit?.name ?? '?';
    const opts: { value: string; label: string }[] = [
      { value: `${p.unitId}|1`, label: `${baseName} (${baseCode}) — satuan dasar` }
    ];
    for (const pack of p.units) {
      const u = units.getById(pack.unitId);
      if (!u) continue;
      opts.push({
        value: `${pack.unitId}|${pack.factor}`,
        label: `${u.name} (${u.code}) — 1 = ${pack.factor} ${baseCode}`
      });
    }
    return opts;
  }

  function onComponentUnitChange(comp: CompositeComponent, value: string) {
    const [unitId, factorStr] = value.split('|');
    const factor = Number(factorStr) || 1;
    // Simpan sebagai undefined kalau pakai base unit (factor 1) supaya seed
    // lama yang tidak punya unitId tetap sama signature-nya.
    comp.unitId = factor === 1 ? undefined : unitId;
    comp.unitFactor = factor === 1 ? undefined : factor;
  }

  function componentCost(c: CompositeComponent): number {
    const p = products.getById(c.productId);
    if (!p) return 0;
    if (c.variantId) {
      const v = p.variants.find((vv) => vv.id === c.variantId);
      if (v) return v.cost;
    }
    return p.cost;
  }

  // Recipe-derived cost (composites only). Used as the fallback when
  // markupCostSource resolves to manual or when no batch exists yet.
  // Bahan boleh pakai satuan kemasan (unitFactor), jadi qty dikali factor
  // sebelum dikalikan biaya per-base.
  const recipeFormCost = $derived(
    form.components.length > 0
      ? form.components.reduce(
          (sum, c) => sum + c.quantity * (c.unitFactor ?? 1) * componentCost(c),
          0
        )
      : 0
  );

  // Cost basis the form previews against. Routed through costFromSource so
  // the preview reflects the markupCostSource picked in the form right now —
  // including unsaved edits. Keeps margins honest when the operator flips
  // manual → fifo-current and expects batch cost to take over before saving.
  const effectiveFormCost = $derived.by(() => {
    const fallback = form.components.length > 0 ? recipeFormCost : form.cost;
    if (product?.id) {
      return costFromSource(product.id, undefined, form.markupCostSource, fallback);
    }
    return fallback;
  });

  // True when the displayed cost comes from a batch rather than the manual
  // / recipe value. Drives the "Biaya saat ini …" preview line and (for
  // composites) the label switch on the read-only cost box.
  const costIsFromBatch = $derived(
    form.markupCostSource !== 'manual' &&
      !!product?.id &&
      effectiveFormCost !== (form.components.length > 0 ? recipeFormCost : form.cost)
  );

  const costSourceLabel = $derived(
    form.markupCostSource === 'fifo-current'
      ? 'dari stok yang sedang dijual'
      : form.markupCostSource === 'batch-avg'
        ? 'rata-rata semua stok'
        : ''
  );

  const costFieldLabel = $derived(
    form.markupCostSource === 'manual' ? 'Biaya beli' : 'Biaya awal'
  );

  const costFieldHint = $derived(
    form.markupCostSource === 'manual'
      ? `Per 1 ${baseCode}. Markup ikut angka ini — update saat harga beli berubah.`
      : form.markupCostSource === 'fifo-current'
        ? `Per 1 ${baseCode}. Cuma dipakai sampai stok pertama masuk; setelah itu sistem ikut harga beli stok yang sedang dijual.`
        : `Per 1 ${baseCode}. Cuma dipakai sampai stok pertama masuk; setelah itu sistem ikut rata-rata harga beli semua stok.`
  );

  const hasMarkupPricing = $derived.by(() => {
    const inEntries = (entries: PricelistEntry[]) =>
      entries.some(
        (e) =>
          e.pricing.kind !== 'fixed' ||
          e.tiers.some((t) => t.pricing.kind !== 'fixed')
      );
    if (inEntries(form.prices)) return true;
    if (form.units.some((u) => inEntries(u.prices))) return true;
    if (form.variants.some((v) => inEntries(v.prices))) return true;
    return false;
  });

  const costZeroWarning = $derived(hasMarkupPricing && effectiveFormCost === 0);

  const costZeroMessage = $derived(
    form.markupCostSource === 'manual'
      ? 'Markup butuh "Biaya beli" lebih dari Rp 0. Harga jual akan Rp 0 sampai diisi.'
      : 'Biaya masih Rp 0 dan belum ada stok masuk. Harga jual akan Rp 0 sampai biaya awal diisi atau stok pertama tiba.'
  );

  const producibleFormStock = $derived.by(() => {
    if (form.components.length === 0) return 0;
    if (form.components.some((c) => c.quantity <= 0)) return 0;
    const values = form.components.map((c) => {
      const p = products.getById(c.productId);
      if (!p) return 0;
      const avail = c.variantId
        ? stockOf(c.productId, c.variantId)
        : p.variants.length > 0
          ? p.variants.reduce((s, v) => s + stockOf(p.id, v.id), 0)
          : stockOf(c.productId);
      const perOutput = c.quantity * (c.unitFactor ?? 1);
      return Math.floor(avail / perOutput);
    });
    return Math.min(...values);
  });

  const showComponents = $derived(form.kind === 'composite' && form.components.length > 0);

  // ─── Bulk price adjustment ──────────────────────────────────────────────
  let priceAdjustmentOpen = $state(false);
  // Pass a minimal product snapshot — the modal reads name + id + unitId off it.
  const priceAdjustmentSnapshot = $derived<Product>({
    ...(product ?? ({} as Product)),
    id: product?.id ?? 'new',
    name: form.name || 'Produk baru',
    unitId: form.unitId,
    cost: form.cost,
    kind: form.kind,
    categoryId: form.categoryId,
    sku: form.sku,
    prices: form.prices,
    variants: form.variants,
    units: form.units,
    components: form.components,
    extras: form.extras,
    status: form.status,
    description: form.description,
    imageUrl: form.imageUrl,
    attributes: form.attributes,
    suppliers: form.suppliers
  });

  const hasAnyPriceEntries = $derived(
    form.prices.length > 0 ||
      form.variants.some((v) => v.prices.length > 0) ||
      form.units.some((u) => u.prices.length > 0)
  );

  function openPriceAdjustmentModal() {
    if (!hasAnyPriceEntries) return;
    priceAdjustmentOpen = true;
  }

  // When the bulk-adjust modal applies, we remember the human summary so the
  // next save can pass it as the `notes` field on the resulting PriceChange
  // rows. Cleared after submit.
  let pendingPriceChangeSummary = $state('');

  function applyPricePatches(patches: PriceChangePatch[], summary: string) {
    for (const patch of patches) {
      let entries: PricelistEntry[] | undefined;
      const scope = patch.scope;
      if (scope.kind === 'product') {
        entries = form.prices;
      } else if (scope.kind === 'variant') {
        const v = form.variants.find((vv) => vv.id === scope.variantId);
        entries = v?.prices;
      } else {
        entries = form.units[scope.packagingIndex]?.prices;
      }
      if (!entries) continue;
      const entry = entries.find((e) => e.pricelistId === patch.pricelistId);
      if (!entry) continue;
      if (patch.tierIndex === undefined) {
        entry.pricing = patch.newStrategy;
      } else {
        const tier = entry.tiers[patch.tierIndex];
        if (tier) tier.pricing = patch.newStrategy;
      }
    }
    if (summary) pendingPriceChangeSummary = summary;
    toast.success(
      'Harga diperbarui',
      `${patches.length} entri harga disesuaikan. Simpan untuk menerapkan.`
    );
  }
  const showExtras = $derived(form.extras.length > 0);

  function addExtra() {
    form.extras = [
      ...form.extras,
      {
        id: crypto.randomUUID(),
        name: '',
        priceDelta: 0,
        components: []
      }
    ];
  }

  function removeExtra(i: number) {
    form.extras = form.extras.filter((_, idx) => idx !== i);
  }

  function addExtraComponent(extra: ProductExtra) {
    const candidates = products.items.filter(
      (p) => p.status === 'active' && p.id !== product?.id && p.components.length === 0
    );
    const first = candidates[0];
    extra.components = [
      ...extra.components,
      {
        id: crypto.randomUUID(),
        productId: first?.id ?? '',
        variantId: undefined,
        quantity: 1
      }
    ];
  }

  function removeExtraComponent(extra: ProductExtra, i: number) {
    extra.components = extra.components.filter((_, idx) => idx !== i);
  }

  function addVariantComponent(variant: ProductVariant) {
    const candidates = products.items.filter(
      (p) => p.status === 'active' && p.id !== product?.id && p.components.length === 0
    );
    const first = candidates[0];
    variant.components = [
      ...variant.components,
      {
        id: crypto.randomUUID(),
        productId: first?.id ?? '',
        variantId: undefined,
        quantity: 1
      }
    ];
  }

  function removeVariantComponent(variant: ProductVariant, i: number) {
    variant.components = variant.components.filter((_, idx) => idx !== i);
  }

  function variantEffectiveCost(v: ProductVariant): number {
    const fallback =
      v.components.length > 0
        ? v.components.reduce(
            (s, c) =>
              s +
              c.quantity *
                (c.unitFactor ?? 1) *
                componentCost({ ...c, id: c.id } as CompositeComponent),
            0
          )
        : v.cost;
    // For existing products, route through the source picked in the form so
    // batch-cost previews match what POS will actually charge.
    if (product?.id) {
      return costFromSource(product.id, v.id, form.markupCostSource, fallback);
    }
    return fallback;
  }

  let pendingKind = $state<ProductKind | null>(null);
  let confirmKindSwitchOpen = $state(false);

  function requestKindChange(next: ProductKind) {
    if (next === form.kind) return;
    const losingPackagings = next === 'composite' && form.units.length > 0;
    const losingComponents =
      next === 'goods' &&
      (form.components.length > 0 || form.variants.some((v) => v.components.length > 0));
    if (losingPackagings || losingComponents) {
      pendingKind = next;
      confirmKindSwitchOpen = true;
    } else {
      form.kind = next;
    }
  }

  function confirmKindSwitch() {
    if (!pendingKind) return;
    if (pendingKind === 'composite') {
      form.units = [];
    } else {
      form.components = [];
      form.variants = form.variants.map((v) => ({ ...v, components: [] }));
    }
    form.kind = pendingKind;
    pendingKind = null;
  }

  function addMetadataPair() {
    form.metadataPairs = [...form.metadataPairs, { key: '', value: '' }];
  }

  function removeMetadataPair(i: number) {
    form.metadataPairs = form.metadataPairs.filter((_, idx) => idx !== i);
  }

  // Auto-open the "Info tambahan" panel when the product already has data in
  // any of its fields — otherwise hide behind the collapsed toggle. Driven by
  // the form state (cloned in initial()) so we don't re-read the prop here.
  let extraInfoOpen = $state(
    !!(
      form.bpomNumber.trim() ||
      form.halalCertNumber.trim() ||
      form.warrantyMonths > 0 ||
      form.metadataPairs.length > 0
    )
  );

  const inheritedTaxRate = $derived.by(() => {
    const cat = categories.getById(form.categoryId);
    if (cat?.taxRateId) return taxRates.getById(cat.taxRateId);
    return taxRates.default();
  });

  const taxRateSelectOptions = $derived([
    {
      value: '',
      label: `Ikut tarif kategori${inheritedTaxRate ? ` (${inheritedTaxRate.name})` : ''}`
    },
    ...taxRates.items.map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)` }))
  ]);
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
  <div class="space-y-4 lg:col-span-2">
    <!-- BASICS -->
    <Card title="Dasar" description="Info utama produk: nama, kode, gambar, dan keterangan singkat.">
      <div class="mb-5">
        <div class="mb-1.5 flex items-center gap-1.5">
          <span class="text-sm font-medium text-slate-700">Jenis produk</span>
          <Tooltip
            content="Pilih Barang kalau dibeli jadi dari pemasok lalu dijual ulang. Pilih Resep / Paket kalau dibuat dari produk lain — seperti mie ayam yang terdiri dari mie, ayam, dan saus."
          />
        </div>
        <div class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {#each productKindOptions as opt}
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {form.kind ===
              opt.value
                ? 'bg-white text-slate-900 shadow-soft'
                : 'text-slate-500 hover:text-slate-700'}"
              onclick={() => requestKindChange(opt.value)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
        <p class="mt-1.5 text-xs text-slate-500">
          {productKindOptions.find((o) => o.value === form.kind)?.description ?? ''}
        </p>
      </div>
      <div class="flex gap-4">
        <div class="shrink-0">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">Gambar</span>
          {#if form.imageUrl.trim()}
            <img
              src={form.imageUrl}
              alt="Produk"
              class="h-24 w-24 rounded-lg border border-slate-200 object-cover"
              onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
            />
          {:else}
            <div
              class="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-300"
            >
              <ImageIcon class="h-8 w-8" />
            </div>
          {/if}
        </div>
        <div class="grid flex-1 gap-4">
          <Input
            label="Nama"
            placeholder="mis. Cola 330mL"
            bind:value={form.name}
            error={errors.name}
          />
          <Input
            label="Nama struk (opsional)"
            placeholder={`Auto: ${shortenForReceipt(form.name || 'mis. Cola 330mL')}`}
            bind:value={form.printName}
            hint="Versi pendek yang dicetak di nota (~16 huruf). Kosongkan untuk pakai versi otomatis dari nama."
          />
          <Input
            label="SKU (kode internal)"
            placeholder="mis. BEV-CKA-330"
            bind:value={form.sku}
            hint="Kode pendek untuk membedakan produk ini di sistem. Boleh format apa saja, asal unik."
            error={errors.sku}
          />
          <Input
            label="Barcode"
            placeholder="mis. 8991002301234 (kosongkan jika tidak ada)"
            bind:value={form.barcode}
            hint={form.variants.length > 0
              ? 'Kalau produk ini punya varian, biasanya barcode diisi per varian. Isi di sini hanya kalau pemasok kasih kode utama untuk semua varian.'
              : form.units.length > 0
                ? 'Barcode kemasan terkecil (mis. 1 kaleng / 1 botol). Kemasan lain (dus, karton) punya barcode sendiri di kartu Satuan kemasan.'
                : 'Kode batang di kemasan barang. Discan di kasir supaya produk langsung masuk keranjang.'}
            error={errors.barcode}
          />
          <Input
            label="URL Gambar"
            placeholder="https://example.com/produk.jpg"
            bind:value={form.imageUrl}
            hint="Tempel URL gambar. Upload akan tersedia setelah backend siap."
          />
        </div>
      </div>
      <Textarea
        class="mt-4"
        label="Deskripsi"
        placeholder="Catatan opsional — terlihat oleh staf."
        bind:value={form.description}
      />

      <div class="mt-5 space-y-3 border-t border-slate-100 pt-4">
        <div class="flex items-center gap-1.5">
          <p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Pelacakan stok per pengiriman
          </p>
          <Tooltip
            content="Aktifkan kalau produk ini perlu dipisah per pengiriman (mis. roti yang cepat basi, telur, daging). Sistem mengelompokkan stok per kedatangan supaya yang paling lama bisa dijual lebih dulu."
            size="sm"
          />
        </div>
        <Toggle
          bind:checked={form.requiresBatchLabel}
          label="Cetak label setiap kali stok masuk"
          description="Setiap pengiriman baru otomatis dapat label kecil bertuliskan kode pengiriman. Cocok untuk roti, telur, daging — supaya bisa dilacak satu per satu."
        />
        <Toggle
          bind:checked={form.requiresExpiration}
          label="Wajib isi tanggal kedaluwarsa"
          description="Setiap kali stok masuk, harus mencantumkan tanggal expired. Saat penjualan, sistem otomatis menjual yang paling cepat kedaluwarsa dulu."
        />
      </div>
    </Card>

    <!-- PRODUCTION MODE (composite only) -->
    {#if form.kind === 'composite'}
      <Card>
        <div class="mb-3 flex items-center gap-2">
          <Factory class="h-4 w-4 text-slate-500" />
          <h3 class="text-sm font-semibold text-slate-900">Cara penyiapan</h3>
          <Tooltip
            content="Untuk produk resep/paket: apakah boleh dibuat dadakan saat ada pesanan, atau wajib disiapkan dulu. Fleksibel = boleh keduanya. Wajib disiapkan = harus diproduksi sebelum dijual."
          />
        </div>
        <p class="mb-4 text-xs text-slate-500">
          Pilih cara produk ini sampai ke pelanggan. Mode <strong>Fleksibel</strong> paling umum —
          bisa disiapkan duluan ke etalase, atau dibuat saat pesanan datang.
        </p>
        <Select
          label="Cara penyiapan default"
          bind:value={form.productionMode}
          options={productionModeOptions.map((o) => ({ value: o.value, label: o.label }))}
          hint={productionModeOptions.find((o) => o.value === form.productionMode)?.description}
        />

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            label="Tahan berapa jam setelah dibuat?"
            type="number"
            min="0"
            step="1"
            bind:value={form.shelfLifeAfterProductionHours}
            hint="Misal ayam goreng 2 jam, gorengan 4 jam. Isi 0 kalau tidak ada batas waktu."
          />
        </div>

        {#if form.variants.length > 0}
          <details class="mt-4 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
            <summary class="cursor-pointer text-xs font-semibold text-slate-700">
              Atur per varian (opsional)
            </summary>
            <p class="mt-2 mb-3 text-xs text-slate-500">
              Biarkan kosong agar ikut pengaturan default di atas. Override hanya jika satu varian
              butuh cara berbeda.
            </p>
            <div class="space-y-2">
              {#each form.variants as variant, vi (variant.id)}
                <div class="grid items-center gap-2 sm:grid-cols-[1fr_220px]">
                  <span class="truncate text-sm text-slate-700">{variant.name}</span>
                  <select
                    class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                    bind:value={form.variants[vi].productionMode}
                  >
                    <option value={undefined}>Ikuti default ({form.productionMode === 'strict' ? 'Wajib disiapkan dulu' : 'Fleksibel'})</option>
                    {#each productionModeOptions as opt (opt.value)}
                      <option value={opt.value}>{opt.label}</option>
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          </details>
        {/if}
      </Card>
    {/if}

    <!-- COMPONENTS (composite only; always rendered so recipe is filled before pricing) -->
    {#if form.kind === 'composite'}
      <Card>
        {#snippet header()}
          {#if form.components.length > 0}
            <Button size="sm" variant="outline" onclick={addComponent}>
              <Plus class="h-4 w-4" />
              Tambah komponen
            </Button>
          {/if}
        {/snippet}
        <div class="mb-3 flex items-center gap-2">
          <Boxes class="h-4 w-4 text-slate-500" />
          <h3 class="text-sm font-semibold text-slate-900">Bahan / Isi paket</h3>
          <Badge variant="outline" size="sm">{form.components.length}</Badge>
          <Tooltip
            content="Daftar produk lain yang dipakai untuk membuat / menyusun produk ini. Untuk resep: bahan-bahan + jumlahnya. Untuk paket: barang-barang yang dimasukkan. Biaya produk ini = total biaya semua bahan."
          />
        </div>
        {#if form.components.length === 0}
          <div
            class="rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-4 py-6 text-center"
          >
            <p class="text-sm font-medium text-slate-600">Belum ada bahan / isi paket</p>
            <p class="mt-1 text-xs text-slate-500">
              Tambahkan dulu di sini supaya biaya efektif terhitung otomatis di kartu Harga &amp; Stok di bawah.
            </p>
            <Button size="sm" variant="outline" class="mt-3" onclick={addComponent}>
              <Plus class="h-3.5 w-3.5" />
              Tambah komponen pertama
            </Button>
          </div>
        {:else}
          <p class="mb-4 text-xs text-slate-500">
            Pilih produk lain yang jadi bahan atau isi paket ini, beserta jumlahnya. Stok yang bisa
            dijual otomatis terbatas oleh bahan yang paling sedikit.
          </p>

          <div class="space-y-3">
            {#each form.components as comp, i (comp.id)}
              {@const compVariantOpts = componentVariantOptionsFor(comp.productId)}
              {@const compUnitOpts = componentUnitOptionsFor(comp.productId)}
              {@const compCost = componentCost(comp)}
              {@const compUnitFactor = comp.unitFactor ?? 1}
              {@const compBaseQty = comp.quantity * compUnitFactor}
              {@const compSubtotal = compBaseQty * compCost}
              {@const compBaseUnit = componentUnitLabel(comp.productId)}
              {@const compChosenUnit =
                comp.unitId && comp.unitId !== products.getById(comp.productId)?.unitId
                  ? units.getById(comp.unitId)?.code ?? compBaseUnit
                  : compBaseUnit}
              {@const compProductBaseUnitId = products.getById(comp.productId)?.unitId ?? ''}
              <div class="rounded-lg border border-slate-200 bg-white p-3">
                <div class="grid gap-3 md:grid-cols-[2fr_1.5fr_auto] md:items-end">
                  <Select
                    label="Produk"
                    placeholder="Pilih produk"
                    value={comp.productId}
                    onchange={(e) => {
                      comp.productId = (e.currentTarget as HTMLSelectElement).value;
                      comp.variantId = undefined;
                      // Reset packaging selector — kemasan beda produk beda
                      comp.unitId = undefined;
                      comp.unitFactor = undefined;
                    }}
                    options={componentProductOptions}
                    error={errors[`c_${i}_product`]}
                  />
                  {#if compVariantOpts.length > 0}
                    <Select
                      label="Varian"
                      value={comp.variantId ?? ''}
                      onchange={(e) => {
                        const v = (e.currentTarget as HTMLSelectElement).value;
                        comp.variantId = v || undefined;
                      }}
                      options={compVariantOpts}
                      error={errors[`c_${i}_variant`]}
                    />
                  {:else}
                    <div class="hidden md:block"></div>
                  {/if}
                  <button
                    type="button"
                    class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Hapus komponen"
                    onclick={() => removeComponent(i)}
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
                <div class="mt-3 grid gap-3 md:grid-cols-[0.6fr_1.4fr] md:items-end">
                  <Input
                    label="Qty"
                    type="number"
                    step="any"
                    min="0"
                    bind:value={comp.quantity}
                    error={errors[`c_${i}_quantity`]}
                  />
                  {#if compUnitOpts.length > 1}
                    <Select
                      label="Satuan"
                      tooltip="Pilih satuan untuk bahan ini. Kalau produk komponen punya kemasan lain (mis. ekor untuk ayam, dus untuk Cola), pilih di sini supaya kamu bisa input qty dalam satuan itu. Sistem konversi otomatis ke satuan dasar untuk hitung biaya & potongan stok."
                      value={`${comp.unitId ?? compProductBaseUnitId}|${compUnitFactor}`}
                      options={compUnitOpts}
                      onchange={(e) =>
                        onComponentUnitChange(comp, (e.currentTarget as HTMLSelectElement).value)}
                    />
                  {:else}
                    <div class="hidden md:block"></div>
                  {/if}
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  Biaya
                  <span class="font-medium text-slate-700">{formatRupiah(compCost)}</span>{#if compBaseUnit}<span>/{compBaseUnit}</span>{/if}
                  {#if compUnitFactor !== 1}
                    &middot; 1 {compChosenUnit} = {compUnitFactor} {compBaseUnit}
                  {/if}
                  &middot; menyumbang
                  <span class="font-medium text-slate-700">{formatRupiah(compSubtotal)}</span>
                  ke produk ini
                </p>
              </div>
            {/each}
          </div>

          <div class="mt-4 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
            <span class="text-sm text-slate-500">Biaya efektif</span>
            <span class="text-lg font-semibold text-slate-900">
              {formatRupiah(effectiveFormCost)}
            </span>
          </div>
        {/if}
      </Card>
    {/if}

    <!-- PRICING & INVENTORY -->
    <Card title="Harga & Stok" description="Biaya, harga jual per daftar harga, dan stok.">
      <div class="grid gap-4 sm:grid-cols-2">
        <Select
          label="Satuan"
          placeholder="Pilih satuan"
          tooltip={form.kind === 'composite'
            ? 'Satuan output produk ini — yaitu 1 unit hasil jadinya (mis. porsi, paket, pcs, potong). Bukan satuan bahan-bahannya; bahan punya satuan sendiri masing-masing.'
            : 'Satuan dasar untuk jual barang ini — mis. pcs, kg, gram, botol, liter. Kalau jual juga per dus/karton, tambah di Satuan Kemasan.'}
          bind:value={form.unitId}
          options={unitOptions}
          error={errors.unitId}
        />
        <Select
          label="Acuan biaya untuk hitung harga jual"
          tooltip="Hanya berpengaruh kalau harga jual pakai 'Persen untung' atau 'Biaya + nominal'. Pengaturan ini menentukan angka biaya yang dipakai saat hitung. Tidak berlaku untuk harga jual tetap."
          bind:value={form.markupCostSource}
          options={markupCostSourceOptions.map((o) => ({ value: o.value, label: o.label }))}
          hint={markupCostSourceOptions.find((o) => o.value === form.markupCostSource)?.description}
        />
      </div>

      <div class="mt-4">
        {#if showComponents}
          <span class="mb-1.5 block text-sm font-medium text-slate-700">
            {costIsFromBatch ? 'Biaya saat ini' : 'Biaya efektif'}
          </span>
          <div
            class="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
          >
            <span class="font-medium text-slate-900">{formatRupiah(effectiveFormCost)}</span>
            <span class="ml-1.5 text-xs text-slate-500">
              {#if costIsFromBatch}
                {costSourceLabel}
              {:else}
                dari {form.components.length} komponen
              {/if}
            </span>
          </div>
          {#if costIsFromBatch}
            <p class="mt-1.5 text-xs text-slate-500">
              Resep: {formatRupiah(recipeFormCost)}
            </p>
          {/if}
        {:else}
          <MoneyInput
            label={costFieldLabel}
            bind:value={form.cost}
            hint={costFieldHint}
            error={errors.cost}
          />
          {#if costIsFromBatch}
            <p class="mt-1.5 text-xs text-slate-500">
              Biaya saat ini:
              <span class="font-medium text-slate-700">{formatRupiah(effectiveFormCost)}</span>
              <span>{costSourceLabel}</span>
            </p>
          {/if}
        {/if}
        {#if costZeroWarning}
          <div
            class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          >
            {costZeroMessage}
          </div>
        {/if}
      </div>

      <div class="mt-6 border-t border-slate-100 pt-5">
        <div class="mb-1 flex items-center gap-2">
          <BadgePercent class="h-4 w-4 text-slate-500" />
          <h4 class="text-sm font-semibold text-slate-900">Harga jual</h4>
          <Tooltip
            content="Harga yang dibayar pelanggan. Bisa diatur tetap (mis. Rp 8.000) atau dihitung otomatis dari biaya (biaya + nominal, atau biaya × persen untung). Tambahkan 'Tingkat harga' jika ingin harga berbeda untuk pembelian dalam jumlah banyak."
          />
          <div class="ml-auto flex items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-slate-400"
              onclick={openPriceAdjustmentModal}
              disabled={!hasAnyPriceEntries}
              title={hasAnyPriceEntries
                ? 'Naikkan/turunkan harga sekaligus di semua daftar harga, varian, dan kemasan'
                : 'Tambahkan minimal satu harga dulu'}
            >
              <Wand2 class="h-3.5 w-3.5" />
              Sesuaikan harga
            </button>
            {#if product?.id}
              <a
                href="/riwayat-harga?productId={product.id}"
                class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                title="Lihat semua perubahan harga produk ini"
              >
                <History class="h-3.5 w-3.5" />
                Lihat riwayat harga
              </a>
            {/if}
            <a
              href="/pricelists"
              class="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Kelola daftar harga →
            </a>
          </div>
        </div>
        <p class="mb-4 text-xs text-slate-500">
          Isi harga jual normal di sini. Klik "Tambah tingkat harga" kalau pelanggan dapat harga
          beda saat beli banyak (mis. beli 12 botol harga turun).
        </p>

        <div class="space-y-3">
          {#each orderedProductEntries as entry (entry.pricelistId)}
            {@const pl = pricelists.getById(entry.pricelistId)}
            {#if pl}
              <div class="rounded-lg border border-slate-200 bg-white p-3">
                <div class="mb-3 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5">
                    {#if pl.isDefault}
                      <Star class="h-3.5 w-3.5 text-amber-500" />
                    {/if}
                    <span class="text-sm font-medium text-slate-900">{pl.name}</span>
                    {#if pl.isDefault}
                      <span class="text-[10px] uppercase tracking-wider text-slate-400">
                        utama
                      </span>
                    {/if}
                  </div>
                  {#if !pl.isDefault}
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      onclick={() => removeProductPricelist(pl.id)}
                      aria-label="Hapus daftar harga {pl.name}"
                    >
                      <X class="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  {/if}
                </div>
                <PricingInput
                  compact
                  cost={effectiveFormCost}
                  bind:strategy={entry.pricing}
                  error={errors[`prod_${pl.id}_pricing`]}
                />
                <div class="mt-3">
                  <Collapsible
                    title={entry.tiers.length > 0
                      ? `Tingkat harga (${entry.tiers.length})`
                      : 'Tambah tingkat harga'}
                  >
                    <TierEditor
                      cost={effectiveFormCost}
                      bind:tiers={entry.tiers}
                      {errors}
                      keyPrefix={`prod_${pl.id}_`}
                    />
                  </Collapsible>
                </div>
              </div>
            {/if}
          {/each}
        </div>

        {#if availablePricelists.length > 0}
          <div class="mt-3 flex flex-wrap gap-2">
            {#each availablePricelists as pl (pl.id)}
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                onclick={() => addProductPricelist(pl.id)}
              >
                <Plus class="h-3 w-3" />
                Tambah harga untuk {pl.name}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="mt-6 border-t border-slate-100 pt-5">
        {#if showComponents}
          <span class="mb-1.5 block text-sm font-medium text-slate-700">Stok produksi</span>
          <div
            class="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
          >
            <span class="font-medium text-slate-900">{producibleFormStock}</span>
            <span class="ml-1.5 text-xs text-slate-500">
              {baseCode}, dibatasi ketersediaan komponen
            </span>
          </div>
        {:else}
          <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-500">
            Stok dikelola di <a href="/inventory" class="font-medium text-brand-700 hover:underline">Inventaris</a>
            — terima PO, atur stok manual, atau lihat batch per produk di sana.
          </div>
        {/if}
      </div>

      <!-- Opt-in feature chips. Komponen tidak masuk di sini — kartu Bahan
           / Isi paket sudah selalu muncul untuk produk komposit di atas. -->
      {@const canAddPackaging = form.kind === 'goods' && !showPackagings}
      {@const canAddVariant = !showVariants}
      {@const canAddExtra = !showExtras}
      {#if canAddPackaging || canAddVariant || canAddExtra}
        <div class="mt-6 border-t border-slate-100 pt-5">
          <p class="mb-2 text-xs font-medium text-slate-500">Tambahkan ke produk ini</p>
          <div class="flex flex-wrap gap-2">
            {#if canAddPackaging}
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                onclick={addPackaging}
              >
                <Layers class="h-3.5 w-3.5" />
                Tambah satuan (dos, karton…)
              </button>
            {/if}
            {#if canAddVariant}
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                onclick={addVariant}
              >
                <Shapes class="h-3.5 w-3.5" />
                Tambah varian (ukuran, warna…)
              </button>
            {/if}
            {#if canAddExtra}
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                onclick={addExtra}
              >
                <Plus class="h-3.5 w-3.5" />
                Tambah ekstra (saus, topping…)
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </Card>

    <!-- PACKAGINGS (conditional) -->
    {#if showPackagings}
      <Card>
        {#snippet header()}
          <Button size="sm" variant="outline" onclick={addPackaging}>
            <Plus class="h-4 w-4" />
            Tambah satuan
          </Button>
        {/snippet}
        <div class="mb-3 flex items-center gap-2">
          <Layers class="h-4 w-4 text-slate-500" />
          <h3 class="text-sm font-semibold text-slate-900">Satuan kemasan</h3>
          <Badge variant="outline" size="sm">{form.units.length}</Badge>
        </div>
        <p class="mb-4 text-xs text-slate-500">
          Jual produk yang sama dalam beberapa satuan kemasan (dos, karton). Biaya efektif adalah
          <code class="rounded bg-slate-100 px-1 font-mono">faktor × biaya beli</code>.
        </p>

        <div class="space-y-3">
          {#each form.units as pack, i (i)}
            {@const packUnit = units.getById(pack.unitId)}
            {@const packCode = packUnit?.code ?? '?'}
            {@const packCost = pack.factor * effectiveFormCost}
            <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              <div class="grid gap-3 md:grid-cols-[1.1fr_0.9fr_1fr_auto] md:items-end">
                <Select
                  label="Satuan"
                  bind:value={pack.unitId}
                  options={unitOptions}
                  error={errors[`u_${i}_unitId`]}
                />
                <Input
                  label="Berisi"
                  type="number"
                  step="any"
                  min="0"
                  bind:value={pack.factor}
                  hint="1 {packCode} = {pack.factor || '?'} {baseCode}"
                  error={errors[`u_${i}_factor`]}
                />
                <Input
                  label="Barcode"
                  placeholder="opsional"
                  bind:value={pack.barcode}
                  error={errors[`u_${i}_barcode`]}
                />
                <button
                  type="button"
                  class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Hapus satuan"
                  onclick={() => removePackaging(i)}
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <Collapsible title={`Harga jual — ${priceSummary(pack.prices, packCost)}`}>
                <div class="space-y-3 rounded-lg bg-slate-50/60 p-3">
                  {#each pack.prices as entry (entry.pricelistId)}
                    {@const pl = pricelists.getById(entry.pricelistId)}
                    {#if pl}
                      <div class="rounded-lg border border-slate-200 bg-white p-2.5">
                        <div class="mb-2 flex items-center gap-1.5">
                          {#if pl.isDefault}
                            <Star class="h-3 w-3 text-amber-500" />
                          {/if}
                          <span class="text-xs font-medium text-slate-700">{pl.name}</span>
                        </div>
                        <PricingInput
                          compact
                          cost={packCost}
                          bind:strategy={entry.pricing}
                          error={errors[`u_${i}_${pl.id}_pricing`]}
                        />
                        <div class="mt-2">
                          <Collapsible
                            title={entry.tiers.length > 0
                              ? `Volume tiers (${entry.tiers.length})`
                              : 'Add volume tier'}
                          >
                            <TierEditor
                              cost={packCost}
                              bind:tiers={entry.tiers}
                              {errors}
                              keyPrefix={`u_${i}_${pl.id}_`}
                            />
                          </Collapsible>
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
              </Collapsible>
            </div>
          {/each}
        </div>
      </Card>
    {/if}

    <!-- EXTRAS (conditional) -->
    {#if showExtras}
      <Card>
        {#snippet header()}
          <Button size="sm" variant="outline" onclick={addExtra}>
            <Plus class="h-4 w-4" />
            Tambah ekstra
          </Button>
        {/snippet}
        <div class="mb-3 flex items-center gap-2">
          <Plus class="h-4 w-4 text-slate-500" />
          <h3 class="text-sm font-semibold text-slate-900">Ekstra / tambahan opsional</h3>
          <Badge variant="outline" size="sm">{form.extras.length}</Badge>
          <Tooltip
            content="Tambahan yang bisa dipilih pelanggan saat pesan, mis. tambah keju, ganti susu almond, atau bungkus kado. Tiap ekstra punya harga tambahan, dan bisa diatur untuk memotong stok bahan tertentu."
          />
        </div>
        <p class="mb-4 text-xs text-slate-500">
          Pilihan tambahan saat pelanggan pesan (mis. tambah keju, ganti susu). Tiap pilihan punya
          harga tambahan, dan boleh diatur supaya ikut memotong stok bahan.
        </p>

        <div class="space-y-3">
          {#each form.extras as extra, i (extra.id)}
            <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              <div class="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
                <Input
                  label="Nama"
                  placeholder="mis. Tambah keju"
                  bind:value={extra.name}
                  error={errors[`ex_${i}_name`]}
                />
                <MoneyInput
                  label="Harga tambahan"
                  bind:value={extra.priceDelta}
                  hint="Ditambah ke harga utama saat pelanggan pilih ekstra ini."
                  error={errors[`ex_${i}_price`]}
                />
                <button
                  type="button"
                  class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Hapus ekstra"
                  onclick={() => removeExtra(i)}
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <Collapsible
                title={extra.components.length > 0
                  ? `Bahan yang dipotong (${extra.components.length})`
                  : 'Atur bahan yang dipotong (opsional)'}
              >
                <div class="space-y-2 rounded-lg bg-slate-50/60 p-3">
                  {#if extra.components.length === 0}
                    <p class="text-center text-xs text-slate-400">
                      Tambahkan komponen jika memilih ekstra ini harus mengurangi stok bahan.
                    </p>
                  {/if}
                  {#each extra.components as ec, eci (ec.id)}
                    {@const ecVarOpts = componentVariantOptionsFor(ec.productId)}
                    {@const ecUnitOpts = componentUnitOptionsFor(ec.productId)}
                    {@const ecBaseUnit = componentUnitLabel(ec.productId)}
                    {@const ecFactor = ec.unitFactor ?? 1}
                    {@const ecChosenUnit =
                      ec.unitId && ec.unitId !== products.getById(ec.productId)?.unitId
                        ? units.getById(ec.unitId)?.code ?? ecBaseUnit
                        : ecBaseUnit}
                    {@const ecBaseUnitId = products.getById(ec.productId)?.unitId ?? ''}
                    <div class="rounded-lg border border-slate-200 bg-white p-2.5">
                      <div class="grid gap-2 md:grid-cols-[2fr_1.5fr_auto] md:items-end">
                        <Select
                          label="Produk"
                          value={ec.productId}
                          onchange={(e) => {
                            ec.productId = (e.currentTarget as HTMLSelectElement).value;
                            ec.variantId = undefined;
                            ec.unitId = undefined;
                            ec.unitFactor = undefined;
                          }}
                          options={componentProductOptions}
                          error={errors[`ex_${i}_c${eci}_product`]}
                        />
                        {#if ecVarOpts.length > 0}
                          <Select
                            label="Varian"
                            value={ec.variantId ?? ''}
                            onchange={(e) => {
                              const vv = (e.currentTarget as HTMLSelectElement).value;
                              ec.variantId = vv || undefined;
                            }}
                            options={ecVarOpts}
                          />
                        {:else}
                          <div class="hidden md:block"></div>
                        {/if}
                        <button
                          type="button"
                          class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Hapus komponen"
                          onclick={() => removeExtraComponent(extra, eci)}
                        >
                          <Trash2 class="h-4 w-4" />
                        </button>
                      </div>
                      <div class="mt-2 grid gap-2 md:grid-cols-[0.6fr_1.4fr] md:items-end">
                        <Input
                          label="Qty"
                          type="number"
                          step="any"
                          min="0"
                          bind:value={ec.quantity}
                          error={errors[`ex_${i}_c${eci}_quantity`]}
                        />
                        {#if ecUnitOpts.length > 1}
                          <Select
                            label="Satuan"
                            value={`${ec.unitId ?? ecBaseUnitId}|${ecFactor}`}
                            options={ecUnitOpts}
                            onchange={(e) =>
                              onComponentUnitChange(
                                ec,
                                (e.currentTarget as HTMLSelectElement).value
                              )}
                          />
                        {:else}
                          <div class="hidden md:block"></div>
                        {/if}
                      </div>
                      {#if ecFactor !== 1}
                        <p class="mt-1.5 text-xs text-slate-500">
                          1 {ecChosenUnit} = {ecFactor} {ecBaseUnit}
                        </p>
                      {/if}
                    </div>
                  {/each}
                  <Button size="sm" variant="outline" onclick={() => addExtraComponent(extra)}>
                    <Plus class="h-3.5 w-3.5" />
                    Tambah dampak stok
                  </Button>
                </div>
              </Collapsible>
            </div>
          {/each}
        </div>
      </Card>
    {/if}

    <!-- VARIANTS (conditional) -->
    {#if showVariants}
      <Card>
        {#snippet header()}
          <Button size="sm" variant="outline" onclick={addVariant}>
            <Plus class="h-4 w-4" />
            Tambah varian
          </Button>
        {/snippet}
        <div class="mb-3 flex items-center gap-2">
          <Shapes class="h-4 w-4 text-slate-500" />
          <h3 class="text-sm font-semibold text-slate-900">Varian</h3>
          <Badge variant="outline" size="sm">{form.variants.length}</Badge>
          <Tooltip
            content="Varian = versi berbeda dari produk yang sama. Mis. Kaos punya varian warna (Merah, Biru) dan ukuran (S, M, L). Tiap varian punya stok dan barcode sendiri."
          />
        </div>
        <p class="mb-3 text-xs text-slate-500">
          Versi berbeda dari produk yang sama (mis. warna, ukuran). Tentukan pilihan-pilihannya
          di bawah, lalu sistem otomatis membuat varian per kombinasi.
        </p>

        <details class="mb-4 rounded-lg border border-slate-200 bg-blue-50/40 px-3 py-2 text-xs">
          <summary class="cursor-pointer font-medium text-slate-700">
            💡 Kapan pakai varian vs pisah jadi produk baru?
          </summary>
          <div class="mt-2 space-y-2 text-slate-600">
            <p class="font-semibold text-slate-700">Pakai varian kalau:</p>
            <ul class="ml-4 list-disc space-y-1">
              <li>Versi yang sama produk — beda warna, ukuran, atau edisi (Kaos Merah/Biru, Sepatu 39/40/41).</li>
              <li>Customer mikirnya "produk yang sama, tinggal pilih varian".</li>
              <li>Laporan & analisis lebih masuk akal kalau digabung (mis. total penjualan Kaos Polos lintas warna).</li>
              <li>Stok dipisah per varian, tapi katalog tampil satu kartu produk.</li>
            </ul>

            <p class="mt-3 font-semibold text-slate-700">Pisah jadi produk baru kalau:</p>
            <ul class="ml-4 list-disc space-y-1">
              <li>Spec teknis beda penting — Aqua 600mL vs 1.5L (isi beda, supplier mungkin beda, harga ratusan persen beda).</li>
              <li>Beda kategori atau brand di laporan keuangan.</li>
              <li>Customer cari di katalog dengan nama yang beda banget (nasi goreng vs nasi uduk — bukan "nasi" dengan varian).</li>
              <li>Butuh kemasan kemasan jualnya benar-benar beda — mis. satu pakai dus 24, satu pakai dus 12.</li>
            </ul>

            <p class="mt-3 font-semibold text-slate-700">Cukup kemasan (satuan tambahan) saja kalau:</p>
            <ul class="ml-4 list-disc space-y-1">
              <li>Produknya sama persis, cuma cara jualnya beda (Cola kaleng dijual ecer / 6-pack / dus 24).</li>
              <li>Tidak ada perbedaan warna/ukuran/edisi.</li>
            </ul>

            <div class="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-slate-700">
              <p class="font-semibold">⚠ Kalau pakai varian + kemasan bareng</p>
              <p class="mt-1.5">
                Harga jual & barcode untuk satu kemasan <strong>shared lintas varian</strong>.
                Misal Kaos × Lusin: harga 1 lusin = sama untuk Hitam, Putih, Abu-abu —
                model tidak bisa simpan harga jual berbeda per (warna, lusin).
                <br />
                <span class="text-slate-500">
                  Catatan: ini hanya soal <strong>harga jual</strong>. Di PO, tiap line
                  bisa punya harga beli sendiri (mis. Hijau Rp 5jt/gross, Merah Rp 5,5jt/gross)
                  — itu bebas diatur saat input PO.
                </span>
              </p>

              <p class="mt-2.5 font-semibold">Kalau harga jual per (varian, kemasan) harus benar-benar beda:</p>
              <ul class="ml-4 mt-1 list-disc space-y-1">
                <li>
                  <strong>Selisih kecil (&lt;10%)</strong> → ambil rata-rata, terima saja
                  (paling simple, paling sering dipakai).
                </li>
                <li>
                  <strong>Selisih besar</strong> → jadikan kemasan sebagai varian.
                  Pakai 2 atribut: <em>Warna</em> + <em>Kemasan</em> (mis. Merah/Hijau ×
                  Ecer/Lusin/Gross = 9 varian eksplisit). Tiap kombinasi punya harga sendiri.
                  <span class="text-slate-500">
                    Trade-off: kehilangan konversi otomatis "1 lusin = 12 pcs"; stok di-track
                    per kombinasi lebih manual.
                  </span>
                </li>
                <li>
                  <strong>Spec teknis berbeda</strong> → pisah jadi produk berbeda per warna
                  (mis. "Kaos Polos Merah", "Kaos Polos Hijau" sebagai 3 produk independen,
                  masing-masing dengan 3 kemasan sendiri).
                </li>
              </ul>
            </div>
          </div>
        </details>

        <!-- Attribute editor -->
        <div class="mb-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <div class="mb-2 flex items-center gap-2">
            <Tags class="h-4 w-4 text-slate-500" />
            <h5 class="text-sm font-semibold text-slate-900">Pilihan variasi</h5>
            <Badge variant="outline" size="sm">{form.attributes.length}</Badge>
            <Tooltip
              content="Tambahkan jenis variasi (mis. Warna) lalu isi nilainya (Merah, Biru, Hijau). Klik 'Hasilkan varian' untuk membuat satu varian per kombinasi otomatis."
            />
          </div>
          <p class="mb-3 text-xs text-slate-500">
            Isi jenis variasi (mis. Warna, Ukuran) beserta nilai-nilainya, lalu klik "Hasilkan
            varian" untuk membuat satu varian per kombinasi.
          </p>

          {#if form.attributes.length === 0}
            <div
              class="rounded-lg border border-dashed border-slate-200 bg-white py-4 text-center text-xs text-slate-500"
            >
              Belum ada atribut — tambahkan untuk menghasilkan varian otomatis.
            </div>
          {:else}
            <div class="space-y-2">
              {#each form.attributes as attr, i (attr.id)}
                <div class="rounded-lg border border-slate-200 bg-white p-3">
                  <div class="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
                    <Input
                      label="Nama atribut"
                      placeholder="mis. Warna"
                      bind:value={attr.name}
                    />
                    <div>
                      <span class="mb-1.5 block text-sm font-medium text-slate-700">
                        Nilai
                      </span>
                      <ChipInput
                        bind:values={attr.values}
                        placeholder="Tambah nilai, tekan Enter"
                      />
                    </div>
                    <button
                      type="button"
                      class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Hapus atribut"
                      onclick={() => removeAttribute(i)}
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="outline" onclick={addAttribute}>
              <Plus class="h-4 w-4" />
              Tambah atribut
            </Button>
            <Button
              size="sm"
              onclick={runGenerate}
              disabled={!generatorReady || projectedCount === 0}
            >
              <Wand2 class="h-4 w-4" />
              {projectedCount > 0
                ? `Hasilkan ${projectedCount} varian`
                : 'Hasilkan varian'}
            </Button>
          </div>
        </div>

        <!-- Variant list -->
        {#if form.variants.length === 0}
          <div
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 py-5 text-center text-xs text-slate-500"
          >
            Belum ada varian. Tambahkan manual atau hasilkan dari atribut di atas.
          </div>
        {:else}
          <div class="space-y-3">
            {#each form.variants as variant, i (variant.id)}
              {@const variantCostForPricing = form.kind === 'composite' ? variantEffectiveCost(variant) : variant.cost}
              <div class="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                {#if Object.keys(variant.values).length > 0}
                  <div class="flex flex-wrap gap-1">
                    {#each Object.entries(variant.values) as [k, v]}
                      <span
                        class="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700"
                      >
                        <span class="text-brand-500">{k}:</span>
                        {v}
                      </span>
                    {/each}
                  </div>
                {/if}
                <div class="grid gap-3 md:grid-cols-[1.3fr_1.3fr_1fr_auto] md:items-end">
                  <Input
                    label="Nama"
                    placeholder="mis. Merah / Besar"
                    bind:value={variant.name}
                    error={errors[`v_${i}_name`]}
                  />
                  <Input
                    label="SKU"
                    placeholder="mis. TSH-RED-L"
                    bind:value={variant.sku}
                    error={errors[`v_${i}_sku`]}
                  />
                  <Input
                    label="Barcode"
                    placeholder="opsional"
                    bind:value={variant.barcode}
                    error={errors[`v_${i}_barcode`]}
                  />
                  <button
                    type="button"
                    class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Hapus varian"
                    onclick={() => removeVariant(i)}
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
                <Input
                  label="Nama struk (opsional)"
                  placeholder={`Auto: ${shortenForReceipt(`${form.name || 'Produk'} ${variant.name || ''}`.trim())}`}
                  bind:value={variant.printName}
                  hint="Versi pendek per varian untuk dicetak di nota (~18 huruf). Kosongkan untuk pakai gabungan otomatis dari nama produk + varian."
                />
                <div class="grid gap-3 md:grid-cols-[1fr_2fr] md:items-end">
                  <MoneyInput
                    label="Biaya"
                    bind:value={variant.cost}
                    error={errors[`v_${i}_cost`]}
                  />
                  <Input
                    label="URL Gambar"
                    placeholder="opsional"
                    bind:value={variant.imageUrl}
                  />
                </div>
                {#if form.kind === 'composite'}
                  {@const variantCost = variantEffectiveCost(variant)}
                  <Collapsible
                    title={`Resep — ${formatRupiah(variantCost)} biaya efektif (${variant.components.length} komponen)`}
                  >
                    <div class="space-y-2 rounded-lg bg-slate-50/60 p-3">
                      {#if variant.components.length === 0}
                        <p class="text-center text-xs text-slate-400">
                          Belum ada komponen — varian ini akan menggunakan resep level produk.
                        </p>
                      {/if}
                      {#each variant.components as vcomp, vci (vcomp.id)}
                        {@const compVarOpts = componentVariantOptionsFor(vcomp.productId)}
                        {@const vcompUnitOpts = componentUnitOptionsFor(vcomp.productId)}
                        {@const vcompBaseUnit = componentUnitLabel(vcomp.productId)}
                        {@const vcompFactor = vcomp.unitFactor ?? 1}
                        {@const vcompChosenUnit =
                          vcomp.unitId && vcomp.unitId !== products.getById(vcomp.productId)?.unitId
                            ? units.getById(vcomp.unitId)?.code ?? vcompBaseUnit
                            : vcompBaseUnit}
                        {@const vcompBaseUnitId = products.getById(vcomp.productId)?.unitId ?? ''}
                        <div class="rounded-lg border border-slate-200 bg-white p-2.5">
                          <div class="grid gap-2 md:grid-cols-[2fr_1.5fr_auto] md:items-end">
                            <Select
                              label="Produk"
                              value={vcomp.productId}
                              onchange={(e) => {
                                vcomp.productId = (e.currentTarget as HTMLSelectElement).value;
                                vcomp.variantId = undefined;
                                vcomp.unitId = undefined;
                                vcomp.unitFactor = undefined;
                              }}
                              options={componentProductOptions}
                              error={errors[`v_${i}_c${vci}_product`]}
                            />
                            {#if compVarOpts.length > 0}
                              <Select
                                label="Varian"
                                value={vcomp.variantId ?? ''}
                                onchange={(e) => {
                                  const vv = (e.currentTarget as HTMLSelectElement).value;
                                  vcomp.variantId = vv || undefined;
                                }}
                                options={compVarOpts}
                              />
                            {:else}
                              <div class="hidden md:block"></div>
                            {/if}
                            <button
                              type="button"
                              class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Hapus komponen"
                              onclick={() => removeVariantComponent(variant, vci)}
                            >
                              <Trash2 class="h-4 w-4" />
                            </button>
                          </div>
                          <div class="mt-2 grid gap-2 md:grid-cols-[0.6fr_1.4fr] md:items-end">
                            <Input
                              label="Qty"
                              type="number"
                              step="any"
                              min="0"
                              bind:value={vcomp.quantity}
                              error={errors[`v_${i}_c${vci}_quantity`]}
                            />
                            {#if vcompUnitOpts.length > 1}
                              <Select
                                label="Satuan"
                                value={`${vcomp.unitId ?? vcompBaseUnitId}|${vcompFactor}`}
                                options={vcompUnitOpts}
                                onchange={(e) =>
                                  onComponentUnitChange(
                                    vcomp,
                                    (e.currentTarget as HTMLSelectElement).value
                                  )}
                              />
                            {:else}
                              <div class="hidden md:block"></div>
                            {/if}
                          </div>
                          {#if vcompFactor !== 1}
                            <p class="mt-1.5 text-xs text-slate-500">
                              1 {vcompChosenUnit} = {vcompFactor} {vcompBaseUnit}
                            </p>
                          {/if}
                        </div>
                      {/each}
                      <Button size="sm" variant="outline" onclick={() => addVariantComponent(variant)}>
                        <Plus class="h-3.5 w-3.5" />
                        Tambah komponen ke varian ini
                      </Button>
                    </div>
                  </Collapsible>
                {/if}
                <Collapsible title={`Harga jual — ${priceSummary(variant.prices, variantCostForPricing)}`}>
                  <div class="space-y-3 rounded-lg bg-slate-50/60 p-3">
                    {#each variant.prices as entry (entry.pricelistId)}
                      {@const pl = pricelists.getById(entry.pricelistId)}
                      {#if pl}
                        <div class="rounded-lg border border-slate-200 bg-white p-2.5">
                          <div class="mb-2 flex items-center gap-1.5">
                            {#if pl.isDefault}
                              <Star class="h-3 w-3 text-amber-500" />
                            {/if}
                            <span class="text-xs font-medium text-slate-700">{pl.name}</span>
                          </div>
                          <PricingInput
                            compact
                            cost={variantCostForPricing}
                            bind:strategy={entry.pricing}
                            error={errors[`v_${i}_${pl.id}_pricing`]}
                          />
                          <div class="mt-2">
                            <Collapsible
                              title={entry.tiers.length > 0
                                ? `Tingkat harga (${entry.tiers.length})`
                                : 'Tambah tingkat harga'}
                            >
                              <TierEditor
                                cost={variantCostForPricing}
                                bind:tiers={entry.tiers}
                                {errors}
                                keyPrefix={`v_${i}_${pl.id}_`}
                              />
                            </Collapsible>
                          </div>
                        </div>
                      {/if}
                    {/each}
                  </div>
                </Collapsible>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    {/if}
  </div>

  <!-- SIDEBAR -->
  <div class="space-y-4">
    <Card title="Pengelompokan" description="Letak produk ini di katalog dan pengaturan pajaknya.">
      <div class="space-y-4">
        <Select
          label="Kategori"
          placeholder="Pilih kategori"
          tooltip="Pengelompokan produk untuk laporan & filter. Mis. Minuman, Makanan, Merchandise."
          bind:value={form.categoryId}
          options={categoryOptions}
          error={errors.categoryId}
        />
        <Select
          label="Brand"
          tooltip="Merek pabrik / produsen produk. Berguna untuk filter dan grouping di laporan. Kosongkan kalau tidak relevan."
          bind:value={form.brandId}
          options={brandOptions}
        />
        <div>
          <div class="mb-1.5 flex items-center gap-1.5">
            <span class="text-sm font-medium text-slate-700">Tag</span>
            <Tooltip
              content="Label fleksibel di luar kategori — mis. 'Baru', 'Best Seller', 'Halal', 'Promo'. Ketik untuk cari & pilih, atau tambah baru. Atur warna & visibilitas di halaman Tag."
            />
          </div>
          <ChipInput
            bind:values={form.tags}
            suggestions={tags.items.map((t) => t.name)}
            placeholder="Ketik untuk cari atau tambah tag…"
          />
        </div>
        <Select
          label="Pajak"
          tooltip="Tarif PPN untuk produk ini. Biarkan 'Ikut tarif kategori' kalau pajaknya sama dengan kategori."
          bind:value={form.taxRateId}
          options={taxRateSelectOptions}
          hint="Pilih tarif khusus hanya kalau produk ini punya pajak beda dari kategorinya."
        />
        <Select
          label="Status"
          tooltip="Produk Aktif muncul di Kasir. Diarsipkan = disembunyikan dari penjualan tapi tetap ada di sistem untuk laporan history."
          bind:value={form.status}
          options={statusOptions}
          hint="Produk yang diarsipkan tidak muncul di Kasir."
        />
      </div>
    </Card>

    <Card
      title="Pemasok"
      description="Boleh isi lebih dari satu pemasok. Klik baris untuk lihat detail. Tandai bintang (★) untuk pemasok utama."
    >
      {#if form.suppliers.length === 0}
        <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-3 py-5 text-center">
          <p class="text-sm font-medium text-slate-600">Belum ada pemasok</p>
          <p class="mt-1 text-xs text-slate-500">
            Tambah agar fitur PO &amp; Prediksi Stok bisa autofill.
          </p>
          <Button size="sm" variant="outline" class="mt-3" onclick={addSupplierRow}>
            <Plus class="h-3.5 w-3.5" />
            Tambah pemasok
          </Button>
        </div>
      {:else}
        <div class="space-y-2">
          {#each form.suppliers as ps, i (i)}
            {@const expanded = isSupplierExpanded(i)}
            {@const leadFallback = supplierLeadFallback(ps.supplierId)}
            {@const effLead = effectiveLeadDays(ps)}
            <div
              class="rounded-lg border transition-colors
                {ps.isPrimary
                ? 'border-brand-300 bg-brand-50/30'
                : 'border-slate-200 bg-white'}"
            >
              <!-- Header row — always visible -->
              <div class="flex items-center gap-1 p-1.5">
                <!-- Primary star toggle -->
                <button
                  type="button"
                  class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                    {ps.isPrimary
                    ? 'text-amber-500'
                    : 'text-slate-300 hover:text-amber-500'}
                    disabled:cursor-not-allowed disabled:opacity-50"
                  onclick={(e) => {
                    e.stopPropagation();
                    setPrimarySupplier(i);
                  }}
                  disabled={!ps.supplierId || ps.isPrimary}
                  aria-label={ps.isPrimary ? 'Pemasok utama' : 'Jadikan utama'}
                  title={ps.isPrimary ? 'Pemasok utama' : 'Jadikan utama'}
                >
                  <Star class="h-4 w-4" fill={ps.isPrimary ? 'currentColor' : 'none'} />
                </button>

                <!-- Toggle button (chevron + summary) -->
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-slate-50"
                  onclick={() => toggleSupplierExpanded(i)}
                  aria-expanded={expanded}
                >
                  <ChevronRight
                    class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform {expanded
                      ? 'rotate-90'
                      : ''}"
                  />
                  <div class="min-w-0 flex-1">
                    {#if ps.supplierId}
                      <div class="truncate text-sm font-medium text-slate-900">
                        {supplierNameFor(ps.supplierId)}
                      </div>
                      <div class="truncate text-[10px] text-slate-500">
                        Rp {ps.unitCost.toLocaleString('id-ID')}
                        {#if effLead > 0}
                          · tunggu {effLead}h{#if ps.leadTimeDays === undefined && leadFallback > 0}
                            <span class="text-slate-400"> (default)</span>
                          {/if}
                        {/if}
                        {#if ps.supplierSku}
                          · <code class="font-mono">{ps.supplierSku}</code>
                        {/if}
                      </div>
                    {:else}
                      <div class="text-sm font-medium text-slate-400 italic">
                        Pilih pemasok…
                      </div>
                    {/if}
                  </div>
                </button>

                <!-- Remove -->
                <button
                  type="button"
                  class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Hapus pemasok"
                  onclick={(e) => {
                    e.stopPropagation();
                    removeSupplierRow(i);
                  }}
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>

              <!-- Expanded form -->
              {#if expanded}
                <div class="space-y-2.5 border-t border-slate-100 bg-white/60 p-3">
                  <Select
                    label="Pemasok"
                    bind:value={ps.supplierId}
                    options={supplierOptionsFor(i)}
                  />
                  <MoneyInput
                    label="Harga / unit dasar"
                    bind:value={ps.unitCost}
                  />
                  <Input
                    label="Waktu tunggu (hari)"
                    type="number"
                    min="0"
                    value={ps.leadTimeDays ?? ''}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value;
                      ps.leadTimeDays = v === '' ? undefined : Number(v);
                    }}
                    placeholder={leadFallback ? `Default ${leadFallback}h` : ''}
                    hint="Kosongkan untuk pakai default pemasok."
                  />
                  <Input
                    label="SKU pemasok"
                    placeholder="Kode katalog pemasok"
                    bind:value={ps.supplierSku}
                  />
                  <Input
                    label="Min order"
                    tooltip="Jumlah minimum pesanan yang diterima pemasok ini, dalam satuan dasar produk. Kosongkan kalau tidak ada batasan. Akan jadi peringatan di form PO kalau dipesan kurang."
                    type="number"
                    min="0"
                    value={ps.minOrderQty ?? ''}
                    oninput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value;
                      ps.minOrderQty = v === '' ? undefined : Number(v);
                    }}
                    placeholder="opsional"
                    hint="Mis. 12 = minimal pesan 12 pcs."
                  />
                  <Textarea
                    label="Catatan"
                    placeholder="Termin pembayaran, syarat khusus, dll."
                    bind:value={ps.notes}
                  />
                </div>
              {/if}
            </div>
          {/each}

          <Button variant="outline" size="sm" onclick={addSupplierRow}>
            <Plus class="h-3.5 w-3.5" />
            Tambah pemasok lain
          </Button>
        </div>
      {/if}
    </Card>

    {#if product?.id}
      {@const cmp = supplierComparison(product.id)}
      {#if cmp.length > 0}
        {@const cheapestId = cmp.reduce((min, x) => (x.latestCost < min.latestCost ? x : min)).supplierId}
        {@const mostExpensiveId = cmp.reduce((max, x) => (x.latestCost > max.latestCost ? x : max)).supplierId}
        {@const mostIncreasesId = cmp.reduce(
          (max, x) => (x.priceIncreaseCount > max.priceIncreaseCount ? x : max)
        ).supplierId}
        {@const mostFreq = cmp.reduce((max, x) => (x.batchCount > max.batchCount ? x : max))}
        <Card>
          <div class="mb-3 flex items-center gap-2">
            <h3 class="text-sm font-semibold text-slate-900">Perbandingan harga pemasok</h3>
            <Tooltip
              content="Riwayat harga aktual dari semua pemasok yang pernah kirim produk ini (dari penerimaan PO). Otomatis di-update tiap PO selesai diterima — bukan dari angka manual di kartu Pemasok di atas."
            />
          </div>
          <p class="mb-3 text-xs text-slate-500">
            Diambil dari riwayat penerimaan PO. Bandingkan sebelum membuat PO berikutnya.
          </p>
          <div class="space-y-2">
            {#each cmp as row (row.supplierId)}
              {@const isCheapest = row.supplierId === cheapestId && cmp.length > 1}
              {@const isMostExpensive = row.supplierId === mostExpensiveId && cmp.length > 1}
              {@const isMostIncreases = row.supplierId === mostIncreasesId && row.priceIncreaseCount > 0 && cmp.length > 1}
              {@const isMostFreq = row.supplierId === mostFreq.supplierId && mostFreq.batchCount > 1 && cmp.length > 1}
              {@const deltaPct =
                row.previousCost && row.previousCost > 0
                  ? ((row.latestCost - row.previousCost) / row.previousCost) * 100
                  : 0}
              <div
                class="rounded-lg border bg-white p-2.5 text-xs
                  {isCheapest
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : isMostExpensive
                    ? 'border-rose-200 bg-rose-50/40'
                    : 'border-slate-200'}"
              >
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="font-medium text-slate-900">{row.supplierName}</span>
                  {#if isCheapest}
                    <Badge variant="success" size="sm">Termurah</Badge>
                  {/if}
                  {#if isMostExpensive}
                    <Badge variant="danger" size="sm">Termahal</Badge>
                  {/if}
                  {#if isMostIncreases}
                    <Badge variant="warning" size="sm">Sering naik harga</Badge>
                  {/if}
                  {#if isMostFreq}
                    <Badge variant="info" size="sm">Paling sering</Badge>
                  {/if}
                </div>
                <div class="mt-1.5 grid gap-x-3 gap-y-0.5 text-slate-600 sm:grid-cols-[1fr_1fr]">
                  <div>
                    Harga terakhir:
                    <span class="font-semibold text-slate-900">{formatRupiah(row.latestCost)}</span>
                    {#if deltaPct !== 0}
                      <Badge variant={deltaPct > 0 ? 'danger' : 'success'} size="sm">
                        {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                      </Badge>
                    {/if}
                  </div>
                  <div>
                    Rata-rata:
                    <span class="font-medium text-slate-700">
                      {formatRupiah(row.weightedAvgCost)}
                    </span>
                  </div>
                  <div>
                    Rentang:
                    <span class="text-slate-700">
                      {formatRupiah(row.minCost)} – {formatRupiah(row.maxCost)}
                    </span>
                  </div>
                  <div>
                    Diterima:
                    <span class="text-slate-700">{row.batchCount}×</span>
                    {#if row.priceIncreaseCount > 0 || row.priceDecreaseCount > 0}
                      <span class="text-slate-500">
                        (naik {row.priceIncreaseCount}, turun {row.priceDecreaseCount})
                      </span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </Card>
      {/if}
    {/if}

    <Card>
      <div class="mb-3 flex items-center gap-2">
        <h3 class="text-sm font-semibold text-slate-900">Info tambahan</h3>
        <Tooltip
          content="Field opsional untuk produk regulated (BPOM, Halal) atau elektronik (garansi). Plus catatan bebas key-value untuk apa pun yang tidak masuk struktur di atas — mis. kandungan, ukuran, dll."
        />
      </div>
      <Collapsible
        bind:open={extraInfoOpen}
        title={form.bpomNumber || form.halalCertNumber || form.warrantyMonths > 0 || form.metadataPairs.length > 0
          ? 'Buka untuk ubah'
          : 'Isi kalau perlu'}
      >
        <div class="space-y-3">
          <Input
            label="Nomor BPOM"
            tooltip="Nomor izin edar BPOM untuk kosmetik, makanan, atau obat. Tercetak di kemasan produk regulated."
            placeholder="mis. POM NA 18101200123"
            bind:value={form.bpomNumber}
          />
          <Input
            label="Nomor sertifikat Halal"
            tooltip="Nomor sertifikat MUI Halal. Tercetak di kemasan dengan logo halal."
            placeholder="mis. 00150003420220"
            bind:value={form.halalCertNumber}
          />
          <Input
            label="Garansi (bulan)"
            tooltip="Masa garansi untuk barang elektronik / peralatan. Kosongkan atau isi 0 kalau tidak ada garansi."
            type="number"
            min="0"
            step="1"
            bind:value={form.warrantyMonths}
            hint="Mis. 12 untuk garansi 1 tahun. 0 = tanpa garansi."
          />

          <div class="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
            <div class="mb-2 flex items-center gap-1.5">
              <span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Catatan lain
              </span>
              <Tooltip
                content="Catatan key-value bebas. Mis. 'Kandungan: 100% katun', 'Ukuran botol: 600mL', 'Produsen: PT XYZ'."
                size="sm"
              />
            </div>
            {#if form.metadataPairs.length === 0}
              <p class="text-center text-xs text-slate-400">
                Belum ada catatan tambahan.
              </p>
            {/if}
            <div class="space-y-2">
              {#each form.metadataPairs as pair, i (i)}
                <div class="grid gap-2 md:grid-cols-[1fr_1.5fr_auto] md:items-center">
                  <Input placeholder="Nama info" bind:value={pair.key} />
                  <Input placeholder="Isi info" bind:value={pair.value} />
                  <button
                    type="button"
                    class="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Hapus catatan"
                    onclick={() => removeMetadataPair(i)}
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              {/each}
            </div>
            <Button size="sm" variant="outline" class="mt-2" onclick={addMetadataPair}>
              <Plus class="h-3.5 w-3.5" />
              Tambah catatan
            </Button>
          </div>
        </div>
      </Collapsible>
    </Card>

    {#if showPackagings || showVariants || form.prices.length > 1}
      <Card title="Ringkasan">
        {@const defaultEntry = findEntry(form.prices, pricelists.defaultId()) ?? form.prices[0]}
        {@const baseSale = defaultEntry ? computeSalePrice(effectiveFormCost, defaultEntry.pricing) : NaN}
        {@const effectiveTax = form.taxRateId
          ? taxRates.getById(form.taxRateId)
          : inheritedTaxRate}
        {@const taxInclusive = priceWithTax(baseSale, effectiveTax)}
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Daftar Harga</dt>
            <dd class="font-medium text-slate-900">{form.prices.length}</dd>
          </div>
          {#if showPackagings}
            <div class="flex justify-between">
              <dt class="text-slate-500">Satuan kemasan</dt>
              <dd class="font-medium text-slate-900">{1 + form.units.length}</dd>
            </div>
          {/if}
          {#if showVariants}
            <div class="flex justify-between">
              <dt class="text-slate-500">Varian</dt>
              <dd class="font-medium text-slate-900">{form.variants.length}</dd>
            </div>
          {/if}
          <div class="flex justify-between">
            <dt class="text-slate-500">Harga jual utama</dt>
            <dd class="font-medium text-slate-900">{formatRupiah(baseSale)}</dd>
          </div>
          {#if effectiveTax && effectiveTax.rate > 0}
            <div class="flex justify-between">
              <dt class="text-slate-500">
                + {effectiveTax.name}
                <span class="text-xs text-slate-400">
                  ({form.taxRateId ? 'override' : 'dari kategori'})
                </span>
              </dt>
              <dd class="font-medium text-slate-900">{formatRupiah(taxInclusive)}</dd>
            </div>
          {/if}
        </dl>
      </Card>
    {/if}
  </div>
</div>

<div
  class="sticky bottom-0 -mx-4 mt-6 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
>
  <Button variant="outline" onclick={onCancel}>Batal</Button>
  <Button onclick={submit}>{submitLabel}</Button>
</div>

<ConfirmDialog
  bind:open={confirmKindSwitchOpen}
  title="Ganti tipe produk?"
  message={pendingKind === 'composite'
    ? 'Mengganti ke Komposit akan menghapus satuan kemasan pada produk ini. Lanjutkan?'
    : 'Mengganti ke Barang akan menghapus komponen pada produk ini (termasuk resep per-varian). Lanjutkan?'}
  confirmLabel="Ganti tipe"
  variant="primary"
  onConfirm={confirmKindSwitch}
  onCancel={() => (pendingKind = null)}
/>

{#if priceAdjustmentOpen}
  <PriceAdjustmentModal
    bind:open={priceAdjustmentOpen}
    product={priceAdjustmentSnapshot}
    productPrices={form.prices}
    variants={form.variants}
    packagings={form.units}
    baseCost={effectiveFormCost}
    markupCostSource={form.markupCostSource}
    onApply={applyPricePatches}
    onClose={() => (priceAdjustmentOpen = false)}
  />
{/if}
