<script lang="ts">
  import {
    BarChart3,
    Calendar,
    Clock,
    Coins,
    Package,
    Receipt,
    ShoppingCart,
    TrendingUp,
    UserCog,
    Wallet,
    BadgePercent
  } from 'lucide-svelte';
  import {
    Badge,
    Card,
    Input,
    PageHeader,
    StatCard,
    Tabs
  } from '$lib/components/ui';
  import {
    salesSummary,
    dayBuckets,
    hourBuckets,
    topProducts,
    cashierBuckets,
    todayISO,
    isoDaysAgo,
    isoStartOfMonth,
    type SalesPeriod
  } from '$lib/utils/salesAnalytics';
  import { employees } from '$lib/stores/employees.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type PresetKey = 'today' | '7d' | '30d' | 'month' | 'custom';
  let preset = $state<PresetKey>('7d');
  let customStart = $state<string>(isoDaysAgo(7));
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

  const summary = $derived(salesSummary(period));
  const days = $derived(dayBuckets(period));
  const hours = $derived(hourBuckets(period));
  const tops = $derived(topProducts(period, 10));
  const cashiers = $derived(cashierBuckets(period));

  const presetTabs = [
    { value: 'today', label: 'Hari ini' },
    { value: '7d', label: '7 hari' },
    { value: '30d', label: '30 hari' },
    { value: 'month', label: 'Bulan ini' },
    { value: 'custom', label: 'Custom' }
  ];

  const maxDayRevenue = $derived(Math.max(1, ...days.map((d) => d.revenue)));
  const maxHourRevenue = $derived(Math.max(1, ...hours.map((h) => h.revenue)));
  const maxProductRevenue = $derived(Math.max(1, ...tops.map((p) => p.revenue)));

  function fmtDayLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  function fmtWeekday(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', { weekday: 'short' });
  }

  function fmtUnitCode(unitId: string): string {
    return units.getById(unitId)?.code ?? unitId;
  }

  function employeeName(empId: string): string {
    return employees.getById(empId)?.name ?? '—';
  }

  const shiftsOn = $derived(settings.value.operations.shiftsEnabled);
</script>

<svelte:head>
  <title>Laporan · POS Admin</title>
</svelte:head>

<PageHeader
  title="Laporan Penjualan"
  description="Ringkasan penjualan, tren harian, produk terlaris, dan jam paling ramai."
  breadcrumb={[{ label: 'Wawasan' }, { label: 'Laporan' }]}
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
        {fmtDayLabel(period.startISO)} — {fmtDayLabel(period.endISO)}
      </div>
    {/if}
  </div>
</Card>

<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
  <StatCard
    label="Pendapatan kotor"
    value={formatRupiah(summary.grossRevenue)}
    icon={Wallet}
    accent="brand"
  />
  <StatCard
    label="Jumlah transaksi"
    value={summary.orderCount.toString()}
    icon={Receipt}
    accent="sky"
  />
  <StatCard
    label="Rata-rata per transaksi"
    value={formatRupiah(summary.averageOrderValue)}
    icon={TrendingUp}
    accent="emerald"
  />
  <StatCard
    label="Item terjual"
    value={summary.itemsSold.toLocaleString('id-ID')}
    icon={ShoppingCart}
    accent="violet"
  />
  <StatCard
    label="Margin kotor"
    value={`${summary.marginPct.toFixed(1)}%`}
    icon={Coins}
    accent={summary.marginPct >= 30 ? 'emerald' : summary.marginPct >= 15 ? 'amber' : 'rose'}
  />
</div>

