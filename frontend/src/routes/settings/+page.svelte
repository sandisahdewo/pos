<script lang="ts">
  import { Boxes, Settings as SettingsIcon, CalendarClock, ExternalLink, Utensils } from 'lucide-svelte';
  import { Button, Card, PageHeader, Toggle } from '$lib/components/ui';
  import { settings, serviceTypeLabels, type ServiceType } from '$lib/stores/settings.svelte';
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

  function onFnbToggle(checked: boolean) {
    settings.setFnbEnabled(checked);
    if (checked) {
      toast.success(
        'Dine-in / Take-away diaktifkan',
        'Setiap transaksi di /pos akan menanyakan tipe layanan dan (opsional) nomor meja.'
      );
    } else {
      toast.success(
        'Dine-in / Take-away dimatikan',
        'Transaksi baru tidak menyimpan tipe layanan. Order lama tetap menampilkan datanya.'
      );
    }
  }

  function onDefaultServiceTypeChange(value: ServiceType) {
    settings.setFnbField('defaultServiceType', value);
  }

  function onRequireTableNumberToggle(checked: boolean) {
    settings.setFnbField('requireTableNumber', checked);
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

      <div class="rounded-lg border border-slate-200 p-4">
        <Toggle
          checked={settings.value.operations.fnb.enabled}
          onchange={onFnbToggle}
          label="Dine-in / Take-away"
          description="Tampilkan pilihan tipe layanan dan nomor meja di kasir. Cocok untuk kafe, warung makan, atau resto kecil. Biaya tambahan seperti service charge atau biaya kemasan tetap ditangani lewat produk biasa atau extras — fitur ini hanya menandai tipe layanan."
        />

        {#if settings.value.operations.fnb.enabled}
          <div class="mt-3 space-y-3">
            <div class="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <p class="font-semibold">Aktif</p>
              <p class="mt-0.5">
                Setiap sesi kasir baru akan diawali dengan tipe layanan default. Operator dapat menggantinya
                per transaksi.
              </p>
            </div>

            <div>
              <p class="mb-1.5 text-xs font-medium text-slate-700">Default tipe layanan</p>
              <div class="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
                {#each ['dineIn', 'takeAway'] as const as type}
                  <button
                    type="button"
                    class="rounded px-3 py-1 text-xs font-medium {settings.value.operations.fnb
                      .defaultServiceType === type
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'}"
                    onclick={() => onDefaultServiceTypeChange(type)}
                  >
                    {serviceTypeLabels[type]}
                  </button>
                {/each}
              </div>
              <p class="mt-1 text-[11px] text-slate-500">Dipakai saat tab kasir baru dibuka.</p>
            </div>

            <Toggle
              checked={settings.value.operations.fnb.requireTableNumber}
              onchange={onRequireTableNumberToggle}
              label="Wajib isi nomor meja saat dine-in"
              description="Order dine-in tidak bisa dibayar jika nomor meja kosong."
            />
          </div>
        {:else}
          <div class="mt-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              Cocok untuk toko retail / minimarket yang tidak melayani makan di tempat. Nyalakan kapan saja
              tanpa mempengaruhi order yang sudah ada.
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
