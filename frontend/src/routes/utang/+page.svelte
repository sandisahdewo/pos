<script lang="ts">
  import {
    Banknote,
    Receipt,
    Truck,
    Search,
    ExternalLink,
    Wallet,
    AlertCircle
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    Input,
    Modal,
    MoneyInput,
    PageHeader,
    Select,
    Table,
    Textarea
  } from '$lib/components/ui';
  import {
    purchaseOrders,
    poTotal,
    type PurchaseOrder,
    type PurchaseOrderPaymentMethod,
    type PurchaseOrderStatus
  } from '$lib/stores/purchaseOrders.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type UtangRow = {
    po: PurchaseOrder;
    total: number;
    paid: number;
    outstanding: number;
  };

  let search = $state('');
  let supplierFilter = $state('');
  let statusFilter = $state<'' | 'open' | 'paid'>('open');
  let start = $state('');
  let end = $state('');

  const supplierName = (id: string) => suppliers.getById(id)?.name ?? '—';

  // Only standard POs count as utang. Consignment goes through /payouts.
  // Cancelled POs are excluded.
  const baseRows = $derived.by<UtangRow[]>(() => {
    const rows: UtangRow[] = [];
    for (const po of purchaseOrders.items) {
      if (po.type !== 'standard') continue;
      if (po.status === 'cancelled' || po.status === 'draft') continue;
      const total = poTotal(po);
      const paid = po.paidAmount;
      rows.push({ po, total, paid, outstanding: total - paid });
    }
    return rows;
  });

  function paymentStatus(row: UtangRow): 'paid' | 'partial' | 'unpaid' {
    if (row.outstanding <= 0.0001) return 'paid';
    if (row.paid > 0) return 'partial';
    return 'unpaid';
  }

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return baseRows.filter((r) => {
      if (supplierFilter && r.po.supplierId !== supplierFilter) return false;
      if (statusFilter === 'open' && r.outstanding <= 0.0001) return false;
      if (statusFilter === 'paid' && r.outstanding > 0.0001) return false;
      if (start && r.po.orderDate < start) return false;
      if (end && r.po.orderDate > end) return false;
      if (!q) return true;
      const supplier = supplierName(r.po.supplierId);
      const hay = [r.po.code, supplier, r.po.notes].join(' ').toLowerCase();
      return hay.includes(q);
    });
  });

  const totalOutstanding = $derived(
    baseRows.reduce((s, r) => s + (r.outstanding > 0 ? r.outstanding : 0), 0)
  );
  const totalPaid = $derived(baseRows.reduce((s, r) => s + r.paid, 0));
  const totalCommitted = $derived(baseRows.reduce((s, r) => s + r.total, 0));

  const supplierOptions = $derived([
    { value: '', label: 'Semua pemasok' },
    ...suppliers.active().map((s) => ({ value: s.id, label: s.name }))
  ]);

  const statusOptions = [
    { value: 'open', label: 'Masih utang' },
    { value: 'paid', label: 'Sudah lunas' },
    { value: '', label: 'Semua' }
  ];

  const columns = [
    { key: 'code' as const, label: 'PO', width: '140px' },
    { key: 'supplierName' as const, label: 'Pemasok' },
    { key: 'orderDate' as const, label: 'Tanggal pesan', width: '130px' },
    { key: 'poStatus' as const, label: 'Status PO', width: '110px' },
    { key: 'total' as const, label: 'Nilai PO', align: 'right' as const, width: '140px' },
    { key: 'paid' as const, label: 'Sudah dibayar', align: 'right' as const, width: '150px' },
    { key: 'outstanding' as const, label: 'Sisa utang', align: 'right' as const, width: '150px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '180px' }
  ];

  const poStatusLabels: Record<PurchaseOrderStatus, string> = {
    draft: 'Draft',
    sent: 'Terkirim',
    partial: 'Sebagian diterima',
    received: 'Lengkap diterima',
    cancelled: 'Dibatalkan'
  };

  const poStatusBadge: Record<PurchaseOrderStatus, 'neutral' | 'warning' | 'success' | 'info' | 'danger'> = {
    draft: 'neutral',
    sent: 'info',
    partial: 'warning',
    received: 'success',
    cancelled: 'danger'
  };

  function fmtDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtDateTime(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  // === Payment modal ===
  let payOpen = $state(false);
  let payPo = $state<PurchaseOrder | null>(null);
  let payAmount = $state(0);
  let payMethod = $state<PurchaseOrderPaymentMethod>('transfer');
  let payNotes = $state('');
  let payError = $state('');

  const payMethodOptions: { value: PurchaseOrderPaymentMethod; label: string }[] = [
    { value: 'cash', label: 'Tunai' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'other', label: 'Lainnya' }
  ];

  function openPay(row: UtangRow) {
    payPo = row.po;
    payAmount = row.outstanding > 0 ? row.outstanding : 0;
    payMethod = 'transfer';
    payNotes = '';
    payError = '';
    payOpen = true;
  }

  async function savePay() {
    if (!payPo) return;
    payError = '';
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      payError = 'Jumlah pembayaran harus lebih dari 0.';
      return;
    }
    const result = await purchaseOrders.recordPayment(payPo.id, {
      amount: payAmount,
      method: payMethod,
      notes: payNotes.trim()
    });
    if (!result.ok) {
      payError = result.reason ?? 'Gagal mencatat pembayaran.';
      return;
    }
    toast.success(
      `Pembayaran tercatat · ${payPo.code}`,
      `${formatRupiah(payAmount)} ke ${supplierName(payPo.supplierId)}`
    );
    payOpen = false;
  }

  // === Detail (payment history) modal ===
  let detailOpen = $state(false);
  let detailPo = $state<PurchaseOrder | null>(null);

  function openDetail(row: UtangRow) {
    detailPo = row.po;
    detailOpen = true;
  }

  const detailLive = $derived(detailPo ? purchaseOrders.getById(detailPo.id) : null);
  const detailTotal = $derived(detailLive ? poTotal(detailLive) : 0);
  const detailOutstanding = $derived(detailLive ? detailTotal - detailLive.paidAmount : 0);
</script>

<svelte:head>
  <title>Utang Pembelian · POS Admin</title>
</svelte:head>

<PageHeader
  title="Utang Pembelian"
  description="Order pembelian standar yang sudah dipesan/diterima tapi belum lunas. Konsinyasi dikelola di Pembayaran Konsinyasi."
  breadcrumb={[{ label: 'Keuangan' }, { label: 'Utang Pembelian' }]}
/>

<div class="mb-4 grid gap-3 sm:grid-cols-3">
  <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Total nilai PO</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
      {formatRupiah(totalCommitted)}
    </p>
    <p class="mt-1 text-xs text-slate-500">Semua PO standar aktif (sent + received)</p>
  </div>
  <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Sudah dibayar</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-emerald-700">
      {formatRupiah(totalPaid)}
    </p>
    <p class="mt-1 text-xs text-slate-500">Akumulasi pembayaran ke pemasok</p>
  </div>
  <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Sisa utang</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight {totalOutstanding > 0 ? 'text-amber-700' : 'text-slate-900'}">
      {formatRupiah(totalOutstanding)}
    </p>
    <p class="mt-1 text-xs text-slate-500">Yang masih perlu dibayar</p>
  </div>
</div>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari kode PO, pemasok, catatan…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={supplierFilter} options={supplierOptions} class="w-48" />
    <Select bind:value={statusFilter} options={statusOptions} class="w-44" />
    <Input type="date" bind:value={start} class="w-40" placeholder="Dari" />
    <Input type="date" bind:value={end} class="w-40" placeholder="Sampai" />
  </div>

  <Table {columns} rows={filtered} rowKey={(r) => r.po.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'code'}
        <a
          href="/purchase-orders/{row.po.id}"
          class="inline-flex items-center gap-1 font-mono text-sm font-medium text-brand-700 hover:underline"
        >
          {row.po.code}
        </a>
      {:else if column.key === 'supplierName'}
        <div class="flex items-center gap-1.5 text-slate-700">
          <Truck class="h-3.5 w-3.5 text-slate-400" />
          <span class="font-medium text-slate-900">{supplierName(row.po.supplierId)}</span>
        </div>
      {:else if column.key === 'orderDate'}
        <span class="text-xs text-slate-600">{fmtDate(row.po.orderDate)}</span>
      {:else if column.key === 'poStatus'}
        <Badge variant={poStatusBadge[row.po.status]} size="sm">
          {poStatusLabels[row.po.status]}
        </Badge>
      {:else if column.key === 'total'}
        <span class="text-slate-700">{formatRupiah(row.total)}</span>
      {:else if column.key === 'paid'}
        <span class="text-slate-500">{formatRupiah(row.paid)}</span>
      {:else if column.key === 'outstanding'}
        {@const st = paymentStatus(row)}
        <span class="font-semibold {st === 'paid' ? 'text-emerald-700' : st === 'partial' ? 'text-amber-700' : 'text-rose-700'}">
          {formatRupiah(row.outstanding)}
        </span>
      {:else if column.key === 'actions'}
        <div class="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" onclick={() => openDetail(row)}>
            <Receipt class="h-3.5 w-3.5" />
            Riwayat
          </Button>
          {#if row.outstanding > 0}
            <Button size="sm" onclick={() => openPay(row)}>
              <Banknote class="h-3.5 w-3.5" />
              Bayar
            </Button>
          {/if}
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-10">
        <Wallet class="h-8 w-8 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Tidak ada PO yang cocok</p>
        <p class="max-w-sm text-xs text-slate-400">
          Coba ubah filter status atau hapus rentang tanggal. PO draft dan konsinyasi tidak masuk daftar ini.
        </p>
      </div>
    {/snippet}
  </Table>
</Card>

<!-- Payment modal -->
<Modal
  bind:open={payOpen}
  size="md"
  title="Catat pembayaran{payPo ? ` · ${payPo.code}` : ''}"
  description={payPo ? `Pemasok: ${supplierName(payPo.supplierId)}. Sisa utang akan otomatis berkurang.` : ''}
>
  {#if payPo}
    <div class="grid gap-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <div class="flex justify-between">
          <span class="text-slate-500">Total PO</span>
          <span class="font-medium text-slate-800">{formatRupiah(poTotal(payPo))}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Sudah dibayar</span>
          <span class="font-medium text-slate-800">{formatRupiah(payPo.paidAmount)}</span>
        </div>
        <div class="mt-1 flex justify-between border-t border-slate-200 pt-1">
          <span class="text-sm font-medium text-slate-700">Sisa utang</span>
          <span class="text-sm font-semibold text-amber-700">
            {formatRupiah(poTotal(payPo) - payPo.paidAmount)}
          </span>
        </div>
      </div>
      <MoneyInput label="Jumlah pembayaran" bind:value={payAmount} />
      <Select label="Metode" bind:value={payMethod} options={payMethodOptions} />
      <Textarea
        label="Catatan"
        placeholder="Nomor referensi, detail transfer, dll."
        bind:value={payNotes}
      />
      {#if payError}
        <p class="text-sm text-rose-600">{payError}</p>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (payOpen = false)}>Batal</Button>
    <Button onclick={savePay}>Catat pembayaran</Button>
  {/snippet}
</Modal>

<!-- Detail modal -->
<Modal
  bind:open={detailOpen}
  size="lg"
  title={detailPo ? `Riwayat pembayaran · ${detailPo.code}` : ''}
  description={detailPo ? `Pemasok: ${supplierName(detailPo.supplierId)}` : ''}
>
  {#if detailLive}
    <div class="mb-4 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
      <div>
        <p class="text-[10px] tracking-wider text-slate-500 uppercase">Total PO</p>
        <p class="mt-1 font-semibold text-slate-900">{formatRupiah(detailTotal)}</p>
      </div>
      <div>
        <p class="text-[10px] tracking-wider text-slate-500 uppercase">Sudah dibayar</p>
        <p class="mt-1 font-semibold text-emerald-700">{formatRupiah(detailLive.paidAmount)}</p>
      </div>
      <div>
        <p class="text-[10px] tracking-wider text-slate-500 uppercase">Sisa</p>
        <p class="mt-1 font-semibold {detailOutstanding > 0 ? 'text-amber-700' : 'text-slate-900'}">
          {formatRupiah(detailOutstanding)}
        </p>
      </div>
    </div>

    {#if detailLive.payments.length === 0}
      <div class="flex flex-col items-center gap-1.5 py-6">
        <AlertCircle class="h-7 w-7 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Belum ada pembayaran</p>
        <p class="text-xs text-slate-400">Catat pembayaran pertama dari tombol Bayar.</p>
      </div>
    {:else}
      <ol class="relative space-y-3 border-l border-slate-200 pl-5">
        {#each detailLive.payments as p (p.id)}
          <li class="relative">
            <span class="absolute -left-[26px] top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500"></span>
            <div class="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span class="font-semibold text-emerald-700">+{formatRupiah(p.amount)}</span>
              <span class="text-slate-400">·</span>
              <Badge variant="neutral" size="sm">
                {p.method === 'transfer' ? 'Transfer' : p.method === 'cash' ? 'Tunai' : 'Lainnya'}
              </Badge>
              <span class="text-slate-400">·</span>
              <span class="text-slate-500">{fmtDateTime(p.at)}</span>
            </div>
            {#if p.notes}
              <p class="mt-0.5 text-xs text-slate-500">{p.notes}</p>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}
  {/if}

  {#snippet footer()}
    {#if detailLive}
      <Button variant="outline" href="/purchase-orders/{detailLive.id}">
        <ExternalLink class="h-4 w-4" />
        Buka PO
      </Button>
    {/if}
    <Button variant="outline" onclick={() => (detailOpen = false)}>Tutup</Button>
  {/snippet}
</Modal>
