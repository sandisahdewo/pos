<script lang="ts">
  import { HelpCircle } from 'lucide-svelte';

  type Props = {
    content: string;
    label?: string;
    size?: 'sm' | 'md';
    align?: 'start' | 'center' | 'end';
    class?: string;
  };

  let {
    content,
    label = 'Bantuan',
    size = 'sm',
    align = 'center',
    class: klass = ''
  }: Props = $props();

  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();

  function onDocClick(e: MouseEvent) {
    if (!open) return;
    if (trigger && e.target instanceof Node && trigger.contains(e.target)) return;
    open = false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }

  $effect(() => {
    if (!open) return;
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  });

  const alignClass = $derived(
    align === 'start'
      ? 'left-0'
      : align === 'end'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2'
  );
</script>

<span class="relative inline-flex {klass}">
  <button
    bind:this={trigger}
    type="button"
    aria-label={label}
    aria-expanded={open}
    onclick={() => (open = !open)}
    onmouseenter={() => (open = true)}
    onmouseleave={() => (open = false)}
    onfocus={() => (open = true)}
    onblur={() => (open = false)}
    class="inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 focus:text-slate-700 focus:outline-none {size ===
    'sm'
      ? 'h-4 w-4'
      : 'h-5 w-5'}"
  >
    <HelpCircle class={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
  </button>
  {#if open}
    <span
      role="tooltip"
      class="absolute top-full z-50 mt-1.5 w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-relaxed font-normal text-slate-700 shadow-lg {alignClass}"
    >
      {content}
    </span>
  {/if}
</span>
