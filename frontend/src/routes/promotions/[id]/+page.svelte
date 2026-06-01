<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    ArrowLeft,
    Calendar,
    Percent,
    Plus,
    Printer,
    Trash2,
    Save,
    Tag,
    Users
  } from 'lucide-svelte';
  import {
    Alert,
    Button,
    Card,
    Checkbox,
    Input,
    MoneyInput,
    PageHeader,
    Select,
    Textarea
  } from '$lib/components/ui';
  import {
    promotions,
    promoKindLabels,
    promoLevelLabels,
    promoStatusLabels,
    type Promotion,
    type ProductScope,
    type PromoKind,
    type PromoLevel,
    type PromoStatus,
    type DiscountUnit,
    type ComboItem
  } from '$lib/stores/promotions.svelte';
  import { products, type Product } from '$lib/stores/products.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { batches } from '$lib/stores/batches.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  function productHasExpirableBatch(productId: string): boolean {
    return batches.items.some((b) => b.productId === productId && !!b.expiresAt);
  }

  function categoryHasExpirableBatch(categoryId: string): boolean {
    return products.items.some(
      (p) => p.categoryId === categoryId && productHasExpirableBatch(p.id)
    );
  }

  const scopeProductList = $derived(
    products.items
      .filter((p) => p.status === 'active')
      .filter((p) => (form.kind === 'expiring-batch' ? productHasExpirableBatch(p.id) : true))
  );

  const scopeCategoryList = $derived(
    categories.items.filter((c) =>
      form.kind === 'expiring-batch' ? categoryHasExpirableBatch(c.id) : true
    )
  );

  function unitOptionsFor(productId: string) {
    const p = products.getById(productId);
    if (!p) return [{ value: '', label: '— Semua unit —' }];
    const baseName = units.getById(p.unitId)?.name ?? p.unitId;
    const opts = [{ value: '', label: '— Semua unit —' }];
    opts.push({ value: `${p.unitId}|1`, label: `${baseName} (dasar)` });
    for (const pkg of p.units) {
      const u = units.getById(pkg.unitId);
      opts.push({
        value: `${pkg.unitId}|${pkg.factor}`,
        label: `${u?.name ?? pkg.unitId} × ${pkg.factor}`
      });
    }
    return opts;
  }

  function variantOptionsFor(productId: string) {
    const p = products.getById(productId);
    const opts = [{ value: '', label: '— Semua varian —' }];
    if (!p) return opts;
    for (const v of p.variants) opts.push({ value: v.id, label: v.name });
    return opts;
  }

  function parseUnitKey(key: string): { unitId?: string; factor?: number } {
    if (!key) return {};
    const [unitId, factorStr] = key.split('|');
    return { unitId, factor: Number(factorStr) || 1 };
  }

  const id = $derived(page.params.id ?? '');
  const isNew = $derived(id === 'new');
  const editing = $derived(isNew ? undefined : promotions.getById(id));

  type FormState = {
    name: string;
    description: string;
    notes: string;
    kind: PromoKind;
    level: PromoLevel;
    status: PromoStatus;

    discountUnit: DiscountUnit;
    discountValue: number;

    comboItems: ComboItem[];
    comboPrice: number;

    buyQuantity: number;
    getQuantity: number;
    bogoProductId: string;
    bogoVariantId: string;
    buyUnitKey: string;          // "unitId|factor" — '' = base unit
    getUnitKey: string;

    memberPricelistId: string;
    memberPercentOff: number;

    daysToExpiryThreshold: number;
    expiryDiscountUnit: DiscountUnit;
    expiryDiscountValue: number;

    productScopes: ProductScope[];
    categoryIds: string[];
    minimumPurchase: number;

    startDate: string;
    endDate: string;
    daysOfWeek: number[];
    hourStart: string;
    hourEnd: string;

    usageLimit: number;
    usageLimitEnabled: boolean;
  };

  const blankForm: FormState = {
    name: '',
    description: '',
    notes: '',
    kind: 'discount',
    level: 'line',
    status: 'active',

    discountUnit: 'percent',
    discountValue: 10,

    comboItems: [],
    comboPrice: 0,

    buyQuantity: 2,
    getQuantity: 1,
    bogoProductId: '',
    bogoVariantId: '',
    buyUnitKey: '',
    getUnitKey: '',

    memberPricelistId: '',
    memberPercentOff: 5,

    daysToExpiryThreshold: 3,
    expiryDiscountUnit: 'percent',
    expiryDiscountValue: 50,

    productScopes: [],
    categoryIds: [],
    minimumPurchase: 0,

    startDate: '',
    endDate: '',
    daysOfWeek: [],
    hourStart: '',
    hourEnd: '',

    usageLimit: 100,
    usageLimitEnabled: false
  };

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Record<string, string>>({});

  $effect(() => {
    if (editing) {
      form = {
        name: editing.name,
        description: editing.description,
        notes: editing.notes,
        kind: editing.kind,
        level: editing.level,
        status: editing.status,
        discountUnit: editing.discountUnit ?? 'percent',
        discountValue: editing.discountValue ?? 10,
        comboItems: editing.comboItems ? [...editing.comboItems] : [],
        comboPrice: editing.comboPrice ?? 0,
        buyQuantity: editing.buyQuantity ?? 2,
        getQuantity: editing.getQuantity ?? 1,
        bogoProductId: editing.bogoProductId ?? '',
        bogoVariantId: editing.bogoVariantId ?? '',
        buyUnitKey: editing.buyUnitId
          ? `${editing.buyUnitId}|${editing.buyUnitFactor ?? 1}`
          : '',
        getUnitKey: editing.getUnitId
          ? `${editing.getUnitId}|${editing.getUnitFactor ?? 1}`
          : '',
        memberPricelistId: editing.memberPricelistId ?? '',
        memberPercentOff: editing.memberPercentOff ?? 5,
        daysToExpiryThreshold: editing.daysToExpiryThreshold ?? 3,
        expiryDiscountUnit: editing.expiryDiscountUnit ?? 'percent',
        expiryDiscountValue: editing.expiryDiscountValue ?? 50,
        productScopes: editing.productScopes
          ? editing.productScopes.map((s) => ({ ...s }))
          : [],
        categoryIds: editing.categoryIds ? [...editing.categoryIds] : [],
        minimumPurchase: editing.minimumPurchase ?? 0,
        startDate: editing.startDate ?? '',
        endDate: editing.endDate ?? '',
        daysOfWeek: editing.daysOfWeek ? [...editing.daysOfWeek] : [],
        hourStart: editing.hourStart ?? '',
        hourEnd: editing.hourEnd ?? '',
        usageLimit: editing.usageLimit ?? 100,
        usageLimitEnabled: editing.usageLimit !== undefined
      };
      errors = {};
    }
  });

  // Auto-set level based on kind
  $effect(() => {
    if (form.kind === 'member-tier') {
      form.level = 'order';
    } else if (form.kind === 'combo' || form.kind === 'bogo' || form.kind === 'expiring-batch') {
      form.level = 'line';
    }
  });

  const kindOptions = [
    { value: 'discount', label: promoKindLabels.discount },
    { value: 'combo', label: promoKindLabels.combo },
    { value: 'bogo', label: promoKindLabels.bogo },
    { value: 'member-tier', label: promoKindLabels['member-tier'] },
    { value: 'expiring-batch', label: promoKindLabels['expiring-batch'] }
  ];

  const levelOptions = [
    { value: 'line', label: promoLevelLabels.line },
    { value: 'order', label: promoLevelLabels.order }
  ];

  const statusOptions = [
    { value: 'active', label: promoStatusLabels.active },
    { value: 'scheduled', label: promoStatusLabels.scheduled },
    { value: 'archived', label: promoStatusLabels.archived }
  ];

  const discountUnitOptions = [
    { value: 'percent', label: 'Persentase (%)' },
    { value: 'fixed', label: 'Rupiah tetap' }
  ];

  const productOptions = $derived([
    { value: '', label: '— Pilih produk —' },
    ...products.items
      .filter((p) => p.status === 'active')
      .map((p) => ({ value: p.id, label: p.name }))
  ]);

  const pricelistOptions = $derived([
    { value: '', label: '— Pilih daftar harga —' },
    ...pricelists.items.map((pl) => ({ value: pl.id, label: pl.name }))
  ]);

  const dayLabels = [
    { value: 1, label: 'Sen' },
    { value: 2, label: 'Sel' },
    { value: 3, label: 'Rab' },
    { value: 4, label: 'Kam' },
    { value: 5, label: 'Jum' },
    { value: 6, label: 'Sab' },
    { value: 0, label: 'Min' }
  ];

  function toggleDay(d: number) {
    if (form.daysOfWeek.includes(d)) {
      form.daysOfWeek = form.daysOfWeek.filter((x) => x !== d);
    } else {
      form.daysOfWeek = [...form.daysOfWeek, d];
    }
  }

  function scopeIndexFor(pid: string): number {
    return form.productScopes.findIndex((s) => s.productId === pid);
  }

  function isProductScoped(pid: string): boolean {
    return scopeIndexFor(pid) >= 0;
  }

  function scopeFor(pid: string): ProductScope | undefined {
    const idx = scopeIndexFor(pid);
    return idx >= 0 ? form.productScopes[idx] : undefined;
  }

  function toggleProductScope(pid: string) {
    const idx = scopeIndexFor(pid);
    if (idx >= 0) {
      form.productScopes = form.productScopes.filter((_, i) => i !== idx);
    } else {
      form.productScopes = [...form.productScopes, { productId: pid }];
    }
  }

  function updateScopeVariant(pid: string, variantId: string) {
    const idx = scopeIndexFor(pid);
    if (idx < 0) return;
    form.productScopes[idx] = {
      ...form.productScopes[idx],
      variantId: variantId || undefined
    };
  }

  function updateScopeUnit(pid: string, unitKey: string) {
    const idx = scopeIndexFor(pid);
    if (idx < 0) return;
    const parsed = parseUnitKey(unitKey);
    form.productScopes[idx] = {
      ...form.productScopes[idx],
      unitId: parsed.unitId,
      unitFactor: parsed.factor
    };
  }

  function scopeUnitKeyFor(pid: string): string {
    const s = scopeFor(pid);
    if (!s?.unitId) return '';
    return `${s.unitId}|${s.unitFactor ?? 1}`;
  }

  function toggleCategory(cid: string) {
    if (form.categoryIds.includes(cid)) {
      form.categoryIds = form.categoryIds.filter((x) => x !== cid);
    } else {
      form.categoryIds = [...form.categoryIds, cid];
    }
  }

  function addComboItem() {
    form.comboItems = [...form.comboItems, { productId: '', quantity: 1 }];
  }

  function removeComboItem(idx: number) {
    form.comboItems = form.comboItems.filter((_, i) => i !== idx);
  }

  function setComboItemUnit(idx: number, key: string) {
    const parsed = parseUnitKey(key);
    const item = form.comboItems[idx];
    form.comboItems[idx] = {
      ...item,
      unitId: parsed.unitId,
      unitFactor: parsed.factor
    };
  }

  function setComboItemVariant(idx: number, variantId: string) {
    const item = form.comboItems[idx];
    form.comboItems[idx] = {
      ...item,
      variantId: variantId || undefined
    };
  }

  function comboItemUnitKey(item: ComboItem): string {
    if (!item.unitId) return '';
    return `${item.unitId}|${item.unitFactor ?? 1}`;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';

    if (form.kind === 'discount') {
      if (form.discountValue <= 0) next.discountValue = 'Nilai diskon harus lebih dari 0.';
      if (form.discountUnit === 'percent' && form.discountValue > 100)
        next.discountValue = 'Persentase tidak boleh lebih dari 100.';
    }
    if (form.kind === 'combo') {
      if (form.comboItems.length < 2) next.comboItems = 'Combo butuh minimal 2 item.';
      else if (form.comboItems.some((c) => !c.productId || c.quantity <= 0))
        next.comboItems = 'Setiap item combo harus punya produk dan jumlah > 0.';
      if (form.comboPrice <= 0) next.comboPrice = 'Harga combo harus lebih dari 0.';
    }
    if (form.kind === 'bogo') {
      if (form.buyQuantity <= 0) next.buyQuantity = 'Jumlah beli harus > 0.';
      if (form.getQuantity <= 0) next.getQuantity = 'Jumlah gratis harus > 0.';
    }
    if (form.kind === 'member-tier') {
      if (!form.memberPricelistId) next.memberPricelistId = 'Pilih daftar harga member.';
      if (form.memberPercentOff <= 0 || form.memberPercentOff > 100)
        next.memberPercentOff = 'Persentase harus antara 1 dan 100.';
    }
    if (form.kind === 'expiring-batch') {
      if (form.daysToExpiryThreshold <= 0)
        next.daysToExpiryThreshold = 'Ambang hari harus > 0.';
      if (form.expiryDiscountValue <= 0)
        next.expiryDiscountValue = 'Nilai diskon harus > 0.';
      if (form.expiryDiscountUnit === 'percent' && form.expiryDiscountValue > 100)
        next.expiryDiscountValue = 'Persentase tidak boleh lebih dari 100.';
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate)
      next.endDate = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';

    if (form.usageLimitEnabled && form.usageLimit <= 0)
      next.usageLimit = 'Batas penggunaan harus > 0.';

    errors = next;
    return Object.keys(next).length === 0;
  }

  function buildPayload() {
    const payload: Omit<Promotion, 'id' | 'code' | 'usageCount'> = {
      name: form.name.trim(),
      description: form.description,
      notes: form.notes,
      kind: form.kind,
      level: form.level,
      status: form.status,
      productScopes: form.productScopes.length ? form.productScopes : undefined,
      categoryIds: form.categoryIds.length ? form.categoryIds : undefined,
      minimumPurchase: form.minimumPurchase > 0 ? form.minimumPurchase : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      daysOfWeek: form.daysOfWeek.length ? form.daysOfWeek : undefined,
      hourStart: form.hourStart || undefined,
      hourEnd: form.hourEnd || undefined,
      usageLimit: form.usageLimitEnabled ? form.usageLimit : undefined
    };
    if (form.kind === 'discount') {
      payload.discountUnit = form.discountUnit;
      payload.discountValue = form.discountValue;
    }
    if (form.kind === 'combo') {
      payload.comboItems = form.comboItems;
      payload.comboPrice = form.comboPrice;
    }
    if (form.kind === 'bogo') {
      payload.buyQuantity = form.buyQuantity;
      payload.getQuantity = form.getQuantity;
      payload.bogoProductId = form.bogoProductId || undefined;
      payload.bogoVariantId = form.bogoVariantId || undefined;
      const buy = parseUnitKey(form.buyUnitKey);
      const get = parseUnitKey(form.getUnitKey);
      payload.buyUnitId = buy.unitId;
      payload.buyUnitFactor = buy.factor;
      payload.getUnitId = get.unitId;
      payload.getUnitFactor = get.factor;
    }
    if (form.kind === 'member-tier') {
      payload.memberPricelistId = form.memberPricelistId;
      payload.memberPercentOff = form.memberPercentOff;
    } else {
      // Optional "khusus pelanggan" filter on any other kind.
      payload.memberPricelistId = form.memberPricelistId || undefined;
    }
    if (form.kind === 'expiring-batch') {
      payload.daysToExpiryThreshold = form.daysToExpiryThreshold;
      payload.expiryDiscountUnit = form.expiryDiscountUnit;
      payload.expiryDiscountValue = form.expiryDiscountValue;
    }
    return payload;
  }

  function save() {
    if (!validate()) return;
    const payload = buildPayload();
    if (isNew) {
      const created = promotions.add(payload);
      toast.success('Promo dibuat', created.name);
    } else if (editing) {
      promotions.update(editing.id, payload);
      toast.success('Promo diperbarui', form.name);
    }
    goto('/promotions');
  }
