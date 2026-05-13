<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    ArrowLeft,
    Receipt,
    User as UserIcon,
    XCircle,
    Calendar,
    BadgePercent
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    PageHeader,
    Table
  } from '$lib/components/ui';
  import {
    orders,
    orderStatusLabels,
    paymentMethodLabels,
    type OrderLine,
    type OrderStatus
  } from '$lib/stores/orders.svelte';
  import { customers } from '$lib/stores/customers.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const id = $derived(page.params.id ?? '');
  const order = $derived(id ? orders.getById(id) : undefined);

  let confirmCancelOpen = $state(false);

  function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function customerLabel(): string {
    if (!order?.customerId) return 'Pelanggan walk-in';
    return customers.getById(order.customerId)?.name ?? '—';
  }

  function pricelistLabel(): string {
    return order ? pricelists.getById(order.pricelistId)?.name ?? '—' : '—';
  }

  function statusVariant(s: OrderStatus) {
    return s === 'paid' ? ('success' as const) : ('danger' as const);
  }

  const lineColumns = [
    { key: 'productName' as const, label: 'Item' },
    { key: 'quantity' as const, label: 'Qty', align: 'right' as const, width: '80px' },
    { key: 'unitPrice' as const, label: 'Harga satuan', align: 'right' as const, width: '130px' },
    { key: 'extras' as const, label: 'Ekstra' },
    { key: 'lineSubtotal' as const, label: 'Subtotal', align: 'right' as const, width: '140px' }
  ];

  function doCancel() {
    if (!order) return;
    const r = orders.cancel(order.id);
    if (r.ok) toast.success('Pesanan dibatalkan', order.code);
    else toast.error('Tidak bisa dibatalkan', r.reason ?? '');
  }
</script>

<svelte:head>
  <title>{order ? order.code : 'Pesanan tidak ditemukan'} · POS Admin</title>
</svelte:head>

{#if order}
  <PageHeader
    title={order.code}
    description={customerLabel()}
    breadcrumb={[
      { label: 'Pesanan', href: '/orders' },
      { label: order.code }
    ]}
  >
    {#snippet actions()}
      {#if order.status === 'paid'}
        <Button variant="outline" onclick={() => (confirmCancelOpen = true)}>
          <XCircle class="h-4 w-4" />
          Batalkan pesanan
        </Button>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <div class="space-y-4 lg:col-span-2">
      <Card title="Detail">
        <dl class="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-xs font-medium text-slate-500">Status</dt>
            <dd class="mt-1">
              <Badge variant={statusVariant(order.status)} dot>
                {orderStatusLabels[order.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-500">Waktu</dt>
            <dd class="mt-1 flex items-center gap-1.5 text-slate-700">
              <Calendar class="h-3.5 w-3.5 text-slate-400" />
              {fmtDateTime(order.createdAt)}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-500">Pelanggan</dt>
            <dd class="mt-1 flex items-center gap-1.5 text-slate-700">
              <UserIcon class="h-3.5 w-3.5 text-slate-400" />
              {customerLabel()}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-500">Daftar Harga</dt>
            <dd class="mt-1 flex items-center gap-1.5 text-slate-700">
              <BadgePercent class="h-3.5 w-3.5 text-slate-400" />
              {pricelistLabel()}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-500">Pembayaran</dt>
            <dd class="mt-1">
              <Badge variant="outline">{paymentMethodLabels[order.paymentMethod]}</Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card
        title="Item"
        description={`${order.lines.length} item`}
        padded={false}
      >
        <Table columns={lineColumns} rows={order.lines} rowKey={(l: OrderLine) => l.id}>
          {#snippet cell({ row, column })}
            {#if column.key === 'productName'}
              <div>
                <div class="font-medium text-slate-900">
                  {row.productName}{row.variantName ? ` — ${row.variantName}` : ''}
                </div>
                {#if row.taxRatePct > 0}
                  <div class="text-xs text-slate-500">Pajak {row.taxRatePct}%</div>
                {/if}
              </div>
            {:else if column.key === 'quantity'}
              <span class="font-medium text-slate-900">{row.quantity}</span>
              <span class="ml-1 text-xs text-slate-400">{row.unitCode}</span>
            {:else if column.key === 'unitPrice'}
              <span class="text-slate-700">{formatRupiah(row.unitPrice)}</span>
            {:else if column.key === 'extras'}
              {#if row.extras.length === 0}
                <span class="text-xs text-slate-400">—</span>
              {:else}
                <div class="flex flex-wrap gap-1">
                  {#each row.extras as ex (ex.extraId)}
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700"
                      title={`${ex.name} ${ex.priceDelta >= 0 ? '+' : ''}${formatRupiah(ex.priceDelta)}`}
                    >
                      {ex.name}
                    </span>
                  {/each}
                </div>
              {/if}
            {:else if column.key === 'lineSubtotal'}
              <div>
                <div class="font-semibold text-slate-900">{formatRupiah(row.lineTotal)}</div>
                {#if row.lineTax > 0}
                  <div class="text-[10px] text-slate-400">
                    termasuk pajak {formatRupiah(row.lineTax)}
                  </div>
                {/if}
              </div>
            {/if}
          {/snippet}

          {#snippet empty()}
            <div class="py-6 text-center text-xs text-slate-400">Tidak ada item pada pesanan ini.</div>
          {/snippet}
        </Table>
      </Card>
    </div>

    <div class="space-y-4">
      <Card title="Struk">
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Subtotal</dt>
            <dd class="text-slate-700">{formatRupiah(order.subtotal)}</dd>
          </div>
          {#if order.taxTotal > 0}
            <div class="flex justify-between">
              <dt class="text-slate-500">Pajak</dt>
              <dd class="text-slate-700">{formatRupiah(order.taxTotal)}</dd>
            </div>
          {/if}
          <div class="flex items-baseline justify-between border-t border-slate-200 pt-2 mt-2">
            <dt class="text-base font-semibold text-slate-900">Total</dt>
            <dd class="text-xl font-bold text-slate-900">{formatRupiah(order.total)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  </div>
{:else}
  <PageHeader
    title="Pesanan tidak ditemukan"
    breadcrumb={[
      { label: 'Pesanan', href: '/orders' },
      { label: 'Tidak ditemukan' }
    ]}
  />
  <Card>
    <div class="flex flex-col items-center gap-3 py-10 text-center">
      <Receipt class="h-12 w-12 text-slate-300" />
      <p class="text-sm font-medium text-slate-700">
        Tidak menemukan pesanan dengan id <code class="rounded bg-slate-100 px-1 font-mono">{id}</code>.
      </p>
      <Button variant="outline" onclick={() => goto('/orders')}>
        <ArrowLeft class="h-4 w-4" />
        Kembali ke daftar pesanan
      </Button>
    </div>
  </Card>
{/if}

<ConfirmDialog
  bind:open={confirmCancelOpen}
  title="Batalkan pesanan?"
  message={order
    ? `${order.code} akan ditandai dibatalkan. Stok dari setiap item akan otomatis dikembalikan ke batch asalnya.`
    : ''}
  confirmLabel="Batalkan pesanan"
  onConfirm={doCancel}
/>
