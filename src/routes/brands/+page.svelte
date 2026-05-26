<script lang="ts">
  import { Plus, Search, Pencil, Trash2, Image as ImageIcon } from 'lucide-svelte';
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
    brands,
    type Brand,
    type BrandStatus
  } from '$lib/stores/brands.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Brand | null>(null);

  type FormState = {
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    status: BrandStatus;
  };

  const blankForm: FormState = {
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    status: 'active'
  };

  const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'archived', label: 'Diarsipkan' }
  ];

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands.items;
    return brands.items.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    );
  });

  const columns = [
    { key: 'name' as const, label: 'Brand' },
    { key: 'slug' as const, label: 'Slug' },
    { key: 'description' as const, label: 'Deskripsi' },
    { key: 'status' as const, label: 'Status', width: '110px' },
    { key: 'id' as const, label: 'Produk', align: 'right' as const, width: '100px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '90px' }
  ];

  function openCreate() {
    editingId = null;
    form = { ...blankForm };
    errors = {};
    formOpen = true;
  }

  function openEdit(brand: Brand) {
    editingId = brand.id;
    form = {
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      imageUrl: brand.imageUrl,
      status: brand.status
    };
    errors = {};
    formOpen = true;
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    if (form.slug && !/^[a-z0-9-]+$/.test(form.slug))
      next.slug = 'Gunakan huruf kecil, angka, dan tanda hubung saja.';
    errors = next;
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (editingId) {
      brands.update(editingId, { ...form });
      toast.success('Brand diperbarui', form.name);
    } else {
      brands.add({ ...form });
      toast.success('Brand ditambahkan', form.name);
    }
    formOpen = false;
  }

  function askDelete(brand: Brand) {
    pendingDelete = brand;
    confirmOpen = true;
  }

  function doDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    brands.remove(pendingDelete.id);
    pendingDelete = null;
    toast.success('Brand dihapus', name);
  }
</script>

<svelte:head>
  <title>Brand · POS Admin</title>
</svelte:head>

<PageHeader
  title="Brand"
  description="Kelola merek/brand produk untuk filter & tampilan di katalog."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Brand' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah brand
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari brand…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
  </div>

  <Table {columns} rows={filtered} rowKey={(b) => b.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          {#if row.imageUrl}
            <img
              src={row.imageUrl}
              alt={row.name}
              class="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover"
              loading="lazy"
            />
          {:else}
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400"
            >
              <ImageIcon class="h-4 w-4" />
            </div>
          {/if}
          <div class="font-medium text-slate-900">{row.name}</div>
        </div>
      {:else if column.key === 'slug'}
        <code class="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600">
          {row.slug}
        </code>
      {:else if column.key === 'description'}
        <span class="line-clamp-2 max-w-md text-sm text-slate-600">{row.description}</span>
      {:else if column.key === 'status'}
        <Badge variant={row.status === 'active' ? 'success' : 'neutral'} dot>
          {row.status === 'active' ? 'Aktif' : 'Diarsipkan'}
        </Badge>
      {:else if column.key === 'id'}
        <span class="font-medium text-slate-900">{products.countByBrand(row.id)}</span>
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
        <p class="text-sm font-medium text-slate-600">Tidak ada brand yang cocok</p>
        <p class="text-xs text-slate-400">Coba kata kunci lain atau tambah brand baru.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="lg"
  title={editingId ? 'Ubah brand' : 'Tambah brand'}
  description={editingId
    ? 'Perbarui detail brand di bawah.'
    : 'Brand membantu filter produk berdasarkan merek (mis. Indofood, Aqua, Sampoerna).'}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <Input
      label="Nama"
      placeholder="mis. Indofood"
      bind:value={form.name}
      error={errors.name}
    />
    <Input
      label="Slug"
      placeholder="auto-generated"
      hint="Kosongkan untuk dihasilkan dari nama."
      bind:value={form.slug}
      error={errors.slug}
    />
    <Input
      class="sm:col-span-2"
      label="URL Logo"
      placeholder="https://example.com/logo.jpg"
      bind:value={form.imageUrl}
      hint="Logo brand untuk display di product card & shelf label. Opsional."
    />
    <Select label="Status" bind:value={form.status} options={statusOptions} />
    <Textarea
      class="sm:col-span-2"
      label="Deskripsi"
      placeholder="Catatan internal — terlihat oleh staf."
      bind:value={form.description}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save}>{editingId ? 'Simpan perubahan' : 'Tambah brand'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus brand?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus. ${products.countByBrand(
        pendingDelete.id
      )} produk saat ini menggunakan brand ini dan akan menjadi tanpa brand.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