</script>

<svelte:head>
  <title>{isNew ? 'Tambah promo' : editing?.name ?? 'Promo'} · POS Admin</title>
</svelte:head>

{#if !isNew && !editing}
  <Card class="text-center">
    <h2 class="text-lg font-semibold text-slate-900">Promo tidak ditemukan</h2>
    <Button class="mt-4" variant="outline" onclick={() => goto('/promotions')}>
      <ArrowLeft class="h-4 w-4" />
      Kembali
    </Button>
  </Card>
{:else}
  <PageHeader
    title={isNew ? 'Tambah promo' : `Ubah promo · ${editing?.code}`}
    description={isNew ? 'Buat promo baru.' : `Mengubah ${editing?.name}.`}
    breadcrumb={[
      { label: 'Penjualan' },
      { label: 'Diskon & Promo', href: '/promotions' },
      { label: isNew ? 'Tambah' : editing?.code ?? '' }
    ]}
  >
    {#snippet actions()}
      <Button variant="outline" href="/promotions">
        <ArrowLeft class="h-4 w-4" />
        Batal
      </Button>
      {#if !isNew && editing}
        <Button variant="outline" href="/promotions/{editing.id}/label">
          <Printer class="h-4 w-4" />
          Cetak label
        </Button>
      {/if}
      <Button onclick={save}>
        <Save class="h-4 w-4" />
        Simpan
      </Button>
    {/snippet}
  </PageHeader>

  <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
    <div class="space-y-4">
      <Card>
        <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Informasi dasar
        </h2>
        <div class="grid gap-4">
          <Input
            label="Nama promo"
            placeholder="mis. Diskon 10% Minuman"
            bind:value={form.name}
            error={errors.name}
          />
          <Textarea
            label="Deskripsi (ditampilkan di kasir)"
            placeholder="mis. Diskon 10% untuk semua minuman."
            bind:value={form.description}
          />
        </div>
      </Card>

      <Card>
        <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Tipe & nilai
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <Select label="Tipe promo" bind:value={form.kind} options={kindOptions} />
          <Select
            label="Tingkat"
            bind:value={form.level}
            options={levelOptions}
            hint={form.kind === 'member-tier'
              ? 'Otomatis per-transaksi.'
              : form.kind === 'combo' || form.kind === 'bogo'
              ? 'Otomatis per-baris.'
              : 'Per-baris: diskon per produk. Per-transaksi: diskon total.'}
          />
        </div>

        {#if form.kind === 'discount'}
          <div class="mt-4 rounded-lg border border-slate-200 p-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <Select label="Unit diskon" bind:value={form.discountUnit} options={discountUnitOptions} />
              {#if form.discountUnit === 'percent'}
                <Input
                  label="Persentase"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  bind:value={form.discountValue}
                  error={errors.discountValue}
                >
                  {#snippet trailing()}<Percent class="h-4 w-4" />{/snippet}
                </Input>
              {:else}
                <MoneyInput label="Nilai diskon" bind:value={form.discountValue} />
              {/if}
            </div>
          </div>
        {:else if form.kind === 'combo'}
          <div class="mt-4 rounded-lg border border-slate-200 p-3">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium text-slate-700">Item dalam combo</span>
              <Button size="sm" variant="outline" onclick={addComboItem}>
                <Plus class="h-3.5 w-3.5" />
                Tambah item
              </Button>
            </div>
            {#if errors.comboItems}
              <Alert variant="error" class="mb-2">{errors.comboItems}</Alert>
            {/if}
            <div class="space-y-3">
              {#each form.comboItems as item, idx}
                {@const prod = products.getById(item.productId)}
                {@const hasVariants = !!(prod && prod.variants.length > 0)}
                {@const hasPackaging = !!(prod && prod.units.length > 0)}
                <div class="rounded-md border border-slate-200 bg-slate-50/40 p-2">
                  <div class="grid gap-2 sm:grid-cols-[1fr_100px_28px]">
                    <Select bind:value={item.productId} options={productOptions} />
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Jumlah"
                      bind:value={item.quantity}
                    />
                    <button
                      type="button"
                      class="flex items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Hapus item"
                      onclick={() => removeComboItem(idx)}
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                  {#if hasVariants || hasPackaging}
                    <div class="mt-2 grid gap-2 sm:grid-cols-2">
                      {#if hasVariants}
                        <Select
                          value={item.variantId ?? ''}
                          options={variantOptionsFor(item.productId)}
                          onchange={(e) =>
                            setComboItemVariant(
                              idx,
                              (e.currentTarget as HTMLSelectElement).value
                            )}
                        />
                      {/if}
                      {#if hasPackaging}
                        <Select
                          value={comboItemUnitKey(item)}
                          options={unitOptionsFor(item.productId)}
                          onchange={(e) =>
                            setComboItemUnit(
                              idx,
                              (e.currentTarget as HTMLSelectElement).value
                            )}
                        />
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
              {#if form.comboItems.length === 0}
                <p class="rounded-md border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-500">
                  Belum ada item. Tambah minimal 2 item untuk membuat combo.
                </p>
              {/if}
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <MoneyInput
                label="Harga combo"
                bind:value={form.comboPrice}
                error={errors.comboPrice}
                hint="Harga jual paket setelah digabung."
              />
            </div>
          </div>
        {:else if form.kind === 'bogo'}
          <div class="mt-4 rounded-lg border border-slate-200 p-3 space-y-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <Select
                label="Produk"
                bind:value={form.bogoProductId}
                options={[{ value: '', label: 'Semua produk (atur di bawah)' }, ...productOptions.slice(1)]}
                hint="Pilih produk spesifik, atau biarkan kosong dan batasi via produk / kategori di bawah."
              />
              {#if form.bogoProductId}
                {@const bogoProd = products.getById(form.bogoProductId)}
                {#if bogoProd && bogoProd.variants.length > 0}
                  <Select
                    label="Varian (opsional)"
                    bind:value={form.bogoVariantId}
                    options={variantOptionsFor(form.bogoProductId)}
                    hint="Kosongkan untuk semua varian."
                  />
                {/if}
              {/if}
            </div>

            <div class="rounded-md border border-slate-100 bg-slate-50/40 p-2">
              <div class="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Beli
              </div>
              <div class="grid gap-2 sm:grid-cols-2">
                <Input
                  label="Jumlah"
                  type="number"
                  min="1"
                  step="1"
                  bind:value={form.buyQuantity}
                  error={errors.buyQuantity}
                />
                {#if form.bogoProductId}
                  <Select
                    label="Unit beli"
                    bind:value={form.buyUnitKey}
                    options={unitOptionsFor(form.bogoProductId)}
                  />
                {/if}
              </div>
            </div>

            <div class="rounded-md border border-slate-100 bg-slate-50/40 p-2">
              <div class="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Gratis
              </div>
              <div class="grid gap-2 sm:grid-cols-2">
                <Input
                  label="Jumlah"
                  type="number"
                  min="1"
                  step="1"
                  bind:value={form.getQuantity}
                  error={errors.getQuantity}
                />
                {#if form.bogoProductId}
                  <Select
                    label="Unit gratis"
                    bind:value={form.getUnitKey}
                    options={unitOptionsFor(form.bogoProductId)}
                  />
                {/if}
              </div>
            </div>

            {#if form.bogoProductId}
              <p class="text-xs text-slate-500">
                Contoh: beli 1 box → gratis 1 pcs. Sistem akan menghitung bundle berdasarkan unit
                pada masing-masing sisi.
              </p>
            {/if}
          </div>
        {:else if form.kind === 'member-tier'}
          <div class="mt-4 rounded-lg border border-slate-200 p-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <Select
                label="Daftar harga member"
                bind:value={form.memberPricelistId}
                options={pricelistOptions}
                error={errors.memberPricelistId}
                hint="Pelanggan dengan daftar harga ini otomatis dapat diskon."
              />
              <Input
                label="Persentase diskon"
                type="number"
                min="0"
                max="100"
                step="1"
                bind:value={form.memberPercentOff}
                error={errors.memberPercentOff}
              >
                {#snippet trailing()}<Percent class="h-4 w-4" />{/snippet}
              </Input>
            </div>
          </div>
        {:else if form.kind === 'expiring-batch'}
          <div class="mt-4 rounded-lg border border-slate-200 p-3 space-y-3">
            <div class="grid gap-3 sm:grid-cols-3">
              <Input
                label="Ambang hari sebelum expired"
                type="number"
                min="1"
                step="1"
                bind:value={form.daysToExpiryThreshold}
                error={errors.daysToExpiryThreshold}
                hint="Batch dengan expiry ≤ N hari dari sekarang akan dianggap mau expired."
              />
              <Select
                label="Unit diskon"
                bind:value={form.expiryDiscountUnit}
                options={discountUnitOptions}
              />
              {#if form.expiryDiscountUnit === 'percent'}
                <Input
                  label="Persentase"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  bind:value={form.expiryDiscountValue}
                  error={errors.expiryDiscountValue}
                >
                  {#snippet trailing()}<Percent class="h-4 w-4" />{/snippet}
                </Input>
              {:else}
                <MoneyInput
                  label="Diskon per unit"
                  bind:value={form.expiryDiscountValue}
                  error={errors.expiryDiscountValue}
                />
              {/if}
            </div>
            <div class="rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
              Diskon otomatis berlaku untuk unit yang berasal dari batch mau expired (FIFO + expiry-first sudah mengarahkan ke batch tersebut lebih dulu). Atur produk/kategori di bawah; jika kosong berlaku untuk semua.
            </div>
          </div>
        {/if}
      </Card>

      {#if form.kind === 'discount' || form.kind === 'bogo' || form.kind === 'expiring-batch'}
        <Card>
          <h2 class="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Untuk produk / kategori (opsional)
          </h2>

          {@const totalScoped = form.productScopes.length + form.categoryIds.length}
          {#if totalScoped === 0}
            <div class="mb-3 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <strong>Saat ini:</strong> berlaku untuk <strong>semua produk</strong>.
              Pilih produk atau kategori di bawah untuk membatasi.
            </div>
          {:else}
            <div class="mb-3 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-800">
              <strong>Saat ini:</strong> berlaku untuk
              {#if form.productScopes.length > 0}
                <strong>{form.productScopes.length} produk</strong>
              {/if}
              {#if form.productScopes.length > 0 && form.categoryIds.length > 0}
                <span class="text-slate-500"> atau </span>
              {/if}
              {#if form.categoryIds.length > 0}
                <strong>{form.categoryIds.length} kategori</strong>
              {/if}.
              {#if form.productScopes.length > 0 && form.categoryIds.length > 0}
                Produk yang masuk salah satu daftar akan terkena promo.
              {/if}
            </div>
          {/if}

          <p class="mb-3 text-xs text-slate-500">
            Centang produk untuk membatasi promo. Tiap produk bisa dibatasi lebih lanjut ke varian
            atau unit (mis. hanya saat dibeli per box).
          </p>

          <div class="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <div class="text-sm font-medium text-slate-700">
                  Produk spesifik
                  {#if form.productScopes.length > 0}
                    <span class="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                      {form.productScopes.length}
                    </span>
                  {/if}
                </div>
                {#if form.productScopes.length > 0}
                  <button
                    type="button"
                    class="text-[11px] text-slate-500 hover:text-slate-800"
                    onclick={() => (form.productScopes = [])}
                  >
                    Kosongkan
                  </button>
                {/if}
              </div>
              <div class="max-h-72 overflow-y-auto rounded-md border border-slate-200">
                {#if form.kind === 'expiring-batch' && scopeProductList.length === 0}
                  <div class="px-3 py-3 text-center text-xs text-amber-700">
                    Tidak ada produk dengan batch ber-tanggal kedaluwarsa. Terima PO dengan
                    tanggal expired untuk mengaktifkan produk di sini, atau pakai filter Kategori.
                  </div>
                {/if}
                {#each scopeProductList as p (p.id)}
                  {@const checked = isProductScoped(p.id)}
                  {@const hasVariants = p.variants.length > 0}
                  {@const hasPackaging = p.units.length > 0}
                  <div class="border-b border-slate-100 last:border-b-0 {checked ? 'bg-brand-50/40' : ''}">
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                      onclick={() => toggleProductScope(p.id)}
                    >
                      <input
                        type="checkbox"
                        class="rounded border-slate-300"
                        {checked}
                        readonly
                      />
                      <span class="flex-1 truncate">{p.name}</span>
                      {#if checked}
                        {@const s = scopeFor(p.id)}
                        {#if s?.unitId || s?.variantId}
                          <span class="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                            dibatasi
                          </span>
                        {/if}
                      {/if}
                    </button>
                    {#if checked && (hasVariants || hasPackaging)}
                      <div class="grid gap-2 px-3 pb-2 sm:grid-cols-2">
                        {#if hasVariants}
                          <Select
                            value={scopeFor(p.id)?.variantId ?? ''}
                            options={variantOptionsFor(p.id)}
                            onchange={(e) =>
                              updateScopeVariant(
                                p.id,
                                (e.currentTarget as HTMLSelectElement).value
                              )}
                          />
                        {/if}
                        {#if hasPackaging}
                          <Select
                            value={scopeUnitKeyFor(p.id)}
                            options={unitOptionsFor(p.id)}
                            onchange={(e) =>
                              updateScopeUnit(
                                p.id,
                                (e.currentTarget as HTMLSelectElement).value
                              )}
                          />
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

            <div class="hidden self-center sm:flex sm:flex-col sm:items-center">
              <span class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">atau</span>
            </div>

            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <div class="text-sm font-medium text-slate-700">
                  Kategori
                  {#if form.categoryIds.length > 0}
                    <span class="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                      {form.categoryIds.length}
                    </span>
                  {/if}
                </div>
                {#if form.categoryIds.length > 0}
                  <button
                    type="button"
                    class="text-[11px] text-slate-500 hover:text-slate-800"
                    onclick={() => (form.categoryIds = [])}
                  >
                    Kosongkan
                  </button>
                {/if}
              </div>
              <div class="max-h-72 overflow-y-auto rounded-md border border-slate-200">
                {#if form.kind === 'expiring-batch' && scopeCategoryList.length === 0}
                  <div class="px-3 py-3 text-center text-xs text-amber-700">
                    Tidak ada kategori dengan produk ber-batch expired.
                  </div>
                {/if}
                {#each scopeCategoryList as c (c.id)}
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-left text-sm last:border-b-0 hover:bg-slate-50 {form.categoryIds.includes(c.id)
                      ? 'bg-brand-50/50'
                      : ''}"
                    onclick={() => toggleCategory(c.id)}
                  >
                    <input
                      type="checkbox"
                      class="rounded border-slate-300"
                      checked={form.categoryIds.includes(c.id)}
                      readonly
                    />
                    <span class="flex-1 truncate">{c.name}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>

          {#if form.level === 'order'}
            <div class="mt-4">
              <MoneyInput
                label="Minimum belanja (Rp)"
                bind:value={form.minimumPurchase}
                hint="Kosongkan untuk tidak ada minimum."
              />
            </div>
          {/if}
        </Card>
      {/if}
    </div>

    <div class="space-y-4">
      <Card>
        <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Status
        </h2>
        <Select label="Status promo" bind:value={form.status} options={statusOptions} />
        {#if editing}
          <div class="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Dipakai: <span class="font-medium">{editing.usageCount} kali</span>
          </div>
        {/if}
      </Card>

      {#if form.kind !== 'member-tier'}
        <Card>
          <h2 class="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
            <Users class="h-3.5 w-3.5" />
            Khusus pelanggan (opsional)
          </h2>
          <p class="mb-3 text-xs text-slate-500">
            Batasi promo hanya untuk pelanggan dengan daftar harga tertentu. Kosongkan agar berlaku untuk semua pelanggan.
          </p>
          <Select
            bind:value={form.memberPricelistId}
            options={[{ value: '', label: 'Semua pelanggan' }, ...pricelistOptions.slice(1)]}
          />
          {#if form.memberPricelistId}
            <div class="mt-3 rounded-md border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-800">
              <strong>Khusus member.</strong> Promo hanya muncul di kasir saat pelanggan dipilih dan daftar harga-nya cocok.
            </div>
          {/if}
        </Card>
      {/if}

      <Card>
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          <Calendar class="h-3.5 w-3.5" />
          Periode
        </h2>
        <div class="space-y-3">
          <Input label="Mulai" type="date" bind:value={form.startDate} />
          <Input label="Selesai" type="date" bind:value={form.endDate} error={errors.endDate} />
          <div>
            <div class="mb-1.5 text-sm font-medium text-slate-700">Hari berlaku</div>
            <p class="mb-2 text-xs text-slate-500">Kosongkan untuk semua hari.</p>
            <div class="flex flex-wrap gap-1.5">
              {#each dayLabels as d}
                <button
                  type="button"
                  class="rounded-md border px-2.5 py-1 text-xs font-medium transition {form.daysOfWeek.includes(
                    d.value
                  )
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
                  onclick={() => toggleDay(d.value)}
                >
                  {d.label}
                </button>
              {/each}
            </div>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <Input label="Jam mulai" type="time" bind:value={form.hourStart} />
            <Input label="Jam selesai" type="time" bind:value={form.hourEnd} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          <Tag class="h-3.5 w-3.5" />
          Batas penggunaan
        </h2>
        <Checkbox
          bind:checked={form.usageLimitEnabled}
          label="Batasi total pemakaian"
          description="Promo otomatis berakhir setelah batas tercapai."
        />
        {#if form.usageLimitEnabled}
          <div class="mt-3">
            <Input
              type="number"
              min="1"
              step="1"
              bind:value={form.usageLimit}
              error={errors.usageLimit}
            />
          </div>
        {/if}
      </Card>
    </div>
  </div>
{/if}
