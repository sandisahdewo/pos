<script lang="ts">
  import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Users,
    Mail,
    Phone,
    Building2,
    User as UserIcon
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    Modal,
    Toggle,
    PageHeader,
    Select,
    Table,
    Textarea
  } from '$lib/components/ui';
  import {
    customers,
    customerTypeLabels,
    type Customer,
    type CustomerStatus,
    type CustomerType
  } from '$lib/stores/customers.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { page } from '$app/state';

  let search = $state('');
  let typeFilter = $state<'' | CustomerType>('');
  let statusFilter = $state<'' | CustomerStatus>('');
  let pricelistFilter = $state(page.url.searchParams.get('pricelist') ?? '');

  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Customer | null>(null);

  type FormState = {
    name: string;
    type: CustomerType;
    email: string;
    phone: string;
    address: string;
    pricelistId: string;
    taxId: string;
    status: CustomerStatus;
    creditAllowed: boolean;
    notes: string;
    joinedAt: string;
  };

  const blankForm = (): FormState => ({
    name: '',
    type: 'individual',
    email: '',
    phone: '',
    address: '',
    pricelistId: pricelists.defaultId(),
    taxId: '',
    status: 'active',
    creditAllowed: false,
    notes: '',
    joinedAt: new Date().toISOString().slice(0, 10)
  });

  let form = $state<FormState>(blankForm());
  let errors = $state<Partial<Record<keyof FormState, string>>>({});

  const typeOptions = [
    { value: 'individual', label: 'Individu' },
    { value: 'business', label: 'Bisnis' }
  ];
  const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'archived', label: 'Diarsipkan' }
  ];

  const filterTypeOptions = [{ value: '', label: 'Semua tipe' }, ...typeOptions];
  const filterStatusOptions = [{ value: '', label: 'Semua status' }, ...statusOptions];

  const pricelistOptions = $derived(
    pricelists.items.map((p) => ({
      value: p.id,
      label: p.isDefault ? `${p.name} (utama)` : p.name
    }))
  );

  const filterPricelistOptions = $derived([
    { value: '', label: 'Semua daftar harga' },
    ...pricelists.items.map((p) => ({ value: p.id, label: p.name }))
  ]);

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return customers.items.filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (pricelistFilter && c.pricelistId !== pricelistFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.taxId.toLowerCase().includes(q)
      );
    });
  });

  const columns = [
    { key: 'name' as const, label: 'Pelanggan' },
    { key: 'type' as const, label: 'Tipe', width: '110px' },
    { key: 'phone' as const, label: 'Kontak' },
    { key: 'pricelistId' as const, label: 'Daftar Harga', width: '140px' },
    { key: 'status' as const, label: 'Status', width: '110px' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '120px' }
  ];

  function pricelistName(id: string): string {
    return pricelists.getById(id)?.name ?? '—';
  }

  function openCreate() {
    editingId = null;
    form = blankForm();
    errors = {};
    formOpen = true;
  }

  function openEdit(c: Customer) {
    editingId = c.id;
    form = {
      name: c.name,
      type: c.type,
      email: c.email,
      phone: c.phone,
      address: c.address,
      pricelistId: c.pricelistId,
      taxId: c.taxId,
      status: c.status,
      creditAllowed: c.creditAllowed,
      notes: c.notes,
      joinedAt: c.joinedAt
    };
    errors = {};
    formOpen = true;
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    if (!form.pricelistId) next.pricelistId = 'Pilih daftar harga.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Masukkan email yang valid atau kosongkan.';
    errors = next;
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    try {
      if (editingId) {
        await customers.update(editingId, { ...form });
        toast.success('Pelanggan diperbarui', form.name);
      } else {
        await customers.add({ ...form });
        toast.success('Pelanggan ditambahkan', form.name);
      }
      formOpen = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan pelanggan', msg);
    }
  }

  function askDelete(c: Customer) {
    pendingDelete = c;
    confirmOpen = true;
  }

  async function doDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    pendingDelete = null;
    try {
      await customers.remove(target.id);
      toast.success('Pelanggan dihapus', target.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menghapus pelanggan', msg);
    }
  }

  function fmtDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<svelte:head>
  <title>Pelanggan · POS Admin</title>
</svelte:head>

