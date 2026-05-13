<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'class'> & {
    label?: string;
    hint?: string;
    error?: string;
    leading?: Snippet;
    trailing?: Snippet;
    class?: string;
  };

  let {
    label,
    hint,
    error,
    leading,
    trailing,
    id = crypto.randomUUID(),
    value = $bindable(''),
    class: klass = '',
    ...rest
  }: Props = $props();
</script>

<div class={klass}>
  {#if label}
    <label for={id} class="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
  {/if}
  <div class="relative">
    {#if leading}
      <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">
        {@render leading()}
      </span>
    {/if}
    <input
      {id}
      bind:value
      {...rest}
      class="block w-full rounded-lg border bg-white py-2 text-sm text-slate-900 shadow-soft transition placeholder:text-slate-400 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500
        {error
        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
        : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'}
        {leading ? 'pl-9' : 'pl-3'}
        {trailing ? 'pr-9' : 'pr-3'}"
    />
    {#if trailing}
      <span class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400">
        {@render trailing()}
      </span>
    {/if}
  </div>
  {#if error}
    <p class="mt-1.5 text-xs text-rose-600">{error}</p>
  {:else if hint}
    <p class="mt-1.5 text-xs text-slate-500">{hint}</p>
  {/if}
</div>
