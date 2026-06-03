<script lang="ts">
  import { LogOut, AlertTriangle } from 'lucide-svelte';
  import { Alert, Button, Modal, Textarea } from '$lib/components/ui';
  import CashCountInput from './CashCountInput.svelte';
  import {
    expectedClosingCash,
    salesSummary,
    shifts,
    type CashCount,
    type ShiftSession
  } from '$lib/stores/shifts.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type Props = {
    open: boolean;
    shift: ShiftSession | undefined;
    onClosed?: (shiftId: string) => void;
  };

  let { open = $bindable(false), shift, onClosed }: Props = $props();

  let closingCash = $state<CashCount>({ total: 0 });
  let notes = $state('');
  let error = $state<string | null>(null);

  const expected = $derived(shift ? expectedClosingCash(shift) : 0);
  const variance = $derived(closingCash.total - expected);
  const summary = $derived(shift ? salesSummary(shift) : undefined);
  const warnThreshold = $derived(settings.value.operations.shiftRules.varianceWarnThreshold);
  const exceedsThreshold = $derived(
    warnThreshold > 0 && Math.abs(variance) > warnThreshold
  );

  $effect(() => {
    if (open && shift) {
      closingCash = { total: 0 };
      notes = shift.notes ?? '';
      error = null;
    }
  });

  async function submit() {
    if (!shift) return;
    error = null;
    const res = await shifts.close(shift.id, { closingCash, notes });
    if (!res.ok) {
      error = res.reason;
      return;
    }
    const v = res.shift.variance ?? 0;
    if (Math.abs(v) > 0) {
      toast.warning(
        'Shift ditutup dengan selisih',
        `${v > 0 ? '+' : ''}${formatRupiah(v)} terhadap kas yang seharusnya.`
      );
    } else {
      toast.success('Shift ditutup', 'Kas akhir sesuai dengan perhitungan.');
    }
    open = false;
    onClosed?.(res.shift.id);
  }
</script>

<Modal
  bind:open
  size="lg"
  title="Tutup shift"
  description="Hitung kas di laci, sistem akan bandingkan dengan kas yang seharusnya."
>
  {#if shift && summary}
    <div class="space-y-4">
      {#if error}
        <Alert variant="error" title="Tidak bisa menutup shift">{error}</Alert>
      {/if}

      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 class="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Ringkasan shift
        </h3>
        <dl class="grid grid-cols-2 gap-2 text-sm">
          <dt class="text-slate-500">Kas awal</dt>
          <dd class="text-right font-medium text-slate-900">{formatRupiah(shift.openingCash.total)}</dd>

          <dt class="text-slate-500">Penjualan tunai</dt>
          <dd class="text-right font-medium text-emerald-700">+{formatRupiah(summary.byMethod.cash)}</dd>

          {#each shift.entries as e (e.id)}
            <dt class="truncate text-slate-500">
              {e.kind === 'in' ? 'Kas masuk' : 'Kas keluar'}
              {#if e.notes}
                <span class="text-slate-400"> · {e.notes}</span>
              {/if}
            </dt>
            <dd class="text-right font-medium {e.kind === 'in' ? 'text-emerald-700' : 'text-rose-700'}">
              {e.kind === 'in' ? '+' : '−'}{formatRupiah(e.amount)}
            </dd>
          {/each}

          <dt class="col-span-2 my-1 border-t border-slate-200"></dt>

          <dt class="font-semibold text-slate-700">Seharusnya</dt>
          <dd class="text-right font-bold text-slate-900">{formatRupiah(expected)}</dd>
        </dl>

        {#if summary.byMethod.card + summary.byMethod.qris + summary.byMethod.transfer > 0}
          <div class="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
            <span class="font-medium text-slate-600">Penjualan non-tunai (tidak masuk laci):</span>
            {summary.byMethod.qris > 0 ? ` QRIS ${formatRupiah(summary.byMethod.qris)}` : ''}
            {summary.byMethod.card > 0 ? ` Kartu ${formatRupiah(summary.byMethod.card)}` : ''}
            {summary.byMethod.transfer > 0 ? ` Transfer ${formatRupiah(summary.byMethod.transfer)}` : ''}
          </div>
        {/if}
      </div>

      <CashCountInput
        bind:value={closingCash}
        label="Kas akhir (hasil hitung manual)"
        hint="Hitung total uang tunai di laci kasir sekarang."
      />

      <div
        class="rounded-lg border p-3 {Math.abs(variance) < 1
          ? 'border-emerald-200 bg-emerald-50'
          : variance > 0
          ? 'border-sky-200 bg-sky-50'
          : 'border-rose-200 bg-rose-50'}"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-semibold tracking-wide uppercase {Math.abs(variance) < 1
              ? 'text-emerald-700'
              : variance > 0
              ? 'text-sky-700'
              : 'text-rose-700'}"
          >
            Selisih
          </span>
          <span
            class="text-lg font-bold {Math.abs(variance) < 1
              ? 'text-emerald-800'
              : variance > 0
              ? 'text-sky-800'
              : 'text-rose-800'}"
          >
            {variance > 0 ? '+' : ''}{formatRupiah(variance)}
          </span>
        </div>
        {#if Math.abs(variance) >= 1}
          <p class="mt-1 flex items-start gap-1.5 text-xs {variance > 0 ? 'text-sky-700' : 'text-rose-700'}">
            <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {#if variance > 0}
              Kas di laci lebih banyak dari yang seharusnya. Mungkin ada penerimaan yang belum tercatat.
            {:else}
              Kas di laci kurang dari yang seharusnya. Periksa pengeluaran yang belum tercatat atau kemungkinan selisih.
            {/if}
          </p>
        {/if}
        {#if exceedsThreshold}
          <p class="mt-1.5 text-xs font-semibold text-rose-700">
            Selisih melebihi ambang wajar ({formatRupiah(warnThreshold)}). Mohon periksa ulang
            sebelum menutup shift.
          </p>
        {/if}
      </div>

      <Textarea
        label="Catatan tutup shift (opsional)"
        placeholder="mis. Selisih karena kembalian belum tercatat."
        bind:value={notes}
      />
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (open = false)}>Batal</Button>
    <Button onclick={submit}>
      <LogOut class="h-4 w-4" />
      Tutup shift
    </Button>
  {/snippet}
</Modal>
