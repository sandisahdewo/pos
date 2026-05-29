<script lang="ts">
  import { Search, ArrowRight, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-svelte';
  import { Badge, Card, Input, PageHeader, Select, Table, Tabs } from '$lib/components/ui';
  import {
    allSupplierProductPairs,
    compareSuppliers,
    type SupplierProductPair,
    type SupplierComparePair
  } from '$lib/utils/supplierAnalytics';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let activeTab = $state('ringkasan');
  const tabs = [
    { value: 'ringkasan', label: 'Ringkasan' },
    { value: 'perbandingan', label: 'Perbandingan A vs B' }
  ];

  // === Ringkasan tab state ===
  let search = $state('');
  let categoryFilter = $state('');
  let supplierFilter = $state('');

  const allPairs = $derived.by(() => allSupplierProductPairs());

  const filteredPairs = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return allPairs.filter((p) => {
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      if (supplierFilter && p.supplierId !== supplierFilter) return false;
      if (!q) return true;
      const hay = `${p.productName} ${p.productSku} ${p.supplierName} ${p.variantName ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  });

  const categoryOptions = $derived([
    { value: '', label: 'Semua kategori' },
    ...categories.items.map((c) => ({ value: c.id, label: c.name }))
  ]);

  // Pilihan supplier diambil dari yang punya minimal 1 batch, supaya
  // dropdown nggak penuh supplier yang nggak pernah kirim apa-apa.
  const activeSupplierOptions = $derived.by(() => {
    const ids = new Set(allPairs.map((p) => p.supplierId));
    return [
      { value: '', label: 'Semua pemasok' },
      ...suppliers.items
        .filter((s) => ids.has(s.id))
        .map((s) => ({ value: s.id, label: s.name }))
    ];
  });

  // Kolom tabel Ringkasan
  const ringkasanColumns = [
    { key: 'productName' as const, label: 'Produk' },
    { key: 'supplierName' as const, label: 'Pemasok', width: '180px' },
    { key: 'latestCost' as const, label: 'Harga terakhir', align: 'right' as const, width: '180px' },
    { key: 'weightedAvgCost' as const, label: 'Rata-rata', align: 'right' as const, width: '140px' },
    { key: 'batchCount' as const, label: 'Frekuensi', align: 'right' as const, width: '90px' },
    { key: 'lastReceivedAt' as const, label: 'Terakhir tiba', width: '120px' }
  ];

  // === Perbandingan tab state ===
  let supplierAId = $state('');
  let supplierBId = $state('');

  const supplierAOptions = $derived.by(() => {
    const ids = new Set(allPairs.map((p) => p.supplierId));
    return [
      { value: '', label: 'Pilih pemasok A…' },
      ...suppliers.items
        .filter((s) => ids.has(s.id))
        .map((s) => ({ value: s.id, label: s.name }))
    ];
  });

  // Pemasok B exclude pilihan A
  const supplierBOptions = $derived.by(() => {
    const ids = new Set(allPairs.map((p) => p.supplierId));
    return [
      { value: '', label: 'Pilih pemasok B…' },
      ...suppliers.items
        .filter((s) => ids.has(s.id) && s.id !== supplierAId)
        .map((s) => ({ value: s.id, label: s.name }))
    ];
  });

  // Filter terapan setelah comparison di-hitung. Search + category
  // dipakai dua-duanya — bisa kombinasi.
  let comparisonSearch = $state('');
  let comparisonCategoryFilter = $state('');

  // Raw comparison sebelum filter — untuk hitung "total muncul" vs
  // "total setelah filter" supaya summary tetap konsisten.
  const rawComparison = $derived.by(() => compareSuppliers(supplierAId, supplierBId));

  const comparison = $derived.by(() => {
    const q = comparisonSearch.trim().toLowerCase();
    return rawComparison.filter((c) => {
      if (comparisonCategoryFilter) {
        const product = products.getById(c.productId);
        if (product?.categoryId !== comparisonCategoryFilter) return false;
      }
      if (!q) return true;
      const hay = `${c.productName} ${c.variantName ?? ''} ${c.productSku}`.toLowerCase();
      return hay.includes(q);
    });
  });

  const compareSummary = $derived.by(() => {
    let aWins = 0;
    let bWins = 0;
    let equal = 0;
    for (const c of comparison) {
      if (c.cheaperBy === 'A') aWins++;
      else if (c.cheaperBy === 'B') bWins++;
      else equal++;
    }
    return {
      aWins,
      bWins,
      equal,
      total: comparison.length,
      filteredOut: rawComparison.length - comparison.length
    };
  });

  const supplierAName = $derived(suppliers.getById(supplierAId)?.name ?? 'Pemasok A');
  const supplierBName = $derived(suppliers.getById(supplierBId)?.name ?? 'Pemasok B');

  const compareColumns = $derived([
    { key: 'productName' as const, label: 'Produk' },
    {
      key: 'costA' as const,
      label: supplierAName,
      align: 'right' as const,
      width: '160px'
    },
    {
      key: 'costB' as const,
      label: supplierBName,
      align: 'right' as const,
      width: '160px'
    },
    { key: 'diff' as const, label: 'Selisih', align: 'right' as const, width: '160px' },
    { key: 'cheaperBy' as const, label: 'Lebih murah', width: '140px' }
  ]);

  function fmtDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Harga Pemasok · POS Admin</title>
</svelte:head>

<PageHeader
  title="Harga Pemasok"
  description="Analitik harga aktual dari semua pemasok berdasarkan riwayat penerimaan PO."
  breadcrumb={[{ label: 'Wawasan' }, { label: 'Harga Pemasok' }]}
/>

{#if allPairs.length === 0}
  <Card>
    <div class="py-10 text-center">
      <p class="text-sm font-medium text-slate-700">Belum ada riwayat penerimaan</p>
      <p class="mt-1 text-xs text-slate-500">
        Selesaikan minimal satu Penerimaan PO untuk mulai mengumpulkan data harga pemasok.
        Data di sini di-derive otomatis dari batches yang lahir dari PO yang diterima.
      </p>
    </div>
  </Card>
{:else}
  <Card padded={false}>
    <div class="px-4 pt-3">
      <Tabs {tabs} bind:value={activeTab} />
    </div>

    {#if activeTab === 'ringkasan'}
      <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div class="min-w-[220px] flex-1">
          <Input placeholder="Cari produk, SKU, atau nama pemasok…" bind:value={search}>
            {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
          </Input>
        </div>
        <Select bind:value={categoryFilter} options={categoryOptions} class="w-44" />
        <Select bind:value={supplierFilter} options={activeSupplierOptions} class="w-48" />
      </div>

      <Table
        columns={ringkasanColumns}
        rows={filteredPairs}
        rowKey={(r: SupplierProductPair) =>
          `${r.productId}|${r.variantId ?? ''}|${r.supplierId}`}
      >
        {#snippet cell({ row, column })}
          {#if column.key === 'productName'}
            <div class="min-w-0">
              <div class="truncate font-medium text-slate-900">
                {row.productName}
                {#if row.variantName}
                  <span class="text-slate-500">· {row.variantName}</span>
                {/if}
              </div>
              <code class="text-xs text-slate-500">{row.productSku}</code>
            </div>
          {:else if column.key === 'supplierName'}
            <span class="text-slate-700">{row.supplierName}</span>
          {:else if column.key === 'latestCost'}
            <div class="inline-flex items-baseline gap-1.5">
              <span class="font-semibold text-slate-900">{formatRupiah(row.latestCost)}</span>
              {#if row.previousCost !== undefined && Math.abs(row.deltaPct) > 0.5}
                <Badge variant={row.deltaPct > 0 ? 'danger' : 'success'} size="sm">
                  {row.deltaPct > 0 ? '+' : ''}{row.deltaPct.toFixed(1)}%
                </Badge>
              {/if}
            </div>
          {:else if column.key === 'weightedAvgCost'}
            <span class="text-slate-600">{formatRupiah(row.weightedAvgCost)}</span>
          {:else if column.key === 'batchCount'}
            <span class="text-slate-700">{row.batchCount}×</span>
          {:else if column.key === 'lastReceivedAt'}
            <span class="text-xs text-slate-600">{fmtDate(row.lastReceivedAt)}</span>
          {/if}
        {/snippet}

        {#snippet empty()}
          <div class="py-6 text-center text-xs text-slate-400">
            Tidak ada yang cocok dengan filter. Coba ubah kata kunci atau bersihkan filter.
          </div>
        {/snippet}
      </Table>
    {:else if activeTab === 'perbandingan'}
      <div class="flex flex-wrap items-end gap-3 border-b border-slate-100 px-4 py-4">
        <div class="min-w-[200px] flex-1">
          <Select
            label="Pemasok A"
            bind:value={supplierAId}
            options={supplierAOptions}
          />
        </div>
        <div class="flex h-9 items-center pb-1.5 text-slate-400">
          <ArrowLeftRight class="h-5 w-5" />
        </div>
        <div class="min-w-[200px] flex-1">
          <Select
            label="Pemasok B"
            bind:value={supplierBId}
            options={supplierBOptions}
          />
        </div>
      </div>

      {#if !supplierAId || !supplierBId}
        <div class="py-10 text-center">
          <p class="text-sm font-medium text-slate-700">Pilih dua pemasok</p>
          <p class="mt-1 text-xs text-slate-500">
            Tampilkan produk yang dua-duanya pernah kirim, side-by-side untuk dibandingkan
            harganya.
          </p>
        </div>
      {:else if rawComparison.length === 0}
        <div class="py-10 text-center">
          <p class="text-sm font-medium text-slate-700">
            Tidak ada produk yang dikirim oleh dua-duanya
          </p>
          <p class="mt-1 text-xs text-slate-500">
            {supplierAName} dan {supplierBName} belum pernah mengirim produk yang sama. Pilih
            kombinasi pemasok lain.
          </p>
        </div>
      {:else}
        <!-- Filter row: search + category, apply ke list produk yang dua
             supplier sama-sama kirim. -->
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div class="min-w-[220px] flex-1">
            <Input placeholder="Cari produk, varian, atau SKU…" bind:value={comparisonSearch}>
              {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
            </Input>
          </div>
          <Select
            bind:value={comparisonCategoryFilter}
            options={categoryOptions}
            class="w-44"
          />
        </div>

        {#if comparison.length === 0}
          <div class="py-10 text-center">
            <p class="text-sm font-medium text-slate-700">
              Tidak ada yang cocok dengan filter
            </p>
            <p class="mt-1 text-xs text-slate-500">
              {rawComparison.length} produk dibandingkan tapi tersaring habis oleh filter. Coba
              hapus filter atau ubah kata kunci.
            </p>
          </div>
        {:else}
        <!-- Summary band -->
        <div class="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <div>
              <span class="text-slate-500">Total produk yang dibandingkan: </span>
              <span class="font-semibold text-slate-900">{compareSummary.total}</span>
            </div>
            <span class="text-slate-300">·</span>
            <div class="inline-flex items-center gap-1.5">
              <TrendingDown class="h-4 w-4 text-emerald-600" />
              <span class="text-slate-500">{supplierAName} lebih murah:</span>
              <span class="font-semibold text-emerald-700">{compareSummary.aWins}</span>
            </div>
            <span class="text-slate-300">·</span>
            <div class="inline-flex items-center gap-1.5">
              <TrendingDown class="h-4 w-4 text-emerald-600" />
              <span class="text-slate-500">{supplierBName} lebih murah:</span>
              <span class="font-semibold text-emerald-700">{compareSummary.bWins}</span>
            </div>
            {#if compareSummary.equal > 0}
              <span class="text-slate-300">·</span>
              <div class="inline-flex items-center gap-1.5">
                <span class="text-slate-500">Setara:</span>
                <span class="font-semibold text-slate-700">{compareSummary.equal}</span>
              </div>
            {/if}
          </div>
        </div>

        <Table
          columns={compareColumns}
          rows={comparison}
          rowKey={(r: SupplierComparePair) => `${r.productId}|${r.variantId ?? ''}`}
        >
          {#snippet cell({ row, column })}
            {#if column.key === 'productName'}
              <div class="min-w-0">
                <div class="truncate font-medium text-slate-900">
                  {row.productName}
                  {#if row.variantName}
                    <span class="text-slate-500">· {row.variantName}</span>
                  {/if}
                </div>
                <code class="text-xs text-slate-500">{row.productSku}</code>
              </div>
            {:else if column.key === 'costA'}
              <div
                class="text-right {row.cheaperBy === 'A'
                  ? 'font-semibold text-emerald-700'
                  : 'text-slate-700'}"
              >
                {formatRupiah(row.costA)}
                <div class="text-xs text-slate-400 font-normal">{fmtDate(row.lastReceivedA)}</div>
              </div>
            {:else if column.key === 'costB'}
              <div
                class="text-right {row.cheaperBy === 'B'
                  ? 'font-semibold text-emerald-700'
                  : 'text-slate-700'}"
              >
                {formatRupiah(row.costB)}
                <div class="text-xs text-slate-400 font-normal">{fmtDate(row.lastReceivedB)}</div>
              </div>
            {:else if column.key === 'diff'}
              <div class="inline-flex items-baseline gap-1.5">
                {#if row.cheaperBy === 'equal'}
                  <span class="text-slate-500">≈ sama</span>
                {:else}
                  <span class="text-slate-700">{formatRupiah(Math.abs(row.diff))}</span>
                  <Badge variant={Math.abs(row.diffPct) > 10 ? 'warning' : 'neutral'} size="sm">
                    {Math.abs(row.diffPct).toFixed(1)}%
                  </Badge>
                {/if}
              </div>
            {:else if column.key === 'cheaperBy'}
              {#if row.cheaperBy === 'A'}
                <Badge variant="success" size="sm">{supplierAName}</Badge>
              {:else if row.cheaperBy === 'B'}
                <Badge variant="success" size="sm">{supplierBName}</Badge>
              {:else}
                <Badge variant="neutral" size="sm">Setara</Badge>
              {/if}
            {/if}
          {/snippet}
        </Table>
        {/if}
      {/if}
    {/if}
  </Card>
{/if}
