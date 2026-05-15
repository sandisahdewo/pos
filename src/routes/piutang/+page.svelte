<script lang="ts">
  import {
    Banknote,
    Receipt,
    User as UserIcon,
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
    orders,
    orderStatusLabels,
    paymentMethodOptions,
    paymentMethodLabels,
    type Order,
    type OrderStatus,
    type PaymentMethod
  } from '$lib/stores/orders.svelte';
  import { customers } from '$lib/stores/customers.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type PiutangRow = {
    order: Order;
    total: number;
    paid: number;
    outstanding: number;
  };

  let search = $state('');
  let customerFilter = $state('');
  let statusFilter = $state<'' | 'open' | 'paid'>('open');
  let start = $state('');
  let end = $state('');

  const customerName = (id?: string) => (id ? customers.getById(id)?.name ?? '—' : 'Walk-in');

  // All non-cancelled orders that originated as credit (status='credit') OR
  // started as credit and later finished (status='paid' with payments history).
  // For piutang scope we care about: orders that have customerId set + status
  // 'credit' (still owed) OR 'paid' but show in history for the chosen filter.
  const baseRows = $derived.by<PiutangRow[]>(() => {
    const rows: PiutangRow[] = [];
    for (const order of orders.items) {
      if (order.status === 'cancelled') continue;
      // Only orders with a customer (piutang requires identifying the debtor)
      if (!order.customerId) continue;
      // For paid orders: only include if they had multi-payment history (i.e.,
      // started as credit). A single full-payment record means it was paid in
      // full at sale time — not piutang lifecycle. We approximate by including
      // any order whose payments array length > 1 OR whose status is 'credit'.
      const isLifecyclePiutang =
        order.status === 'credit' ||
        (order.status === 'paid' && order.payments.length > 1);
      if (!isLifecyclePiutang) continue;
      const total = order.total;
      const paid = order.paidAmount;
      rows.push({ order, total, paid, outstanding: total - paid });
    }
    return rows;
  });

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return baseRows
      .filter((r) => {
        if (customerFilter && r.order.customerId !== customerFilter) return false;
        if (statusFilter === 'open' && r.outstanding <= 0.0001) return false;
        if (statusFilter === 'paid' && r.outstanding > 0.0001) return false;
        const d = r.order.createdAt.slice(0, 10);
        if (start && d < start) return false;
        if (end && d > end) return false;
        if (!q) return true;
        const cust = customerName(r.order.customerId);
        const hay = [r.order.code, cust, r.order.notes].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt));
  });

  const totalOutstanding = $derived(
    baseRows.reduce((s, r) => s + (r.outstanding > 0 ? r.outstanding : 0), 0)
  );
  const totalReceived = $derived(baseRows.reduce((s, r) => s + r.paid, 0));
  const totalSold = $derived(baseRows.reduce((s, r) => s + r.total, 0));

  // Group by customer for the per-customer outstanding summary
  type CustomerSummary = {
    customerId: string;
    customerName: string;
    creditAllowed: boolean;
    orderCount: number;
    outstanding: number;
  };

  const perCustomer = $derived.by<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();
    for (const r of baseRows) {
      if (r.outstanding <= 0.0001) continue;
      const cust = r.order.customerId ? customers.getById(r.order.customerId) : undefined;
      const key = r.order.customerId ?? 'unknown';
      const cur = map.get(key) ?? {
        customerId: key,
        customerName: cust?.name ?? 'Tidak diketahui',
        creditAllowed: cust?.creditAllowed ?? false,
        orderCount: 0,
        outstanding: 0
      };
      cur.orderCount += 1;
      cur.outstanding += r.outstanding;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
  });

  const customerOptions = $derived([
    { value: '', label: 'Semua pelanggan' },
    ...customers.items
      .filter((c) => c.status === 'active')
      .map((c) => ({ value: c.id, label: c.name }))
  ]);

  const statusOptions = [
    { value: 'open', label: 'Masih piutang' },
    { value: 'paid', label: 'Sudah lunas' },
    { value: '', label: 'Semua' }
  ];

  const columns = [
    { key: 'code' as const, label: 'Pesanan', width: '140px' },
    { key: 'customerName' as const, label: 'Pelanggan' },
    { key: 'createdAt' as const, label: 'Tanggal', width: '140px' },
    { key: 'orderStatus' as const, label: 'Status', width: '110px' },
    { key: 'total' as const, label: 'Nilai pesanan', align: 'right' as const, width: '150px' },
    { key: 'paid' as const, label: 'Sudah diterima', align: 'right' as const, width: '150px' },
    { key: 'outstanding' as const, label: 'Sisa piutang', align: 'right' as const, width: '150px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '200px' }
  ];

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

  function statusBadge(s: OrderStatus): 'success' | 'warning' | 'neutral' {
    if (s === 'paid') return 'success';
    if (s === 'credit') return 'warning';
    return 'neutral';
  }

  // === Payment modal ===
  let payOpen = $state(false);
  let payOrder = $state<Order | null>(null);
  let payAmount = $state(0);
  let payMethod = $state<PaymentMethod>('cash');
  let payNotes = $state('');
  let payError = $state('');

  function openPay(row: PiutangRow) {
    payOrder = row.order;
    payAmount = row.outstanding > 0 ? row.outstanding : 0;
    payMethod = 'cash';
    payNotes = '';
    payError = '';
    payOpen = true;
  }

  function savePay() {
    if (!payOrder) return;
    payError = '';
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      payError = 'Jumlah penerimaan harus lebih dari 0.';
      return;
    }
    const result = orders.recordPayment(payOrder.id, {
      amount: payAmount,
      method: payMethod,
      notes: payNotes.trim()
    });
    if (!result.ok) {
      payError = result.reason ?? 'Gagal mencatat penerimaan.';
      return;
    }
    toast.success(
      `Penerimaan tercatat · ${payOrder.code}`,
      `${formatRupiah(payAmount)} dari ${customerName(payOrder.customerId)}`
    );
    payOpen = false;
  }

  // === Detail modal ===
  let detailOpen = $state(false);
  let detailOrder = $state<Order | null>(null);

  function openDetail(row: PiutangRow) {
    detailOrder = row.order;
    detailOpen = true;
  }

  const detailLive = $derived(detailOrder ? orders.getById(detailOrder.id) : null);
  const detailOutstanding = $derived(
    detailLive ? detailLive.total - detailLive.paidAmount : 0
  );
