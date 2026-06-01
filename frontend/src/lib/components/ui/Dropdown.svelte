<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronDown } from 'lucide-svelte';
  import { fly } from 'svelte/transition';
  import { clickOutside } from '$lib/actions/clickOutside';

  type Props = {
    label?: string;
    align?: 'left' | 'right';
    children?: Snippet<[{ close: () => void }]>;
    trigger?: Snippet<[{ open: boolean; toggle: () => void }]>;
    class?: string;
  };

  let { label = 'Options', align = 'left', children, trigger, class: klass = '' }: Props =
    $props();

  let open = $state(false);

  function toggle() {
    open = !open;
  }
  function close() {
    open = false;
  }
</script>

<div class="relative inline-block {klass}" use:clickOutside={close}>
  {#if trigger}
    {@render trigger({ open, toggle })}
  {:else}
    <button
      type="button"
      onclick={toggle}
      class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-soft hover:bg-slate-50"
    >
      {label}
      <ChevronDown class="h-4 w-4 text-slate-400 transition-transform {open ? 'rotate-180' : ''}" />
    </button>
  {/if}

  {#if open}
    <div
      transition:fly={{ y: -4, duration: 120 }}
      class="absolute z-30 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg {align ===
      'right'
        ? 'right-0'
        : 'left-0'}"
      role="menu"
    >
      {@render children?.({ close })}
    </div>
  {/if}
</div>
