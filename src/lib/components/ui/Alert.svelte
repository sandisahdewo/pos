<script lang="ts" module>
  export type AlertVariant = 'info' | 'success' | 'warning' | 'error';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-svelte';

  type Props = {
    variant?: AlertVariant;
    title?: string;
    dismissible?: boolean;
    children?: Snippet;
    actions?: Snippet;
    class?: string;
    onDismiss?: () => void;
  };

  let {
    variant = 'info',
    title,
    dismissible = false,
    children,
    actions,
    class: klass = '',
    onDismiss
  }: Props = $props();

  let visible = $state(true);

  const iconMap = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle
  } as const;

  const variantClasses: Record<AlertVariant, string> = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900'
  };

  const iconColor: Record<AlertVariant, string> = {
    info: 'text-sky-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    error: 'text-rose-600'
  };

  const Icon = $derived(iconMap[variant]);

  function dismiss() {
    visible = false;
    onDismiss?.();
  }
</script>

{#if visible}
  <div
    role="alert"
    class="flex items-start gap-3 rounded-xl border px-4 py-3 {variantClasses[variant]} {klass}"
  >
    <Icon class="mt-0.5 h-5 w-5 shrink-0 {iconColor[variant]}" />
    <div class="min-w-0 flex-1">
      {#if title}
        <div class="text-sm font-semibold">{title}</div>
      {/if}
      {#if children}
        <div class="text-sm {title ? 'mt-0.5 opacity-90' : ''}">
          {@render children()}
        </div>
      {/if}
      {#if actions}
        <div class="mt-2">
          {@render actions()}
        </div>
      {/if}
    </div>
    {#if dismissible}
      <button
        type="button"
        class="rounded-md p-1 opacity-60 hover:bg-black/5 hover:opacity-100"
        onclick={dismiss}
        aria-label="Tutup"
      >
        <X class="h-4 w-4" />
      </button>
    {/if}
  </div>
{/if}
