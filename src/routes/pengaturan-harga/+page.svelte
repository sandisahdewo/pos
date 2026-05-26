<script lang="ts">
  import {
    AlertTriangle,
    Search,
    Coins,
    TrendingDown,
    Tag,
    Calculator,
    Pencil
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
    products,
    basePrice,
    priceRange,
    effectiveCost,
    type Product
  } from '$lib/stores/products.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { purchaseOrders } from '$lib/stores/purchaseOrders.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let view = $state<'margin'>('margin');

  // ─── Latest PO unit cost per product ───────────────────────────────────
  // We normalize PO line.unitPrice (in chosen packaging unit) to a base-unit
  // cost by dividing by unitFactor. Pick the latest PO by orderDate. POs are
  // walked once for the table; no per-row cost requested.
  type CostInfo = {
    base: number;
    poCode?: string;
    poDate?: string;
    isFallback: boolean; // true when no PO exists and we fell back to product.cost
  };

  function latestPOCost(productId: string): CostInfo {
    let best:
      | { unitCostBase: number; poCode: string; poDate: string }
      | undefined;
    for (const po of purchaseOrders.items) {
      for (const line of po.lines) {
        if (line.productId !== productId) continue;
        const factor = line.unitFactor || 1;
        const costBase = line.unitPrice / factor;
        if (!best || po.orderDate > best.poDate) {
          best = { unitCostBase: costBase, poCode: po.code, poDate: po.orderDate };
        }
      }
    }
    if (best) {
      return {
        base: best.unitCostBase,
        poCode: best.poCode,
        poDate: best.poDate,
        isFallback: false
      };
    }
    const p = products.getById(productId);
    return { base: p ? effectiveCost(p) : 0, isFallback: true };
  }

  // ─── Filters ───────────────────────────────────────────────────────────
  let search = $state('');
  let categoryFilter = $state('');
  let pricelistId = $state(pricelists.defaultId());
  let bandFilter = $state<'' | 'rugi' | 'waspada' | 'tipis' | 'aman'>('');
  let sortBy = $state<'margin' | 'gap' | 'name'>('margin');

  const categoryOptions = $derived([
    { value: '', label: 'Semua kategori' },
    ...categories.items.map((c) => ({ value: c.id, label: c.name }))
  ]);

  const pricelistOptions = $derived(
    pricelists.items.map((pl) => ({ value: pl.id, label: pl.name }))
  );

  const bandOptions = [
    { value: '', label: 'Semua margin' },
    { value: 'rugi', label: 'Rugi (≤ 0%)' },
    { value: 'waspada', label: 'Waspada (< 10%)' },
    { value: 'tipis', label: 'Tipis (10–30%)' },
    { value: 'aman', label: 'Aman (≥ 30%)' }
  ];

  const sortOptions = [
    { value: 'margin', label: 'Margin terkecil' },
    { value: 'gap', label: 'Selisih terkecil' },
    { value: 'name', label: 'Nama A→Z' }
  ];

  // ─── Margin rows ───────────────────────────────────────────────────────
  type MarginBand = 'rugi' | 'waspada' | 'tipis' | 'aman';

  function bandOf(marginPct: number): MarginBand {
    if (marginPct <= 0) return 'rugi';
    if (marginPct < 10) return 'waspada';
    if (marginPct < 30) return 'tipis';
    return 'aman';
  }

  type MarginRow = {
    product: Product;
    cost: CostInfo;
    saleMin: number;
    saleMax: number;
    hasRange: boolean;
    gap: number; // sale (min) - cost
    marginPct: number; // gap / sale * 100
    band: MarginBand;
  };

  const allRows = $derived.by<MarginRow[]>(() => {
    const out: MarginRow[] = [];
    for (const p of products.items) {
      if (p.status !== 'active') continue;
      const cost = latestPOCost(p.id);
      let saleMin: number;
      let saleMax: number;
      let hasRange = false;
      if (p.variants.length > 0) {
        const range = priceRange(p, pricelistId);
        saleMin = range.min;
        saleMax = range.max;
        hasRange = range.min !== range.max;
      } else {
        const v = basePrice(p, pricelistId);
        saleMin = saleMax = v;
      }
      if (!Number.isFinite(saleMin) || saleMin <= 0) continue;
      const gap = saleMin - cost.base;
      const marginPct = saleMin > 0 ? (gap / saleMin) * 100 : 0;
      out.push({
        product: p,
        cost,
        saleMin,
        saleMax,
        hasRange,
        gap,
        marginPct,
        band: bandOf(marginPct)
      });
    }
    return out;
  });

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    const filteredRows = allRows.filter((r) => {
      if (categoryFilter && r.product.categoryId !== categoryFilter) return false;
      if (bandFilter && r.band !== bandFilter) return false;
      if (!q) return true;
      return (
        r.product.name.toLowerCase().includes(q) ||
        r.product.sku.toLowerCase().includes(q)
      );
    });
    const sorted = [...filteredRows];
    switch (sortBy) {
      case 'margin':
        sorted.sort((a, b) => a.marginPct - b.marginPct);
        break;
      case 'gap':
        sorted.sort((a, b) => a.gap - b.gap);
        break;
      case 'name':
        sorted.sort((a, b) => a.product.name.localeCompare(b.product.name));
        break;
    }
    return sorted;
  });

  // ─── Top-level stats ──────────────────────────────────────────────────
  const riskCount = $derived(
    allRows.filter((r) => r.band === 'rugi' || r.band === 'waspada').length
  );
  const lossCount = $derived(allRows.filter((r) => r.band === 'rugi').length);
  const productCount = $derived(allRows.length);
  const noPOCount = $derived(allRows.filter((r) => r.cost.isFallback).length);

  const bandVariant: Record<MarginBand, 'success' | 'warning' | 'danger' | 'neutral'> = {
    aman: 'success',
    tipis: 'warning',
    waspada: 'danger',
    rugi: 'danger'
  };

  const bandLabel: Record<MarginBand, string> = {
    aman: 'Aman',
    tipis: 'Tipis',
    waspada: 'Waspada',
    rugi: 'Rugi'
  };

  function fmtDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const viewTabs = $derived([
    { value: 'margin', label: 'Pantauan Margin', badge: riskCount.toString() }
  ]);

  const columns = [
    { key: 'product' as const, label: 'Produk' },
    { key: 'cost' as const, label: 'Biaya beli (PO terakhir)', align: 'right' as const, width: '180px' },
    { key: 'sale' as const, label: 'Harga jual', align: 'right' as const, width: '160px' },
    { key: 'gap' as const, label: 'Selisih', align: 'right' as const, width: '140px' },
    { key: 'margin' as const, label: 'Margin', align: 'right' as const, width: '120px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '120px' }
  ];
</script>

<svelte:head>
  <title>Pengaturan Harga · POS Admin</title>
</svelte:head>

<PageHeader
  title="Pengaturan Harga"
  description="Pantau margin produk dengan membandingkan harga jual terhadap biaya PO terakhir. Sesuaikan harga per produk dari halaman produk."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Pengaturan Harga' }]}
/>

<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard
    label="Rugi"
    value={lossCount.toString()}
    icon={AlertTriangle}
    accent={lossCount > 0 ? 'rose' : 'brand'}
  />
  <StatCard
    label="Margin berisiko"
    value={riskCount.toString()}
    icon={TrendingDown}
    accent={riskCount > 0 ? 'amber' : 'brand'}
  />
  <StatCard label="Total produk aktif" value={productCount.toString()} icon={Tag} accent="brand" />
  <StatCard
    label="Belum ada PO"
    value={noPOCount.toString()}
    icon={Coins}
    accent="sky"
  />
</div>

<div class="mb-3">
  <Tabs tabs={viewTabs} bind:value={view} />
</div>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari nama / SKU…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={categoryFilter} options={categoryOptions} class="w-44" />
    <Select bind:value={pricelistId} options={pricelistOptions} class="w-40" />
    <Select bind:value={bandFilter} options={bandOptions} class="w-48" />
    <Select bind:value={sortBy} options={sortOptions} class="w-44" />
  </div>

  <Table {columns} rows={filtered} rowKey={(r) => r.product.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'product'}
        <div class="min-w-0">
          <a
            href="/products/{row.product.id}/edit"
            class="truncate font-medium text-slate-900 hover:text-brand-700 hover:underline"
          >
            {row.product.name}
          </a>
          <div class="mt-0.5 truncate font-mono text-[11px] text-slate-500">
            {row.product.sku}
          </div>
        </div>
      {:else if column.key === 'cost'}
        <div class="text-right">
          {#if row.cost.isFallback}
            <span class="text-sm font-medium text-slate-500">{formatRupiah(row.cost.base)}</span>
            <div class="text-[11px] text-amber-700">Belum ada PO · fallback ke biaya produk</div>
          {:else}
            <span class="text-sm font-medium text-slate-900">{formatRupiah(row.cost.base)}</span>
            <div class="text-[11px] text-slate-500">
              <a href="/purchase-orders" class="hover:text-brand-700 hover:underline">
                {row.cost.poCode}
              </a>
              · {fmtDate(row.cost.poDate)}
            </div>
          {/if}
        </div>
      {:else if column.key === 'sale'}
        <div class="text-right">
          {#if row.hasRange}
            <span class="text-sm font-medium text-slate-900">
              {formatRupiah(row.saleMin)} – {formatRupiah(row.saleMax)}
            </span>
            <div class="text-[11px] text-slate-500">
              {row.product.variants.length} varian
            </div>
          {:else}
            <span class="text-sm font-medium text-slate-900">{formatRupiah(row.saleMin)}</span>
          {/if}
        </div>
      {:else if column.key === 'gap'}
        <div class="text-right text-sm">
          <span class={row.gap > 0 ? 'font-medium text-slate-900' : 'font-medium text-rose-700'}>
            {row.gap >= 0 ? '+' : ''}{formatRupiah(row.gap)}
          </span>
        </div>
      {:else if column.key === 'margin'}
        <div class="text-right">
          <Badge variant={bandVariant[row.band]} size="sm" dot>
            {row.marginPct.toFixed(1)}%
          </Badge>
          <div class="mt-0.5 text-[11px] text-slate-500">{bandLabel[row.band]}</div>
        </div>
      {:else if column.key === 'actions'}
        <div class="flex justify-end gap-1">
          <a
            href="/products/{row.product.id}/edit"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
            title="Buka & sesuaikan harga"
          >
            <Calculator class="h-3.5 w-3.5" />
            Sesuaikan
          </a>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-2 py-10 text-center">
        <Calculator class="h-8 w-8 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Tidak ada produk yang cocok</p>
        <p class="text-xs text-slate-400">Sesuaikan filter atau bersihkan pencarian.</p>
      </div>
    {/snippet}
  </Table>

  <div class="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
    <strong>Cara baca:</strong> Biaya beli = harga unit PO terakhir, dinormalkan ke satuan dasar
    (harga × faktor kemasan). Harga jual = harga jual pada daftar harga aktif (untuk produk
    bervarian, kisaran min–maks dipakai sebagai margin terkecil). Margin = (jual − biaya) / jual.
  </div>
</Card>
