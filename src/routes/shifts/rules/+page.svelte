<script lang="ts">
  import { History, AlertTriangle, ShoppingCart, Info } from 'lucide-svelte';
  import { Alert, Card, MoneyInput, PageHeader, Toggle } from '$lib/components/ui';
  import ShiftHubTabs from '$lib/components/shifts/ShiftHubTabs.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const rules = $derived(settings.value.operations.shiftRules);
  const shiftsOn = $derived(settings.value.operations.shiftsEnabled);

  function onInheritToggle(checked: boolean) {
    settings.setShiftRule('inheritOpeningFromPrevClose', checked);
    if (checked) {
      toast.success(
        'Kas awal akan diwariskan',
        'Saat buka shift, kas awal otomatis diisi dari kas akhir shift sebelumnya untuk kasir yang sama.'
      );
    } else {
      toast.success('Aturan dimatikan', 'Kasir akan mengisi kas awal manual setiap buka shift.');
    }
  }

  function onRequirePosToggle(checked: boolean) {
    settings.setShiftRule('requireShiftBeforePos', checked);
    toast.info(
      'Aturan disimpan',
      checked
        ? 'Terminal Kasir akan terkunci sampai ada shift terbuka (penegakan ditambah pada update berikutnya).'
        : 'Terminal Kasir tetap bisa dipakai tanpa shift aktif.'
    );
  }
</script>

<svelte:head>
  <title>Aturan Shift · POS Admin</title>
</svelte:head>

<PageHeader
  title="Shift Kasir"
  description="Atur kebijakan kas awal, ambang selisih, dan integrasi dengan terminal kasir."
  breadcrumb={[
    { label: 'Operasional' },
    { label: 'Shift Kasir', href: '/shifts' },
    { label: 'Aturan' }
  ]}
/>

<ShiftHubTabs />

{#if !shiftsOn}
  <Alert variant="warning" title="Fitur shift sedang dimatikan">
    <span class="flex items-center gap-1.5">
      <Info class="h-3.5 w-3.5" />
      Aturan di bawah tersimpan, tapi tidak berdampak sampai shift diaktifkan kembali di
      <a href="/settings" class="underline">Pengaturan</a>.
    </span>
  </Alert>
{/if}

<div class="mt-{shiftsOn ? '0' : '4'} grid gap-4 lg:max-w-3xl">
  <Card>
    <div class="mb-3 flex items-center gap-2">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <History class="h-4 w-4" />
      </div>
      <h2 class="text-base font-semibold text-slate-900">Buka shift</h2>
    </div>

    <div class="rounded-lg border border-slate-200 p-4">
      <Toggle
        checked={rules.inheritOpeningFromPrevClose}
        onchange={onInheritToggle}
        label="Kas awal otomatis dari saldo akhir shift sebelumnya"
        description="Saat kasir membuka shift baru, sistem akan mengisi kas awal dengan kas akhir shift terakhir kasir tersebut. Berguna kalau uang di laci tidak diambil di antara shift."
      />

      {#if rules.inheritOpeningFromPrevClose}
        <div
          class="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
        >
          <p class="font-semibold">Aktif</p>
          <p class="mt-0.5">
            Kasir tetap bisa mengubah kas awal kalau ternyata uang sudah diambil di antara shift.
          </p>
        </div>
      {/if}
    </div>
  </Card>

  <Card>
    <div class="mb-3 flex items-center gap-2">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <AlertTriangle class="h-4 w-4" />
      </div>
      <h2 class="text-base font-semibold text-slate-900">Tutup shift</h2>
    </div>

    <div class="rounded-lg border border-slate-200 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="max-w-md">
          <p class="text-sm font-medium text-slate-800">Ambang selisih wajar</p>
          <p class="mt-0.5 text-xs text-slate-500">
            Selisih (variance) yang lebih besar dari ambang ini akan ditandai sebagai
            <span class="font-medium">perlu perhatian</span> saat tutup shift. Selisih kecil di
            bawah ambang dianggap normal (mis. pembulatan kembalian).
          </p>
        </div>
        <div class="w-44">
          <MoneyInput bind:value={settings.value.operations.shiftRules.varianceWarnThreshold} />
        </div>
      </div>
      <p class="mt-3 text-xs text-slate-500">
        Saat ini diset ke
        <span class="font-medium text-slate-700">{formatRupiah(rules.varianceWarnThreshold)}</span>.
        Set ke 0 kalau ingin semua selisih ditandai.
      </p>
    </div>
  </Card>

  <Card>
    <div class="mb-3 flex items-center gap-2">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <ShoppingCart class="h-4 w-4" />
      </div>
      <h2 class="text-base font-semibold text-slate-900">Integrasi Kasir</h2>
    </div>

    <div class="rounded-lg border border-slate-200 p-4">
      <Toggle
        checked={rules.requireShiftBeforePos}
        onchange={onRequirePosToggle}
        label="Wajib buka shift sebelum bisa transaksi di Kasir"
        description="Terminal Kasir akan terkunci dan menampilkan pengingat untuk membuka shift dulu. Cegah transaksi tanpa pertanggungjawaban kas."
      />

      <div class="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <p class="font-semibold">Akan datang</p>
        <p class="mt-0.5">
          Penegakan otomatis pada terminal Kasir akan ditambah pada update berikutnya. Untuk
          sekarang aturan ini hanya dicatat sebagai preferensi.
        </p>
      </div>
    </div>
  </Card>

  <p class="text-xs text-slate-400">
    Toggle aktif/nonaktif fitur Shift Kasir tetap di
    <a href="/settings" class="text-brand-600 hover:underline">Pengaturan</a> — aturan di sini
    hanya berlaku ketika fitur aktif.
  </p>
</div>
