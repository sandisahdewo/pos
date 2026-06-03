<script lang="ts">
  import {
    KeyRound,
    Clock,
    Eye,
    EyeOff,
    CalendarCheck,
    CalendarX,
    CalendarOff,
    UserCog,
    ShieldAlert
  } from 'lucide-svelte';
  import { Alert, Badge, Button, Input, Modal, Textarea } from '$lib/components/ui';
  import CashCountInput from './CashCountInput.svelte';
  import { employees, roleLabelFor } from '$lib/stores/employees.svelte';
  import { plannedDurationHours } from '$lib/stores/shiftTemplates.svelte';
  import { shifts, type CashCount } from '$lib/stores/shifts.svelte';
  import {
    shiftSchedule,
    validateShiftOpenForEmployee,
    type ShiftOpenValidation
  } from '$lib/stores/shiftSchedule.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { user } from '$lib/stores/user.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type Props = {
    open: boolean;
    onOpened?: (shiftId: string) => void;
  };

  let { open = $bindable(false), onOpened }: Props = $props();

  const me = $derived(user.current);
  const meRoleLabel = $derived(me ? roleLabelFor(me) : '');

  // Re-evaluate validation reactively while the modal is open so the time check stays fresh.
  let nowTick = $state(new Date());
  $effect(() => {
    if (!open) return;
    nowTick = new Date();
    const interval = setInterval(() => (nowTick = new Date()), 30_000);
    return () => clearInterval(interval);
  });

  const validation = $derived.by<ShiftOpenValidation | null>(() => {
    if (!open || !me) return null;
    return validateShiftOpenForEmployee(me.id, nowTick);
  });

  // Ad-hoc opening (no schedule today) is gated by a dedicated permission.
  const canOpenAdHoc = $derived(user.can('feature.shifts.open-adhoc'));
  const adHocBlocked = $derived(
    validation?.ok === true &&
      validation.todayAssignments.length === 0 &&
      !canOpenAdHoc
  );

  // Template is fully derived from the matched assignment. Ad-hoc shifts open without a template
  // ("jam bebas") — no manual selector is exposed.
  const autoTemplate = $derived(validation?.ok ? validation.matchedTemplate : undefined);

  let pin = $state('');
  let showPin = $state(false);
  let openingCash = $state<CashCount>({ total: 0 });
  let notes = $state('');
  let pinError = $state<string | null>(null);
  let submitError = $state<string | null>(null);
  let inheritedFromShift = $state<string | null>(null);

  $effect(() => {
    if (open) {
      pin = '';
      showPin = false;
      openingCash = { total: 0 };
      notes = '';
      pinError = null;
      submitError = null;
      inheritedFromShift = null;
    }
  });

  // Inherit opening cash from previous closed shift when rule is enabled.
  $effect(() => {
    if (!open || !me) return;
    if (!settings.value.operations.shiftRules.inheritOpeningFromPrevClose) {
      inheritedFromShift = null;
      return;
    }
    const last = shifts.lastClosedFor(me.id);
    if (last && last.closingCash) {
      openingCash = { total: last.closingCash.total };
      inheritedFromShift = last.code;
    } else {
      inheritedFromShift = null;
    }
  });

  const canSubmit = $derived(Boolean(me) && validation?.ok === true && !adHocBlocked);

  async function submit() {
    submitError = null;
    pinError = null;
    if (!me) {
      submitError = 'Tidak ada pegawai yang login.';
      return;
    }
    if (!validation || !validation.ok) {
      submitError = validation?.ok === false ? validation.reason : 'Jadwal tidak valid.';
      return;
    }
    if (adHocBlocked) {
      submitError = 'Tidak ada jadwal hari ini dan akun Anda tidak boleh buka shift ad-hoc.';
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      pinError = 'PIN harus 4 digit angka.';
      return;
    }
    if (!employees.verifyPin(me.id, pin)) {
      pinError = 'PIN salah.';
      return;
    }
    const res = await shifts.open({
      employeeId: me.id,
      templateId: validation.matchedAssignment?.templateId,
      openingCash,
      notes
    });
    if (!res.ok) {
      submitError = res.reason;
      return;
    }
    if (validation.matchedAssignment) {
      // Fire-and-forget — failure to mark schedule completed doesn't block
      // the shift from being open.
      void shiftSchedule.markCompleted(validation.matchedAssignment.id, res.shift.id);
    }
    toast.success(
      `Shift dibuka — ${me.name}`,
      `Kas awal: ${formatRupiah(openingCash.total)}`
    );
    open = false;
    onOpened?.(res.shift.id);
  }
</script>

<Modal
  bind:open
  size="lg"
  title="Buka shift"
  description="Sistem akan mendeteksi shift dari jadwal Anda berdasarkan jam saat ini."
