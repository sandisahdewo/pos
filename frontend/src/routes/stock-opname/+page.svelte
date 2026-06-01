<script lang="ts">
  import {
    Plus,
    Search,
    ClipboardCheck,
    AlertCircle,
    Eye,
    XCircle,
    CheckCircle2
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    Input,
    PageHeader,
    Select,
    Table,
    ConfirmDialog
  } from '$lib/components/ui';
  import {
    stockOpnames,
    opnameStatusLabels,
    opnameTotals,
    type StockOpname,
    type OpnameStatus
  } from '$lib/stores/stockOpnames.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let search = $state('');
  let statusFilter = $state<'' | OpnameStatus>('');
  let locationFilter = $state('');
  let confirmCancelOpen = $state(false);
  let pendingCancel = $state<StockOpname | null>(null);

  const auditOn = $derived(settings.value.inventory.auditTrailEnabled);
  const locationsOn = $derived(settings.value.inventory.locationsEnabled);

  const statusOptions = [
    { value: '', label: 'Semua status' },
    { value: 'draft' as const, label: 'Draft' },
    { value: 'completed' as const, label: 'Selesai' },
    { value: 'cancelled' as const, label: 'Dibatalkan' }
  ];

  const locationOptions = $derived([
    { value: '', label: 'Semua lokasi' },
    ...locations.sortedActive().map((l) => ({ value: l.id, label: l.name }))
  ]);

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return stockOpnames.items
      .filter((o) => {
        if (statusFilter && o.status !== statusFilter) return false;
        if (locationFilter && o.locationId !== locationFilter) return false;
        if (!q) return true;
        return (
          o.code.toLowerCase().includes(q) ||
          o.notes.toLowerCase().includes(q) ||
          o.performedBy.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  });

  function statusBadgeVariant(s: OpnameStatus): 'success' | 'warning' | 'neutral' {
    if (s === 'completed') return 'success';
    if (s === 'draft') return 'warning';
    return 'neutral';
  }

  function locationName(id?: string): string {
    if (!id) return 'Semua lokasi';
    return locations.getById(id)?.name ?? id;
  }

  function formatDate(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(d);
    } catch {
      return iso;
    }
  }

  function askCancel(o: StockOpname) {
    pendingCancel = o;
    confirmCancelOpen = true;
  }

  function doCancel() {
    if (!pendingCancel) return;
    const code = pendingCancel.code;
    const r = stockOpnames.cancel(pendingCancel.id);
    pendingCancel = null;
    if (r.ok) toast.success('Opname dibatalkan', code);
    else toast.error('Gagal membatalkan', r.reason ?? '');
  }

  const columns = [
    { key: 'code' as const, label: 'Kode', width: '130px' },
    { key: 'startedAt' as const, label: 'Mulai', width: '140px' },
    { key: 'locationId' as const, label: 'Lokasi', width: '140px' },
    { key: 'lines' as const, label: 'Baris', align: 'right' as const, width: '90px' },
    { key: 'variance' as const, label: 'Selisih', align: 'right' as const, width: '100px' },
    { key: 'shrinkageValue' as const, label: 'Nilai shrinkage', align: 'right' as const, width: '150px' },
    { key: 'status' as const, label: 'Status', width: '110px' },
    { key: 'performedBy' as const, label: 'Oleh', width: '130px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '130px' }
  ];
</script>

<svelte:head>
  <title>Opname Stok · POS Admin</title>
</svelte:head>

<PageHeader
  title="Opname Stok"
  description="Audit fisik stok per lokasi. Hitung jumlah aktual, sistem catat selisih sebagai shrinkage/surplus."
  breadcrumb={[{ label: 'Katalog' }, { label: 'Opname Stok' }]}
>
  {#snippet actions()}
    {#if auditOn}
      <Button href="/stock-opname/new">
        <Plus class="h-4 w-4" />
        Mulai opname baru
      </Button>
    {/if}
  {/snippet}
</PageHeader>

{#if !auditOn}
  <Card>
    <div class="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle class="h-10 w-10 text-amber-500" />
      <p class="text-base font-semibold text-slate-900">Opname stok belum diaktifkan</p>
      <p class="max-w-md text-sm text-slate-600">
        Aktifkan toggle "Riwayat & opname stok" di
        <a href="/settings" class="font-medium text-brand-700 hover:underline">Pengaturan</a> untuk
        mulai melakukan audit stok fisik.
      </p>
    </div>
  </Card>
{:else}
  <Card padded={false}>
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
      <div class="min-w-[220px] flex-1">
        <Input placeholder="Cari kode, catatan…" bind:value={search}>
          {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
        </Input>
      </div>
      <Select bind:value={statusFilter} options={statusOptions} class="w-40" />
      {#if locationsOn}
        <Select bind:value={locationFilter} options={locationOptions} class="w-44" />
      {/if}
    </div>

    <Table {columns} rows={filtered} rowKey={(o) => o.id}>
      {#snippet cell({ row, column })}
        {#if column.key === 'code'}
          <a
            href="/stock-opname/{row.id}"
            class="font-mono text-xs font-medium text-brand-700 hover:underline"
          >
            {row.code}
          </a>
        {:else if column.key === 'startedAt'}
          <span class="text-xs text-slate-600">{formatDate(row.startedAt)}</span>
        {:else if column.key === 'locationId'}
          <span class="text-sm text-slate-700">{locationName(row.locationId)}</span>
        {:else if column.key === 'lines'}
          <span class="text-sm text-slate-700">{row.lines.length}</span>
        {:else if column.key === 'variance'}
          {@const t = opnameTotals(row)}
          {#if row.status === 'completed'}
            <span
              class={t.totalVariance < 0
                ? 'font-semibold text-rose-700'
                : t.totalVariance > 0
                  ? 'font-semibold text-emerald-700'
                  : 'text-slate-500'}
            >
              {t.totalVariance > 0 ? '+' : ''}{t.totalVariance}
            </span>
          {:else}
            <span class="text-xs text-slate-400">—</span>
          {/if}
        {:else if column.key === 'shrinkageValue'}
          {@const t = opnameTotals(row)}
          {#if row.status === 'completed' && t.totalShrinkageValue > 0}
            <span class="text-sm font-medium text-rose-700">
              −{formatRupiah(t.totalShrinkageValue)}
            </span>
          {:else}
            <span class="text-xs text-slate-400">—</span>
          {/if}
        {:else if column.key === 'status'}
          <Badge variant={statusBadgeVariant(row.status)} size="sm">
            {#if row.status === 'completed'}
              <CheckCircle2 class="mr-1 h-3 w-3" />
            {:else if row.status === 'cancelled'}
              <XCircle class="mr-1 h-3 w-3" />
            {/if}
            {opnameStatusLabels[row.status]}
          </Badge>
        {:else if column.key === 'performedBy'}
          <span class="text-xs text-slate-600">{row.performedBy}</span>
        {:else if column.key === 'actions'}
          <div class="flex justify-end gap-1">
            <a
              href="/stock-opname/{row.id}"
              class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              aria-label="Buka"
            >
              <Eye class="h-3.5 w-3.5" />
              Buka
            </a>
            {#if row.status === 'draft'}
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                onclick={() => askCancel(row)}
              >
                <XCircle class="h-3.5 w-3.5" />
                Batal
              </button>
            {/if}
          </div>
        {/if}
      {/snippet}

      {#snippet empty()}
        <div class="flex flex-col items-center gap-1.5 py-10">
          <ClipboardCheck class="h-8 w-8 text-slate-300" />
          <p class="text-sm font-medium text-slate-600">Belum ada opname</p>
          <p class="text-xs text-slate-400">Mulai opname pertama Anda untuk audit stok fisik.</p>
          <Button href="/stock-opname/new" class="mt-2">
            <Plus class="h-4 w-4" />
            Mulai opname baru
          </Button>
        </div>
      {/snippet}
    </Table>
  </Card>
{/if}

<ConfirmDialog
  bind:open={confirmCancelOpen}
  title="Batalkan opname?"
  message={pendingCancel
    ? `Opname "${pendingCancel.code}" akan dibatalkan. Hitungan yang sudah dimasukkan akan hilang.`
    : ''}
  confirmLabel="Batalkan opname"
  onConfirm={doCancel}
  onCancel={() => (pendingCancel = null)}
/>