<PageHeader
  title="Pelanggan"
  description="Orang dan bisnis yang Anda jual. Setiap pelanggan terhubung dengan daftar harga yang menentukan harga saat checkout."
  breadcrumb={[{ label: 'Katalog' }, { label: 'Pelanggan' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah pelanggan
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari nama, email, telepon, atau NPWP…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={typeFilter} options={filterTypeOptions} class="w-36" />
    <Select bind:value={pricelistFilter} options={filterPricelistOptions} class="w-44" />
    <Select bind:value={statusFilter} options={filterStatusOptions} class="w-36" />
  </div>

  <Table {columns} rows={filtered} rowKey={(c) => c.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700"
          >
            {#if row.type === 'business'}
              <Building2 class="h-4 w-4" />
            {:else}
              <UserIcon class="h-4 w-4" />
            {/if}
          </div>
          <div class="min-w-0">
            <div class="truncate font-medium text-slate-900">{row.name}</div>
            {#if row.email}
              <div class="flex items-center gap-1 truncate text-xs text-slate-500">
                <Mail class="h-3 w-3" />
                {row.email}
              </div>
            {:else if row.taxId}
              <div class="font-mono text-xs text-slate-500">NPWP {row.taxId}</div>
            {/if}
          </div>
        </div>
      {:else if column.key === 'type'}
        <Badge variant={row.type === 'business' ? 'info' : 'outline'} size="sm">
          {customerTypeLabels[row.type]}
        </Badge>
      {:else if column.key === 'phone'}
        {#if row.phone}
          <div class="flex items-center gap-1.5 text-slate-600">
            <Phone class="h-3.5 w-3.5 text-slate-400" />
            {row.phone}
          </div>
        {:else}
          <span class="text-xs text-slate-400">—</span>
        {/if}
      {:else if column.key === 'pricelistId'}
        <Badge variant="brand" size="sm">{pricelistName(row.pricelistId)}</Badge>
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
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
          <Users class="h-6 w-6" />
        </div>
        <p class="text-sm font-medium text-slate-600">Tidak ada pelanggan yang cocok</p>
        <p class="text-xs text-slate-400">Coba bersihkan filter atau tambahkan pelanggan baru.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="lg"
  title={editingId ? 'Ubah pelanggan' : 'Tambah pelanggan'}
  description={editingId
    ? 'Perbarui detail pelanggan.'
    : 'Tambahkan orang atau bisnis yang membeli dari toko Anda.'}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <Input
      class="sm:col-span-2"
      label="Nama"
      placeholder="mis. Andi Pratama atau PT Distributor Maju"
      bind:value={form.name}
      error={errors.name}
    />
    <Select label="Tipe" bind:value={form.type} options={typeOptions} />
    <Select
      label="Daftar Harga"
      bind:value={form.pricelistId}
      options={pricelistOptions}
      error={errors.pricelistId}
      hint="Menentukan harga yang dilihat pelanggan ini saat checkout."
    />
    <Input label="Email" type="email" placeholder="pelanggan@example.id" bind:value={form.email} error={errors.email}>
      {#snippet leading()}<Mail class="h-4 w-4" />{/snippet}
    </Input>
    <Input label="Telepon" placeholder="+62 ..." bind:value={form.phone}>
      {#snippet leading()}<Phone class="h-4 w-4" />{/snippet}
    </Input>
    {#if form.type === 'business'}
      <Input
        label="NPWP"
        placeholder="00.000.000.0-000.000"
        bind:value={form.taxId}
        hint="Untuk faktur PPN."
      />
      <Input
        label="Bergabung"
        type="date"
        bind:value={form.joinedAt}
      />
    {:else}
      <Input
        class="sm:col-span-2"
        label="Bergabung"
        type="date"
        bind:value={form.joinedAt}
      />
    {/if}
    <Input class="sm:col-span-2" label="Alamat" placeholder="Jalan, kota" bind:value={form.address} />
    <Select label="Status" bind:value={form.status} options={statusOptions} />
    <div class="sm:col-span-2">
      <Toggle
        bind:checked={form.creditAllowed}
        label="Boleh berbelanja secara kredit (piutang/bon)"
        description="Saat aktif, kasir bisa menyelesaikan transaksi dengan pembayaran kurang dari total. Sisa akan tercatat di Piutang Pelanggan."
      />
    </div>
    <Textarea
      class="sm:col-span-2"
      label="Catatan"
      placeholder="Preferensi, termin pembayaran, dll."
      bind:value={form.notes}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save}>{editingId ? 'Simpan perubahan' : 'Tambah pelanggan'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus pelanggan?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus. Riwayat pesanan mereka akan kehilangan referensi.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
