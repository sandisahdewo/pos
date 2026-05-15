<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import QRCode from 'qrcode';
  import { ArrowLeft, Printer, Package } from 'lucide-svelte';
  import { Badge, Button } from '$lib/components/ui';
  import { batches, type Batch } from '$lib/stores/batches.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { purchaseOrders } from '$lib/stores/purchaseOrders.svelte';

  const poId = $derived(page.params.poId ?? '');
  const po = $derived(poId ? purchaseOrders.getById(poId) : undefined);
  const poBatches = $derived(poId ? batches.forSourcePO(poId) : []);

  let qtyMap = $state<Record<string, number>>({});
  let qrMap = $state<Record<string, string>>({});

  function isProductLabel(b: Batch): boolean {
    const p = products.getById(b.productId);
    return !!p && p.requiresBatchLabel !== true;
  }

  // Code printed below the QR + encoded in the QR. For batch-labeled products
  // it's the batch code (BATCH-YYYY-NNN); for everything else it's the variant
  // SKU when present, otherwise the product SKU — both are accepted by the POS
  // scan resolver in src/routes/pos/+page.svelte (resolveScanToken).
  function scanCodeFor(b: Batch): string {
    const p = products.getById(b.productId);
    if (!p || p.requiresBatchLabel) return b.code;
    if (b.variantId) {
      const v = p.variants.find((vv) => vv.id === b.variantId);
      if (v?.sku) return v.sku;
    }
    return p.sku;
  }

  $effect(() => {
    for (const b of poBatches) {
      if (qtyMap[b.id] === undefined) {
        qtyMap[b.id] = isProductLabel(b) ? Math.max(1, b.qtyReceived) : 1;
      }
    }
  });

  $effect(() => {
    for (const b of poBatches) {
      if (!qrMap[b.id]) {
        QRCode.toDataURL(scanCodeFor(b), {
          width: 140,
          margin: 0,
          errorCorrectionLevel: 'M'
        }).then((url) => {
          qrMap = { ...qrMap, [b.id]: url };
        });
      }
    }
  });

  function fmtDate(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function productOf(b: Batch) {
    return products.getById(b.productId);
  }
  function variantOf(b: Batch) {
    if (!b.variantId) return undefined;
    return productOf(b)?.variants.find((v) => v.id === b.variantId);
  }
  function supplierOf(b: Batch) {
    return b.supplierId ? suppliers.getById(b.supplierId) : undefined;
  }
  function unitOf(b: Batch) {
    const p = productOf(b);
    return p ? units.getById(p.unitId) : undefined;
  }

  const totalLabels = $derived(
    poBatches.reduce((s, b) => s + Math.max(1, qtyMap[b.id] ?? 1), 0)
  );

  function setAllQty(n: number) {
    const next: Record<string, number> = { ...qtyMap };
    for (const b of poBatches) next[b.id] = n;
    qtyMap = next;
  }

  function doPrint() {
    window.print();
  }
</script>

<svelte:head>
  <title>Cetak label · {po?.code ?? poId}</title>
</svelte:head>

<div class="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white">
  <!-- Toolbar -->
  <div class="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 print:hidden">
    <Button variant="outline" onclick={() => history.back()}>
      <ArrowLeft class="h-4 w-4" />
      Kembali
    </Button>
    <div>
      <h1 class="text-base font-semibold text-slate-900">
        Cetak label · {po?.code ?? poId}
      </h1>
      <p class="text-xs text-slate-500">
        {poBatches.length} batch · total {totalLabels} label akan dicetak
      </p>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <Button variant="outline" size="sm" onclick={() => setAllQty(1)}>1× semua</Button>
      <Button onclick={doPrint} disabled={poBatches.length === 0}>
        <Printer class="h-4 w-4" />
        Cetak semua
      </Button>
    </div>
  </div>

  <!-- Body -->
  <div class="flex-1 px-6 py-6 print:p-0">
    <div class="mx-auto max-w-3xl space-y-4 print:max-w-none print:space-y-0">
      {#if poBatches.length === 0}
        <div class="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center print:hidden">
          <Package class="mx-auto h-10 w-10 text-slate-300" />
          <p class="mt-3 text-sm font-medium text-slate-700">Belum ada batch dari PO ini.</p>
          <p class="mt-1 text-xs text-slate-500">
            Setelah menerima PO, batch akan muncul di sini siap untuk dicetak.
          </p>
        </div>
      {/if}

      {#snippet labelInner(batch: Batch)}
        {@const product = productOf(batch)}
        {@const variant = variantOf(batch)}
        {@const supplier = supplierOf(batch)}
        {@const unit = unitOf(batch)}
        {@const productLabel = isProductLabel(batch)}
        {@const code = scanCodeFor(batch)}
        <div class="flex min-w-0 flex-1 flex-col">
          {#if productLabel}
            <div class="flex flex-1 flex-col items-center justify-center text-center">
              <div class="line-clamp-2 text-[11pt] leading-tight font-bold text-slate-900">
                {product?.name ?? '—'}
              </div>
              {#if variant}
                <div class="mt-0.5 line-clamp-1 text-[9pt] font-semibold text-slate-700">
                  {variant.name}
                </div>
              {/if}
              <div class="mt-1.5 font-mono text-[8pt] tracking-tight text-slate-500">
                {code}
              </div>
            </div>
          {:else}
            <div class="font-mono text-[10pt] font-bold tracking-tight text-slate-900">
              {batch.code}
            </div>
            <div class="mt-0.5 line-clamp-2 text-[9pt] font-semibold text-slate-900">
              {product?.name ?? '—'}{variant ? ` — ${variant.name}` : ''}
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
              <span class="text-slate-500">{unit?.code ?? ''}</span>
              {#if batch.ownership === 'consignment'}
                <span class="ml-auto rounded bg-sky-100 px-1 text-[6pt] font-semibold text-sky-700">
                  KONSINYASI
                </span>
              {/if}
            </div>
          {/if}
        </div>
        <div class="flex shrink-0 flex-col items-center justify-center">
          {#if qrMap[batch.id]}
            <img
              src={qrMap[batch.id]}
              alt="QR {code}"
              class="h-[26mm] w-[26mm]"
              style="image-rendering: pixelated;"
            />
          {:else}
            <div
              class="flex h-[26mm] w-[26mm] items-center justify-center rounded border border-dashed border-slate-300 text-[7pt] text-slate-400"
            >
              QR…
            </div>
          {/if}
        </div>
      {/snippet}

      <!-- Screen preview: one card per batch with settings -->
      {#each poBatches as batch (batch.id)}
        {@const product = productOf(batch)}
        {@const variant = variantOf(batch)}
        {@const productLabel = isProductLabel(batch)}
        {@const qty = Math.max(1, Math.min(999, qtyMap[batch.id] ?? 1))}
        <section class="rounded-lg border border-slate-200 bg-white p-4 print:hidden">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              {#if productLabel}
                <div class="flex items-center gap-1.5">
                  <Badge variant="info" size="sm">Label produk</Badge>
                  <span class="truncate text-sm font-medium text-slate-900">
                    {product?.name ?? '—'}{variant ? ` — ${variant.name}` : ''}
                  </span>
                </div>
                <div class="mt-0.5 font-mono text-xs text-slate-500">
                  {scanCodeFor(batch)} · sumber batch {batch.code}
                </div>
              {:else}
                <div class="flex items-center gap-1.5">
                  <Badge variant="warning" size="sm">Label batch</Badge>
                  <span class="font-mono text-sm font-medium text-slate-900">{batch.code}</span>
                </div>
                <div class="mt-0.5 truncate text-xs text-slate-600">
                  {product?.name ?? '—'}{variant ? ` — ${variant.name}` : ''}
                  {#if batch.expiresAt}
                    · <span class="text-rose-700">kedaluwarsa {fmtDate(batch.expiresAt)}</span>
                  {/if}
                </div>
              {/if}
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span class="text-xs text-slate-600">Jumlah label</span>
              <input
                type="number"
                min="1"
                max="999"
                aria-label="Jumlah label untuk {productLabel ? 'produk' : 'batch'} {batch.code}"
                class="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                bind:value={qtyMap[batch.id]}
              />
              <a
                href="/inventory/batches/{batch.id}/label"
                target="_blank"
                rel="noopener"
                class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cetak batch ini di tab baru"
                title="Cetak batch ini di tab baru"
              >
                <Printer class="h-4 w-4" />
              </a>
            </div>
          </div>

          <div
            class="label-preview flex w-[70mm] gap-2 rounded-md border border-slate-300 bg-white p-2 text-[8pt] leading-tight shadow-sm"
            style="min-height: 40mm;"
          >
            {@render labelInner(batch)}
          </div>
          {#if qty > 1}
            <p class="mt-2 text-xs text-slate-500">
              <span class="font-medium text-slate-700">{qty}×</span>
              {productLabel
                ? 'label produk akan dicetak (default 1 per unit yang diterima — cashier scan untuk menambahkan ke keranjang).'
                : 'label identik akan dicetak untuk batch ini.'}
            </p>
          {/if}
        </section>
      {/each}

      <!-- Print payload — hidden on screen, materialised only in print -->
      <div class="hidden print:contents">
        {#each poBatches as batch (batch.id)}
          {@const qty = Math.max(1, Math.min(999, qtyMap[batch.id] ?? 1))}
          {#each Array(qty) as _, copyIdx (copyIdx)}
            <div
              class="label-card flex w-[70mm] gap-2 bg-white p-2 text-[8pt] leading-tight"
              style="min-height: 40mm;"
            >
              {@render labelInner(batch)}
            </div>
          {/each}
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  @media print {
    @page {
      size: 70mm 40mm;
      margin: 2mm;
    }
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
      page-break-after: always;
    }
    :global(.label-card:last-child) {
      page-break-after: auto;
    }
  }
</style>
