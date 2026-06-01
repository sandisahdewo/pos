<script lang="ts">
  import {
    History as HistoryIcon,
    Search,
    Calendar,
    Users,
    Package,
    TrendingUp,
    TrendingDown
  } from 'lucide-svelte';
  import { page } from '$app/state';
  import {
    Badge,
    Card,
    Input,
    PageHeader,
    Select,
    StatCard,
    Table
  } from '$lib/components/ui';
  import {
    priceChanges,
    priceChangeSourceLabels,
    priceChangeSourceVariant,
    describePricing,
    type PriceChange,
    type PriceChangeSource
  } from '$lib/stores/priceChanges.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  // ─── Filters ────────────────────────────────────────────────────────────
  let search = $state('');
  let categoryFilter = $state('');
  let pricelistFilter = $state('');
  let sourceFilter = $state<'' | PriceChangeSource>('');
  let periodDays = $state<number>(30);
  // Optional pre-filter via query string (from product edit page deep link).
  const productIdFromQuery = $derived(page.url.searchParams.get('productId') ?? '');

  const sinceISO = $derived.by(() => {
    if (periodDays <= 0) return '';
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    return d.toISOString();
  });

  const categoryOptions = $derived([
    { value: '', label: 'Semua kategori' },
    ...categories.items.map((c) => ({ value: c.id, label: c.name }))
  ]);

  const pricelistOptions = $derived([
    { value: '', label: 'Semua daftar harga' },
    ...pricelists.items.map((pl) => ({ value: pl.id, label: pl.name }))
  ]);

  const sourceOptions = [
    { value: '', label: 'Semua sumber' },
    { value: 'manual', label: priceChangeSourceLabels.manual },
    { value: 'bulk-adjust', label: priceChangeSourceLabels['bulk-adjust'] },
    { value: 'system', label: priceChangeSourceLabels.system }
  ];

  const periodOptions = [
    { value: 7, label: '7 hari terakhir' },
    { value: 30, label: '30 hari terakhir' },
    { value: 90, label: '90 hari terakhir' },
    { value: 365, label: '1 tahun terakhir' },
    { value: 0, label: 'Semua waktu' }
  ];

  // ─── Stat cards ─────────────────────────────────────────────────────────
  const todayISO = $derived.by(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  });
  const last7DaysISO = $derived.by(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  });
  const last30DaysISO = $derived.by(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  });

  const count7d = $derived(priceChanges.countSince(last7DaysISO));
  const count30d = $derived(priceChanges.countSince(last30DaysISO));
  const productsAffected7d = $derived(priceChanges.productsAffectedSince(last7DaysISO));
  const topPerformer = $derived(priceChanges.topPerformerSince(last30DaysISO));

  // ─── Filtered rows ──────────────────────────────────────────────────────
  const allRows = $derived(priceChanges.recent(2000));

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (productIdFromQuery && r.productId !== productIdFromQuery) return false;
      if (sinceISO && r.at < sinceISO) return false;
      if (sourceFilter && r.source !== sourceFilter) return false;
      if (pricelistFilter && r.pricelistId !== pricelistFilter) return false;
      if (categoryFilter) {
        const p = products.getById(r.productId);
        if (!p || p.categoryId !== categoryFilter) return false;
      }
      if (q) {
        const sku = products.getById(r.productId)?.sku.toLowerCase() ?? '';
        return (
          r.productName.toLowerCase().includes(q) ||
          sku.includes(q) ||
          r.code.toLowerCase().includes(q) ||
          (r.notes ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  });

  function scopeLabel(r: PriceChange): string {
    if (r.variantName) return `Varian ${r.variantName}`;
    if (r.packagingLabel) return `Kemasan ${r.packagingLabel}`;
    return 'Produk dasar';
  }

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

  const columns = [
    { key: 'when' as const, label: 'Waktu', width: '160px' },
    { key: 'product' as const, label: 'Produk · cakupan' },
    { key: 'pricelist' as const, label: 'Daftar harga', width: '130px' },
    { key: 'strategy' as const, label: 'Strategi', width: '180px' },
    { key: 'price' as const, label: 'Harga jual', align: 'right' as const, width: '170px' },
    { key: 'source' as const, label: 'Sumber', width: '120px' }
  ];

  const productDetail = $derived(
    productIdFromQuery ? products.getById(productIdFromQuery) : undefined
  );
</script>

<svelte:head>
  <title>Riwayat Harga · POS Admin</title>
</svelte:head>

<PageHeader
  title="Riwayat Harga"
  description={productDetail
    ? `Filter ke ${productDetail.name}. Klik 'X' di sebelah filter produk untuk lihat semua.`
    : 'Catatan setiap perubahan harga jual — siapa, kapan, dari apa ke apa.'}
  breadcrumb={[{ label: 'Wawasan' }, { label: 'Riwayat Harga' }]}
/>

<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard
    label="Perubahan 7 hari"
    value={count7d.toString()}
    icon={HistoryIcon}
    accent="brand"
  />
  <StatCard
    label="Perubahan 30 hari"
    value={count30d.toString()}
    icon={Calendar}
    accent="sky"
  />
  <StatCard
    label="Produk berubah 7 hari"
    value={productsAffected7d.toString()}
    icon={Package}
    accent="emerald"
  />
  <StatCard
    label="Operator aktif (30 hari)"
    value={topPerformer ? `${topPerformer.name.split(' ')[0]} · ${topPerformer.count}` : '—'}
    icon={Users}
    accent="amber"
  />
</div>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari nama, SKU, kode, catatan…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    {#if productIdFromQuery}
      <a
        href="/riwayat-harga"
        class="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
      >
        ✕ Hapus filter produk
      </a>
    {/if}
    <Select bind:value={categoryFilter} options={categoryOptions} class="w-40" />
    <Select bind:value={pricelistFilter} options={pricelistOptions} class="w-40" />
    <Select bind:value={sourceFilter} options={sourceOptions} class="w-36" />
    <Select
      value={String(periodDays)}
      onchange={(e) => (periodDays = Number((e.currentTarget as HTMLSelectElement).value))}
      options={periodOptions.map((o) => ({ value: String(o.value), label: o.label }))}
      class="w-40"
    />
  </div>

  <Table {columns} rows={filtered} rowKey={(r) => r.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'when'}
        <div class="text-xs text-slate-600">
          <div>{fmtDate(row.at)}</div>
          <div class="mt-0.5 font-mono text-[10px] text-slate-400">{row.code}</div>
        </div>
      {:else if column.key === 'product'}
        <div class="min-w-0">
          <a
            href="/products/{row.productId}/edit"
            class="truncate font-medium text-slate-900 hover:text-brand-700 hover:underline"
          >
            {row.productName}
          </a>
          <div class="mt-0.5 text-xs text-slate-500">
            {scopeLabel(row)}
            {#if row.tierMinQty !== undefined}
              <span class="text-slate-400">· tingkat ≥ {row.tierMinQty}</span>
            {/if}
          </div>
        </div>
      {:else if column.key === 'pricelist'}
        <span class="text-sm text-slate-700">{row.pricelistName}</span>
      {:else if column.key === 'strategy'}
        <div class="text-xs text-slate-600">
          <div class="flex items-center gap-1.5">
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
              {describePricing(row.oldStrategy)}
            </span>
            <span class="text-slate-400">→</span>
            <span class="rounded-md bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand-800">
              {describePricing(row.newStrategy)}
            </span>
          </div>
          {#if row.oldStrategy.kind !== row.newStrategy.kind}
            <div class="mt-0.5 text-[10px] text-amber-700">
              Tipe diubah ({row.oldStrategy.kind} → {row.newStrategy.kind})
            </div>
          {/if}
        </div>
      {:else if column.key === 'price'}
        {@const delta = row.newSale - row.oldSale}
        <div class="text-right text-xs">
          <div class="flex items-baseline justify-end gap-1.5">
            <span class="font-mono text-slate-500">{formatRupiah(row.oldSale)}</span>
            <span class="text-slate-400">→</span>
            <span class="font-mono font-semibold text-slate-900">{formatRupiah(row.newSale)}</span>
          </div>
          <div class="mt-0.5 inline-flex items-center gap-0.5 {delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-400'}">
            {#if delta > 0}<TrendingUp class="h-3 w-3" />{:else if delta < 0}<TrendingDown class="h-3 w-3" />{/if}
            {delta > 0 ? '+' : ''}{formatRupiah(delta)}
          </div>
        </div>
      {:else if column.key === 'source'}
        <div class="space-y-1">
          <Badge variant={priceChangeSourceVariant[row.source]} size="sm">
            {priceChangeSourceLabels[row.source]}
          </Badge>
          <div class="text-[10px] text-slate-500">by {row.performedBy}</div>
          {#if row.notes}
            <div class="line-clamp-2 text-[10px] text-slate-500 italic" title={row.notes}>
              {row.notes}
            </div>
          {/if}
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-2 py-10 text-center">
        <HistoryIcon class="h-8 w-8 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Belum ada perubahan harga tercatat</p>
        <p class="max-w-md text-xs text-slate-400">
          Setiap kali kamu menyimpan perubahan harga jual (manual atau lewat Sesuaikan harga),
          baris baru muncul di sini dengan strategi lama & baru, harga jual lama & baru, dan
          siapa yang mengubah.
        </p>
      </div>
    {/snippet}
  </Table>

  <div class="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
    <strong>Catatan:</strong> Hanya perubahan pada <em>strategi harga</em> yang dicatat di sini.
    Perubahan biaya beli (<code class="font-mono">product.cost</code>) belum di-log; produk dengan
    sumber biaya non-manual juga punya harga yang bergeser otomatis saat batch jalan — pergeseran
    itu juga belum di-snapshot di sini.
  </div>
</Card>
