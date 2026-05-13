<script lang="ts">
  import Input from './Input.svelte';
  import MoneyInput from './MoneyInput.svelte';
  import Select from './Select.svelte';
  import { formatRupiah } from '$lib/utils/currency';
  import {
    computeSalePrice,
    isPercentKind,
    pricingKindOptions,
    type PricingKind,
    type PricingStrategy
  } from '$lib/stores/products.svelte';

  type Props = {
    cost: number;
    strategy: PricingStrategy;
    label?: string;
    error?: string;
    compact?: boolean;
  };

  let {
    cost,
    strategy = $bindable(),
    label,
    error,
    compact = false
  }: Props = $props();

  let kind = $state<PricingKind>(strategy.kind);
  let value = $state<number>(strategy.value);

  $effect(() => {
    if (strategy.kind !== kind || strategy.value !== value) {
      strategy = { kind, value } as PricingStrategy;
    }
  });

  const pct = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0
  });

  const sale = $derived(computeSalePrice(cost, strategy));
  const valid = $derived(Number.isFinite(sale) && sale >= 0);
  const markup = $derived(cost > 0 && valid ? ((sale - cost) / cost) * 100 : null);
  const margin = $derived(sale > 0 && valid ? ((sale - cost) / sale) * 100 : null);

  const isCurrencyValue = $derived(!isPercentKind(kind));
</script>

<div>
  {#if label && !compact}
    <span class="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
  {/if}
  {#if label && compact}
    <span class="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
  {/if}

  <div class="grid grid-cols-[1.3fr_1.2fr] gap-2">
    <Select bind:value={kind} options={pricingKindOptions} />
    {#if isCurrencyValue}
      <MoneyInput bind:value placeholder="0" />
    {:else}
      <Input type="number" step="any" min="0" placeholder="0" bind:value>
        {#snippet trailing()}
          <span class="text-xs font-medium text-slate-400">%</span>
        {/snippet}
      </Input>
    {/if}
  </div>

  {#if error}
    <p class="mt-1.5 text-xs text-rose-600">{error}</p>
  {:else if !valid}
    <p class="mt-1.5 text-xs text-rose-600">Invalid pricing configuration.</p>
  {:else if compact}
    <p class="mt-1 text-xs text-slate-500">
      Sale: <span class="font-medium text-slate-900">{formatRupiah(sale)}</span>
    </p>
  {:else}
    <div class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
      <span class="text-slate-500">
        Sale price:
        <span class="text-base font-semibold text-slate-900">{formatRupiah(sale)}</span>
      </span>
      {#if markup !== null}
        <span class="text-slate-500">
          Markup <span class="font-medium text-slate-700">{pct.format(markup)}%</span>
        </span>
      {/if}
      {#if margin !== null}
        <span class="text-slate-500">
          Margin <span class="font-medium text-slate-700">{pct.format(margin)}%</span>
        </span>
      {/if}
    </div>
  {/if}
</div>
