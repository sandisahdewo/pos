<script lang="ts">
  import {
    BadgePercent,
    Pencil,
    Plus,
    Printer,
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
  import { orders } from '$lib/stores/orders.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let view = $state<'list' | 'attached' | 'analytics'>('list');

  type PromoStats = {
    promoId: string;
    promo: Promotion;
    uses: number;
    totalDiscount: number;
    avgDiscount: number;
    uniqueCustomers: number;
    lastUsedAt?: string;
    firstUsedAt?: string;
  };

  const promoStats = $derived.by<PromoStats[]>(() => {
    const map = new Map<string, { uses: number; total: number; customers: Set<string>; first?: string; last?: string }>();
    for (const o of orders.items) {
      if (o.status === 'cancelled') continue;
      if (!o.appliedPromos || o.appliedPromos.length === 0) continue;
      for (const ap of o.appliedPromos) {
        let entry = map.get(ap.promoId);
        if (!entry) {
          entry = { uses: 0, total: 0, customers: new Set<string>() };
          map.set(ap.promoId, entry);
        }
        entry.uses += 1;
        entry.total += ap.discountAmount;
        if (o.customerId) entry.customers.add(o.customerId);
        if (!entry.first || o.createdAt < entry.first) entry.first = o.createdAt;
        if (!entry.last || o.createdAt > entry.last) entry.last = o.createdAt;
      }
    }
    return promotions.items.map((p) => {
      const e = map.get(p.id);
      const uses = e?.uses ?? 0;
      const total = e?.total ?? 0;
      return {
        promoId: p.id,
        promo: p,
        uses,
        totalDiscount: total,
        avgDiscount: uses > 0 ? total / uses : 0,
        uniqueCustomers: e?.customers.size ?? 0,
        firstUsedAt: e?.first,
        lastUsedAt: e?.last
      };
    });
  });

  const totalUses = $derived(promoStats.reduce((s, r) => s + r.uses, 0));
  const totalDiscountGiven = $derived(promoStats.reduce((s, r) => s + r.totalDiscount, 0));
  const topPromo = $derived(
    promoStats.slice().sort((a, b) => b.totalDiscount - a.totalDiscount)[0]
  );
  const unusedPromoCount = $derived(promoStats.filter((r) => r.uses === 0).length);

  let analyticsSort = $state<'discount' | 'uses' | 'last' | 'avg'>('discount');

  const sortOptions: { v: 'discount' | 'uses' | 'avg' | 'last'; l: string }[] = [
    { v: 'discount', l: 'Diskon terbanyak' },
    { v: 'uses', l: 'Paling sering dipakai' },
    { v: 'avg', l: 'Rata-rata diskon' },
    { v: 'last', l: 'Terakhir dipakai' }
  ];

  const sortedStats = $derived.by(() => {
    const arr = promoStats.slice();
    switch (analyticsSort) {
      case 'discount':
        return arr.sort((a, b) => b.totalDiscount - a.totalDiscount);
      case 'uses':
        return arr.sort((a, b) => b.uses - a.uses);
      case 'avg':
        return arr.sort((a, b) => b.avgDiscount - a.avgDiscount);
      case 'last':
        return arr.sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''));
    }
  });

  function fmtRelativeDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Hari ini';
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

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
    },
    { value: 'analytics', label: 'Performa', badge: totalUses.toString() }
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
    { key: 'actions' as const, label: '', align: 'right' as const, width: '120px' }
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
            href="/promotions/{row.id}/label"
            class="rounded-md p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-700"
            aria-label="Cetak label"
            title="Cetak label"
          >
            <Printer class="h-4 w-4" />
          </a>
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
{:else if view === 'attached'}
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
{:else if view === 'analytics'}
  <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard label="Total dipakai" value={totalUses.toString()} icon={Tag} accent="brand" />
    <StatCard
      label="Total diskon diberikan"
      value={formatRupiah(totalDiscountGiven)}
      icon={BadgePercent}
      accent="emerald"
    />
    <StatCard
      label="Top performer"
      value={topPromo && topPromo.uses > 0 ? topPromo.promo.code : '—'}
      icon={Sparkles}
      accent="sky"
    />
    <StatCard
      label="Belum pernah dipakai"
      value={unusedPromoCount.toString()}
      icon={CalendarDays}
      accent={unusedPromoCount > 0 ? 'amber' : 'brand'}
    />
  </div>

  <Card padded={false}>
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
      <div class="text-xs font-medium text-slate-500">Urutkan:</div>
      {#each sortOptions as opt (opt.v)}
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium {analyticsSort === opt.v
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-600 hover:bg-slate-100'}"
          onclick={() => (analyticsSort = opt.v)}
        >
          {opt.l}
        </button>
      {/each}
    </div>

    {#if sortedStats.length === 0}
      <div class="flex flex-col items-center gap-2 py-10 text-center">
        <Sparkles class="h-7 w-7 text-slate-300" />
        <p class="text-sm text-slate-500">Belum ada data analitik.</p>
      </div>
    {:else}
      <ul class="divide-y divide-slate-100">
        {#each sortedStats as row (row.promoId)}
          {@const used = row.uses > 0}
          <li class="px-4 py-3 {used ? '' : 'opacity-60'}">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <a
                    href="/promotions/{row.promo.id}"
                    class="font-mono text-xs text-slate-500 hover:text-brand-700"
                  >
                    {row.promo.code}
                  </a>
                  <a
                    href="/promotions/{row.promo.id}"
                    class="truncate font-medium text-slate-900 hover:text-brand-700 hover:underline"
                  >
                    {row.promo.name}
                  </a>
                  <Badge size="sm" variant={promoStatusVariant[row.promo.status]} dot>
                    {promoKindLabels[row.promo.kind]}
                  </Badge>
                </div>
                <div class="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span><span class="text-slate-400">Dipakai:</span> <span class="font-medium text-slate-700">{row.uses}×</span></span>
                  <span><span class="text-slate-400">Pelanggan unik:</span> <span class="font-medium text-slate-700">{row.uniqueCustomers}</span></span>
                  <span><span class="text-slate-400">Pertama:</span> {fmtRelativeDate(row.firstUsedAt)}</span>
                  <span><span class="text-slate-400">Terakhir:</span> {fmtRelativeDate(row.lastUsedAt)}</span>
                </div>
              </div>
              <div class="text-right">
                <div class="text-base font-semibold text-emerald-700">
                  −{formatRupiah(row.totalDiscount)}
                </div>
                {#if used}
                  <div class="text-[11px] text-slate-500">
                    Rata-rata {formatRupiah(row.avgDiscount)}/transaksi
                  </div>
                {:else}
                  <div class="text-[11px] text-slate-400">belum ada transaksi</div>
                {/if}
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>
{/if}

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus promo?"
  message={pendingDelete ? `"${pendingDelete.name}" akan dihapus. Promo yang sudah dipakai di pesanan lama tetap terlihat.` : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
