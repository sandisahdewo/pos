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
    Table
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
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

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

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus promo?"
  message={pendingDelete ? `"${pendingDelete.name}" akan dihapus. Promo yang sudah dipakai di pesanan lama tetap terlihat.` : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
