<script lang="ts">
  import { Menu, Search, Bell, User, Settings, LogOut, ChevronDown } from 'lucide-svelte';
  import { sidebar } from '$lib/stores/sidebar.svelte';
  import { user } from '$lib/stores/user.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { clickOutside } from '$lib/actions/clickOutside';
  import { fly } from 'svelte/transition';

  let dropdownOpen = $state(false);
  let notifOpen = $state(false);

  const initials = $derived(
    user.current.name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  );

  function handleLogout() {
    dropdownOpen = false;
    toast.success('Berhasil keluar', 'Anda telah keluar dari sistem.');
  }
</script>

<header
  class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6"
>
  <button
    type="button"
    class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
    onclick={() => sidebar.openMobile()}
    aria-label="Buka menu"
  >
    <Menu class="h-5 w-5" />
  </button>

  <div class="relative hidden max-w-md flex-1 sm:block">
    <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      type="search"
      placeholder="Cari produk, pesanan, pelanggan..."
      class="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
    />
    <kbd
      class="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 md:inline"
    >
      ⌘K
    </kbd>
  </div>

  <div class="ml-auto flex items-center gap-1">
    <!-- Notifications -->
    <div class="relative" use:clickOutside={() => (notifOpen = false)}>
      <button
        type="button"
        class="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        onclick={() => (notifOpen = !notifOpen)}
        aria-label="Notifikasi"
      >
        <Bell class="h-5 w-5" />
        <span
          class="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"
        ></span>
      </button>

      {#if notifOpen}
        <div
          transition:fly={{ y: -6, duration: 150 }}
          class="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div class="border-b border-slate-100 px-4 py-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-slate-900">Notifikasi</span>
              <button class="text-xs font-medium text-brand-600 hover:text-brand-700"
                >Tandai semua dibaca</button
              >
            </div>
          </div>
          <ul class="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {#each [{ title: 'Pesanan baru #1042', meta: '2 menit lalu', body: '3 item · Rp 482.000' }, { title: 'Stok menipis', meta: '15 menit lalu', body: 'Espresso beans · sisa 4' }, { title: 'Laporan harian siap', meta: '1 jam lalu', body: 'Lihat penjualan kemarin' }] as n}
              <li class="px-4 py-3 hover:bg-slate-50">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-slate-900">{n.title}</p>
                    <p class="mt-0.5 text-xs text-slate-500">{n.body}</p>
                  </div>
                  <span class="shrink-0 text-[11px] text-slate-400">{n.meta}</span>
                </div>
              </li>
            {/each}
          </ul>
          <div class="border-t border-slate-100 px-4 py-2 text-center">
            <a
              href="/notifications"
              class="text-xs font-medium text-brand-600 hover:text-brand-700">Lihat semua</a
            >
          </div>
        </div>
      {/if}
    </div>

    <!-- User profile dropdown -->
    <div class="relative" use:clickOutside={() => (dropdownOpen = false)}>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100"
        onclick={() => (dropdownOpen = !dropdownOpen)}
        aria-haspopup="menu"
        aria-expanded={dropdownOpen}
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white"
        >
          {initials}
        </span>
        <div class="hidden text-left sm:block">
          <div class="text-sm font-medium text-slate-900">{user.current.name}</div>
          <div class="text-[11px] text-slate-500">{user.current.role}</div>
        </div>
        <ChevronDown class="hidden h-4 w-4 text-slate-400 sm:block" />
      </button>

      {#if dropdownOpen}
        <div
          transition:fly={{ y: -6, duration: 150 }}
          role="menu"
          class="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div class="border-b border-slate-100 px-4 py-3">
            <div class="text-sm font-semibold text-slate-900">{user.current.name}</div>
            <div class="truncate text-xs text-slate-500">{user.current.email}</div>
          </div>
          <ul class="py-1">
            <li>
              <a
                href="/profile"
                onclick={() => (dropdownOpen = false)}
                class="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                role="menuitem"
              >
                <User class="h-4 w-4 text-slate-400" />
                Profil
              </a>
            </li>
            <li>
              <a
                href="/settings"
                onclick={() => (dropdownOpen = false)}
                class="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                role="menuitem"
              >
                <Settings class="h-4 w-4 text-slate-400" />
                Pengaturan
              </a>
            </li>
          </ul>
          <div class="border-t border-slate-100 py-1">
            <button
              type="button"
              onclick={handleLogout}
              class="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
              role="menuitem"
            >
              <LogOut class="h-4 w-4" />
              Keluar
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>
