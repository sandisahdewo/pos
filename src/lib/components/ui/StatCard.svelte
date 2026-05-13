<script lang="ts">
  import { ArrowUpRight, ArrowDownRight } from 'lucide-svelte';

  type Props = {
    label: string;
    value: string | number;
    change?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: any;
    accent?: 'brand' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
    class?: string;
  };

  let { label, value, change, icon, accent = 'brand', class: klass = '' }: Props = $props();

  const accents = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600'
  } as const;

  const isPositive = $derived(change !== undefined && change >= 0);
  const Icon = $derived(icon);
</script>

<div
  class="flex items-center justify-between rounded-card border border-slate-200 bg-white p-5 shadow-card {klass}"
>
  <div>
    <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    {#if change !== undefined}
      <div class="mt-2 flex items-center gap-1 text-xs font-medium">
        <span class={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
          {#if isPositive}
            <ArrowUpRight class="inline h-3.5 w-3.5" />
          {:else}
            <ArrowDownRight class="inline h-3.5 w-3.5" />
          {/if}
          {Math.abs(change)}%
        </span>
        <span class="text-slate-400">vs last week</span>
      </div>
    {/if}
  </div>
  {#if Icon}
    <div class="flex h-11 w-11 items-center justify-center rounded-xl {accents[accent]}">
      <Icon class="h-5 w-5" />
    </div>
  {/if}
</div>
