<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { X } from 'lucide-svelte';

  type Props = {
    open?: boolean;
    title?: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    closeOnBackdrop?: boolean;
    footer?: Snippet;
    children?: Snippet;
    onClose?: () => void;
  };

  let {
    open = $bindable(false),
    title,
    description,
    size = 'md',
    closeOnBackdrop = true,
    footer,
    children,
    onClose
  }: Props = $props();

  const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-[95vw]'
  } as const;

  function close() {
    open = false;
    onClose?.();
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) close();
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <button
      type="button"
      aria-label="Tutup"
      class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      transition:fade={{ duration: 150 }}
      onclick={() => closeOnBackdrop && close()}
    ></button>

    <div
      transition:scale={{ duration: 180, start: 0.96 }}
      class="relative flex w-full {sizeMap[
        size
      ]} max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
    >
      {#if title || description}
        <div class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {#if title}
              <h2 class="text-base font-semibold text-slate-900">{title}</h2>
            {/if}
            {#if description}
              <p class="mt-0.5 text-sm text-slate-500">{description}</p>
            {/if}
          </div>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup modal"
            onclick={close}
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      {/if}

      <div class="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
        {@render children?.()}
      </div>

      {#if footer}
        <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
