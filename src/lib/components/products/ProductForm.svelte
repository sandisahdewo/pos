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
    Image as ImageIcon
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
    Toggle
  } from '$lib/components/ui';
  import { categories } from '$lib/stores/categories.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { taxRates } from '$lib/stores/taxRates.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { formatRupiah } from '$lib/utils/currency';
  import { toast } from '$lib/stores/toast.svelte';
  import {
    activeAttributes,
    cloneEntry,
    computeSalePrice,
    emptyEntry,
    findEntry,
    priceWithTax,
    productKindOptions,
    products,
    regenerateVariants,
    validatePricing,
    variantCombinations,
    type CompositeComponent,
    type PricelistEntry,
    type Product,
    type ProductAttribute,
    type ProductExtra,
    type ProductInput,
    type ProductKind,
    type ProductPackaging,
    type ProductStatus,
    type ProductVariant
  } from '$lib/stores/products.svelte';
  import { stockOf } from '$lib/stores/batches.svelte';
  import TierEditor from './TierEditor.svelte';

  type Props = {
    product?: Product | null;
    submitLabel?: string;
    onSubmit: (data: ProductInput) => Product;
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
    kind: ProductKind;
    categoryId: string;
    unitId: string;
    cost: number;
    prices: PricelistEntry[];
    status: ProductStatus;
    description: string;
    taxRateId: string;
    defaultSupplierId: string;
    imageUrl: string;
    units: ProductPackaging[];
    attributes: ProductAttribute[];
    variants: ProductVariant[];
    components: CompositeComponent[];
    extras: ProductExtra[];
    requiresBatchLabel: boolean;
    requiresExpiration: boolean;
  };

  function initial(): FormState {
    const defaultId = pricelists.defaultId();
    return {
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      kind: product?.kind ?? 'goods',
      categoryId: product?.categoryId ?? categories.items[0]?.id ?? '',
      unitId: product?.unitId ?? units.items[0]?.id ?? '',
      cost: product?.cost ?? 0,
      prices: product?.prices?.map(cloneEntry) ?? [emptyEntry(defaultId)],
      status: product?.status ?? 'active',
      description: product?.description ?? '',
      taxRateId: product?.taxRateId ?? '',
      defaultSupplierId: product?.defaultSupplierId ?? '',
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
      requiresExpiration: product?.requiresExpiration ?? false
    };
  }

  let form = $state<FormState>(initial());
  let errors = $state<Record<string, string>>({});

  const categoryOptions = $derived(
    categories.items.map((c) => ({ value: c.id, label: c.name }))
  );
  const unitOptions = $derived(
    units.items.map((u) => ({ value: u.id, label: `${u.name} (${u.code})` }))
  );
  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' }
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
      categoryId: form.categoryId,
      unitId: form.unitId,
      cost: form.cost,
      prices: form.prices,
      status: form.status,
      description: form.description.trim(),
      taxRateId: form.taxRateId || undefined,
      defaultSupplierId: form.defaultSupplierId || undefined,
      imageUrl: form.imageUrl.trim(),
      kind: form.kind,
      units: form.kind === 'goods' ? form.units : [],
      attributes: form.attributes,
      variants: form.variants,
      components: form.kind === 'composite' ? form.components : [],
      extras: form.extras,
      requiresBatchLabel: form.requiresBatchLabel || undefined,
      requiresExpiration: form.requiresExpiration || undefined
    };
    onSubmit(payload);
  }

  const supplierOptions = $derived([
    { value: '', label: 'No default supplier' },
    ...suppliers.active().map((s) => ({ value: s.id, label: s.name }))
  ]);

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

  function componentCost(c: CompositeComponent): number {
    const p = products.getById(c.productId);
    if (!p) return 0;
    if (c.variantId) {
      const v = p.variants.find((vv) => vv.id === c.variantId);
      if (v) return v.cost;
    }
    return p.cost;
  }

  const effectiveFormCost = $derived(
    form.components.length === 0
      ? form.cost
      : form.components.reduce((sum, c) => sum + c.quantity * componentCost(c), 0)
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
      return Math.floor(avail / c.quantity);
    });
    return Math.min(...values);
  });

  const showComponents = $derived(form.kind === 'composite' && form.components.length > 0);
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
    if (v.components.length === 0) return v.cost;
    return v.components.reduce(
      (s, c) =>
        s + c.quantity * componentCost({ ...c, id: c.id } as CompositeComponent),
      0
    );
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

  const inheritedTaxRate = $derived.by(() => {
    const cat = categories.getById(form.categoryId);
    if (cat?.taxRateId) return taxRates.getById(cat.taxRateId);
    return taxRates.default();
  });

  const taxRateSelectOptions = $derived([
    {
      value: '',
      label: `Inherit from category${inheritedTaxRate ? ` (${inheritedTaxRate.name})` : ''}`
    },
    ...taxRates.items.map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)` }))
  ]);
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
  <div class="space-y-4 lg:col-span-2">
    <!-- BASICS -->
    <Card title="Dasar" description="Tipe, nama, SKU, gambar, dan deskripsi singkat.">
      <div class="mb-5">
        <span class="mb-1.5 block text-sm font-medium text-slate-700">Tipe produk</span>
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
            label="SKU"
            placeholder="mis. BEV-CKA-330"
            bind:value={form.sku}
            error={errors.sku}
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
        <p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Pelacakan batch</p>
        <Toggle
          bind:checked={form.requiresBatchLabel}
          label="Memerlukan label batch"
          description="Cetak label thermal saat batch baru diterima/dibuat. Berguna untuk barang perishable atau yang perlu lot tracking (roti, telur, daging, susu)."
        />
        <Toggle
          bind:checked={form.requiresExpiration}
          label="Memerlukan tanggal kedaluwarsa"
          description="Wajib mengisi tanggal kedaluwarsa saat menerima PO atau menambah stok. Penjualan FIFO akan memprioritaskan batch yang paling cepat kedaluwarsa."
        />
      </div>
    </Card>

    <!-- PRICING & INVENTORY -->
    <Card title="Harga & Stok" description="Biaya, harga jual per daftar harga, dan stok.">
      <div class="grid gap-4 sm:grid-cols-2">
        <Select
          label="Satuan"
          placeholder="Pilih satuan"
          bind:value={form.unitId}
          options={unitOptions}
          error={errors.unitId}
        />
        {#if showComponents}
          <div>
            <span class="mb-1.5 block text-sm font-medium text-slate-700">Biaya efektif</span>
            <div
              class="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
            >
              <span class="font-medium text-slate-900">{formatRupiah(effectiveFormCost)}</span>
              <span class="ml-1.5 text-xs text-slate-500">
                dari {form.components.length} komponen
              </span>
            </div>
          </div>
        {:else}
          <MoneyInput
            label="Biaya beli"
            bind:value={form.cost}
            hint="Biaya per {baseCode}. Tidak diupdate otomatis oleh PO; biaya aktual dihitung dari batch."
            error={errors.cost}
          />
        {/if}
      </div>

      <div class="mt-6 border-t border-slate-100 pt-5">
        <div class="mb-1 flex items-center gap-2">
          <BadgePercent class="h-4 w-4 text-slate-500" />
          <h4 class="text-sm font-semibold text-slate-900">Harga jual</h4>
          <a
            href="/pricelists"
            class="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Kelola daftar harga →
          </a>
        </div>
        <p class="mb-4 text-xs text-slate-500">
          Tambahkan harga per daftar harga. Klik "Tambah tingkat harga" jika ingin harga berbeda
          pada kuantitas yang lebih besar.
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

      <!-- Opt-in feature chips -->
      {@const canAddPackaging = form.kind === 'goods' && !showPackagings}
      {@const canAddComponent = form.kind === 'composite' && !showComponents}
      {@const canAddVariant = !showVariants}
      {@const canAddExtra = !showExtras}
      {#if canAddPackaging || canAddComponent || canAddVariant || canAddExtra}
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
            {#if canAddComponent}
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                onclick={addComponent}
              >
                <Boxes class="h-3.5 w-3.5" />
                Tambah komponen (resep)
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

    <!-- COMPONENTS (conditional) -->
    {#if showComponents}
      <Card>
        {#snippet header()}
          <Button size="sm" variant="outline" onclick={addComponent}>
            <Plus class="h-4 w-4" />
            Tambah komponen
          </Button>
        {/snippet}
        <div class="mb-3 flex items-center gap-2">
          <Boxes class="h-4 w-4 text-slate-500" />
          <h3 class="text-sm font-semibold text-slate-900">Komponen</h3>
          <Badge variant="outline" size="sm">{form.components.length}</Badge>
        </div>
        <p class="mb-4 text-xs text-slate-500">
          Produk lain yang membentuk produk ini — sebuah resep atau paket. Biaya efektif adalah
          jumlah `qty × biaya komponen`. Stok produksi dibatasi oleh komponen yang paling langka.
        </p>

        <div class="space-y-3">
          {#each form.components as comp, i (comp.id)}
            {@const compVariantOpts = componentVariantOptionsFor(comp.productId)}
            {@const compCost = componentCost(comp)}
            {@const compSubtotal = comp.quantity * compCost}
            {@const compUnit = componentUnitLabel(comp.productId)}
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <div class="grid gap-3 md:grid-cols-[2fr_1.5fr_0.7fr_auto] md:items-end">
                <Select
                  label="Produk"
                  placeholder="Pilih produk"
                  value={comp.productId}
                  onchange={(e) => {
                    comp.productId = (e.currentTarget as HTMLSelectElement).value;
                    comp.variantId = undefined;
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
                <Input
                  label="Qty"
                  type="number"
                  step="any"
                  min="0"
                  bind:value={comp.quantity}
                  hint={compUnit ? `dalam ${compUnit}` : undefined}
                  error={errors[`c_${i}_quantity`]}
                />
                <button
                  type="button"
                  class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Hapus komponen"
                  onclick={() => removeComponent(i)}
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <p class="mt-2 text-xs text-slate-500">
                Biaya komponen
                <span class="font-medium text-slate-700">{formatRupiah(compCost)}</span>
                {#if compUnit}<span>/{compUnit}</span>{/if}
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
      </Card>
    {/if}

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
          <h3 class="text-sm font-semibold text-slate-900">Ekstra</h3>
          <Badge variant="outline" size="sm">{form.extras.length}</Badge>
        </div>
        <p class="mb-4 text-xs text-slate-500">
          Tambahan opsional saat penjualan. Setiap ekstra punya selisih harga dan opsional
          mengurangi stok bahan saat dipilih.
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
                  label="Selisih harga"
                  bind:value={extra.priceDelta}
                  hint="Ditambahkan ke harga jual saat dipilih."
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
                  ? `Dampak stok (${extra.components.length} komponen)`
                  : 'Tambah dampak stok (opsional)'}
              >
                <div class="space-y-2 rounded-lg bg-slate-50/60 p-3">
                  {#if extra.components.length === 0}
                    <p class="text-center text-xs text-slate-400">
                      Tambahkan komponen jika memilih ekstra ini harus mengurangi stok bahan.
                    </p>
                  {/if}
                  {#each extra.components as ec, eci (ec.id)}
                    {@const ecVarOpts = componentVariantOptionsFor(ec.productId)}
                    {@const ecUnit = componentUnitLabel(ec.productId)}
                    <div class="rounded-lg border border-slate-200 bg-white p-2.5">
                      <div class="grid gap-2 md:grid-cols-[2fr_1.5fr_0.7fr_auto] md:items-end">
                        <Select
                          label="Produk"
                          value={ec.productId}
                          onchange={(e) => {
                            ec.productId = (e.currentTarget as HTMLSelectElement).value;
                            ec.variantId = undefined;
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
                        <Input
                          label="Qty"
                          type="number"
                          step="any"
                          min="0"
                          bind:value={ec.quantity}
                          hint={ecUnit ? `dalam ${ecUnit}` : undefined}
                          error={errors[`ex_${i}_c${eci}_quantity`]}
                        />
                        <button
                          type="button"
                          class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Hapus komponen"
                          onclick={() => removeExtraComponent(extra, eci)}
                        >
                          <Trash2 class="h-4 w-4" />
                        </button>
                      </div>
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
        </div>
        <p class="mb-4 text-xs text-slate-500">
          Variasi seperti ukuran atau warna. Tentukan atribut untuk menghasilkan satu varian
          per kombinasi otomatis.
        </p>

        <!-- Attribute editor -->
        <div class="mb-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <div class="mb-2 flex items-center gap-2">
            <Tags class="h-4 w-4 text-slate-500" />
            <h5 class="text-sm font-semibold text-slate-900">Atribut varian</h5>
            <Badge variant="outline" size="sm">{form.attributes.length}</Badge>
          </div>
          <p class="mb-3 text-xs text-slate-500">
            Tentukan opsi yang bervariasi (mis. Warna, Ukuran), tambahkan nilai-nilai, lalu
            hasilkan satu varian per kombinasi.
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
                        {@const vcompUnit = componentUnitLabel(vcomp.productId)}
                        <div class="rounded-lg border border-slate-200 bg-white p-2.5">
                          <div class="grid gap-2 md:grid-cols-[2fr_1.5fr_0.7fr_auto] md:items-end">
                            <Select
                              label="Produk"
                              value={vcomp.productId}
                              onchange={(e) => {
                                vcomp.productId = (e.currentTarget as HTMLSelectElement).value;
                                vcomp.variantId = undefined;
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
                            <Input
                              label="Qty"
                              type="number"
                              step="any"
                              min="0"
                              bind:value={vcomp.quantity}
                              hint={vcompUnit ? `dalam ${vcompUnit}` : undefined}
                              error={errors[`v_${i}_c${vci}_quantity`]}
                            />
                            <button
                              type="button"
                              class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Hapus komponen"
                              onclick={() => removeVariantComponent(variant, vci)}
                            >
                              <Trash2 class="h-4 w-4" />
                            </button>
                          </div>
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
    <Card title="Organisasi" description="Dimana produk ini muncul di katalog Anda.">
      <div class="space-y-4">
        <Select
          label="Kategori"
          placeholder="Pilih kategori"
          bind:value={form.categoryId}
          options={categoryOptions}
          error={errors.categoryId}
        />
        <Select
          label="Pemasok utama"
          bind:value={form.defaultSupplierId}
          options={supplierOptions}
          hint="Digunakan untuk autofill pemasok saat membuat PO untuk produk ini."
        />
        <Select
          label="Tarif pajak"
          bind:value={form.taxRateId}
          options={taxRateSelectOptions}
          hint="Override default kategori jika produk ini memiliki tarif berbeda."
        />
        <Select
          label="Status"
          bind:value={form.status}
          options={statusOptions}
          hint="Produk yang diarsipkan tidak ditampilkan di terminal Kasir."
        />
      </div>
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
