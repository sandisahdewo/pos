<script lang="ts">
  import { Plus, Search, Pencil, Trash2, Percent, Star } from 'lucide-svelte';
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
  import { taxRates, type TaxRate } from '$lib/stores/taxRates.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<TaxRate | null>(null);

  type FormState = { name: string; rate: number; description: string; isDefault: boolean };
  const blankForm: FormState = { name: '', rate: 0, description: '', isDefault: false };

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return taxRates.items;
    return taxRates.items.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  });

  const columns = [
    { key: 'name' as const, label: 'Tarif Pajak' },
    { key: 'rate' as const, label: 'Tarif', align: 'right' as const, width: '90px' },
    { key: 'description' as const, label: 'Deskripsi' },
    { key: 'isDefault' as const, label: 'Utama', align: 'center' as const, width: '120px' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '120px' }
  ];

  function openCreate() {
    editingId = null;
    form = { ...blankForm };
    errors = {};
    formOpen = true;
  }

  function openEdit(t: TaxRate) {
    editingId = t.id;
    form = { name: t.name, rate: t.rate, description: t.description, isDefault: t.isDefault };
    errors = {};
    formOpen = true;
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    if (!Number.isFinite(form.rate) || form.rate < 0)
      next.rate = 'Tarif harus 0 atau lebih.';
    if (form.rate > 100) next.rate = 'Tarif maksimal 100%.';
    errors = next;
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (editingId) {
      taxRates.update(editingId, { ...form });
      toast.success('Tarif pajak diperbarui', form.name);
    } else {
      taxRates.add({ ...form });
      toast.success('Tarif pajak ditambahkan', form.name);
    }
    formOpen = false;
  }

  function askDelete(t: TaxRate) {
    pendingDelete = t;
    confirmOpen = true;
  }

  function doDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    const ok = taxRates.remove(pendingDelete.id);
    pendingDelete = null;
    if (ok) toast.success('Tarif pajak dihapus', name);
    else toast.error('Tidak bisa dihapus', 'Tarif pajak utama atau tarif terakhir tidak bisa dihapus.');
  }

  function makeDefault(t: TaxRate) {
    taxRates.update(t.id, { isDefault: true });
    toast.success('Tarif pajak utama diperbarui', t.name);
  }
</script>

<svelte:head>
  <title>Tarif Pajak · POS Admin</title>
</svelte:head>

<PageHeader
  title="Tarif Pajak"
  description="Tarif pajak yang dapat dikonfigurasi (mis. PPN 11%) yang dipakai oleh kategori dan produk."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Tarif Pajak' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah tarif pajak
    </Button>
  {/snippet}
</PageHeader>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari tarif pajak…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
  </div>

  <Table {columns} rows={filtered} rowKey={(t) => t.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"
          >
            <Percent class="h-4 w-4" />
          </div>
          <div>
            <div class="font-medium text-slate-900">{row.name}</div>
            <div class="font-mono text-xs text-slate-500">{row.id}</div>
          </div>
        </div>
      {:else if column.key === 'rate'}
        <span class="font-medium text-slate-900">{row.rate}%</span>
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
        <p class="text-sm font-medium text-slate-600">Tidak ada tarif pajak yang cocok</p>
        <p class="text-xs text-slate-400">Coba kata kunci lain atau bersihkan pencarian.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="md"
  title={editingId ? 'Ubah tarif pajak' : 'Tambah tarif pajak'}
  description={editingId
    ? 'Perbarui detail tarif pajak di bawah.'
    : 'Tambahkan tarif pajak baru untuk dipakai di kategori atau produk.'}
>
  <div class="grid gap-4">
    <Input
      label="Nama"
      placeholder="mis. PPN 11%"
      bind:value={form.name}
      error={errors.name}
    />
    <Input
      label="Tarif"
      type="number"
      step="0.01"
      min="0"
      max="100"
      bind:value={form.rate}
      hint="Persentase yang diterapkan ke harga jual. Gunakan 0 untuk bebas pajak."
      error={errors.rate}
    >
      {#snippet trailing()}
        <span class="text-xs font-medium text-slate-400">%</span>
      {/snippet}
    </Input>
    <Textarea
      label="Deskripsi"
      placeholder="Kapan tarif ini berlaku?"
      bind:value={form.description}
    />
    <Toggle
      bind:checked={form.isDefault}
      label="Jadikan tarif pajak utama"
      description="Dipakai ketika kategori atau produk tidak menentukan tarifnya sendiri."
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save}>{editingId ? 'Simpan perubahan' : 'Tambah tarif pajak'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus tarif pajak?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus. Kategori dan produk yang memakainya akan fallback ke tarif pajak utama.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
