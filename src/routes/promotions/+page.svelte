<script lang="ts">
  import {
    BadgePercent,
    Pencil,
    Plus,
    Search,
    Tag,
    Trash2,
    Sparkles,
    CalendarDays,
    Percent,
    Gift,
    Package,
    Users
  } from 'lucide-svelte';
  // CalendarDays reused for expiring-batch icon
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    PageHeader,
    Select,
    StatCard,
    Table,
    Tabs
  } from '$lib/components/ui';
  import {
    promotions,
    promoKindLabels,
    promoStatusLabels,
    promoStatusVariant,
    promoLevelLabels,
    isPromoUsable,
    type Promotion,
    type PromoKind,
    type PromoStatus
  } from '$lib/stores/promotions.svelte';
  import { products, type Product } from '$lib/stores/products.svelte';
  import { categories, type Category } from '$lib/stores/categories.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let view = $state<'list' | 'attached'>('list');

  // Compute which promos "target" a given product. A promo targets a product if:
  // - it appears in productScopes
  // - the product's category appears in categoryIds
  // - bogoProductId matches
  // - any combo item matches
  function promosForProduct(p: Product): Promotion[] {
    return promotions.items.filter((promo) => {
      if (promo.productScopes?.some((s) => s.productId === p.id)) return true;
      if (promo.categoryIds?.includes(p.categoryId)) return true;
      if (promo.bogoProductId === p.id) return true;
      if (promo.comboItems?.some((c) => c.productId === p.id)) return true;
      return false;
    });
  }

  function promosForCategory(c: Category): Promotion[] {
    return promotions.items.filter((promo) => promo.categoryIds?.includes(c.id));
  }

  const productsWithPromos = $derived(
    products.items
      .filter((p) => p.status === 'active')
      .map((p) => ({ product: p, promos: promosForProduct(p) }))
      .filter((row) => row.promos.length > 0)
      .sort((a, b) => b.promos.length - a.promos.length)
  );

  const categoriesWithPromos = $derived(
    categories.items
      .map((c) => ({ category: c, promos: promosForCategory(c) }))
      .filter((row) => row.promos.length > 0)
      .sort((a, b) => b.promos.length - a.promos.length)
  );

  const viewTabs = $derived([
    { value: 'list', label: 'Daftar Promo', badge: promotions.items.length.toString() },
    {
      value: 'attached',
      label: 'Per Produk & Kategori',
      badge: (productsWithPromos.length + categoriesWithPromos.length).toString()
    }
  ]);

  let search = $state('');
  let kindFilter = $state<'' | PromoKind>('');
  let statusFilter = $state<'' | PromoStatus>('');

  let confirmOpen = $state(false);
  let pendingDelete = $state<Promotion | null>(null);

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return promotions.items.filter((p) => {
      if (kindFilter && p.kind !== kindFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  });

  const now = new Date();
  const activeCount = $derived(
    promotions.items.filter((p) => isPromoUsable(p, now)).length
  );
  const totalUsage = $derived(
    promotions.items.reduce((s, p) => s + p.usageCount, 0)
  );
  const expiringSoon = $derived.by(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 7);
    const today = new Date().toISOString().slice(0, 10);
    return promotions.items.filter((p) => {
      if (p.status !== 'active') return false;
      if (!p.endDate) return false;
      return p.endDate >= today && p.endDate <= threshold.toISOString().slice(0, 10);
    }).length;
  });

  const kindOptions = [
    { value: '', label: 'Semua tipe' },
    { value: 'discount', label: promoKindLabels.discount },
    { value: 'combo', label: promoKindLabels.combo },
    { value: 'bogo', label: promoKindLabels.bogo },
    { value: 'member-tier', label: promoKindLabels['member-tier'] }
  ];

  const statusOptions = [
    { value: '', label: 'Semua status' },
    { value: 'active', label: promoStatusLabels.active },
    { value: 'scheduled', label: promoStatusLabels.scheduled },
    { value: 'expired', label: promoStatusLabels.expired },
    { value: 'archived', label: promoStatusLabels.archived }
  ];

  const columns = [
    { key: 'code' as const, label: 'Kode', width: '110px' },
    { key: 'name' as const, label: 'Nama' },
    { key: 'kind' as const, label: 'Tipe', width: '140px' },
    { key: 'value' as const, label: 'Nilai', width: '180px' },
    { key: 'window' as const, label: 'Periode', width: '150px' },
    { key: 'usage' as const, label: 'Pakai', align: 'right' as const, width: '80px' },
    { key: 'status' as const, label: 'Status', width: '120px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '90px' }
  ];

  function describeValue(p: Promotion): string {
    switch (p.kind) {
      case 'discount':
        if (p.discountUnit === 'percent') return `${p.discountValue ?? 0}% off`;
        return `−${formatRupiah(p.discountValue ?? 0)}`;
      case 'combo':
        return `${p.comboItems?.length ?? 0} item · ${formatRupiah(p.comboPrice ?? 0)}`;
      case 'bogo':
        return `Beli ${p.buyQuantity} gratis ${p.getQuantity}`;
      case 'member-tier':
        return `${p.memberPercentOff ?? 0}% off member`;
      case 'expiring-batch': {
        const val =
          p.expiryDiscountUnit === 'percent'
            ? `${p.expiryDiscountValue ?? 0}% off`
            : `−${formatRupiah(p.expiryDiscountValue ?? 0)}/unit`;
        return `${val} (≤ ${p.daysToExpiryThreshold ?? 0} hari)`;
      }
    }
  }

  function kindIcon(kind: PromoKind) {
    switch (kind) {
      case 'discount':
        return Percent;
      case 'combo':
        return Package;
      case 'bogo':
        return Gift;
      case 'member-tier':
        return Users;
      case 'expiring-batch':
        return CalendarDays;
    }
  }

  function describePeriod(p: Promotion): string {
    if (!p.startDate && !p.endDate) return 'Tanpa batas';
    const s = p.startDate ?? '—';
    const e = p.endDate ?? '—';
    return `${s} → ${e}`;
  }

  function askDelete(p: Promotion) {
    pendingDelete = p;
    confirmOpen = true;
  }

  function doDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    promotions.remove(pendingDelete.id);
    pendingDelete = null;
    toast.success('Promo dihapus', name);
  }