>
  <div class="space-y-4">
    {#if !me}
      <Alert variant="error" title="Tidak ada pegawai login">
        Aplikasi tidak mendeteksi sesi pegawai. Silakan masuk ulang melalui halaman login.
      </Alert>
    {:else}
      <!-- Logged-in user card -->
      <div
        class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
        >
          <UserCog class="h-5 w-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs text-slate-500">Membuka shift sebagai</p>
          <p class="truncate text-sm font-semibold text-slate-900">{me.name}</p>
          <p class="truncate text-xs text-slate-500">{meRoleLabel}</p>
        </div>
      </div>

      {#if submitError}
        <Alert variant="error" title="Tidak bisa membuka shift">{submitError}</Alert>
      {/if}

      {#if validation?.ok && autoTemplate}
        <Alert variant="success" title="Shift terdeteksi otomatis">
          <div class="space-y-1.5">
            <p class="flex items-center gap-1.5">
              <CalendarCheck class="h-4 w-4" />
              Sesuai jadwal hari ini, shift Anda saat ini:
            </p>
            <div class="rounded-md border border-emerald-200 bg-white/70 px-3 py-2">
              <div class="flex items-baseline gap-2">
                <span class="text-base font-semibold text-slate-900">{autoTemplate.name}</span>
                <span class="text-sm text-slate-600">
                  {autoTemplate.startTime}–{autoTemplate.endTime}
                </span>
                <span class="ml-auto text-xs text-slate-500">
                  ± {plannedDurationHours(autoTemplate)} jam
                </span>
              </div>
              {#if autoTemplate.notes}
                <p class="mt-1 text-xs text-slate-500">{autoTemplate.notes}</p>
              {/if}
            </div>
            <p class="text-xs text-emerald-700">
              Jadwal akan otomatis ditandai selesai setelah shift dibuka.
            </p>
          </div>
        </Alert>
      {:else if adHocBlocked}
        <Alert variant="error" title="Anda tidak terjadwal hari ini">
          <span class="flex items-start gap-1.5">
            <CalendarOff class="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Akun Anda tidak diizinkan membuka shift tanpa jadwal. Minta admin untuk membuatkan
              jadwal terlebih dahulu di
              <a href="/shifts/schedule" class="font-medium underline">Jadwal Shift</a>.
            </span>
          </span>
        </Alert>
      {:else if validation?.ok && validation.todayAssignments.length === 0}
        <Alert variant="info" title="Tidak ada jadwal hari ini">
          <span class="flex items-center gap-1.5">
            <CalendarOff class="h-4 w-4" />
            Tidak ada jadwal terdeteksi. Shift akan dibuka <strong>tanpa template (jam bebas)</strong>.
          </span>
        </Alert>
      {:else if validation && !validation.ok}
        <Alert variant="error" title="Belum saatnya membuka shift">
          <div class="space-y-2">
            <p class="flex items-start gap-1.5">
              <CalendarX class="mt-0.5 h-4 w-4 shrink-0" />
              <span>{validation.reason}</span>
            </p>
            {#if validation.todayAssignments.length > 0}
              <div class="rounded-md border border-rose-200 bg-white/60 px-2.5 py-2">
                <p class="mb-1 text-[11px] font-semibold tracking-wide text-rose-700 uppercase">
                  Jadwal Anda hari ini
                </p>
                <div class="flex flex-wrap gap-1.5">
                  {#each validation.todayAssignments as a (a.assignment.id)}
                    {#if a.template}
                      <Badge variant={a.assignment.id === validation.nextAssignment?.id ? 'danger' : 'outline'} size="sm">
                        {a.template.name} · {a.template.startTime}–{a.template.endTime}
                      </Badge>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </Alert>
      {/if}

      <Input
        label="PIN 4 digit"
        type={showPin ? 'text' : 'password'}
        inputmode="numeric"
        maxlength={4}
        placeholder="••••"
        bind:value={pin}
        error={pinError ?? undefined}
        hint="PIN pegawai untuk memverifikasi orang di terminal."
        disabled={!canSubmit}
      >
        {#snippet leading()}<KeyRound class="h-4 w-4" />{/snippet}
        {#snippet trailing()}
          <button
            type="button"
            class="p-1 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
            onclick={() => (showPin = !showPin)}
            disabled={!canSubmit}
            aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
          >
            {#if showPin}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
          </button>
        {/snippet}
      </Input>

      <div>
        <CashCountInput
          bind:value={openingCash}
          label="Kas awal"
          disabled={!canSubmit}
          hint="Uang tunai di laci kasir saat shift dimulai. Hitung per pecahan jika ingin lebih akurat."
        />
        {#if inheritedFromShift && canSubmit}
          <p class="mt-1.5 text-xs text-emerald-700">
            Diisi otomatis ({formatRupiah(openingCash.total)}) dari kas akhir shift sebelumnya
            (<span class="font-mono">{inheritedFromShift}</span>). Ubah jika perlu.
          </p>
        {/if}
      </div>

      <Textarea
        label="Catatan (opsional)"
        placeholder="mis. Ada pesanan katering 100 porsi siang nanti."
        bind:value={notes}
        disabled={!canSubmit}
      />
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (open = false)}>Batal</Button>
    <Button onclick={submit} disabled={!canSubmit}>
      {#if !canSubmit}
        <ShieldAlert class="h-4 w-4" />
        Tidak diizinkan
      {:else}
        <Clock class="h-4 w-4" />
        Buka shift
      {/if}
    </Button>
  {/snippet}
</Modal>
