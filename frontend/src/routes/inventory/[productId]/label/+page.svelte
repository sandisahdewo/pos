<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    ArrowLeft,
    Printer,
    Sparkles,
    Tag,
    Percent,
    Package,
    Gift,
    Users,
    CalendarDays
  } from 'lucide-svelte';
  import { Button } from '$lib/components/ui';
  import {
    products,
    basePrice,
    effectiveCost,
    effectiveVariantCost,
    computeSalePrice,
    effectiveEntry,
    type Product,
    type ProductPackaging,
    type ProductVariant
  } from '$lib/stores/products.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { units } from '$lib/stores/units.svelte';
  import {
    promotions,
    isPromoUsable,
    promoTargetsProduct,
    promoKindLabels,
    type Promotion,
    type PromoKind
  } from '$lib/stores/promotions.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type LabelSize = 'small' | 'medium' | 'large';

  const productId = $derived(page.params.productId ?? '');
  const product = $derived(productId ? products.getById(productId) : undefined);

  let size = $state<LabelSize>('medium');
  let copies = $state(1);
  let variantId = $state<string>(''); // empty = no specific variant (use base/range)
  let unitKey = $state<string>(''); // '' = base unit; 'pkg_<idx>' = packaging by index
  let pricelistId = $state<string>('');
  let showPromo = $state(true);

  // Initial price-list = default once on mount.
  $effect(() => {
    if (!pricelistId) pricelistId = pricelists.defaultId();
  });

  const variants = $derived(product?.variants ?? []);
  const selectedVariant = $derived<ProductVariant | undefined>(
    variantId ? variants.find((v) => v.id === variantId) : undefined
  );

  const packagings = $derived<ProductPackaging[]>(product?.units ?? []);
  const selectedPackaging = $derived.by<ProductPackaging | undefined>(() => {
    if (!unitKey.startsWith('pkg_')) return undefined;
    const idx = Number(unitKey.slice(4));
    return Number.isFinite(idx) ? packagings[idx] : undefined;
  });

  // Unit being printed: base unit if no packaging selected, else the
  // packaging's underlying unit. `factor` describes how many base units the
  // chosen unit holds (1 for base, >1 for packaging like a 6-pack).
  const unitInfo = $derived.by(() => {
    if (!product) return undefined;
    if (selectedPackaging) {
      const u = units.getById(selectedPackaging.unitId);
      return {
        code: u?.code ?? '?',
        name: u?.name ?? '—',
        factor: selectedPackaging.factor,
        isPackaging: true
      };
    }
    const u = units.getById(product.unitId);
    return {
      code: u?.code ?? '?',
      name: u?.name ?? '—',
      factor: 1,
      isPackaging: false
    };
  });

  // Active line-level promos targeting this product (and the selected variant
  // if applicable). We skip member-tier here because it doesn't directly alter
  // the shelf price.
  const activePromos = $derived.by<Promotion[]>(() => {
    if (!product) return [];
    const now = new Date();
    return promotions.items.filter((promo) => {
      if (promo.kind === 'member-tier') return false;
      if (!isPromoUsable(promo, now)) return false;
      if (!promoTargetsProduct(promo, product.id, product.categoryId)) return false;
      // Honor productScopes' variant constraint when a variant is selected.
      if (selectedVariant && promo.productScopes) {
        const scoped = promo.productScopes.find((s) => s.productId === product.id);
        if (scoped && scoped.variantId && scoped.variantId !== selectedVariant.id) return false;
      }
      return true;
    });
  });

  const headlinePromo = $derived<Promotion | undefined>(activePromos[0]);

  const safeCopies = $derived(Math.max(1, Math.min(50, Math.floor(copies || 1))));

  // Compute the price for the selected (variant?, packaging?) combination.
  // Cascade: packaging.prices → variant.prices → product.prices.
  // Cost: variant.cost (if a variant is locked in) else product.cost.
  // Multiplier for markup strategies: packaging.factor when packaging selected.
  const priceInfo = $derived.by(() => {
    if (!product) return { single: 0, min: 0, max: 0, hasRange: false };
    const pid = pricelistId || pricelists.defaultId();
    const fallback = pricelists.defaultId();

    if (selectedPackaging) {
      const baseEntry = effectiveEntry(product.prices, pid, fallback);
      const variantEntry = selectedVariant
        ? effectiveEntry(selectedVariant.prices, pid, fallback)
        : undefined;
      const entry =
        effectiveEntry(selectedPackaging.prices, pid, fallback) ?? variantEntry ?? baseEntry;
      if (!entry) return { single: 0, min: 0, max: 0, hasRange: false };
      const cost = selectedVariant ? effectiveVariantCost(selectedVariant, product) : effectiveCost(product);
      const value = computeSalePrice(selectedPackaging.factor * cost, entry.pricing);
      return { single: value, min: value, max: value, hasRange: false };
    }

    if (selectedVariant) {
      const baseEntry = effectiveEntry(product.prices, pid, fallback);
      const entry = effectiveEntry(selectedVariant.prices, pid, fallback) ?? baseEntry;
      if (!entry) return { single: 0, min: 0, max: 0, hasRange: false };
      const value = computeSalePrice(effectiveVariantCost(selectedVariant, product), entry.pricing);
      return { single: value, min: value, max: value, hasRange: false };
    }
    if (variants.length === 0) {
      const value = basePrice(product, pid);
      return { single: value, min: value, max: value, hasRange: false };
    }
    // Multiple variants — compute min / max across them.
    const baseEntry = effectiveEntry(product.prices, pid, fallback);
    const vals: number[] = [];
    for (const v of variants) {
      const entry = effectiveEntry(v.prices, pid, fallback) ?? baseEntry;
      if (!entry) continue;
      const val = computeSalePrice(effectiveVariantCost(v, product), entry.pricing);
      if (Number.isFinite(val)) vals.push(val);
    }
    if (vals.length === 0) return { single: 0, min: 0, max: 0, hasRange: false };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { single: min, min, max, hasRange: min !== max };
  });

  // Compute discounted price when applicable. Only 'discount' and
  // 'expiring-batch' kinds change the displayed price directly.
  const discountedPrice = $derived.by<{ value: number; savings: number } | undefined>(() => {
    if (!showPromo || !headlinePromo) return undefined;
    const baseValue = priceInfo.single;
    if (!Number.isFinite(baseValue) || baseValue <= 0) return undefined;
    if (headlinePromo.kind === 'discount') {
      if (headlinePromo.discountUnit === 'percent') {
        const off = (baseValue * (headlinePromo.discountValue ?? 0)) / 100;
        return { value: Math.max(0, baseValue - off), savings: off };
      }
      const off = headlinePromo.discountValue ?? 0;
      return { value: Math.max(0, baseValue - off), savings: off };
    }
    if (headlinePromo.kind === 'expiring-batch') {
      if (headlinePromo.expiryDiscountUnit === 'percent') {
        const off = (baseValue * (headlinePromo.expiryDiscountValue ?? 0)) / 100;
        return { value: Math.max(0, baseValue - off), savings: off };
      }
      const off = headlinePromo.expiryDiscountValue ?? 0;
      return { value: Math.max(0, baseValue - off), savings: off };
    }
    return undefined;
  });

  function promoBadge(p: Promotion): string {
    switch (p.kind) {
      case 'discount':
        if (p.discountUnit === 'percent') return `${p.discountValue ?? 0}% OFF`;
        return `HEMAT ${formatRupiah(p.discountValue ?? 0)}`;
      case 'combo':
        return `PAKET ${formatRupiah(p.comboPrice ?? 0)}`;
      case 'bogo':
        return `BELI ${p.buyQuantity ?? 1} GRATIS ${p.getQuantity ?? 1}`;
      case 'member-tier':
        return `MEMBER ${p.memberPercentOff ?? 0}% OFF`;
      case 'expiring-batch':
        if (p.expiryDiscountUnit === 'percent') return `MAU EXPIRED · ${p.expiryDiscountValue ?? 0}% OFF`;
        return `MAU EXPIRED · HEMAT ${formatRupiah(p.expiryDiscountValue ?? 0)}`;
    }
  }

  function promoKindIcon(kind: PromoKind) {
    switch (kind) {
      case 'discount':
        return Percent;
      case 'combo':
        return Package;
      case 'bogo':
        return Gift;
      case 'member-tier':
        return Users;
      case 'expiring-batch':
        return CalendarDays;
    }
  }

  // Dynamic @page CSS so the print dialog defaults to the chosen paper.
  $effect(() => {
    const styleEl = document.createElement('style');
    styleEl.id = 'shelf-label-print-page';
    const cfg = {
      small: { page: '80mm 120mm', margin: '4mm' },
      medium: { page: 'A5', margin: '8mm' },
      large: { page: 'A4', margin: '10mm' }
    }[size];
    styleEl.textContent = `@media print { @page { size: ${cfg.page}; margin: ${cfg.margin}; } }`;
    const old = document.getElementById('shelf-label-print-page');
    if (old) old.remove();
    document.head.appendChild(styleEl);
    return () => styleEl.remove();
  });

  function doPrint() {
    window.print();
  }

  const sizeOptions: { value: LabelSize; label: string; sub: string }[] = [
    { value: 'small', label: 'Kecil', sub: '80 × 120 mm' },
    { value: 'medium', label: 'Sedang', sub: 'A5 (148 × 210 mm)' },
    { value: 'large', label: 'Besar', sub: 'A4 (210 × 297 mm)' }
  ];

  const variantOptions = $derived([
    { value: '', label: variants.length > 0 ? 'Semua varian' : 'Tanpa varian' },
    ...variants.map((v) => ({ value: v.id, label: v.name }))
  ]);

  const baseUnitLabel = $derived.by(() => {
    if (!product) return '— Unit dasar —';
    const u = units.getById(product.unitId);
    return `${u?.name ?? '—'} (dasar)`;
  });

  const unitOptions = $derived([
    { value: '', label: baseUnitLabel },
    ...packagings.map((pkg, idx) => {
      const u = units.getById(pkg.unitId);
      return {
        value: `pkg_${idx}`,
        label: `${u?.name ?? pkg.unitId} · isi ${pkg.factor}`
      };
    })
  ]);

  const pricelistOptions = $derived(
    pricelists.items.map((pl) => ({ value: pl.id, label: pl.name }))
  );

  const category = $derived(product ? categories.getById(product.categoryId) : undefined);
