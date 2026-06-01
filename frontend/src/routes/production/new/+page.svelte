<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    ArrowLeft,
    Factory,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    Boxes,
    Info
  } from 'lucide-svelte';
  import {
    Alert,
    Badge,
    Button,
    Card,
    Input,
    PageHeader,
    Select,
    Textarea
  } from '$lib/components/ui';
  import {
    productionRuns,
    planConsumption,
    type ConsumptionPlan
  } from '$lib/stores/productionRuns.svelte';
  import {
    products,
    productionModeOf,
    recipeOf,
    type Product
  } from '$lib/stores/products.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const compositeProducts = $derived(
    products.items.filter((p) => p.kind === 'composite' && p.status === 'active')
  );

  // Form state — `productId` may be pre-filled from a deep link.
  let productId = $state(page.url.searchParams.get('productId') ?? '');
  let variantId = $state(page.url.searchParams.get('variantId') ?? '');
  let intendedQty = $state<number>(1);
  let producedQty = $state<number>(1);
  let locationId = $state('');
  let expiresAt = $state('');
  let notes = $state('');
  let submitting = $state(false);
  let submitError = $state('');

  // When intended qty changes, sync producedQty if it's still the default
  // (i.e. user hasn't manually decoupled it). Detect "decoupled" by the user
  // having edited producedQty to something other than intendedQty.
  let producedQtyDecoupled = $state(false);
  $effect(() => {
    if (!producedQtyDecoupled) producedQty = intendedQty;
  });

  const product = $derived<Product | undefined>(
    productId ? products.getById(productId) : undefined
  );

  const hasVariants = $derived((product?.variants.length ?? 0) > 0);

  // Reset variant when product changes (unless it came in via deep link and
  // matches the new product).
  let lastProductId = $state('');
  $effect(() => {
    if (productId !== lastProductId) {
      lastProductId = productId;
      if (product && product.variants.length > 0) {
        const stillValid = product.variants.some((v) => v.id === variantId);
        if (!stillValid) variantId = product.variants[0]?.id ?? '';
      } else {
        variantId = '';
      }
    }
  });

  const productOptions = $derived([
    { value: '', label: '— Pilih produk komposit —' },
    ...compositeProducts.map((p) => ({ value: p.id, label: p.name }))
  ]);

  const variantOptions = $derived(
    product
      ? product.variants.map((v) => ({ value: v.id, label: v.name }))
      : []
  );

  const locationsOn = $derived(settings.value.inventory.locationsEnabled);
  const locationOptions = $derived(
    locations
      .sortedActive()
      .map((l) => ({ value: l.id, label: l.name }))
  );

  // Default location once on mount of the form.
  $effect(() => {
    if (!locationId) locationId = locations.defaultId();
  });

  const mode = $derived(product ? productionModeOf(product, variantId || undefined) : 'flexible');
  const recipe = $derived(product ? recipeOf(product, variantId || undefined) : []);
  const productUnitCode = $derived(
    product ? units.getById(product.unitId)?.code ?? '' : ''
  );

  // Live consumption plan — debounced via $derived (re-computes on any input).
  const plan = $derived<ConsumptionPlan>(
    product
      ? planConsumption(product.id, variantId || undefined, intendedQty || 0)
      : {
          ok: false,
          intendedQty: 0,
          requirements: [],
          totalCost: 0,
          bottleneckProducible: 0,
          blockReasons: []
        }
  );

  const expiresPreview = $derived.by(() => {
    if (expiresAt) return expiresAt;
    if (product?.shelfLifeAfterProductionHours) {
      const d = new Date();
      d.setHours(d.getHours() + product.shelfLifeAfterProductionHours);
      return d.toISOString().slice(0, 10);
    }
    return '';
  });

  function fmtDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function setProducedQty(v: number) {
    producedQtyDecoupled = v !== intendedQty;
    producedQty = v;
  }

  function submit() {
    submitError = '';
    if (!product) {
      submitError = 'Pilih produk yang akan diproduksi.';
      return;
    }
    if (hasVariants && !variantId) {
      submitError = 'Pilih varian yang akan diproduksi.';
      return;
    }
    if (intendedQty <= 0) {
      submitError = 'Jumlah produksi harus lebih dari 0.';
      return;
    }
    if (producedQty <= 0 || producedQty > intendedQty) {
      submitError = 'Jumlah yang dihasilkan harus antara 1 dan jumlah yang direncanakan.';
      return;
    }
    if (!plan.ok) {
      submitError = plan.blockReasons[0] ?? 'Stok bahan tidak cukup.';
      return;
    }
    submitting = true;
    const result = productionRuns.add({
      productId: product.id,
      variantId: variantId || undefined,
      intendedQty,
      producedQty,
      locationId: locationsOn ? locationId || undefined : undefined,
      expiresAt: expiresAt || undefined,
      notes: notes.trim()
    });
    submitting = false;
    if (!result.ok || !result.run) {
      submitError = result.reason ?? 'Gagal mencatat produksi.';
      return;
    }
    toast.success(
      'Produksi tercatat',
      `${result.run.code} · ${result.run.producedQty} ${productUnitCode} ${product.name}`
    );
    goto(`/production/${result.run.id}`);
  }