</script>

<svelte:head>
  <title>Diskon & Promo · POS Admin</title>
</svelte:head>

<PageHeader
  title="Diskon & Promo"
  description="Kelola promo: diskon persentase / rupiah, paket combo, beli-N-gratis-M, atau diskon member."
  breadcrumb={[{ label: 'Penjualan' }, { label: 'Diskon & Promo' }]}
>
  {#snippet actions()}
    <Button href="/promotions/new">
      <Plus class="h-4 w-4" />
      Tambah promo
    </Button>
  {/snippet}
</PageHeader>

<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard label="Aktif sekarang" value={activeCount.toString()} icon={Sparkles} accent="emerald" />
  <StatCard label="Total promo" value={promotions.items.length.toString()} icon={BadgePercent} accent="brand" />
  <StatCard label="Berakhir 7 hari" value={expiringSoon.toString()} icon={CalendarDays} accent="amber" />
  <StatCard label="Total dipakai" value={totalUsage.toString()} icon={Tag} accent="sky" />
</div>

<div class="mb-3">
  <Tabs tabs={viewTabs} bind:value={view} />
</div>

{#if view === 'list'}
<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari kode, nama, deskripsi…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={kindFilter} options={kindOptions} class="w-44" />
    <Select bind:value={statusFilter} options={statusOptions} class="w-40" />
  </div>

  <Table {columns} rows={filtered} rowKey={(p) => p.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'code'}
        <a href="/promotions/{row.id}" class="font-medium text-brand-700 hover:underline">
          {row.code}
        </a>
      {:else if column.key === 'name'}
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="truncate font-medium text-slate-900">{row.name}</span>
            {#if row.memberPricelistId && row.kind !== 'member-tier'}
              <Badge size="sm" variant="info">Khusus member</Badge>
            {/if}
          </div>
          {#if row.description}
            <div class="truncate text-xs text-slate-500">{row.description}</div>
          {/if}
        </div>
      {:else if column.key === 'kind'}
        {@const Icon = kindIcon(row.kind)}
        <div class="flex items-center gap-1.5">
          <Icon class="h-3.5 w-3.5 text-slate-400" />
          <span class="text-sm text-slate-700">{promoKindLabels[row.kind]}</span>
          <Badge size="sm" variant="outline">{promoLevelLabels[row.level]}</Badge>
        </div>
      {:else if column.key === 'value'}
        <span class="text-sm font-medium text-slate-700">{describeValue(row)}</span>
      {:else if column.key === 'window'}
        <span class="text-xs text-slate-600">{describePeriod(row)}</span>
      {:else if column.key === 'usage'}
        <div class="text-right text-sm">
          <span class="font-medium text-slate-900">{row.usageCount}</span>
          {#if row.usageLimit !== undefined}
            <span class="text-xs text-slate-400">/{row.usageLimit}</span>
          {/if}
        </div>
      {:else if column.key === 'status'}
        <Badge variant={promoStatusVariant[row.status]} size="sm" dot>
          {promoStatusLabels[row.status]}
        </Badge>
      {:else if column.key === 'actions'}
        <div class="flex justify-end gap-1">
          <a
            href="/promotions/{row.id}"
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
      <div class="flex flex-col items-center gap-2 py-8">
        <BadgePercent class="h-8 w-8 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Belum ada promo</p>
        <p class="text-xs text-slate-400">
          Klik "Tambah promo" untuk membuat diskon, combo, atau beli-N-gratis-M.
        </p>
      </div>
    {/snippet}
  </Table>
</Card>
{:else}
  <div class="grid gap-4 lg:grid-cols-2">
    <Card padded={false}>
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Package class="h-4 w-4 text-slate-400" />
          Produk dengan promo
        </h3>
        <span class="text-xs text-slate-500">{productsWithPromos.length} produk</span>
      </div>
      {#if productsWithPromos.length === 0}
        <div class="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
          <Package class="h-7 w-7 text-slate-300" />
          <p class="text-xs text-slate-500">
            Belum ada produk yang punya promo. Tambah promo lalu pilih produk di "Untuk produk / kategori".
          </p>
        </div>
      {:else}
        <ul class="divide-y divide-slate-100">
          {#each productsWithPromos as row (row.product.id)}
            <li class="px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-slate-900">
                    {row.product.name}
                  </div>
                  <div class="mt-0.5 text-xs text-slate-500">
                    {categories.getById(row.product.categoryId)?.name ?? '—'}
                  </div>
                </div>
                <span class="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                  {row.promos.length}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                {#each row.promos as p (p.id)}
                  <a
                    href="/promotions/{p.id}"
                    title={`${p.name} — ${p.description}`}
                    class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <span class="font-mono text-[10px] text-slate-500">{p.code}</span>
                    <span class="truncate max-w-[180px]">{p.name}</span>
                    <Badge variant={promoStatusVariant[p.status]} size="sm" dot>
                      {promoKindLabels[p.kind]}
                    </Badge>
                  </a>
                {/each}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>

    <Card padded={false}>
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Tag class="h-4 w-4 text-slate-400" />
          Kategori dengan promo
        </h3>
        <span class="text-xs text-slate-500">{categoriesWithPromos.length} kategori</span>
      </div>
      {#if categoriesWithPromos.length === 0}
        <div class="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
          <Tag class="h-7 w-7 text-slate-300" />
          <p class="text-xs text-slate-500">
            Belum ada kategori yang punya promo. Tambah promo lalu pilih kategori di "Untuk produk / kategori".
          </p>
        </div>
      {:else}
        <ul class="divide-y divide-slate-100">
          {#each categoriesWithPromos as row (row.category.id)}
            <li class="px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-slate-900">
                    {row.category.name}
                  </div>
                </div>
                <span class="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                  {row.promos.length}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                {#each row.promos as p (p.id)}
                  <a
                    href="/promotions/{p.id}"
                    title={`${p.name} — ${p.description}`}
                    class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <span class="font-mono text-[10px] text-slate-500">{p.code}</span>
                    <span class="truncate max-w-[180px]">{p.name}</span>
                    <Badge variant={promoStatusVariant[p.status]} size="sm" dot>
                      {promoKindLabels[p.kind]}
                    </Badge>
                  </a>
                {/each}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </div>
{/if}

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus promo?"
  message={pendingDelete ? `"${pendingDelete.name}" akan dihapus. Promo yang sudah dipakai di pesanan lama tetap terlihat.` : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
