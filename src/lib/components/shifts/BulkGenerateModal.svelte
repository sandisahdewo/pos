<script lang="ts">
  import { CalendarRange, Plus, Trash2, Wand2, Copy } from 'lucide-svelte';
  import {
    Alert,
    Button,
    Checkbox,
    Input,
    Modal,
    Select,
    Textarea
  } from '$lib/components/ui';
  import {
    shiftSchedule,
    addDays,
    toISODate,
    parseISODate,
    dayOfWeekLabels,
    type WeekdayPattern
  } from '$lib/stores/shiftSchedule.svelte';
  import { shiftTemplates } from '$lib/stores/shiftTemplates.svelte';
  import { employees, roleLabels } from '$lib/stores/employees.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  type Props = {
    open: boolean;
    defaultStart?: string;
  };

  let { open = $bindable(false), defaultStart }: Props = $props();

  function today(): string {
    return toISODate(new Date());
  }

  let startDate = $state(today());
  let endDate = $state(toISODate(addDays(parseISODate(today()), 6)));
  let notes = $state('');
  let skipExisting = $state(true);
  let error = $state<string | null>(null);

  // Pattern keyed by day-of-week 0..6 (Sun..Sat); slots are appended.
  let pattern = $state<Record<number, WeekdayPattern[]>>({
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: []
  });

  $effect(() => {
    if (open) {
      const start = defaultStart ?? today();
      startDate = start;
      endDate = toISODate(addDays(parseISODate(start), 6));
      notes = '';
      skipExisting = true;
      error = null;
      pattern = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    }
  });

  const templateOptions = $derived([
    { value: '', label: 'Pilih template…' },
    ...shiftTemplates
      .active()
      .map((t) => ({ value: t.id, label: `${t.name} ${t.startTime}–${t.endTime}` }))
  ]);

  const employeeOptions = $derived([
    { value: '', label: 'Pilih pegawai…' },
    ...employees
      .active()
      .map((e) => ({ value: e.id, label: `${e.name} (${roleLabels[e.role]})` }))
  ]);

  // Days of week ordered Senin → Minggu (matching Indonesian week start).
  const dowOrdered = [1, 2, 3, 4, 5, 6, 0] as const;

  function addSlot(dow: number) {
    pattern[dow] = [...pattern[dow], { templateId: '', employeeId: '' }];
  }

  function removeSlot(dow: number, idx: number) {
    pattern[dow] = pattern[dow].filter((_, i) => i !== idx);
  }

  function copyToAll(dow: number) {
    const slots = pattern[dow];
    if (slots.length === 0) return;
    for (const k of [0, 1, 2, 3, 4, 5, 6]) {
      pattern[k] = slots.map((s) => ({ ...s }));
    }
    toast.info('Pola disalin', `Pola ${dayOfWeekLabels[dow]} diterapkan ke semua hari.`);
  }

  function quickRange(unit: 'week' | 'month' | 'year') {
    const start = parseISODate(startDate);
    let end: Date;
    if (unit === 'week') end = addDays(start, 6);
    else if (unit === 'month') {
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
    } else {
      end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
    }
    endDate = toISODate(end);
  }

  const totalSlots = $derived(
    Object.values(pattern).reduce((sum, slots) => sum + slots.length, 0)
  );

  function generate() {
    error = null;
    if (!startDate || !endDate) {
      error = 'Tanggal mulai dan selesai wajib diisi.';
      return;
    }
    if (endDate < startDate) {
      error = 'Tanggal selesai tidak boleh sebelum mulai.';
      return;
    }
    if (totalSlots === 0) {
      error = 'Belum ada slot. Tambah minimal satu pola untuk hari tertentu.';
      return;
    }
    // Trim invalid slots from pattern before sending.
    const cleanedPattern: Record<number, WeekdayPattern[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const k of [0, 1, 2, 3, 4, 5, 6]) {
      cleanedPattern[k] = pattern[k].filter((s) => s.templateId && s.employeeId);
    }
    const totalCleaned = Object.values(cleanedPattern).reduce((s, arr) => s + arr.length, 0);
    if (totalCleaned === 0) {
      error = 'Setiap slot harus punya template dan pegawai.';
      return;
    }

    const res = shiftSchedule.bulkGenerate({
      startDate,
      endDate,
      pattern: cleanedPattern,
      skipExisting,
      notes
    });
    const parts = [`${res.created.length} jadwal dibuat`];
    if (res.skipped > 0) parts.push(`${res.skipped} dilewati (sudah ada)`);
    if (res.invalid > 0) parts.push(`${res.invalid} slot tidak valid`);
    toast.success('Jadwal dibuat', parts.join(' · '));
    open = false;
  }
