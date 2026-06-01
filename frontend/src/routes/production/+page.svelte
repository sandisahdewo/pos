<script lang="ts">
  import {
    Factory,
    Plus,
    Search,
    Calendar,
    Boxes,
    Package
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    Input,
    PageHeader,
    Select,
    StatCard,
    Table
  } from '$lib/components/ui';
  import { productionRuns, type ProductionRun } from '$lib/stores/productionRuns.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let search = $state('');
  let productFilter = $state('');

  const compositeProducts = $derived(
    products.items.filter((p) => p.kind === 'composite')
  );

  const productOptions = $derived([
    { value: '', label: 'Semua produk' },
    ...compositeProducts.map((p) => ({ value: p.id, label: p.name }))
  ]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = $derived.by(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });

  const todayStats = $derived(productionRuns.totalProducedSince(todayISO));
  const weekStats = $derived(productionRuns.totalProducedSince(sevenDaysAgo));
  const distinctProducts = $derived(
    new Set(productionRuns.items.map((r) => r.productId)).size
  );
  const totalRuns = $derived(productionRuns.items.length);

  const sorted = $derived(productionRuns.recent(500));

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((r) => {
      if (productFilter && r.productId !== productFilter) return false;
      if (!q) return true;
      const p = products.getById(r.productId);
      const name = p?.name.toLowerCase() ?? '';
      const variant = p && r.variantId
        ? p.variants.find((v) => v.id === r.variantId)?.name.toLowerCase() ?? ''
        : '';
      return (
        r.code.toLowerCase().includes(q) ||
        name.includes(q) ||
        variant.includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    });
  });

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function productDisplayFor(r: ProductionRun): {
    name: string;
    variant?: string;
    unitCode: string;
  } {
    const p = products.getById(r.productId);
    if (!p) return { name: r.productId, unitCode: '' };
    const v = r.variantId ? p.variants.find((vv) => vv.id === r.variantId) : undefined;
    return {
      name: p.name,
      variant: v?.name,
      unitCode: units.getById(p.unitId)?.code ?? ''
    };
  }

  const columns = [
    { key: 'code' as const, label: 'Kode', width: '140px' },
    { key: 'product' as const, label: 'Produk · varian' },
    { key: 'qty' as const, label: 'Qty', align: 'right' as const, width: '130px' },
    { key: 'cost' as const, label: 'Biaya / unit', align: 'right' as const, width: '140px' },
    { key: 'location' as const, label: 'Lokasi', width: '160px' },
    { key: 'createdAt' as const, label: 'Waktu', width: '170px' }
  ];
</script>

<svelte:head>
  <title>Produksi · POS Admin</title>
</svelte:head>

<PageHeader
  title="Produksi"
  description="Catat produksi komposit (mis. ayam goreng, hampers) — konsumsi bahan baku FIFO, hasilkan batch yang siap dijual, jejak audit otomatis."
  breadcrumb={[{ label: 'Inventaris' }, { label: 'Produksi' }]}
>
  {#snippet actions()}
    <Button href="/production/new">
      <Plus class="h-4 w-4" />
      Buat produksi
    </Button>
  {/snippet}
</PageHeader>

<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard label="Hari ini" value={todayStats.runs.toString()} icon={Factory} accent="brand" />
  <StatCard
    label="Unit dihasilkan hari ini"
    value={todayStats.units.toString()}
    icon={Boxes}
    accent="emerald"
  />
  <StatCard
    label="Unit · 7 hari"
    value={weekStats.units.toString()}
    icon={Calendar}
    accent="sky"
  />
  <StatCard
    label="Produk diproduksi"
    value={distinctProducts.toString()}
    icon={Package}
    accent="amber"
  />
</div>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari kode, produk, catatan…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={productFilter} options={productOptions} class="w-56" />
  </div>

  <Table {columns} rows={filtered} rowKey={(r) => r.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'code'}
        <a href="/production/{row.id}" class="font-mono text-sm font-medium text-brand-700 hover:underline">
          {row.code}
        </a>
      {:else if column.key === 'product'}
        {@const d = productDisplayFor(row)}
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <a
              href="/production/{row.id}"
              class="truncate font-medium text-slate-900 hover:text-brand-700 hover:underline"
            >
              {d.name}
            </a>
            {#if d.variant}
              <Badge size="sm" variant="outline">{d.variant}</Badge>
            {/if}
          </div>
          {#if row.notes}
            <div class="truncate text-xs text-slate-500">{row.notes}</div>
          {/if}
        </div>
      {:else if column.key === 'qty'}
        {@const d = productDisplayFor(row)}
        <div class="text-right text-sm">
          <span class="font-medium text-slate-900">{row.producedQty}</span>
          <span class="text-xs text-slate-400">{d.unitCode}</span>
          {#if row.producedQty !== row.intendedQty}
            <div class="text-[11px] text-amber-700">
              dari {row.intendedQty} (rendemen {Math.round((row.producedQty / row.intendedQty) * 100)}%)
            </div>
          {/if}
        </div>
      {:else if column.key === 'cost'}
        <div class="text-right text-sm">
          <span class="font-medium text-slate-900">{formatRupiah(row.unitCost)}</span>
          <div class="text-[11px] text-slate-500">
            total {formatRupiah(row.unitCost * row.producedQty)}
          </div>
        </div>
      {:else if column.key === 'location'}
        <span class="text-xs text-slate-600">
          {locations.getById(row.locationId)?.name ?? '—'}
        </span>
      {:else if column.key === 'createdAt'}
        <span class="text-xs text-slate-600">{fmtDate(row.createdAt)}</span>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-2 py-10 text-center">
        <Factory class="h-8 w-8 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Belum ada produksi tercatat.</p>
        <p class="max-w-md text-xs text-slate-400">
          Klik <strong>Buat produksi</strong> untuk merakit komposit dari bahan baku. Stok bahan dipotong FIFO, batch hasilnya siap dijual seperti barang biasa.
        </p>
      </div>
    {/snippet}
  </Table>
</Card>
