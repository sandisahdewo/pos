<script lang="ts">
  import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Package,
    Layers,
    Shapes,
    BadgePercent,
    TrendingDown,
    Truck,
    Boxes
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    PageHeader,
    Select,
    Table
  } from '$lib/components/ui';
  import {
    hasAnyTier,
    isAdvanced,
    pricelistEntries,
    priceRange,
    products,
    type Product,
    type ProductStatus
  } from '$lib/stores/products.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { purchaseOrders } from '$lib/stores/purchaseOrders.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let search = $state('');
  let categoryFilter = $state('');
  let statusFilter = $state<'' | ProductStatus>('');
  let modeFilter = $state<'' | 'simple' | 'advanced'>('');

  let confirmOpen = $state(false);
  let pendingDelete = $state<Product | null>(null);

  const categoryOptions = $derived(
    categories.items.map((c) => ({ value: c.id, label: c.name }))
  );

  const filterCategoryOptions = $derived([
    { value: '', label: 'Semua kategori' },
    ...categoryOptions
  ]);

  const filterStatusOptions = [
    { value: '', label: 'Semua status' },
    { value: 'active', label: 'Aktif' },
    { value: 'archived', label: 'Diarsipkan' }
  ];

  const filterModeOptions = [
    { value: '', label: 'Semua produk' },
    { value: 'simple', label: 'Hanya sederhana' },
    { value: 'advanced', label: 'Hanya lanjutan' }
  ];

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return products.items.filter((p) => {
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (modeFilter === 'simple' && isAdvanced(p)) return false;
      if (modeFilter === 'advanced' && !isAdvanced(p)) return false;
      if (!q) return true;
      const hay = [
        p.name,
        p.sku,
        p.description,
        ...p.variants.map((v) => `${v.name} ${v.sku}`)
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  const columns = [
    { key: 'name' as const, label: 'Produk' },
    { key: 'categoryId' as const, label: 'Kategori' },
    { key: 'unitId' as const, label: 'Satuan' },
    { key: 'prices' as const, label: 'Harga', align: 'right' as const },
    { key: 'status' as const, label: 'Status' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '120px' }
  ];

  function categoryFor(id: string) {
    return categories.getById(id);
  }
  function unitFor(id: string) {
    return units.getById(id);
  }

  function priceLabel(p: Product): string {
    const { min, max } = priceRange(p);
    if (min === max) return formatRupiah(min);
    return `${formatRupiah(min)} – ${formatRupiah(max)}`;
  }

  function extraPricelistCount(p: Product): number {
    const ids = pricelistEntries(p);
    ids.delete(pricelists.defaultId());
    return ids.size;
  }

  function askDelete(p: Product) {
    pendingDelete = p;
    confirmOpen = true;
  }

  function doDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    products.remove(pendingDelete.id);
    pendingDelete = null;
    toast.success('Produk dihapus', name);
  }

</script>

<svelte:head>
  <title>Produk · POS Admin</title>
</svelte:head>

<PageHeader
  title="Produk"
  description="Katalog semua barang dan jasa yang Anda jual."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Produk' }]}
>
  {#snippet actions()}
    <Button href="/products/new">
      <Plus class="h-4 w-4" />
      Tambah produk
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[240px] flex-1">
      <Input placeholder="Cari berdasarkan nama, SKU, varian, atau deskripsi…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={categoryFilter} options={filterCategoryOptions} class="w-44" />
    <Select bind:value={statusFilter} options={filterStatusOptions} class="w-36" />
    <Select bind:value={modeFilter} options={filterModeOptions} class="w-40" />
  </div>

  <Table {columns} rows={filtered} rowKey={(p) => p.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          {#if row.imageUrl}
            <img
              src={row.imageUrl}
              alt={row.name}
              class="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
              loading="lazy"
            />
          {:else}
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
            >
              <Package class="h-4 w-4" />
            </div>
          {/if}
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <a
                href="/products/{row.id}/edit"
                class="truncate font-medium text-slate-900 hover:text-brand-700"
              >
                {row.name}
              </a>
              {#if isAdvanced(row)}
                <Badge variant="brand" size="sm">Lanjutan</Badge>
              {/if}
              {#if row.kind === 'composite'}
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
                  title="Komposit — dibuat dari komponen"
                >
                  <Boxes class="h-3 w-3" />
                  Komposit
                </span>
              {/if}
              {#if purchaseOrders.hasConsignmentFor(row.id)}
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                  title="Memiliki PO konsinyasi"
                >
                  <Truck class="h-3 w-3" />
                  Konsinyasi
                </span>
              {/if}
            </div>
            <div class="flex items-center gap-2 text-xs">
              <code class="font-mono text-slate-500">{row.sku}</code>
              {#if row.units.length > 0}
                <span class="inline-flex items-center gap-1 text-slate-500">
                  <Layers class="h-3 w-3" />
                  {1 + row.units.length} satuan
                </span>
              {/if}
              {#if row.variants.length > 0}
                <span class="inline-flex items-center gap-1 text-slate-500">
                  <Shapes class="h-3 w-3" />
                  {row.variants.length} varian
                </span>
              {/if}
            </div>
          </div>
        </div>
      {:else if column.key === 'categoryId'}
        {@const cat = categoryFor(row.categoryId)}
        {#if cat}
          <Badge variant={cat.color} dot>{cat.name}</Badge>
        {:else}
          <span class="text-xs text-slate-400">—</span>
        {/if}
      {:else if column.key === 'unitId'}
        {@const u = unitFor(row.unitId)}
        <span class="text-slate-600">{u ? u.code : '—'}</span>
      {:else if column.key === 'prices'}
        {@const extras = extraPricelistCount(row)}
        {@const tiered = hasAnyTier(row)}
        <div class="inline-flex items-center justify-end gap-1.5">
          <span class="font-medium text-slate-900">{priceLabel(row)}</span>
          {#if tiered}
            <span
              class="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
              title="Memiliki tingkat harga per kuantitas"
            >
              <TrendingDown class="h-3 w-3" />
              Berjenjang
            </span>
          {/if}
          {#if extras > 0}
            <span
              class="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
              title="Daftar harga tambahan"
            >
              <BadgePercent class="h-3 w-3" />
              +{extras}
            </span>
          {/if}
        </div>
      {:else if column.key === 'status'}
        <Badge variant={row.status === 'active' ? 'success' : 'neutral'} dot>
          {row.status === 'active' ? 'Aktif' : 'Diarsipkan'}
        </Badge>
      {:else if column.key === 'id'}
        <div class="flex justify-end gap-1">
          <a
            href="/products/{row.id}/edit"
            class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Ubah"
          >
            <Pencil class="h-4 w-4" />
          </a>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Hapus"
            onclick={() => askDelete(row)}
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-6">
        <p class="text-sm font-medium text-slate-600">Tidak ada produk yang cocok dengan filter</p>
        <p class="text-xs text-slate-400">Sesuaikan filter atau tambahkan produk baru.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus produk?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus dari katalog. Tindakan ini tidak bisa dibatalkan.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>

