<script lang="ts">
  import {
    Banknote,
    Receipt,
    Truck,
    PackageX,
    Pencil,
    Trash2,
    Search
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    Modal,
    MoneyInput,
    PageHeader,
    Select,
    Table,
    Textarea
  } from '$lib/components/ui';
  import {
    payouts,
    payoutMethodLabels,
    payoutMethodOptions,
    type Payout,
    type PayoutMethod
  } from '$lib/stores/payouts.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { consignmentOwedBySupplier } from '$lib/stores/orders.svelte';
  import { batches } from '$lib/stores/batches.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const todayISO = new Date().toISOString().slice(0, 10);

  let start = $state<string>('');
  let end = $state<string>('');
  let supplierFilter = $state<string>('');

  const supplierName = (id: string) => suppliers.getById(id)?.name ?? '—';

  const owedMap = $derived(consignmentOwedBySupplier({ start: start || undefined, end: end || undefined }));

  type OutstandingRow = {
    supplierId: string;
    supplierName: string;
    units: number;
    owed: number;
    paid: number;
    outstanding: number;
  };

  const outstandingRows = $derived.by<OutstandingRow[]>(() => {
    const rows: OutstandingRow[] = [];
    for (const [supplierId, agg] of owedMap.entries()) {
      if (supplierFilter && supplierId !== supplierFilter) continue;
      const paid = payouts.paidToSupplier(supplierId, end || undefined);
      rows.push({
        supplierId,
        supplierName: supplierName(supplierId),
        units: agg.units,
        owed: agg.amount,
        paid,
        outstanding: agg.amount - paid
      });
    }
    return rows.sort((a, b) => b.outstanding - a.outstanding);
  });

  const historyRows = $derived.by(() => {
    const rows = supplierFilter
      ? payouts.items.filter((p) => p.supplierId === supplierFilter)
      : payouts.items;
    return [...rows].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  });

  const supplierOptions = $derived([
    { value: '', label: 'Semua pemasok' },
    ...suppliers.active().map((s) => ({ value: s.id, label: s.name }))
  ]);

  const outstandingColumns = [
    { key: 'supplierName' as const, label: 'Pemasok' },
    { key: 'units' as const, label: 'Unit terjual', align: 'right' as const, width: '110px' },
    { key: 'owed' as const, label: 'Total utang', align: 'right' as const, width: '150px' },
    { key: 'paid' as const, label: 'Sudah dibayar', align: 'right' as const, width: '150px' },
    { key: 'outstanding' as const, label: 'Sisa utang', align: 'right' as const, width: '150px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '240px' }
  ];

  const historyColumns = [
    { key: 'code' as const, label: 'Kode' },
    { key: 'supplierId' as const, label: 'Pemasok' },
    { key: 'amount' as const, label: 'Jumlah', align: 'right' as const, width: '140px' },
    { key: 'method' as const, label: 'Metode', width: '110px' },
    { key: 'period' as const, label: 'Periode' },
    { key: 'paidAt' as const, label: 'Dibayar pada' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '80px' }
  ];

  // Record payout modal
  let payoutOpen = $state(false);
  let payoutSupplierId = $state<string>('');
  type PayoutFormState = {
    amount: number;
    method: PayoutMethod;
    coversPeriodStart: string;
    coversPeriodEnd: string;
    notes: string;
  };
  let payoutForm = $state<PayoutFormState>({
    amount: 0,
    method: 'transfer',
    coversPeriodStart: '',
    coversPeriodEnd: '',
    notes: ''
  });
  let payoutErrors = $state<Partial<Record<keyof PayoutFormState, string>>>({});

  function openRecordPayout(row: OutstandingRow) {
    payoutSupplierId = row.supplierId;
    payoutForm = {
      amount: Math.max(row.outstanding, 0),
      method: 'transfer',
      coversPeriodStart: start || '',
      coversPeriodEnd: end || todayISO,
      notes: ''
    };
    payoutErrors = {};
    payoutOpen = true;
  }

  function validatePayout(): boolean {
    const next: typeof payoutErrors = {};
    if (!Number.isFinite(payoutForm.amount) || payoutForm.amount <= 0)
      next.amount = 'Jumlah harus lebih besar dari 0.';
    if (!payoutForm.coversPeriodStart) next.coversPeriodStart = 'Wajib diisi.';
    if (!payoutForm.coversPeriodEnd) next.coversPeriodEnd = 'Wajib diisi.';
    if (
      payoutForm.coversPeriodStart &&
      payoutForm.coversPeriodEnd &&
      payoutForm.coversPeriodStart > payoutForm.coversPeriodEnd
    )
      next.coversPeriodEnd = 'Tanggal akhir harus setelah tanggal mulai.';
    payoutErrors = next;
    return Object.keys(next).length === 0;
  }

  async function savePayout() {
    if (!validatePayout()) return;
    try {
      const created = await payouts.add({
        supplierId: payoutSupplierId,
        amount: payoutForm.amount,
        method: payoutForm.method,
        paidAt: todayISO,
        coversPeriodStart: payoutForm.coversPeriodStart,
        coversPeriodEnd: payoutForm.coversPeriodEnd,
        notes: payoutForm.notes.trim()
      });
      payoutOpen = false;
      toast.success(
        `Pembayaran tercatat · ${created.code}`,
        `${formatRupiah(created.amount)} ke ${supplierName(created.supplierId)}`
      );
    } catch (err) {
      toast.error('Gagal menyimpan pembayaran', err instanceof Error ? err.message : '');
    }
  }

  // Delete payout
  let confirmOpen = $state(false);
  let pendingDelete = $state<Payout | null>(null);

  function askDelete(p: Payout) {
    pendingDelete = p;
    confirmOpen = true;
  }

  async function doDelete() {
    if (!pendingDelete) return;
    const code = pendingDelete.code;
    const id = pendingDelete.id;
    pendingDelete = null;
    const ok = await payouts.remove(id);
    if (ok) toast.success('Pembayaran dihapus', code);
    else toast.error('Gagal menghapus pembayaran', code);
  }

  // Return stock modal
  let returnOpen = $state(false);
  let returnSupplierId = $state<string>('');
  let returnBatchId = $state<string>('');
  let returnQty = $state<number>(0);
  let returnError = $state<string>('');

  const returnableBatches = $derived.by(() => {
    if (!returnSupplierId) return [];
    return batches.forSupplier(returnSupplierId, 'consignment').filter((b) => b.qtyRemaining > 0);
  });

  function batchLabel(batchId: string): string {
    const b = batches.getById(batchId);
    if (!b) return batchId;
    const p = products.getById(b.productId);
    if (!p) return batchId;
    const variant = b.variantId ? p.variants.find((v) => v.id === b.variantId) : undefined;
    const name = variant ? `${p.name} — ${variant.name}` : p.name;
    return `${name} · sisa ${b.qtyRemaining} · diterima ${b.receivedAt}`;
  }

  const returnBatchOptions = $derived(
    returnableBatches.map((b) => ({ value: b.id, label: batchLabel(b.id) }))
  );

  function openReturn(row: OutstandingRow) {
    returnSupplierId = row.supplierId;
    returnBatchId = returnableBatches[0]?.id ?? '';
    returnQty = 0;
    returnError = '';
    returnOpen = true;
  }

  async function saveReturn() {
    returnError = '';
    if (!returnBatchId) {
      returnError = 'Pilih batch untuk dikembalikan.';
      return;
    }
    if (!Number.isFinite(returnQty) || returnQty <= 0) {
      returnError = 'Masukkan jumlah pengembalian yang positif.';
      return;
    }
    const result = await batches.returnToConsignor(returnBatchId, returnQty);
    if (!result.ok) {
      returnError = result.reason ?? 'Tidak bisa mengembalikan stok.';
      return;
    }
    const label = batchLabel(returnBatchId);
    returnOpen = false;
    toast.success(
      'Stok dikembalikan ke pemasok',
      `${returnQty} unit ${label.split(' · ')[0]}`
    );
  }

  function fmtDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<svelte:head>
  <title>Pembayaran Konsinyasi · POS Admin</title>
</svelte:head>

<PageHeader
  title="Pembayaran Konsinyasi"
  description="Berapa yang harus dibayarkan ke pemasok berdasarkan stok konsinyasi yang sudah terjual — dan pembayaran yang sudah dicatat."
  breadcrumb={[{ label: 'Pengadaan' }, { label: 'Pembayaran Konsinyasi' }]}
/>

<Card padded={false} class="mb-6">
  <div class="border-b border-slate-100 px-4 py-3">
    <div class="mb-1 flex items-center gap-2">
      <Banknote class="h-4 w-4 text-emerald-600" />
      <h2 class="text-sm font-semibold text-slate-900">Utang yang belum dibayar</h2>
    </div>
    <p class="text-xs text-slate-500">
      Diakumulasi dari <code class="rounded bg-slate-100 px-1 text-[11px]">batchAllocations</code> setiap
      item pesanan yang sudah lunas, di mana batch sumbernya adalah konsinyasi.
    </p>
  </div>

  <div class="flex flex-wrap items-end gap-2 border-b border-slate-100 px-4 py-3">
    <Input label="Dari" type="date" bind:value={start} class="w-44" />
    <Input label="Sampai" type="date" bind:value={end} class="w-44" />
    <Select label="Pemasok" bind:value={supplierFilter} options={supplierOptions} class="w-56" />
    <div class="ml-auto">
      <Button
        variant="outline"
        onclick={() => {
          start = '';
          end = '';
          supplierFilter = '';
        }}
      >
        Reset
      </Button>
    </div>
  </div>

  <Table columns={outstandingColumns} rows={outstandingRows} rowKey={(r) => r.supplierId}>
    {#snippet cell({ row, column })}
      {#if column.key === 'supplierName'}
        <div class="flex items-center gap-1.5 text-slate-700">
          <Truck class="h-3.5 w-3.5 text-slate-400" />
          <span class="font-medium text-slate-900">{row.supplierName}</span>
        </div>
      {:else if column.key === 'units'}
        <span class="text-slate-700">{row.units}</span>
      {:else if column.key === 'owed'}
        <span class="text-slate-700">{formatRupiah(row.owed)}</span>
      {:else if column.key === 'paid'}
        <span class="text-slate-500">{formatRupiah(row.paid)}</span>
      {:else if column.key === 'outstanding'}
        <span class="font-semibold {row.outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}">
          {formatRupiah(row.outstanding)}
        </span>
      {:else if column.key === 'actions'}
        <div class="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onclick={() => openReturn(row)}>
            <PackageX class="h-3.5 w-3.5" />
            Kembalikan stok
          </Button>
          <Button size="sm" onclick={() => openRecordPayout(row)}>
            <Banknote class="h-3.5 w-3.5" />
            Catat pembayaran
          </Button>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-8">
        <p class="text-sm font-medium text-slate-600">Tidak ada utang konsinyasi</p>
        <p class="text-xs text-slate-400">
          Penjualan stok konsinyasi akan muncul di sini dikelompokkan per pemasok.
        </p>
      </div>
    {/snippet}
  </Table>
</Card>

<Card padded={false}>
  <div class="border-b border-slate-100 px-4 py-3">
    <div class="mb-1 flex items-center gap-2">
      <Receipt class="h-4 w-4 text-slate-600" />
      <h2 class="text-sm font-semibold text-slate-900">Riwayat pembayaran</h2>
    </div>
    <p class="text-xs text-slate-500">Pembayaran yang sudah dicatat ke pemasok.</p>
  </div>

  <Table columns={historyColumns} rows={historyRows} rowKey={(p) => p.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'code'}
        <span class="font-mono text-sm font-medium text-slate-900">{row.code}</span>
      {:else if column.key === 'supplierId'}
        <div class="flex items-center gap-1.5 text-slate-700">
          <Truck class="h-3.5 w-3.5 text-slate-400" />
          {supplierName(row.supplierId)}
        </div>
      {:else if column.key === 'amount'}
        <span class="font-semibold text-slate-900">{formatRupiah(row.amount)}</span>
      {:else if column.key === 'method'}
        <Badge variant="neutral" size="sm">{payoutMethodLabels[row.method]}</Badge>
      {:else if column.key === 'period'}
        <span class="text-slate-600">
          {fmtDate(row.coversPeriodStart)} — {fmtDate(row.coversPeriodEnd)}
        </span>
      {:else if column.key === 'paidAt'}
        <span class="text-slate-600">{fmtDate(row.paidAt)}</span>
      {:else if column.key === 'actions'}
        <button
          type="button"
          class="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          aria-label="Hapus pembayaran"
          onclick={() => askDelete(row)}
        >
          <Trash2 class="h-4 w-4" />
        </button>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-8">
        <p class="text-sm font-medium text-slate-600">Belum ada pembayaran tercatat</p>
        <p class="text-xs text-slate-400">
          Klik Catat pembayaran pada baris pemasok di atas untuk mencatat pembayaran.
        </p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={payoutOpen}
  size="md"
  title="Catat pembayaran ke {supplierName(payoutSupplierId)}"
  description="Catat pembayaran. Kolom sisa utang akan terupdate langsung."
>
  <div class="grid gap-4">
    <MoneyInput
      label="Jumlah"
      bind:value={payoutForm.amount}
      error={payoutErrors.amount}
    />
    <Select
      label="Metode"
      bind:value={payoutForm.method}
      options={payoutMethodOptions}
    />
    <div class="grid grid-cols-2 gap-3">
      <Input
        label="Periode mulai"
        type="date"
        bind:value={payoutForm.coversPeriodStart}
        error={payoutErrors.coversPeriodStart}
      />
      <Input
        label="Periode akhir"
        type="date"
        bind:value={payoutForm.coversPeriodEnd}
        error={payoutErrors.coversPeriodEnd}
      />
    </div>
    <Textarea
      label="Catatan"
      placeholder="Nomor referensi, detail transfer bank, dll."
      bind:value={payoutForm.notes}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (payoutOpen = false)}>Batal</Button>
    <Button onclick={savePayout}>Catat pembayaran</Button>
  {/snippet}
</Modal>

<Modal
  bind:open={returnOpen}
  size="md"
  title="Kembalikan stok ke {supplierName(returnSupplierId)}"
  description="Mengurangi batch konsinyasi yang dipilih. Tidak ada utang, tidak ada pendapatan — pemilik toko tidak pernah memiliki unit ini."
>
  {#if returnableBatches.length === 0}
    <p class="text-sm text-slate-600">Tidak ada stok konsinyasi yang tersisa untuk pemasok ini.</p>
  {:else}
    <div class="grid gap-4">
      <Select label="Batch" bind:value={returnBatchId} options={returnBatchOptions} />
      <Input
        label="Jumlah dikembalikan"
        type="number"
        min="1"
        bind:value={returnQty}
      />
      {#if returnError}
        <p class="text-sm text-rose-600">{returnError}</p>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (returnOpen = false)}>Batal</Button>
    {#if returnableBatches.length > 0}
      <Button onclick={saveReturn}>Kembalikan ke pemasok</Button>
    {/if}
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus catatan pembayaran?"
  message={pendingDelete
    ? `"${pendingDelete.code}" akan dihapus dari riwayat. Ini tidak akan mengembalikan uang ke pemasok.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
