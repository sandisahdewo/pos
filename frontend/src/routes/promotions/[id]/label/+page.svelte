<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    ArrowLeft,
    Printer,
    Sparkles,
    CalendarDays,
    Clock,
    Users,
    Tag,
    Gift,
    Percent,
    Package
  } from 'lucide-svelte';
  import { Button } from '$lib/components/ui';
  import {
    promotions,
    promoKindLabels,
    type Promotion,
    type PromoKind
  } from '$lib/stores/promotions.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type LabelSize = 'small' | 'medium' | 'large';

  const id = $derived(page.params.id ?? '');
  const promo = $derived(id ? promotions.getById(id) : undefined);

  let size = $state<LabelSize>('medium');
  let copies = $state(1);

  const safeCopies = $derived(Math.max(1, Math.min(50, Math.floor(copies || 1))));

  // Inject the @page CSS dynamically so the print dialog defaults to the
  // chosen paper size. Browsers may still let the user override, but this
  // gives the right starting point.
  $effect(() => {
    const styleEl = document.createElement('style');
    styleEl.id = 'promo-label-print-page';
    const cfg = {
      small: { page: '80mm 120mm', margin: '4mm' },
      medium: { page: 'A5', margin: '8mm' },
      large: { page: 'A4', margin: '10mm' }
    }[size];
    styleEl.textContent = `@media print { @page { size: ${cfg.page}; margin: ${cfg.margin}; } }`;
    const old = document.getElementById('promo-label-print-page');
    if (old) old.remove();
    document.head.appendChild(styleEl);
    return () => styleEl.remove();
  });

  type Hero = {
    kicker?: string;
    primary: string;
    suffix?: string;
    tagline?: string;
  };

  function hero(p: Promotion): Hero {
    switch (p.kind) {
      case 'discount':
        if (p.discountUnit === 'percent') {
          return { kicker: 'DISKON', primary: `${p.discountValue ?? 0}%`, suffix: 'OFF' };
        }
        return { kicker: 'HEMAT', primary: formatRupiah(p.discountValue ?? 0) };
      case 'combo':
        return {
          kicker: 'PAKET COMBO',
          primary: formatRupiah(p.comboPrice ?? 0),
          tagline: 'Harga spesial'
        };
      case 'bogo':
        return {
          kicker: 'BELI & DAPATKAN',
          primary: `${p.buyQuantity ?? 1} + ${p.getQuantity ?? 1}`,
          tagline: `Beli ${p.buyQuantity ?? 1}, gratis ${p.getQuantity ?? 1}`
        };
      case 'member-tier':
        return {
          kicker: 'KHUSUS MEMBER',
          primary: `${p.memberPercentOff ?? 0}%`,
          suffix: 'OFF'
        };
      case 'expiring-batch':
        if (p.expiryDiscountUnit === 'percent') {
          return {
            kicker: 'STOK TERBATAS',
            primary: `${p.expiryDiscountValue ?? 0}%`,
            suffix: 'OFF',
            tagline: 'Mau kedaluwarsa'
          };
        }
        return {
          kicker: 'STOK TERBATAS',
          primary: formatRupiah(p.expiryDiscountValue ?? 0),
          tagline: 'Mau kedaluwarsa'
        };
    }
  }

  function appliesText(p: Promotion): string {
    if (p.kind === 'combo') {
      const items = (p.comboItems ?? [])
        .map((c) => {
          const prod = products.getById(c.productId);
          if (!prod) return '';
          return c.quantity > 1 ? `${c.quantity}× ${prod.name}` : prod.name;
        })
        .filter(Boolean);
      return items.length ? items.join(' + ') : 'Lihat detail di kasir';
    }
    if (p.kind === 'bogo' && p.bogoProductId) {
      return products.getById(p.bogoProductId)?.name ?? '';
    }
    if (p.kind === 'member-tier') {
      const pl = p.memberPricelistId ? pricelists.getById(p.memberPricelistId) : undefined;
      return pl ? `Berlaku otomatis pemilik ${pl.name}` : 'Untuk pelanggan member';
    }
    const prods = (p.productScopes ?? [])
      .map((s) => products.getById(s.productId)?.name ?? '')
      .filter(Boolean);
    const cats = (p.categoryIds ?? [])
      .map((cid) => categories.getById(cid)?.name ?? '')
      .filter(Boolean);
    const all = [...prods, ...cats];
    return all.length ? all.join(', ') : 'Semua produk';
  }

  function fmtDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function periodText(p: Promotion): string | undefined {
    if (!p.startDate && !p.endDate) return undefined;
    if (p.startDate && p.endDate) return `${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}`;
    if (p.startDate) return `Mulai ${fmtDate(p.startDate)}`;
    return `Sampai ${fmtDate(p.endDate)}`;
  }

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  function daysText(p: Promotion): string | undefined {
    if (!p.daysOfWeek || p.daysOfWeek.length === 0 || p.daysOfWeek.length === 7) return undefined;
    const sorted = [...p.daysOfWeek].sort();
    return sorted.map((d) => dayNames[d]).join(', ');
  }

  function hoursText(p: Promotion): string | undefined {
    if (!p.hourStart && !p.hourEnd) return undefined;
    const s = p.hourStart ?? '00:00';
    const e = p.hourEnd ?? '23:59';
    return `${s} – ${e}`;
  }

  function memberText(p: Promotion): string | undefined {
    if (p.kind === 'member-tier') return undefined; // already in kicker / applies
    if (!p.memberPricelistId) return undefined;
    const pl = pricelists.getById(p.memberPricelistId);
    return pl ? `Khusus ${pl.name}` : 'Khusus member';
  }

  function kindIcon(kind: PromoKind) {
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

  function doPrint() {
    window.print();
  }

  const sizeOptions: { value: LabelSize; label: string; sub: string }[] = [
    { value: 'small', label: 'Kecil', sub: '80 × 120 mm' },
    { value: 'medium', label: 'Sedang', sub: 'A5 (148 × 210 mm)' },
    { value: 'large', label: 'Besar', sub: 'A4 (210 × 297 mm)' }
  ];
</script>

<svelte:head>
  <title>Cetak label · {promo?.code ?? 'promo'} · POS Admin</title>
</svelte:head>

{#if promo}
  {@const h = hero(promo)}
  {@const applies = appliesText(promo)}
  {@const period = periodText(promo)}
  {@const days = daysText(promo)}
  {@const hours = hoursText(promo)}
  {@const member = memberText(promo)}
  {@const minPurchase = (promo.minimumPurchase ?? 0) > 0 ? formatRupiah(promo.minimumPurchase!) : undefined}
  {@const KindIcon = kindIcon(promo.kind)}
  {@const heroLen = h.primary.replace(/\s/g, '').length}
  {@const heroLenClass = heroLen <= 5 ? 'xs' : heroLen <= 7 ? 'sm' : heroLen <= 10 ? 'md' : 'lg'}

  <div
    class="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
  >
    <!-- Toolbar (hidden on print) -->
    <div
      class="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 print:hidden"
    >
      <Button variant="outline" onclick={() => history.back()}>
        <ArrowLeft class="h-4 w-4" />
        Kembali
      </Button>
      <div class="min-w-0">
        <h1 class="truncate text-base font-semibold text-slate-900">
          Cetak label · {promo.code}
        </h1>
        <p class="truncate text-xs text-slate-500">{promo.name}</p>
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

    <!-- Body -->
    <div class="flex flex-1 flex-col items-center gap-4 px-6 py-6 print:p-0">
      <!-- On-screen preview card -->
      <div class="flex flex-col items-center gap-3 print:hidden">
        <div
          class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm"
        >
          <span class="font-medium text-slate-700">Pratinjau ukuran {size === 'small' ? 'kecil' : size === 'medium' ? 'sedang' : 'besar'}.</span>
          Saat dialog cetak terbuka, pastikan ukuran kertas yang dipilih = <span class="font-mono">{size === 'small' ? '80×120mm (custom)' : size === 'medium' ? 'A5' : 'A4'}</span>.
        </div>
      </div>

      {#snippet labelBody()}
        <div class="promo-label-content flex h-full w-full flex-col">
          <!-- Top banner -->
          <div class="promo-label-banner flex items-center justify-center gap-2 bg-brand-600 text-white">
            <Sparkles class="promo-label-banner-icon" />
            <span class="promo-label-banner-text font-bold tracking-[0.2em] uppercase">
              {h.kicker ?? 'Promo Spesial'}
            </span>
            <Sparkles class="promo-label-banner-icon" />
          </div>

          <!-- Hero -->
          <div class="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <div
              class="promo-hero-primary font-black leading-none text-brand-700"
              data-len={heroLenClass}
            >
              {h.primary}
            </div>
            {#if h.suffix}
              <div class="promo-hero-suffix font-extrabold tracking-[0.15em] text-brand-600">
                {h.suffix}
              </div>
            {/if}
            {#if h.tagline}
              <div class="promo-hero-tagline mt-2 font-medium text-slate-600">
                {h.tagline}
              </div>
            {/if}
          </div>

          <!-- Body content -->
          <div class="promo-body flex flex-col gap-2 border-t-2 border-brand-200 px-4 py-3">
            <div class="text-center">
              <div class="promo-name font-extrabold leading-tight text-slate-900">
                {promo.name}
              </div>
              {#if promo.description}
                <div class="promo-desc mt-1 leading-snug text-slate-700">
                  {promo.description}
                </div>
              {/if}
            </div>

            <div class="promo-applies rounded-md bg-brand-50 px-3 py-2 text-center">
              <div class="promo-applies-label font-semibold tracking-wider text-brand-700 uppercase">
                Untuk
              </div>
              <div class="promo-applies-value mt-0.5 font-medium text-slate-800">
                {applies}
              </div>
            </div>

            <ul class="promo-conditions flex flex-col gap-1 text-slate-700">
              {#if period}
                <li class="flex items-center justify-center gap-1.5">
                  <CalendarDays class="promo-cond-icon shrink-0 text-brand-600" />
                  <span>Berlaku <span class="font-medium">{period}</span></span>
                </li>
              {/if}
              {#if days}
                <li class="flex items-center justify-center gap-1.5">
                  <CalendarDays class="promo-cond-icon shrink-0 text-brand-600" />
                  <span>Hari <span class="font-medium">{days}</span></span>
                </li>
              {/if}
              {#if hours}
                <li class="flex items-center justify-center gap-1.5">
                  <Clock class="promo-cond-icon shrink-0 text-brand-600" />
                  <span>Jam <span class="font-medium">{hours}</span></span>
                </li>
              {/if}
              {#if minPurchase}
                <li class="flex items-center justify-center gap-1.5">
                  <Tag class="promo-cond-icon shrink-0 text-brand-600" />
                  <span>Min. belanja <span class="font-medium">{minPurchase}</span></span>
                </li>
              {/if}
              {#if member}
                <li class="flex items-center justify-center gap-1.5">
                  <Users class="promo-cond-icon shrink-0 text-brand-600" />
                  <span class="font-medium">{member}</span>
                </li>
              {/if}
            </ul>

            <div class="promo-footer mt-1 flex items-center justify-between border-t border-slate-200 pt-2 text-slate-500">
              <span class="font-mono">{promo.code}</span>
              <span class="flex items-center gap-1">
                <KindIcon class="promo-footer-icon" />
                {promoKindLabels[promo.kind]}
              </span>
            </div>
          </div>
        </div>
      {/snippet}

      <!-- On-screen preview: scaled down so even A4 fits within viewport -->
      <div class="flex justify-center print:hidden">
        <div
          class="promo-label promo-label-preview {size} relative rounded-lg border border-slate-300 bg-white shadow-lg"
          data-size={size}
        >
          {@render labelBody()}
        </div>
      </div>

      <!-- Print payload: real labels, only visible during print -->
      <div class="hidden print:contents">
        {#each Array(safeCopies) as _, copyIdx (copyIdx)}
          <div class="promo-label promo-label-print {size}" data-size={size}>
            {@render labelBody()}
          </div>
        {/each}
      </div>

      <p class="max-w-md text-center text-xs text-slate-500 print:hidden">
        Tip: untuk hasil terbaik, gunakan kertas tebal / kertas foto. Aktifkan
        "background graphics" di dialog cetak agar warna spanduk ikut tercetak.
      </p>
    </div>
  </div>
{:else}
  <div class="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
    <p class="text-sm font-medium text-slate-700">
      Promo dengan id <code class="rounded bg-slate-100 px-1 font-mono">{id}</code> tidak ditemukan.
    </p>
    <Button variant="outline" onclick={() => goto('/promotions')}>
      <ArrowLeft class="h-4 w-4" />
      Kembali ke daftar promo
    </Button>
  </div>
{/if}

<style>
  /* Per-size dimensions and typography. Using `mm` keeps the print output
     true to the chosen paper size; on-screen preview scales down to fit. */
  .promo-label {
    box-sizing: border-box;
    overflow: hidden;
  }
  .promo-label.small {
    width: 80mm;
    height: 120mm;
  }
  .promo-label.medium {
    width: 148mm;
    height: 210mm;
  }
  .promo-label.large {
    width: 210mm;
    height: 297mm;
  }

  /* On-screen preview: shrink so even the large label fits without scroll. */
  .promo-label-preview.small {
    transform: scale(2);
    transform-origin: top center;
    margin-bottom: 130mm; /* compensate the scale so layout doesn't collapse */
  }
  .promo-label-preview.medium {
    transform: scale(1.2);
    transform-origin: top center;
    margin-bottom: 50mm;
  }
  .promo-label-preview.large {
    transform: scale(0.85);
    transform-origin: top center;
  }

  /* Banner */
  .promo-label.small .promo-label-banner {
    padding: 2mm 0;
  }
  .promo-label.medium .promo-label-banner {
    padding: 4mm 0;
  }
  .promo-label.large .promo-label-banner {
    padding: 6mm 0;
  }
  .promo-label.small .promo-label-banner-text {
    font-size: 10pt;
  }
  .promo-label.medium .promo-label-banner-text {
    font-size: 16pt;
  }
  .promo-label.large .promo-label-banner-text {
    font-size: 24pt;
  }
  .promo-label.small :global(.promo-label-banner-icon) {
    width: 10pt;
    height: 10pt;
  }
  .promo-label.medium :global(.promo-label-banner-icon) {
    width: 16pt;
    height: 16pt;
  }
  .promo-label.large :global(.promo-label-banner-icon) {
    width: 24pt;
    height: 24pt;
  }

  /* Hero — font sizes scale down as the primary text gets longer so that
     long rupiah amounts ("Rp 18.000", "Rp 150.000") don't overflow the
     fixed label width. Tiers are: xs (≤5 chars, e.g. "10%"), sm (6–7,
     e.g. "1 + 1"), md (8–10, e.g. "Rp 18.000"), lg (11+, ranges/big nums). */
  .promo-label.small .promo-hero-primary[data-len='xs'] {
    font-size: 52pt;
  }
  .promo-label.small .promo-hero-primary[data-len='sm'] {
    font-size: 40pt;
  }
  .promo-label.small .promo-hero-primary[data-len='md'] {
    font-size: 26pt;
  }
  .promo-label.small .promo-hero-primary[data-len='lg'] {
    font-size: 18pt;
  }
  .promo-label.medium .promo-hero-primary[data-len='xs'] {
    font-size: 110pt;
  }
  .promo-label.medium .promo-hero-primary[data-len='sm'] {
    font-size: 80pt;
  }
  .promo-label.medium .promo-hero-primary[data-len='md'] {
    font-size: 52pt;
  }
  .promo-label.medium .promo-hero-primary[data-len='lg'] {
    font-size: 36pt;
  }
  .promo-label.large .promo-hero-primary[data-len='xs'] {
    font-size: 170pt;
  }
  .promo-label.large .promo-hero-primary[data-len='sm'] {
    font-size: 124pt;
  }
  .promo-label.large .promo-hero-primary[data-len='md'] {
    font-size: 82pt;
  }
  .promo-label.large .promo-hero-primary[data-len='lg'] {
    font-size: 56pt;
  }
  .promo-label.small .promo-hero-suffix {
    font-size: 18pt;
  }
  .promo-label.medium .promo-hero-suffix {
    font-size: 32pt;
  }
  .promo-label.large .promo-hero-suffix {
    font-size: 48pt;
  }
  .promo-label.small .promo-hero-tagline {
    font-size: 9pt;
  }
  .promo-label.medium .promo-hero-tagline {
    font-size: 14pt;
  }
  .promo-label.large .promo-hero-tagline {
    font-size: 20pt;
  }

  /* Body content */
  .promo-label.small .promo-name {
    font-size: 13pt;
  }
  .promo-label.medium .promo-name {
    font-size: 22pt;
  }
  .promo-label.large .promo-name {
    font-size: 32pt;
  }
  .promo-label.small .promo-desc {
    font-size: 8pt;
  }
  .promo-label.medium .promo-desc {
    font-size: 12pt;
  }
  .promo-label.large .promo-desc {
    font-size: 16pt;
  }
  .promo-label.small .promo-applies-label {
    font-size: 6pt;
  }
  .promo-label.medium .promo-applies-label {
    font-size: 9pt;
  }
  .promo-label.large .promo-applies-label {
    font-size: 12pt;
  }
  .promo-label.small .promo-applies-value {
    font-size: 9pt;
  }
  .promo-label.medium .promo-applies-value {
    font-size: 13pt;
  }
  .promo-label.large .promo-applies-value {
    font-size: 18pt;
  }
  .promo-label.small .promo-conditions {
    font-size: 7pt;
  }
  .promo-label.medium .promo-conditions {
    font-size: 10pt;
  }
  .promo-label.large .promo-conditions {
    font-size: 13pt;
  }
  .promo-label.small :global(.promo-cond-icon) {
    width: 8pt;
    height: 8pt;
  }
  .promo-label.medium :global(.promo-cond-icon) {
    width: 11pt;
    height: 11pt;
  }
  .promo-label.large :global(.promo-cond-icon) {
    width: 14pt;
    height: 14pt;
  }
  .promo-label.small .promo-footer {
    font-size: 6pt;
  }
  .promo-label.medium .promo-footer {
    font-size: 9pt;
  }
  .promo-label.large .promo-footer {
    font-size: 12pt;
  }
  .promo-label.small :global(.promo-footer-icon) {
    width: 7pt;
    height: 7pt;
  }
  .promo-label.medium :global(.promo-footer-icon) {
    width: 10pt;
    height: 10pt;
  }
  .promo-label.large :global(.promo-footer-icon) {
    width: 13pt;
    height: 13pt;
  }

  @media print {
    /* Hide app chrome */
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
    .promo-label-print {
      page-break-after: always;
      break-after: page;
      border: none !important;
      box-shadow: none !important;
    }
    .promo-label-print:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    /* Ensure banner color prints */
    :global(.promo-label-banner) {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    :global(.promo-applies) {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
