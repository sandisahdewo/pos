<script lang="ts">
  import { DollarSign, ShoppingCart, Users, Package } from 'lucide-svelte';
  import { Button, Card, PageHeader, StatCard } from '$lib/components/ui';
</script>

<svelte:head>
  <title>Beranda · POS Admin</title>
</svelte:head>

<PageHeader title="Beranda" description="Selamat datang kembali. Ringkasan singkat toko Anda.">
  {#snippet actions()}
    <Button variant="outline" size="sm">Ekspor</Button>
    <Button size="sm">Transaksi baru</Button>
  {/snippet}
</PageHeader>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard label="Pendapatan hari ini" value="Rp 0" icon={DollarSign} accent="brand" />
  <StatCard label="Pesanan" value="0" icon={ShoppingCart} accent="emerald" />
  <StatCard label="Pelanggan" value="0" icon={Users} accent="amber" />
  <StatCard label="Produk" value="0" icon={Package} accent="violet" />
</div>

<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
  <Card class="lg:col-span-2" title="Penjualan dari waktu ke waktu" description="Aktivitas terbaru">
    <div
      class="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 text-center"
    >
      <p class="text-sm font-medium text-slate-600">Belum ada data untuk ditampilkan</p>
      <p class="mt-1 text-xs text-slate-400">
        Mulai memproses penjualan dan grafik akan muncul di sini.
      </p>
    </div>
  </Card>

  <Card title="Pesanan terbaru">
    <div
      class="flex h-64 flex-col items-center justify-center text-center text-sm text-slate-500"
    >
      <p>Belum ada pesanan</p>
      <a
        href="/pos"
        class="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        Buka terminal Kasir →
      </a>
    </div>
  </Card>
</div>
