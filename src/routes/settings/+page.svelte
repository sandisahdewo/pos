<script lang="ts">
  import { Boxes, Settings as SettingsIcon, CalendarClock, Plus, Trash2, Pencil, Check, X } from 'lucide-svelte';
  import { Badge, Button, Card, Input, PageHeader, Toggle } from '$lib/components/ui';
  import { settings } from '$lib/stores/settings.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import {
    shiftTemplates,
    plannedDurationHours,
    type ShiftTemplate
  } from '$lib/stores/shiftTemplates.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  function onLocationsToggle(checked: boolean) {
    settings.setLocationsEnabled(checked);
    if (checked) {
      toast.success(
        'Manajemen lokasi diaktifkan',
        `${locations.active().length} lokasi siap digunakan. Kelola di menu Lokasi.`
      );
    } else {
      toast.success('Manajemen lokasi dimatikan', 'Data lokasi tetap tersimpan dan akan kembali muncul saat diaktifkan.');
    }
  }

  function onAuditToggle(checked: boolean) {
    settings.setAuditTrailEnabled(checked);
    if (checked) {
      toast.success(
        'Riwayat & opname stok diaktifkan',
        'Mulai sekarang setiap perubahan stok akan tercatat. Anda bisa melakukan opname dari menu Opname Stok.'
      );
    } else {
      toast.success(
        'Riwayat & opname stok dimatikan',
        'Catatan yang sudah ada tetap tersimpan; perubahan stok berikutnya tidak akan dicatat sampai diaktifkan kembali.'
      );
    }
  }

  function onShiftsToggle(checked: boolean) {
    settings.setShiftsEnabled(checked);
    if (checked) {
      toast.success(
        'Shift kasir diaktifkan',
        'Kasir dapat membuka/menutup shift dengan PIN, dan setiap penjualan akan terhubung ke shift aktif.'
      );
    } else {
      toast.success(
        'Shift kasir dimatikan',
        'Data shift yang sudah ada tetap tersimpan. Penjualan baru tidak akan terkait shift sampai diaktifkan lagi.'
      );
    }
  }

  let editingTplId = $state<string | null>(null);
  let tplDraft = $state<{ name: string; startTime: string; endTime: string; notes: string }>({
    name: '',
    startTime: '06:00',
    endTime: '14:00',
    notes: ''
  });
  let tplErrors = $state<{ name?: string; time?: string }>({});

  function openAddTpl() {
    editingTplId = 'new';
    tplDraft = { name: '', startTime: '06:00', endTime: '14:00', notes: '' };
    tplErrors = {};
  }

  function openEditTpl(t: ShiftTemplate) {
    editingTplId = t.id;
    tplDraft = {
      name: t.name,
      startTime: t.startTime,
      endTime: t.endTime,
      notes: t.notes
    };
    tplErrors = {};
  }

  function cancelTpl() {
    editingTplId = null;
    tplErrors = {};
  }

  function saveTpl() {
    const next: typeof tplErrors = {};
    if (!tplDraft.name.trim()) next.name = 'Nama wajib diisi.';
    if (!/^\d{2}:\d{2}$/.test(tplDraft.startTime) || !/^\d{2}:\d{2}$/.test(tplDraft.endTime))
      next.time = 'Format jam harus HH:MM.';
    tplErrors = next;
    if (Object.keys(next).length) return;

    if (editingTplId === 'new') {
      shiftTemplates.add({
        name: tplDraft.name.trim(),
        startTime: tplDraft.startTime,
        endTime: tplDraft.endTime,
        notes: tplDraft.notes,
        status: 'active'
      });
      toast.success('Template ditambahkan', tplDraft.name);
    } else if (editingTplId) {
      shiftTemplates.update(editingTplId, {
        name: tplDraft.name.trim(),
        startTime: tplDraft.startTime,
        endTime: tplDraft.endTime,
        notes: tplDraft.notes
      });
      toast.success('Template diperbarui', tplDraft.name);
    }
    editingTplId = null;
  }

  function removeTpl(t: ShiftTemplate) {
    shiftTemplates.remove(t.id);
    toast.success('Template dihapus', t.name);
  }

  function toggleArchive(t: ShiftTemplate) {
    shiftTemplates.update(t.id, { status: t.status === 'active' ? 'archived' : 'active' });
  }
</script>

<svelte:head>
  <title>Pengaturan · POS Admin</title>
</svelte:head>

