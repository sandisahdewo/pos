<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    children?: Snippet;
    href?: string;
    danger?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    class?: string;
  };

  let { children, href, danger = false, disabled = false, onclick, class: klass = '' }: Props =
    $props();

  const base =
    'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left';
  const tone = $derived(
    danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
  );
  const disabledCls = $derived(disabled ? 'opacity-50 cursor-not-allowed' : '');
</script>

{#if href}
  <a {href} class="{base} {tone} {disabledCls} {klass}" role="menuitem">
    {@render children?.()}
  </a>
{:else}
  <button type="button" {onclick} {disabled} class="{base} {tone} {disabledCls} {klass}" role="menuitem">
    {@render children?.()}
  </button>
{/if}
