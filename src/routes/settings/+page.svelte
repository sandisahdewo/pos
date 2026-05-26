<script lang="ts">
  import { Boxes, Settings as SettingsIcon, CalendarClock, ExternalLink } from 'lucide-svelte';
  import { Button, Card, PageHeader, Toggle } from '$lib/components/ui';
  import { settings } from '$lib/stores/settings.svelte';
  import { locations } from '$lib/stores/locations.svelte';
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
          <div class="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
            <div class="text-xs text-emerald-800">
              <p class="font-semibold">Aktif</p>
              <p class="mt-0.5">
                Kelola template jam shift dan aturan di pusat
                <a href="/shifts" class="underline">Shift Kasir</a> (tab
                <span class="font-medium">Template</span> &
                <span class="font-medium">Aturan</span>). PIN per pegawai diatur di
                <a href="/employees" class="underline">Pegawai</a>.
              </p>
            </div>
            <Button size="sm" variant="outline" href="/shifts/templates">
              <ExternalLink class="h-3.5 w-3.5" />
              Buka Template Shift
            </Button>
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
