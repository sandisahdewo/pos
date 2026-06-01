<script lang="ts">
  import {
    Plus,
    Pencil,
    Trash2,
    Search,
    ShieldCheck,
    Sparkles,
    Lock,
    Users as UsersIcon,
    Copy,
    Info
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
    Table,
    Textarea
  } from '$lib/components/ui';
  import { roles, type Role } from '$lib/stores/roles.svelte';
  import { employees } from '$lib/stores/employees.svelte';
  import {
    PERMISSION_CATALOG,
    ALL_PERMISSIONS_WILDCARD,
    ALL_PERMISSION_KEYS
  } from '$lib/auth/permissions';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');

  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Role | null>(null);

  type FormState = {
    name: string;
    description: string;
    permissions: Set<string>;
    grantAll: boolean;
  };

  function emptyForm(): FormState {
    return { name: '', description: '', permissions: new Set(), grantAll: false };
  }

  let form = $state<FormState>(emptyForm());
  let errors = $state<{ name?: string; permissions?: string }>({});
  let editingIsSystem = $state(false);
  let submitting = $state(false);

  // Load roles from API on mount.
  $effect(() => {
    if (!roles.loaded && !roles.loading) {
      roles.load().catch((err) => {
        toast.error('Gagal memuat peran', err?.message ?? 'Tidak diketahui');
      });
    }
  });

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles.items;
    return roles.items.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  });

  const columns = [
    { key: 'name' as const, label: 'Peran' },
    { key: 'description' as const, label: 'Deskripsi' },
    { key: 'permissions' as const, label: 'Akses', width: '140px' },
    { key: 'usage' as const, label: 'Pegawai', width: '110px' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '120px' }
  ];

  function openCreate() {
    editingId = null;
    editingIsSystem = false;
    form = emptyForm();
    errors = {};
    formOpen = true;
  }

  function openDuplicate(role: Role) {
    editingId = null;
    editingIsSystem = false;
    form = {
      name: `${role.name} (salinan)`,
      description: role.description,
      permissions: new Set(role.permissions.filter((p) => p !== ALL_PERMISSIONS_WILDCARD)),
      grantAll: role.permissions.includes(ALL_PERMISSIONS_WILDCARD)
    };
    errors = {};
    formOpen = true;
  }

  function openEdit(role: Role) {
    editingId = role.id;
    editingIsSystem = role.isSystem;
    form = {
      name: role.name,
      description: role.description,
      permissions: new Set(role.permissions.filter((p) => p !== ALL_PERMISSIONS_WILDCARD)),
      grantAll: role.permissions.includes(ALL_PERMISSIONS_WILDCARD)
    };
    errors = {};
    formOpen = true;
  }

  function togglePermission(key: string) {
    if (form.grantAll || editingIsSystem) return;
    if (form.permissions.has(key)) {
      form.permissions.delete(key);
    } else {
      form.permissions.add(key);
    }
    form.permissions = new Set(form.permissions);
  }

  function toggleGroupAll(keys: string[]) {
    if (form.grantAll || editingIsSystem) return;
    const allOn = keys.every((k) => form.permissions.has(k));
    if (allOn) {
      for (const k of keys) form.permissions.delete(k);
    } else {
      for (const k of keys) form.permissions.add(k);
    }
    form.permissions = new Set(form.permissions);
  }

  function toggleGrantAll() {
    if (editingIsSystem) return;
    form.grantAll = !form.grantAll;
    if (form.grantAll) {
      form.permissions = new Set();
    }
  }

  function selectedCount(keys: string[]): number {
    return keys.reduce((n, k) => n + (form.permissions.has(k) ? 1 : 0), 0);
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama peran wajib diisi.';
    else {
      const dup = roles.items.find(
        (r) =>
          r.name.trim().toLowerCase() === form.name.trim().toLowerCase() && r.id !== editingId
      );
      if (dup) next.name = `Nama "${form.name}" sudah dipakai.`;
    }
    if (!form.grantAll && form.permissions.size === 0) {
      next.permissions = 'Pilih minimal satu izin, atau aktifkan akses penuh.';
    }
    errors = next;
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    const permList = form.grantAll ? [ALL_PERMISSIONS_WILDCARD] : Array.from(form.permissions);
    submitting = true;
    try {
      if (editingId) {
        await roles.update(editingId, {
          name: form.name.trim(),
          description: form.description.trim(),
          permissions: permList
        });
        toast.success('Peran diperbarui', form.name.trim());
      } else {
        const created = await roles.add({
          name: form.name.trim(),
          description: form.description.trim(),
          permissions: permList
        });
        toast.success('Peran dibuat', created.name);
      }
      formOpen = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan peran', msg);
    } finally {
      submitting = false;
    }
  }

  function askDelete(role: Role) {
    pendingDelete = role;
    confirmOpen = true;
  }

  async function doDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    pendingDelete = null;
    const result = await roles.remove(target.id);
    if (!result.ok) {
      toast.error('Tidak bisa menghapus peran', result.reason);
      return;
    }
    toast.success('Peran dihapus', target.name);
  }

  function permissionCount(role: Role): number {
    if (role.permissions.includes(ALL_PERMISSIONS_WILDCARD)) return ALL_PERMISSION_KEYS.length;
    return role.permissions.length;
  }
