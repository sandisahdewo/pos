<script lang="ts" module>
  export type ButtonVariant =
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'danger'
    | 'success';
  export type ButtonSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  type Props = Omit<HTMLButtonAttributes, 'class'> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    fullWidth?: boolean;
    href?: string;
    target?: HTMLAnchorAttributes['target'];
    rel?: HTMLAnchorAttributes['rel'];
    children?: Snippet;
    class?: string;
  };

  let {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    href,
    target,
    rel,
    children,
    class: klass = '',
    type = 'button',
    ...rest
  }: Props = $props();

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9 px-4 text-sm gap-2',
    lg: 'h-11 px-5 text-sm gap-2'
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-soft focus-visible:ring-brand-500',
    secondary:
      'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-700 shadow-soft focus-visible:ring-slate-700',
    outline:
      'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-slate-300',
    ghost: 'text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-300',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-soft focus-visible:ring-rose-500',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-soft focus-visible:ring-emerald-500'
  };
</script>

{#if href && !disabled && !loading}
  <a
    {href}
    {target}
    {rel}
    class="inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors duration-150 {sizeClasses[
      size
    ]} {variantClasses[variant]} {fullWidth ? 'w-full' : ''} {klass}"
  >
    {@render children?.()}
  </a>
{:else}
  <button
    {type}
    {...rest}
    disabled={disabled || loading}
    class="inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 {sizeClasses[
      size
    ]} {variantClasses[variant]} {fullWidth ? 'w-full' : ''} {klass}"
  >
    {#if loading}
      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    {/if}
    {@render children?.()}
  </button>
{/if}
