<script lang="ts">
  import {
    CalendarClock,
    Clock,
    Plus,
    Search,
    UserCog,
    Wallet,
    AlertCircle,
    CheckCircle2,
    XCircle,
    ExternalLink
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
  import {
    shifts,
    salesSummary,
    shiftDurationHours,
    shiftStatusLabels,
    shiftStatusVariant,
    formatDuration,
    type ShiftSession,
    type ShiftStatus
  } from '$lib/stores/shifts.svelte';
  import { employees, roleLabels } from '$lib/stores/employees.svelte';
  import { shiftTemplates } from '$lib/stores/shiftTemplates.svelte';
  import OpenShiftModal from '$lib/components/shifts/OpenShiftModal.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let search = $state('');
  let employeeFilter = $state('');
  let statusFilter = $state<'' | ShiftStatus>('');
  let start = $state('');
  let end = $state('');

  let openModalOpen = $state(false);

  const empName = (id: string) => employees.getById(id)?.name ?? '—';
  const tplName = (id?: string) => (id ? shiftTemplates.getById(id)?.name ?? '—' : 'Bebas');

  function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return shifts.items
      .slice()
      .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
      .filter((s) => {
        if (employeeFilter && s.employeeId !== employeeFilter) return false;
        if (statusFilter && s.status !== statusFilter) return false;
        if (start && s.openedAt.slice(0, 10) < start) return false;
        if (end && s.openedAt.slice(0, 10) > end) return false;
        if (!q) return true;
        const hay = [s.code, empName(s.employeeId), tplName(s.templateId), s.notes]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
  });

  const active = $derived(shifts.active());
  const closedToday = $derived.by(() => {
    const today = new Date().toISOString().slice(0, 10);
    return shifts.items.filter(
      (s) => s.status === 'closed' && s.closedAt && s.closedAt.slice(0, 10) === today
    );
  });

  const todayCashSales = $derived.by(() => {
    let total = 0;
    for (const s of [...closedToday, ...(active ? [active] : [])]) {
      total += salesSummary(s).byMethod.cash;
    }
    return total;
  });

  const todayVariance = $derived.by(() => {
    let total = 0;
    for (const s of closedToday) total += s.variance ?? 0;
    return total;
  });

  const employeeOptions = $derived([
    { value: '', label: 'Semua pegawai' },
    ...employees
      .active()
      .map((e) => ({ value: e.id, label: `${e.name} · ${roleLabels[e.role]}` }))
  ]);

  const statusOptions = [
    { value: '', label: 'Semua status' },
    { value: 'open', label: 'Terbuka' },
    { value: 'closed', label: 'Selesai' },
    { value: 'cancelled', label: 'Dibatalkan' }
  ];

  const columns = [
    { key: 'code' as const, label: 'Kode', width: '120px' },
    { key: 'employee' as const, label: 'Kasir' },
    { key: 'template' as const, label: 'Template', width: '130px' },
    { key: 'openedAt' as const, label: 'Mulai', width: '130px' },
    { key: 'duration' as const, label: 'Lama', width: '100px' },
    { key: 'orders' as const, label: 'Pesanan', align: 'right' as const, width: '90px' },
    { key: 'cashSales' as const, label: 'Penjualan tunai', align: 'right' as const, width: '150px' },
    { key: 'variance' as const, label: 'Selisih', align: 'right' as const, width: '130px' },
    { key: 'status' as const, label: 'Status', width: '120px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '60px' }
  ];

  function varianceTone(v: number | undefined): 'emerald' | 'sky' | 'rose' | 'slate' {
    if (v === undefined) return 'slate';
    if (Math.abs(v) < 1) return 'emerald';
    return v > 0 ? 'sky' : 'rose';
  }
</script>

<svelte:head>
  <title>Shift Kasir · POS Admin</title>
</svelte:head>

<PageHeader
  title="Shift Kasir"
  description="Catat shift kasir, kas masuk/keluar, dan rekap penjualan per shift."
  breadcrumb={[{ label: 'Operasional' }, { label: 'Shift Kasir' }]}
>
  {#snippet actions()}
    {#if active}
      <Button href="/shifts/{active.id}" variant="outline">
        <ExternalLink class="h-4 w-4" />
        Buka shift aktif
      </Button>
    {:else}
      <Button onclick={() => (openModalOpen = true)}>
        <Plus class="h-4 w-4" />
        Buka shift
      </Button>
    {/if}
  {/snippet}
</PageHeader>

{#if active}
  {@const summary = salesSummary(active)}
  <div
    class="mb-4 rounded-card border-2 border-emerald-200 bg-emerald-50 px-4 py-3"
  >
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Clock class="h-5 w-5" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-slate-900">{empName(active.employeeId)}</span>
          <Badge variant="success" size="sm" dot>Shift terbuka</Badge>
        </div>
        <div class="mt-0.5 text-xs text-slate-600">
          {active.code} · {tplName(active.templateId)} · mulai {fmtDateTime(active.openedAt)} ·
          {formatDuration(shiftDurationHours(active))} berjalan ·
          {summary.orderCount} pesanan ({formatRupiah(summary.byMethod.cash)} tunai)
        </div>
      </div>
      <Button href="/shifts/{active.id}" size="sm">Kelola shift</Button>
    </div>
  </div>
{/if}

<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard
    label="Shift aktif"
    value={active ? '1' : '0'}
    icon={Clock}
    accent={active ? 'emerald' : 'brand'}
  />
  <StatCard
    label="Shift selesai hari ini"
    value={closedToday.length.toString()}
    icon={CheckCircle2}
    accent="sky"
  />
  <StatCard
    label="Tunai masuk hari ini"
    value={formatRupiah(todayCashSales)}
    icon={Wallet}
    accent="emerald"
  />
  <StatCard
    label="Selisih hari ini"
    value={formatRupiah(todayVariance)}
    icon={AlertCircle}
    accent={Math.abs(todayVariance) < 1 ? 'emerald' : todayVariance > 0 ? 'sky' : 'rose'}
  />
</div>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari kode, pegawai, template…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={employeeFilter} options={employeeOptions} class="w-52" />
    <Select bind:value={statusFilter} options={statusOptions} class="w-40" />
    <Input type="date" bind:value={start} class="w-44" />
    <span class="text-xs text-slate-400">s/d</span>
    <Input type="date" bind:value={end} class="w-44" />
  </div>

  <Table {columns} rows={filtered} rowKey={(s) => s.id}>
    {#snippet cell({ row, column })}
      {@const summary = salesSummary(row)}
      {#if column.key === 'code'}
        <a href="/shifts/{row.id}" class="font-medium text-brand-700 hover:underline">
          {row.code}
        </a>
      {:else if column.key === 'employee'}
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserCog class="h-3.5 w-3.5" />
          </div>
          <div class="min-w-0">
            <div class="truncate text-sm font-medium text-slate-900">{empName(row.employeeId)}</div>
          </div>
        </div>
      {:else if column.key === 'template'}
        {#if row.templateId}
          {@const tpl = shiftTemplates.getById(row.templateId)}
          {#if tpl}
            <div class="text-sm">
              <div class="font-medium text-slate-700">{tpl.name}</div>
              <div class="text-xs text-slate-500">{tpl.startTime}–{tpl.endTime}</div>
            </div>
          {:else}
            <span class="text-xs text-slate-400">—</span>
          {/if}
        {:else}
          <span class="text-xs text-slate-500">Bebas</span>
        {/if}
      {:else if column.key === 'openedAt'}
        <span class="text-sm text-slate-700">{fmtDateTime(row.openedAt)}</span>
      {:else if column.key === 'duration'}
        <span class="text-sm text-slate-700">
          {formatDuration(shiftDurationHours(row))}
        </span>
      {:else if column.key === 'orders'}
        <span class="text-sm font-medium text-slate-700">{summary.orderCount}</span>
      {:else if column.key === 'cashSales'}
        <span class="text-sm font-medium text-slate-900">
          {formatRupiah(summary.byMethod.cash)}
        </span>
      {:else if column.key === 'variance'}
        {#if row.status === 'closed' && row.variance !== undefined}
          {@const tone = varianceTone(row.variance)}
          <span
            class="text-sm font-medium {tone === 'emerald'
              ? 'text-emerald-700'
              : tone === 'sky'
              ? 'text-sky-700'
              : tone === 'rose'
              ? 'text-rose-700'
              : 'text-slate-500'}"
          >
            {row.variance > 0 ? '+' : ''}{formatRupiah(row.variance)}
          </span>
        {:else}
          <span class="text-xs text-slate-400">—</span>
        {/if}
      {:else if column.key === 'status'}
        <Badge variant={shiftStatusVariant[row.status]} size="sm" dot>
          {shiftStatusLabels[row.status]}
        </Badge>
      {:else if column.key === 'actions'}
        <a
          href="/shifts/{row.id}"
          class="inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Detail"
        >
          <ExternalLink class="h-4 w-4" />
        </a>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-8">
        <CalendarClock class="h-8 w-8 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Belum ada shift</p>
        <p class="text-xs text-slate-400">Klik "Buka shift" untuk memulai.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<OpenShiftModal bind:open={openModalOpen} />
