<script lang="ts">
  import { ChevronDown, ChevronUp, Coins } from 'lucide-svelte';
  import { MoneyInput } from '$lib/components/ui';
  import {
    IDR_DENOMINATIONS,
    denominationTotal,
    type CashCount,
    type CashDenomination
  } from '$lib/stores/shifts.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type Props = {
    value: CashCount;
    label?: string;
    hint?: string;
    disabled?: boolean;
    error?: string;
  };

  let {
    value = $bindable<CashCount>({ total: 0 }),
    label = 'Kas',
    hint,
    disabled = false,
    error
  }: Props = $props();

  let expanded = $state(!!value.denominations);

  function ensureDenoms(): CashDenomination[] {
    if (!value.denominations) {
      value.denominations = IDR_DENOMINATIONS.map((unit) => ({ unit, count: 0 }));
    }
    return value.denominations;
  }

  function toggleExpand() {
    if (disabled) return;
    if (!expanded) {
      ensureDenoms();
      expanded = true;
    } else {
      expanded = false;
      value.denominations = undefined;
    }
  }

  function onCountChange(unit: number, raw: string) {
    const n = Math.max(0, Number(raw.replace(/[^\d]/g, '')) || 0);
    const denoms = ensureDenoms();
    const idx = denoms.findIndex((d) => d.unit === unit);
    if (idx === -1) return;
    denoms[idx] = { unit, count: n };
    value.total = denominationTotal(denoms);
  }
</script>

<div>
  {#if label}
    <div class="mb-1.5 block text-sm font-medium text-slate-700">{label}</div>
  {/if}

  <div class="rounded-lg border border-slate-200 bg-white">
    <div class="p-3">
      <MoneyInput bind:value={value.total} {disabled} />
      {#if error}
        <p class="mt-1.5 text-xs text-rose-600">{error}</p>
      {:else if hint}
        <p class="mt-1.5 text-xs text-slate-500">{hint}</p>
      {/if}
    </div>

    <button
      type="button"
      class="flex w-full items-center justify-between border-t border-slate-100 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed"
      {disabled}
      onclick={toggleExpand}
    >
      <span class="flex items-center gap-1.5">
        <Coins class="h-3.5 w-3.5 text-slate-400" />
        {expanded ? 'Sembunyikan rincian per pecahan' : 'Hitung per pecahan (opsional)'}
      </span>
      {#if expanded}
        <ChevronUp class="h-4 w-4 text-slate-400" />
      {:else}
        <ChevronDown class="h-4 w-4 text-slate-400" />
      {/if}
    </button>

    {#if expanded && value.denominations}
      <div class="space-y-1.5 border-t border-slate-100 bg-slate-50/50 p-3">
        {#each value.denominations as d (d.unit)}
          {@const sub = d.unit * d.count}
          <div class="flex items-center gap-2">
            <div class="w-24 text-xs font-medium text-slate-700">
              {formatRupiah(d.unit)}
            </div>
            <span class="text-slate-400">×</span>
            <input
              type="number"
              inputmode="numeric"
              min="0"
              value={d.count}
              {disabled}
              oninput={(e) => onCountChange(d.unit, (e.currentTarget as HTMLInputElement).value)}
              class="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
            <div class="flex-1 text-right text-xs font-medium text-slate-600">
              {sub > 0 ? formatRupiah(sub) : '—'}
            </div>
          </div>
        {/each}
        <div class="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
          <span class="text-xs font-semibold text-slate-700">Total dari pecahan</span>
          <span class="text-sm font-bold text-slate-900">
            {formatRupiah(denominationTotal(value.denominations))}
          </span>
        </div>
        <p class="text-[11px] text-slate-500">
          Total di atas akan otomatis terisi dari rincian ini.
        </p>
      </div>
    {/if}
  </div>
</div>
