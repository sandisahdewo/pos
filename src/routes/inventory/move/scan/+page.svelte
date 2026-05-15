<script lang="ts">
  import {
    ArrowLeft,
    ScanLine,
    AlertCircle,
    AlertTriangle,
    Trash2,
    Plus,
    Minus,
    ArrowLeftRight,
    Layers,
    Check
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';
  import {
    Badge,
    Button,
    Card,
    Input,
    PageHeader,
    Select,
    Textarea
  } from '$lib/components/ui';
  import { batches } from '$lib/stores/batches.svelte';
  import { products } from '$lib/stores/products.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  const locationsOn = $derived(settings.value.inventory.locationsEnabled);
  const sortedLocations = $derived(locations.sortedActive());

  type BasketItem = {
    id: string;
    batchId: string;
    qty: number;          // always stored in BASE units; display converts via factor
    unitKey: string;       // "unitId|factor" — defaults to base, admin can switch to packaging
    // snapshots for display:
    productId: string;
    batchCode: string;
    productName: string;
    variantName: string;
    fromLocationId: string;
    fromLocationName: string;
    available: number;     // base units
    unitCode: string;      // base unit code
    expiresAt?: string;
  };

  let toLocationId = $state('');
  let scanInput = $state('');
  let scanError = $state('');
  let lastScannedId = $state<string | null>(null);
  let notes = $state('');
  let basket = $state<BasketItem[]>([]);
  let inputEl: HTMLInputElement | null = $state(null);

  const destinationOptions = $derived([
    { value: '', label: 'Pilih lokasi tujuan…' },
    ...sortedLocations.map((l) => ({ value: l.id, label: l.name }))
  ]);

  const destinationName = $derived(
    toLocationId ? locations.getById(toLocationId)?.name ?? '' : ''
  );

  function daysUntilExpiry(expiresAt?: string): number | null {
    if (!expiresAt) return null;
    const exp = new Date(`${expiresAt}T00:00:00`);
    if (Number.isNaN(exp.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - today.getTime()) / (24 * 3600 * 1000));
  }

  function expiryHint(expiresAt?: string): { label: string; variant: 'danger' | 'warning' } | null {
    const d = daysUntilExpiry(expiresAt);
    if (d === null) return null;
    if (d < 0) return { label: `Kedaluwarsa ${-d} hari lalu`, variant: 'danger' };
    if (d === 0) return { label: 'Kedaluwarsa hari ini', variant: 'danger' };
    if (d <= 3) return { label: `Kedaluwarsa ${d} hari lagi`, variant: 'warning' };
    if (d <= 7) return { label: `Kedaluwarsa ${d} hari lagi`, variant: 'warning' };
    return null;
  }

  // Resolve a scanned token to a specific source batch.
  // Priority: batch code → variant SKU → product SKU (only for products without variants).
  function resolveToken(token: string): { batchId: string } | { error: string } {
    const t = token.trim();
    if (!t) return { error: 'Kode kosong.' };

    const byBatch = batches.getByCode(t);
    if (byBatch) {
      if (byBatch.qtyRemaining <= 0) return { error: `Batch ${byBatch.code} sudah habis.` };
      return { batchId: byBatch.id };
    }

    const lower = t.toLowerCase();
    for (const p of products.items) {
      if (p.status !== 'active' || p.kind === 'composite') continue;
      for (const v of p.variants) {
        if (v.sku.toLowerCase() === lower) {
          const best = batches.forStock(p.id, v.id)[0];
          if (!best) return { error: `Tidak ada stok untuk varian ${v.name}.` };
          return { batchId: best.id };
        }
      }
    }

    for (const p of products.items) {
      if (p.status !== 'active' || p.kind === 'composite') continue;
      if (p.sku.toLowerCase() !== lower) continue;
      if (p.variants.length > 0)
        return {
          error: `${p.name} punya varian — pindai SKU varian atau kode batch, bukan SKU induk.`
        };
      const best = batches.forStock(p.id)[0];
      if (!best) return { error: `Tidak ada stok untuk ${p.name}.` };
      return { batchId: best.id };
    }

    return { error: 'Kode tidak dikenali. Pindai kode batch (BATCH-YYYY-NNN) atau SKU produk/varian.' };
  }

  async function handleScan(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const result = resolveToken(scanInput);
    if ('error' in result) {
      scanError = result.error;
      return;
    }
    addToBasket(result.batchId);
    scanInput = '';
    await tick();
    inputEl?.focus();
  }

  function addToBasket(batchId: string) {
    scanError = '';
    const batch = batches.getById(batchId);
    if (!batch) {
      scanError = 'Batch tidak ditemukan.';
      return;
    }
    if (toLocationId && batch.locationId === toLocationId) {
      scanError = `Batch ${batch.code} sudah berada di lokasi tujuan.`;
      return;
    }
    const existing = basket.find((b) => b.batchId === batchId);
    if (existing) {
      if (existing.qty >= existing.available) {
        scanError = `Batch ${batch.code} sudah penuh di keranjang (${existing.available}).`;
        return;
      }
      existing.qty = Math.min(existing.qty + 1, existing.available);
      lastScannedId = existing.id;
      return;
    }
    const product = products.getById(batch.productId);
    if (!product) {
      scanError = 'Produk untuk batch ini tidak ditemukan.';
      return;
    }
    const variantName = batch.variantId
      ? product.variants.find((v) => v.id === batch.variantId)?.name ?? ''
      : '';
    const item: BasketItem = {
      id: crypto.randomUUID(),
      batchId: batch.id,
      qty: 1,
      unitKey: `${product.unitId}|1`,
      productId: product.id,
      batchCode: batch.code,
      productName: product.name,
      variantName,
      fromLocationId: batch.locationId,
      fromLocationName: locations.getById(batch.locationId)?.name ?? batch.locationId,
      available: batch.qtyRemaining,
      unitCode: units.getById(product.unitId)?.code ?? '',
      expiresAt: batch.expiresAt
    };
    basket = [item, ...basket];
    lastScannedId = item.id;
  }

  // --- unit-aware qty helpers ------------------------------------------
  function unitOptionsFor(productId: string): { value: string; label: string; factor: number }[] {
    const p = products.getById(productId);
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

  function factorOf(item: BasketItem): number {
    const factor = Number(item.unitKey.split('|')[1]);
    return Number.isFinite(factor) && factor > 0 ? factor : 1;
  }

  function chosenUnitCodeOf(item: BasketItem): string {
    const unitId = item.unitKey.split('|')[0];
    return units.getById(unitId)?.code ?? item.unitCode;
  }

  // Input value shown to the user — qty in the chosen unit. Trim fractional zeros.
  function qtyDisplay(item: BasketItem): string {
    const factor = factorOf(item);
    const v = item.qty / factor;
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2).replace(/\.?0+$/, '');
  }

  function maxDisplay(item: BasketItem): string {
    const factor = factorOf(item);
    const v = item.available / factor;
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2).replace(/\.?0+$/, '');
  }

  // Update qty in BASE units from a value typed in the chosen unit.
  function setQtyFromUnit(id: string, rawDisplayValue: number) {
    const idx = basket.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const item = basket[idx];
    const factor = factorOf(item);
    const wantBase = Math.max(1, Math.round(rawDisplayValue * factor));
    basket[idx].qty = Math.min(item.available, wantBase);
  }

  function incQty(id: string) {
    const idx = basket.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const item = basket[idx];
    const factor = factorOf(item);
    basket[idx].qty = Math.min(item.available, item.qty + factor);
  }

  function decQty(id: string) {
    const idx = basket.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const item = basket[idx];
    const factor = factorOf(item);
    basket[idx].qty = Math.max(1, item.qty - factor);
  }

  function setUnitKey(id: string, key: string) {
    const idx = basket.findIndex((b) => b.id === id);
    if (idx === -1) return;
    basket[idx].unitKey = key;
    // Snap qty to a multiple of the new factor so display stays clean.
    const factor = Number(key.split('|')[1]) || 1;
    const item = basket[idx];
    if (item.qty < factor) basket[idx].qty = factor;
    else basket[idx].qty = Math.min(item.available, Math.round(item.qty / factor) * factor);
  }

  function removeItem(id: string) {
    basket = basket.filter((b) => b.id !== id);
  }

  function clearBasket() {
    basket = [];
    lastScannedId = null;
  }

  const totalUnits = $derived(basket.reduce((s, b) => s + b.qty, 0));
  const canSubmit = $derived(toLocationId !== '' && basket.length > 0);

  async function submit() {
    if (!canSubmit) {
      if (!toLocationId) scanError = 'Pilih lokasi tujuan dulu.';
      return;
    }
    const transferGroupId = crypto.randomUUID();
    let success = 0;
    const failures: string[] = [];
    for (const item of basket) {
      const result = batches.moveStock({
        batchId: item.batchId,
        toLocationId,
        qty: item.qty,
        notes: notes.trim() || `Scan & pindah · ${destinationName}`,
        transferGroupId
      });
      if (result.ok) success++;
      else failures.push(`${item.batchCode}: ${result.reason}`);
    }
    if (success > 0) {
      toast.success(
        `${success} batch dipindahkan`,
        `${totalUnits} unit ke ${destinationName}`
      );
    }
    if (failures.length > 0) {
      toast.error(`${failures.length} batch gagal`, failures[0]);
    }
    basket = [];
    notes = '';
    scanError = '';
    await tick();
    inputEl?.focus();
  }

  $effect(() => {
    if (locationsOn && inputEl && !toLocationId) {
      // first paint — focus the input
      inputEl.focus();
    }
  });
