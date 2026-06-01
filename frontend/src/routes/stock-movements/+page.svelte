<script lang="ts">
  import {
    Search,
    History,
    ArrowDown,
    ArrowUp,
    ExternalLink,
    AlertCircle,
    Camera
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    Input,
    Modal,
    PageHeader,
    Select,
    Table
  } from '$lib/components/ui';
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
  import { locations, type Location } from '$lib/stores/locations.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let search = $state('');
  let productFilter = $state('');
  let locationFilter = $state('');
  let kindFilter = $state<'' | StockMovementKind>('');
  let reasonFilter = $state<'' | StockAdjustmentReason>('');
  let startDate = $state('');
  let endDate = $state('');

  // Image preview modal
  let imageOpen = $state(false);
  let imageSrc = $state<string>('');
  let imageCaption = $state<string>('');

  const auditOn = $derived(settings.value.inventory.auditTrailEnabled);
  const locationsOn = $derived(settings.value.inventory.locationsEnabled);

  const productOptions = $derived([
    { value: '', label: 'Semua produk' },
    ...products.items
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ value: p.id, label: p.name }))
  ]);

  const locationOptions = $derived([
    { value: '', label: 'Semua lokasi' },
    ...locations
      .sortedActive()
      .map((l) => ({ value: l.id, label: l.name }))
  ]);

  const kindOptions = [
    { value: '', label: 'Semua jenis' },
    ...movementKindOptions
  ];

  const reasonOptions = [
    { value: '', label: 'Semua alasan' },
    ...(Object.keys(adjustmentReasonLabels) as StockAdjustmentReason[]).map((r) => ({
      value: r,
      label: adjustmentReasonLabels[r]
    }))
  ];

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return stockMovements.items
      .filter((m) => {
        if (productFilter && m.productId !== productFilter) return false;
        if (locationFilter && m.locationId !== locationFilter) return false;
        if (kindFilter && m.kind !== kindFilter) return false;
        if (reasonFilter && m.reason !== reasonFilter) return false;
        if (startDate && m.at.slice(0, 10) < startDate) return false;
        if (endDate && m.at.slice(0, 10) > endDate) return false;
        if (!q) return true;
        const product = products.getById(m.productId);
        const reasonLabel = m.reason ? adjustmentReasonLabels[m.reason] : '';
        const hay = [
          m.code,
          m.notes,
          m.performedBy,
          m.reference?.code ?? '',
          reasonLabel,
          product?.name ?? '',
          product?.sku ?? ''
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  });

  function openImage(m: StockMovement) {
    if (!m.imageUrl) return;
    imageSrc = m.imageUrl;
    const reasonLabel = m.reason ? adjustmentReasonLabels[m.reason] : '';
    imageCaption = `${m.code} · ${productNameFor(m)}${reasonLabel ? ` · ${reasonLabel}` : ''}`;
    imageOpen = true;
  }

  function productNameFor(m: StockMovement): string {
    const p = products.getById(m.productId);
    if (!p) return '(produk dihapus)';
    if (!m.variantId) return p.name;
    const v = p.variants.find((vv) => vv.id === m.variantId);
    return v ? `${p.name} — ${v.name}` : p.name;
  }

  function baseUnitCodeFor(m: StockMovement): string {
    const p = products.getById(m.productId);
    if (!p) return '';
    return units.getById(p.unitId)?.code ?? '';
  }

  function locationFor(m: StockMovement): Location | undefined {
    return locations.getById(m.locationId);
  }

  function locationBadgeVariant(loc: Location | undefined): 'success' | 'warning' | 'neutral' {
    if (!loc) return 'neutral';
    if (loc.kind === 'shelf') return 'success';
    if (loc.kind === 'rack') return 'warning';
    return 'neutral';
  }

  function kindBadgeVariant(
    kind: StockMovementKind
  ): 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' {
    switch (kind) {
      case 'receive':
        return 'success';
      case 'sale':
        return 'neutral';
      case 'sale-cancel':
        return 'warning';
      case 'adjust-in':
        return 'success';
      case 'adjust-out':
        return 'danger';
      case 'move-out':
        return 'info';
      case 'move-in':
        return 'info';
      case 'move-relocate':
        return 'info';
      case 'return-consignor':
        return 'brand';
      case 'production-in':
        return 'success';
      case 'production-out':
        return 'warning';
    }
  }

  function deltaClass(delta: number): string {
    if (delta > 0) return 'font-semibold text-emerald-700';
    if (delta < 0) return 'font-semibold text-rose-700';
    return 'text-slate-500';
  }

  function formatDelta(delta: number): string {
    if (delta > 0) return `+${delta}`;
    if (delta === 0) return '0';
    return String(delta);
  }

  function formatDateTime(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const date = new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(d);
      const time = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
      return `${date} ${time}`;
    } catch {
      return iso;
    }
  }

  function referenceHref(m: StockMovement): string | null {
    if (!m.reference) return null;
    switch (m.reference.kind) {
      case 'po':
        return `/purchase-orders/${m.reference.id}`;
      case 'order':
        return `/orders/${m.reference.id}`;
      case 'opname':
        return `/stock-opname/${m.reference.id}`;
      default:
        return null;
    }
  }

  const columns = $derived([
    { key: 'at' as const, label: 'Waktu', width: '160px' },
    { key: 'code' as const, label: 'Kode', width: '130px' },
    { key: 'kind' as const, label: 'Jenis', width: '140px' },
    { key: 'product' as const, label: 'Produk' },
    ...(locationsOn ? [{ key: 'location' as const, label: 'Lokasi', width: '130px' }] : []),
    { key: 'qtyDelta' as const, label: 'Δ', align: 'right' as const, width: '70px' },
    { key: 'qtyAfter' as const, label: 'Setelah', align: 'right' as const, width: '80px' },
    { key: 'unitCost' as const, label: 'Harga', align: 'right' as const, width: '110px' },
    { key: 'reference' as const, label: 'Ref', width: '140px' },
    { key: 'performedBy' as const, label: 'Oleh', width: '120px' },
    { key: 'notes' as const, label: 'Catatan' }
  ]);
