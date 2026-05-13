<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronRight } from 'lucide-svelte';

  type Props = {
    title: string;
    count?: number;
    open?: boolean;
    children?: Snippet;
    class?: string;
    headerClass?: string;
  };

  let {
    title,
    count,
    open = $bindable(false),
    children,
    class: klass = '',
    headerClass = ''
  }: Props = $props();
</script>

<div class={klass}>
  <button
    type="button"
    onclick={() => (open = !open)}
    class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 {headerClass}"
    aria-expanded={open}
  >
    <ChevronRight class="h-3.5 w-3.5 transition-transform {open ? 'rotate-90' : ''}" />
    <span>{title}</span>
    {#if count !== undefined && count > 0}
      <span class="ml-0.5 rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">
        {count}
      </span>
    {/if}
  </button>
  {#if open}
    <div class="mt-2">
      {@render children?.()}
    </div>
  {/if}
</div>
