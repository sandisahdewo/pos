<script lang="ts">
  import {
    ArrowLeft,
    AlertCircle,
    History as HistoryIcon,
    Search,
    Package
  } from 'lucide-svelte';
  import { page } from '$app/state';
  import {
    Badge,
    Button,
    Card,
    Input,
    Modal,
    PageHeader,
    Select
  } from '$lib/components/ui';
  import MovementTimeline from '$lib/components/inventory/MovementTimeline.svelte';
  import {
    stockMovements,
    movementKindLabels,
    movementKindOptions,
    adjustmentReasonLabels,
    type StockAdjustmentReason,
    type StockMovement,
    type StockMovementKind
  } from '$lib/stores/stockMovements.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { stockByLocation, stockOf } from '$lib/stores/batches.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const productId = $derived(page.params.productId ?? '');
  const product = $derived(products.getById(productId));
  const auditOn = $derived(settings.value.inventory.auditTrailEnabled);
  const locationsOn = $derived(settings.value.inventory.locationsEnabled);
  const sortedLocations = $derived(locations.sortedActive());

  let variantFilter = $state<string>('');
  let kindFilter = $state<'' | StockMovementKind>('');
  let locationFilter = $state('');
  let reasonFilter = $state<'' | StockAdjustmentReason>('');
  let startDate = $state('');
  let endDate = $state('');
  let search = $state('');

  // Image preview
  let imageOpen = $state(false);
  let imageSrc = $state('');
  let imageCaption = $state('');

  const variantOptions = $derived.by(() => {
    if (!product) return [{ value: '', label: 'Semua varian' }];
    if (product.variants.length === 0) return [];
    return [
      { value: '', label: 'Semua varian' },
      ...product.variants.map((v) => ({ value: v.id, label: v.name }))
    ];
  });

  const kindOptions = [
    { value: '', label: 'Semua jenis' },
    ...movementKindOptions
  ];

  const locationOptions = $derived([
    { value: '', label: 'Semua lokasi' },
    ...sortedLocations.map((l) => ({ value: l.id, label: l.name }))
  ]);

  const reasonOptions = [
    { value: '', label: 'Semua alasan' },
    ...(Object.keys(adjustmentReasonLabels) as StockAdjustmentReason[]).map((r) => ({
      value: r,
      label: adjustmentReasonLabels[r]
    }))
  ];

  const allMovements = $derived(
    stockMovements.forProduct(productId, variantFilter || undefined)
  );

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return allMovements.filter((m) => {
      if (kindFilter && m.kind !== kindFilter) return false;
      if (locationFilter && m.locationId !== locationFilter) return false;
      if (reasonFilter && m.reason !== reasonFilter) return false;
      if (startDate && m.at.slice(0, 10) < startDate) return false;
      if (endDate && m.at.slice(0, 10) > endDate) return false;
      if (!q) return true;
      const reasonLabel = m.reason ? adjustmentReasonLabels[m.reason] : '';
      const hay = [m.code, m.notes, m.performedBy, m.reference?.code ?? '', reasonLabel]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  // Stats over the filtered window
  type Stats = {
    received: number;
    sold: number;
    adjustedIn: number;
    adjustedOut: number;
    movedIn: number;
    movedOut: number;
    shrinkageValue: number; // sum of |delta| × unitCost for adjust-out + lost reasons
  };

  const stats = $derived.by<Stats>(() => {
    let received = 0;
    let sold = 0;
    let adjustedIn = 0;
    let adjustedOut = 0;
    let movedIn = 0;
    let movedOut = 0;
    let shrinkageValue = 0;
    for (const m of filtered) {
      switch (m.kind) {
        case 'receive':
          received += m.qtyDelta;
          break;
        case 'sale':
          sold += -m.qtyDelta;
          break;
        case 'sale-cancel':
          sold -= m.qtyDelta;
          break;
        case 'adjust-in':
          adjustedIn += m.qtyDelta;
          break;
        case 'adjust-out':
          adjustedOut += -m.qtyDelta;
          shrinkageValue += -m.qtyDelta * m.unitCost;
          break;
        case 'move-in':
          movedIn += m.qtyDelta;
          break;
        case 'move-out':
          movedOut += -m.qtyDelta;
          break;
      }
    }
    return { received, sold, adjustedIn, adjustedOut, movedIn, movedOut, shrinkageValue };
  });

  const currentStock = $derived(
    product ? stockOf(productId, variantFilter || undefined) : 0
  );

  const baseUnitCode = $derived(product ? units.getById(product.unitId)?.code ?? '' : '');

  const locationBreakdown = $derived.by(() => {
    if (!product) return [];
    const map = stockByLocation(productId, variantFilter || undefined);
    const out: { name: string; qty: number; customerVisible: boolean }[] = [];
    for (const loc of sortedLocations) {
      const qty = map.get(loc.id) ?? 0;
      if (qty <= 0) continue;
      out.push({ name: loc.name, qty, customerVisible: loc.customerVisible });
    }
    return out;
  });

  function openImage(m: StockMovement) {
    if (!m.imageUrl) return;
    imageSrc = m.imageUrl;
    const reasonLabel = m.reason ? adjustmentReasonLabels[m.reason] : '';
    imageCaption = `${m.code}${reasonLabel ? ` · ${reasonLabel}` : ''}`;
    imageOpen = true;
  }

  function variantName(id?: string): string {
    if (!product || !id) return '';
    return product.variants.find((v) => v.id === id)?.name ?? '';
  }
</script>

<svelte:head>
  <title>{product ? `Riwayat · ${product.name}` : 'Riwayat'} · POS Admin</title>
</svelte:head>

<PageHeader
  title={product ? `Riwayat: ${product.name}` : 'Produk tidak ditemukan'}
  description={product
    ? `Pergerakan stok dari penerimaan, penjualan, opname, dan pemindahan. ${product.sku}.`
    : 'Periksa kembali ID produk yang dibuka.'}
  breadcrumb={[
    { label: 'Katalog' },
    { label: 'Inventaris', href: '/inventory' },
    { label: product?.name ?? '—' },
    { label: 'Riwayat' }
  ]}
>
  {#snippet actions()}
    <Button variant="outline" href="/inventory">
      <ArrowLeft class="h-4 w-4" />
      Kembali
    </Button>
  {/snippet}
</PageHeader>

{#if !product}
  <Card>
    <div class="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle class="h-10 w-10 text-amber-500" />
      <p class="text-base font-semibold text-slate-900">Produk tidak ditemukan</p>
      <p class="max-w-md text-sm text-slate-600">
        Kembali ke <a href="/inventory" class="font-medium text-brand-700 hover:underline">Inventaris</a>.
      </p>
    </div>
  </Card>
{:else if !auditOn}
  <Card>
    <div class="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle class="h-10 w-10 text-amber-500" />
      <p class="text-base font-semibold text-slate-900">Riwayat stok belum diaktifkan</p>
      <p class="max-w-md text-sm text-slate-600">
        Aktifkan toggle "Riwayat &amp; opname stok" di
        <a href="/settings" class="font-medium text-brand-700 hover:underline">Pengaturan</a>.
      </p>
    </div>
  </Card>
{:else}
  <!-- Stat strip -->
  <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
      <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Stok saat ini</p>
      <p class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {currentStock}
        {#if baseUnitCode}<span class="ml-0.5 text-xs font-normal text-slate-400">{baseUnitCode}</span>{/if}
      </p>
      {#if locationsOn && locationBreakdown.length > 0}
        <div class="mt-2 flex flex-wrap gap-x-2 text-[10px] text-slate-500">
          {#each locationBreakdown as e (e.name)}
            <span class={e.customerVisible ? 'text-emerald-700' : ''}>
              {e.name}: <span class="font-medium">{e.qty}</span>
            </span>
          {/each}
        </div>
      {/if}
    </div>
    <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
      <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Diterima</p>
      <p class="mt-2 text-2xl font-semibold tracking-tight text-emerald-700">
        +{stats.received}
        {#if baseUnitCode}<span class="ml-0.5 text-xs font-normal text-slate-400">{baseUnitCode}</span>{/if}
      </p>
      <p class="mt-1 text-xs text-slate-500">Dari Order Pembelian</p>
    </div>
    <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
      <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Terjual</p>
      <p class="mt-2 text-2xl font-semibold tracking-tight text-slate-700">
        −{stats.sold}
        {#if baseUnitCode}<span class="ml-0.5 text-xs font-normal text-slate-400">{baseUnitCode}</span>{/if}
      </p>
      <p class="mt-1 text-xs text-slate-500">Bersih (terjual − pembatalan)</p>
    </div>
    <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
      <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Penyesuaian</p>
      <p class="mt-2 text-2xl font-semibold tracking-tight">
        <span class="text-emerald-700">+{stats.adjustedIn}</span>
        <span class="mx-1 text-slate-400">/</span>
        <span class="text-rose-700">−{stats.adjustedOut}</span>
      </p>
      <p class="mt-1 text-xs text-slate-500">
        {#if stats.shrinkageValue > 0}
          Nilai shrinkage: <span class="font-medium text-rose-700">{formatRupiah(stats.shrinkageValue)}</span>
        {:else}
          Tidak ada shrinkage
        {/if}
      </p>
    </div>
    <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
      <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Pemindahan</p>
      <p class="mt-2 text-2xl font-semibold tracking-tight text-sky-700">
        ↑ {stats.movedIn} / ↓ {stats.movedOut}
      </p>
      <p class="mt-1 text-xs text-slate-500">Masuk vs keluar antar lokasi</p>
    </div>
  </div>

  <!-- Filters -->
  <Card padded={false} class="mb-4">
    <div class="flex flex-wrap items-center gap-2 p-3">
      <div class="min-w-[200px] flex-1">
        <Input placeholder="Cari kode, ref, alasan, catatan…" bind:value={search}>
          {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
        </Input>
      </div>
      {#if variantOptions.length > 0}
        <Select bind:value={variantFilter} options={variantOptions} class="w-44" />
      {/if}
      <Select bind:value={kindFilter} options={kindOptions} class="w-40" />
      {#if locationsOn}
        <Select bind:value={locationFilter} options={locationOptions} class="w-40" />
      {/if}
      <Select bind:value={reasonFilter} options={reasonOptions} class="w-40" />
      <Input type="date" bind:value={startDate} class="w-40" />
      <Input type="date" bind:value={endDate} class="w-40" />
    </div>
  </Card>

  <!-- Timeline -->
  <Card>
    <div class="mb-4 flex items-center gap-2">
      <HistoryIcon class="h-4 w-4 text-slate-400" />
      <h2 class="text-sm font-semibold text-slate-900">
        Lini masa pergerakan
        {#if variantFilter}
          <span class="font-normal text-slate-500">· varian {variantName(variantFilter)}</span>
        {/if}
      </h2>
      <span class="ml-auto text-xs text-slate-500">
        Menampilkan <span class="font-medium text-slate-700">{filtered.length}</span> dari
        <span class="font-medium text-slate-700">{allMovements.length}</span> catatan
      </span>
    </div>

    <MovementTimeline
      movements={filtered}
      emptyTitle="Belum ada pergerakan dalam periode ini"
      emptyHint="Sesuaikan filter atau hapus rentang tanggal untuk lihat lebih banyak."
      onImageClick={openImage}
    />
  </Card>
{/if}

<Modal bind:open={imageOpen} size="lg" title="Foto bukti" description={imageCaption}>
  {#if imageSrc}
    <div class="flex items-center justify-center">
      <img src={imageSrc} alt="Foto bukti" class="max-h-[70vh] rounded-md" />
    </div>
  {/if}
  {#snippet footer()}
    <Button variant="outline" onclick={() => (imageOpen = false)}>Tutup</Button>
  {/snippet}
</Modal>
