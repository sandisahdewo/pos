<script lang="ts">
  import { Check } from 'lucide-svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'class' | 'type'> & {
    label?: string;
    description?: string;
    class?: string;
  };

  let {
    label,
    description,
    id = crypto.randomUUID(),
    checked = $bindable(false),
    disabled = false,
    class: klass = '',
    ...rest
  }: Props = $props();
</script>

<label
  for={id}
  class="group flex cursor-pointer items-start gap-2.5 {disabled
    ? 'cursor-not-allowed opacity-60'
    : ''} {klass}"
>
  <span class="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
    <input
      {id}
      type="checkbox"
      bind:checked
      {disabled}
      {...rest}
      class="peer absolute inset-0 h-5 w-5 cursor-[inherit] appearance-none rounded-md border border-slate-300 bg-white transition checked:border-brand-600 checked:bg-brand-600 hover:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
    />
    <Check
      class="pointer-events-none h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
      strokeWidth={3}
    />
  </span>
  {#if label || description}
    <span class="select-none">
      {#if label}
        <span class="block text-sm font-medium text-slate-800">{label}</span>
      {/if}
      {#if description}
        <span class="mt-0.5 block text-xs text-slate-500">{description}</span>
      {/if}
    </span>
  {/if}
</label>
