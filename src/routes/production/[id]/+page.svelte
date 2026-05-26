<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    ArrowLeft,
    Factory,
    Boxes,
    Calendar,
    MapPin,
    Printer,
    XCircle
  } from 'lucide-svelte';
  import {
    Alert,
    Badge,
    Button,
    Card,
    PageHeader,
    Table
  } from '$lib/components/ui';
  import { productionRuns } from '$lib/stores/productionRuns.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { batches } from '$lib/stores/batches.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { stockMovements } from '$lib/stores/stockMovements.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const id = $derived(page.params.id ?? '');
  const run = $derived(id ? productionRuns.getById(id) : undefined);
  const product = $derived(run ? products.getById(run.productId) : undefined);
  const variant = $derived(
    product && run?.variantId
      ? product.variants.find((v) => v.id === run.variantId)
      : undefined
  );
  const producedBatch = $derived(run ? batches.getById(run.producedBatchId) : undefined);
  const location = $derived(run ? locations.getById(run.locationId) : undefined);
  const productUnitCode = $derived(
    product ? units.getById(product.unitId)?.code ?? '' : ''
  );

  const movements = $derived(
    run
      ? stockMovements
          .forReference('production', run.id)
          .sort((a, b) => a.at.localeCompare(b.at))
      : []
  );

  function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function fmtDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const totalConsumedCost = $derived(
    run
      ? run.componentConsumptions.reduce((s, c) => s + c.qtyConsumed * c.unitCost, 0)
      : 0
  );

  const consumptionColumns = [
    { key: 'product' as const, label: 'Komponen' },
    { key: 'batch' as const, label: 'Batch', width: '180px' },
    { key: 'qty' as const, label: 'Jumlah', align: 'right' as const, width: '110px' },
    { key: 'cost' as const, label: 'Biaya', align: 'right' as const, width: '140px' }
  ];

  function componentDisplay(c: { productId: string; variantId?: string }) {
    const p = products.getById(c.productId);
    if (!p) return { name: c.productId, variant: '', unitCode: '' };
    const v = c.variantId ? p.variants.find((vv) => vv.id === c.variantId) : undefined;
    return {
      name: p.name,
      variant: v?.name ?? '',
      unitCode: units.getById(p.unitId)?.code ?? ''
    };
  }
</script>

<svelte:head>
  <title>{run?.code ?? 'Produksi'} · POS Admin</title>
</svelte:head>