<div class="grid gap-4 lg:grid-cols-3">
  <Card class="lg:col-span-2">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Calendar class="h-4 w-4 text-slate-400" />
        Tren harian
      </h3>
      <span class="text-xs text-slate-500">{days.length} hari</span>
    </div>
    {#if summary.orderCount === 0}
      <div class="flex flex-col items-center gap-2 py-8 text-center text-xs text-slate-500">
        <BarChart3 class="h-7 w-7 text-slate-300" />
        Belum ada transaksi pada periode ini.
      </div>
    {:else}
      <ul class="space-y-1.5">
        {#each days as d (d.date)}
          {@const widthPct = (d.revenue / maxDayRevenue) * 100}
          <li class="flex items-center gap-2 text-xs">
            <div class="w-20 shrink-0 text-slate-500">
              {fmtDayLabel(d.date)} <span class="text-slate-400">{fmtWeekday(d.date)}</span>
            </div>
            <div class="relative h-5 flex-1 rounded bg-slate-50">
              <div
                class="h-full rounded bg-brand-200"
                style="width: {widthPct}%"
              ></div>
              {#if d.revenue > 0}
                <div class="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium text-slate-700">
                  {formatRupiah(d.revenue)}
                </div>
              {/if}
            </div>
            <div class="w-12 shrink-0 text-right text-slate-500">{d.orderCount}×</div>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>

  <Card>
    <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
      <Wallet class="h-4 w-4 text-slate-400" />
      Metode pembayaran
    </h3>
    <dl class="space-y-2 text-sm">
      <div class="flex justify-between">
        <dt class="text-slate-500">Tunai</dt>
        <dd class="font-medium text-emerald-700">{formatRupiah(summary.byPaymentMethod.cash)}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-slate-500">QRIS</dt>
        <dd class="font-medium text-slate-700">{formatRupiah(summary.byPaymentMethod.qris)}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-slate-500">Kartu</dt>
        <dd class="font-medium text-slate-700">{formatRupiah(summary.byPaymentMethod.card)}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-slate-500">Transfer</dt>
        <dd class="font-medium text-slate-700">{formatRupiah(summary.byPaymentMethod.transfer)}</dd>
      </div>
      {#if summary.outstandingCredit > 0}
        <div class="mt-2 border-t border-slate-100 pt-2">
          <div class="flex justify-between text-xs">
            <dt class="text-amber-700">Piutang baru periode ini</dt>
            <dd class="font-semibold text-amber-700">{formatRupiah(summary.outstandingCredit)}</dd>
          </div>
        </div>
      {/if}
    </dl>

    <div class="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
      <div class="flex justify-between">
        <span class="text-slate-500">Pajak terkumpul</span>
        <span class="font-medium text-slate-700">{formatRupiah(summary.taxTotal)}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-500">Diskon promo</span>
        <span class="font-medium text-emerald-700">−{formatRupiah(summary.promoDiscountTotal)}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-500">HPP</span>
        <span class="font-medium text-slate-700">{formatRupiah(summary.cogs)}</span>
      </div>
      <div class="flex justify-between border-t border-slate-100 pt-1.5 text-sm font-semibold">
        <span class="text-slate-700">Laba kotor</span>
        <span class={summary.grossMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
          {formatRupiah(summary.grossMargin)}
        </span>
      </div>
    </div>
  </Card>
</div>

<div class="mt-4 grid gap-4 lg:grid-cols-3">
  <Card class="lg:col-span-2">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Package class="h-4 w-4 text-slate-400" />
        Produk terlaris
      </h3>
      <span class="text-xs text-slate-500">Top {tops.length}</span>
    </div>
    {#if tops.length === 0}
      <p class="py-6 text-center text-xs text-slate-500">Belum ada penjualan produk.</p>
    {:else}
      <ul class="space-y-1.5">
        {#each tops as p, i (p.productId + (p.variantId ?? ''))}
          {@const widthPct = (p.revenue / maxProductRevenue) * 100}
          <li class="flex items-center gap-2 text-xs">
            <div class="w-6 shrink-0 text-right text-slate-400">{i + 1}.</div>
            <div class="w-40 shrink-0 truncate text-slate-700" title={`${p.productName} ${p.variantName}`}>
              {p.productName}{p.variantName ? ` · ${p.variantName}` : ''}
            </div>
            <div class="relative h-5 flex-1 rounded bg-slate-50">
              <div class="h-full rounded bg-emerald-200" style="width: {widthPct}%"></div>
              <div class="absolute inset-0 flex items-center justify-between px-1.5 text-[10px] font-medium text-slate-700">
                <span>{p.qtyBase.toLocaleString('id-ID')} {fmtUnitCode(p.unitCode)}</span>
                <span>{formatRupiah(p.revenue)}</span>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>

  <Card>
    <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
      <Clock class="h-4 w-4 text-slate-400" />
      Jam paling ramai
    </h3>
    {#if summary.orderCount === 0}
      <p class="py-6 text-center text-xs text-slate-500">—</p>
    {:else}
      <div class="grid grid-cols-12 gap-0.5">
        {#each hours as h (h.hour)}
          {@const intensity = h.revenue / maxHourRevenue}
          <div
            class="aspect-square rounded text-[9px]"
            class:bg-slate-50={intensity === 0}
            class:bg-emerald-100={intensity > 0 && intensity < 0.33}
            class:bg-emerald-300={intensity >= 0.33 && intensity < 0.66}
            class:bg-emerald-500={intensity >= 0.66}
            title={`Jam ${h.hour}:00 — ${h.orderCount}× · ${formatRupiah(h.revenue)}`}
          >
            <div class="flex h-full items-center justify-center font-medium text-slate-700">
              {h.hour}
            </div>
          </div>
        {/each}
      </div>
      <p class="mt-2 text-[10px] text-slate-500">
        Warna lebih gelap = pendapatan lebih tinggi pada jam tersebut.
      </p>
    {/if}
  </Card>
</div>

{#if shiftsOn && cashiers.length > 0}
  <Card class="mt-4">
    <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
      <UserCog class="h-4 w-4 text-slate-400" />
      Per kasir
    </h3>
    <ul class="divide-y divide-slate-100">
      {#each cashiers as c (c.employeeId)}
        <li class="flex items-center justify-between gap-3 py-2 text-sm">
          <span class="font-medium text-slate-900">{employeeName(c.employeeId)}</span>
          <div class="flex items-center gap-4">
            <span class="text-xs text-slate-500">{c.orderCount}× transaksi</span>
            <span class="font-semibold text-slate-900">{formatRupiah(c.revenue)}</span>
          </div>
        </li>
      {/each}
    </ul>
  </Card>
{/if}
