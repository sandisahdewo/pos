<script lang="ts" module>
  export type BadgeVariant =
    | 'neutral'
    | 'brand'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'outline';
  export type BadgeSize = 'sm' | 'md';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;
    children?: Snippet;
    class?: string;
  };

  let { variant = 'neutral', size = 'md', dot = false, children, class: klass = '' }: Props =
    $props();

  const variantClasses: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-100 text-brand-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-700',
    info: 'bg-sky-100 text-sky-700',
    outline: 'border border-slate-200 bg-white text-slate-700'
  };

  const dotColor: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-500',
    brand: 'bg-brand-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-sky-500',
    outline: 'bg-slate-400'
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5'
  } as const;
</script>

<span
  class="inline-flex items-center rounded-full font-medium {sizeClasses[size]} {variantClasses[
    variant
  ]} {klass}"
>
  {#if dot}
    <span class="h-1.5 w-1.5 rounded-full {dotColor[variant]}"></span>
  {/if}
  {@render children?.()}
</span>