</script>

<svelte:head>
  <title>Buat produksi · POS Admin</title>
</svelte:head>

<PageHeader
  title="Buat produksi"
  description="Pilih produk komposit, atur jumlah, dan sistem akan memotong bahan baku FIFO + membuat batch hasilnya."
  breadcrumb={[
    { label: 'Inventaris' },
    { label: 'Produksi', href: '/production' },
    { label: 'Buat' }
  ]}
>
  {#snippet actions()}
    <Button variant="outline" href="/production">
      <ArrowLeft class="h-4 w-4" />
      Batal
    </Button>
    <Button onclick={submit} disabled={submitting || !plan.ok}>
      <Factory class="h-4 w-4" />
      Catat produksi
    </Button>
  {/snippet}
</PageHeader>

<div class="grid gap-4 lg:grid-cols-[1fr_320px]">
  <div class="space-y-4">
    <Card>
      <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Produk</h2>

      {#if compositeProducts.length === 0}
        <Alert variant="warning">
          Belum ada produk komposit aktif. Buat dulu produk komposit di
          <a href="/products" class="font-semibold underline">/products</a>.
        </Alert>
      {:else}
        <div class="grid gap-4 sm:grid-cols-2">
          <Select label="Produk komposit" bind:value={productId} options={productOptions} />
          {#if hasVariants}
            <Select label="Varian" bind:value={variantId} options={variantOptions} />
          {/if}
        </div>

        {#if product}
          <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span class="text-slate-400">Mode:</span>
            <Badge variant={mode === 'strict' ? 'warning' : 'info'} size="sm">
              {mode === 'strict' ? 'Hanya dari produksi' : 'Fleksibel'}
            </Badge>
            {#if mode === 'strict'}
              <span class="text-xs text-slate-500">
                — wajib produksi sebelum jual.
              </span>
            {:else}
              <span class="text-xs text-slate-500">
                — boleh dijual langsung tanpa produksi, tapi produksi terlebih dulu memberikan stok siap-jual.
              </span>
            {/if}
            {#if product.shelfLifeAfterProductionHours}
              <span class="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
                <Calendar class="h-3.5 w-3.5" />
                Masa simpan {product.shelfLifeAfterProductionHours} jam
              </span>
            {/if}
          </div>
        {/if}
      {/if}
    </Card>

    {#if product && recipe.length > 0}
      <Card padded={false}>
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Resep & ketersediaan
          </h2>
          <div class="text-xs">
            {#if plan.ok}
              <span class="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 class="h-3.5 w-3.5" />
                Cukup untuk {intendedQty} {productUnitCode} (kapasitas
                {plan.bottleneckProducible})
              </span>
            {:else}
              <span class="inline-flex items-center gap-1 text-rose-700">
                <AlertTriangle class="h-3.5 w-3.5" />
                Bahan tidak cukup
              </span>
            {/if}
          </div>
        </div>

        <ul class="divide-y divide-slate-100">
          {#each plan.requirements as req (req.productId + (req.variantId ?? ''))}
            <li class="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-medium text-slate-900">
                  {req.productName}{req.variantName ? ` · ${req.variantName}` : ''}
                </div>
                {#if req.blockReason}
                  <div class="mt-0.5 text-xs text-rose-700">{req.blockReason}</div>
                {:else if req.draws.length > 0}
                  <div class="mt-0.5 truncate text-[11px] text-slate-500">
                    {#each req.draws as d, i (d.batchId)}
                      {#if i > 0}, {/if}{d.take} dari <span class="font-mono">{d.batchCode}</span>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="text-right text-sm">
                <span class="font-medium text-slate-900">{req.requiredBase}</span>
                <span class="text-xs text-slate-400">{req.unitCode}</span>
              </div>
              <div class="text-right text-xs {req.sufficient ? 'text-slate-500' : 'text-rose-600'}">
                tersedia {req.availableBase}
              </div>
            </li>
          {/each}
        </ul>

        <div class="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
          <span class="text-slate-500">Total biaya bahan</span>
          <span class="font-semibold text-slate-900">{formatRupiah(plan.totalCost)}</span>
        </div>
      </Card>
    {:else if product && recipe.length === 0}
      <Alert variant="warning">
        Resep komposit kosong untuk pilihan ini. Atur komponen lewat halaman produk dulu.
      </Alert>
    {/if}

    <Card>
      <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Jumlah</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <Input
          label="Jumlah direncanakan"
          type="number"
          min="1"
          step="1"
          bind:value={intendedQty}
          hint="Dipakai untuk menghitung konsumsi bahan baku."
        />
        <Input
          label="Jumlah yang dihasilkan"
          type="number"
          min="1"
          step="1"
          value={producedQty}
          onchange={(e) => setProducedQty(Number((e.currentTarget as HTMLInputElement).value))}
          hint="≤ jumlah direncanakan. Turunkan kalau ada yang gosong / cacat (rendemen)."
        />
      </div>
      {#if producedQty < intendedQty && intendedQty > 0}
        <div class="mt-3 flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Rendemen {Math.round((producedQty / intendedQty) * 100)}% — biaya per unit naik
            karena {intendedQty - producedQty} unit bahan tetap terhitung sebagai pemakaian.
          </span>
        </div>
      {/if}
    </Card>
  </div>

  <div class="space-y-4">
    <Card>
      <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Ringkasan</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between gap-2">
          <dt class="text-slate-500">Total biaya bahan</dt>
          <dd class="font-medium text-slate-900">{formatRupiah(plan.totalCost)}</dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-slate-500">Biaya / unit hasil</dt>
          <dd class="font-medium text-slate-900">
            {producedQty > 0 ? formatRupiah(plan.totalCost / producedQty) : '—'}
          </dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-slate-500">Batch hasil</dt>
          <dd class="font-medium text-slate-900">
            {producedQty} {productUnitCode}
          </dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-slate-500">Kedaluwarsa</dt>
          <dd class="font-medium text-slate-900">
            {expiresPreview ? fmtDate(expiresPreview) : 'Tidak diset'}
          </dd>
        </div>
      </dl>

      {#if submitError}
        <Alert variant="error" class="mt-3">{submitError}</Alert>
      {/if}
    </Card>

    <Card>
      <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Kedaluwarsa & lokasi
      </h2>
      <div class="space-y-3">
        <Input
          label="Kedaluwarsa"
          type="date"
          bind:value={expiresAt}
          hint={product?.shelfLifeAfterProductionHours
            ? `Default dari masa simpan ${product.shelfLifeAfterProductionHours} jam (otomatis di-prefill saat disimpan jika kosong).`
            : 'Kosongkan kalau tidak ada batas kedaluwarsa.'}
        />

        {#if locationsOn}
          <Select label="Lokasi" bind:value={locationId} options={locationOptions} />
        {/if}
      </div>
    </Card>

    <Card>
      <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        <Boxes class="h-3.5 w-3.5" />
        Catatan
      </h2>
      <Textarea
        bind:value={notes}
        placeholder="mis. Goreng pagi shift Sandi, minyak baru."
      />
    </Card>
  </div>
</div>
