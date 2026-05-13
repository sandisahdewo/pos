<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    ArrowLeft,
    Pencil,
    Send,
    PackageCheck,
    XCircle,
    Receipt,
    Truck,
    Calendar,
    CircleDashed,
    Printer
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    Modal,
    PageHeader,
    Table
  } from '$lib/components/ui';
  import { batches } from '$lib/stores/batches.svelte';
  import {
    lineBaseQuantity,
    lineBaseUnitCost,
    lineSubtotal,
    poTotal,
    purchaseOrders,
    purchaseOrderStatusLabels,
    purchaseOrderTypeLabels,
    type PurchaseOrderLine,
    type PurchaseOrderStatus
  } from '$lib/stores/purchaseOrders.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const id = $derived(page.params.id ?? '');
  const po = $derived(id ? purchaseOrders.getById(id) : undefined);
  const supplier = $derived(po ? suppliers.getById(po.supplierId) : undefined);
  const poBatchCount = $derived(id ? batches.forSourcePO(id).length : 0);

  let receiveOpen = $state(false);
  let receiveQtyMap = $state<Record<string, number>>({});
  let receiveExpiresAtMap = $state<Record<string, string>>({});
  let confirmCancelOpen = $state(false);
  let confirmSendOpen = $state(false);

  function statusBadgeVariant(s: PurchaseOrderStatus) {
    if (s === 'draft') return 'neutral' as const;
    if (s === 'sent') return 'info' as const;
    if (s === 'partial') return 'warning' as const;
    if (s === 'received') return 'success' as const;
    return 'danger' as const;
  }

  function statusIconFor(s: PurchaseOrderStatus) {
    if (s === 'draft') return CircleDashed;
    if (s === 'sent') return Send;
    if (s === 'partial') return PackageCheck;
    if (s === 'received') return PackageCheck;
    return XCircle;
  }

  function fmtDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function productName(productId: string, variantId?: string): string {
    const product = products.getById(productId);
    if (!product) return '—';
    if (variantId) {
      const v = product.variants.find((vv) => vv.id === variantId);
      return v ? `${product.name} — ${v.name}` : product.name;
    }
    return product.name;
  }

  function productSku(productId: string, variantId?: string): string {
    const product = products.getById(productId);
    if (!product) return '';
    if (variantId) {
      const v = product.variants.find((vv) => vv.id === variantId);
      return v?.sku ?? product.sku;
    }
    return product.sku;
  }

  function unitCode(productId: string): string {
    const product = products.getById(productId);
    if (!product) return '';
    return units.getById(product.unitId)?.code ?? '';
  }

  function lineUnitCode(line: PurchaseOrderLine): string {
    return units.getById(line.unitId)?.code ?? '';
  }

  function isPackagingLine(line: PurchaseOrderLine): boolean {
    const product = products.getById(line.productId);
    return !!product && (line.unitFactor !== 1 || line.unitId !== product.unitId);
  }

  const lineColumns = [
    { key: 'productId' as const, label: 'Produk' },
    { key: 'quantity' as const, label: 'Qty', align: 'right' as const, width: '120px' },
    { key: 'unitPrice' as const, label: 'Harga satuan', align: 'right' as const, width: '150px' },
    { key: 'id' as const, label: 'Subtotal', align: 'right' as const, width: '150px' }
  ];

  function doSend() {
    if (!po) return;
    const r = purchaseOrders.markSent(po.id);
    if (r.ok) toast.success('Ditandai sebagai terkirim', po.code);
    else toast.error('Tidak bisa dikirim', r.reason ?? '');
  }

  function openReceive() {
    if (!po) return;
    const qty: Record<string, number> = {};
    const exp: Record<string, string> = {};
    for (const line of po.lines) {
      const remaining = line.quantity - line.receivedQty;
      qty[line.id] = remaining > 0 ? remaining : 0;
      exp[line.id] = '';
    }
    receiveQtyMap = qty;
    receiveExpiresAtMap = exp;
    receiveOpen = true;
  }

  function lineRequiresExpiration(productId: string): boolean {
    return products.getById(productId)?.requiresExpiration === true;
  }

  function doReceive() {
    if (!po) return;
    // Validate expiration where required.
    for (const line of po.lines) {
      const remaining = line.quantity - line.receivedQty;
      const willReceive = (receiveQtyMap[line.id] ?? 0) > 0;
      if (
        willReceive &&
        remaining > 0 &&
        lineRequiresExpiration(line.productId) &&
        !receiveExpiresAtMap[line.id]
      ) {
        toast.error(
          'Tanggal kedaluwarsa wajib diisi',
          `Item ${productName(line.productId, line.variantId)} memerlukan tanggal kedaluwarsa.`
        );
        return;
      }
    }
    const r = purchaseOrders.receive(po.id, {
      receiveQty: receiveQtyMap,
      expiresAt: receiveExpiresAtMap
    });
    if (r.ok) {
      const reloaded = purchaseOrders.getById(po.id);
      const allDone = reloaded?.status === 'received';
      toast.success(
        allDone ? 'PO sepenuhnya diterima' : 'Sebagian diterima',
        `Stok ${po.code} ditambahkan ke inventaris. Tombol "Cetak label" muncul di header.`
      );
      receiveOpen = false;
    } else toast.error('Tidak bisa diterima', r.reason ?? '');
  }

  function doCancel() {
    if (!po) return;
    const r = purchaseOrders.cancel(po.id);
    if (r.ok) toast.success('Dibatalkan', po.code);
    else toast.error('Tidak bisa dibatalkan', r.reason ?? '');
  }
