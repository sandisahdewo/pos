<script lang="ts">
  type Props = {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    description?: string;
    size?: 'sm' | 'md';
    id?: string;
    class?: string;
    onchange?: (checked: boolean) => void;
  };

  let {
    checked = $bindable(false),
    disabled = false,
    label,
    description,
    size = 'md',
    id = crypto.randomUUID(),
    class: klass = '',
    onchange
  }: Props = $props();

  const dims = $derived(
    size === 'sm'
      ? { track: 'h-5 w-9', thumb: 'h-3.5 w-3.5', translate: 'translate-x-4' }
      : { track: 'h-6 w-11', thumb: 'h-4 w-4', translate: 'translate-x-5' }
  );

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }
</script>

<label for={id} class="flex items-start gap-3 {disabled ? 'opacity-60' : ''} {klass}">
  <button
    {id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label ?? 'Alihkan'}
    {disabled}
    onclick={toggle}
    class="relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors focus:ring-2 focus:ring-brand-200 focus:outline-none disabled:cursor-not-allowed {dims.track} {checked
      ? 'bg-brand-600'
      : 'bg-slate-300'}"
  >
    <span
      class="inline-block transform rounded-full bg-white shadow transition-transform {dims.thumb} {checked
        ? dims.translate
        : 'translate-x-1'}"
    ></span>
  </button>
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