</script>

<svelte:head>
  <title>Peran & Akses · POS Admin</title>
</svelte:head>

<PageHeader
  title="Peran & Akses"
  description="Atur peran dan pilih menu serta fitur yang dapat diakses oleh setiap peran."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Peran & Akses' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah peran
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari peran berdasarkan nama atau deskripsi…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <div class="text-xs text-slate-500">
      Total: <span class="font-medium text-slate-700">{roles.items.length}</span> peran ·
      <span class="font-medium text-slate-700">{ALL_PERMISSION_KEYS.length}</span> izin tersedia
    </div>
  </div>

  <Table {columns} rows={filtered} rowKey={(r) => r.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
              {row.isSystem
              ? 'bg-brand-50 text-brand-600'
              : 'bg-slate-100 text-slate-500'}"
          >
            <ShieldCheck class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-medium text-slate-900">{row.name}</span>
              {#if row.isSystem}
                <Badge variant="brand" size="sm">Sistem</Badge>
              {/if}
              {#if row.permissions.includes(ALL_PERMISSIONS_WILDCARD)}
                <Badge variant="success" size="sm">Akses penuh</Badge>
              {/if}
            </div>
            <div class="truncate text-xs text-slate-500">{row.id}</div>
          </div>
        </div>
      {:else if column.key === 'description'}
        <span class="line-clamp-2 text-sm text-slate-600">{row.description || '—'}</span>
      {:else if column.key === 'permissions'}
        <div class="text-sm text-slate-700">
          <span class="font-medium">{permissionCount(row)}</span>
          <span class="text-slate-500"> / {ALL_PERMISSION_KEYS.length}</span>
        </div>
      {:else if column.key === 'usage'}
        <div class="flex items-center gap-1.5 text-sm text-slate-600">
          <UsersIcon class="h-3.5 w-3.5 text-slate-400" />
          {employees.countByRole(row.id)} pegawai
        </div>
      {:else if column.key === 'id'}
        <div class="flex justify-end gap-1">
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Duplikasi"
            title="Duplikasi sebagai peran baru"
            onclick={() => openDuplicate(row)}
          >
            <Copy class="h-4 w-4" />
          </button>
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
            class="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            aria-label="Hapus"
            disabled={row.isSystem}
            title={row.isSystem ? 'Peran sistem tidak bisa dihapus' : 'Hapus peran'}
            onclick={() => askDelete(row)}
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-6">
        <p class="text-sm font-medium text-slate-600">Tidak ada peran yang cocok</p>
        <p class="text-xs text-slate-400">Coba ubah pencarian.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="2xl"
  title={editingId
    ? editingIsSystem
      ? 'Lihat peran sistem'
      : 'Ubah peran'
    : 'Tambah peran'}
  description={editingIsSystem
    ? 'Peran sistem dikunci — nama dan izin tidak bisa diubah, hanya deskripsi.'
    : editingId
      ? 'Perbarui informasi dan akses untuk peran ini.'
      : 'Buat peran baru dengan kumpulan izin yang spesifik.'}
>
  <div class="space-y-5">
    {#if editingIsSystem}
      <Alert variant="info" title="Peran sistem">
        <span class="flex items-center gap-1.5">
          <Lock class="h-3.5 w-3.5" />
          Izin peran ini terkunci. Anda masih bisa mengubah deskripsi.
        </span>
      </Alert>
    {/if}

    <div class="grid gap-4 sm:grid-cols-2">
      <Input
        label="Nama peran"
        placeholder="mis. Supervisor"
        bind:value={form.name}
        error={errors.name}
        disabled={editingIsSystem}
      />
      <Input
        label="Deskripsi singkat"
        placeholder="Untuk apa peran ini dipakai?"
        bind:value={form.description}
      />
    </div>

    <div>
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-medium text-slate-700">Akses penuh ke semua menu & fitur</span>
        <Checkbox
          label="Aktifkan akses penuh"
          checked={form.grantAll}
          disabled={editingIsSystem}
          onchange={toggleGrantAll}
        />
      </div>
      {#if form.grantAll}
        <Alert variant="warning" title="Akses penuh aktif">
          <span class="flex items-center gap-1.5">
            <Sparkles class="h-3.5 w-3.5" />
            Pengguna dengan peran ini bisa membuka semua menu dan menjalankan semua aksi. Cocok untuk peran admin.
          </span>
        </Alert>
      {/if}
    </div>

    <div>
      <div class="mb-1.5 flex items-center gap-1.5">
        <span class="text-sm font-medium text-slate-700">Izin spesifik</span>
        <Info class="h-3.5 w-3.5 text-slate-400" />
        {#if !form.grantAll}
          <span class="ml-auto text-xs text-slate-500">
            {form.permissions.size} / {ALL_PERMISSION_KEYS.length} izin dipilih
          </span>
        {/if}
      </div>

      <div
        class="space-y-4 rounded-lg border bg-slate-50/40 p-4
          {errors.permissions ? 'border-rose-300' : 'border-slate-200'}
          {form.grantAll ? 'opacity-50' : ''}"
      >
        {#each PERMISSION_CATALOG as group (group.title)}
          {@const groupKeys = group.permissions.map((p) => p.key)}
          {@const selected = selectedCount(groupKeys)}
          {@const allOn = selected === groupKeys.length}
          <section>
            <div class="mb-2 flex items-center justify-between gap-3">
              <div>
                <h4 class="text-sm font-semibold text-slate-800">{group.title}</h4>
                {#if group.description}
                  <p class="text-xs text-slate-500">{group.description}</p>
                {/if}
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[11px] font-medium text-slate-500">
                  {selected}/{groupKeys.length}
                </span>
                <button
                  type="button"
                  class="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={form.grantAll || editingIsSystem}
                  onclick={() => toggleGroupAll(groupKeys)}
                >
                  {allOn ? 'Hapus semua' : 'Pilih semua'}
                </button>
              </div>
            </div>
            <div class="grid gap-1.5 sm:grid-cols-2">
              {#each group.permissions as p (p.key)}
                <Checkbox
                  label={p.label}
                  description={p.description}
                  checked={form.grantAll || form.permissions.has(p.key)}
                  disabled={form.grantAll || editingIsSystem}
                  onchange={() => togglePermission(p.key)}
                />
              {/each}
            </div>
          </section>
        {/each}
      </div>
      {#if errors.permissions}
        <p class="mt-1.5 text-xs text-rose-600">{errors.permissions}</p>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>
      {editingIsSystem ? 'Tutup' : 'Batal'}
    </Button>
    {#if !editingIsSystem || (editingIsSystem && form.description !== roles.getById(editingId ?? '')?.description)}
      <Button onclick={save} loading={submitting} disabled={submitting}>
        {editingId ? 'Simpan perubahan' : 'Tambah peran'}
      </Button>
    {/if}
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus peran?"
  message={pendingDelete
    ? employees.countByRole(pendingDelete.id) > 0
      ? `Peran "${pendingDelete.name}" sedang dipakai oleh ${employees.countByRole(pendingDelete.id)} pegawai. Mereka akan kehilangan akses dari peran ini.`
      : `Peran "${pendingDelete.name}" akan dihapus permanen.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
