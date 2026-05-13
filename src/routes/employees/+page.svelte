<script lang="ts">
  import { Plus, Search, Pencil, Trash2, Mail, Phone, UserCog } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    Modal,
    PageHeader,
    Select,
    Table
  } from '$lib/components/ui';
  import {
    employees,
    roleLabels,
    type Employee,
    type EmployeeRole,
    type EmployeeStatus
  } from '$lib/stores/employees.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let roleFilter = $state<'' | EmployeeRole>('');
  let statusFilter = $state<'' | EmployeeStatus>('');

  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Employee | null>(null);

  type FormState = {
    name: string;
    email: string;
    phone: string;
    role: EmployeeRole;
    status: EmployeeStatus;
    joinedAt: string;
  };

  const blankForm: FormState = {
    name: '',
    email: '',
    phone: '',
    role: 'cashier',
    status: 'active',
    joinedAt: new Date().toISOString().slice(0, 10)
  };

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return employees.items.filter((e) => {
      if (roleFilter && e.role !== roleFilter) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q)
      );
    });
  });

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manajer' },
    { value: 'cashier', label: 'Kasir' },
    { value: 'staff', label: 'Staf' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Tidak aktif' }
  ];

  const filterRoleOptions = [{ value: '', label: 'Semua peran' }, ...roleOptions];
  const filterStatusOptions = [{ value: '', label: 'Semua status' }, ...statusOptions];

  const columns = [
    { key: 'name' as const, label: 'Pegawai' },
    { key: 'role' as const, label: 'Peran' },
    { key: 'phone' as const, label: 'Kontak' },
    { key: 'joinedAt' as const, label: 'Bergabung' },
    { key: 'status' as const, label: 'Status' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '120px' }
  ];

  function openCreate() {
    editingId = null;
    form = { ...blankForm };
    errors = {};
    formOpen = true;
  }

  function openEdit(emp: Employee) {
    editingId = emp.id;
    form = {
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      status: emp.status,
      joinedAt: emp.joinedAt
    };
    errors = {};
    formOpen = true;
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    if (!form.email.trim()) next.email = 'Email wajib diisi.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Masukkan email yang valid.';
    if (!form.phone.trim()) next.phone = 'Telepon wajib diisi.';
    if (!form.joinedAt) next.joinedAt = 'Tanggal bergabung wajib diisi.';
    errors = next;
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (editingId) {
      employees.update(editingId, { ...form });
      toast.success('Pegawai diperbarui', form.name);
    } else {
      employees.add({ ...form });
      toast.success('Pegawai ditambahkan', form.name);
    }
    formOpen = false;
  }

  function askDelete(emp: Employee) {
    pendingDelete = emp;
    confirmOpen = true;
  }

  function doDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    employees.remove(pendingDelete.id);
    pendingDelete = null;
    toast.success('Pegawai dihapus', name);
  }

  function fmtDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<svelte:head>
  <title>Pegawai · POS Admin</title>
</svelte:head>

<PageHeader
  title="Pegawai"
  description="Orang-orang yang dapat masuk dan mengoperasikan toko."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Pegawai' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah pegawai
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari nama, email, atau telepon…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={roleFilter} options={filterRoleOptions} class="w-40" />
    <Select bind:value={statusFilter} options={filterStatusOptions} class="w-40" />
  </div>

  <Table {columns} rows={filtered} rowKey={(e) => e.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
          >
            <UserCog class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <div class="truncate font-medium text-slate-900">{row.name}</div>
            <div class="flex items-center gap-1 truncate text-xs text-slate-500">
              <Mail class="h-3 w-3" />
              {row.email}
            </div>
          </div>
        </div>
      {:else if column.key === 'role'}
        <Badge variant="outline">{roleLabels[row.role]}</Badge>
      {:else if column.key === 'phone'}
        <div class="flex items-center gap-1.5 text-slate-600">
          <Phone class="h-3.5 w-3.5 text-slate-400" />
          {row.phone}
        </div>
      {:else if column.key === 'joinedAt'}
        {fmtDate(row.joinedAt)}
      {:else if column.key === 'status'}
        <Badge variant={row.status === 'active' ? 'success' : 'neutral'} dot>
          {row.status === 'active' ? 'Aktif' : 'Tidak aktif'}
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
        <p class="text-sm font-medium text-slate-600">Tidak ada pegawai yang cocok</p>
        <p class="text-xs text-slate-400">Coba bersihkan pencarian atau filter.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="lg"
  title={editingId ? 'Ubah pegawai' : 'Tambah pegawai'}
  description={editingId
    ? 'Perbarui informasi kontak dan peran orang ini.'
    : 'Tambahkan seseorang yang dapat masuk dan mengoperasikan toko.'}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <Input
      class="sm:col-span-2"
      label="Nama lengkap"
      placeholder="mis. Maria Lopez"
      bind:value={form.name}
      error={errors.name}
    />
    <Input
      label="Email"
      type="email"
      placeholder="maria@store.test"
      bind:value={form.email}
      error={errors.email}
    >
      {#snippet leading()}<Mail class="h-4 w-4" />{/snippet}
    </Input>
    <Input
      label="Telepon"
      placeholder="+62 ..."
      bind:value={form.phone}
      error={errors.phone}
    >
      {#snippet leading()}<Phone class="h-4 w-4" />{/snippet}
    </Input>
    <Select label="Peran" bind:value={form.role} options={roleOptions} />
    <Select label="Status" bind:value={form.status} options={statusOptions} />
    <Input
      class="sm:col-span-2"
      label="Tanggal bergabung"
      type="date"
      bind:value={form.joinedAt}
      error={errors.joinedAt}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save}>{editingId ? 'Simpan perubahan' : 'Tambah pegawai'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus pegawai?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus dari tim. Tindakan ini tidak bisa dibatalkan.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