</script>

<svelte:head>
  <title>Piutang Pelanggan · POS Admin</title>
</svelte:head>

<PageHeader
  title="Piutang Pelanggan"
  description="Pesanan yang dijual dengan kredit/bon — sisa pembayaran yang masih ditagih ke pelanggan."
  breadcrumb={[{ label: 'Keuangan' }, { label: 'Piutang Pelanggan' }]}
/>

<div class="mb-4 grid gap-3 sm:grid-cols-3">
  <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Total dijual (piutang)</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
      {formatRupiah(totalSold)}
    </p>
    <p class="mt-1 text-xs text-slate-500">Nilai pesanan kredit (lifetime)</p>
  </div>
  <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Sudah diterima</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-emerald-700">
      {formatRupiah(totalReceived)}
    </p>
    <p class="mt-1 text-xs text-slate-500">Akumulasi pelunasan</p>
  </div>
  <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Sisa piutang</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight {totalOutstanding > 0 ? 'text-amber-700' : 'text-slate-900'}">
      {formatRupiah(totalOutstanding)}
    </p>
    <p class="mt-1 text-xs text-slate-500">Yang masih ditagih ke pelanggan</p>
  </div>
</div>

{#if perCustomer.length > 0}
  <Card padded={false} class="mb-4">
    <div class="border-b border-slate-100 px-4 py-3">
      <h2 class="text-sm font-semibold text-slate-900">Rekap per pelanggan</h2>
      <p class="text-xs text-slate-500">
        Pelanggan dengan piutang terbesar (urutan menurun). Klik nama untuk filter daftar di bawah.
      </p>
    </div>
    <div class="divide-y divide-slate-100">
      {#each perCustomer as c (c.customerId)}
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50
            {customerFilter === c.customerId ? 'bg-brand-50/50' : ''}"
          onclick={() => (customerFilter = c.customerId === customerFilter ? '' : c.customerId)}
        >
          <div class="flex items-center gap-2">
            <UserIcon class="h-4 w-4 text-slate-400" />
            <span class="text-sm font-medium text-slate-900">{c.customerName}</span>
            {#if !c.creditAllowed}
              <Badge variant="danger" size="sm">Piutang tidak diizinkan</Badge>
            {/if}
            <span class="text-xs text-slate-500">· {c.orderCount} pesanan</span>
          </div>
          <span class="text-sm font-semibold text-amber-700">{formatRupiah(c.outstanding)}</span>
        </button>
      {/each}
    </div>
  </Card>
{/if}

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari kode pesanan, pelanggan, catatan…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={customerFilter} options={customerOptions} class="w-56" />
    <Select bind:value={statusFilter} options={statusOptions} class="w-40" />
    <Input type="date" bind:value={start} class="w-40" placeholder="Dari" />
    <Input type="date" bind:value={end} class="w-40" placeholder="Sampai" />
  </div>

  <Table {columns} rows={filtered} rowKey={(r) => r.order.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'code'}
        <a
          href="/orders/{row.order.id}"
          class="font-mono text-sm font-medium text-brand-700 hover:underline"
        >
          {row.order.code}
        </a>
      {:else if column.key === 'customerName'}
        <div class="flex items-center gap-1.5 text-slate-700">
          <UserIcon class="h-3.5 w-3.5 text-slate-400" />
          <span class="font-medium text-slate-900">{customerName(row.order.customerId)}</span>
        </div>
      {:else if column.key === 'createdAt'}
        <span class="text-xs text-slate-600">{fmtDate(row.order.createdAt.slice(0, 10))}</span>
      {:else if column.key === 'orderStatus'}
        <Badge variant={statusBadge(row.order.status)} size="sm">
          {orderStatusLabels[row.order.status]}
        </Badge>
      {:else if column.key === 'total'}
        <span class="text-slate-700">{formatRupiah(row.total)}</span>
      {:else if column.key === 'paid'}
        <span class="text-slate-500">{formatRupiah(row.paid)}</span>
      {:else if column.key === 'outstanding'}
        <span
          class="font-semibold {row.outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}"
        >
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
              Terima
            </Button>
          {/if}
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-10">
        <Wallet class="h-8 w-8 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Tidak ada piutang yang cocok</p>
        <p class="max-w-sm text-xs text-slate-400">
          Pesanan piutang muncul di sini saat kasir menyelesaikan transaksi dengan pembayaran kurang dari total
          (memerlukan pelanggan yang diizinkan kredit).
        </p>
      </div>
    {/snippet}
  </Table>
</Card>

<!-- Payment receipt modal -->
<Modal
  bind:open={payOpen}
  size="md"
  title="Catat penerimaan{payOrder ? ` · ${payOrder.code}` : ''}"
  description={payOrder
    ? `Dari ${customerName(payOrder.customerId)}. Sisa piutang akan otomatis berkurang.`
    : ''}
>
  {#if payOrder}
    <div class="grid gap-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <div class="flex justify-between">
          <span class="text-slate-500">Total pesanan</span>
          <span class="font-medium text-slate-800">{formatRupiah(payOrder.total)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Sudah diterima</span>
          <span class="font-medium text-slate-800">{formatRupiah(payOrder.paidAmount)}</span>
        </div>
        <div class="mt-1 flex justify-between border-t border-slate-200 pt-1">
          <span class="text-sm font-medium text-slate-700">Sisa piutang</span>
          <span class="text-sm font-semibold text-amber-700">
            {formatRupiah(payOrder.total - payOrder.paidAmount)}
          </span>
        </div>
      </div>
      <MoneyInput label="Jumlah diterima" bind:value={payAmount} />
      <Select label="Metode" bind:value={payMethod} options={paymentMethodOptions} />
      <Textarea
        label="Catatan"
        placeholder="Nomor referensi transfer, catatan penagihan, dll."
        bind:value={payNotes}
      />
      {#if payError}
        <p class="text-sm text-rose-600">{payError}</p>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (payOpen = false)}>Batal</Button>
    <Button onclick={savePay}>Catat penerimaan</Button>
  {/snippet}
</Modal>

<!-- Detail modal -->
<Modal
  bind:open={detailOpen}
  size="lg"
  title={detailOrder ? `Riwayat penerimaan · ${detailOrder.code}` : ''}
  description={detailOrder ? `Pelanggan: ${customerName(detailOrder.customerId)}` : ''}
>
  {#if detailLive}
    <div class="mb-4 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
      <div>
        <p class="text-[10px] tracking-wider text-slate-500 uppercase">Total pesanan</p>
        <p class="mt-1 font-semibold text-slate-900">{formatRupiah(detailLive.total)}</p>
      </div>
      <div>
        <p class="text-[10px] tracking-wider text-slate-500 uppercase">Sudah diterima</p>
        <p class="mt-1 font-semibold text-emerald-700">{formatRupiah(detailLive.paidAmount)}</p>
      </div>
      <div>
        <p class="text-[10px] tracking-wider text-slate-500 uppercase">Sisa piutang</p>
        <p class="mt-1 font-semibold {detailOutstanding > 0 ? 'text-amber-700' : 'text-slate-900'}">
          {formatRupiah(detailOutstanding)}
        </p>
      </div>
    </div>

    {#if detailLive.payments.length === 0}
      <div class="flex flex-col items-center gap-1.5 py-6">
        <AlertCircle class="h-7 w-7 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Belum ada penerimaan</p>
        <p class="text-xs text-slate-400">Pelanggan belum membayar apa-apa.</p>
      </div>
    {:else}
      <ol class="relative space-y-3 border-l border-slate-200 pl-5">
        {#each detailLive.payments as p (p.id)}
          <li class="relative">
            <span class="absolute -left-[26px] top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500"></span>
            <div class="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span class="font-semibold text-emerald-700">+{formatRupiah(p.amount)}</span>
              <span class="text-slate-400">·</span>
              <Badge variant="neutral" size="sm">{paymentMethodLabels[p.method]}</Badge>
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
      <Button variant="outline" href="/orders/{detailLive.id}">
        <ExternalLink class="h-4 w-4" />
        Buka pesanan
      </Button>
    {/if}
    <Button variant="outline" onclick={() => (detailOpen = false)}>Tutup</Button>
  {/snippet}
</Modal>
