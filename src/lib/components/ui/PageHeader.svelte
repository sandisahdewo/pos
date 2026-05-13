<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    description?: string;
    actions?: Snippet;
    breadcrumb?: { label: string; href?: string }[];
    class?: string;
  };

  let { title, description, actions, breadcrumb, class: klass = '' }: Props = $props();
</script>

<div class="mb-6 {klass}">
  {#if breadcrumb && breadcrumb.length > 0}
    <nav class="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
      {#each breadcrumb as crumb, i}
        {#if crumb.href}
          <a href={crumb.href} class="hover:text-slate-700">{crumb.label}</a>
        {:else}
          <span>{crumb.label}</span>
        {/if}
        {#if i < breadcrumb.length - 1}
          <span class="text-slate-300">/</span>
        {/if}
      {/each}
    </nav>
  {/if}
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div class="min-w-0">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {#if description}
        <p class="mt-1 text-sm text-slate-500">{description}</p>
      {/if}
    </div>
    {#if actions}
      <div class="flex shrink-0 items-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>
