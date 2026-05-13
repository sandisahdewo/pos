<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  type Props = Omit<HTMLTextareaAttributes, 'class'> & {
    label?: string;
    hint?: string;
    error?: string;
    class?: string;
  };

  let {
    label,
    hint,
    error,
    id = crypto.randomUUID(),
    value = $bindable(''),
    rows = 4,
    class: klass = '',
    ...rest
  }: Props = $props();
</script>

<div class={klass}>
  {#if label}
    <label for={id} class="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
  {/if}
  <textarea
    {id}
    {rows}
    bind:value
    {...rest}
    class="block w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-soft transition placeholder:text-slate-400 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50
      {error
      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
      : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'}"
  ></textarea>
  {#if error}
    <p class="mt-1.5 text-xs text-rose-600">{error}</p>
  {:else if hint}
    <p class="mt-1.5 text-xs text-slate-500">{hint}</p>
  {/if}
</div>
