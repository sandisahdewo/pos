<script lang="ts">
  import { Calendar } from 'lucide-svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'class' | 'type'> & {
    label?: string;
    hint?: string;
    error?: string;
    mode?: 'date' | 'time' | 'datetime-local' | 'month' | 'week';
    class?: string;
  };

  let {
    label,
    hint,
    error,
    mode = 'date',
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
    <Calendar class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      {id}
      type={mode}
      bind:value
      {...rest}
      class="block w-full rounded-lg border bg-white py-2 pr-3 pl-9 text-sm text-slate-900 shadow-soft transition focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50
        {error
        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
        : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'}"
    />
  </div>
  {#if error}
    <p class="mt-1.5 text-xs text-rose-600">{error}</p>
  {:else if hint}
    <p class="mt-1.5 text-xs text-slate-500">{hint}</p>
  {/if}
</div>
