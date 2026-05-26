<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    ArrowLeft,
    ArrowDownCircle,
    ArrowUpCircle,
    Banknote,
    CalendarClock,
    Clock,
    LogOut,
    Plus,
    Receipt,
    Trash2,
    UserCog,
    Wallet,
    XCircle,
    AlertCircle
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    PageHeader
  } from '$lib/components/ui';
  import {
    shifts,
    salesSummary,
    expectedClosingCash,
    shiftDurationHours,
    shiftStatusLabels,
    shiftStatusVariant,
    formatDuration,
    cashEntryCategoryLabels
  } from '$lib/stores/shifts.svelte';
  import { employees, roleLabelFor } from '$lib/stores/employees.svelte';
  import {
    shiftTemplates,
    plannedDurationHours
  } from '$lib/stores/shiftTemplates.svelte';
  import { orders } from '$lib/stores/orders.svelte';
  import CashEntryModal from '$lib/components/shifts/CashEntryModal.svelte';
  import CloseShiftModal from '$lib/components/shifts/CloseShiftModal.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const id = $derived(page.params.id ?? '');
  const shift = $derived(shifts.getById(id));
  const employee = $derived(shift ? employees.getById(shift.employeeId) : undefined);
  const template = $derived(shift?.templateId ? shiftTemplates.getById(shift.templateId) : undefined);
  const summary = $derived(shift ? salesSummary(shift) : undefined);
  const expected = $derived(shift ? expectedClosingCash(shift) : 0);

  const shiftOrders = $derived.by(() => {
    if (!shift) return [];
    const start = new Date(shift.openedAt).getTime();
    const end = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();
    return orders.items
      .filter((o) => {
        if (o.status === 'cancelled') return false;
        if (o.shiftId && o.shiftId !== shift.id) return false;
        const t = new Date(o.createdAt).getTime();
        return !Number.isNaN(t) && t >= start && t <= end;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  });

  const entryTimeline = $derived.by(() => {
    if (!shift) return [];
    return [...shift.entries].sort((a, b) => (a.at < b.at ? 1 : -1));
  });

  let entryModalOpen = $state(false);
  let closeModalOpen = $state(false);
  let cancelConfirmOpen = $state(false);
  let deleteEntryConfirmOpen = $state(false);
  let pendingDeleteEntryId = $state<string | null>(null);

  function fmtDateTime(iso: string): string {
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

  function fmtTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function doCancel() {
    if (!shift) return;
    const res = shifts.cancel(shift.id);
    if (!res.ok) {
      toast.error('Gagal membatalkan', res.reason ?? '');
      return;
    }
    toast.success('Shift dibatalkan');
    cancelConfirmOpen = false;
  }

  function doDeleteEntry() {
    if (!shift || !pendingDeleteEntryId) return;
    const res = shifts.removeEntry(shift.id, pendingDeleteEntryId);
    if (!res.ok) {
      toast.error('Gagal menghapus', res.reason ?? '');
    } else {
      toast.success('Catatan kas dihapus');
    }
    pendingDeleteEntryId = null;
  }
</script>

<svelte:head>
  <title>{shift?.code ?? 'Shift'} · POS Admin</title>
</svelte:head>

{#if !shift}
  <div class="rounded-card border border-slate-200 bg-white p-8 text-center">
    <h2 class="text-lg font-semibold text-slate-900">Shift tidak ditemukan</h2>
    <p class="mt-1 text-sm text-slate-500">Mungkin sudah dihapus atau kode salah.</p>
    <Button class="mt-4" variant="outline" onclick={() => goto('/shifts')}>
      <ArrowLeft class="h-4 w-4" />
      Kembali ke daftar shift
    </Button>
  </div>
{:else if summary}
  <PageHeader
    title={shift.code}
    description="Detail shift kasir, catatan kas masuk/keluar, dan rekap penjualan."
    breadcrumb={[
      { label: 'Operasional' },
      { label: 'Shift Kasir', href: '/shifts' },
      { label: shift.code }
    ]}
  >
    {#snippet actions()}
      {#if shift.status === 'open'}
        <Button variant="outline" onclick={() => (entryModalOpen = true)}>
          <Plus class="h-4 w-4" />
          Tambah kas
        </Button>
        <Button variant="outline" onclick={() => (cancelConfirmOpen = true)}>
          <XCircle class="h-4 w-4" />
          Batalkan
        </Button>
        <Button onclick={() => (closeModalOpen = true)}>
          <LogOut class="h-4 w-4" />
          Tutup shift
        </Button>
      {:else}
        <Button variant="outline" href="/shifts">
          <ArrowLeft class="h-4 w-4" />
          Kembali
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <Card class="mb-4">
    <div class="flex flex-wrap items-start gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <UserCog class="h-6 w-6" />
      </div>
      <div class="flex-1 min-w-[200px]">
        <div class="flex items-center gap-2">
          <h2 class="text-lg font-semibold text-slate-900">{employee?.name ?? '—'}</h2>
          <Badge variant="outline" size="sm">
            {employee ? roleLabelFor(employee) : '—'}
          </Badge>
          <Badge variant={shiftStatusVariant[shift.status]} size="sm" dot>
            {shiftStatusLabels[shift.status]}
          </Badge>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span class="flex items-center gap-1">
            <CalendarClock class="h-3.5 w-3.5" />
            {template
              ? `${template.name} (${template.startTime}–${template.endTime} · ${plannedDurationHours(template)} jam)`
              : 'Bebas'}
          </span>
          <span class="flex items-center gap-1">
            <Clock class="h-3.5 w-3.5" />
            Mulai {fmtDateTime(shift.openedAt)}
          </span>
          {#if shift.closedAt}
            <span class="flex items-center gap-1">
              <Clock class="h-3.5 w-3.5" />
              Selesai {fmtDateTime(shift.closedAt)}
            </span>
          {/if}
          <span>· {formatDuration(shiftDurationHours(shift))}</span>
        </div>
        {#if shift.notes}
          <p class="mt-2 text-sm text-slate-600">{shift.notes}</p>
        {/if}
      </div>
    </div>
  </Card>

  <div class="grid gap-4 lg:grid-cols-3">
    <Card class="lg:col-span-2">
      <h3 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Catatan kas
      </h3>
      <dl class="grid grid-cols-2 gap-y-2 text-sm">
        <dt class="flex items-center gap-2 text-slate-500">
          <Wallet class="h-4 w-4 text-slate-400" />
          Kas awal
        </dt>
        <dd class="text-right font-medium text-slate-900">
          {formatRupiah(shift.openingCash.total)}
        </dd>

        <dt class="flex items-center gap-2 text-slate-500">
          <Banknote class="h-4 w-4 text-emerald-500" />
          Penjualan tunai ({summary.orderCount} pesanan)
        </dt>
        <dd class="text-right font-medium text-emerald-700">
          +{formatRupiah(summary.byMethod.cash)}
        </dd>

        {#each entryTimeline as e (e.id)}
          <dt class="flex items-center gap-2 text-slate-500">
            {#if e.kind === 'in'}
              <ArrowDownCircle class="h-4 w-4 text-emerald-500" />
            {:else}
              <ArrowUpCircle class="h-4 w-4 text-rose-500" />
            {/if}
            <span class="truncate">
              {cashEntryCategoryLabels[e.category]}
              {#if e.notes}
                <span class="text-slate-400"> · {e.notes}</span>
              {/if}
              <span class="ml-1 text-xs text-slate-400">{fmtTime(e.at)}</span>
            </span>
          </dt>
          <dd class="flex items-center justify-end gap-2">
            <span class="font-medium {e.kind === 'in' ? 'text-emerald-700' : 'text-rose-700'}">
              {e.kind === 'in' ? '+' : '−'}{formatRupiah(e.amount)}
            </span>
            {#if shift.status === 'open'}
              <button
                type="button"
                class="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Hapus catatan"
                onclick={() => {
                  pendingDeleteEntryId = e.id;
                  deleteEntryConfirmOpen = true;
                }}
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            {/if}
          </dd>
        {/each}

        <dt class="col-span-2 my-1 border-t border-slate-200"></dt>

        <dt class="text-sm font-semibold text-slate-700">Kas seharusnya</dt>
        <dd class="text-right text-base font-bold text-slate-900">
          {formatRupiah(expected)}
        </dd>

        {#if shift.status === 'closed' && shift.closingCash}
          <dt class="text-sm text-slate-500">Kas akhir dihitung</dt>
          <dd class="text-right font-medium text-slate-900">
            {formatRupiah(shift.closingCash.total)}
          </dd>

          <dt class="text-sm font-semibold text-slate-700">Selisih</dt>
          <dd class="text-right">
            <span
              class="text-base font-bold {Math.abs(shift.variance ?? 0) < 1
                ? 'text-emerald-700'
                : (shift.variance ?? 0) > 0
                ? 'text-sky-700'
                : 'text-rose-700'}"
            >
              {(shift.variance ?? 0) > 0 ? '+' : ''}{formatRupiah(shift.variance ?? 0)}
            </span>
          </dd>
        {/if}
      </dl>

      {#if shift.status === 'open' && entryTimeline.length === 0}
        <div class="mt-4 rounded-md border border-dashed border-slate-200 p-4 text-center">
          <p class="text-xs text-slate-500">
            Belum ada catatan kas tambahan. Klik "Tambah kas" untuk mencatat pengeluaran (beli es, gas, dll.) atau setoran modal.
          </p>
        </div>
      {/if}
    </Card>

    <Card>
      <h3 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Rekap penjualan
      </h3>
      <dl class="space-y-1.5 text-sm">
        <div class="flex items-baseline justify-between">
          <dt class="text-slate-500">Jumlah pesanan</dt>
          <dd class="font-semibold text-slate-900">{summary.orderCount}</dd>
        </div>
        <div class="flex items-baseline justify-between">
          <dt class="text-slate-500">Total bruto</dt>
          <dd class="font-semibold text-slate-900">{formatRupiah(summary.grossTotal)}</dd>
        </div>
        <div class="my-1 border-t border-slate-100"></div>
        <div class="flex items-baseline justify-between">
          <dt class="text-slate-500">Tunai</dt>
          <dd class="font-medium text-emerald-700">{formatRupiah(summary.byMethod.cash)}</dd>
        </div>
        <div class="flex items-baseline justify-between">
          <dt class="text-slate-500">QRIS</dt>
          <dd class="font-medium text-slate-700">{formatRupiah(summary.byMethod.qris)}</dd>
        </div>
        <div class="flex items-baseline justify-between">
          <dt class="text-slate-500">Kartu</dt>
          <dd class="font-medium text-slate-700">{formatRupiah(summary.byMethod.card)}</dd>
        </div>
        <div class="flex items-baseline justify-between">
          <dt class="text-slate-500">Transfer</dt>
          <dd class="font-medium text-slate-700">{formatRupiah(summary.byMethod.transfer)}</dd>
        </div>
        {#if summary.outstandingCredit > 0}
          <div class="my-1 border-t border-slate-100"></div>
          <div class="flex items-baseline justify-between text-amber-700">
            <dt class="flex items-center gap-1 font-medium">
              <AlertCircle class="h-3.5 w-3.5" />
              Piutang baru
            </dt>
            <dd class="font-semibold">{formatRupiah(summary.outstandingCredit)}</dd>
          </div>
        {/if}
      </dl>
    </Card>
  </div>

  {#if shiftOrders.length > 0}
    <Card class="mt-4" padded={false}>
      <div class="border-b border-slate-100 px-4 py-3">
        <h3 class="text-sm font-semibold text-slate-700">Pesanan dalam shift ini</h3>
      </div>
      <ul class="divide-y divide-slate-100">
        {#each shiftOrders as o (o.id)}
          <li class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
            <Receipt class="h-4 w-4 text-slate-400" />
            <a href="/orders" class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-slate-900">{o.code}</span>
                <Badge
                  variant={o.status === 'paid' ? 'success' : o.status === 'credit' ? 'warning' : 'neutral'}
                  size="sm"
                  dot
                >
                  {o.status === 'paid' ? 'Lunas' : o.status === 'credit' ? 'Piutang' : 'Batal'}
                </Badge>
              </div>
              <div class="mt-0.5 text-xs text-slate-500">
                {fmtTime(o.createdAt)} · {o.lines.length} item · {o.paymentMethod}
              </div>
            </a>
            <span class="font-medium text-slate-900">{formatRupiah(o.total)}</span>
          </li>
        {/each}
      </ul>
    </Card>
  {/if}
{/if}

{#if shift}
  <CashEntryModal bind:open={entryModalOpen} {shift} />
  <CloseShiftModal bind:open={closeModalOpen} {shift} />
{/if}

<ConfirmDialog
  bind:open={cancelConfirmOpen}
  title="Batalkan shift?"
  message="Shift akan ditandai dibatalkan tanpa rekonsiliasi kas. Pesanan yang sudah tercatat tetap ada."
  confirmLabel="Batalkan shift"
  variant="danger"
  onConfirm={doCancel}
/>

<ConfirmDialog
  bind:open={deleteEntryConfirmOpen}
  title="Hapus catatan kas?"
  message="Catatan ini akan dihapus dari shift. Tidak bisa dibatalkan."
  confirmLabel="Hapus"
  variant="danger"
  onConfirm={doDeleteEntry}
  onCancel={() => (pendingDeleteEntryId = null)}
/>
