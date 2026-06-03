<script lang="ts">
  import { ArrowLeft, Search, ClipboardCheck, AlertCircle, CheckSquare, Square, Check } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import {
    Badge,
    Button,
    Card,
    Input,
    PageHeader,
    Select,
    Textarea
  } from '$lib/components/ui';
  import { stockOpnames } from '$lib/stores/stockOpnames.svelte';
  import { products, type Product } from '$lib/stores/products.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { stockByLocation, stockOf } from '$lib/stores/batches.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  const auditOn = $derived(settings.value.inventory.auditTrailEnabled);
  const locationsOn = $derived(settings.value.inventory.locationsEnabled);

  let locationId = $state(locations.defaultId());
  let selectedCategoryIds = $state<Record<string, boolean>>({});
  let productSearch = $state('');
  // Explicit user overrides — only set when the user toggles a row or uses the
  // select-all/clear-all buttons. Display state = override ?? default-from-stock.
  let productOverrides = $state<Record<string, boolean>>({});
  let notes = $state('');
  let creating = $state(false);

  const locationOptions = $derived(
    locations.sortedActive().map((l) => ({ value: l.id, label: l.name }))
  );

  function totalStockAtLocation(p: Product, locId: string): number {
    if (locId === '') return stockOf(p.id);
    if (p.variants.length === 0) return stockByLocation(p.id).get(locId) ?? 0;
    let total = 0;
    for (const v of p.variants) {
      total += stockByLocation(p.id, v.id).get(locId) ?? 0;
    }
    return total;
  }

  // Candidates: active, non-composite products. Filtered by category (if any) and search.
  // Default-selected = those with stock > 0 at the chosen location.
  const eligibleProducts = $derived.by(() => {
    const activeCats = Object.entries(selectedCategoryIds)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const catSet = activeCats.length > 0 ? new Set(activeCats) : null;
    const q = productSearch.trim().toLowerCase();
    return products.items
      .filter((p) => {
        if (p.status !== 'active') return false;
        if (p.kind === 'composite') return false;
        if (catSet && !catSet.has(p.categoryId)) return false;
        if (q) {
          const hay = `${p.name} ${p.sku}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // Default selection: products with stock > 0 at the current location.
  // Pure derivation — no writes, no $effect, no update-depth issues.
  function defaultFor(productId: string): boolean {
    const p = products.getById(productId);
    if (!p) return false;
    return totalStockAtLocation(p, locationId) > 0;
  }

  function isSelected(id: string): boolean {
    return productOverrides[id] ?? defaultFor(id);
  }

  function toggleProduct(id: string, checked: boolean) {
    productOverrides = { ...productOverrides, [id]: checked };
  }

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = { ...productOverrides };
    for (const p of eligibleProducts) next[p.id] = checked;
    productOverrides = next;
  }

  const selectedCount = $derived(
    eligibleProducts.filter((p) => isSelected(p.id)).length
  );

  const totalEligible = $derived(eligibleProducts.length);

  function categoryName(id: string): string {
    return categories.getById(id)?.name ?? id;
  }

  async function create() {
    if (selectedCount === 0) {
      toast.error('Pilih minimal 1 produk', 'Tidak ada produk yang dipilih untuk dihitung.');
      return;
    }
    creating = true;
    const productIds = eligibleProducts.filter((p) => isSelected(p.id)).map((p) => p.id);
    try {
      const draft = await stockOpnames.buildDraft({
        locationId: locationsOn ? locationId : undefined,
        productIds,
        notes: notes.trim()
      });
      toast.success('Opname dibuat', `${draft.code} · ${draft.lines.length} baris siap dihitung`);
      goto(`/stock-opname/${draft.id}`);
    } catch (err) {
      toast.error('Gagal membuat opname', err instanceof Error ? err.message : '');
      creating = false;
    }
  }
</script>

<svelte:head>
  <title>Mulai opname baru · POS Admin</title>
</svelte:head>

<PageHeader
  title="Mulai opname baru"
  description="Pilih lokasi, kategori, dan produk yang akan dihitung fisik."
  breadcrumb={[
    { label: 'Katalog' },
    { label: 'Opname Stok', href: '/stock-opname' },
    { label: 'Baru' }
  ]}
>
  {#snippet actions()}
    <Button variant="outline" href="/stock-opname">
      <ArrowLeft class="h-4 w-4" />
      Kembali
    </Button>
  {/snippet}
</PageHeader>

{#if !auditOn}
  <Card>
    <div class="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle class="h-10 w-10 text-amber-500" />
      <p class="text-base font-semibold text-slate-900">Opname stok belum diaktifkan</p>
      <p class="max-w-md text-sm text-slate-600">
        Aktifkan toggle "Riwayat & opname stok" di
        <a href="/settings" class="font-medium text-brand-700 hover:underline">Pengaturan</a>.
      </p>
    </div>
  </Card>
{:else}
  <div class="grid gap-4 lg:grid-cols-[1fr_360px]">
    <div class="space-y-4">
      <!-- Lokasi & Catatan -->
      <Card>
        <h2 class="mb-3 text-sm font-semibold text-slate-900">Ruang lingkup</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          {#if locationsOn}
            <Select
              label="Lokasi"
              bind:value={locationId}
              options={locationOptions}
              hint="Sistem akan ambil snapshot stok aktual di lokasi ini saat opname dibuat."
            />
          {:else}
            <div class="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">
              <p class="font-medium text-slate-800">Manajemen lokasi belum diaktifkan</p>
              <p class="mt-1">Opname akan menghitung stok total di semua tempat sebagai satu kesatuan.</p>
            </div>
          {/if}
          <Textarea
            class="sm:col-span-2"
            label="Catatan"
            placeholder="mis. Opname mingguan etalase, audit setelah kasir berganti shift, dll."
            bind:value={notes}
          />
        </div>
      </Card>

      <!-- Filter kategori -->
      <Card>
        <h2 class="mb-3 text-sm font-semibold text-slate-900">Filter kategori (opsional)</h2>
        <p class="mb-3 text-xs text-slate-500">
          Kosongkan untuk lihat semua kategori. Centang satu atau lebih untuk mempersempit daftar produk.
        </p>
        <div class="flex flex-wrap gap-3">
          {#each categories.items as cat (cat.id)}
            <label
              class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-50
                {selectedCategoryIds[cat.id]
                ? 'border-brand-400 bg-brand-50 text-brand-700'
                : 'text-slate-600'}"
            >
              <input
                type="checkbox"
                class="sr-only"
                bind:checked={selectedCategoryIds[cat.id]}
              />
              <Badge variant={cat.color} dot size="sm">{cat.name}</Badge>
            </label>
          {/each}
        </div>
      </Card>

      <!-- Picker produk -->
      <Card padded={false}>
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 class="mr-2 text-sm font-semibold text-slate-900">Pilih produk untuk dihitung</h2>
          <div class="ml-auto inline-flex items-center gap-1">
            <Button variant="outline" size="sm" onclick={() => toggleAll(true)}>
              <CheckSquare class="h-3.5 w-3.5" />
              Pilih semua
            </Button>
            <Button variant="outline" size="sm" onclick={() => toggleAll(false)}>
              <Square class="h-3.5 w-3.5" />
              Bersihkan
            </Button>
          </div>
        </div>
        <div class="border-b border-slate-100 px-4 py-2.5">
          <Input placeholder="Cari produk berdasarkan nama atau SKU…" bind:value={productSearch}>
            {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
          </Input>
        </div>

        <div class="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
          {#each eligibleProducts as p (p.id)}
            {@const stk = totalStockAtLocation(p, locationId)}
            {@const cat = categories.getById(p.categoryId)}
            {@const sel = isSelected(p.id)}
            {@const unitCode = units.getById(p.unitId)?.code ?? ''}
            <label
              class="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
            >
              <span class="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={sel}
                  onchange={(e) => toggleProduct(p.id, (e.currentTarget as HTMLInputElement).checked)}
                  class="peer absolute inset-0 h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white transition checked:border-brand-600 checked:bg-brand-600 hover:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                />
                <Check
                  class="pointer-events-none h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
                  strokeWidth={3}
                />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-medium text-slate-900">{p.name}</span>
                  {#if cat}
                    <Badge variant={cat.color} size="sm" dot>{cat.name}</Badge>
                  {/if}
                  {#if p.variants.length > 0}
                    <span class="text-[10px] text-slate-500">
                      {p.variants.length} varian
                    </span>
                  {/if}
                </div>
                <code class="text-[10px] font-mono text-slate-500">{p.sku}</code>
              </div>
              <div class="text-right">
                <div class="text-sm font-semibold {stk > 0 ? 'text-slate-900' : 'text-slate-400'}">
                  {stk}
                  {#if unitCode}<span class="ml-0.5 text-[10px] font-normal text-slate-400">{unitCode}</span>{/if}
                </div>
                <div class="text-[10px] text-slate-400">stok saat ini</div>
              </div>
            </label>
          {/each}
          {#if eligibleProducts.length === 0}
            <div class="flex flex-col items-center gap-1.5 py-10">
              <ClipboardCheck class="h-8 w-8 text-slate-300" />
              <p class="text-sm font-medium text-slate-600">Tidak ada produk yang cocok</p>
              <p class="text-xs text-slate-400">Sesuaikan filter atau hapus pencarian.</p>
            </div>
          {/if}
        </div>
      </Card>
    </div>

    <!-- Sticky summary -->
    <div class="lg:sticky lg:top-4 lg:self-start">
      <Card>
        <h3 class="mb-3 text-sm font-semibold text-slate-900">Ringkasan</h3>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">Lokasi</dt>
            <dd class="font-medium text-slate-800">
              {locationsOn ? locations.getById(locationId)?.name ?? '—' : 'Semua'}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Filter kategori</dt>
            <dd class="font-medium text-slate-800 text-right">
              {Object.entries(selectedCategoryIds).filter(([, v]) => v).length === 0
                ? 'Semua'
                : Object.entries(selectedCategoryIds)
                    .filter(([, v]) => v)
                    .map(([k]) => categoryName(k))
                    .join(', ')}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">Produk dipilih</dt>
            <dd class="font-semibold text-slate-900">
              {selectedCount} / {totalEligible}
            </dd>
          </div>
        </dl>

        <Button class="mt-4 w-full" size="lg" onclick={create} disabled={selectedCount === 0 || creating}>
          <ClipboardCheck class="h-4 w-4" />
          Buat opname
        </Button>

        <p class="mt-2 text-[11px] text-slate-500">
          Sistem akan ambil snapshot stok aktual untuk produk yang dipilih dan menyiapkan formulir hitung.
        </p>
      </Card>
    </div>
  </div>
{/if}
