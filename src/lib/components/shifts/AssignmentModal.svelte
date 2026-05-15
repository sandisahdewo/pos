<script lang="ts">
  import { Trash2 } from 'lucide-svelte';
  import {
    Alert,
    Badge,
    Button,
    Modal,
    Select,
    Textarea
  } from '$lib/components/ui';
  import {
    shiftSchedule,
    type ShiftAssignment
  } from '$lib/stores/shiftSchedule.svelte';
  import { shiftTemplates } from '$lib/stores/shiftTemplates.svelte';
  import { employees, roleLabels } from '$lib/stores/employees.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  type Props = {
    open: boolean;
    date: string;
    editing?: ShiftAssignment;
  };

  let { open = $bindable(false), date, editing }: Props = $props();

  let templateId = $state('');
  let employeeId = $state('');
  let notes = $state('');
  let error = $state<string | null>(null);

  $effect(() => {
    if (open) {
      templateId = editing?.templateId ?? '';
      employeeId = editing?.employeeId ?? '';
      notes = editing?.notes ?? '';
      error = null;
    }
  });

  const templateOptions = $derived([
    { value: '', label: 'Pilih template…' },
    ...shiftTemplates
      .active()
      .map((t) => ({ value: t.id, label: `${t.name} (${t.startTime}–${t.endTime})` }))
  ]);

  const employeeOptions = $derived([
    { value: '', label: 'Pilih pegawai…' },
    ...employees
      .active()
      .map((e) => ({ value: e.id, label: `${e.name} · ${roleLabels[e.role]}` }))
  ]);

  function fmtLongDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function submit() {
    error = null;
    if (!templateId) {
      error = 'Pilih template shift.';
      return;
    }
    if (!employeeId) {
      error = 'Pilih pegawai.';
      return;
    }
    if (editing) {
      shiftSchedule.update(editing.id, { templateId, employeeId, notes });
      toast.success('Jadwal diperbarui');
    } else {
      shiftSchedule.add({ date, templateId, employeeId, notes });
      toast.success('Jadwal ditambahkan');
    }
    open = false;
  }

  function doDelete() {
    if (!editing) return;
    shiftSchedule.remove(editing.id);
    toast.success('Jadwal dihapus');
    open = false;
  }
</script>

<Modal
  bind:open
  size="md"
  title={editing ? 'Ubah jadwal' : 'Tambah jadwal'}
  description={fmtLongDate(date)}
>
  <div class="space-y-4">
    {#if error}
      <Alert variant="error">{error}</Alert>
    {/if}

    {#if editing?.actualShiftId}
      <Alert variant="info" title="Sudah terhubung ke shift">
        Jadwal ini sudah dipakai untuk membuka shift sungguhan. Mengubah penjadwalan tidak akan mengubah shift yang sudah berjalan.
      </Alert>
    {/if}

    <Select label="Template shift" bind:value={templateId} options={templateOptions} />
    <Select label="Pegawai" bind:value={employeeId} options={employeeOptions} />
    <Textarea
      label="Catatan (opsional)"
      placeholder="mis. Tukar shift dengan Andi"
      bind:value={notes}
    />

    {#if editing}
      <div class="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Status:
        <Badge size="sm" variant="info" dot>{editing.status}</Badge>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    {#if editing}
      <Button variant="outline" onclick={doDelete}>
        <Trash2 class="h-4 w-4" />
        Hapus
      </Button>
    {/if}
    <div class="flex-1"></div>
    <Button variant="outline" onclick={() => (open = false)}>Batal</Button>
    <Button onclick={submit}>{editing ? 'Simpan' : 'Tambah'}</Button>
  {/snippet}
</Modal>