</script>

<Modal
  bind:open
  size="xl"
  title="Buat jadwal massal"
  description="Pilih rentang tanggal dan pola per-hari. Sistem akan generate jadwal sesuai pola."
>
  <div class="space-y-5">
    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    <section>
      <h3 class="mb-2 text-sm font-semibold text-slate-900">Rentang tanggal</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <Input label="Tanggal mulai" type="date" bind:value={startDate} />
        <Input label="Tanggal selesai" type="date" bind:value={endDate} />
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <span class="text-xs text-slate-500">Cepat:</span>
        <button
          type="button"
          class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          onclick={() => quickRange('week')}
        >
          +1 minggu
        </button>
        <button
          type="button"
          class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          onclick={() => quickRange('month')}
        >
          +1 bulan
        </button>
        <button
          type="button"
          class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          onclick={() => quickRange('year')}
        >
          +1 tahun
        </button>
      </div>
    </section>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-slate-900">Pola per hari</h3>
      <p class="mb-3 text-xs text-slate-500">
        Tambah slot untuk hari yang ingin dijadwalkan. Hari tanpa slot akan dilewati.
      </p>

      <div class="space-y-2">
        {#each dowOrdered as dow}
          <div class="rounded-lg border border-slate-200 p-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-slate-900">{dayOfWeekLabels[dow]}</span>
                {#if pattern[dow].length > 0}
                  <span
                    class="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700"
                  >
                    {pattern[dow].length} slot
                  </span>
                {/if}
              </div>
              <div class="flex items-center gap-1">
                {#if pattern[dow].length > 0}
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    onclick={() => copyToAll(dow)}
                    title="Salin pola hari ini ke semua hari"
                  >
                    <Copy class="h-3 w-3" />
                    Tiru ke semua
                  </button>
                {/if}
                <button
                  type="button"
                  class="flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700"
                  onclick={() => addSlot(dow)}
                >
                  <Plus class="h-3 w-3" />
                  Tambah slot
                </button>
              </div>
            </div>

            {#if pattern[dow].length > 0}
              <div class="mt-2 space-y-2">
                {#each pattern[dow] as slot, idx (idx)}
                  <div class="grid gap-2 sm:grid-cols-[1fr_1fr_36px]">
                    <Select bind:value={slot.templateId} options={templateOptions} />
                    <Select bind:value={slot.employeeId} options={employeeOptions} />
                    <button
                      type="button"
                      class="flex items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Hapus slot"
                      onclick={() => removeSlot(dow, idx)}
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <section>
      <Checkbox
        bind:checked={skipExisting}
        label="Lewati jadwal yang sudah ada"
        description="Jika tanggal + template + pegawai sudah punya jadwal, slot akan dilewati."
      />
      <Textarea
        class="mt-3"
        label="Catatan (opsional)"
        placeholder="mis. Jadwal rutin bulan Mei."
        bind:value={notes}
      />
    </section>
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (open = false)}>Batal</Button>
    <Button onclick={generate}>
      <Wand2 class="h-4 w-4" />
      Generate ({totalSlots} pola)
    </Button>
  {/snippet}
</Modal>