</script>

<svelte:head>
  <title>Scan & Pindah · POS Admin</title>
</svelte:head>

<PageHeader
  title="Scan & Pindah"
  description="Pindai barcode batch atau SKU, tambahkan ke keranjang, lalu kirim ke lokasi tujuan dalam satu langkah."
  breadcrumb={[
    { label: 'Katalog' },
    { label: 'Inventaris', href: '/inventory' },
    { label: 'Scan & Pindah' }
  ]}
>
  {#snippet actions()}
    <Button variant="outline" href="/inventory/move/bulk">
      <Layers class="h-4 w-4" />
      Mode massal
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
        <a href="/settings" class="font-medium text-brand-700 hover:underline">Pengaturan</a> untuk
        bisa memindahkan stok antar lokasi.
      </p>
    </div>
  </Card>
{:else}
  <div class="grid gap-4 lg:grid-cols-[1fr_360px]">
    <div class="space-y-4">
      <!-- Destination + scan input -->
      <Card>
        <div class="grid gap-4 sm:grid-cols-[1fr_2fr] sm:items-end">
          <Select
            label="Lokasi tujuan"
            bind:value={toLocationId}
            options={destinationOptions}
            hint="Semua batch di keranjang akan dipindahkan ke sini."
          />
          <div>
            <label for="scan-input" class="mb-1.5 block text-sm font-medium text-slate-700">
              Pindai atau ketik kode
            </label>
            <div class="relative">
              <ScanLine class="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="scan-input"
                bind:this={inputEl}
                bind:value={scanInput}
                onkeydown={handleScan}
                placeholder="BATCH-2026-XXX, SKU produk, atau SKU varian…"
                autocomplete="off"
                spellcheck="false"
                class="w-full rounded-lg border border-slate-300 bg-white py-3 pr-3 pl-11 text-base font-medium tracking-wide focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
              />
            </div>
            <p class="mt-1 text-xs text-slate-500">
              Tekan <kbd class="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-[10px]">Enter</kbd>
              setelah pindai/ketik. Sistem otomatis pilih batch FIFO untuk SKU.
            </p>
          </div>
        </div>
        {#if scanError}
          <div class="mt-3 inline-flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{scanError}</span>
          </div>
        {/if}
      </Card>

      <!-- Basket -->
      <Card padded={false}>
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900">Keranjang pindah</h2>
            <p class="text-xs text-slate-500">
              {basket.length} batch · {totalUnits} unit total
            </p>
          </div>
          {#if basket.length > 0}
            <button
              type="button"
              class="text-xs font-medium text-slate-500 hover:text-rose-600"
              onclick={clearBasket}
            >
              Bersihkan keranjang
            </button>
          {/if}
        </div>

        {#if basket.length === 0}
          <div class="flex flex-col items-center gap-2 py-12 text-center">
            <ScanLine class="h-10 w-10 text-slate-300" />
            <p class="text-sm font-medium text-slate-600">Belum ada yang dipindai</p>
            <p class="max-w-sm text-xs text-slate-400">
              Pindai kode batch yang tertera di label, atau ketik SKU produk/varian.
            </p>
          </div>
        {:else}
          <ul class="divide-y divide-slate-100">
            {#each basket as item (item.id)}
              {@const exp = expiryHint(item.expiresAt)}
              {@const opts = unitOptionsFor(item.productId)}
              {@const factor = factorOf(item)}
              {@const chosenCode = chosenUnitCodeOf(item)}
              <li
                class="flex flex-wrap items-center gap-3 px-4 py-3
                  {item.id === lastScannedId ? 'bg-emerald-50/40' : ''}"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <code class="font-mono text-xs font-medium text-slate-800">{item.batchCode}</code>
                    {#if item.id === lastScannedId}
                      <Badge variant="success" size="sm">
                        <Check class="mr-0.5 h-3 w-3" />
                        Baru
                      </Badge>
                    {/if}
                  </div>
                  <div class="mt-0.5 text-sm font-medium text-slate-900">
                    {item.productName}
                    {#if item.variantName}
                      <span class="text-slate-500">— {item.variantName}</span>
                    {/if}
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                      Dari: <span class="font-medium text-slate-700">{item.fromLocationName}</span>
                    </span>
                    <span class="text-slate-300">·</span>
                    <span>
                      Tersedia: <span class="font-medium text-slate-700">{item.available}</span>
                      {#if item.unitCode}<span class="text-slate-400">{item.unitCode}</span>{/if}
                    </span>
                    {#if exp}
                      <span class="text-slate-300">·</span>
                      <Badge variant={exp.variant} size="sm">
                        <AlertTriangle class="mr-0.5 h-3 w-3" />
                        {exp.label}
                      </Badge>
                    {/if}
                  </div>
                </div>

                <div class="flex flex-col items-end gap-1">
                  <div class="flex items-center gap-2">
                    <div class="inline-flex items-center rounded-md border border-slate-200 bg-white">
                      <button
                        type="button"
                        class="px-2 py-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
                        disabled={item.qty <= factor}
                        onclick={() => decQty(item.id)}
                        aria-label="Kurangi"
                      >
                        <Minus class="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        step={factor > 1 ? 'any' : '1'}
                        value={qtyDisplay(item)}
                        class="w-16 border-0 bg-transparent text-center text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        oninput={(e) =>
                          setQtyFromUnit(item.id, Number((e.currentTarget as HTMLInputElement).value))}
                      />
                      <button
                        type="button"
                        class="px-2 py-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
                        disabled={item.qty + factor > item.available}
                        onclick={() => incQty(item.id)}
                        aria-label="Tambah"
                      >
                        <Plus class="h-4 w-4" />
                      </button>
                    </div>
                    {#if opts.length > 1}
                      <select
                        value={item.unitKey}
                        onchange={(e) =>
                          setUnitKey(item.id, (e.currentTarget as HTMLSelectElement).value)}
                        class="rounded-md border border-slate-200 bg-white py-1 pr-6 pl-2 text-xs focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                        title="Satuan"
                      >
                        {#each opts as o (o.value)}
                          <option value={o.value}>{o.label}</option>
                        {/each}
                      </select>
                    {:else if chosenCode}
                      <span class="text-[10px] font-medium text-slate-500">{chosenCode}</span>
                    {/if}
                    <button
                      type="button"
                      class="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Hapus"
                      onclick={() => removeItem(item.id)}
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                  {#if factor > 1}
                    <span class="text-[10px] text-slate-500">
                      = <span class="font-medium text-slate-700">{item.qty}</span> {item.unitCode}
                      <span class="text-slate-400">/ max {maxDisplay(item)} {chosenCode}</span>
                    </span>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>

      <!-- Notes -->
      <Card>
        <Textarea
          label="Catatan (opsional)"
          placeholder="mis. Refill etalase pagi, pemindahan rutin shift A, dll."
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
            <dt class="text-slate-500">Tujuan</dt>
            <dd>
              {#if destinationName}
                <span class="font-medium text-slate-900">{destinationName}</span>
              {:else}
                <span class="text-slate-400">Belum dipilih</span>
              {/if}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Batch di keranjang</dt>
            <dd class="font-medium text-slate-900">{basket.length}</dd>
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

        <p class="mt-2 text-[11px] text-slate-500">
          Semua batch akan dipindah dalam satu transfer; bisa dilacak bersamaan di Riwayat Stok.
        </p>
      </Card>
    </div>
  </div>
{/if}
