<script lang="ts">
  type Tab = { value: string; label: string; badge?: string };

  type Props = {
    tabs: Tab[];
    value?: string;
    class?: string;
    onchange?: (value: string) => void;
  };

  let { tabs, value = $bindable(''), class: klass = '', onchange }: Props = $props();

  $effect(() => {
    if (!value && tabs.length > 0) value = tabs[0].value;
  });

  function select(v: string) {
    value = v;
    onchange?.(v);
  }
</script>

<div role="tablist" class="flex gap-1 border-b border-slate-200 {klass}">
  {#each tabs as tab}
    {@const active = value === tab.value}
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onclick={() => select(tab.value)}
      class="-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors
        {active
        ? 'border-brand-600 text-brand-700'
        : 'border-transparent text-slate-500 hover:text-slate-700'}"
    >
      {tab.label}
      {#if tab.badge}
        <span
          class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {active
            ? 'bg-brand-100 text-brand-700'
            : 'bg-slate-100 text-slate-600'}"
        >
          {tab.badge}
        </span>
      {/if}
    </button>
  {/each}
</div>
