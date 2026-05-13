<script lang="ts">
  type Props = {
    value: number;
    max?: number;
    label?: string;
    showValue?: boolean;
    variant?: 'brand' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md';
    class?: string;
  };

  let {
    value,
    max = 100,
    label,
    showValue = false,
    variant = 'brand',
    size = 'md',
    class: klass = ''
  }: Props = $props();

  const pct = $derived(Math.max(0, Math.min(100, (value / max) * 100)));

  const variantClasses = {
    brand: 'bg-brand-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500'
  } as const;

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2'
  } as const;
</script>

<div class={klass}>
  {#if label || showValue}
    <div class="mb-1.5 flex items-center justify-between text-xs">
      {#if label}
        <span class="font-medium text-slate-700">{label}</span>
      {/if}
      {#if showValue}
        <span class="font-mono tabular-nums text-slate-500">{Math.round(pct)}%</span>
      {/if}
    </div>
  {/if}
  <div
    class="w-full overflow-hidden rounded-full bg-slate-100 {sizeClasses[size]}"
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin="0"
    aria-valuemax={max}
  >
    <div
      class="h-full rounded-full transition-all duration-300 {variantClasses[variant]}"
      style:width="{pct}%"
    ></div>
  </div>
</div>
