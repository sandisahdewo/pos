<script lang="ts">
  import {
    ArrowLeft,
    Search,
    Layers,
    AlertCircle,
    AlertTriangle,
    ArrowLeftRight,
    ScanLine,
    CheckSquare,
    Square,
    Check
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    Input,
    PageHeader,
    Select,
    Textarea
  } from '$lib/components/ui';
  import { batches, type Batch } from '$lib/stores/batches.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  const locationsOn = $derived(settings.value.inventory.locationsEnabled);
  const sortedLocations = $derived(locations.sortedActive());

  let fromLocationId = $state(locations.defaultId());
  let toLocationId = $state('');
  let productSearch = $state('');
  let selectedByBatch = $state<Record<string, boolean>>({});
  let qtyByBatch = $state<Record<string, number>>({});
  let onlyExpiring = $state(false);
  let notes = $state('');
  let error = $state('');

  const fromOptions = $derived(
    sortedLocations.map((l) => ({ value: l.id, label: l.name }))
  );

  const toOptions = $derived([
    { value: '', label: 'Pilih lokasi tujuan…' },
    ...sortedLocations
      .filter((l) => l.id !== fromLocationId)
      .map((l) => ({ value: l.id, label: l.name }))
  ]);

  const destinationName = $derived(
    toLocationId ? locations.getById(toLocationId)?.name ?? '' : ''
  );

  const fromName = $derived(
    fromLocationId ? locations.getById(fromLocationId)?.name ?? '' : ''
  );

  function daysUntilExpiry(expiresAt?: string): number | null {
    if (!expiresAt) return null;
    const exp = new Date(`${expiresAt}T00:00:00`);
    if (Number.isNaN(exp.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - today.getTime()) / (24 * 3600 * 1000));
  }

  function expiryHint(b: Batch): { label: string; variant: 'danger' | 'warning' } | null {
    const d = daysUntilExpiry(b.expiresAt);
    if (d === null) return null;
    if (d < 0) return { label: `−${-d}h`, variant: 'danger' };
    if (d === 0) return { label: 'Hari ini', variant: 'danger' };
    if (d <= 3) return { label: `${d}h lagi`, variant: 'warning' };
    if (d <= 7) return { label: `${d}h lagi`, variant: 'warning' };
    return null;
  }

  const sourceBatches = $derived.by(() => {
    if (!fromLocationId) return [] as Batch[];
    return batches.items
      .filter((b) => b.locationId === fromLocationId && b.qtyRemaining > 0)
      .sort((a, b) => {
        const aExp = a.expiresAt ?? '9999-12-31';
        const bExp = b.expiresAt ?? '9999-12-31';
        if (aExp !== bExp) return aExp.localeCompare(bExp);
        return a.receivedAt.localeCompare(b.receivedAt);
      });
  });

  function productLabelFor(b: Batch): string {
    const p = products.getById(b.productId);
    if (!p) return '(produk dihapus)';
    if (!b.variantId) return p.name;
    return `${p.name} — ${p.variants.find((v) => v.id === b.variantId)?.name ?? b.variantId}`;
  }

  function unitCodeFor(b: Batch): string {
    const p = products.getById(b.productId);
    if (!p) return '';
    return units.getById(p.unitId)?.code ?? '';
  }

  const filteredBatches = $derived.by(() => {
    const q = productSearch.trim().toLowerCase();
    return sourceBatches.filter((b) => {
      if (onlyExpiring) {
        const d = daysUntilExpiry(b.expiresAt);
        if (d === null || d > 7) return false;
      }
      if (!q) return true;
      const p = products.getById(b.productId);
      const variantName = b.variantId
        ? p?.variants.find((v) => v.id === b.variantId)?.name ?? ''
        : '';
      const hay = [b.code, p?.name ?? '', p?.sku ?? '', variantName].join(' ').toLowerCase();
      return hay.includes(q);
    });
  });

  // Per-row chosen unit (defaults to base). Stored as "unitId|factor".
  let unitKeyByBatch = $state<Record<string, string>>({});

  function defaultQty(batchId: string): number {
    return batches.getById(batchId)?.qtyRemaining ?? 0;
  }

  // qtyByBatch always stores BASE units. Display + input convert via factor.
  function getQty(batchId: string): number {
    return qtyByBatch[batchId] ?? defaultQty(batchId);
  }

  function unitOptionsForBatch(b: Batch): { value: string; label: string; factor: number }[] {
    const p = products.getById(b.productId);
    if (!p) return [];
    const base = units.getById(p.unitId);
    const baseCode = base?.code ?? '?';
    const opts = [
      { value: `${p.unitId}|1`, label: `${base?.name ?? '?'} (${baseCode})`, factor: 1 }
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

  function defaultUnitKeyFor(b: Batch): string {
    const p = products.getById(b.productId);
    return p ? `${p.unitId}|1` : '';
  }

  function getUnitKey(b: Batch): string {
    return unitKeyByBatch[b.id] ?? defaultUnitKeyFor(b);
  }

  function getFactor(b: Batch): number {
    const factor = Number(getUnitKey(b).split('|')[1]);
    return Number.isFinite(factor) && factor > 0 ? factor : 1;
  }

  function getChosenUnitCode(b: Batch): string {
    const unitId = getUnitKey(b).split('|')[0];
    return units.getById(unitId)?.code ?? '';
  }

  function setUnitKey(b: Batch, key: string) {
    unitKeyByBatch = { ...unitKeyByBatch, [b.id]: key };
    // Snap qty to a multiple of the new factor so display stays clean.
    const factor = Number(key.split('|')[1]) || 1;
    const cur = getQty(b.id);
    const max = b.qtyRemaining;
    const snapped = Math.min(max, Math.max(factor, Math.round(cur / factor) * factor));
    qtyByBatch = { ...qtyByBatch, [b.id]: snapped };
  }

  function qtyDisplay(b: Batch): string {
    const factor = getFactor(b);
    const v = getQty(b.id) / factor;
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2).replace(/\.?0+$/, '');
  }

  function maxDisplay(b: Batch): string {
    const factor = getFactor(b);
    const v = b.qtyRemaining / factor;
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2).replace(/\.?0+$/, '');
  }

  function setQty(b: Batch, displayValue: number) {
    const factor = getFactor(b);
    const wantBase = Math.max(1, Math.round((displayValue || 1) * factor));
    qtyByBatch = {
      ...qtyByBatch,
      [b.id]: Math.min(b.qtyRemaining, wantBase)
    };
  }

  function isSelected(batchId: string): boolean {
    return !!selectedByBatch[batchId];
  }

  function toggleSelected(batchId: string, checked: boolean) {
    selectedByBatch = { ...selectedByBatch, [batchId]: checked };
  }

  function selectAll(checked: boolean) {
    const next: Record<string, boolean> = { ...selectedByBatch };
    for (const b of filteredBatches) next[b.id] = checked;
    selectedByBatch = next;
  }

  function selectExpiring() {
    const next: Record<string, boolean> = { ...selectedByBatch };
    for (const b of filteredBatches) {
      const d = daysUntilExpiry(b.expiresAt);
      if (d !== null && d <= 7) next[b.id] = true;
    }
    selectedByBatch = next;
  }

  // Reset selection state when source location changes (different batch pool).
  let prevFromLocId: string | null = null;
  $effect(() => {
    const current = fromLocationId;
    if (prevFromLocId !== null && current !== prevFromLocId) {
      selectedByBatch = {};
      qtyByBatch = {};
      unitKeyByBatch = {};
    }
    prevFromLocId = current;
  });

  const selectedBatches = $derived(filteredBatches.filter((b) => isSelected(b.id)));
  const selectedCount = $derived(selectedBatches.length);
  const totalUnits = $derived(selectedBatches.reduce((s, b) => s + getQty(b.id), 0));

  const canSubmit = $derived(
    fromLocationId !== '' &&
      toLocationId !== '' &&
      fromLocationId !== toLocationId &&
      selectedCount > 0
  );

  function submit() {
    error = '';
    if (!fromLocationId || !toLocationId) {
      error = 'Pilih lokasi sumber dan tujuan.';
      return;
    }
    if (fromLocationId === toLocationId) {
      error = 'Lokasi sumber dan tujuan harus berbeda.';
      return;
    }
    if (selectedCount === 0) {
      error = 'Pilih minimal satu batch.';
      return;
    }
    const transferGroupId = crypto.randomUUID();
    let success = 0;
    const failures: string[] = [];
    for (const b of selectedBatches) {
      const qty = getQty(b.id);
      if (qty <= 0) continue;
      const result = batches.moveStock({
        batchId: b.id,
        toLocationId,
        qty,
        notes: notes.trim() || `Pindah massal · ${fromName} → ${destinationName}`,
        transferGroupId
      });
      if (result.ok) success++;
      else failures.push(`${b.code}: ${result.reason}`);
    }
    if (success > 0) {
      toast.success(
        `${success} batch dipindahkan`,
        `${totalUnits} unit · ${fromName} → ${destinationName}`
      );
    }
    if (failures.length > 0) {
      toast.error(`${failures.length} batch gagal`, failures[0]);
    }
    selectedByBatch = {};
    qtyByBatch = {};
    notes = '';
  }
