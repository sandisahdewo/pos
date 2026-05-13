<script lang="ts">
  import { Plus, Search, Pencil, Trash2, Ruler } from 'lucide-svelte';
  import {
    Button,
    Card,
    ConfirmDialog,
    Input,
    Modal,
    PageHeader,
    Table,
    Textarea
  } from '$lib/components/ui';
  import { units, type Unit } from '$lib/stores/units.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Unit | null>(null);

  type FormState = { name: string; code: string; description: string };

  const blankForm: FormState = { name: '', code: '', description: '' };

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units.items;
    return units.items.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q) ||
        u.description.toLowerCase().includes(q)
    );
  });

  const columns = [
    { key: 'name' as const, label: 'Satuan' },
    { key: 'code' as const, label: 'Kode' },
    { key: 'description' as const, label: 'Deskripsi' },
    { key: 'id' as const, label: 'Produk', align: 'right' as const, width: '120px' }
  ];

  function openCreate() {
    editingId = null;
    form = { ...blankForm };
    errors = {};
    formOpen = true;
  }

  function openEdit(u: Unit) {
    editingId = u.id;
    form = { name: u.name, code: u.code, description: u.description };
    errors = {};
    formOpen = true;
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    if (!form.code.trim()) next.code = 'Kode wajib diisi.';
    else if (form.code.length > 8) next.code = 'Kode maksimal 8 karakter.';
    errors = next;
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (editingId) {
      units.update(editingId, { ...form });
      toast.success('Satuan diperbarui', form.name);
    } else {
      units.add({ ...form });
      toast.success('Satuan ditambahkan', form.name);
    }
    formOpen = false;
  }

  function askDelete(u: Unit) {
    pendingDelete = u;
    confirmOpen = true;
  }

  function doDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    units.remove(pendingDelete.id);
    pendingDelete = null;
    toast.success('Satuan dihapus', name);
  }
</script>

<svelte:head>
  <title>Satuan · POS Admin</title>
</svelte:head>

<PageHeader
  title="Satuan"
  description="Satuan ukur untuk menghitung dan menentukan harga produk."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Satuan' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah satuan
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari satuan…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
  </div>

  <Table {columns} rows={filtered} rowKey={(u) => u.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"
          >
            <Ruler class="h-4 w-4" />
          </div>
          <div class="font-medium text-slate-900">{row.name}</div>
        </div>
      {:else if column.key === 'code'}
        <code class="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-700">
          {row.code}
        </code>
      {:else if column.key === 'description'}
        <span class="line-clamp-2 max-w-md text-sm text-slate-600">{row.description}</span>
      {:else if column.key === 'id'}
        <div class="flex items-center justify-end gap-1">
          <span class="mr-1 font-medium text-slate-900">{products.countByUnit(row.id)}</span>
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
        <p class="text-sm font-medium text-slate-600">Tidak ada satuan yang cocok</p>
        <p class="text-xs text-slate-400">Coba kata kunci lain atau bersihkan pencarian.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="md"
  title={editingId ? 'Ubah satuan' : 'Tambah satuan'}
  description={editingId
    ? 'Perbarui detail satuan di bawah.'
    : 'Tentukan satuan ukur baru.'}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <Input
      label="Nama"
      placeholder="mis. Kilogram"
      bind:value={form.name}
      error={errors.name}
    />
    <Input
      label="Kode"
      placeholder="mis. kg"
      hint="Simbol pendek yang dipakai di struk."
      bind:value={form.code}
      error={errors.code}
    />
    <Textarea
      class="sm:col-span-2"
      label="Deskripsi"
      placeholder="Bagaimana satuan ini dipakai (opsional)."
      bind:value={form.description}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save}>{editingId ? 'Simpan perubahan' : 'Tambah satuan'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus satuan?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus. ${products.countByUnit(
        pendingDelete.id
      )} produk saat ini memakai satuan ini.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
