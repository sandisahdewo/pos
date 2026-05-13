<script lang="ts">
  import { Plus, Trash2 } from 'lucide-svelte';
  import { Button, Input, PricingInput } from '$lib/components/ui';
  import type { PricingTier } from '$lib/stores/products.svelte';

  type Props = {
    cost: number;
    tiers: PricingTier[];
    errors?: Record<string, string>;
    keyPrefix?: string;
  };

  let { cost, tiers = $bindable<PricingTier[]>([]), errors = {}, keyPrefix = '' }: Props = $props();

  function addTier() {
    const maxQty = tiers.length > 0 ? Math.max(...tiers.map((t) => t.minQty)) : 1;
    tiers = [
      ...tiers,
      { minQty: maxQty + 1, pricing: { kind: 'fixed', value: 0 } }
    ];
  }

  function removeTier(i: number) {
    tiers = tiers.filter((_, idx) => idx !== i);
  }
</script>

<div>
  <div class="mb-2 flex items-center justify-between gap-2">
    <span class="text-xs font-medium text-slate-700">
      Quantity tiers
      {#if tiers.length > 0}
        <span class="ml-1 text-slate-400">({tiers.length})</span>
      {/if}
    </span>
    <Button variant="outline" size="sm" onclick={addTier}>
      <Plus class="h-3.5 w-3.5" />
      Add tier
    </Button>
  </div>

  {#if tiers.length === 0}
    <p
      class="rounded border border-dashed border-slate-200 bg-slate-50/60 py-2 text-center text-xs text-slate-400"
    >
      No volume discounts. Base pricing applies at all quantities.
    </p>
  {:else}
    <div class="space-y-2">
      {#each tiers as tier, i (i)}
        <div
          class="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-[110px_1fr_auto] sm:items-end"
        >
          <Input
            label="Min qty"
            type="number"
            min="1"
            step="1"
            bind:value={tier.minQty}
            error={errors[`${keyPrefix}t${i}_qty`]}
          />
          <PricingInput
            compact
            label="Price at this qty+"
            {cost}
            bind:strategy={tier.pricing}
            error={errors[`${keyPrefix}t${i}_pricing`]}
          />
          <button
            type="button"
            class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Remove tier"
            onclick={() => removeTier(i)}
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