</script>

<svelte:head>
  <title>Pindah Massal · POS Admin</title>
</svelte:head>

<PageHeader
  title="Pindah Massal"
  description="Pilih lokasi sumber, centang banyak batch sekaligus (sudah diurutkan dari yang paling cepat kedaluwarsa), kirim ke satu lokasi tujuan."
  breadcrumb={[
    { label: 'Katalog' },
    { label: 'Inventaris', href: '/inventory' },
    { label: 'Pindah Massal' }
  ]}
>
  {#snippet actions()}
    <Button variant="outline" href="/inventory/move/scan">
      <ScanLine class="h-4 w-4" />
      Mode scan
    </Button>
    <Button variant="outline" href="/inventory">
      <ArrowLeft class="h-4 w-4" />
      Kembali
    </Button>
  {/snippet}
</PageHeader>

{#if !locationsOn}
  <Card>
    <div class="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle class="h-10 w-10 text-amber-500" />
      <p class="text-base font-semibold text-slate-900">Manajemen lokasi belum diaktifkan</p>
      <p class="max-w-md text-sm text-slate-600">
        Aktifkan toggle "Manajemen lokasi penyimpanan" di
        <a href="/settings" class="font-medium text-brand-700 hover:underline">Pengaturan</a>.
      </p>
    </div>
  </Card>
{:else}
  <div class="grid gap-4 lg:grid-cols-[1fr_360px]">
    <div class="space-y-4">
      <!-- From/To locations -->
      <Card>
        <h2 class="mb-3 text-sm font-semibold text-slate-900">Sumber dan tujuan</h2>
        <div class="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <Select label="Dari" bind:value={fromLocationId} options={fromOptions} />
          <div class="hidden pb-2 text-slate-400 sm:block">
            <ArrowLeftRight class="h-5 w-5" />
          </div>
          <Select label="Ke" bind:value={toLocationId} options={toOptions} />
        </div>
      </Card>

      <!-- Batch picker -->
      <Card padded={false}>
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 class="mr-2 text-sm font-semibold text-slate-900">
            Pilih batch dari <span class="font-bold">{fromName || '—'}</span>
          </h2>
          <div class="ml-auto inline-flex items-center gap-1">
            <Button variant="outline" size="sm" onclick={() => selectAll(true)}>
              <CheckSquare class="h-3.5 w-3.5" />
              Pilih semua
            </Button>
            <Button variant="outline" size="sm" onclick={selectExpiring}>
              <AlertTriangle class="h-3.5 w-3.5" />
              Yang mendekati kedaluwarsa
            </Button>
            <Button variant="outline" size="sm" onclick={() => selectAll(false)}>
              <Square class="h-3.5 w-3.5" />
              Bersihkan
            </Button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <div class="min-w-[240px] flex-1">
            <Input placeholder="Cari produk, varian, atau kode batch…" bind:value={productSearch}>
              {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
            </Input>
          </div>
          <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
              bind:checked={onlyExpiring}
            />
            <span>Hanya yang kedaluwarsa ≤7 hari</span>
          </label>
        </div>

        <div class="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
          {#each filteredBatches as b (b.id)}
            {@const exp = expiryHint(b)}
            {@const sel = isSelected(b.id)}
            {@const baseUCode = unitCodeFor(b)}
            {@const opts = unitOptionsForBatch(b)}
            {@const factor = getFactor(b)}
            {@const chosenCode = getChosenUnitCode(b)}
            <label
              class="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
            >
              <span class="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={sel}
                  onchange={(e) => toggleSelected(b.id, (e.currentTarget as HTMLInputElement).checked)}
                  class="peer absolute inset-0 h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white transition checked:border-brand-600 checked:bg-brand-600 hover:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                />
                <Check
                  class="pointer-events-none h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
                  strokeWidth={3}
                />
              </span>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <code class="font-mono text-xs font-medium text-slate-800">{b.code}</code>
                  {#if exp}
                    <Badge variant={exp.variant} size="sm">
                      <AlertTriangle class="mr-0.5 h-3 w-3" />
                      {exp.label}
                    </Badge>
                  {/if}
                  {#if b.expiresAt}
                    <span class="text-[10px] text-slate-500">{b.expiresAt}</span>
                  {/if}
                  {#if b.ownership === 'consignment'}
                    <Badge variant="info" size="sm">Konsinyasi</Badge>
                  {/if}
                </div>
                <div class="mt-0.5 truncate text-sm text-slate-800">
                  {productLabelFor(b)}
                </div>
                <div class="text-[10px] text-slate-500">
                  Sisa: <span class="font-medium text-slate-700">{b.qtyRemaining}</span>{#if baseUCode}<span class="ml-0.5 text-slate-400">{baseUCode}</span>{/if} · Diterima: {b.receivedAt}
                </div>
              </div>

              <div class="flex flex-col items-end gap-0.5">
                <div class="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    step={factor > 1 ? 'any' : '1'}
                    value={qtyDisplay(b)}
                    disabled={!sel}
                    oninput={(e) => setQty(b, Number((e.currentTarget as HTMLInputElement).value))}
                    class="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-right text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  {#if opts.length > 1}
                    <select
                      value={getUnitKey(b)}
                      disabled={!sel}
                      onchange={(e) =>
                        setUnitKey(b, (e.currentTarget as HTMLSelectElement).value)}
                      class="rounded-md border border-slate-200 bg-white py-1 pr-6 pl-2 text-xs focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                      title="Satuan"
                    >
                      {#each opts as o (o.value)}
                        <option value={o.value}>{o.label}</option>
                      {/each}
                    </select>
                  {:else if chosenCode}
                    <span class="text-[10px] whitespace-nowrap text-slate-400">{chosenCode}</span>
                  {/if}
                </div>
                {#if factor > 1 && sel}
                  <span class="text-[10px] text-slate-500">
                    = <span class="font-medium text-slate-700">{getQty(b.id)}</span> {baseUCode}
                    <span class="text-slate-400">/ max {maxDisplay(b)} {chosenCode}</span>
                  </span>
                {/if}
              </div>
            </label>
          {/each}

          {#if filteredBatches.length === 0}
            <div class="flex flex-col items-center gap-2 py-12 text-center">
              <Layers class="h-10 w-10 text-slate-300" />
              <p class="text-sm font-medium text-slate-600">
                {fromLocationId ? 'Tidak ada batch yang cocok' : 'Pilih lokasi sumber dulu'}
              </p>
              <p class="max-w-sm text-xs text-slate-400">
                {fromLocationId
                  ? 'Sesuaikan pencarian atau filter, atau pilih lokasi sumber lain.'
                  : 'Setelah memilih lokasi sumber, daftar batch akan muncul di sini.'}
              </p>
            </div>
          {/if}
        </div>
      </Card>

      <!-- Notes -->
      <Card>
        <Textarea
          label="Catatan (opsional)"
          placeholder="mis. Refill etalase mingguan, audit kedaluwarsa, dll."
          bind:value={notes}
        />
      </Card>
    </div>

    <!-- Summary -->
    <div class="lg:sticky lg:top-4 lg:self-start">
      <Card>
        <h3 class="mb-3 text-sm font-semibold text-slate-900">Ringkasan pemindahan</h3>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Dari</dt>
            <dd class="font-medium text-slate-900">{fromName || '—'}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Ke</dt>
            <dd>
              {#if destinationName}
                <span class="font-medium text-slate-900">{destinationName}</span>
              {:else}
                <span class="text-slate-400">Belum dipilih</span>
              {/if}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Batch dipilih</dt>
            <dd class="font-medium text-slate-900">{selectedCount}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Total unit</dt>
            <dd class="font-semibold text-slate-900">{totalUnits}</dd>
          </div>
        </dl>

        <Button class="mt-4 w-full" size="lg" onclick={submit} disabled={!canSubmit}>
          <ArrowLeftRight class="h-4 w-4" />
          Pindahkan {totalUnits} unit
        </Button>

        {#if error}
          <p class="mt-2 text-xs text-rose-600">{error}</p>
        {/if}
        <p class="mt-2 text-[11px] text-slate-500">
          Semua batch terpindah dalam satu transfer dan tercatat sebagai grup yang sama di Riwayat Stok.
        </p>
      </Card>
    </div>
  </div>
{/if}
