<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';
  import type { HTMLSelectAttributes } from 'svelte/elements';

  type Option = { value: string; label: string; disabled?: boolean };

  type Props = Omit<HTMLSelectAttributes, 'class'> & {
    label?: string;
    hint?: string;
    error?: string;
    options: Option[];
    placeholder?: string;
    class?: string;
  };

  let {
    label,
    hint,
    error,
    options,
    placeholder,
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
    <select
      {id}
      bind:value
      {...rest}
      class="block w-full appearance-none rounded-lg border bg-white py-2 pr-9 pl-3 text-sm text-slate-900 shadow-soft transition focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50
        {error
        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
        : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'}"
    >
      {#if placeholder}
        <option value="" disabled selected={!value}>{placeholder}</option>
      {/if}
      {#each options as opt}
        <option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
      {/each}
    </select>
    <ChevronDown
      class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400"
    />
  </div>
  {#if error}
    <p class="mt-1.5 text-xs text-rose-600">{error}</p>
  {:else if hint}
    <p class="mt-1.5 text-xs text-slate-500">{hint}</p>
  {/if}
</div>
