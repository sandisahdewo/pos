<script lang="ts">
  import { Search, Receipt, User as UserIcon, Eye, ScanLine } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    Input,
    PageHeader,
    Select,
    Table
  } from '$lib/components/ui';
  import {
    orderItemCount,
    orderStatusLabels,
    orders,
    paymentMethodLabels,
    type Order,
    type OrderStatus,
    type PaymentMethod
  } from '$lib/stores/orders.svelte';
  import { customers } from '$lib/stores/customers.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let search = $state('');
  let statusFilter = $state<'' | OrderStatus>('');
  let paymentFilter = $state<'' | PaymentMethod>('');

  const filterStatusOptions = [
    { value: '', label: 'Semua status' },
    { value: 'paid', label: 'Lunas' },
    { value: 'cancelled', label: 'Dibatalkan' }
  ];
  const filterPaymentOptions = [
    { value: '', label: 'Semua pembayaran' },
    { value: 'cash', label: 'Tunai' },
    { value: 'card', label: 'Kartu' },
    { value: 'qris', label: 'QRIS' },
    { value: 'transfer', label: 'Transfer' }
  ];

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return [...orders.items]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((o) => {
        if (statusFilter && o.status !== statusFilter) return false;
        if (paymentFilter && o.paymentMethod !== paymentFilter) return false;
        if (!q) return true;
        const customer = o.customerId ? customers.getById(o.customerId)?.name ?? '' : 'Walk-in';
        return (
          o.code.toLowerCase().includes(q) ||
          customer.toLowerCase().includes(q) ||
          o.lines.some((l) => l.productName.toLowerCase().includes(q))
        );
      });
  });

  const columns = [
    { key: 'code' as const, label: 'Pesanan' },
    { key: 'createdAt' as const, label: 'Waktu' },
    { key: 'customerId' as const, label: 'Pelanggan' },
    { key: 'lines' as const, label: 'Item', align: 'right' as const, width: '80px' },
    { key: 'paymentMethod' as const, label: 'Pembayaran' },
    { key: 'status' as const, label: 'Status' },
    { key: 'total' as const, label: 'Total', align: 'right' as const, width: '140px' }
  ];

  function customerLabel(o: Order): string {
    if (!o.customerId) return 'Walk-in';
    return customers.getById(o.customerId)?.name ?? '—';
  }


  function pricelistLabel(id: string): string {
    return pricelists.getById(id)?.name ?? '—';
  }

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

  function statusVariant(s: OrderStatus) {
    return s === 'paid' ? ('success' as const) : ('danger' as const);
  }
</script>

<svelte:head>
  <title>Pesanan · POS Admin</title>
</svelte:head>

<PageHeader
  title="Pesanan"
  description="Transaksi yang sudah diselesaikan dari terminal Kasir."
  breadcrumb={[{ label: 'Pesanan' }]}
>
  {#snippet actions()}
    <Button href="/pos">
      <ScanLine class="h-4 w-4" />
      Buka Kasir
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[240px] flex-1">
      <Input placeholder="Cari berdasarkan kode, pelanggan, atau produk…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={statusFilter} options={filterStatusOptions} class="w-36" />
    <Select bind:value={paymentFilter} options={filterPaymentOptions} class="w-36" />
  </div>

  <Table {columns} rows={filtered} rowKey={(o) => o.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'code'}
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"
          >
            <Receipt class="h-4 w-4" />
          </div>
          <div>
            <a
              href="/orders/{row.id}"
              class="font-mono text-sm font-medium text-slate-900 hover:text-brand-700"
            >
              {row.code}
            </a>
            <div class="text-xs text-slate-500">{pricelistLabel(row.pricelistId)}</div>
          </div>
        </div>
      {:else if column.key === 'createdAt'}
        <span class="text-slate-600">{fmtDateTime(row.createdAt)}</span>
      {:else if column.key === 'customerId'}
        <div class="flex items-center gap-1.5 text-slate-700">
          <UserIcon class="h-3.5 w-3.5 text-slate-400" />
          {customerLabel(row)}
        </div>
      {:else if column.key === 'lines'}
        <span class="font-medium text-slate-900">{orderItemCount(row)}</span>
      {:else if column.key === 'paymentMethod'}
        <Badge variant="outline" size="sm">{paymentMethodLabels[row.paymentMethod]}</Badge>
      {:else if column.key === 'status'}
        <Badge variant={statusVariant(row.status)} size="sm" dot>
          {orderStatusLabels[row.status]}
        </Badge>
      {:else if column.key === 'total'}
        <div class="flex items-center justify-end gap-2">
          <span class="font-semibold text-slate-900">{formatRupiah(row.total)}</span>
          <a
            href="/orders/{row.id}"
            class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Lihat"
          >
            <Eye class="h-4 w-4" />
          </a>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
        <Receipt class="h-8 w-8 text-slate-300" />
        <p>Belum ada pesanan — catat transaksi pertama dari terminal Kasir.</p>
        <Button variant="outline" size="sm" href="/pos">
          <ScanLine class="h-4 w-4" />
          Buka Kasir
        </Button>
      </div>
    {/snippet}
  </Table>
</Card>
