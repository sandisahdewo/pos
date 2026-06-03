<script lang="ts">
  import { ArrowDownCircle, ArrowUpCircle } from 'lucide-svelte';
  import {
    Alert,
    Button,
    Modal,
    MoneyInput,
    Select,
    Textarea
  } from '$lib/components/ui';
  import {
    cashEntryCategoryLabels,
    cashInCategories,
    cashOutCategories,
    shifts,
    type CashEntryCategory,
    type CashEntryKind,
    type ShiftSession
  } from '$lib/stores/shifts.svelte';
  import { employees } from '$lib/stores/employees.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type Props = {
    open: boolean;
    shift: ShiftSession | undefined;
  };

  let { open = $bindable(false), shift }: Props = $props();

  let kind = $state<CashEntryKind>('out');
  let category = $state<CashEntryCategory>('beli-bahan');
  let amount = $state(0);
  let notes = $state('');
  let error = $state<string | null>(null);

  $effect(() => {
    if (open) {
      kind = 'out';
      category = 'beli-bahan';
      amount = 0;
      notes = '';
      error = null;
    }
  });

  $effect(() => {
    const allowed = kind === 'in' ? cashInCategories : cashOutCategories;
    if (!allowed.includes(category)) {
      category = allowed[0];
    }
  });

  const categoryOptions = $derived(
    (kind === 'in' ? cashInCategories : cashOutCategories).map((c) => ({
      value: c,
      label: cashEntryCategoryLabels[c]
    }))
  );

  async function submit() {
    if (!shift) return;
    error = null;
    if (amount <= 0) {
      error = 'Jumlah harus lebih dari nol.';
      return;
    }
    const performer = employees.getById(shift.employeeId)?.name ?? 'Kasir';
    const res = await shifts.addEntry(shift.id, {
      kind,
      category,
      amount,
      notes,
      performedBy: performer
    });
    if (!res.ok) {
      error = res.reason;
      return;
    }
    toast.success(
      `${kind === 'in' ? 'Kas masuk' : 'Kas keluar'} dicatat`,
      `${formatRupiah(amount)} · ${cashEntryCategoryLabels[category]}`
    );
    open = false;
  }
</script>

<Modal
  bind:open
  size="md"
  title="Catat kas masuk / keluar"
  description="Pengeluaran operasional (beli es, gas, parkir) atau tambahan kas (modal, setoran)."
>
  {#if shift}
    <div class="space-y-4">
      {#if error}
        <Alert variant="error" title="Tidak bisa menyimpan">{error}</Alert>
      {/if}

      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition {kind ===
          'in'
            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}"
          onclick={() => (kind = 'in')}
        >
          <ArrowDownCircle class="h-5 w-5" />
          <span class="text-sm font-medium">Kas masuk</span>
          <span class="text-[11px] text-slate-500">Modal tambahan, setoran</span>
        </button>
        <button
          type="button"
          class="flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition {kind ===
          'out'
            ? 'border-rose-500 bg-rose-50 text-rose-800'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}"
          onclick={() => (kind = 'out')}
        >
          <ArrowUpCircle class="h-5 w-5" />
          <span class="text-sm font-medium">Kas keluar</span>
          <span class="text-[11px] text-slate-500">Beli bahan, operasional</span>
        </button>
      </div>

      <Select label="Kategori" bind:value={category} options={categoryOptions} />

      <MoneyInput label="Jumlah" bind:value={amount} />

      <Textarea
        label="Keterangan (opsional)"
        placeholder="mis. Beli es batu 2 plastik"
        bind:value={notes}
      />
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (open = false)}>Batal</Button>
    <Button onclick={submit}>Catat</Button>
  {/snippet}
</Modal>
