<script lang="ts">
  import { Plus, Search, Pencil, Trash2, Tags, Star } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    Modal,
    PageHeader,
    Table,
    Textarea,
    Toggle
  } from '$lib/components/ui';
  import { pricelists, type Pricelist } from '$lib/stores/pricelists.svelte';
  import { customers } from '$lib/stores/customers.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Pricelist | null>(null);

  type FormState = { name: string; description: string; isDefault: boolean };
  const blankForm: FormState = { name: '', description: '', isDefault: false };

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pricelists.items;
    return pricelists.items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  });

  const columns = [
    { key: 'name' as const, label: 'Daftar Harga' },
    { key: 'description' as const, label: 'Deskripsi' },
    { key: 'isDefault' as const, label: 'Utama', align: 'center' as const, width: '90px' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '120px' }
  ];

  function openCreate() {
    editingId = null;
    form = { ...blankForm };
    errors = {};
    formOpen = true;
  }

  function openEdit(p: Pricelist) {
    editingId = p.id;
    form = { name: p.name, description: p.description, isDefault: p.isDefault };
    errors = {};
    formOpen = true;
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    errors = next;
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    try {
      if (editingId) {
        await pricelists.update(editingId, { ...form });
        toast.success('Daftar harga diperbarui', form.name);
      } else {
        await pricelists.add({ ...form });
        toast.success('Daftar harga ditambahkan', form.name);
      }
      formOpen = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan daftar harga', msg);
    }
  }

  function askDelete(p: Pricelist) {
    pendingDelete = p;
    confirmOpen = true;
  }

  async function doDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    pendingDelete = null;
    const ok = await pricelists.remove(target.id);
    if (ok) toast.success('Daftar harga dihapus', target.name);
    else toast.error('Tidak bisa dihapus', 'Daftar harga utama atau masih dipakai customer / produk.');
  }

  async function makeDefault(p: Pricelist) {
    try {
      await pricelists.update(p.id, { isDefault: true });
      toast.success('Daftar harga utama diperbarui', p.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal mengubah utama', msg);
    }
  }
</script>

<svelte:head>
  <title>Daftar Harga · POS Admin</title>
</svelte:head>

<PageHeader
  title="Daftar Harga"
  description="Tingkatan harga untuk kelompok pelanggan berbeda — retail, grosir, VIP, dll."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Daftar Harga' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah daftar harga
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari daftar harga…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
  </div>

  <Table {columns} rows={filtered} rowKey={(p) => p.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        {@const customerCount = customers.countByPricelist(row.id)}
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"
          >
            <Tags class="h-4 w-4" />
          </div>
          <div>
            <div class="font-medium text-slate-900">{row.name}</div>
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <span class="font-mono">{row.id}</span>
              {#if customerCount > 0}
                <span>·</span>
                <a
                  href="/customers?pricelist={row.id}"
                  class="hover:text-brand-700"
                  title="Lihat pelanggan pada daftar harga ini"
                >
                  {customerCount} pelanggan
                </a>
              {/if}
            </div>
          </div>
        </div>
      {:else if column.key === 'description'}
        <span class="line-clamp-2 max-w-md text-sm text-slate-600">{row.description}</span>
      {:else if column.key === 'isDefault'}
        {#if row.isDefault}
          <Badge variant="brand" size="sm">
            <Star class="mr-1 h-3 w-3" />
            Utama
          </Badge>
        {:else}
          <button
            type="button"
            class="text-xs text-slate-400 hover:text-brand-600"
            onclick={() => makeDefault(row)}
          >
            Jadikan utama
          </button>
        {/if}
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
            class="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
            aria-label="Hapus"
            disabled={row.isDefault}
            onclick={() => askDelete(row)}
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-6">
        <p class="text-sm font-medium text-slate-600">Tidak ada daftar harga yang cocok</p>
        <p class="text-xs text-slate-400">Coba kata kunci lain atau bersihkan pencarian.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="md"
  title={editingId ? 'Ubah daftar harga' : 'Tambah daftar harga'}
  description={editingId
    ? 'Perbarui detail daftar harga di bawah.'
    : 'Tambahkan tingkat harga baru untuk kelompok pelanggan.'}
>
  <div class="grid gap-4">
    <Input
      label="Nama"
      placeholder="mis. Grosir"
      bind:value={form.name}
      error={errors.name}
    />
    <Textarea
      label="Deskripsi"
      placeholder="Siapa yang memakai daftar harga ini?"
      bind:value={form.description}
    />
    <Toggle
      bind:checked={form.isDefault}
      label="Jadikan daftar harga utama"
      description="Daftar utama dipakai di storefront dan ketika tidak ada daftar lain yang berlaku."
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save}>{editingId ? 'Simpan perubahan' : 'Tambah daftar harga'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus daftar harga?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus. Produk dengan harga pada daftar ini akan kehilangan entri tersebut.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
