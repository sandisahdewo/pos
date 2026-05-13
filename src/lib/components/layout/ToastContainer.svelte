<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-svelte';
  import { toast, type ToastType } from '$lib/stores/toast.svelte';

  const iconMap: Record<ToastType, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info
  };

  const styles: Record<ToastType, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-sky-200 bg-sky-50 text-sky-900'
  };

  const iconColor: Record<ToastType, string> = {
    success: 'text-emerald-600',
    error: 'text-rose-600',
    warning: 'text-amber-600',
    info: 'text-sky-600'
  };
</script>

<div class="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
  {#each toast.toasts as t (t.id)}
    {@const Icon = iconMap[t.type]}
    <div
      in:fly={{ x: 16, duration: 180 }}
      out:fade={{ duration: 120 }}
      class="pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-soft {styles[
        t.type
      ]}"
      role="status"
    >
      <Icon class="mt-0.5 h-5 w-5 shrink-0 {iconColor[t.type]}" />
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">{t.title}</div>
        {#if t.message}
          <div class="mt-0.5 text-xs opacity-80">{t.message}</div>
        {/if}
      </div>
      <button
        type="button"
        class="rounded-md p-1 opacity-60 hover:bg-black/5 hover:opacity-100"
        onclick={() => toast.remove(t.id)}
        aria-label="Dismiss"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  {/each}
</div>
