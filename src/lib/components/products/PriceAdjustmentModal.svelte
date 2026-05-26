<script lang="ts" module>
  import type {
    PricelistEntry,
    PricingStrategy,
    Product,
    ProductPackaging,
    ProductVariant
  } from '$lib/stores/products.svelte';

  // One row in the modal — represents a single price entry (or one tier of one
  // entry). The parent applies a list of these back onto its form state.
  export type PriceChangePatch = {
    scope:
      | { kind: 'product' }
      | { kind: 'variant'; variantId: string }
      | { kind: 'packaging'; packagingIndex: number };
    pricelistId: string;
    tierIndex?: number; // undefined = base entry; set = a tier inside it
    newStrategy: PricingStrategy;
  };
</script>

<script lang="ts">
  import { Modal, Button, Input, Select } from '$lib/components/ui';
  import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-svelte';
  import {
    computeSalePrice,
    effectiveCost,
    effectiveVariantCost,
    type CompositeComponent
  } from '$lib/stores/products.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type Props = {
    open: boolean;
    product: Product;
    // Snapshot copies (so the modal previews what the form *would* save).
    // Parent passes form.prices / form.variants / form.units.
    productPrices: PricelistEntry[];
    variants: ProductVariant[];
    packagings: ProductPackaging[];
    // Base-unit cost used by markup-based strategies. Parent supplies this
    // because effectiveCost depends on form state (composite vs goods, edited
    // component list, etc.).
    baseCost: number;
    // The product's markup cost source. When set to anything but 'manual',
    // markup_* rows are hidden because any price we set would drift back as
    // soon as the next batch transitions.
    markupCostSource: 'manual' | 'fifo-current' | 'batch-avg';
    onApply: (patches: PriceChangePatch[], summary: string) => void;
    onClose: () => void;
  };

  let {
    open = $bindable(false),
    product,
    productPrices,
    variants,
    packagings,
    baseCost,
    markupCostSource,
    onApply,
    onClose
  }: Props = $props();

  // ─── Adjustment params ─────────────────────────────────────────────────
  // Two independent operations the user can mix in one pass:
  //   1. Sesuaikan markup — adds to the strategy value directly. Only meaningful
  //      for the matching strategy kind (markupPctDelta touches markup_pct rows,
  //      markupAmountDelta touches markup_amount rows).
  //   2. Naikkan harga jual — bumps the sale-price after step 1, with rounding,
  //      then back-writes to the strategy. Gated by source: only applies to
  //      `fixed` rows AND `markup_*` rows when `markupCostSource === 'manual'`.
  type SalePriceType = 'percent' | 'amount';
  type RoundDirection = 'auto' | 'up' | 'down' | 'nearest';

  let markupPctDelta = $state<number>(0); // poin, untuk baris markup_pct
  let markupAmountDelta = $state<number>(0); // Rp, untuk baris markup_amount
  let salePriceDelta = $state<number>(0); // nilai bump harga jual
  let salePriceType = $state<SalePriceType>('percent');
  let roundTo = $state<number>(500);
  let roundDirection = $state<RoundDirection>('auto');

  const salePriceTypeOptions = [
    { value: 'percent', label: 'Persen (%)' },
    { value: 'amount', label: 'Rupiah (Rp)' }
  ];

  const roundToOptions = [
    { value: 0, label: 'Tanpa pembulatan' },
    { value: 100, label: 'Bulatkan ke Rp 100' },
    { value: 500, label: 'Bulatkan ke Rp 500' },
    { value: 1000, label: 'Bulatkan ke Rp 1.000' },
    { value: 5000, label: 'Bulatkan ke Rp 5.000' }
  ];

  const roundDirectionOptions = [
    { value: 'auto', label: 'Otomatis (naik = atas, turun = bawah)' },
    { value: 'up', label: 'Selalu ke atas' },
    { value: 'down', label: 'Selalu ke bawah' },
    { value: 'nearest', label: 'Ke nilai terdekat' }
  ];

  // ─── Entry enumeration ─────────────────────────────────────────────────
  // One row per (scope × pricelist entry × optional tier).
  type EntryRow = {
    key: string;
    scope:
      | { kind: 'product' }
      | { kind: 'variant'; variantId: string }
      | { kind: 'packaging'; packagingIndex: number };
    scopeLabel: string;
    pricelistId: string;
    pricelistName: string;
    tierIndex?: number;
    tierLabel?: string;
    currentStrategy: PricingStrategy;
    cost: number; // base-unit cost driving markup computations
    currentSale: number;
  };

  const baseUnitCode = $derived(units.getById(product.unitId)?.code ?? '');

  function strategyKindLabel(kind: PricingStrategy['kind']): string {
    if (kind === 'markup_pct') return 'Persen untung';
    if (kind === 'markup_amount') return 'Biaya + nominal';
    return 'Harga tetap';
  }

  function scopeCost(scope: EntryRow['scope']): number {
    if (scope.kind === 'product') return baseCost;
    if (scope.kind === 'variant') {
      const v = variants.find((vv) => vv.id === scope.variantId);
      if (!v) return baseCost;
      return v.components.length > 0
        ? variantComponentsCost(v.components)
        : v.cost;
    }
    // packaging — cost scales with factor against the product's base cost
    const pkg = packagings[scope.packagingIndex];
    if (!pkg) return baseCost;
    return pkg.factor * baseCost;
  }

  // Local mirror of products.svelte's componentsCost — avoids a circular
  // import on the variant path while staying consistent.
  function variantComponentsCost(comps: CompositeComponent[]): number {
    // We don't actually have access to component cost here without going to
    // products.getById; fall back to variant.cost when components reference
    // products outside the form snapshot. The product form re-computes this
    // separately when saving, so this is only a preview approximation.
    let sum = 0;
    for (const c of comps) {
      const cp = product.id === c.productId ? product : undefined;
      const baseQty = c.quantity * (c.unitFactor ?? 1);
      if (!cp) {
        // Approximation: use the form's baseCost as a stand-in. The Apply
        // path still uses the live, accurate cost via the back-write.
        sum += baseQty * baseCost;
      } else {
        sum += baseQty * (cp.cost ?? 0);
      }
    }
    return sum;
  }

  // Whether a row's *sale-price* step can run — `fixed` rows always allow it,
  // `markup_*` rows only when source is manual (otherwise price drifts back).
  const sourceIsManual = $derived(markupCostSource === 'manual');

  function saleStepEligible(strategy: PricingStrategy): boolean {
    if (strategy.kind === 'fixed') return true;
    return sourceIsManual;
  }

  // All rows are enumerated — including markup rows on cost-following sources.
  // The per-row pipeline below decides which steps actually apply.
  const rows = $derived.by<EntryRow[]>(() => {
    const out: EntryRow[] = [];
    const pushEntries = (
      entries: PricelistEntry[],
      scope: EntryRow['scope'],
      scopeLabel: string
    ) => {
      const cost = scopeCost(scope);
      for (const entry of entries) {
        const pl = pricelists.getById(entry.pricelistId);
        if (!pl) continue;
        out.push({
          key: `${scopeKey(scope)}__${entry.pricelistId}`,
          scope,
          scopeLabel,
          pricelistId: entry.pricelistId,
          pricelistName: pl.name,
          currentStrategy: entry.pricing,
          cost,
          currentSale: computeSalePrice(cost, entry.pricing)
        });
        for (let i = 0; i < entry.tiers.length; i++) {
          const t = entry.tiers[i];
          out.push({
            key: `${scopeKey(scope)}__${entry.pricelistId}__t${i}`,
            scope,
            scopeLabel,
            pricelistId: entry.pricelistId,
            pricelistName: pl.name,
            tierIndex: i,
            tierLabel: `≥ ${t.minQty}`,
            currentStrategy: t.pricing,
            cost,
            currentSale: computeSalePrice(cost, t.pricing)
          });
        }
      }
    };

    pushEntries(productPrices, { kind: 'product' }, `Produk dasar (${baseUnitCode})`);
    for (const v of variants) {
      pushEntries(v.prices, { kind: 'variant', variantId: v.id }, `Varian ${v.name}`);
    }
    for (let i = 0; i < packagings.length; i++) {
      const pkg = packagings[i];
      const u = units.getById(pkg.unitId);
      pushEntries(
        pkg.prices,
        { kind: 'packaging', packagingIndex: i },
        `Kemasan ${u?.name ?? pkg.unitId} (isi ${pkg.factor})`
      );
    }
    return out;
  });

  function scopeKey(scope: EntryRow['scope']): string {
    if (scope.kind === 'product') return 'p';
    if (scope.kind === 'variant') return `v_${scope.variantId}`;
    return `k_${scope.packagingIndex}`;
  }

  // ─── Selection ─────────────────────────────────────────────────────────
  let selected = $state<Record<string, boolean>>({});
  // Seed selection — when the row set first appears or changes, default to
  // "all rows selected".
  let rowKeysSnapshot = $state<string>('');
  $effect(() => {
    const sig = rows.map((r) => r.key).join('|');
    if (sig !== rowKeysSnapshot) {
      rowKeysSnapshot = sig;
      const next: Record<string, boolean> = {};
      for (const r of rows) next[r.key] = true;
      selected = next;
    }
  });

  const allSelected = $derived(rows.length > 0 && rows.every((r) => selected[r.key]));
  const someSelected = $derived(rows.some((r) => selected[r.key]));

  function toggleAll() {
    const next: Record<string, boolean> = {};
    const target = !allSelected;
    for (const r of rows) next[r.key] = target;
    selected = next;
  }

  // ─── New-price computation ─────────────────────────────────────────────
  function applyRounding(value: number, intent: 'increase' | 'decrease' | 'zero'): number {
    if (!roundTo || roundTo <= 0) return value;
    let fn: (n: number) => number;
    switch (roundDirection) {
      case 'up':
        fn = Math.ceil;
        break;
      case 'down':
        fn = Math.floor;
        break;
      case 'nearest':
        fn = Math.round;
        break;
      case 'auto':
      default:
        // Auto: price hikes round UP (away from cost), cuts round DOWN.
        // Zero-delta rows are left alone if rounding would otherwise nudge.
        if (intent === 'increase') fn = Math.ceil;
        else if (intent === 'decrease') fn = Math.floor;
        else fn = Math.round;
        break;
    }
    return fn(value / roundTo) * roundTo;
  }

  // Step 1 — apply markup adjustment in-place (only when kind matches).
  function applyMarkupAdjust(strategy: PricingStrategy): PricingStrategy {
    if (strategy.kind === 'markup_pct' && markupPctDelta) {
      return { kind: 'markup_pct', value: strategy.value + markupPctDelta };
    }
    if (strategy.kind === 'markup_amount' && markupAmountDelta) {
      return { kind: 'markup_amount', value: Math.max(0, strategy.value + markupAmountDelta) };
    }
    return strategy;
  }

  // Step 3 — apply sale-price bump on top of the interim sale.
  function bumpSale(interim: number): number {
    const delta = salePriceDelta || 0;
    let next = salePriceType === 'percent' ? interim * (1 + delta / 100) : interim + delta;
    if (!Number.isFinite(next)) next = interim;
    if (next < 0) next = 0;
    const intent: 'increase' | 'decrease' | 'zero' =
      delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'zero';
    return applyRounding(next, intent);
  }

  // Step 4 — recompute the strategy from a target sale, preserving its kind.
  function backWriteStrategy(
    currentStrategy: PricingStrategy,
    cost: number,
    newSale: number
  ): { strategy: PricingStrategy; warning?: string } {
    switch (currentStrategy.kind) {
      case 'fixed':
        return { strategy: { kind: 'fixed', value: newSale } };
      case 'markup_amount':
        return {
          strategy: { kind: 'markup_amount', value: Math.max(0, newSale - cost) }
        };
      case 'markup_pct': {
        if (cost <= 0) {
          // Can't express new sale as a markup_pct of zero cost — convert to
          // fixed so we don't lose the price the user expects.
          return {
            strategy: { kind: 'fixed', value: newSale },
            warning: 'Biaya = 0, strategi diubah ke harga tetap.'
          };
        }
        return {
          strategy: { kind: 'markup_pct', value: ((newSale / cost) - 1) * 100 }
        };
      }
    }
  }

  type PreviewRow = EntryRow & {
    newSale: number;
    newStrategy: PricingStrategy;
    delta: number;
    warning?: string;
    changed: boolean;
    saleBumpApplied: boolean; // false when source-gated out
  };

  // Per-row pipeline:
  //   1) markup adjust (mutates strategy if kind matches)
  //   2) interim sale from adjusted strategy
  //   3) sale-price bump if eligible (fixed always; markup_* only when manual source)
  //   4) back-write strategy from final sale (preserving kind)
  const previewRows = $derived.by<PreviewRow[]>(() => {
    return rows.map((r) => {
      // Step 1
      const adjusted = applyMarkupAdjust(r.currentStrategy);
      // Step 2
      const interim = computeSalePrice(r.cost, adjusted);
      // Step 3 (conditional)
      const canBumpSale = saleStepEligible(adjusted) && (salePriceDelta || 0) !== 0;
      const finalSale = canBumpSale ? bumpSale(interim) : interim;
      // Step 4 (only when sale was bumped — otherwise keep step-1 strategy)
      let finalStrategy: PricingStrategy;
      let warning: string | undefined;
      if (canBumpSale) {
        const back = backWriteStrategy(adjusted, r.cost, finalSale);
        finalStrategy = back.strategy;
        warning = back.warning;
      } else {
        finalStrategy = adjusted;
      }
      return {
        ...r,
        newSale: finalSale,
        newStrategy: finalStrategy,
        delta: finalSale - r.currentSale,
        warning,
        changed: Math.abs(finalSale - r.currentSale) > 0.0001,
        saleBumpApplied: canBumpSale
      };
    });
  });

  const changedCount = $derived(
    previewRows.filter((r) => selected[r.key] && r.changed).length
  );

  // Build a human-readable summary of which adjustments were applied. Saved as
  // the `notes` field on the resulting PriceChange rows so the history view
  // can show "Naikkan harga jual +10% bulat Rp 500" instead of "(no context)".
  function buildSummary(): string {
    const parts: string[] = [];
    if (markupPctDelta) {
      parts.push(`Persen untung ${markupPctDelta > 0 ? '+' : ''}${markupPctDelta} poin`);
    }
    if (markupAmountDelta) {
      parts.push(
        `Markup Rp ${markupAmountDelta > 0 ? '+' : ''}${formatRupiah(Math.abs(markupAmountDelta))}`.replace(
          'Rp Rp',
          'Rp'
        )
      );
    }
    if (salePriceDelta) {
      const sign = salePriceDelta > 0 ? '+' : '';
      const valueLabel =
        salePriceType === 'percent'
          ? `${sign}${salePriceDelta}%`
          : `${sign}${formatRupiah(Math.abs(salePriceDelta))}`;
      const roundLabel = roundTo > 0 ? `, bulat Rp ${formatRupiah(roundTo).replace('Rp', '').trim()}` : '';
      parts.push(`Naikkan harga jual ${valueLabel}${roundLabel}`);
    }
    return parts.length > 0 ? `Sesuaikan harga · ${parts.join(' · ')}` : '';
  }

  function apply() {
    const patches: PriceChangePatch[] = [];
    for (const r of previewRows) {
      if (!selected[r.key]) continue;
      if (!r.changed) continue;
      patches.push({
        scope: r.scope,
        pricelistId: r.pricelistId,
        tierIndex: r.tierIndex,
        newStrategy: r.newStrategy
      });
    }
    if (patches.length > 0) onApply(patches, buildSummary());
    open = false;
    onClose();
  }

  function close() {
    open = false;
    onClose();
  }
