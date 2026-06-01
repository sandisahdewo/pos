<script lang="ts">
  import { Plus, Search, Pencil, Trash2, Tag as TagIcon } from 'lucide-svelte';
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
    Textarea,
    Toggle
  } from '$lib/components/ui';
  import { tags, type Tag, type TagColor } from '$lib/stores/tags.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Tag | null>(null);

  type FormState = {
    name: string;
    color: TagColor;
    publicVisible: boolean;
    description: string;
  };

  const blankForm: FormState = {
    name: '',
    color: 'brand',
    publicVisible: true,
    description: ''
  };

  const colorOptions: { value: TagColor; label: string }[] = [
    { value: 'brand', label: 'Brand (biru)' },
    { value: 'success', label: 'Success (hijau)' },
    { value: 'warning', label: 'Warning (kuning)' },
    { value: 'danger', label: 'Danger (merah)' },
    { value: 'info', label: 'Info (langit)' },
    { value: 'neutral', label: 'Neutral (abu)' }
  ];

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});

  // Count products using a given tag by name (case-insensitive).
  function countForTag(tag: Tag): number {
    const lower = tag.name.toLowerCase();
    return products.items.reduce((n, p) => {
      const has = (p.tags ?? []).some((t) => t.toLowerCase() === lower);
      return has ? n + 1 : n;
    }, 0);
  }

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags.items;
    return tags.items.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  });

  const columns = [
    { key: 'name' as const, label: 'Tag' },
    { key: 'publicVisible' as const, label: 'Tampil ke pelanggan', width: '160px' },
    { key: 'description' as const, label: 'Deskripsi' },
    { key: 'id' as const, label: 'Produk', align: 'right' as const, width: '100px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '90px' }
  ];

  function openCreate() {
    editingId = null;
    form = { ...blankForm };
    errors = {};
    formOpen = true;
  }

  function openEdit(tag: Tag) {
    editingId = tag.id;
    form = {
      name: tag.name,
      color: tag.color,
      publicVisible: tag.publicVisible,
      description: tag.description
    };
    errors = {};
    formOpen = true;
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    // Uniqueness by name (case-insensitive)
    const lower = form.name.trim().toLowerCase();
    const conflict = tags.items.find(
      (t) => t.id !== editingId && t.name.toLowerCase() === lower
    );
    if (conflict) next.name = `Tag "${conflict.name}" sudah ada.`;
    errors = next;
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (editingId) {
      tags.update(editingId, { ...form });
      toast.success('Tag diperbarui', form.name);
    } else {
      tags.add({ ...form });
      toast.success('Tag ditambahkan', form.name);
    }
    formOpen = false;
  }

  function askDelete(tag: Tag) {
    pendingDelete = tag;
    confirmOpen = true;
  }

  function doDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    tags.remove(pendingDelete.id);
    pendingDelete = null;
    toast.success('Tag dihapus', name);
  }
</script>

<svelte:head>
  <title>Tag · POS Admin</title>
</svelte:head>

<PageHeader
  title="Tag"
  description="Label fleksibel untuk produk — mis. Baru, Best Seller, Halal, Promo, Lokal."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Tag' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah tag
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari tag…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
  </div>

  <Table {columns} rows={filtered} rowKey={(t) => t.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          <Badge variant={row.color} dot>{row.name}</Badge>
        </div>
      {:else if column.key === 'publicVisible'}
        {#if row.publicVisible}
          <Badge variant="success" size="sm">Ya</Badge>
        {:else}
          <Badge variant="neutral" size="sm">Internal saja</Badge>
        {/if}
      {:else if column.key === 'description'}
        <span class="line-clamp-2 max-w-md text-sm text-slate-600">{row.description}</span>
      {:else if column.key === 'id'}
        <span class="font-medium text-slate-900">{countForTag(row)}</span>
      {:else if column.key === 'actions'}
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
        <p class="text-sm font-medium text-slate-600">Tidak ada tag yang cocok</p>
        <p class="text-xs text-slate-400">Coba kata kunci lain atau tambah tag baru.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="lg"
  title={editingId ? 'Ubah tag' : 'Tambah tag'}
  description={editingId
    ? 'Perbarui detail tag di bawah.'
    : 'Tag berguna untuk klasifikasi cepat di luar kategori (mis. Best Seller, Halal).'}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <Input
      label="Nama"
      placeholder="mis. Best Seller"
      bind:value={form.name}
      error={errors.name}
    />
    <Select label="Warna" bind:value={form.color} options={colorOptions} />
    <div class="sm:col-span-2">
      <Toggle
        bind:checked={form.publicVisible}
        label="Tampilkan ke pelanggan"
        description="Kalau aktif, tag muncul di kartu produk di Kasir dan di label rak."
      />
    </div>
    <Textarea
      class="sm:col-span-2"
      label="Deskripsi"
      placeholder="Catatan internal — terlihat oleh staf."
      bind:value={form.description}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save}>{editingId ? 'Simpan perubahan' : 'Tambah tag'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus tag?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus. ${countForTag(
        pendingDelete
      )} produk saat ini memakai tag ini — tag tetap tersimpan di produk tapi tidak akan punya warna/visibilitas terdaftar.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