</script>

<svelte:head>
  <title>{po ? po.code : 'PO tidak ditemukan'} · POS Admin</title>
</svelte:head>

{#if po}
  {@const StatusIcon = statusIconFor(po.status)}
  <PageHeader
    title={po.code}
    description={supplier?.name ?? '—'}
    breadcrumb={[
      { label: 'Pengadaan' },
      { label: 'Order Pembelian', href: '/purchase-orders' },
      { label: po.code }
    ]}
  >
    {#snippet actions()}
      {#if po.status === 'draft'}
        <Button variant="outline" href={`/purchase-orders/${po.id}/edit`}>
          <Pencil class="h-4 w-4" />
          Ubah
        </Button>
        <Button variant="outline" onclick={() => (confirmCancelOpen = true)}>
          <XCircle class="h-4 w-4" />
          Batalkan
        </Button>
        <Button onclick={() => (confirmSendOpen = true)}>
          <Send class="h-4 w-4" />
          Tandai terkirim
        </Button>
      {:else if po.status === 'sent' || po.status === 'partial'}
        <Button variant="outline" onclick={() => (confirmCancelOpen = true)}>
          <XCircle class="h-4 w-4" />
          Batalkan
        </Button>
        <Button variant="success" onclick={openReceive}>
          <PackageCheck class="h-4 w-4" />
          Terima
        </Button>
      {/if}
      {#if poBatchCount > 0}
        <Button variant="outline" href={`/inventory/po/${po.id}/labels`}>
          <Printer class="h-4 w-4" />
          Cetak label ({poBatchCount})
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <div class="space-y-4 lg:col-span-2">
      <Card title="Detail">
        <dl class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-xs font-medium text-slate-500">Status</dt>
            <dd class="mt-1">
              <Badge variant={statusBadgeVariant(po.status)}>
                <StatusIcon class="mr-1 h-3 w-3" />
                {purchaseOrderStatusLabels[po.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-500">Tipe</dt>
            <dd class="mt-1">
              <Badge variant={po.type === 'consignment' ? 'info' : 'neutral'}>
                {purchaseOrderTypeLabels[po.type]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-500">Pemasok</dt>
            <dd class="mt-1 flex items-center gap-1.5 text-slate-700">
              <Truck class="h-3.5 w-3.5 text-slate-400" />
              {supplier?.name ?? '—'}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-500">Tanggal order</dt>
            <dd class="mt-1 flex items-center gap-1.5 text-slate-700">
              <Calendar class="h-3.5 w-3.5 text-slate-400" />
              {fmtDate(po.orderDate)}
            </dd>
          </div>
          {#if po.expectedDate}
            <div>
              <dt class="text-xs font-medium text-slate-500">Estimasi tiba</dt>
              <dd class="mt-1 flex items-center gap-1.5 text-slate-700">
                <Calendar class="h-3.5 w-3.5 text-slate-400" />
                {fmtDate(po.expectedDate)}
              </dd>
            </div>
          {/if}
          {#if po.receivedDate}
            <div>
              <dt class="text-xs font-medium text-slate-500">Diterima pada</dt>
              <dd class="mt-1 flex items-center gap-1.5 text-slate-700">
                <Calendar class="h-3.5 w-3.5 text-slate-400" />
                {fmtDate(po.receivedDate)}
              </dd>
            </div>
          {/if}
          {#if po.notes}
            <div class="sm:col-span-2">
              <dt class="text-xs font-medium text-slate-500">Catatan</dt>
              <dd class="mt-1 text-slate-700">{po.notes}</dd>
            </div>
          {/if}
        </dl>
      </Card>

      <Card title="Item" description={`${po.lines.length} item`} padded={false}>
        <Table columns={lineColumns} rows={po.lines} rowKey={(l: PurchaseOrderLine) => l.id}>
          {#snippet cell({ row, column })}
            {#if column.key === 'productId'}
              <div class="min-w-0">
                <div class="truncate font-medium text-slate-900">
                  {productName(row.productId, row.variantId)}
                </div>
                <div class="font-mono text-xs text-slate-500">{productSku(row.productId, row.variantId)}</div>
                {#if row.notes}
                  <div class="line-clamp-1 text-xs text-slate-500">{row.notes}</div>
                {/if}
              </div>
            {:else if column.key === 'quantity'}
              <div>
                <span class="font-medium text-slate-900">{row.quantity}</span>
                <span class="ml-1 text-xs text-slate-400">{lineUnitCode(row)}</span>
                {#if row.receivedQty > 0 && row.receivedQty < row.quantity}
                  <div class="text-xs text-amber-700">
                    diterima {row.receivedQty}/{row.quantity}
                  </div>
                {:else if row.receivedQty >= row.quantity && row.quantity > 0}
                  <div class="text-xs text-emerald-700">diterima penuh</div>
                {/if}
                {#if isPackagingLine(row)}
                  <div class="text-xs text-slate-500">
                    = {lineBaseQuantity(row)} {unitCode(row.productId)}
                  </div>
                {/if}
              </div>
            {:else if column.key === 'unitPrice'}
              <div>
                <span class="text-slate-700">{formatRupiah(row.unitPrice)}</span>
                {#if isPackagingLine(row)}
                  <div class="text-xs text-slate-500">
                    {formatRupiah(lineBaseUnitCost(row))}/{unitCode(row.productId)}
                  </div>
                {/if}
              </div>
            {:else if column.key === 'id'}
              <span class="font-semibold text-slate-900">{formatRupiah(lineSubtotal(row))}</span>
            {/if}
          {/snippet}

          {#snippet empty()}
            <div class="py-6 text-center text-xs text-slate-400">Tidak ada item pada PO ini.</div>
          {/snippet}
        </Table>
        <div
          class="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-3"
        >
          <span class="text-sm text-slate-500">Total</span>
          <span class="text-lg font-semibold text-slate-900">{formatRupiah(poTotal(po))}</span>
        </div>
      </Card>
    </div>

    <div class="space-y-4">
      <Card>
        <div class="flex items-start gap-2">
          <Receipt class="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p class="text-xs text-slate-500">
            {po.type === 'consignment'
              ? 'Menerima akan menambah stok sebagai batch konsinyasi. Tidak ada utang ke pemasok yang dibuat — Anda hanya berutang ketika barang terjual (lihat /payouts).'
              : 'Menerima akan menambah stok sebagai batch baru. Utang ke pemasok akan dibuat ketika modul akuntansi siap.'}
          </p>
        </div>
      </Card>
    </div>
  </div>
{:else}
  <PageHeader
    title="Order pembelian tidak ditemukan"
    breadcrumb={[
      { label: 'Pengadaan' },
      { label: 'Order Pembelian', href: '/purchase-orders' },
      { label: 'Tidak ditemukan' }
    ]}
  />
  <Card>
    <div class="flex flex-col items-center gap-3 py-10 text-center">
      <p class="text-sm font-medium text-slate-700">
        Tidak menemukan PO dengan id <code class="rounded bg-slate-100 px-1 font-mono">{id}</code>.
      </p>
      <Button variant="outline" onclick={() => goto('/purchase-orders')}>
        <ArrowLeft class="h-4 w-4" />
        Kembali ke daftar order pembelian
      </Button>
    </div>
  </Card>
{/if}

<ConfirmDialog
  bind:open={confirmSendOpen}
  title="Tandai sebagai terkirim?"
  message={po
    ? `${po.code} akan berpindah dari Draft → Terkirim. Setelah ini Anda tidak bisa mengubahnya.`
    : ''}
  confirmLabel="Tandai terkirim"
  variant="primary"
  onConfirm={doSend}
/>

<Modal
  bind:open={receiveOpen}
  size="lg"
  title="Terima order pembelian{po ? ` · ${po.code}` : ''}"
  description="Atur kuantitas yang diterima per item. Default = sisa belum diterima. Set ke 0 untuk melewati baris ini sementara."
>
  {#if po}
    <div class="space-y-2">
      {#each po.lines as line (line.id)}
        {@const remaining = line.quantity - line.receivedQty}
        {@const lineUnit = lineUnitCode(line)}
        {@const needsExp = lineRequiresExpiration(line.productId)}
        <div class="rounded-lg border border-slate-200 p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate font-medium text-slate-900">
                {productName(line.productId, line.variantId)}
              </div>
              <div class="text-xs text-slate-500">
                Dipesan {line.quantity} {lineUnit}
                {#if line.receivedQty > 0}
                  · Sudah diterima {line.receivedQty} {lineUnit}
                {/if}
                {#if remaining > 0}
                  · Sisa <span class="font-medium text-slate-700">{remaining}</span> {lineUnit}
                {/if}
              </div>
            </div>
            <div class="w-32 shrink-0">
              <Input
                label="Terima"
                type="number"
                min="0"
                max={remaining}
                step="1"
                disabled={remaining <= 0}
                bind:value={receiveQtyMap[line.id]}
              />
            </div>
          </div>
          {#if needsExp && remaining > 0 && (receiveQtyMap[line.id] ?? 0) > 0}
            <div class="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
              <Input
                label="Tanggal kedaluwarsa"
                type="date"
                bind:value={receiveExpiresAtMap[line.id]}
                hint="Wajib untuk produk ini — penjualan FIFO akan memprioritaskan batch yang lebih cepat kedaluwarsa."
              />
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (receiveOpen = false)}>Batal</Button>
    <Button variant="success" onclick={doReceive}>
      <PackageCheck class="h-4 w-4" />
      Terima
    </Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmCancelOpen}
  title="Batalkan order pembelian?"
  message={po
    ? `${po.code} akan dibatalkan. Stok yang sudah diterima tetap di inventaris.`
    : ''}
  confirmLabel="Batalkan PO"
  onConfirm={doCancel}
/>