</script>

<Modal bind:open size="2xl" title="Sesuaikan harga · {product.name}" {onClose}>
  <div class="space-y-5">
    {#if !sourceIsManual}
      <div class="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        <strong>Sumber biaya markup:</strong> bukan manual — harga markup mengikuti
        biaya batch / PO otomatis. <em>Sesuaikan markup</em> di bawah tetap bekerja
        (nilai markup berubah; harga jual otomatis ikut). <em>Naikkan harga jual</em>
        tidak diterapkan untuk baris markup (akan drift balik) — hanya baris harga
        tetap yang ikut bump-nya.
      </div>
    {/if}

    <!-- Section 1: Markup adjustment (operates on strategy value directly) -->
    <fieldset class="rounded-lg border border-slate-200 p-3">
      <legend class="px-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Sesuaikan markup <span class="font-normal normal-case text-slate-400">(opsional)</span>
      </legend>
      <p class="mb-3 text-xs text-slate-500">
        Tambah/kurangi nilai markup langsung. Hanya berlaku untuk baris dengan tipe yang cocok.
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <Input
          label="Persen untung (poin)"
          type="number"
          step="any"
          bind:value={markupPctDelta}
          hint="Untuk baris bertipe Persen untung. Contoh: +5 berarti 10% → 15%."
        />
        <Input
          label="Biaya + nominal (Rp)"
          type="number"
          step="any"
          bind:value={markupAmountDelta}
          hint="Untuk baris bertipe Biaya + nominal. Contoh: +500 berarti Rp 5.000 → Rp 5.500."
        />
      </div>
    </fieldset>

    <!-- Section 2: Sale-price bump (operates on resulting sale price, with rounding) -->
    <fieldset class="rounded-lg border border-slate-200 p-3">
      <legend class="px-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Naikkan harga jual <span class="font-normal normal-case text-slate-400">(opsional)</span>
      </legend>
      <p class="mb-3 text-xs text-slate-500">
        Bump harga jual hasil akhirnya, lalu pembulatan. Berlaku untuk semua baris harga
        tetap; untuk baris markup hanya kalau sumber biaya = manual.
      </p>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Tipe" bind:value={salePriceType} options={salePriceTypeOptions} />
        <Input
          label={salePriceType === 'percent' ? 'Nilai (%)' : 'Nilai (Rp)'}
          type="number"
          step="any"
          bind:value={salePriceDelta}
          hint="Negatif untuk turun harga."
        />
        <Select
          label="Pembulatan"
          value={String(roundTo)}
          onchange={(e) => (roundTo = Number((e.currentTarget as HTMLSelectElement).value))}
          options={roundToOptions.map((o) => ({ value: String(o.value), label: o.label }))}
        />
        <Select label="Arah pembulatan" bind:value={roundDirection} options={roundDirectionOptions} />
      </div>
    </fieldset>

    {#if rows.length === 0}
      <div class="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Belum ada harga yang bisa disesuaikan. Tambah daftar harga di kartu Harga & Stok dulu.
      </div>
    {:else}
      <!-- Table -->
      <div class="overflow-hidden rounded-lg border border-slate-200">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
            <tr>
              <th class="px-3 py-2">
                <input
                  type="checkbox"
                  class="rounded border-slate-300"
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onchange={toggleAll}
                />
              </th>
              <th class="px-3 py-2">Cakupan</th>
              <th class="px-3 py-2">Daftar harga</th>
              <th class="px-3 py-2">Tipe</th>
              <th class="px-3 py-2">Tingkat</th>
              <th class="px-3 py-2 text-right">Sekarang</th>
              <th class="px-3 py-2 text-right">Baru</th>
              <th class="px-3 py-2 text-right">Selisih</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each previewRows as r (r.key)}
              <tr class="hover:bg-slate-50/60 {!r.changed ? 'opacity-60' : ''}">
                <td class="px-3 py-2 align-middle">
                  <input
                    type="checkbox"
                    class="rounded border-slate-300"
                    bind:checked={selected[r.key]}
                    disabled={!r.changed}
                  />
                </td>
                <td class="px-3 py-2 text-slate-700">{r.scopeLabel}</td>
                <td class="px-3 py-2 text-slate-700">{r.pricelistName}</td>
                <td class="px-3 py-2">
                  <span
                    class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium
                      {r.currentStrategy.kind === 'markup_pct'
                        ? 'bg-sky-50 text-sky-700'
                        : r.currentStrategy.kind === 'markup_amount'
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-slate-100 text-slate-700'}"
                  >
                    {strategyKindLabel(r.currentStrategy.kind)}
                  </span>
                  {#if !saleStepEligible(r.currentStrategy) && (salePriceDelta || 0) !== 0}
                    <div class="mt-0.5 text-[10px] text-slate-500">
                      Bump harga jual dilewati
                    </div>
                  {/if}
                </td>
                <td class="px-3 py-2 text-slate-500">{r.tierLabel ?? '—'}</td>
                <td class="px-3 py-2 text-right font-mono text-slate-700">
                  {formatRupiah(r.currentSale)}
                </td>
                <td class="px-3 py-2 text-right">
                  {#if r.changed}
                    <span
                      class="font-mono font-semibold {r.delta > 0
                        ? 'text-emerald-700'
                        : r.delta < 0
                          ? 'text-rose-700'
                          : 'text-slate-700'}"
                    >
                      {formatRupiah(r.newSale)}
                    </span>
                    {#if r.warning}
                      <div class="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-amber-700">
                        <AlertTriangle class="h-3 w-3" />
                        {r.warning}
                      </div>
                    {/if}
                  {:else}
                    <span class="text-xs text-slate-400">tidak berubah</span>
                  {/if}
                </td>
                <td class="px-3 py-2 text-right text-xs">
                  {#if r.changed}
                    <span class="inline-flex items-center gap-0.5 {r.delta > 0 ? 'text-emerald-700' : 'text-rose-700'}">
                      {#if r.delta > 0}<TrendingUp class="h-3 w-3" />{:else}<TrendingDown class="h-3 w-3" />{/if}
                      {r.delta > 0 ? '+' : ''}{formatRupiah(r.delta)}
                    </span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={close}>Batal</Button>
    <Button onclick={apply} disabled={changedCount === 0}>
      Terapkan {changedCount > 0 ? `${changedCount} perubahan` : ''}
    </Button>
  {/snippet}
</Modal>