<PageHeader
  title="Pengaturan"
  description="Aktifkan fitur opsional sesuai kebutuhan toko Anda."
  breadcrumb={[{ label: 'Sistem' }, { label: 'Pengaturan' }]}
/>

<div class="grid gap-4 lg:max-w-3xl">
  <Card>
    <div class="mb-3 flex items-center gap-2">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Boxes class="h-4 w-4" />
      </div>
      <h2 class="text-base font-semibold text-slate-900">Inventaris</h2>
    </div>

    <div class="space-y-4">
      <div class="rounded-lg border border-slate-200 p-4">
        <Toggle
          checked={settings.value.inventory.locationsEnabled}
          onchange={onLocationsToggle}
          label="Manajemen lokasi penyimpanan"
          description="Pisahkan stok antar lokasi fisik: Etalase (dipajang), Rak Belakang, dan Gudang. Setelah aktif, Anda bisa memindahkan stok antar lokasi dan melihat di mana setiap produk berada."
        />

        {#if settings.value.inventory.locationsEnabled}
          <div class="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <p class="font-semibold">Aktif</p>
            <p class="mt-0.5">
              Stok awal otomatis berada di <span class="font-medium">Gudang</span>. Buka
              <a href="/inventory" class="underline">Inventaris</a> dan klik
              <span class="font-medium">Pindahkan</span> untuk memindahkan ke
              <span class="font-medium">Etalase</span> atau lokasi lain. Kelola daftar lokasi di
              <a href="/locations" class="underline">Lokasi</a>.
            </p>
          </div>
        {:else}
          <div class="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              Cocok untuk toko kecil yang stoknya menumpuk di satu tempat. Bisa diaktifkan kapan saja —
              data stok yang sudah ada tidak akan hilang.
            </p>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-slate-200 p-4">
        <Toggle
          checked={settings.value.inventory.auditTrailEnabled}
          onchange={onAuditToggle}
          label="Riwayat & opname stok"
          description="Catat setiap perubahan stok (penerimaan, penjualan, pembatalan, penyesuaian, pemindahan) ke ledger audit. Termasuk fitur Opname Stok untuk audit fisik per lokasi dengan deteksi selisih (shrinkage)."
        />

        {#if settings.value.inventory.auditTrailEnabled}
          <div class="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <p class="font-semibold">Aktif</p>
            <p class="mt-0.5">
              Lihat seluruh pergerakan stok di
              <a href="/stock-movements" class="underline">Riwayat Stok</a>. Lakukan audit fisik di
              <a href="/stock-opname" class="underline">Opname Stok</a> — sistem akan otomatis mencatat selisih sebagai shrinkage.
            </p>
          </div>
        {:else}
          <div class="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              Cocok untuk toko yang ingin melacak siapa, kapan, dan di mana stok berubah — penting untuk
              mendeteksi kasus pencurian atau selisih stok.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </Card>

  <Card>
    <div class="mb-3 flex items-center gap-2">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <CalendarClock class="h-4 w-4" />
      </div>
      <h2 class="text-base font-semibold text-slate-900">Operasional</h2>
    </div>

    <div class="space-y-4">
      <div class="rounded-lg border border-slate-200 p-4">
        <Toggle
          checked={settings.value.operations.shiftsEnabled}
          onchange={onShiftsToggle}
          label="Shift kasir & kas"
          description="Kasir membuka shift dengan PIN dan kas awal, mencatat kas masuk/keluar selama shift (beli es, gas, modal tambahan, dll.), lalu menutup shift dengan kas akhir. Sistem otomatis menghitung selisih (variance) terhadap penjualan tunai."
        />

        {#if settings.value.operations.shiftsEnabled}
          <div class="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <p class="font-semibold">Aktif</p>
            <p class="mt-0.5">
              Buka <a href="/shifts" class="underline">Shift Kasir</a> untuk memulai shift baru.
              Atur PIN per pegawai di <a href="/employees" class="underline">Pegawai</a>.
              Template shift dikelola di kartu di bawah.
            </p>
          </div>
        {:else}
          <div class="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              Cocok untuk warung yang dijalankan sendiri tanpa kasir terpisah. Bisa diaktifkan kapan saja
              tanpa kehilangan data.
            </p>
          </div>
        {/if}
      </div>

      {#if settings.value.operations.shiftsEnabled}
        <div class="rounded-lg border border-slate-200 p-4">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Template shift</h3>
              <p class="mt-0.5 text-xs text-slate-500">
                Jadwal jam kerja yang dipakai kasir saat membuka shift. Jam sebenarnya tetap dicatat sesuai waktu real.
              </p>
            </div>
            {#if editingTplId !== 'new'}
              <Button size="sm" variant="outline" onclick={openAddTpl}>
                <Plus class="h-3.5 w-3.5" />
                Tambah
              </Button>
            {/if}
          </div>

          <div class="space-y-2">
            {#if editingTplId === 'new'}
              <div class="rounded-md border border-brand-200 bg-brand-50/30 p-3">
                <div class="grid gap-3 sm:grid-cols-12">
                  <Input
                    class="sm:col-span-4"
                    label="Nama"
                    placeholder="mis. Pagi"
                    bind:value={tplDraft.name}
                    error={tplErrors.name}
                  />
                  <Input
                    class="sm:col-span-3"
                    label="Mulai"
                    type="time"
                    bind:value={tplDraft.startTime}
                  />
                  <Input
                    class="sm:col-span-3"
                    label="Selesai"
                    type="time"
                    bind:value={tplDraft.endTime}
                    error={tplErrors.time}
                  />
                  <Input
                    class="sm:col-span-2"
                    label="Catatan"
                    placeholder="(opsional)"
                    bind:value={tplDraft.notes}
                  />
                </div>
                <div class="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onclick={cancelTpl}>
                    <X class="h-3.5 w-3.5" />
                    Batal
                  </Button>
                  <Button size="sm" onclick={saveTpl}>
                    <Check class="h-3.5 w-3.5" />
                    Simpan
                  </Button>
                </div>
              </div>
            {/if}

            {#each shiftTemplates.items as t (t.id)}
              {#if editingTplId === t.id}
                <div class="rounded-md border border-brand-200 bg-brand-50/30 p-3">
                  <div class="grid gap-3 sm:grid-cols-12">
                    <Input
                      class="sm:col-span-4"
                      label="Nama"
                      bind:value={tplDraft.name}
                      error={tplErrors.name}
                    />
                    <Input
                      class="sm:col-span-3"
                      label="Mulai"
                      type="time"
                      bind:value={tplDraft.startTime}
                    />
                    <Input
                      class="sm:col-span-3"
                      label="Selesai"
                      type="time"
                      bind:value={tplDraft.endTime}
                      error={tplErrors.time}
                    />
                    <Input
                      class="sm:col-span-2"
                      label="Catatan"
                      bind:value={tplDraft.notes}
                    />
                  </div>
                  <div class="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onclick={cancelTpl}>
                      <X class="h-3.5 w-3.5" />
                      Batal
                    </Button>
                    <Button size="sm" onclick={saveTpl}>
                      <Check class="h-3.5 w-3.5" />
                      Simpan
                    </Button>
                  </div>
                </div>
              {:else}
                <div class="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-slate-900">{t.name}</span>
                      <Badge
                        variant={t.status === 'active' ? 'success' : 'neutral'}
                        size="sm"
                        dot
                      >
                        {t.status === 'active' ? 'Aktif' : 'Diarsipkan'}
                      </Badge>
                    </div>
                    <div class="mt-0.5 text-xs text-slate-500">
                      {t.startTime}–{t.endTime} · {plannedDurationHours(t)} jam
                      {#if t.notes}
                        <span class="text-slate-400"> · {t.notes}</span>
                      {/if}
                    </div>
                  </div>
                  <button
                    type="button"
                    class="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    onclick={() => toggleArchive(t)}
                  >
                    {t.status === 'active' ? 'Arsipkan' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Ubah"
                    onclick={() => openEditTpl(t)}
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Hapus"
                    onclick={() => removeTpl(t)}
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              {/if}
            {/each}

            {#if shiftTemplates.items.length === 0 && editingTplId !== 'new'}
              <p class="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                Belum ada template. Klik "Tambah" untuk membuat.
              </p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </Card>

  <Card>
    <div class="mb-3 flex items-center gap-2">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <SettingsIcon class="h-4 w-4" />
      </div>
      <h2 class="text-base font-semibold text-slate-900">Tentang</h2>
    </div>
    <div class="text-sm text-slate-600 space-y-2">
      <p>POS Admin <span class="font-mono text-slate-500">v0.1.0</span></p>
      <p class="text-xs text-slate-500">
        Pengaturan ini berlaku untuk seluruh aplikasi. Akan ada lebih banyak opsi di sini seiring
        pertumbuhan fitur.
      </p>
    </div>
  </Card>
</div>
