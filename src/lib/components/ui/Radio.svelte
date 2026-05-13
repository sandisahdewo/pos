<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'class' | 'type'> & {
    label?: string;
    description?: string;
    group?: string;
    class?: string;
  };

  let {
    label,
    description,
    id = crypto.randomUUID(),
    group = $bindable(''),
    value,
    disabled = false,
    name,
    class: klass = '',
    ...rest
  }: Props = $props();
</script>

<label
  for={id}
  class="flex cursor-pointer items-start gap-2.5 {disabled
    ? 'cursor-not-allowed opacity-60'
    : ''} {klass}"
>
  <span class="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
    <input
      {id}
      type="radio"
      bind:group
      {value}
      {disabled}
      {name}
      {...rest}
      class="peer h-5 w-5 cursor-[inherit] appearance-none rounded-full border border-slate-300 bg-white transition checked:border-brand-600 hover:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
    />
    <span
      class="pointer-events-none absolute h-2 w-2 rounded-full bg-brand-600 opacity-0 peer-checked:opacity-100"
    ></span>
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
