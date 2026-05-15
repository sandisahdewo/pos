<script lang="ts">
  import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Warehouse as WarehouseIcon,
    Star,
    Eye,
    EyeOff,
    ShoppingBag,
    Archive
  } from 'lucide-svelte';
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
  import {
    locations,
    locationKindOptions,
    defaultVisibilityForKind,
    type Location,
    type LocationKind,
    type LocationStatus
  } from '$lib/stores/locations.svelte';
  import { batches } from '$lib/stores/batches.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let search = $state('');
  let formOpen = $state(false);
  let editingId = $state<string | null>(null);
  let confirmOpen = $state(false);
  let pendingDelete = $state<Location | null>(null);

  type FormState = {
    name: string;
    slug: string;
    kind: LocationKind;
    customerVisible: boolean;
    isDefaultReceipt: boolean;
    displayOrder: number;
    description: string;
    status: LocationStatus;
  };

  const blankForm: FormState = {
    name: '',
    slug: '',
    kind: 'shelf',
    customerVisible: true,
    isDefaultReceipt: false,
    displayOrder: 10,
    description: '',
    status: 'active'
  };

  let form = $state<FormState>({ ...blankForm });
  let errors = $state<Partial<Record<keyof FormState, string>>>({});
  let visibilityTouched = $state(false);

  const sorted = $derived.by(() => {
    const q = search.trim().toLowerCase();
    const base = [...locations.items].sort((a, b) => a.displayOrder - b.displayOrder);
    if (!q) return base;
    return base.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.slug.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
    );
  });

  const columns = [
    { key: 'name' as const, label: 'Lokasi' },
    { key: 'kind' as const, label: 'Jenis', width: '160px' },
    { key: 'customerVisible' as const, label: 'Visibilitas', width: '160px' },
    { key: 'stock' as const, label: 'Stok aktif', align: 'right' as const, width: '120px' },
    { key: 'isDefaultReceipt' as const, label: 'Penerimaan', align: 'center' as const, width: '120px' },
    { key: 'status' as const, label: 'Status', width: '110px' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '110px' }
  ];

  function batchCountFor(locationId: string): number {
    let total = 0;
    for (const b of batches.items) {
      if (b.locationId === locationId && b.qtyRemaining > 0) total += b.qtyRemaining;
    }
    return total;
  }

  function kindLabel(k: LocationKind): string {
    return locationKindOptions.find((o) => o.value === k)?.label ?? k;
  }

  function kindBadgeVariant(k: LocationKind): 'success' | 'warning' | 'neutral' {
    if (k === 'shelf') return 'success';
    if (k === 'rack') return 'warning';
    return 'neutral';
  }

  function openCreate() {
    editingId = null;
    visibilityTouched = false;
    form = {
      ...blankForm,
      displayOrder: Math.max(...locations.items.map((l) => l.displayOrder), 0) + 1
    };
    errors = {};
    formOpen = true;
  }

  function openEdit(loc: Location) {
    editingId = loc.id;
    visibilityTouched = true;
    form = {
      name: loc.name,
      slug: loc.slug,
      kind: loc.kind,
      customerVisible: loc.customerVisible,
      isDefaultReceipt: loc.isDefaultReceipt,
      displayOrder: loc.displayOrder,
      description: loc.description,
      status: loc.status
    };
    errors = {};
    formOpen = true;
  }

  function onKindChange() {
    if (!visibilityTouched) {
      form.customerVisible = defaultVisibilityForKind(form.kind);
    }
  }

  function onVisibilityChange(v: boolean) {
    visibilityTouched = true;
    form.customerVisible = v;
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Nama wajib diisi.';
    if (form.slug && !/^[a-z0-9-]+$/.test(form.slug))
      next.slug = 'Gunakan huruf kecil, angka, dan tanda hubung saja.';
    if (!Number.isFinite(form.displayOrder)) next.displayOrder = 'Angka tidak valid.';
    errors = next;
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (editingId) {
      locations.update(editingId, { ...form });
      toast.success('Lokasi diperbarui', form.name);
    } else {
      locations.add({ ...form });
      toast.success('Lokasi ditambahkan', form.name);
    }
    formOpen = false;
  }

  function askDelete(loc: Location) {
    pendingDelete = loc;
    confirmOpen = true;
  }

  function doDelete() {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    const result = locations.remove(pendingDelete.id);
    pendingDelete = null;
    if (result.ok) toast.success('Lokasi dihapus', name);
    else toast.error('Tidak bisa dihapus', result.reason ?? '');
  }

  function makeDefaultReceipt(loc: Location) {
    locations.update(loc.id, { isDefaultReceipt: true });
    toast.success('Lokasi default penerimaan diperbarui', loc.name);
  }
</script>

<svelte:head>
  <title>Lokasi · POS Admin</title>
</svelte:head>

<PageHeader
  title="Lokasi"
  description="Tempat fisik penyimpanan stok di toko Anda — Etalase, Rak Belakang, Gudang."
  breadcrumb={[{ label: 'Data Master' }, { label: 'Lokasi' }]}
