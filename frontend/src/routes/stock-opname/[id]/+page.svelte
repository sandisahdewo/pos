<script lang="ts">
  import {
    ArrowLeft,
    AlertCircle,
    CheckCircle2,
    XCircle,
    ClipboardCheck,
    Search,
    History,
    ExternalLink,
    ArrowUp,
    ArrowDown
  } from 'lucide-svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    Modal,
    PageHeader,
    Table
  } from '$lib/components/ui';
  import MovementTimeline from '$lib/components/inventory/MovementTimeline.svelte';
  import {
    stockOpnames,
    opnameTotals,
    opnameStatusLabels,
    lineVariance,
    lineVarianceValue,
    type StockOpname,
    type OpnameLine
  } from '$lib/stores/stockOpnames.svelte';
  import {
    stockMovements,
    movementKindLabels,
    type StockMovement
  } from '$lib/stores/stockMovements.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const opname = $derived(stockOpnames.getById(page.params.id ?? ''));
  const totals = $derived(opname ? opnameTotals(opname) : null);
  const readonly = $derived(opname?.status !== 'draft');

  let search = $state('');
  let onlyVariance = $state(false);
  let confirmCompleteOpen = $state(false);
  let confirmCancelOpen = $state(false);

  // Per-row counted-input unit selection: lineId → "unitId|factor".
  // Default (when unset) = product base unit, factor 1.
  let countedUnitByLine = $state<Record<string, string>>({});

  // Selidiki / investigation side panel
  let selidikiOpen = $state(false);
  let selidikiLine = $state<OpnameLine | null>(null);

  const filteredLines = $derived.by(() => {
    if (!opname) return [] as OpnameLine[];
    const q = search.trim().toLowerCase();
    return opname.lines.filter((l) => {
      const v = lineVariance(l);
      if (onlyVariance && v === 0) return false;
      if (!q) return true;
      const p = products.getById(l.productId);
      if (!p) return false;
      const variantName = l.variantId
        ? p.variants.find((v) => v.id === l.variantId)?.name ?? ''
        : '';
      const hay = `${p.name} ${p.sku} ${variantName}`.toLowerCase();
      return hay.includes(q);
    });
  });

  function productLabel(line: OpnameLine): string {
    const p = products.getById(line.productId);
    if (!p) return '(produk dihapus)';
    if (!line.variantId) return p.name;
    const v = p.variants.find((vv) => vv.id === line.variantId);
    return v ? `${p.name} — ${v.name}` : p.name;
  }

  function productSku(line: OpnameLine): string {
    const p = products.getById(line.productId);
    if (!p) return '';
    if (!line.variantId) return p.sku;
    return p.variants.find((vv) => vv.id === line.variantId)?.sku ?? p.sku;
  }

  function statusBadgeVariant(s: string): 'success' | 'warning' | 'neutral' {
    if (s === 'completed') return 'success';
    if (s === 'draft') return 'warning';
    return 'neutral';
  }

  function formatDateTime(iso?: string): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    } catch {
      return iso;
    }
  }

  function locationLabel(): string {
    if (!opname?.locationId) return 'Semua lokasi';
    return locations.getById(opname.locationId)?.name ?? opname.locationId;
  }

  function varianceClass(v: number): string {
    if (v > 0) return 'font-semibold text-emerald-700';
    if (v < 0) return 'font-semibold text-rose-700';
    return 'text-slate-500';
  }

  function formatDelta(v: number): string {
    if (v > 0) return `+${v}`;
    return String(v);
  }

  function baseUnitCodeFor(line: OpnameLine): string {
    const p = products.getById(line.productId);
    if (!p) return '';
    return units.getById(p.unitId)?.code ?? '';
  }

  function unitOptionsFor(
    line: OpnameLine
  ): { value: string; label: string; factor: number }[] {
    const p = products.getById(line.productId);
    if (!p) return [];
    const base = units.getById(p.unitId);
    const baseCode = base?.code ?? '?';
    const opts = [
      {
        value: `${p.unitId}|1`,
        label: `${base?.name ?? '?'} (${baseCode})`,
        factor: 1
      }
    ];
    for (const pack of p.units) {
      const u = units.getById(pack.unitId);
      if (!u || pack.factor <= 0) continue;
      opts.push({
        value: `${pack.unitId}|${pack.factor}`,
        label: `${u.name} — isi ${pack.factor} ${baseCode}`,
        factor: pack.factor
      });
    }
    return opts;
  }

  function defaultUnitKeyFor(line: OpnameLine): string {
    const p = products.getById(line.productId);
    return p ? `${p.unitId}|1` : '';
  }

  function getUnitKey(line: OpnameLine): string {
    return countedUnitByLine[line.id] ?? defaultUnitKeyFor(line);
  }

  function getUnitFactor(line: OpnameLine): number {
    const key = getUnitKey(line);
    const factor = Number(key.split('|')[1]);
    return Number.isFinite(factor) && factor > 0 ? factor : 1;
  }

  function getUnitCode(line: OpnameLine): string {
    const key = getUnitKey(line);
    const unitId = key.split('|')[0];
    return units.getById(unitId)?.code ?? '';
  }

  function setUnitKey(line: OpnameLine, key: string) {
    countedUnitByLine = { ...countedUnitByLine, [line.id]: key };
  }

  function getCountedDisplay(line: OpnameLine): string {
    if (line.countedQty === null) return '';
    const factor = getUnitFactor(line);
    if (factor === 1) return String(line.countedQty);
    // For non-base units, show the fractional equivalent (e.g., 35 pcs / 10 = 3.5 trays).
    const value = line.countedQty / factor;
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  }

  function setCountedQty(line: OpnameLine, raw: string) {
    if (!opname || readonly) return;
    const trimmed = raw.trim();
    if (trimmed === '') {
      void stockOpnames.updateLine(opname.id, line.id, { countedQty: null });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    const factor = getUnitFactor(line);
    const baseQty = Math.round(n * factor);
    void stockOpnames.updateLine(opname.id, line.id, { countedQty: baseQty });
  }

  function setLineNotes(line: OpnameLine, raw: string) {
    if (!opname || readonly) return;
    void stockOpnames.updateLine(opname.id, line.id, { notes: raw });
  }

  function openSelidiki(line: OpnameLine) {
    selidikiLine = line;
    selidikiOpen = true;
  }

  // History for the Selidiki side panel. Period: from 30 days before opname.startedAt to now.
  const selidikiHistory = $derived.by(() => {
    if (!opname || !selidikiLine) return [] as StockMovement[];
    const start = new Date(opname.startedAt);
    start.setDate(start.getDate() - 30);
    const sinceISO = start.toISOString();
    return stockMovements.forProduct(selidikiLine.productId, selidikiLine.variantId, {
      locationId: opname.locationId,
      since: sinceISO
    });
  });

  function kindBadgeVariant(
    kind: string
  ): 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' {
    switch (kind) {
      case 'receive':
        return 'success';
      case 'sale':
        return 'neutral';
      case 'sale-cancel':
        return 'warning';
      case 'adjust-in':
        return 'success';
      case 'adjust-out':
        return 'danger';
      case 'move-out':
      case 'move-in':
      case 'move-relocate':
        return 'info';
      case 'return-consignor':
        return 'brand';
      default:
        return 'neutral';
    }
  }

  async function complete() {
    if (!opname) return;
    const skipUncounted = totals && totals.uncountedLines > 0;
    const result = await stockOpnames.complete(opname.id, { skipUncounted: !!skipUncounted });
    if (!result.ok) {
      toast.error('Gagal menyelesaikan opname', result.reason ?? '');
      return;
    }
    const msg = `${result.adjusted} baris disesuaikan${result.skipped > 0 ? ` · ${result.skipped} dilewati` : ''}`;
    toast.success(`Opname ${opname.code} selesai`, msg);
  }

  async function cancel() {
    if (!opname) return;
    const code = opname.code;
    const r = await stockOpnames.cancel(opname.id);
    if (r.ok) {
      toast.success('Opname dibatalkan', code);
      goto('/stock-opname');
    } else {
      toast.error('Gagal membatalkan', r.reason ?? '');
    }
  }

  const columns = $derived([
    { key: 'product' as const, label: 'Produk' },
    { key: 'expected' as const, label: 'Sistem', align: 'right' as const, width: '110px' },
    { key: 'counted' as const, label: 'Fisik', align: 'right' as const, width: '220px' },
    { key: 'variance' as const, label: 'Selisih', align: 'right' as const, width: '110px' },
    { key: 'varianceValue' as const, label: 'Nilai selisih', align: 'right' as const, width: '130px' },
    { key: 'notes' as const, label: 'Catatan baris', width: '180px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '110px' }
  ]);
</script>

<svelte:head>
  <title>{opname?.code ?? 'Opname'} · POS Admin</title>
</svelte:head>

<PageHeader
  title={opname ? `Opname ${opname.code}` : 'Opname tidak ditemukan'}
  description={opname
    ? `Hitung stok fisik dan biarkan sistem merekam selisih sebagai shrinkage atau surplus.`
    : 'Periksa kembali daftar opname.'}
  breadcrumb={[
    { label: 'Katalog' },
    { label: 'Opname Stok', href: '/stock-opname' },
    { label: opname?.code ?? '—' }
  ]}
>
  {#snippet actions()}
    <Button variant="outline" href="/stock-opname">
      <ArrowLeft class="h-4 w-4" />
      Kembali
    </Button>
  {/snippet}
</PageHeader>

{#if !opname}
  <Card>
    <div class="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle class="h-10 w-10 text-amber-500" />
      <p class="text-base font-semibold text-slate-900">Opname tidak ditemukan</p>
      <p class="max-w-md text-sm text-slate-600">
        Mungkin sudah dihapus atau ID-nya salah. Kembali ke
        <a href="/stock-opname" class="font-medium text-brand-700 hover:underline">daftar opname</a>.
      </p>
    </div>
  </Card>
{:else}
  <!-- Header strip -->
  <Card class="mb-4">
    <div class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div class="flex flex-wrap items-center gap-3">
        <Badge variant={statusBadgeVariant(opname.status)}>
          {#if opname.status === 'completed'}
            <CheckCircle2 class="mr-1 h-3 w-3" />
          {:else if opname.status === 'cancelled'}
            <XCircle class="mr-1 h-3 w-3" />
          {:else}
            <ClipboardCheck class="mr-1 h-3 w-3" />
          {/if}
          {opnameStatusLabels[opname.status]}
        </Badge>
        <div class="text-xs text-slate-500">
          <span class="font-medium text-slate-700">Lokasi:</span>
          {locationLabel()}
        </div>
        <div class="text-xs text-slate-500">
          <span class="font-medium text-slate-700">Mulai:</span>
          {formatDateTime(opname.startedAt)}
        </div>
        {#if opname.completedAt}
          <div class="text-xs text-slate-500">
            <span class="font-medium text-slate-700">Selesai:</span>
            {formatDateTime(opname.completedAt)}
          </div>
        {/if}
        <div class="text-xs text-slate-500">
          <span class="font-medium text-slate-700">Oleh:</span>
          {opname.performedBy}
        </div>
      </div>

      {#if opname.status === 'draft'}
        <div class="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onclick={() => (confirmCancelOpen = true)}>
            <XCircle class="h-4 w-4" />
            Batalkan
          </Button>
          <Button onclick={() => (confirmCompleteOpen = true)}>
            <CheckCircle2 class="h-4 w-4" />
            Selesaikan opname
          </Button>
        </div>
      {/if}
    </div>

    {#if opname.notes}
      <p class="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{opname.notes}</p>
    {/if}
  </Card>

  <!-- Totals -->
  {#if totals}
    <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
        <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Baris</p>
        <p class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {totals.countedLines} / {opname.lines.length}
        </p>
        <p class="mt-1 text-xs text-slate-500">
          {totals.uncountedLines > 0
            ? `${totals.uncountedLines} belum dihitung`
            : 'Semua dihitung'}
        </p>
      </div>
      <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
        <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Total selisih</p>
        <p class="mt-2 text-2xl font-semibold tracking-tight {totals.totalVariance < 0 ? 'text-rose-700' : totals.totalVariance > 0 ? 'text-emerald-700' : 'text-slate-900'}">
          {formatDelta(totals.totalVariance)}
        </p>
        <p class="mt-1 text-xs text-slate-500">
          {totals.totalVariance < 0
            ? 'Stok lebih sedikit dari sistem'
            : totals.totalVariance > 0
              ? 'Stok lebih banyak dari sistem'
              : 'Stok sesuai sistem'}
        </p>
      </div>
      <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
        <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Nilai shrinkage</p>
        <p class="mt-2 text-2xl font-semibold tracking-tight {totals.totalShrinkageValue > 0 ? 'text-rose-700' : 'text-slate-900'}">
          {formatRupiah(totals.totalShrinkageValue)}
        </p>
        <p class="mt-1 text-xs text-slate-500">Estimasi nilai stok yang hilang</p>
      </div>
      <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
        <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">Nilai surplus</p>
        <p class="mt-2 text-2xl font-semibold tracking-tight {totals.totalSurplusValue > 0 ? 'text-emerald-700' : 'text-slate-900'}">
          {formatRupiah(totals.totalSurplusValue)}
        </p>
        <p class="mt-1 text-xs text-slate-500">Estimasi nilai stok lebih</p>
      </div>
    </div>
  {/if}

  <!-- Lines -->
  <Card padded={false}>
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
      <div class="min-w-[240px] flex-1">
        <Input placeholder="Cari produk dalam opname ini…" bind:value={search}>
          {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
        </Input>
      </div>
      <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
          bind:checked={onlyVariance}
        />
        <span>Hanya yang ada selisih</span>
      </label>
    </div>

    <Table {columns} rows={filteredLines} rowKey={(l) => l.id}>
      {#snippet cell({ row, column })}
        {#if column.key === 'product'}
          <div>
            <div class="text-sm font-medium text-slate-900">{productLabel(row)}</div>
            <code class="text-[10px] font-mono text-slate-500">{productSku(row)}</code>
          </div>
        {:else if column.key === 'expected'}
          {@const baseCode = baseUnitCodeFor(row)}
          <span class="text-sm text-slate-700">
            {row.expectedQty}
            {#if baseCode}<span class="ml-0.5 text-[10px] text-slate-400">{baseCode}</span>{/if}
          </span>
        {:else if column.key === 'counted'}
          {@const baseCode = baseUnitCodeFor(row)}
          {@const factor = getUnitFactor(row)}
          {@const opts = unitOptionsFor(row)}
          {#if readonly}
            {#if row.countedQty === null}
              <span class="text-sm text-slate-400">—</span>
            {:else}
              <span class="text-sm text-slate-700">{row.countedQty}</span>
              {#if baseCode}<span class="ml-0.5 text-[10px] text-slate-400">{baseCode}</span>{/if}
            {/if}
          {:else}
            <div class="flex flex-col items-end gap-0.5">
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step={factor > 1 ? 'any' : '1'}
                  value={getCountedDisplay(row)}
                  placeholder="hitung"
                  class="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  oninput={(e) => setCountedQty(row, (e.currentTarget as HTMLInputElement).value)}
                />
                {#if opts.length > 1}
                  <select
                    value={getUnitKey(row)}
                    onchange={(e) => setUnitKey(row, (e.currentTarget as HTMLSelectElement).value)}
                    class="rounded-md border border-slate-200 bg-white py-1 pr-6 pl-2 text-xs focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                    title="Satuan untuk hitung"
                  >
                    {#each opts as o (o.value)}
                      <option value={o.value}>{o.label}</option>
                    {/each}
                  </select>
                {:else}
                  <span class="text-[10px] text-slate-400">{baseCode}</span>
                {/if}
              </div>
              {#if row.countedQty !== null && factor > 1}
                <span class="text-[10px] text-slate-500">
                  = <span class="font-medium text-slate-700">{row.countedQty}</span> {baseCode}
                </span>
              {/if}
            </div>
          {/if}
        {:else if column.key === 'variance'}
          {@const v = lineVariance(row)}
          {@const baseCode = baseUnitCodeFor(row)}
          {#if row.countedQty === null}
            <span class="text-xs text-slate-400">—</span>
          {:else}
            <span class={varianceClass(v)}>
              {formatDelta(v)}
              {#if baseCode}<span class="ml-0.5 text-[10px] font-normal text-slate-400">{baseCode}</span>{/if}
            </span>
          {/if}
        {:else if column.key === 'varianceValue'}
          {@const vv = lineVarianceValue(row)}
          {#if row.countedQty === null || vv === 0}
            <span class="text-xs text-slate-400">—</span>
          {:else}
            <span class={vv < 0 ? 'font-medium text-rose-700' : 'font-medium text-emerald-700'}>
              {vv > 0 ? '+' : ''}{formatRupiah(vv)}
            </span>
          {/if}
        {:else if column.key === 'notes'}
          {#if readonly}
            <span class="line-clamp-1 text-xs text-slate-500">{row.notes || '—'}</span>
          {:else}
            <input
              type="text"
              value={row.notes}
              placeholder="catatan baris (opsional)"
              class="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
              oninput={(e) => setLineNotes(row, (e.currentTarget as HTMLInputElement).value)}
            />
          {/if}
        {:else if column.key === 'actions'}
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            onclick={() => openSelidiki(row)}
          >
            <Search class="h-3 w-3" />
            Selidiki
          </button>
        {/if}
      {/snippet}

      {#snippet empty()}
        <div class="flex flex-col items-center gap-1.5 py-10">
          <ClipboardCheck class="h-8 w-8 text-slate-300" />
          <p class="text-sm font-medium text-slate-600">Tidak ada baris yang cocok</p>
          <p class="text-xs text-slate-400">Sesuaikan pencarian atau filter.</p>
        </div>
      {/snippet}
    </Table>
  </Card>
{/if}

<Modal
  bind:open={selidikiOpen}
  size="xl"
  title={selidikiLine
    ? `Riwayat: ${productLabel(selidikiLine)}${opname?.locationId ? ` · ${locations.getById(opname.locationId)?.name ?? ''}` : ''}`
    : ''}
  description="Pergerakan stok 30 hari sebelum opname dimulai sampai sekarang. Gunakan ini untuk menelusuri ke mana unit yang hilang pergi."
>
  {#if selidikiLine && opname}
    <MovementTimeline
      movements={selidikiHistory}
      emptyTitle="Belum ada pergerakan"
      emptyHint="Periode ini belum punya catatan. Pastikan fitur 'Riwayat & opname stok' sudah aktif sebelum stok mulai berubah."
    />
  {/if}

  {#snippet footer()}
    {#if selidikiLine}
      <Button variant="outline" href="/inventory/{selidikiLine.productId}/history">
        <History class="h-4 w-4" />
        Buka riwayat lengkap
      </Button>
    {/if}
    <Button variant="outline" onclick={() => (selidikiOpen = false)}>Tutup</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  bind:open={confirmCompleteOpen}
  title="Selesaikan opname?"
  message={opname && totals
    ? totals.uncountedLines > 0
      ? `${totals.uncountedLines} baris belum dihitung dan akan dilewati. ${totals.totalShrinkageValue > 0 ? `Sistem akan mencatat shrinkage senilai ${formatRupiah(totals.totalShrinkageValue)}.` : 'Sistem akan menyesuaikan stok berdasarkan selisih.'}`
      : `${totals.totalVariance === 0 ? 'Tidak ada selisih — opname akan ditutup tanpa penyesuaian.' : `Sistem akan menyesuaikan stok untuk ${opname.lines.filter((l) => lineVariance(l) !== 0).length} baris dengan selisih.`}`
    : ''}
  confirmLabel="Selesaikan"
  variant="primary"
  onConfirm={complete}
/>

<ConfirmDialog
  bind:open={confirmCancelOpen}
  title="Batalkan opname?"
  message={opname
    ? `Opname "${opname.code}" akan dibatalkan. Hitungan yang sudah dimasukkan akan hilang dan tidak ada penyesuaian stok yang dilakukan.`
    : ''}
  confirmLabel="Batalkan opname"
  onConfirm={cancel}
/>
