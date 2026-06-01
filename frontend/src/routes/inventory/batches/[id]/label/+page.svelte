<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import { ArrowLeft, Printer } from 'lucide-svelte';
  import { Badge, Button } from '$lib/components/ui';
  import { batches } from '$lib/stores/batches.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { purchaseOrders } from '$lib/stores/purchaseOrders.svelte';

  const id = $derived(page.params.id ?? '');
  const batch = $derived(id ? batches.getById(id) : undefined);
  const product = $derived(batch ? products.getById(batch.productId) : undefined);
  const variant = $derived(
    batch?.variantId && product
      ? product.variants.find((v) => v.id === batch.variantId)
      : undefined
  );
  const supplier = $derived(
    batch?.supplierId ? suppliers.getById(batch.supplierId) : undefined
  );
  const po = $derived(
    batch?.sourcePurchaseOrderId ? purchaseOrders.getById(batch.sourcePurchaseOrderId) : undefined
  );
  const baseUnit = $derived(product ? units.getById(product.unitId) : undefined);

  // Non-batch-labeled products get a product-identification label whose QR
  // encodes the variant/product SKU — POS scan resolves it the same way (see
  // resolveScanToken in src/routes/pos/+page.svelte).
  const productLabel = $derived(!!product && product.requiresBatchLabel !== true);
  const scanCode = $derived.by(() => {
    if (!batch || !product) return batch?.code ?? '';
    if (product.requiresBatchLabel) return batch.code;
    return variant?.sku || product.sku;
  });

  let qrDataUrl = $state('');
  let copies = $state(1);
  let lastScanCode = $state('');

  $effect(() => {
    if (!batch) return;
    if (scanCode === lastScanCode && qrDataUrl) return;
    QRCode.toDataURL(scanCode, {
      width: 140,
      margin: 0,
      errorCorrectionLevel: 'M'
    }).then((url) => {
      qrDataUrl = url;
      lastScanCode = scanCode;
    });
  });

  // Default to 1 label per received unit for product labels (cashier sticks one
  // on each item). Batch-labeled products default to 1 — the batch label is for
  // the carton/lot, not per-unit. Only set the seeded value once per page load.
  let copiesInitialised = $state(false);
  $effect(() => {
    if (copiesInitialised || !batch || !product) return;
    copies = productLabel ? Math.max(1, batch.qtyReceived) : 1;
    copiesInitialised = true;
  });

  const safeCopies = $derived(Math.max(1, Math.min(999, Math.floor(copies || 1))));

  function fmtDate(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function doPrint() {
    window.print();
  }
</script>

<svelte:head>
  <title>Label {batch?.code ?? 'batch'} · POS Admin</title>
</svelte:head>

{#if batch && product}
  <div
    class="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-slate-100 p-6 print:static print:z-auto print:bg-white print:p-0"
  >
    <!-- Toolbar (hidden when printing) -->
    <div class="flex flex-wrap items-center gap-3 print:hidden">
      <Button variant="outline" onclick={() => history.back()}>
        <ArrowLeft class="h-4 w-4" />
        Kembali
      </Button>
      <div class="flex items-center gap-2">
        <span class="text-xs text-slate-600">Jumlah label</span>
        <input
          type="number"
          min="1"
          max="999"
          aria-label="Jumlah label"
          class="w-20 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          bind:value={copies}
        />
        <span class="text-xs text-slate-500">
          {safeCopies > 1
            ? `${safeCopies}× akan dicetak (per unit dalam batch)`
            : '1 label untuk seluruh batch'}
        </span>
      </div>
      <Button onclick={doPrint}>
        <Printer class="h-4 w-4" />
        Cetak {safeCopies > 1 ? `${safeCopies} label` : 'label'}
      </Button>
    </div>

    <!-- The label(s) — thermal-friendly 70mm × 40mm. First one shows on screen as preview;
         additional copies are only materialised during print. -->
    {#each Array(safeCopies) as _, idx (idx)}
      <div
        class="label-card flex w-[70mm] gap-2 rounded-md border border-slate-300 bg-white p-2 text-[8pt] leading-tight shadow-md print:rounded-none print:border-0 print:shadow-none {idx >
        0
          ? 'hidden print:flex'
          : ''}"
        style="min-height: 40mm;"
      >
        <div class="flex min-w-0 flex-1 flex-col">
          {#if productLabel}
            <div class="flex flex-1 flex-col items-center justify-center text-center">
              <div class="line-clamp-2 text-[11pt] leading-tight font-bold text-slate-900">
                {product.name}
              </div>
              {#if variant}
                <div class="mt-0.5 line-clamp-1 text-[9pt] font-semibold text-slate-700">
                  {variant.name}
                </div>
              {/if}
              <div class="mt-1.5 font-mono text-[8pt] tracking-tight text-slate-500">
                {scanCode}
              </div>
            </div>
          {:else}
            <div class="font-mono text-[10pt] font-bold tracking-tight text-slate-900">
              {batch.code}
            </div>
            <div class="mt-0.5 line-clamp-2 text-[9pt] font-semibold text-slate-900">
              {product.name}{variant ? ` — ${variant.name}` : ''}
            </div>

            <dl class="mt-1.5 space-y-0.5 text-[7pt] text-slate-700">
              {#if supplier}
                <div class="flex gap-1">
                  <dt class="text-slate-500">Pemasok:</dt>
                  <dd class="font-medium">{supplier.name}</dd>
                </div>
              {/if}
              {#if po}
                <div class="flex gap-1">
                  <dt class="text-slate-500">PO:</dt>
                  <dd class="font-mono font-medium">{po.code}</dd>
                </div>
              {/if}
              <div class="flex gap-1">
                <dt class="text-slate-500">Diterima:</dt>
                <dd class="font-medium">{fmtDate(batch.receivedAt)}</dd>
              </div>
              {#if batch.expiresAt}
                <div class="flex gap-1">
                  <dt class="text-slate-500">Kedaluwarsa:</dt>
                  <dd class="font-semibold text-rose-700">{fmtDate(batch.expiresAt)}</dd>
                </div>
              {/if}
            </dl>

            <div class="mt-auto flex items-center gap-1 pt-1 text-[7pt]">
              <span class="text-slate-500">Qty:</span>
              <span class="font-semibold text-slate-900">{batch.qtyReceived}</span>
              <span class="text-slate-500">{baseUnit?.code ?? ''}</span>
              {#if batch.ownership === 'consignment'}
                <span class="ml-auto rounded bg-sky-100 px-1 text-[6pt] font-semibold text-sky-700">
                  KONSINYASI
                </span>
              {/if}
            </div>
          {/if}
        </div>

        <div class="flex shrink-0 flex-col items-center justify-center">
          {#if qrDataUrl}
            <img
              src={qrDataUrl}
              alt="QR {scanCode}"
              class="h-[26mm] w-[26mm]"
              style="image-rendering: pixelated;"
            />
          {:else}
            <div class="flex h-[26mm] w-[26mm] items-center justify-center rounded border border-dashed border-slate-300 text-[7pt] text-slate-400">
              QR…
            </div>
          {/if}
        </div>
      </div>
    {/each}

    <p class="text-xs text-slate-500 print:hidden">
      Pratinjau label. Klik <strong>Cetak label</strong> untuk mencetak — gunakan printer thermal
      ukuran ~70×40mm atau kertas label dengan ukuran yang sesuai.
    </p>
  </div>
{:else}
  <div class="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
    <p class="text-sm font-medium text-slate-700">
      Batch dengan id <code class="rounded bg-slate-100 px-1 font-mono">{id}</code> tidak ditemukan.
    </p>
    <Button variant="outline" onclick={() => goto('/inventory')}>
      <ArrowLeft class="h-4 w-4" />
      Kembali ke Inventaris
    </Button>
  </div>
{/if}

<style>
  @media print {
    @page {
      size: 70mm 40mm;
      margin: 2mm;
    }
    /* Hide everything outside the label card */
    :global(body) {
      background: white !important;
    }
    :global(aside),
    :global(header) {
      display: none !important;
    }
    :global(main) {
      padding: 0 !important;
    }
    :global(.label-card) {
      box-shadow: none !important;
      border: none !important;
      margin: 0 !important;
    }
  }
</style>
