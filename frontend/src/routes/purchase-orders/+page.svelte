<script lang="ts">
  import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Receipt,
    Truck,
    PackageCheck,
    XCircle,
    CircleDashed,
    Send,
    Eye,
    ShoppingCart
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    PageHeader,
    Select,
    Table
  } from '$lib/components/ui';
  import {
    poTotal,
    purchaseOrders,
    purchaseOrderStatusLabels,
    purchaseOrderTypeLabels,
    type PurchaseOrder,
    type PurchaseOrderStatus,
    type PurchaseOrderType
  } from '$lib/stores/purchaseOrders.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let search = $state('');
  let typeFilter = $state<'' | PurchaseOrderType>('');
  let statusFilter = $state<'' | PurchaseOrderStatus>('');

  let confirmOpen = $state(false);
  let pendingDelete = $state<PurchaseOrder | null>(null);

  const supplierName = (id: string) => suppliers.getById(id)?.name ?? '—';

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return purchaseOrders.items.filter((po) => {
      if (typeFilter && po.type !== typeFilter) return false;
      if (statusFilter && po.status !== statusFilter) return false;
      if (!q) return true;
      return (
        po.code.toLowerCase().includes(q) ||
        supplierName(po.supplierId).toLowerCase().includes(q) ||
        po.notes.toLowerCase().includes(q)
      );
    });
  });

  const filterTypeOptions = [
    { value: '', label: 'Semua tipe' },
    { value: 'standard', label: 'Standar' },
    { value: 'consignment', label: 'Konsinyasi' }
  ];

  const filterStatusOptions = [
    { value: '', label: 'Semua status' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Terkirim' },
    { value: 'partial', label: 'Sebagian' },
    { value: 'received', label: 'Diterima' },
    { value: 'cancelled', label: 'Dibatalkan' }
  ];

  const columns = [
    { key: 'code' as const, label: 'PO' },
    { key: 'supplierId' as const, label: 'Pemasok' },
    { key: 'type' as const, label: 'Tipe' },
    { key: 'orderDate' as const, label: 'Tanggal order' },
    { key: 'lines' as const, label: 'Item', align: 'right' as const, width: '80px' },
    { key: 'status' as const, label: 'Status' },
    { key: 'id' as const, label: 'Total', align: 'right' as const, width: '180px' }
  ];

  function statusBadgeVariant(s: PurchaseOrderStatus) {
    if (s === 'draft') return 'neutral' as const;
    if (s === 'sent') return 'info' as const;
    if (s === 'partial') return 'warning' as const;
    if (s === 'received') return 'success' as const;
    return 'danger' as const;
  }

  function statusIcon(s: PurchaseOrderStatus) {
    if (s === 'draft') return CircleDashed;
    if (s === 'sent') return Send;
    if (s === 'partial') return PackageCheck;
    if (s === 'received') return PackageCheck;
    return XCircle;
  }

  function askDelete(po: PurchaseOrder) {
    pendingDelete = po;
    confirmOpen = true;
  }

  async function doDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    pendingDelete = null;
    const result = await purchaseOrders.remove(target.id);
    if (result.ok) toast.success('Order pembelian dihapus', target.code);
    else toast.error('Tidak bisa dihapus', result.reason);
  }

  function fmtDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<svelte:head>
  <title>Order Pembelian · POS Admin</title>
</svelte:head>

<PageHeader
  title="Order Pembelian"
  description="Lacak stok yang masuk dari pemasok. PO standar menciptakan utang; PO konsinyasi tidak."
  breadcrumb={[{ label: 'Pengadaan' }, { label: 'Order Pembelian' }]}
>
  {#snippet actions()}
    <Button variant="outline" href="/purchase-orders/baru-per-produk">
      <ShoppingCart class="h-4 w-4" />
      Buat per produk
    </Button>
    <Button href="/purchase-orders/new">
      <Plus class="h-4 w-4" />
      Buat per pemasok
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[240px] flex-1">
      <Input placeholder="Cari berdasarkan kode, pemasok, atau catatan…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={typeFilter} options={filterTypeOptions} class="w-40" />
    <Select bind:value={statusFilter} options={filterStatusOptions} class="w-40" />
  </div>

  <Table {columns} rows={filtered} rowKey={(p) => p.id}>
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
              href="/purchase-orders/{row.id}"
              class="font-mono text-sm font-medium text-slate-900 hover:text-brand-700"
            >
              {row.code}
            </a>
            {#if row.notes}
              <div class="line-clamp-1 max-w-xs text-xs text-slate-500">{row.notes}</div>
            {/if}
          </div>
        </div>
      {:else if column.key === 'supplierId'}
        <div class="flex items-center gap-1.5 text-slate-700">
          <Truck class="h-3.5 w-3.5 text-slate-400" />
          {supplierName(row.supplierId)}
        </div>
      {:else if column.key === 'type'}
        <Badge variant={row.type === 'consignment' ? 'info' : 'neutral'} size="sm">
          {purchaseOrderTypeLabels[row.type]}
        </Badge>
      {:else if column.key === 'orderDate'}
        <span class="text-slate-600">{fmtDate(row.orderDate)}</span>
      {:else if column.key === 'lines'}
        <span class="font-medium text-slate-900">{row.lines.length}</span>
      {:else if column.key === 'status'}
        {@const Icon = statusIcon(row.status)}
        <Badge variant={statusBadgeVariant(row.status)} size="sm">
          <Icon class="mr-1 h-3 w-3" />
          {purchaseOrderStatusLabels[row.status]}
        </Badge>
      {:else if column.key === 'id'}
        <div class="flex items-center justify-end gap-3">
          <span class="font-semibold text-slate-900">{formatRupiah(poTotal(row))}</span>
          <div class="flex gap-1">
            <a
              href="/purchase-orders/{row.id}"
              class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Lihat"
            >
              <Eye class="h-4 w-4" />
            </a>
            {#if row.status === 'draft'}
              <a
                href="/purchase-orders/{row.id}/edit"
                class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Ubah"
              >
                <Pencil class="h-4 w-4" />
              </a>
              <button
                type="button"
                class="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Hapus"
                onclick={() => askDelete(row)}
              >
                <Trash2 class="h-4 w-4" />
              </button>
            {/if}
          </div>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-6">
        <p class="text-sm font-medium text-slate-600">Tidak ada order pembelian yang cocok</p>
        <p class="text-xs text-slate-400">Sesuaikan filter atau buat PO baru.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus order pembelian?"
  message={pendingDelete
    ? `"${pendingDelete.code}" akan dihapus. Hanya PO Draft yang bisa dihapus.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