{#if !run}
  <Card class="text-center">
    <h2 class="text-lg font-semibold text-slate-900">Produksi tidak ditemukan</h2>
    <p class="mt-2 text-sm text-slate-500">ID: <code class="rounded bg-slate-100 px-1 font-mono">{id}</code></p>
    <Button class="mt-4" variant="outline" onclick={() => goto('/production')}>
      <ArrowLeft class="h-4 w-4" />
      Kembali
    </Button>
  </Card>
{:else}
  <PageHeader
    title="Produksi · {run.code}"
    description={product
      ? `${product.name}${variant ? ` · ${variant.name}` : ''}`
      : 'Detail produksi.'}
    breadcrumb={[
      { label: 'Inventaris' },
      { label: 'Produksi', href: '/production' },
      { label: run.code }
    ]}
  >
    {#snippet actions()}
      <Button variant="outline" href="/production">
        <ArrowLeft class="h-4 w-4" />
        Kembali
      </Button>
      <Button
        variant="outline"
        disabled
        title="Tersedia di v2"
      >
        <XCircle class="h-4 w-4" />
        Batalkan produksi
      </Button>
    {/snippet}
  </PageHeader>

  <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
    <div class="space-y-4">
      <Card>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-slate-900">
              {product?.name ?? run.productId}
              {#if variant}
                <span class="text-slate-500"> · {variant.name}</span>
              {/if}
            </h2>
            <p class="mt-1 text-xs text-slate-500">Tercatat {fmtDateTime(run.createdAt)}</p>
            {#if run.notes}
              <p class="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {run.notes}
              </p>
            {/if}
          </div>
          <Badge variant={run.status === 'completed' ? 'success' : 'neutral'} size="md" dot>
            {run.status === 'completed' ? 'Selesai' : 'Dibatalkan'}
          </Badge>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-4">
          <div class="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
            <div class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Direncanakan</div>
            <div class="mt-0.5 text-lg font-semibold text-slate-900">
              {run.intendedQty} <span class="text-xs text-slate-400">{productUnitCode}</span>
            </div>
          </div>
          <div class="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
            <div class="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase">Dihasilkan</div>
            <div class="mt-0.5 text-lg font-semibold text-emerald-900">
              {run.producedQty} <span class="text-xs text-emerald-700">{productUnitCode}</span>
            </div>
          </div>
          <div class="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
            <div class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Biaya / unit</div>
            <div class="mt-0.5 text-lg font-semibold text-slate-900">{formatRupiah(run.unitCost)}</div>
          </div>
          <div class="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
            <div class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Total biaya</div>
            <div class="mt-0.5 text-lg font-semibold text-slate-900">
              {formatRupiah(totalConsumedCost)}
            </div>
          </div>
        </div>

        {#if run.producedQty !== run.intendedQty}
          <Alert variant="warning" class="mt-3">
            Rendemen {Math.round((run.producedQty / run.intendedQty) * 100)}% —
            {run.intendedQty - run.producedQty} {productUnitCode} bahan terhitung sebagai pemakaian
            tapi tidak menghasilkan output (mis. gosong / cacat).
          </Alert>
        {/if}
      </Card>

      <Card padded={false}>
        <div class="border-b border-slate-100 px-4 py-3">
          <h3 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Konsumsi bahan baku
          </h3>
          <p class="mt-0.5 text-xs text-slate-500">
            Batch-batch yang dipotong FIFO saat produksi ini berjalan.
          </p>
        </div>
        <Table
          columns={consumptionColumns}
          rows={run.componentConsumptions}
          rowKey={(c) => `${c.productId}_${c.variantId ?? ''}_${c.batchId}`}
        >
          {#snippet cell({ row, column })}
            {#if column.key === 'product'}
              {@const d = componentDisplay(row)}
              <div class="min-w-0">
                <a
                  href="/inventory/{row.productId}/history"
                  class="truncate font-medium text-slate-900 hover:text-brand-700 hover:underline"
                >
                  {d.name}
                </a>
                {#if d.variant}
                  <span class="ml-1 text-xs text-slate-500">· {d.variant}</span>
                {/if}
              </div>
            {:else if column.key === 'batch'}
              <span class="font-mono text-xs text-slate-600">{row.batchCode}</span>
            {:else if column.key === 'qty'}
              {@const d = componentDisplay(row)}
              <div class="text-right text-sm">
                <span class="font-medium text-slate-900">{row.qtyConsumed}</span>
                <span class="text-xs text-slate-400">{d.unitCode}</span>
              </div>
            {:else if column.key === 'cost'}
              <div class="text-right text-sm">
                <span class="font-medium text-slate-900">
                  {formatRupiah(row.qtyConsumed * row.unitCost)}
                </span>
                <div class="text-[11px] text-slate-500">
                  @{formatRupiah(row.unitCost)}
                </div>
              </div>
            {/if}
          {/snippet}

          {#snippet empty()}
            <div class="px-4 py-6 text-center text-xs text-slate-400">
              Tidak ada konsumsi tercatat.
            </div>
          {/snippet}
        </Table>
      </Card>

      <Card padded={false}>
        <div class="border-b border-slate-100 px-4 py-3">
          <h3 class="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Jejak pergerakan stok
          </h3>
          <p class="mt-0.5 text-xs text-slate-500">
            {movements.length} entri tercatat di /stock-movements untuk produksi ini.
          </p>
        </div>
        <ul class="divide-y divide-slate-100">
          {#each movements as m (m.id)}
            <li class="flex items-start gap-3 px-4 py-2.5 text-sm">
              <Badge
                size="sm"
                variant={m.kind === 'production-in' ? 'success' : 'warning'}
              >
                {m.kind === 'production-in' ? 'Hasil' : 'Konsumsi'}
              </Badge>
              <div class="min-w-0 flex-1">
                <div class="truncate">
                  <span class="font-mono text-xs text-slate-500">{m.code}</span>
                  <span class="ml-2 text-slate-700">{m.notes}</span>
                </div>
                <div class="text-[11px] text-slate-500">
                  {fmtDateTime(m.at)} ·
                  <span class={m.qtyDelta > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {m.qtyDelta > 0 ? '+' : ''}{m.qtyDelta}
                  </span>
                </div>
              </div>
            </li>
          {/each}
        </ul>
      </Card>
    </div>

    <div class="space-y-4">
      <Card>
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          <Factory class="h-3.5 w-3.5" />
          Batch hasil
        </h2>
        {#if producedBatch}
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-2">
              <dt class="text-slate-500">Kode</dt>
              <dd class="font-mono font-medium text-slate-900">{producedBatch.code}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-slate-500">Sisa</dt>
              <dd class="font-medium text-slate-900">
                {producedBatch.qtyRemaining} / {producedBatch.qtyReceived}
                <span class="text-xs text-slate-400">{productUnitCode}</span>
              </dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-slate-500">Diterima</dt>
              <dd class="font-medium text-slate-900">{fmtDate(producedBatch.receivedAt)}</dd>
            </div>
            {#if producedBatch.expiresAt}
              <div class="flex justify-between gap-2">
                <dt class="text-slate-500">Kedaluwarsa</dt>
                <dd class="font-medium text-rose-700">{fmtDate(producedBatch.expiresAt)}</dd>
              </div>
            {/if}
          </dl>
          <Button
            variant="outline"
            size="sm"
            href="/inventory/batches/{producedBatch.id}/label"
            class="mt-3 w-full justify-center"
          >
            <Printer class="h-3.5 w-3.5" />
            Cetak label batch
          </Button>
        {:else}
          <p class="text-xs text-slate-500">Batch hasil sudah dihapus.</p>
        {/if}
      </Card>

      <Card>
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          <Boxes class="h-3.5 w-3.5" />
          Konteks
        </h2>
        <dl class="space-y-2 text-sm">
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">Lokasi</dt>
            <dd class="flex items-center gap-1 font-medium text-slate-900">
              <MapPin class="h-3.5 w-3.5 text-slate-400" />
              {location?.name ?? '—'}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">Tanggal</dt>
            <dd class="flex items-center gap-1 font-medium text-slate-900">
              <Calendar class="h-3.5 w-3.5 text-slate-400" />
              {fmtDateTime(run.createdAt)}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  </div>
{/if}
