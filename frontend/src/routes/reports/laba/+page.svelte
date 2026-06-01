<script lang="ts">
  import {
    Wallet,
    Coins,
    TrendingUp,
    TrendingDown,
    Package,
    Tag,
    Search
  } from 'lucide-svelte';
  import {
    Badge,
    Card,
    Input,
    PageHeader,
    Select,
    StatCard,
    Table,
    Tabs
  } from '$lib/components/ui';
  import {
    profitByProduct,
    profitByCategory,
    todayISO,
    isoDaysAgo,
    isoStartOfMonth,
    type SalesPeriod
  } from '$lib/utils/salesAnalytics';
  import { categories } from '$lib/stores/categories.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  // ─── Period ────────────────────────────────────────────────────────────
  type PresetKey = 'today' | '7d' | '30d' | 'month' | 'custom';
  let preset = $state<PresetKey>('30d');
  let customStart = $state<string>(isoDaysAgo(30));
  let customEnd = $state<string>(todayISO());

  const period = $derived.by<SalesPeriod>(() => {
    switch (preset) {
      case 'today':
        return { startISO: todayISO(), endISO: todayISO() };
      case '7d':
        return { startISO: isoDaysAgo(6), endISO: todayISO() };
      case '30d':
        return { startISO: isoDaysAgo(29), endISO: todayISO() };
      case 'month':
        return { startISO: isoStartOfMonth(), endISO: todayISO() };
      case 'custom':
        return { startISO: customStart, endISO: customEnd };
    }
  });

  const presetTabs = [
    { value: 'today', label: 'Hari ini' },
    { value: '7d', label: '7 hari' },
    { value: '30d', label: '30 hari' },
    { value: 'month', label: 'Bulan ini' },
    { value: 'custom', label: 'Custom' }
  ];

  // ─── Data ──────────────────────────────────────────────────────────────
  const productRows = $derived(profitByProduct(period));
  const categoryRows = $derived(profitByCategory(period));

  // ─── Top-line totals (across all products in period) ───────────────────
  const totals = $derived.by(() => {
    let revenue = 0;
    let cogs = 0;
    let qtyBase = 0;
    for (const r of productRows) {
      revenue += r.revenue;
      cogs += r.cogs;
      qtyBase += r.qtyBase;
    }
    const profit = revenue - cogs;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, cogs, profit, marginPct, qtyBase };
  });

  // ─── View / filter state ───────────────────────────────────────────────
  let view = $state<'product' | 'category'>('product');
  let search = $state('');
  let categoryFilter = $state('');
  let sortBy = $state<'profit' | 'margin' | 'revenue' | 'qty'>('profit');

  const viewTabs = $derived([
    { value: 'product', label: 'Per Produk', badge: productRows.length.toString() },
    { value: 'category', label: 'Per Kategori', badge: categoryRows.length.toString() }
  ]);

  const categoryOptions = $derived([
    { value: '', label: 'Semua kategori' },
    ...categories.items.map((c) => ({ value: c.id, label: c.name }))
  ]);

  const sortOptions = [
    { value: 'profit', label: 'Profit terbesar' },
    { value: 'margin', label: 'Margin tertinggi' },
    { value: 'revenue', label: 'Revenue terbesar' },
    { value: 'qty', label: 'Unit terjual terbanyak' }
  ];

  const filteredProducts = $derived.by(() => {
    const q = search.trim().toLowerCase();
    const list = productRows.filter((r) => {
      if (categoryFilter && r.categoryId !== categoryFilter) return false;
      if (q) {
        return (
          r.productName.toLowerCase().includes(q) ||
          r.categoryName.toLowerCase().includes(q)
        );
      }
      return true;
    });
    const sorted = [...list];
    switch (sortBy) {
      case 'margin':
        sorted.sort((a, b) => b.marginPct - a.marginPct);
        break;
      case 'revenue':
        sorted.sort((a, b) => b.revenue - a.revenue);
        break;
      case 'qty':
        sorted.sort((a, b) => b.qtyBase - a.qtyBase);
        break;
      case 'profit':
      default:
        sorted.sort((a, b) => b.profit - a.profit);
        break;
    }
    return sorted;
  });

  const filteredCategories = $derived.by(() => {
    const q = search.trim().toLowerCase();
    const list = categoryRows.filter((r) => {
      if (categoryFilter && r.categoryId !== categoryFilter) return false;
      if (q) return r.categoryName.toLowerCase().includes(q);
      return true;
    });
    const sorted = [...list];
    switch (sortBy) {
      case 'margin':
        sorted.sort((a, b) => b.marginPct - a.marginPct);
        break;
      case 'revenue':
        sorted.sort((a, b) => b.revenue - a.revenue);
        break;
      case 'qty':
        sorted.sort((a, b) => b.qtyBase - a.qtyBase);
        break;
      case 'profit':
      default:
        sorted.sort((a, b) => b.profit - a.profit);
        break;
    }
    return sorted;
  });

  function fmtDay(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  function marginBandClass(pct: number): string {
    if (pct <= 0) return 'bg-rose-100 text-rose-800';
    if (pct < 10) return 'bg-rose-50 text-rose-700';
    if (pct < 30) return 'bg-amber-50 text-amber-800';
    return 'bg-emerald-50 text-emerald-800';
  }

  const productColumns = [
    { key: 'product' as const, label: 'Produk · kategori' },
    { key: 'qty' as const, label: 'Qty', align: 'right' as const, width: '130px' },
    { key: 'avg' as const, label: 'Avg / unit', align: 'right' as const, width: '170px' },
    { key: 'revenue' as const, label: 'Revenue', align: 'right' as const, width: '140px' },
    { key: 'cogs' as const, label: 'COGS', align: 'right' as const, width: '140px' },
    { key: 'profit' as const, label: 'Profit', align: 'right' as const, width: '160px' },
    { key: 'margin' as const, label: 'Margin', align: 'right' as const, width: '110px' }
  ];

  const categoryColumns = [
    { key: 'category' as const, label: 'Kategori' },
    { key: 'qty' as const, label: 'Qty', align: 'right' as const, width: '130px' },
    { key: 'revenue' as const, label: 'Revenue', align: 'right' as const, width: '160px' },
    { key: 'cogs' as const, label: 'COGS', align: 'right' as const, width: '160px' },
    { key: 'profit' as const, label: 'Profit', align: 'right' as const, width: '180px' },
    { key: 'margin' as const, label: 'Margin', align: 'right' as const, width: '110px' }
  ];
</script>

<svelte:head>
  <title>Laporan Laba · POS Admin</title>
</svelte:head>

<PageHeader
  title="Laporan Laba"
  description="Profit per produk dan per kategori — COGS dihitung dari batch FIFO yang sebenarnya dikonsumsi. Jadi saat harga PO bergerak, laba otomatis mencerminkan biaya aktual tanpa edit field cost manual."
  breadcrumb={[{ label: 'Wawasan' }, { label: 'Laporan', href: '/reports' }, { label: 'Laba' }]}
/>

<Card padded={false} class="mb-4">
  <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-slate-500">Periode:</span>
      {#each presetTabs as t (t.value)}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium {preset === t.value
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-600 hover:bg-slate-100'}"
          onclick={() => (preset = t.value as PresetKey)}
        >
          {t.label}
        </button>
      {/each}
    </div>
    {#if preset === 'custom'}
      <div class="flex items-center gap-2">
        <Input type="date" bind:value={customStart} class="w-40" />
        <span class="text-xs text-slate-400">s/d</span>
        <Input type="date" bind:value={customEnd} class="w-40" />
      </div>
    {:else}
      <div class="text-xs text-slate-500">
        {fmtDay(period.startISO)} — {fmtDay(period.endISO)}
      </div>
    {/if}
  </div>
</Card>

<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard label="Revenue" value={formatRupiah(totals.revenue)} icon={Wallet} accent="brand" />
  <StatCard label="COGS aktual" value={formatRupiah(totals.cogs)} icon={Coins} accent="sky" />
  <StatCard
    label="Profit"
    value={formatRupiah(totals.profit)}
    icon={totals.profit >= 0 ? TrendingUp : TrendingDown}
    accent={totals.profit >= 0 ? 'emerald' : 'rose'}
  />
  <StatCard
    label="Margin total"
    value={`${totals.marginPct.toFixed(1)}%`}
    icon={TrendingUp}
    accent={totals.marginPct >= 30 ? 'emerald' : totals.marginPct >= 10 ? 'amber' : 'rose'}
  />
</div>

<div class="mb-3">
  <Tabs tabs={viewTabs} bind:value={view} />
</div>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder={view === 'product' ? 'Cari produk / kategori…' : 'Cari kategori…'} bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    {#if view === 'product'}
      <Select bind:value={categoryFilter} options={categoryOptions} class="w-44" />
    {/if}
    <Select bind:value={sortBy} options={sortOptions} class="w-44" />
  </div>

  {#if view === 'product'}
    <Table columns={productColumns} rows={filteredProducts} rowKey={(r) => r.productId}>
      {#snippet cell({ row, column })}
        {#if column.key === 'product'}
          <div class="min-w-0">
            <a
              href="/products/{row.productId}/edit"
              class="truncate font-medium text-slate-900 hover:text-brand-700 hover:underline"
            >
              {row.productName}
            </a>
            <div class="mt-0.5 text-xs text-slate-500">{row.categoryName}</div>
          </div>
        {:else if column.key === 'qty'}
          <div class="text-right text-sm">
            <span class="font-medium text-slate-900">{row.qtyBase}</span>
            <span class="text-xs text-slate-400">{row.unitCode}</span>
            <div class="text-[11px] text-slate-500">{row.orderLineCount} baris</div>
          </div>
        {:else if column.key === 'avg'}
          <div class="text-right text-xs text-slate-600">
            <div>jual {formatRupiah(row.unitsRevenue)}</div>
            <div class="text-slate-500">biaya {formatRupiah(row.unitsCogs)}</div>
            <div class="font-medium {row.unitsProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
              untung {formatRupiah(row.unitsProfit)}
            </div>
          </div>
        {:else if column.key === 'revenue'}
          <span class="text-right text-sm font-medium text-slate-900">
            {formatRupiah(row.revenue)}
          </span>
        {:else if column.key === 'cogs'}
          <span class="text-right text-sm text-slate-700">
            {formatRupiah(row.cogs)}
          </span>
        {:else if column.key === 'profit'}
          <span class="text-right text-sm font-semibold {row.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
            {row.profit >= 0 ? '+' : ''}{formatRupiah(row.profit)}
          </span>
        {:else if column.key === 'margin'}
          <div class="text-right">
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold {marginBandClass(row.marginPct)}">
              {row.marginPct.toFixed(1)}%
            </span>
          </div>
        {/if}
      {/snippet}

      {#snippet empty()}
        <div class="flex flex-col items-center gap-2 py-10 text-center">
          <Package class="h-8 w-8 text-slate-300" />
          <p class="text-sm font-medium text-slate-600">Belum ada penjualan di periode ini</p>
          <p class="max-w-md text-xs text-slate-400">
            Profit dihitung dari order yang status=paid atau credit dalam rentang yang dipilih.
            Coba ganti periode atau hapus filter.
          </p>
        </div>
      {/snippet}
    </Table>
  {:else}
    <Table columns={categoryColumns} rows={filteredCategories} rowKey={(r) => r.categoryId || 'unknown'}>
      {#snippet cell({ row, column })}
        {#if column.key === 'category'}
          <div class="min-w-0">
            <div class="font-medium text-slate-900">{row.categoryName}</div>
            <div class="mt-0.5 text-xs text-slate-500">{row.productCount} produk</div>
          </div>
        {:else if column.key === 'qty'}
          <span class="text-right text-sm font-medium text-slate-900">{row.qtyBase}</span>
        {:else if column.key === 'revenue'}
          <span class="text-right text-sm font-medium text-slate-900">
            {formatRupiah(row.revenue)}
          </span>
        {:else if column.key === 'cogs'}
          <span class="text-right text-sm text-slate-700">{formatRupiah(row.cogs)}</span>
        {:else if column.key === 'profit'}
          <span class="text-right text-sm font-semibold {row.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
            {row.profit >= 0 ? '+' : ''}{formatRupiah(row.profit)}
          </span>
        {:else if column.key === 'margin'}
          <div class="text-right">
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold {marginBandClass(row.marginPct)}">
              {row.marginPct.toFixed(1)}%
            </span>
          </div>
        {/if}
      {/snippet}

      {#snippet empty()}
        <div class="flex flex-col items-center gap-2 py-10 text-center">
          <Tag class="h-8 w-8 text-slate-300" />
          <p class="text-sm font-medium text-slate-600">Belum ada penjualan di kategori manapun</p>
        </div>
      {/snippet}
    </Table>
  {/if}

  <div class="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
    <strong>COGS aktual:</strong> dihitung dari snapshot biaya per-batch yang sebenarnya
    dikonsumsi saat penjualan (FIFO). Jadi pergeseran harga supplier otomatis tercermin
    di laba — operator tidak perlu update <code class="font-mono">product.cost</code> manual.
  </div>
</Card>
