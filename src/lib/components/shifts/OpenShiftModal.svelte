<script lang="ts">
  import { KeyRound, UserCog, Clock, Eye, EyeOff } from 'lucide-svelte';
  import { Alert, Badge, Button, Input, Modal, Select, Textarea } from '$lib/components/ui';
  import CashCountInput from './CashCountInput.svelte';
  import { employees, roleLabels } from '$lib/stores/employees.svelte';
  import {
    shiftTemplates,
    plannedDurationHours
  } from '$lib/stores/shiftTemplates.svelte';
  import { shifts, type CashCount } from '$lib/stores/shifts.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  type Props = {
    open: boolean;
    onOpened?: (shiftId: string) => void;
  };

  let { open = $bindable(false), onOpened }: Props = $props();

  let employeeId = $state('');
  let pin = $state('');
  let showPin = $state(false);
  let templateId = $state<string>('');
  let openingCash = $state<CashCount>({ total: 0 });
  let notes = $state('');
  let error = $state<string | null>(null);
  let pinError = $state<string | null>(null);

  const activeEmployees = $derived(employees.active());
  const employeeOptions = $derived([
    { value: '', label: 'Pilih pegawai…' },
    ...activeEmployees.map((e) => ({
      value: e.id,
      label: `${e.name} · ${roleLabels[e.role]}`
    }))
  ]);

  const activeTpls = $derived(shiftTemplates.active());
  const templateOptions = $derived([
    { value: '', label: 'Tanpa template (jam bebas)' },
    ...activeTpls.map((t) => ({
      value: t.id,
      label: `${t.name} — ${t.startTime}–${t.endTime}`
    }))
  ]);

  const selectedTpl = $derived(templateId ? shiftTemplates.getById(templateId) : undefined);

  $effect(() => {
    if (open) {
      employeeId = '';
      pin = '';
      showPin = false;
      templateId = '';
      openingCash = { total: 0 };
      notes = '';
      error = null;
      pinError = null;
    }
  });

  function submit() {
    error = null;
    pinError = null;
    if (!employeeId) {
      error = 'Pilih pegawai dulu.';
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      pinError = 'PIN harus 4 digit angka.';
      return;
    }
    if (!employees.verifyPin(employeeId, pin)) {
      pinError = 'PIN salah.';
      return;
    }
    const res = shifts.open({
      employeeId,
      templateId: templateId || undefined,
      openingCash,
      notes
    });
    if (!res.ok) {
      error = res.reason;
      return;
    }
    const empName = employees.getById(employeeId)?.name ?? 'Kasir';
    toast.success(`Shift dibuka — ${empName}`, `Kas awal: Rp ${openingCash.total.toLocaleString('id-ID')}`);
    open = false;
    onOpened?.(res.shift.id);
  }
</script>

<Modal
  bind:open
  size="lg"
  title="Buka shift"
  description="Mulai shift kasir baru. PIN dipakai untuk verifikasi pegawai."
>
  <div class="space-y-4">
    {#if error}
      <Alert variant="error" title="Tidak bisa membuka shift">{error}</Alert>
    {/if}

    <div class="grid gap-3 sm:grid-cols-2">
      <Select
        label="Pegawai"
        bind:value={employeeId}
        options={employeeOptions}
      />
      <Input
        label="PIN 4 digit"
        type={showPin ? 'text' : 'password'}
        inputmode="numeric"
        maxlength={4}
        placeholder="••••"
        bind:value={pin}
        error={pinError ?? undefined}
      >
        {#snippet leading()}<KeyRound class="h-4 w-4" />{/snippet}
        {#snippet trailing()}
          <button
            type="button"
            class="p-1 text-slate-400 hover:text-slate-600"
            onclick={() => (showPin = !showPin)}
            aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
          >
            {#if showPin}
              <EyeOff class="h-4 w-4" />
            {:else}
              <Eye class="h-4 w-4" />
            {/if}
          </button>
        {/snippet}
      </Input>
    </div>

    <div>
      <Select
        label="Template shift"
        bind:value={templateId}
        options={templateOptions}
        hint={selectedTpl
          ? `Rencana ${plannedDurationHours(selectedTpl)} jam. Jam sebenarnya tetap dicatat sesuai waktu real.`
          : 'Tanpa template, shift bisa dibuka dan ditutup kapan saja.'}
      />
    </div>

    <CashCountInput
      bind:value={openingCash}
      label="Kas awal"
      hint="Uang tunai di laci kasir saat shift dimulai. Hitung per pecahan jika ingin lebih akurat."
    />

    <Textarea
      label="Catatan (opsional)"
      placeholder="mis. Ada pesanan katering 100 porsi siang nanti."
      bind:value={notes}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (open = false)}>Batal</Button>
    <Button onclick={submit}>
      <Clock class="h-4 w-4" />
      Buka shift
    </Button>
  {/snippet}
</Modal>
