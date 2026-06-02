<script lang="ts">
  import { Plus, Search, Pencil, Trash2, Tags, ChevronRight } from 'lucide-svelte';
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
    categories,
    colorOptions,
    type Category,
    type CategoryColor
  } from '$lib/stores/categories.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { taxRates } from '$lib/stores/taxRates.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Category | null>(null);
  let collapsed = $state<Set<string>>(new Set());

  function toggleCollapse(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
  }

  // Total product count for a category INCLUDING its descendants. Used so a
  // parent's row reflects its whole sub-tree, not just direct assignments.
  function countDeep(catId: string): number {
    const ids = new Set([catId, ...categories.descendantsOf(catId).map((c) => c.id)]);
    return products.items.reduce((n, p) => (ids.has(p.categoryId) ? n + 1 : n), 0);
  }

  type FormState = {
    name: string;
    slug: string;
    description: string;
    color: CategoryColor;
    taxRateId: string;
    parentId: string;
  };

  const blankForm: FormState = {
    name: '',
    slug: '',
    description: '',
    color: 'brand',
    taxRateId: '',
    parentId: ''
  };

  const taxRateOptions = $derived(
    taxRates.items.map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)` }))
  );

  // Parent options excludes self + all its descendants to prevent cycles.
  // Each option label shows the full path so admins can disambiguate names
  // ("Kopi" might exist under multiple parents).
  const parentOptions = $derived.by(() => {
    const out: { value: string; label: string }[] = [
      { value: '', label: '— Kategori utama —' }
    ];
    for (const c of categories.items) {
      if (editingId && c.id === editingId) continue;
      if (editingId && categories.isAncestorOf(editingId, c.id)) continue;
      const path = categories.path(c.id).map((p) => p.name).join(' › ');
      out.push({ value: c.id, label: path });
    }
    return out;
  });

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});

  // Each rendered row is a Category enriched with depth + whether it has
  // children. Tree mode walks roots → children in DFS so parents always come
  // before their descendants. When the operator types in the search box we
  // flip to a flat filtered list — matches deep in the tree shouldn't be
  // hidden behind a collapsed parent.
  type CategoryRow = Category & { _depth: number; _hasChildren: boolean };

  const treeRows = $derived.by<CategoryRow[]>(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return categories.items
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q)
        )
        .map((c) => ({ ...c, _depth: 0, _hasChildren: false }));
    }
    const childrenOf = new Map<string | undefined, Category[]>();
    for (const c of categories.items) {
      const key = c.parentId ?? undefined;
      const list = childrenOf.get(key) ?? [];
      list.push(c);
      childrenOf.set(key, list);
    }
    const out: CategoryRow[] = [];
    const visit = (parentId: string | undefined, depth: number) => {
      const kids = childrenOf.get(parentId) ?? [];
      for (const c of kids) {
        const kidsOfC = childrenOf.get(c.id) ?? [];
        out.push({ ...c, _depth: depth, _hasChildren: kidsOfC.length > 0 });
        if (!collapsed.has(c.id)) visit(c.id, depth + 1);
      }
    };
    visit(undefined, 0);
    return out;
  });

  const isSearching = $derived(search.trim().length > 0);

  const columns = [
    { key: 'name' as const, label: 'Kategori' },
    { key: 'slug' as const, label: 'Slug' },
    { key: 'taxRateId' as const, label: 'Pajak', width: '110px' },
    { key: 'description' as const, label: 'Deskripsi' },
    { key: 'id' as const, label: 'Produk', align: 'right' as const, width: '100px' },
    { key: 'color' as const, label: '', align: 'right' as const, width: '120px' }
  ];

  function taxLabel(id: string): string {
    const t = taxRates.getById(id);
    return t ? `${t.name}` : '—';
  }

  function openCreate() {
    editingId = null;
    form = { ...blankForm, taxRateId: taxRates.defaultId() };
    errors = {};
    formOpen = true;
  }

  function openEdit(cat: Category) {
    editingId = cat.id;
    form = {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      color: cat.color,
      taxRateId: cat.taxRateId,
      parentId: cat.parentId ?? ''
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

  let submitting = $state(false);

  $effect(() => {
    if (!categories.loaded && !categories.loading) {
      categories.load().catch((err) =>
        toast.error('Gagal memuat kategori', err?.message ?? 'Tidak diketahui')
      );
    }
  });

  async function save() {
    if (!validate()) return;
    const payload = { ...form, parentId: form.parentId || undefined };
    submitting = true;
    try {
      if (editingId) {
        await categories.update(editingId, payload);
        toast.success('Kategori diperbarui', form.name);
      } else {
        await categories.add(payload);
        toast.success('Kategori ditambahkan', form.name);
      }
      formOpen = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan kategori', msg);
    } finally {
      submitting = false;
    }
  }

  function askDelete(cat: Category) {
    pendingDelete = cat;
    confirmOpen = true;
  }

  async function doDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    pendingDelete = null;
    try {
      await categories.remove(target.id);
      toast.success('Kategori dihapus', target.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menghapus kategori', msg);
    }
  }
</script>

<svelte:head>
  <title>Kategori · POS Admin</title>
</svelte:head>

<PageHeader
  title="Kategori"
  description="Kelompokkan produk ke dalam kategori yang dipakai di laporan dan terminal Kasir."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Kategori' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah kategori
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari kategori…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
  </div>

  <Table {columns} rows={treeRows} rowKey={(c) => c.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        {@const parents = categories.path(row.id).slice(0, -1)}
        <div class="flex items-center gap-2" style="padding-left: {row._depth * 1.25}rem">
          {#if row._hasChildren && !isSearching}
            <button
              type="button"
              class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label={collapsed.has(row.id) ? `Buka anak ${row.name}` : `Tutup anak ${row.name}`}
              aria-expanded={!collapsed.has(row.id)}
              onclick={() => toggleCollapse(row.id)}
            >
              <ChevronRight class="h-3.5 w-3.5 transition-transform {collapsed.has(row.id) ? '' : 'rotate-90'}" />
            </button>
          {:else}
            <span class="inline-block h-5 w-5 shrink-0"></span>
          {/if}
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"
          >
            <Tags class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <div class="font-medium text-slate-900">{row.name}</div>
            {#if isSearching && parents.length > 0}
              <div class="text-xs text-slate-500">
                {parents.map((p) => p.name).join(' › ')}
              </div>
            {/if}
          </div>
        </div>
      {:else if column.key === 'slug'}
        <code class="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600">
          {row.slug}
        </code>
      {:else if column.key === 'taxRateId'}
        <Badge variant="outline" size="sm">{taxLabel(row.taxRateId)}</Badge>
      {:else if column.key === 'description'}
        <span class="line-clamp-2 max-w-md text-sm text-slate-600">{row.description}</span>
      {:else if column.key === 'id'}
        {@const direct = products.countByCategory(row.id)}
        {@const deep = countDeep(row.id)}
        <span class="font-medium text-slate-900">{deep}</span>
        {#if deep !== direct}
          <span class="ml-1 text-xs text-slate-400">({direct} langsung)</span>
        {/if}
      {:else if column.key === 'color'}
        <div class="flex justify-end gap-1">
          <Badge variant={row.color} dot>{row.color}</Badge>
          <button
            type="button"
            class="ml-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
        <p class="text-sm font-medium text-slate-600">Tidak ada kategori yang cocok</p>
        <p class="text-xs text-slate-400">Coba kata kunci lain atau bersihkan pencarian.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="lg"
  title={editingId ? 'Ubah kategori' : 'Tambah kategori'}
  description={editingId
    ? 'Perbarui detail kategori di bawah.'
    : 'Kategori membantu mengorganisir produk di terminal Kasir dan laporan.'}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <Input
      label="Nama"
      placeholder="mis. Minuman"
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
    <Select
      label="Warna"
      bind:value={form.color}
      options={colorOptions}
    />
    <Select
      label="Tarif pajak default"
      bind:value={form.taxRateId}
      options={taxRateOptions}
      hint="Produk dalam kategori ini akan memakai tarif ini kecuali di-override."
    />
    <Select
      class="sm:col-span-2"
      label="Kategori induk"
      tooltip="Bikin kategori ini jadi sub-kategori. Mis. 'Single Origin' bisa jadi sub dari 'Kopi'. Kosongkan untuk kategori utama."
      bind:value={form.parentId}
      options={parentOptions}
    />
    <Textarea
      class="sm:col-span-2"
      label="Deskripsi"
      placeholder="Produk seperti apa yang masuk kategori ini?"
      bind:value={form.description}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save} loading={submitting} disabled={submitting}>
      {editingId ? 'Simpan perubahan' : 'Tambah kategori'}
    </Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus kategori?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus. ${products.countByCategory(
        pendingDelete.id
      )} produk saat ini menggunakan kategori ini dan akan menjadi tanpa kategori.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
