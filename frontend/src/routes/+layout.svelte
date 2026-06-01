<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { ShieldOff } from 'lucide-svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import TopBar from '$lib/components/layout/TopBar.svelte';
  import ToastContainer from '$lib/components/layout/ToastContainer.svelte';
  import { sidebar } from '$lib/stores/sidebar.svelte';
  import { user } from '$lib/stores/user.svelte';
  import { Button } from '$lib/components/ui';
  import { permissionForPath, permissionLabel } from '$lib/auth/permissions';

  let { children } = $props();

  // Hydrate session from localStorage on app boot. Runs once on the client.
  let hydrated = $state(false);
  $effect(() => {
    user.hydrate().finally(() => {
      hydrated = true;
    });
  });

  const isAuthRoute = $derived(page.url.pathname.startsWith('/login'));
  const requiredPermission = $derived(permissionForPath(page.url.pathname));
  const isAllowed = $derived(!requiredPermission || user.can(requiredPermission));

  $effect(() => {
    if (!hydrated) return;
    if (!isAuthRoute && !user.isAuthenticated) {
      goto('/login');
    }
  });
</script>

{#if isAuthRoute}
  {@render children()}
{:else}
  <div class="flex min-h-full">
    <Sidebar />

    <div
      class="flex min-h-screen flex-1 flex-col transition-[padding] duration-200
        {sidebar.collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}"
    >
      <TopBar />
      <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {#if isAllowed}
          {@render children()}
        {:else}
          <div class="mx-auto flex max-w-md flex-col items-center py-16 text-center">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600"
            >
              <ShieldOff class="h-7 w-7" />
            </div>
            <h1 class="mt-4 text-lg font-semibold text-slate-900">Akses ditolak</h1>
            <p class="mt-1.5 text-sm text-slate-500">
              Anda tidak memiliki izin untuk membuka halaman ini.
              {#if requiredPermission}
                <span class="block">
                  Membutuhkan izin
                  <code
                    class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                  >
                    {permissionLabel(requiredPermission)}
                  </code>.
                </span>
              {/if}
            </p>
            <p class="mt-2 text-xs text-slate-400">
              Anda masuk sebagai
              <span class="font-medium text-slate-600">{user.displayName}</span>
              ({user.roleLabel}). Hubungi admin untuk menambah peran.
            </p>
            <div class="mt-5 flex items-center gap-2">
              <Button variant="outline" href="/">Kembali ke Beranda</Button>
            </div>
          </div>
        {/if}
      </main>
    </div>
  </div>
{/if}

<ToastContainer />