</script>

<svelte:head>
  <title>Cetak label · {product?.name ?? 'produk'} · POS Admin</title>
</svelte:head>

{#if product}
  {@const priceFmt = priceInfo.hasRange
    ? `${formatRupiah(priceInfo.min)} – ${formatRupiah(priceInfo.max)}`
    : formatRupiah(priceInfo.single)}
  {@const HeadlineIcon = headlinePromo ? promoKindIcon(headlinePromo.kind) : Sparkles}
  {@const code = selectedVariant?.sku || product.sku}
  {@const displayPrice = discountedPrice ? formatRupiah(discountedPrice.value) : priceFmt}
  {@const priceLen = displayPrice.replace(/\s/g, '').length}
  {@const priceLenClass = priceLen <= 7 ? 'xs' : priceLen <= 10 ? 'sm' : priceLen <= 14 ? 'md' : 'lg'}
  {@const badgeLen = headlinePromo ? promoBadge(headlinePromo).length : 0}
  {@const badgeLenClass = badgeLen <= 10 ? 'xs' : badgeLen <= 16 ? 'sm' : badgeLen <= 24 ? 'md' : 'lg'}

  <div
    class="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
  >
    <!-- Toolbar -->
    <div
      class="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 print:hidden"
    >
      <Button variant="outline" onclick={() => history.back()}>
        <ArrowLeft class="h-4 w-4" />
        Kembali
      </Button>
      <div class="min-w-0">
        <h1 class="truncate text-base font-semibold text-slate-900">
          Cetak label · {product.name}
        </h1>
        <p class="truncate text-xs text-slate-500">
          {category?.name ?? 'Tanpa kategori'} · {code}
        </p>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <div class="flex items-center rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
          {#each sizeOptions as opt (opt.value)}
            <button
              type="button"
              class="rounded px-3 py-1.5 text-xs font-medium transition {size === opt.value
                ? 'bg-brand-600 text-white shadow'
                : 'text-slate-600 hover:bg-slate-100'}"
              onclick={() => (size = opt.value)}
              title={opt.sub}
            >
              <div class="flex flex-col items-center">
                <span>{opt.label}</span>
                <span
                  class="text-[9px] leading-tight {size === opt.value
                    ? 'text-white/80'
                    : 'text-slate-400'}"
                >
                  {opt.sub}
                </span>
              </div>
            </button>
          {/each}
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-600">Salinan</span>
          <input
            type="number"
            min="1"
            max="50"
            aria-label="Jumlah salinan"
            class="w-16 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            bind:value={copies}
          />
        </div>

        <Button onclick={doPrint}>
          <Printer class="h-4 w-4" />
          Cetak {safeCopies > 1 ? `${safeCopies}×` : ''}
        </Button>
      </div>
    </div>

    <!-- Configuration sub-bar -->
    <div
      class="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white/80 px-6 py-3 text-xs print:hidden"
    >
      {#if variants.length > 0}
        <label class="flex flex-col gap-1">
          <span class="font-medium text-slate-600">Varian</span>
          <select
            bind:value={variantId}
            class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          >
            {#each variantOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
      {/if}

      {#if packagings.length > 0}
        <label class="flex flex-col gap-1">
          <span class="font-medium text-slate-600">Unit</span>
          <select
            bind:value={unitKey}
            class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          >
            {#each unitOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
      {/if}

      <label class="flex flex-col gap-1">
        <span class="font-medium text-slate-600">Daftar harga</span>
        <select
          bind:value={pricelistId}
          class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        >
          {#each pricelistOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </label>

      <label class="flex cursor-pointer items-center gap-2 self-end pb-1.5 text-sm">
        <input type="checkbox" class="rounded border-slate-300" bind:checked={showPromo} />
        <span class="text-slate-700">Tampilkan promo (jika ada)</span>
      </label>

      {#if showPromo && activePromos.length > 0}
        <span class="self-end pb-1.5 text-xs text-emerald-700">
          {activePromos.length} promo aktif menempel di produk ini
        </span>
      {:else if showPromo}
        <span class="self-end pb-1.5 text-xs text-slate-400">Tidak ada promo aktif</span>
      {/if}
    </div>

    <!-- Body -->
    <div class="flex flex-1 flex-col items-center gap-4 px-6 py-6 print:p-0">
      <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm print:hidden">
        <span class="font-medium text-slate-700">Pratinjau ukuran {size === 'small' ? 'kecil' : size === 'medium' ? 'sedang' : 'besar'}.</span>
        Saat dialog cetak terbuka, pastikan ukuran kertas yang dipilih = <span class="font-mono">{size === 'small' ? '80×120mm (custom)' : size === 'medium' ? 'A5' : 'A4'}</span>.
      </div>

      {#snippet labelBody()}
        <div class="shelf-label-content flex h-full w-full flex-col">
          <!-- Top stripe: category + SKU -->
          <div class="shelf-label-topbar flex items-center justify-between bg-slate-900 text-white">
            <span class="shelf-topbar-text font-bold tracking-[0.18em] uppercase">
              {category?.name ?? 'Produk'}
            </span>
            <span class="shelf-topbar-code font-mono opacity-90">{code}</span>
          </div>

          <!-- Body -->
          <div class="flex flex-1 flex-col px-4 py-3">
            <div class="text-center">
              <div class="shelf-name font-extrabold leading-tight text-slate-900">
                {product.name}
              </div>
              {#if selectedVariant}
                <div class="shelf-variant mt-1 font-semibold leading-tight text-slate-600">
                  {selectedVariant.name}
                </div>
              {:else if variants.length > 0}
                <div class="shelf-variant mt-1 leading-tight text-slate-500">
                  Tersedia {variants.length} varian
                </div>
              {/if}
              {#if product.description}
                <div class="shelf-desc mt-1 leading-snug text-slate-500">
                  {product.description}
                </div>
              {/if}
            </div>

            <!-- Price block (hero) -->
            <div class="flex flex-1 flex-col items-center justify-center py-2">
              {#if discountedPrice}
                <div class="shelf-was font-medium text-slate-400 line-through">
                  {priceFmt}
                </div>
                <div
                  class="shelf-price font-black leading-none text-rose-600"
                  data-len={priceLenClass}
                >
                  {formatRupiah(discountedPrice.value)}
                </div>
                <div class="shelf-savings mt-1 font-semibold text-rose-500">
                  Hemat {formatRupiah(discountedPrice.savings)}
                </div>
              {:else}
                <div
                  class="shelf-price font-black leading-none text-brand-700"
                  data-len={priceLenClass}
                >
                  {priceFmt}
                </div>
              {/if}
              {#if unitInfo}
                <div class="shelf-unit mt-1 font-medium uppercase tracking-wider text-slate-500">
                  {#if unitInfo.isPackaging}
                    per {unitInfo.name.toLowerCase()} · isi {unitInfo.factor} {units.getById(product.unitId)?.code ?? ''}
                  {:else}
                    per {unitInfo.name.toLowerCase()}
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Promo banner / footer -->
            {#if showPromo && headlinePromo}
              <div class="shelf-promo-banner mb-2 flex items-center justify-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-center text-white">
                <HeadlineIcon class="shelf-promo-icon shrink-0" />
                <div class="flex min-w-0 flex-col">
                  <span
                    class="shelf-promo-headline font-extrabold tracking-wider uppercase"
                    data-len={badgeLenClass}
                  >
                    {promoBadge(headlinePromo)}
                  </span>
                  {#if headlinePromo.name}
                    <span class="shelf-promo-name font-medium opacity-95">
                      {headlinePromo.name}
                    </span>
                  {/if}
                </div>
              </div>
              {#if activePromos.length > 1}
                <p class="shelf-promo-more mb-1 text-center text-slate-500">
                  +{activePromos.length - 1} promo lain
                </p>
              {/if}
            {/if}

            <div class="shelf-footer mt-auto flex items-center justify-between border-t border-slate-200 pt-2 text-slate-500">
              <span class="font-mono">{code}</span>
              {#if showPromo && headlinePromo}
                <span class="flex items-center gap-1">
                  <Tag class="shelf-footer-icon" />
                  {promoKindLabels[headlinePromo.kind]}
                </span>
              {:else}
                <span class="opacity-70">Harga sewaktu-waktu dapat berubah</span>
              {/if}
            </div>
          </div>
        </div>
      {/snippet}

      <div class="flex justify-center print:hidden">
        <div
          class="shelf-label shelf-label-preview {size} relative rounded-lg border border-slate-300 bg-white shadow-lg"
          data-size={size}
        >
          {@render labelBody()}
        </div>
      </div>

      <!-- Print payload -->
      <div class="hidden print:contents">
        {#each Array(safeCopies) as _, copyIdx (copyIdx)}
          <div class="shelf-label shelf-label-print {size}" data-size={size}>
            {@render labelBody()}
          </div>
        {/each}
      </div>

      <p class="max-w-md text-center text-xs text-slate-500 print:hidden">
        Tip: aktifkan "background graphics" di dialog cetak agar warna spanduk
        promo ikut tercetak. Gunakan kertas tebal / kertas foto untuk hasil
        terbaik.
      </p>
    </div>
  </div>
{:else}
  <div class="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
    <p class="text-sm font-medium text-slate-700">
      Produk dengan id <code class="rounded bg-slate-100 px-1 font-mono">{productId}</code> tidak ditemukan.
    </p>
    <Button variant="outline" onclick={() => goto('/inventory')}>
      <ArrowLeft class="h-4 w-4" />
      Kembali ke Inventaris
    </Button>
  </div>
{/if}

<style>
  .shelf-label {
    box-sizing: border-box;
    overflow: hidden;
  }
  .shelf-label.small {
    width: 80mm;
    height: 120mm;
  }
  .shelf-label.medium {
    width: 148mm;
    height: 210mm;
  }
  .shelf-label.large {
    width: 210mm;
    height: 297mm;
  }

  .shelf-label-preview.small {
    transform: scale(2);
    transform-origin: top center;
    margin-bottom: 130mm;
  }
  .shelf-label-preview.medium {
    transform: scale(1.2);
    transform-origin: top center;
    margin-bottom: 50mm;
  }
  .shelf-label-preview.large {
    transform: scale(0.85);
    transform-origin: top center;
  }

  /* Top bar */
  .shelf-label.small .shelf-label-topbar {
    padding: 2mm 3mm;
  }
  .shelf-label.medium .shelf-label-topbar {
    padding: 3mm 5mm;
  }
  .shelf-label.large .shelf-label-topbar {
    padding: 5mm 8mm;
  }
  .shelf-label.small .shelf-topbar-text {
    font-size: 8pt;
  }
  .shelf-label.medium .shelf-topbar-text {
    font-size: 12pt;
  }
  .shelf-label.large .shelf-topbar-text {
    font-size: 18pt;
  }
  .shelf-label.small .shelf-topbar-code {
    font-size: 7pt;
  }
  .shelf-label.medium .shelf-topbar-code {
    font-size: 10pt;
  }
  .shelf-label.large .shelf-topbar-code {
    font-size: 14pt;
  }

  /* Product name */
  .shelf-label.small .shelf-name {
    font-size: 14pt;
  }
  .shelf-label.medium .shelf-name {
    font-size: 24pt;
  }
  .shelf-label.large .shelf-name {
    font-size: 36pt;
  }
  .shelf-label.small .shelf-variant {
    font-size: 9pt;
  }
  .shelf-label.medium .shelf-variant {
    font-size: 14pt;
  }
  .shelf-label.large .shelf-variant {
    font-size: 20pt;
  }
  .shelf-label.small .shelf-desc {
    font-size: 7pt;
  }
  .shelf-label.medium .shelf-desc {
    font-size: 11pt;
  }
  .shelf-label.large .shelf-desc {
    font-size: 14pt;
  }

  /* Price block */
  .shelf-label.small .shelf-was {
    font-size: 11pt;
  }
  .shelf-label.medium .shelf-was {
    font-size: 18pt;
  }
  .shelf-label.large .shelf-was {
    font-size: 26pt;
  }
  /* Price — scales by content length so long rupiah amounts and price
     ranges ("Rp 18.000 – Rp 25.000") don't overflow the label width.
     Tiers: xs (≤7 chars), sm (8–10), md (11–14), lg (15+). */
  .shelf-label.small .shelf-price[data-len='xs'] {
    font-size: 38pt;
  }
  .shelf-label.small .shelf-price[data-len='sm'] {
    font-size: 28pt;
  }
  .shelf-label.small .shelf-price[data-len='md'] {
    font-size: 20pt;
  }
  .shelf-label.small .shelf-price[data-len='lg'] {
    font-size: 14pt;
  }
  .shelf-label.medium .shelf-price[data-len='xs'] {
    font-size: 64pt;
  }
  .shelf-label.medium .shelf-price[data-len='sm'] {
    font-size: 48pt;
  }
  .shelf-label.medium .shelf-price[data-len='md'] {
    font-size: 34pt;
  }
  .shelf-label.medium .shelf-price[data-len='lg'] {
    font-size: 24pt;
  }
  .shelf-label.large .shelf-price[data-len='xs'] {
    font-size: 96pt;
  }
  .shelf-label.large .shelf-price[data-len='sm'] {
    font-size: 72pt;
  }
  .shelf-label.large .shelf-price[data-len='md'] {
    font-size: 52pt;
  }
  .shelf-label.large .shelf-price[data-len='lg'] {
    font-size: 36pt;
  }
  .shelf-label.small .shelf-savings {
    font-size: 8pt;
  }
  .shelf-label.medium .shelf-savings {
    font-size: 13pt;
  }
  .shelf-label.large .shelf-savings {
    font-size: 18pt;
  }
  .shelf-label.small .shelf-unit {
    font-size: 7pt;
  }
  .shelf-label.medium .shelf-unit {
    font-size: 11pt;
  }
  .shelf-label.large .shelf-unit {
    font-size: 15pt;
  }

  /* Promo banner — length-aware to keep wording like "BELI 1 GRATIS 1"
     or "MAU EXPIRED · HEMAT Rp 5.000" on one line. */
  .shelf-label.small .shelf-promo-headline[data-len='xs'] {
    font-size: 10pt;
  }
  .shelf-label.small .shelf-promo-headline[data-len='sm'] {
    font-size: 9pt;
  }
  .shelf-label.small .shelf-promo-headline[data-len='md'] {
    font-size: 7pt;
  }
  .shelf-label.small .shelf-promo-headline[data-len='lg'] {
    font-size: 6pt;
  }
  .shelf-label.medium .shelf-promo-headline[data-len='xs'] {
    font-size: 18pt;
  }
  .shelf-label.medium .shelf-promo-headline[data-len='sm'] {
    font-size: 14pt;
  }
  .shelf-label.medium .shelf-promo-headline[data-len='md'] {
    font-size: 11pt;
  }
  .shelf-label.medium .shelf-promo-headline[data-len='lg'] {
    font-size: 9pt;
  }
  .shelf-label.large .shelf-promo-headline[data-len='xs'] {
    font-size: 26pt;
  }
  .shelf-label.large .shelf-promo-headline[data-len='sm'] {
    font-size: 20pt;
  }
  .shelf-label.large .shelf-promo-headline[data-len='md'] {
    font-size: 16pt;
  }
  .shelf-label.large .shelf-promo-headline[data-len='lg'] {
    font-size: 13pt;
  }
  .shelf-label.small .shelf-promo-name {
    font-size: 7pt;
  }
  .shelf-label.medium .shelf-promo-name {
    font-size: 11pt;
  }
  .shelf-label.large .shelf-promo-name {
    font-size: 15pt;
  }
  .shelf-label.small :global(.shelf-promo-icon) {
    width: 9pt;
    height: 9pt;
  }
  .shelf-label.medium :global(.shelf-promo-icon) {
    width: 14pt;
    height: 14pt;
  }
  .shelf-label.large :global(.shelf-promo-icon) {
    width: 22pt;
    height: 22pt;
  }
  .shelf-label.small .shelf-promo-more {
    font-size: 6pt;
  }
  .shelf-label.medium .shelf-promo-more {
    font-size: 9pt;
  }
  .shelf-label.large .shelf-promo-more {
    font-size: 12pt;
  }

  /* Footer */
  .shelf-label.small .shelf-footer {
    font-size: 6pt;
  }
  .shelf-label.medium .shelf-footer {
    font-size: 9pt;
  }
  .shelf-label.large .shelf-footer {
    font-size: 12pt;
  }
  .shelf-label.small :global(.shelf-footer-icon) {
    width: 7pt;
    height: 7pt;
  }
  .shelf-label.medium :global(.shelf-footer-icon) {
    width: 10pt;
    height: 10pt;
  }
  .shelf-label.large :global(.shelf-footer-icon) {
    width: 13pt;
    height: 13pt;
  }

  @media print {
    :global(aside),
    :global(header) {
      display: none !important;
    }
    :global(body) {
      background: white !important;
    }
    :global(main) {
      padding: 0 !important;
    }
    .shelf-label-print {
      page-break-after: always;
      break-after: page;
      border: none !important;
      box-shadow: none !important;
    }
    .shelf-label-print:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    :global(.shelf-label-topbar),
    :global(.shelf-promo-banner) {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
