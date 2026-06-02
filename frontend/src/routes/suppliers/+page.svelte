<script lang="ts">
  import { Plus, Search, Pencil, Trash2, Truck, Mail, Phone, Clock } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    Modal,
    PageHeader,
    Select,
    Table,
    Textarea
  } from '$lib/components/ui';
  import {
    suppliers,
    type Supplier,
    type SupplierStatus
  } from '$lib/stores/suppliers.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let statusFilter = $state<'' | SupplierStatus>('');

  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Supplier | null>(null);

  type FormState = {
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    leadTimeDays: number;
    status: SupplierStatus;
    notes: string;
  };

  const blankForm: FormState = {
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    leadTimeDays: 7,
    status: 'active',
    notes: ''
  };

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});

  const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'archived', label: 'Diarsipkan' }
  ];
  const filterStatusOptions = [{ value: '', label: 'Semua status' }, ...statusOptions];

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return suppliers.items.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q)
      );
    });
  });

  const columns = [
    { key: 'name' as const, label: 'Pemasok' },
    { key: 'contactPerson' as const, label: 'Kontak' },
    { key: 'phone' as const, label: 'Telepon' },
    { key: 'leadTimeDays' as const, label: 'Waktu tunggu', align: 'right' as const, width: '120px' },
    { key: 'status' as const, label: 'Status' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '120px' }
  ];

  function openCreate() {
    editingId = null;
    form = { ...blankForm };
    errors = {};
    formOpen = true;
  }

  function openEdit(s: Supplier) {
    editingId = s.id;
    form = {
      name: s.name,
      contactPerson: s.contactPerson,
      email: s.email,
      phone: s.phone,
      address: s.address,
      leadTimeDays: s.leadTimeDays,
      status: s.status,
      notes: s.notes
    };
    errors = {};
    formOpen = true;
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Masukkan email yang valid atau kosongkan.';
    if (!Number.isInteger(form.leadTimeDays) || form.leadTimeDays < 0)
      next.leadTimeDays = 'Waktu tunggu harus bilangan bulat non-negatif.';
    errors = next;
    return Object.keys(next).length === 0;
  }

  let submitting = $state(false);

  $effect(() => {
    if (!suppliers.loaded && !suppliers.loading) {
      suppliers.load().catch((err) =>
        toast.error('Gagal memuat pemasok', err?.message ?? 'Tidak diketahui')
      );
    }
  });

  async function save() {
    if (!validate()) return;
    submitting = true;
    try {
      if (editingId) {
        await suppliers.update(editingId, { ...form });
        toast.success('Pemasok diperbarui', form.name);
      } else {
        await suppliers.add({ ...form });
        toast.success('Pemasok ditambahkan', form.name);
      }
      formOpen = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan pemasok', msg);
    } finally {
      submitting = false;
    }
  }

  function askDelete(s: Supplier) {
    pendingDelete = s;
    confirmOpen = true;
  }

  async function doDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    pendingDelete = null;
    try {
      await suppliers.remove(target.id);
      toast.success('Pemasok dihapus', target.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menghapus pemasok', msg);
    }
  }
</script>

<svelte:head>
  <title>Pemasok · POS Admin</title>
</svelte:head>

<PageHeader
  title="Pemasok"
  description="Vendor yang memasok produk Anda. Menjadi dasar Order Pembelian dan tracking konsinyasi."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Pemasok' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah pemasok
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari nama, kontak, email, atau telepon…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={statusFilter} options={filterStatusOptions} class="w-40" />
  </div>

  <Table {columns} rows={filtered} rowKey={(s) => s.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"
          >
            <Truck class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <div class="truncate font-medium text-slate-900">{row.name}</div>
            {#if row.email}
              <div class="flex items-center gap-1 truncate text-xs text-slate-500">
                <Mail class="h-3 w-3" />
                {row.email}
              </div>
            {/if}
          </div>
        </div>
      {:else if column.key === 'contactPerson'}
        <span class="text-slate-700">{row.contactPerson || '—'}</span>
      {:else if column.key === 'phone'}
        {#if row.phone}
          <div class="flex items-center gap-1.5 text-slate-600">
            <Phone class="h-3.5 w-3.5 text-slate-400" />
            {row.phone}
          </div>
        {:else}
          <span class="text-xs text-slate-400">—</span>
        {/if}
      {:else if column.key === 'leadTimeDays'}
        <div class="inline-flex items-center gap-1 text-slate-600">
          <Clock class="h-3.5 w-3.5 text-slate-400" />
          {row.leadTimeDays} hari
        </div>
      {:else if column.key === 'status'}
        <Badge variant={row.status === 'active' ? 'success' : 'neutral'} dot>
          {row.status === 'active' ? 'Aktif' : 'Diarsipkan'}
        </Badge>
      {:else if column.key === 'id'}
        <div class="flex justify-end gap-1">
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Ubah"
            onclick={() => openEdit(row)}
          >
            <Pencil class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Hapus"
            onclick={() => askDelete(row)}
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-6">
        <p class="text-sm font-medium text-slate-600">Tidak ada pemasok yang cocok</p>
        <p class="text-xs text-slate-400">Coba bersihkan pencarian atau filter.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="lg"
  title={editingId ? 'Ubah pemasok' : 'Tambah pemasok'}
  description={editingId
    ? 'Perbarui detail vendor.'
    : 'Tambahkan vendor yang memasok produk.'}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <Input
      class="sm:col-span-2"
      label="Nama"
      placeholder="mis. PT Kopi Nusantara"
      bind:value={form.name}
      error={errors.name}
    />
    <Input
      label="Nama kontak"
      placeholder="mis. Budi Santoso"
      bind:value={form.contactPerson}
    />
    <Input
      label="Email"
      type="email"
      placeholder="orders@vendor.id"
      bind:value={form.email}
      error={errors.email}
    >
      {#snippet leading()}<Mail class="h-4 w-4" />{/snippet}
    </Input>
    <Input label="Telepon" placeholder="+62 ..." bind:value={form.phone}>
      {#snippet leading()}<Phone class="h-4 w-4" />{/snippet}
    </Input>
    <Input
      label="Waktu tunggu (hari)"
      type="number"
      step="1"
      min="0"
      bind:value={form.leadTimeDays}
      hint="Estimasi hari dari kita order ke barang sampai."
      error={errors.leadTimeDays}
    />
    <Input
      class="sm:col-span-2"
      label="Alamat"
      placeholder="Jalan, kota"
      bind:value={form.address}
    />
    <Select label="Status" bind:value={form.status} options={statusOptions} />
    <Textarea
      class="sm:col-span-2"
      label="Catatan"
      placeholder="Termin pembayaran, preferensi pengiriman…"
      bind:value={form.notes}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save} loading={submitting} disabled={submitting}>
      {editingId ? 'Simpan perubahan' : 'Tambah pemasok'}
    </Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus pemasok?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus. Produk konsinyasi dari pemasok ini akan kehilangan referensi.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