</script>

<svelte:head>
  <title>Riwayat Stok · POS Admin</title>
</svelte:head>

<PageHeader
  title="Riwayat Stok"
  description="Catatan lengkap setiap pergerakan stok — penerimaan, penjualan, penyesuaian, pemindahan, opname."
  breadcrumb={[{ label: 'Wawasan' }, { label: 'Riwayat Stok' }]}
/>

{#if !auditOn}
  <Card>
    <div class="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle class="h-10 w-10 text-amber-500" />
      <p class="text-base font-semibold text-slate-900">Riwayat stok belum diaktifkan</p>
      <p class="max-w-md text-sm text-slate-600">
        Aktifkan toggle "Riwayat & opname stok" di
        <a href="/settings" class="font-medium text-brand-700 hover:underline">Pengaturan</a> agar setiap
        perubahan stok mulai tercatat di sini.
      </p>
    </div>
  </Card>
{:else}
  <Card padded={false}>
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
      <div class="min-w-[220px] flex-1">
        <Input placeholder="Cari kode, produk, catatan, ref…" bind:value={search}>
          {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
        </Input>
      </div>
      <Select bind:value={productFilter} options={productOptions} class="w-48" />
      {#if locationsOn}
        <Select bind:value={locationFilter} options={locationOptions} class="w-40" />
      {/if}
      <Select bind:value={kindFilter} options={kindOptions} class="w-40" />
      <Select bind:value={reasonFilter} options={reasonOptions} class="w-40" />
      <Input type="date" bind:value={startDate} class="w-40" placeholder="Dari" />
      <Input type="date" bind:value={endDate} class="w-40" placeholder="Sampai" />
    </div>

    <Table {columns} rows={filtered} rowKey={(m) => m.id}>
      {#snippet cell({ row, column })}
        {#if column.key === 'at'}
          <span class="text-xs text-slate-600">{formatDateTime(row.at)}</span>
        {:else if column.key === 'code'}
          <code class="font-mono text-xs font-medium text-slate-800">{row.code}</code>
        {:else if column.key === 'kind'}
          <Badge variant={kindBadgeVariant(row.kind)} size="sm">
            {#if row.qtyDelta > 0}
              <ArrowUp class="mr-0.5 h-3 w-3" />
            {:else if row.qtyDelta < 0}
              <ArrowDown class="mr-0.5 h-3 w-3" />
            {/if}
            {movementKindLabels[row.kind]}
          </Badge>
        {:else if column.key === 'product'}
          <span class="text-sm text-slate-800">{productNameFor(row)}</span>
        {:else if column.key === 'location'}
          {@const loc = locationFor(row)}
          {#if loc}
            <Badge variant={locationBadgeVariant(loc)} size="sm">{loc.name}</Badge>
          {:else}
            <span class="text-xs text-slate-400">—</span>
          {/if}
        {:else if column.key === 'qtyDelta'}
          {@const u = baseUnitCodeFor(row)}
          <span class={deltaClass(row.qtyDelta)}>
            {formatDelta(row.qtyDelta)}
            {#if u}<span class="ml-0.5 text-[10px] font-normal text-slate-400">{u}</span>{/if}
          </span>
        {:else if column.key === 'qtyAfter'}
          {@const u = baseUnitCodeFor(row)}
          <span class="text-sm text-slate-700">
            {row.qtyAfter}
            {#if u}<span class="ml-0.5 text-[10px] text-slate-400">{u}</span>{/if}
          </span>
        {:else if column.key === 'unitCost'}
          <span class="text-xs text-slate-600">{formatRupiah(row.unitCost)}</span>
        {:else if column.key === 'reference'}
          {#if row.reference}
            {@const href = referenceHref(row)}
            {#if href}
              <a
                {href}
                class="inline-flex items-center gap-1 font-mono text-xs text-brand-700 hover:underline"
              >
                <ExternalLink class="h-3 w-3" />
                {row.reference.code ?? row.reference.id.slice(0, 8)}
              </a>
            {:else}
              <span class="font-mono text-xs text-slate-500">
                {row.reference.code ?? row.reference.kind}
              </span>
            {/if}
          {:else}
            <span class="text-xs text-slate-400">—</span>
          {/if}
        {:else if column.key === 'performedBy'}
          <span class="text-xs text-slate-600">{row.performedBy}</span>
        {:else if column.key === 'notes'}
          <div class="flex max-w-xs items-start gap-2">
            {#if row.imageUrl}
              <button
                type="button"
                class="shrink-0 overflow-hidden rounded-md border border-slate-200 hover:border-brand-400 hover:shadow-soft"
                onclick={() => openImage(row)}
                aria-label="Lihat foto bukti"
                title="Lihat foto bukti"
              >
                <img
                  src={row.imageUrl}
                  alt="Foto bukti"
                  class="h-8 w-8 object-cover"
                />
              </button>
            {/if}
            <div class="min-w-0 flex-1">
              {#if row.reason}
                <Badge variant="neutral" size="sm">{adjustmentReasonLabels[row.reason]}</Badge>
              {/if}
              {#if row.notes}
                <p class="mt-0.5 line-clamp-1 text-xs text-slate-500">{row.notes}</p>
              {/if}
            </div>
          </div>
        {/if}
      {/snippet}

      {#snippet empty()}
        <div class="flex flex-col items-center gap-1.5 py-10">
          <History class="h-8 w-8 text-slate-300" />
          <p class="text-sm font-medium text-slate-600">Belum ada catatan pergerakan</p>
          <p class="max-w-sm text-xs text-slate-400">
            Lakukan transaksi atau penyesuaian stok untuk mulai mengisi ledger ini.
          </p>
        </div>
      {/snippet}
    </Table>
  </Card>

  <p class="mt-3 text-xs text-slate-500">
    Total: <span class="font-medium text-slate-700">{filtered.length}</span> dari
    <span class="font-medium text-slate-700">{stockMovements.items.length}</span> catatan
  </p>
{/if}

<Modal bind:open={imageOpen} size="lg" title="Foto bukti" description={imageCaption}>
  {#if imageSrc}
    <div class="flex items-center justify-center">
      <img src={imageSrc} alt="Foto bukti penyesuaian" class="max-h-[70vh] rounded-md" />
    </div>
  {/if}
  {#snippet footer()}
    <Button variant="outline" onclick={() => (imageOpen = false)}>Tutup</Button>
  {/snippet}
</Modal>
