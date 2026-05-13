<script lang="ts">
  import {
    Search,
    Boxes,
    Package,
    PackageSearch,
    SlidersHorizontal,
    Receipt,
    Truck,
    Plus,
    Minus,
    Printer,
    AlertTriangle
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import {
    Badge,
    Button,
    Card,
    Input,
    Modal,
    MoneyInput,
    PageHeader,
    Select,
    Table,
    Textarea,
    Toggle
  } from '$lib/components/ui';
  import {
    isComposite,
    products,
    totalStock,
    type Product,
    type ProductVariant
  } from '$lib/stores/products.svelte';
  import {
    batches,
    currentCost,
    stockBreakdown,
    stockOf
  } from '$lib/stores/batches.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { purchaseOrders } from '$lib/stores/purchaseOrders.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  let search = $state('');
  let categoryFilter = $state('');
  let lowStockOnly = $state(false);

  const categoryOptions = $derived([
    { value: '', label: 'Semua kategori' },
    ...categories.items.map((c) => ({ value: c.id, label: c.name }))
  ]);

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return products.items.filter((p) => {
      if (p.status !== 'active') return false;
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      const total = totalStock(p);
      if (lowStockOnly && total >= 10) return false;
      if (!q) return true;
      const hay = [
        p.name,
        p.sku,
        ...p.variants.map((v) => `${v.name} ${v.sku}`)
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  function unitFor(id: string) {
    return units.getById(id);
  }

  function categoryFor(id: string) {
    return categories.getById(id);
  }

  function stockBadge(qty: number) {
    if (qty === 0) return { variant: 'danger' as const, label: 'Habis' };
    if (qty < 10) return { variant: 'warning' as const, label: 'Menipis' };
    return { variant: 'success' as const, label: 'Aman' };
  }

  const EXPIRY_WARNING_DAYS = 7;

  function daysUntilExpiry(expiresAt?: string): number | null {
    if (!expiresAt) return null;
    const exp = new Date(`${expiresAt}T00:00:00`);
    if (Number.isNaN(exp.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - today.getTime()) / (24 * 3600 * 1000));
  }

  function expiringSoonSummary(
    p: Product
  ): { count: number; minDays: number } | null {
    const days: number[] = [];
    for (const b of batches.forProduct(p.id)) {
      if (b.qtyRemaining <= 0) continue;
      const d = daysUntilExpiry(b.expiresAt);
      if (d === null) continue;
      if (d <= EXPIRY_WARNING_DAYS) days.push(d);
    }
    if (days.length === 0) return null;
    return { count: days.length, minDays: Math.min(...days) };
  }

  function expirySoonLabel(s: { count: number; minDays: number }): string {
    if (s.minDays < 0)
      return s.count === 1
        ? '1 batch sudah kedaluwarsa'
        : `${s.count} batch sudah kedaluwarsa`;
    if (s.minDays === 0)
      return s.count === 1
        ? '1 batch kedaluwarsa hari ini'
        : `${s.count} batch kedaluwarsa hari ini`;
    return s.count === 1
      ? `1 batch kedaluwarsa ≤ ${s.minDays} hari`
      : `${s.count} batch kedaluwarsa ≤ ${s.minDays} hari`;
  }

  // For each packaging defined on a product, compute how many *whole* packagings
  // the current base-unit stock fills, plus the leftover in base units.
  // Used to spell out conversions on each inventory row.
  function packagingBreakdown(
    p: Product
  ): { name: string; code: string; qty: number; remainder: number; factor: number }[] {
    if (p.units.length === 0) return [];
    const base = totalStock(p);
    const out: { name: string; code: string; qty: number; remainder: number; factor: number }[] = [];
    for (const pack of p.units) {
      const u = units.getById(pack.unitId);
      if (!u || pack.factor <= 0) continue;
      const qty = Math.floor(base / pack.factor);
      const remainder = base - qty * pack.factor;
      out.push({ name: u.name, code: u.code, qty, remainder, factor: pack.factor });
    }
    return out;
  }

  const columns = [
    { key: 'name' as const, label: 'Produk' },
    { key: 'categoryId' as const, label: 'Kategori', width: '140px' },
    { key: 'stock' as const, label: 'Stok', align: 'right' as const, width: '280px' },
    { key: 'status' as const, label: 'Status', width: '100px' },
    { key: 'id' as const, label: '', align: 'right' as const, width: '200px' }
  ];

  // ───── Batches inspection modal ─────
  let batchesOpen = $state(false);
  let inspectProduct = $state<Product | null>(null);

  function openBatches(p: Product) {
    inspectProduct = p;
    batchesOpen = true;
  }

  const inspectBatches = $derived(
    inspectProduct ? batches.forProduct(inspectProduct.id) : []
  );

  const inspectBreakdown = $derived.by(() => {
    if (!inspectProduct) return { owned: 0, consignment: 0, total: 0, active: 0, depleted: 0 };
    let owned = 0;
    let consignment = 0;
    let active = 0;
    let depleted = 0;
    for (const b of inspectBatches) {
      if (b.qtyRemaining > 0) {
        active++;
        if (b.ownership === 'owned') owned += b.qtyRemaining;
        else consignment += b.qtyRemaining;
      } else {
        depleted++;
      }
    }
    return { owned, consignment, total: owned + consignment, active, depleted };
  });

  const batchColumns = [
    { key: 'code', label: 'Kode', width: '130px' },
    { key: 'variant', label: 'Varian' },
    { key: 'ownership', label: 'Kepemilikan' },
    { key: 'qtyReceived', label: 'Diterima', align: 'right' as const, width: '90px' },
    { key: 'qtyRemaining', label: 'Sisa', align: 'right' as const, width: '90px' },
    { key: 'unitCost', label: 'Harga satuan', align: 'right' as const, width: '120px' },
    { key: 'supplierId', label: 'Pemasok' },
    { key: 'receivedAt', label: 'Diterima' },
    { key: 'expiresAt', label: 'Kedaluwarsa' },
    { key: 'sourcePurchaseOrderId', label: 'PO Asal' },
    { key: 'actions', label: '', align: 'right' as const, width: '60px' }
  ];

  function variantNameFor(productId: string, variantId?: string): string {
    if (!variantId) return '—';
    const p = products.getById(productId);
    return p?.variants.find((v) => v.id === variantId)?.name ?? variantId;
  }

  function poCode(id?: string): string {
    if (!id) return '';
    return purchaseOrders.getById(id)?.code ?? id;
  }

  // ───── Stock Adjustment dialog ─────
  type AdjustMode = 'add' | 'subtract';

  let adjustOpen = $state(false);
  let adjustProduct = $state<Product | null>(null);
  let adjustVariantId = $state<string>('');
  let adjustUnitKey = $state<string>('');     // `unitId|factor`
  let adjustMode = $state<AdjustMode>('add');
  let adjustQty = $state<number>(0);          // positive magnitude in the chosen unit
  let adjustUnitCost = $state<number>(0);     // per the chosen unit (not per base unit)
  let adjustOverridePrice = $state(false);    // true once the user reveals the price field
  let adjustExpiresAt = $state<string>('');   // ISO date, only when product.requiresExpiration
  let adjustNotes = $state<string>('');
  let adjustError = $state<string>('');

  const adjustVariantOptions = $derived(
    adjustProduct?.variants.map((v) => ({ value: v.id, label: v.name })) ?? []
  );

  // Base unit + each packaging unit. Encoded as `unitId|factor`.
  function unitOptionsFor(p: Product): { value: string; label: string; factor: number }[] {
    const baseUnit = units.getById(p.unitId);
    const baseCode = baseUnit?.code ?? '?';
    const opts = [
      {
        value: `${p.unitId}|1`,
        label: `${baseUnit?.name ?? '?'} (${baseCode})`,
        factor: 1
      }
    ];
    for (const pack of p.units) {
      const u = units.getById(pack.unitId);
      if (!u) continue;
      opts.push({
        value: `${pack.unitId}|${pack.factor}`,
        label: `${u.name} — 1 = ${pack.factor} ${baseCode}`,
        factor: pack.factor
      });
    }
    return opts;
  }

  const adjustUnitOpts = $derived(adjustProduct ? unitOptionsFor(adjustProduct) : []);

  const adjustUnitFactor = $derived(
    adjustUnitOpts.find((o) => o.value === adjustUnitKey)?.factor ?? 1
  );

  const adjustBaseUnitCode = $derived(
    adjustProduct ? unitFor(adjustProduct.unitId)?.code ?? '' : ''
  );

  // stockOf returns base units; convert for the chosen unit display.
  const adjustCurrentStockBase = $derived(
    adjustProduct ? stockOf(adjustProduct.id, adjustVariantId || undefined) : 0
  );

  const adjustBaseDelta = $derived(
    (adjustMode === 'subtract' ? -1 : 1) * adjustQty * adjustUnitFactor
  );

  function openAdjust(p: Product) {
    adjustProduct = p;
    adjustVariantId = p.variants.length > 0 ? p.variants[0].id : '';
    adjustUnitKey = `${p.unitId}|1`;
    adjustMode = 'add';
    adjustQty = 0;
    adjustUnitCost = currentCost(p.id, p.variants.length > 0 ? p.variants[0].id : undefined);
    adjustOverridePrice = false;
    adjustExpiresAt = '';
    adjustNotes = '';
    adjustError = '';
    adjustOpen = true;
  }

  function onAdjustVariantChange() {
    if (!adjustProduct) return;
    // unit cost stays per-chosen-unit: per-base cost × current factor
    const perBase = currentCost(adjustProduct.id, adjustVariantId || undefined);
    adjustUnitCost = perBase * adjustUnitFactor;
  }

  function onAdjustUnitChange() {
    if (!adjustProduct) return;
    // re-anchor unit cost to the new unit (per-base × new factor)
    const perBase = currentCost(adjustProduct.id, adjustVariantId || undefined);
    adjustUnitCost = perBase * adjustUnitFactor;
  }

  function saveAdjust() {
    adjustError = '';
    if (!adjustProduct) {
      adjustError = 'Produk tidak valid.';
      return;
    }
    if (!Number.isFinite(adjustQty) || adjustQty <= 0) {
      adjustError = 'Jumlah harus lebih besar dari 0.';
      return;
    }
    if (adjustMode === 'add' && (!Number.isFinite(adjustUnitCost) || adjustUnitCost < 0)) {
      adjustError = 'Harga satuan harus 0 atau lebih.';
      return;
    }
    if (adjustMode === 'add' && adjustProduct.requiresExpiration && !adjustExpiresAt) {
      adjustError = 'Tanggal kedaluwarsa wajib diisi untuk produk ini.';
      return;
    }
    const baseDelta = adjustBaseDelta;
    if (adjustMode === 'subtract' && adjustQty * adjustUnitFactor > adjustCurrentStockBase) {
      adjustError = `Stok saat ini hanya ${adjustCurrentStockBase} ${adjustBaseUnitCode}. Tidak bisa kurangi lebih dari itu.`;
      return;
    }
    const baseUnitCost =
      adjustUnitFactor > 0 ? adjustUnitCost / adjustUnitFactor : adjustUnitCost;
    const newBatch = batches.adjustStock({
      productId: adjustProduct.id,
      variantId: adjustVariantId || undefined,
      delta: baseDelta,
      unitCost: baseUnitCost,
      expiresAt: adjustMode === 'add' ? adjustExpiresAt || undefined : undefined,
      notes: adjustNotes.trim() || 'Penyesuaian stok manual.'
    });
    const label = adjustVariantId
      ? `${adjustProduct.name} — ${variantNameFor(adjustProduct.id, adjustVariantId)}`
      : adjustProduct.name;
    const sign = baseDelta > 0 ? '+' : '';
    toast.success(
      'Stok disesuaikan',
      `${sign}${baseDelta} ${adjustBaseUnitCode} · ${label}`
    );
    adjustOpen = false;

    // Auto-jump to label print for products that need batch labels.
    if (adjustMode === 'add' && adjustProduct.requiresBatchLabel && newBatch) {
      goto(`/inventory/batches/${newBatch.id}/label`);
    }
  }
</script>

<svelte:head>
  <title>Inventaris · POS Admin</title>
</svelte:head>

<PageHeader
  title="Inventaris"
  description="Stok per produk, rincian batch, dan penyesuaian manual."
  breadcrumb={[{ label: 'Katalog' }, { label: 'Inventaris' }]}
/>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[240px] flex-1">
      <Input placeholder="Cari produk berdasarkan nama, SKU, atau varian…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={categoryFilter} options={categoryOptions} class="w-44" />
    <div class="ml-1 flex items-center gap-2 text-sm text-slate-600">
      <Toggle bind:checked={lowStockOnly} />
      <span>Hanya stok menipis</span>
    </div>
  </div>

  <Table {columns} rows={filtered} rowKey={(p) => p.id}>
    {#snippet cell({ row, column })}
      {#if column.key === 'name'}
        <div class="flex items-center gap-3">
          {#if row.imageUrl}
            <img
              src={row.imageUrl}
              alt={row.name}
              class="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
              loading="lazy"
            />
          {:else}
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400"
            >
              <Package class="h-4 w-4" />
            </div>
          {/if}
          <div class="min-w-0">
            <div class="truncate font-medium text-slate-900">{row.name}</div>
            <code class="font-mono text-xs text-slate-500">{row.sku}</code>
          </div>
        </div>
      {:else if column.key === 'categoryId'}
        {@const cat = categoryFor(row.categoryId)}
        {#if cat}
          <Badge variant={cat.color} dot>{cat.name}</Badge>
        {:else}
          <span class="text-xs text-slate-400">—</span>
        {/if}
      {:else if column.key === 'stock'}
        {@const total = totalStock(row)}
        {@const breakdown = isComposite(row) ? null : stockBreakdown(row.id)}
        {@const u = unitFor(row.unitId)}
        {@const packs = packagingBreakdown(row)}
        {@const expSoon = expiringSoonSummary(row)}
        <div class="text-right">
          <div title="Total stok dalam satuan dasar">
            <span class="text-base font-semibold text-slate-900">{total}</span>
            <span class="ml-0.5 text-xs font-normal text-slate-500">
              {u?.name ?? u?.code ?? ''}
            </span>
          </div>

          {#if packs.length > 0}
            <div class="mt-1.5">
              <div class="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Setara dengan
              </div>
              <ul class="mt-0.5 space-y-0.5 text-xs">
                {#each packs as pk}
                  <li class="text-slate-600">
                    <span class="font-medium text-slate-800">{pk.qty}</span>
                    {pk.name}
                    <span class="text-[10px] text-slate-400">(isi {pk.factor} {u?.code ?? ''})</span>
                    {#if pk.remainder > 0}
                      <span class="text-[10px] text-amber-600">
                        + sisa {pk.remainder} {u?.code ?? ''}
                      </span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if breakdown && (breakdown.owned > 0 || breakdown.consignment > 0)}
            <div class="mt-1.5">
              <div class="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Asal stok
              </div>
              <ul class="mt-0.5 space-y-0.5 text-xs">
                <li class="text-slate-600">
                  <span class="font-medium text-slate-800">{breakdown.owned}</span>
                  milik sendiri
                </li>
                {#if breakdown.consignment > 0}
                  <li class="text-sky-700">
                    <span class="font-medium">{breakdown.consignment}</span>
                    dari konsinyasi
                  </li>
                {/if}
              </ul>
            </div>
          {/if}
          {#if expSoon}
            <div class="mt-1.5 inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
              <AlertTriangle class="h-3 w-3" />
              {expirySoonLabel(expSoon)}
            </div>
          {/if}
        </div>
      {:else if column.key === 'status'}
        {@const total = totalStock(row)}
        {@const sb = stockBadge(total)}
        <Badge variant={sb.variant} size="sm">{sb.label}</Badge>
      {:else if column.key === 'id'}
        <div class="flex items-center justify-end gap-1.5">
          {#if !isComposite(row)}
            <Button size="sm" variant="outline" onclick={() => openAdjust(row)}>
              <SlidersHorizontal class="h-3.5 w-3.5" />
              Atur stok
            </Button>
          {/if}
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Lihat batch"
            title="Lihat batch"
            onclick={() => openBatches(row)}
          >
            <PackageSearch class="h-4 w-4" />
          </button>
        </div>
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-1.5 py-8">
        <Boxes class="h-8 w-8 text-slate-300" />
        <p class="text-sm font-medium text-slate-600">Tidak ada produk yang cocok</p>
        <p class="text-xs text-slate-400">Sesuaikan filter atau bersihkan pencarian.</p>
      </div>
    {/snippet}
  </Table>
</Card>

<Modal
  bind:open={batchesOpen}
  size="2xl"
  title="Batch stok{inspectProduct ? ` · ${inspectProduct.name}` : ''}"
  description="Setiap kuantitas yang diterima menjadi batch tersendiri dengan biaya, pemasok, dan PO asal-nya. Penjualan FIFO mengurangi batch tertua terlebih dahulu."
>
  {#if inspectProduct}
    <div class="mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
      <div class="flex items-baseline gap-1.5">
        <span class="text-slate-500">Tersedia:</span>
        <span class="text-base font-semibold text-slate-900">{inspectBreakdown.total}</span>
        <span class="text-xs text-slate-400">{unitFor(inspectProduct.unitId)?.code ?? ''}</span>
      </div>
      <span class="text-slate-300">·</span>
      <div class="flex items-baseline gap-1.5 text-sm">
        <Badge variant="neutral" size="sm">Milik sendiri</Badge>
        <span class="font-medium text-slate-900">{inspectBreakdown.owned}</span>
      </div>
      <div class="flex items-baseline gap-1.5 text-sm">
        <Badge variant="info" size="sm">Konsinyasi</Badge>
        <span class="font-medium text-slate-900">{inspectBreakdown.consignment}</span>
      </div>
      <span class="ml-auto text-xs text-slate-500">
        {inspectBreakdown.active} aktif · {inspectBreakdown.depleted} habis
      </span>
    </div>

    <Table columns={batchColumns} rows={inspectBatches} rowKey={(b) => b.id}>
      {#snippet cell({ row, column })}
        {#if column.key === 'code'}
          <span class="font-mono text-xs font-medium text-slate-800">{row.code}</span>
        {:else if column.key === 'variant'}
          {#if row.variantId}
            <span class="text-slate-700">{variantNameFor(row.productId, row.variantId)}</span>
          {:else}
            <span class="text-xs text-slate-400">—</span>
          {/if}
        {:else if column.key === 'ownership'}
          <Badge variant={row.ownership === 'consignment' ? 'info' : 'neutral'} size="sm">
            {row.ownership === 'consignment' ? 'Konsinyasi' : 'Milik sendiri'}
          </Badge>
        {:else if column.key === 'qtyReceived'}
          <span class="text-slate-600">{row.qtyReceived}</span>
        {:else if column.key === 'qtyRemaining'}
          <span class="font-medium {row.qtyRemaining === 0 ? 'text-slate-400' : 'text-slate-900'}">
            {row.qtyRemaining}
          </span>
        {:else if column.key === 'unitCost'}
          <span class="text-slate-600">{formatRupiah(row.unitCost)}</span>
        {:else if column.key === 'supplierId'}
          {#if row.supplierId}
            <div class="flex items-center gap-1.5 text-slate-700">
              <Truck class="h-3.5 w-3.5 text-slate-400" />
              {suppliers.getById(row.supplierId)?.name ?? row.supplierId}
            </div>
          {:else}
            <span class="text-xs text-slate-400">—</span>
          {/if}
        {:else if column.key === 'receivedAt'}
          <span class="text-slate-600">{row.receivedAt}</span>
        {:else if column.key === 'expiresAt'}
          {#if row.expiresAt}
            {@const days = daysUntilExpiry(row.expiresAt)}
            <div class="flex flex-col items-start gap-0.5">
              <span class={days !== null && days <= EXPIRY_WARNING_DAYS ? 'font-medium text-rose-700' : 'text-slate-700'}>
                {row.expiresAt}
              </span>
              {#if days !== null && days <= EXPIRY_WARNING_DAYS}
                <span class="text-[10px] font-semibold text-rose-700">
                  {days < 0 ? `sudah kedaluwarsa ${-days} hari lalu` : days === 0 ? 'hari ini' : `${days} hari lagi`}
                </span>
              {/if}
            </div>
          {:else}
            <span class="text-xs text-slate-400">—</span>
          {/if}
        {:else if column.key === 'sourcePurchaseOrderId'}
          {#if row.sourcePurchaseOrderId}
            <a
              href="/purchase-orders/{row.sourcePurchaseOrderId}"
              class="inline-flex items-center gap-1 font-mono text-xs text-brand-700 hover:underline"
            >
              <Receipt class="h-3 w-3" />
              {poCode(row.sourcePurchaseOrderId)}
            </a>
          {:else}
            <span class="text-xs text-slate-400">—</span>
          {/if}
        {:else if column.key === 'actions'}
          <a
            href="/inventory/batches/{row.id}/label"
            class="inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cetak label"
            title="Cetak label"
          >
            <Printer class="h-4 w-4" />
          </a>
        {/if}
      {/snippet}

      {#snippet empty()}
        <div class="flex flex-col items-center gap-1.5 py-6">
          <p class="text-sm font-medium text-slate-600">Belum ada batch untuk produk ini</p>
          <p class="text-xs text-slate-400">Terima PO atau atur stok untuk membuat batch pertama.</p>
        </div>
      {/snippet}
    </Table>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (batchesOpen = false)}>Tutup</Button>
  {/snippet}
</Modal>

<Modal
  bind:open={adjustOpen}
  size="md"
  title="Atur stok{adjustProduct ? ` · ${adjustProduct.name}` : ''}"
  description="Penambahan stok membuat batch milik sendiri baru. Pengurangan stok mengurangi batch milik sendiri (LIFO, terbaru lebih dulu) sehingga urutan FIFO penjualan tetap terjaga."
>
  {#if adjustProduct}
    <div class="grid gap-4">
      {#if adjustVariantOptions.length > 0}
        <Select
          label="Varian"
          bind:value={adjustVariantId}
          options={adjustVariantOptions}
          onchange={onAdjustVariantChange}
        />
      {/if}

      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <span class="text-slate-500">Stok saat ini:</span>
        <span class="ml-1.5 font-semibold text-slate-900">{adjustCurrentStockBase}</span>
        <span class="ml-1 text-xs text-slate-400">{adjustBaseUnitCode}</span>
        {#if adjustUnitFactor > 1}
          {@const chosenQty = Math.floor(adjustCurrentStockBase / adjustUnitFactor)}
          {@const chosenRemainder = adjustCurrentStockBase - chosenQty * adjustUnitFactor}
          {@const chosenCode = units.getById(adjustUnitKey.split('|')[0])?.code ?? ''}
          <span class="ml-2 text-xs text-slate-500">
            = <span class="font-medium text-slate-700">{chosenQty}</span> {chosenCode}{#if chosenRemainder > 0}
              <span class="text-slate-400"> + {chosenRemainder} {adjustBaseUnitCode}</span>
            {/if}
          </span>
        {/if}
      </div>

      {#if adjustUnitOpts.length > 1}
        <Select
          label="Satuan untuk penyesuaian"
          bind:value={adjustUnitKey}
          options={adjustUnitOpts.map((o) => ({ value: o.value, label: o.label }))}
          onchange={onAdjustUnitChange}
        />
      {/if}

      <div>
        <span class="mb-1.5 block text-sm font-medium text-slate-700">Jenis penyesuaian</span>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors
              {adjustMode === 'add'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
            onclick={() => (adjustMode = 'add')}
          >
            <Plus class="h-4 w-4" />
            Tambah stok
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors
              {adjustMode === 'subtract'
              ? 'border-rose-300 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
            onclick={() => (adjustMode = 'subtract')}
          >
            <Minus class="h-4 w-4" />
            Kurangi stok
          </button>
        </div>
      </div>

      <Input
        label="Jumlah"
        type="number"
        step="1"
        min="0"
        bind:value={adjustQty}
        hint={adjustQty <= 0
          ? 'Masukkan jumlah yang ingin ditambah atau dikurangi.'
          : adjustUnitFactor === 1
            ? adjustMode === 'add'
              ? `Stok bertambah ${adjustQty} ${adjustBaseUnitCode} → menjadi ${adjustCurrentStockBase + adjustBaseDelta}`
              : `Stok berkurang ${adjustQty} ${adjustBaseUnitCode} → menjadi ${adjustCurrentStockBase + adjustBaseDelta}`
            : adjustMode === 'add'
              ? `${adjustQty} × ${adjustUnitFactor} = ${adjustQty * adjustUnitFactor} ${adjustBaseUnitCode} ditambahkan → menjadi ${adjustCurrentStockBase + adjustBaseDelta}`
              : `${adjustQty} × ${adjustUnitFactor} = ${adjustQty * adjustUnitFactor} ${adjustBaseUnitCode} dikurangi → menjadi ${adjustCurrentStockBase + adjustBaseDelta}`}
      />

      {#if adjustMode === 'add' && adjustProduct.requiresExpiration}
        <Input
          label="Tanggal kedaluwarsa"
          type="date"
          bind:value={adjustExpiresAt}
          hint="Produk ini memerlukan tanggal kedaluwarsa. Penjualan FIFO akan memprioritaskan batch yang lebih cepat kedaluwarsa."
        />
      {/if}

      {#if adjustMode === 'add'}
        {#if !adjustOverridePrice}
          <div class="flex items-center justify-between rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-xs">
            <div class="text-slate-600">
              Harga beli otomatis pakai biaya aktual:
              <span class="ml-1 font-semibold text-slate-800">
                {formatRupiah(adjustUnitFactor > 0 ? adjustUnitCost / adjustUnitFactor : adjustUnitCost)}
              </span>
              <span class="text-slate-400">per {adjustBaseUnitCode}</span>
            </div>
            <button
              type="button"
              class="text-xs font-medium text-brand-600 hover:text-brand-700"
              onclick={() => (adjustOverridePrice = true)}
            >
              Sesuaikan harga
            </button>
          </div>
        {:else}
          <MoneyInput
            label="Harga beli per satuan"
            bind:value={adjustUnitCost}
            hint={adjustUnitFactor === 1
              ? 'Biaya per satuan untuk batch baru.'
              : `Biaya per satuan yang dipilih. Per ${adjustBaseUnitCode} = ${formatRupiah(adjustUnitFactor > 0 ? adjustUnitCost / adjustUnitFactor : 0)}.`}
          />
        {/if}
      {/if}

      <Textarea
        label="Alasan"
        placeholder="mis. stok opname, barang rusak, found stock, dll."
        bind:value={adjustNotes}
      />

      {#if adjustError}
        <p class="text-sm text-rose-600">{adjustError}</p>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (adjustOpen = false)}>Batal</Button>
    <Button onclick={saveAdjust}>Simpan penyesuaian</Button>
  {/snippet}
</Modal>
