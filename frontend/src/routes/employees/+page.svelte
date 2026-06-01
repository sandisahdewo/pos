<script lang="ts">
  import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Mail,
    Phone,
    UserCog,
    Eye,
    EyeOff,
    KeyRound,
    AtSign,
    Lock,
    ShieldAlert
  } from 'lucide-svelte';
  import {
    Alert,
    Badge,
    Button,
    Card,
    Checkbox,
    ConfirmDialog,
    Input,
    Modal,
    PageHeader,
    Select,
    Table
  } from '$lib/components/ui';
  import {
    employees,
    type Employee,
    type EmployeeStatus
  } from '$lib/stores/employees.svelte';
  import { roles } from '$lib/stores/roles.svelte';
  import { user } from '$lib/stores/user.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let roleFilter = $state<string>('');
  let statusFilter = $state<'' | EmployeeStatus>('');

  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Employee | null>(null);

  type FormState = {
    name: string;
    email: string;
    phone: string;
    username: string;
    password: string;
    roleIds: string[];
    status: EmployeeStatus;
    joinedAt: string;
    pin: string;
  };

  const blankForm: FormState = {
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    roleIds: [],
    status: 'active',
    joinedAt: new Date().toISOString().slice(0, 10),
    pin: ''
  };

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});
  let showPin = $state(false);
  let showPassword = $state(false);

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return employees.items.filter((e) => {
      if (roleFilter && !e.roleIds.includes(roleFilter)) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q)
      );
    });
  });

  const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Tidak aktif' }
  ];

  const filterRoleOptions = $derived([
    { value: '', label: 'Semua peran' },
    ...roles.items.map((r) => ({ value: r.id, label: r.name }))
  ]);
  const filterStatusOptions = [{ value: '', label: 'Semua status' }, ...statusOptions];

  const columns = [
    { key: 'name' as const, label: 'Pegawai' },
    { key: 'roleIds' as const, label: 'Peran' },
    { key: 'phone' as const, label: 'Kontak' },
    { key: 'joinedAt' as const, label: 'Bergabung' },
    { key: 'status' as const, label: 'Status' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '120px' }
  ];

  function openCreate() {
    editingId = null;
    form = { ...blankForm, roleIds: [] };
    errors = {};
    showPin = false;
    showPassword = false;
    formOpen = true;
  }

  function openEdit(emp: Employee) {
    editingId = emp.id;
    form = {
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      username: emp.username,
      password: emp.password,
      roleIds: [...emp.roleIds],
      status: emp.status,
      joinedAt: emp.joinedAt,
      pin: emp.pin
    };
    errors = {};
    showPin = false;
    showPassword = false;
    formOpen = true;
  }

  function toggleRole(roleId: string) {
    if (form.roleIds.includes(roleId)) {
      form.roleIds = form.roleIds.filter((id) => id !== roleId);
    } else {
      form.roleIds = [...form.roleIds, roleId];
    }
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    if (!form.email.trim()) next.email = 'Email wajib diisi.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Masukkan email yang valid.';
    if (!form.phone.trim()) next.phone = 'Telepon wajib diisi.';
    if (!form.username.trim()) next.username = 'Username wajib diisi.';
    else if (!/^[a-zA-Z0-9._-]{3,}$/.test(form.username))
      next.username = 'Minimal 3 karakter, hanya huruf/angka/.-_ .';
    else {
      const dupUser = employees.items.find(
        (e) => e.username.toLowerCase() === form.username.trim().toLowerCase() && e.id !== editingId
      );
      if (dupUser) next.username = `Username dipakai oleh ${dupUser.name}.`;
    }
    if (!form.password) next.password = 'Kata sandi wajib diisi.';
    else if (form.password.length < 6) next.password = 'Minimal 6 karakter.';
    if (form.roleIds.length === 0) next.roleIds = 'Pilih minimal satu peran.';
    if (!form.joinedAt) next.joinedAt = 'Tanggal bergabung wajib diisi.';
    if (!/^\d{4}$/.test(form.pin)) next.pin = 'PIN harus 4 digit angka.';
    else {
      const dup = employees.items.find((e) => e.pin === form.pin && e.id !== editingId);
      if (dup) next.pin = `PIN sudah dipakai oleh ${dup.name}.`;
    }
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
    {#if user.can('menu.roles')}
      <Button variant="outline" href="/roles">
        <ShieldAlert class="h-4 w-4" />
        Kelola Peran
      </Button>
    {/if}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah pegawai
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari nama, username, email, atau telepon…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={roleFilter} options={filterRoleOptions} class="w-44" />
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
              <AtSign class="h-3 w-3" />
              {row.username}
            </div>
          </div>
        </div>
      {:else if column.key === 'roleIds'}
        <div class="flex flex-wrap gap-1">
          {#each roles.getMany(row.roleIds) as r (r.id)}
            <Badge variant={r.isSystem ? 'brand' : 'outline'} size="sm">{r.name}</Badge>
          {/each}
          {#if row.roleIds.length === 0}
            <span class="text-xs text-slate-400">Tanpa peran</span>
          {/if}
        </div>
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
    ? 'Perbarui informasi kontak, akses, dan peran orang ini.'
    : 'Tambahkan seseorang yang dapat masuk dan mengoperasikan toko.'}
>
  <div class="space-y-5">
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
      <Input label="Telepon" placeholder="+62 ..." bind:value={form.phone} error={errors.phone}>
        {#snippet leading()}<Phone class="h-4 w-4" />{/snippet}
      </Input>
      <Input
        label="Username"
        placeholder="mis. maria"
        bind:value={form.username}
        error={errors.username}
        hint="Dipakai untuk masuk ke aplikasi."
      >
        {#snippet leading()}<AtSign class="h-4 w-4" />{/snippet}
      </Input>
      <Input
        label="Kata sandi"
        type={showPassword ? 'text' : 'password'}
        placeholder="Minimal 6 karakter"
        bind:value={form.password}
        error={errors.password}
      >
        {#snippet leading()}<Lock class="h-4 w-4" />{/snippet}
        {#snippet trailing()}
          <button
            type="button"
            class="p-1 text-slate-400 hover:text-slate-600"
            onclick={() => (showPassword = !showPassword)}
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {#if showPassword}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
          </button>
        {/snippet}
      </Input>
      <Select label="Status" bind:value={form.status} options={statusOptions} />
      <Input
        label="Tanggal bergabung"
        type="date"
        bind:value={form.joinedAt}
        error={errors.joinedAt}
      />
      <Input
        class="sm:col-span-2"
        label="PIN 4 digit"
        type={showPin ? 'text' : 'password'}
        inputmode="numeric"
        maxlength={4}
        placeholder="••••"
        bind:value={form.pin}
        error={errors.pin}
        hint="Dipakai untuk verifikasi saat membuka shift di kasir."
      >
        {#snippet leading()}<KeyRound class="h-4 w-4" />{/snippet}
        {#snippet trailing()}
          <button
            type="button"
            class="p-1 text-slate-400 hover:text-slate-600"
            onclick={() => (showPin = !showPin)}
            aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
          >
            {#if showPin}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
          </button>
        {/snippet}
      </Input>
    </div>

    <div>
      <div class="mb-1.5 flex items-center justify-between">
        <span class="text-sm font-medium text-slate-700">Peran</span>
        <a
          href="/roles"
          target="_blank"
          rel="noopener"
          class="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Atur peran →
        </a>
      </div>
      <p class="mb-2 text-xs text-slate-500">
        Akses pegawai ke menu & fitur ditentukan oleh peran. Boleh memilih lebih dari satu.
      </p>
      <div
        class="grid gap-2 rounded-lg border bg-slate-50/40 p-3 sm:grid-cols-2 lg:grid-cols-3
          {errors.roleIds ? 'border-rose-300' : 'border-slate-200'}"
      >
        {#each roles.items as r (r.id)}
          <Checkbox
            label={r.name}
            description={r.description}
            checked={form.roleIds.includes(r.id)}
            onchange={() => toggleRole(r.id)}
          />
        {/each}
      </div>
      {#if errors.roleIds}
        <p class="mt-1.5 text-xs text-rose-600">{errors.roleIds}</p>
      {/if}
    </div>

    {#if form.roleIds.length > 1}
      <Alert variant="info" title="Lebih dari satu peran">
        Pegawai ini akan mendapatkan gabungan akses dari semua peran yang dipilih.
      </Alert>
    {/if}
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
