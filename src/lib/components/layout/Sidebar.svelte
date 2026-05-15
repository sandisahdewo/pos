<script lang="ts">
  import { page } from '$app/state';
  import { sidebar } from '$lib/stores/sidebar.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import {
    Home,
    ScanLine,
    Receipt,
    Package,
    Boxes,
    Users,
    BarChart3,
    Palette,
    Settings,
    ChevronsLeft,
    X,
    UserCog,
    Tags,
    Ruler,
    BadgePercent,
    Percent,
    Truck,
    ClipboardList,
    Banknote,
    Warehouse,
    ClipboardCheck,
    History,
    HandCoins,
    Wallet,
    TrendingDown
  } from 'lucide-svelte';

  type NavItem = {
    label: string;
    href: string;
    icon: typeof Home;
    badge?: string;
  };

  type NavGroup = {
    title?: string;
    items: NavItem[];
  };

  const groups = $derived<NavGroup[]>([
    {
      items: [
        { label: 'Beranda', href: '/', icon: Home },
        { label: 'Kasir', href: '/pos', icon: ScanLine, badge: 'Baru' },
        { label: 'Pesanan', href: '/orders', icon: Receipt }
      ]
    },
    {
      title: 'Data Master',
      items: [
        { label: 'Pegawai', href: '/employees', icon: UserCog },
        { label: 'Pemasok', href: '/suppliers', icon: Truck },
        { label: 'Kategori', href: '/categories', icon: Tags },
        { label: 'Satuan', href: '/units', icon: Ruler },
        { label: 'Daftar Harga', href: '/pricelists', icon: BadgePercent },
        { label: 'Tarif Pajak', href: '/taxes', icon: Percent },
        ...(settings.value.inventory.locationsEnabled
          ? [{ label: 'Lokasi', href: '/locations', icon: Warehouse }]
          : []),
        { label: 'Produk', href: '/products', icon: Package }
      ]
    },
    {
      title: 'Pengadaan',
      items: [
        { label: 'Order Pembelian', href: '/purchase-orders', icon: ClipboardList },
        { label: 'Pembayaran Konsinyasi', href: '/payouts', icon: Banknote }
      ]
    },
    {
      title: 'Keuangan',
      items: [
        { label: 'Utang Pembelian', href: '/utang', icon: Wallet },
        { label: 'Piutang Pelanggan', href: '/piutang', icon: HandCoins }
      ]
    },
    {
      title: 'Katalog',
      items: [
        { label: 'Inventaris', href: '/inventory', icon: Boxes },
        ...(settings.value.inventory.auditTrailEnabled
          ? [{ label: 'Opname Stok', href: '/stock-opname', icon: ClipboardCheck }]
          : []),
        { label: 'Pelanggan', href: '/customers', icon: Users }
      ]
    },
    {
      title: 'Wawasan',
      items: [
        { label: 'Laporan', href: '/reports', icon: BarChart3 },
        { label: 'Prediksi Stok', href: '/forecast', icon: TrendingDown },
        ...(settings.value.inventory.auditTrailEnabled
          ? [{ label: 'Riwayat Stok', href: '/stock-movements', icon: History }]
          : [])
      ]
    },
    {
      title: 'Sistem',
      items: [
        { label: 'Komponen', href: '/components', icon: Palette },
        { label: 'Pengaturan', href: '/settings', icon: Settings }
      ]
    }
  ]);

  function isActive(href: string) {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
  }
</script>

{#if sidebar.mobileOpen}
  <button
    type="button"
    class="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
    aria-label="Tutup sidebar"
    onclick={() => sidebar.closeMobile()}
  ></button>
{/if}

<aside
  class="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-200 ease-out
    {sidebar.collapsed ? 'lg:w-[72px]' : 'lg:w-64'}
    {sidebar.mobileOpen ? 'translate-x-0' : '-translate-x-full'}
    w-64 lg:translate-x-0"
>
  <div
    class="flex h-16 items-center justify-between border-b border-slate-200 px-4"
    class:lg:px-3={sidebar.collapsed}
  >
    <a href="/" class="flex items-center gap-2.5 overflow-hidden">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-soft"
      >
        <ScanLine class="h-5 w-5" />
      </div>
      {#if !sidebar.collapsed}
        <div class="flex flex-col leading-none">
          <span class="text-base font-semibold text-slate-900">POS Admin</span>
          <span class="mt-0.5 text-[11px] font-medium text-slate-500">v0.1.0</span>
        </div>
      {/if}
    </a>

    <button
      type="button"
      class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
      onclick={() => sidebar.closeMobile()}
      aria-label="Tutup menu"
    >
      <X class="h-5 w-5" />
    </button>
  </div>

  <nav class="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
    {#each groups as group}
      <div class="mb-5 last:mb-0">
        {#if group.title && !sidebar.collapsed}
          <div
            class="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase"
          >
            {group.title}
          </div>
        {/if}
        <ul class="space-y-0.5">
          {#each group.items as item}
            {@const active = isActive(item.href)}
            <li>
              <a
                href={item.href}
                onclick={() => sidebar.closeMobile()}
                title={sidebar.collapsed ? item.label : undefined}
                class="group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors
                  {active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                  {sidebar.collapsed ? 'justify-center' : ''}"
              >
                <item.icon
                  class="h-5 w-5 shrink-0 {active
                    ? 'text-brand-600'
                    : 'text-slate-400 group-hover:text-slate-600'}"
                />
                {#if !sidebar.collapsed}
                  <span class="flex-1 truncate">{item.label}</span>
                  {#if item.badge}
                    <span
                      class="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700"
                    >
                      {item.badge}
                    </span>
                  {/if}
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>

  <div class="border-t border-slate-200 p-3">
    <button
      type="button"
      onclick={() => sidebar.toggleCollapsed()}
      class="hidden w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:flex
        {sidebar.collapsed ? 'justify-center' : ''}"
      aria-label={sidebar.collapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
    >
      <ChevronsLeft
        class="h-5 w-5 transition-transform {sidebar.collapsed ? 'rotate-180' : ''}"
      />
      {#if !sidebar.collapsed}
        <span>Ciutkan</span>
      {/if}
    </button>
  </div>
</aside>