>
  {#snippet actions()}
    <Button onclick={openCreate}>
      <Plus class="h-4 w-4" />
      Tambah lokasi
    </Button>
  {/snippet}
</PageHeader>

{#if !settings.value.inventory.locationsEnabled}
  <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
    <p class="font-medium">Manajemen lokasi sedang dimatikan.</p>
    <p class="mt-1 text-xs text-amber-800">
      Anda masih bisa melihat dan menyiapkan daftar lokasi di sini. Aktifkan toggle di
      <a href="/settings" class="underline">Pengaturan</a> untuk mulai memakainya di Inventaris, Produk, dan Kasir.
    </p>
  </div>
{/if}

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari lokasi…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
  </div>

  <Table {columns} rows={sorted} rowKey={(l) => l.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"
          >
            <WarehouseIcon class="h-4 w-4" />
          </div>
          <div>
            <div class="font-medium text-slate-900">{row.name}</div>
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <code class="rounded bg-slate-50 px-1 py-0.5 font-mono">{row.slug}</code>
              {#if row.description}
                <span class="line-clamp-1 max-w-md">{row.description}</span>
              {/if}
            </div>
          </div>
        </div>
      {:else if column.key === 'kind'}
        <Badge variant={kindBadgeVariant(row.kind)} size="sm">{kindLabel(row.kind)}</Badge>
      {:else if column.key === 'customerVisible'}
        {#if row.customerVisible}
          <span class="inline-flex items-center gap-1.5 text-xs text-emerald-700">
            <Eye class="h-3.5 w-3.5" />
            <span class="font-medium">Terlihat pelanggan</span>
          </span>
        {:else}
          <span class="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <EyeOff class="h-3.5 w-3.5" />
            <span class="font-medium">Hanya kasir</span>
          </span>
        {/if}
      {:else if column.key === 'stock'}
        {@const qty = batchCountFor(row.id)}
        <span class="font-medium {qty > 0 ? 'text-slate-900' : 'text-slate-400'}">{qty}</span>
      {:else if column.key === 'isDefaultReceipt'}
        {#if row.isDefaultReceipt}
          <Badge variant="brand" size="sm">
            <Star class="mr-1 h-3 w-3" />
            Default
          </Badge>
        {:else}
          <button
            type="button"
            class="text-xs text-slate-400 hover:text-brand-600"
            onclick={() => makeDefaultReceipt(row)}
            disabled={row.status !== 'active'}
          >
            Jadikan default
          </button>
        {/if}
      {:else if column.key === 'status'}
        {#if row.status === 'active'}
          <Badge variant="success" size="sm" dot>Aktif</Badge>
        {:else}
          <Badge variant="neutral" size="sm">
            <Archive class="mr-1 h-3 w-3" />
            Arsip
          </Badge>
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
            disabled={row.isDefaultReceipt}
            onclick={() => askDelete(row)}
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-6">
        <ShoppingBag class="h-7 w-7 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Tidak ada lokasi yang cocok</p>
        <p class="text-xs text-slate-400">Coba kata kunci lain atau bersihkan pencarian.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={formOpen}
  size="lg"
  title={editingId ? 'Ubah lokasi' : 'Tambah lokasi'}
  description={editingId
    ? 'Perbarui detail lokasi penyimpanan.'
    : 'Tempat fisik penyimpanan stok — Etalase, Rak Belakang, Gudang, dll.'}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <Input
      label="Nama"
      placeholder="mis. Etalase Depan"
      bind:value={form.name}
      error={errors.name}
    />
    <Input
      label="Slug"
      placeholder="auto-generated"
      hint="Kosongkan untuk dibuat dari nama."
      bind:value={form.slug}
      error={errors.slug}
    />
    <Select
      label="Jenis"
      bind:value={form.kind}
      options={locationKindOptions.map((o) => ({ value: o.value, label: o.label }))}
      onchange={onKindChange}
    />
    <Input
      label="Urutan tampil"
      type="number"
      step="1"
      bind:value={form.displayOrder}
      hint="Angka kecil tampil duluan di breakdown."
      error={errors.displayOrder}
    />
    <div class="sm:col-span-2">
      <Toggle
        checked={form.customerVisible}
        onchange={onVisibilityChange}
        label="Terlihat oleh pelanggan"
        description="Pelanggan bisa melihat dan mengambil sendiri produk yang ada di lokasi ini."
      />
    </div>
    <div class="sm:col-span-2">
      <Toggle
        bind:checked={form.isDefaultReceipt}
        label="Default lokasi penerimaan PO"
        description="Stok baru dari Order Pembelian akan dicatat di lokasi ini. Hanya satu lokasi yang bisa jadi default."
      />
    </div>
    <Textarea
      class="sm:col-span-2"
      label="Deskripsi"
      placeholder="Apa saja yang disimpan di sini?"
      bind:value={form.description}
    />
    {#if editingId}
      <Select
        class="sm:col-span-2"
        label="Status"
        bind:value={form.status}
        options={[
          { value: 'active', label: 'Aktif' },
          { value: 'archived', label: 'Arsip' }
        ]}
      />
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (formOpen = false)}>Batal</Button>
    <Button onclick={save}>{editingId ? 'Simpan perubahan' : 'Tambah lokasi'}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus lokasi?"
  message={pendingDelete
    ? `"${pendingDelete.name}" akan dihapus. Pastikan tidak ada stok yang tersimpan di sini.`
    : ''}
  confirmLabel="Hapus"
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
