<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    title?: string;
    description?: string;
    padded?: boolean;
    header?: Snippet;
    footer?: Snippet;
    children?: Snippet;
    class?: string;
  };

  let {
    title,
    description,
    padded = true,
    header,
    footer,
    children,
    class: klass = ''
  }: Props = $props();
</script>

<div class="rounded-card border border-slate-200 bg-white shadow-card {klass}">
  {#if header || title || description}
    <div
      class="flex items-center justify-between gap-4 rounded-t-card border-b border-slate-100 px-5 py-4"
    >
      <div class="min-w-0">
        {#if title}
          <h3 class="text-sm font-semibold text-slate-900">{title}</h3>
        {/if}
        {#if description}
          <p class="mt-0.5 text-xs text-slate-500">{description}</p>
        {/if}
      </div>
      {#if header}
        <div class="shrink-0">{@render header()}</div>
      {/if}
    </div>
  {/if}
  <div class={padded ? 'px-5 py-4' : ''}>
    {@render children?.()}
  </div>
  {#if footer}
    <div class="rounded-b-card border-t border-slate-100 bg-slate-50/60 px-5 py-3">
      {@render footer()}
    </div>
  {/if}
</div>
