<script lang="ts">
  import { goto } from '$app/navigation';
  import { Eye, EyeOff, Lock, LogIn, ShieldCheck, Store, User } from 'lucide-svelte';
  import { Alert, Button, Checkbox, Input } from '$lib/components/ui';
  import { user } from '$lib/stores/user.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let rememberMe = $state(true);
  let error = $state<string | null>(null);
  let submitting = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;

    if (!email.trim()) {
      error = 'Email wajib diisi.';
      return;
    }
    if (!password) {
      error = 'Kata sandi wajib diisi.';
      return;
    }

    submitting = true;
    const result = await user.login(email.trim(), password);
    submitting = false;

    if (!result.ok) {
      error = result.reason;
      return;
    }

    toast.success(`Selamat datang, ${user.displayName}`, 'Anda berhasil masuk.');
    await goto('/');
  }

  function fillDemo() {
    email = 'admin@pos.local';
    password = 'admin123';
    error = null;
  }
</script>

<svelte:head>
  <title>Masuk · POS Admin</title>
</svelte:head>

<div
  class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12"
>
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,theme(colors.brand.100),transparent_55%),radial-gradient(circle_at_bottom_right,theme(colors.brand.50),transparent_60%)]"
    aria-hidden="true"
  ></div>

  <div class="relative grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-card lg:grid-cols-2">
    <!-- Brand panel -->
    <aside
      class="relative hidden flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-10 text-white lg:flex"
    >
      <div class="flex items-center gap-2.5">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 backdrop-blur"
        >
          <Store class="h-5 w-5" />
        </span>
        <span class="text-base font-semibold tracking-tight">POS Admin</span>
      </div>

      <div class="space-y-4">
        <h2 class="text-2xl leading-tight font-semibold">
          Kelola toko Anda dengan tenang.
        </h2>
        <p class="text-sm leading-relaxed text-brand-100">
          Pantau penjualan, stok, dan kinerja kasir dari satu dasbor terintegrasi. Masuk untuk
          melanjutkan ke ruang kerja Anda.
        </p>
        <ul class="space-y-2.5 text-sm text-brand-100">
          <li class="flex items-start gap-2.5">
            <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-white" />
            <span>Akses berbasis peran untuk admin dan kasir.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-white" />
            <span>Laporan penjualan & laba secara real-time.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-white" />
            <span>Inventori, promo, dan shift dalam satu tempat.</span>
          </li>
        </ul>
      </div>

      <p class="text-xs text-brand-200">© {new Date().getFullYear()} POS Admin. Semua hak dilindungi.</p>
    </aside>

    <!-- Form panel -->
    <div class="px-6 py-10 sm:px-10">
      <div class="mx-auto w-full max-w-sm">
        <div class="mb-8 flex items-center gap-2.5 lg:hidden">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"
          >
            <Store class="h-5 w-5" />
          </span>
          <span class="text-base font-semibold tracking-tight text-slate-900">POS Admin</span>
        </div>

        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Masuk ke akun Anda</h1>
        <p class="mt-1.5 text-sm text-slate-500">
          Gunakan username dan kata sandi untuk melanjutkan.
        </p>

        <form class="mt-7 space-y-4" onsubmit={submit} novalidate>
          {#if error}
            <Alert variant="error" title="Tidak bisa masuk">{error}</Alert>
          {/if}

          <Input
            label="Email"
            type="email"
            autocomplete="email"
            placeholder="mis. admin@pos.local"
            bind:value={email}
            disabled={submitting}
          >
            {#snippet leading()}<User class="h-4 w-4" />{/snippet}
          </Input>

          <Input
            label="Kata sandi"
            type={showPassword ? 'text' : 'password'}
            autocomplete="current-password"
            placeholder="••••••••"
            bind:value={password}
            disabled={submitting}
          >
            {#snippet leading()}<Lock class="h-4 w-4" />{/snippet}
            {#snippet trailing()}
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-slate-600"
                onclick={() => (showPassword = !showPassword)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {#if showPassword}
                  <EyeOff class="h-4 w-4" />
                {:else}
                  <Eye class="h-4 w-4" />
                {/if}
              </button>
            {/snippet}
          </Input>

          <div class="flex items-center justify-between">
            <Checkbox bind:checked={rememberMe} label="Ingat saya" />
            <a
              href="/login"
              onclick={(e) => {
                e.preventDefault();
                toast.info('Hubungi admin', 'Mintalah admin untuk mengatur ulang kata sandi Anda.');
              }}
              class="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Lupa kata sandi?
            </a>
          </div>

          <Button type="submit" size="lg" fullWidth loading={submitting} disabled={submitting}>
            <LogIn class="h-4 w-4" />
            Masuk
          </Button>
        </form>

        <div class="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="text-xs text-slate-600">
              <p class="font-medium text-slate-700">Akun demo</p>
              <p class="mt-0.5 leading-relaxed">
                <span class="font-mono">admin@pos.local</span> /
                <span class="font-mono">admin123</span>
              </p>
              <p class="mt-0.5 text-slate-400">Seed dari backend via <code>docker compose run --rm seed</code>.</p>
            </div>
            <button
              type="button"
              onclick={fillDemo}
              class="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Pakai admin
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
