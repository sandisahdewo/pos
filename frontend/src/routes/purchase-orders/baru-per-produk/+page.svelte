<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    Search,
    ShoppingCart,
    Trash2,
    ArrowRight,
    Layers,
    Package,
    ChevronRight
  } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    PageHeader,
    Select,
    Table
  } from '$lib/components/ui';
  import { products, primarySupplier, type Product, type ProductVariant } from '$lib/stores/products.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import { categories } from '$lib/stores/categories.svelte';
  import { brands } from '$lib/stores/brands.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { purchaseOrders, type PurchaseOrderInput } from '$lib/stores/purchaseOrders.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { latestSupplierPrice } from '$lib/utils/supplierAnalytics';
  import { formatRupiah } from '$lib/utils/currency';

  // === Picker state ===
  let search = $state('');
  let categoryFilter = $state('');
  let brandFilter = $state('');

  // === Cart state ===
  // Tiap entry mewakili satu (product, variant?) yang akan dimasukkan ke PO.
  // Supplier dipilih per item — sistem auto-group by supplier saat submit.
  type CartItem = {
    id: string;
    productId: string;
    variantId?: string;
    productName: string;
    variantName?: string;
    productSku: string;
    productCategoryId: string;
    productBrandId?: string;
    productUnitId: string;
    // Satuan pembelian yang dipilih untuk item ini. Default = packaging dengan
    // factor terbesar (mis. slop) supaya operator tidak perlu ganti tiap kali.
    // Bisa di-override per-item di expanded editor.
    unitId: string;
    unitFactor: number;
    quantity: number;        // dalam satuan yang dipilih (mis. 2 slop, bukan 320 batang)
    supplierId: string;
    unitPrice: number;       // per satuan yang dipilih (mis. harga per slop)
    notes: string;
  };

  let cart = $state<CartItem[]>([]);
  // Set ID item cart yang sedang dibuka (expanded). Default: tertutup
  // semua supaya cart panel tetap compact saat banyak item. Item baru
  // yang ditambah auto-expand supaya operator bisa langsung atur qty/
  // pemasok tanpa klik lagi.
  let expandedItems = $state<Set<string>>(new Set());

  function toggleExpand(itemId: string) {
    const next = new Set(expandedItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    expandedItems = next;
  }

  function expandAll() {
    expandedItems = new Set(cart.map((c) => c.id));
  }

  function collapseAll() {
    expandedItems = new Set();
  }

  // === Confirm submit dialog ===
  let confirmSubmitOpen = $state(false);

  // === Picker rows: tiap (product, variant?) yang aktif + punya supplier terdaftar ===
  type PickerRow = {
    rowKey: string;
    productId: string;
    variantId?: string;
    productName: string;
    variantName?: string;
    sku: string;
    categoryId: string;
    brandId?: string;
    supplierIds: string[]; // suppliers yang terdaftar di master produk
  };

  const allPickerRows = $derived.by<PickerRow[]>(() => {
    const out: PickerRow[] = [];
    for (const p of products.items) {
      if (p.status !== 'active') continue;
      if (!p.suppliers || p.suppliers.length === 0) continue; // skip yang belum punya supplier
      const supplierIds = p.suppliers.map((s) => s.supplierId);
      if (p.variants.length === 0) {
        out.push({
          rowKey: p.id,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          categoryId: p.categoryId,
          brandId: p.brandId,
          supplierIds
        });
      } else {
        for (const v of p.variants) {
          out.push({
            rowKey: `${p.id}|${v.id}`,
            productId: p.id,
            variantId: v.id,
            productName: p.name,
            variantName: v.name,
            sku: v.sku,
            categoryId: p.categoryId,
            brandId: p.brandId,
            supplierIds
          });
        }
      }
    }
    return out;
  });

  const filteredRows = $derived.by<PickerRow[]>(() => {
    const q = search.trim().toLowerCase();
    return allPickerRows.filter((r) => {
      if (categoryFilter && r.categoryId !== categoryFilter) return false;
      if (brandFilter && r.brandId !== brandFilter) return false;
      if (!q) return true;
      const hay = `${r.productName} ${r.variantName ?? ''} ${r.sku}`.toLowerCase();
      return hay.includes(q);
    });
  });

  const categoryOptions = $derived([
    { value: '', label: 'Semua kategori' },
    ...categories.items.map((c) => ({ value: c.id, label: c.name }))
  ]);

  const brandOptions = $derived([
    { value: '', label: 'Semua brand' },
    ...brands.active().map((b) => ({ value: b.id, label: b.name }))
  ]);

  // === Cart helpers ===
  function isInCart(productId: string, variantId?: string): boolean {
    return cart.some((c) => c.productId === productId && c.variantId === variantId);
  }

  // PO biasanya beli dalam kemasan terbesar. Konsisten dengan
  // PurchaseOrderForm.defaultPurchaseUnit. Produk tanpa packaging fallback ke
  // base unit.
  function defaultPurchaseUnit(
    product: Product
  ): { unitId: string; unitFactor: number } {
    if (product.units.length === 0) {
      return { unitId: product.unitId, unitFactor: 1 };
    }
    const largest = product.units.reduce((max, pack) =>
      pack.factor > max.factor ? pack : max
    );
    return { unitId: largest.unitId, unitFactor: largest.factor };
  }

  // Biaya per satuan dasar — variant.cost > supplier.unitCost > product.cost.
  function baseCostFor(item: CartItem): number {
    const product = products.getById(item.productId);
    if (!product) return 0;
    if (item.variantId) {
      const v = product.variants.find((vv) => vv.id === item.variantId);
      if (v && v.cost > 0) return v.cost;
    }
    if (item.supplierId) {
      const ps = (product.suppliers ?? []).find((s) => s.supplierId === item.supplierId);
      if (ps && ps.unitCost > 0) return ps.unitCost;
    }
    return product.cost;
  }

  function defaultUnitPrice(item: CartItem): number {
    return baseCostFor(item) * (item.unitFactor || 1);
  }

  function addToCart(row: PickerRow) {
    if (isInCart(row.productId, row.variantId)) return;
    const product = products.getById(row.productId);
    if (!product) return;
    const primary = primarySupplier(product);
    const supplierId = primary?.supplierId ?? row.supplierIds[0] ?? '';
    const { unitId, unitFactor } = defaultPurchaseUnit(product);
    const newId = crypto.randomUUID();
    const item: CartItem = {
      id: newId,
      productId: row.productId,
      variantId: row.variantId,
      productName: row.productName,
      variantName: row.variantName,
      productSku: row.sku,
      productCategoryId: row.categoryId,
      productBrandId: row.brandId,
      productUnitId: product.unitId,
      unitId,
      unitFactor,
      quantity: 1,
      supplierId,
      unitPrice: 0,
      notes: ''
    };
    item.unitPrice = defaultUnitPrice(item);
    cart = [...cart, item];
    // Auto-expand item yang baru ditambah supaya operator bisa langsung
    // atur qty / harga tanpa klik lagi.
    expandedItems = new Set([...expandedItems, newId]);
  }

  function removeFromCart(itemId: string) {
    cart = cart.filter((c) => c.id !== itemId);
    if (expandedItems.has(itemId)) {
      const next = new Set(expandedItems);
      next.delete(itemId);
      expandedItems = next;
    }
  }

  function onItemSupplierChange(item: CartItem, newSupplierId: string) {
    item.supplierId = newSupplierId;
    // Re-suggest unitPrice dari supplier baru. baseCostFor sudah menerapkan
    // prioritas variant > supplier > product.cost, lalu defaultUnitPrice
    // mengalikan factor satuan terpilih.
    item.unitPrice = defaultUnitPrice(item);
  }

  function unitOptionsFor(item: CartItem): { value: string; label: string }[] {
    const product = products.getById(item.productId);
    if (!product) return [];
    const baseUnit = units.getById(product.unitId);
    const baseCode = baseUnit?.code ?? '?';
    const baseName = baseUnit?.name ?? '?';
    const opts: { value: string; label: string }[] = [
      { value: `${product.unitId}|1`, label: `${baseName} (${baseCode}) — base` }
    ];
    for (const pack of product.units) {
      const u = units.getById(pack.unitId);
      if (!u) continue;
      opts.push({
        value: `${pack.unitId}|${pack.factor}`,
        label: `${u.name} (${u.code}) — 1 = ${pack.factor} ${baseCode}`
      });
    }
    return opts;
  }

  function onItemUnitChange(item: CartItem, value: string) {
    const [unitId, factorStr] = value.split('|');
    item.unitId = unitId;
    item.unitFactor = Number(factorStr) || 1;
    item.unitPrice = defaultUnitPrice(item);
  }

  function supplierOptionsFor(item: CartItem): { value: string; label: string }[] {
    const product = products.getById(item.productId);
    if (!product) return [];
    return (product.suppliers ?? []).map((ps) => {
      const sup = suppliers.getById(ps.supplierId);
      return {
        value: ps.supplierId,
        label: `${sup?.name ?? ps.supplierId}${ps.isPrimary ? ' (utama)' : ''}`
      };
    });
  }

  // Lookup harga history terakhir untuk item.supplier (pakai supplier
  // analytics yang sama dengan PO line panel). Return null kalau belum
  // pernah ada penerimaan dari supplier ini.
  function lastPriceFor(item: CartItem) {
    if (!item.supplierId) return null;
    return latestSupplierPrice(item.productId, item.variantId, item.supplierId);
  }

  // === Group by supplier — preview submit ===
  type SupplierGroup = {
    supplierId: string;
    supplierName: string;
    items: CartItem[];
    totalEstimate: number;
  };

  const groups = $derived.by<SupplierGroup[]>(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of cart) {
      const list = map.get(item.supplierId) ?? [];
      list.push(item);
      map.set(item.supplierId, list);
    }
    const out: SupplierGroup[] = [];
    for (const [supplierId, items] of map) {
      const sup = suppliers.getById(supplierId);
      out.push({
        supplierId,
        supplierName: sup?.name ?? supplierId,
        items,
        totalEstimate: items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
      });
    }
    return out.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  });

  const cartTotal = $derived.by(() =>
    cart.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  );

  const itemsMissingSupplier = $derived(cart.filter((it) => !it.supplierId).length);
  const itemsZeroQty = $derived(cart.filter((it) => it.quantity <= 0).length);
  const canSubmit = $derived(
    cart.length > 0 && itemsMissingSupplier === 0 && itemsZeroQty === 0
  );

  function attemptSubmit() {
    if (!canSubmit) return;
    confirmSubmitOpen = true;
  }

  async function doSubmit() {
    const today = new Date().toISOString().slice(0, 10);
    const createdCodes: string[] = [];
    try {
      for (const group of groups) {
        const payload: PurchaseOrderInput = {
          type: 'standard',
          supplierId: group.supplierId,
          status: 'draft',
          orderDate: today,
          expectedDate: '',
          receivedDate: '',
          lines: group.items.map((it) => ({
            id: crypto.randomUUID(),
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
            receivedQty: 0,
            unitId: it.unitId,
            unitFactor: it.unitFactor,
            unitPrice: it.unitPrice,
            notes: it.notes
          })),
          notes: 'Dibuat lewat mode "PO per produk".'
        };
        const created = await purchaseOrders.add(payload);
        createdCodes.push(created.code);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan PO', msg);
      return;
    }
    toast.success(
      `${createdCodes.length} PO berhasil dibuat`,
      createdCodes.join(', ')
    );
    cart = [];
    confirmSubmitOpen = false;
    goto('/purchase-orders');
  }

  const pickerColumns = [
    { key: 'check' as const, label: '', width: '60px' },
    { key: 'product' as const, label: 'Produk' },
    { key: 'category' as const, label: 'Kategori', width: '140px' },
    { key: 'suppliers' as const, label: 'Pemasok terdaftar', width: '220px' }
  ];

  function categoryFor(id: string) {
    return categories.getById(id);
  }

  function supplierNames(ids: string[]): string[] {
    return ids.map((id) => suppliers.getById(id)?.name ?? id);
  }
</script>

<svelte:head>
  <title>Buat PO per produk · POS Admin</title>
</svelte:head>

<PageHeader
  title="Buat PO per produk"
  description="Pilih produk dulu, atur pemasok per produk, lalu sistem otomatis buat satu PO per pemasok."
  breadcrumb={[
    { label: 'Pengadaan' },
    { label: 'Order Pembelian', href: '/purchase-orders' },
    { label: 'Buat per produk' }
  ]}
/>

{#if allPickerRows.length === 0}
  <Card>
    <div class="py-10 text-center">
      <p class="text-sm font-medium text-slate-700">Tidak ada produk yang punya pemasok terdaftar</p>
      <p class="mt-1 text-xs text-slate-500">
        Tambah pemasok ke produk di
        <a href="/products" class="font-medium text-brand-700 hover:underline">Master Produk</a>
        sebelum bisa pakai mode ini.
      </p>
    </div>
  </Card>
{:else}
  <div class="grid gap-4 lg:grid-cols-3">
    <!-- LEFT: Picker -->
    <div class="space-y-4 lg:col-span-2">
      <Card padded={false}>
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div class="min-w-[220px] flex-1">
            <Input placeholder="Cari produk, varian, atau SKU…" bind:value={search}>
              {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
            </Input>
          </div>
          <Select bind:value={categoryFilter} options={categoryOptions} class="w-44" />
          <Select bind:value={brandFilter} options={brandOptions} class="w-40" />
        </div>

        <Table
          columns={pickerColumns}
          rows={filteredRows}
          rowKey={(r: PickerRow) => r.rowKey}
        >
          {#snippet cell({ row, column })}
            {#if column.key === 'check'}
              {@const inCart = isInCart(row.productId, row.variantId)}
              <input
                type="checkbox"
                checked={inCart}
                onchange={() => {
                  if (inCart) {
                    // Cari item-id dari cart untuk dihapus
                    const found = cart.find(
                      (c) => c.productId === row.productId && c.variantId === row.variantId
                    );
                    if (found) removeFromCart(found.id);
                  } else {
                    addToCart(row);
                  }
                }}
                class="h-4 w-4 cursor-pointer rounded border-slate-300"
                aria-label={inCart ? 'Hapus dari cart' : 'Tambah ke cart'}
              />
            {:else if column.key === 'product'}
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="font-medium text-slate-900">{row.productName}</span>
                  {#if row.variantName}
                    <Badge variant="brand" size="sm">{row.variantName}</Badge>
                  {/if}
                </div>
                <code class="text-xs text-slate-500">{row.sku}</code>
              </div>
            {:else if column.key === 'category'}
              {@const cat = categoryFor(row.categoryId)}
              {#if cat}
                <Badge variant={cat.color} dot size="sm">{cat.name}</Badge>
              {:else}
                <span class="text-xs text-slate-400">—</span>
              {/if}
            {:else if column.key === 'suppliers'}
              <div class="flex flex-wrap gap-1">
                {#each supplierNames(row.supplierIds).slice(0, 3) as name (name)}
                  <span
                    class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                  >
                    {name}
                  </span>
                {/each}
                {#if row.supplierIds.length > 3}
                  <span class="text-[10px] text-slate-500">+{row.supplierIds.length - 3}</span>
                {/if}
              </div>
            {/if}
          {/snippet}

          {#snippet empty()}
            <div class="py-6 text-center text-xs text-slate-400">
              Tidak ada yang cocok dengan filter. Coba kata kunci lain.
            </div>
          {/snippet}
        </Table>
      </Card>
    </div>

    <!-- RIGHT: Cart panel (sticky) -->
    <div class="space-y-4">
      <Card>
        <div class="mb-3 flex items-center gap-2">
          <ShoppingCart class="h-4 w-4 text-slate-500" />
          <h3 class="text-sm font-semibold text-slate-900">Keranjang PO</h3>
          <Badge variant="outline" size="sm">{cart.length}</Badge>
          {#if cart.length > 1}
            <div class="ml-auto flex items-center gap-1.5 text-xs">
              {#if expandedItems.size > 0}
                <button
                  type="button"
                  class="text-slate-500 hover:text-slate-700"
                  onclick={collapseAll}
                >
                  Tutup semua
                </button>
              {/if}
              {#if expandedItems.size < cart.length}
                <button
                  type="button"
                  class="text-slate-500 hover:text-slate-700"
                  onclick={expandAll}
                >
                  Buka semua
                </button>
              {/if}
            </div>
          {/if}
        </div>

        {#if cart.length === 0}
          <p class="py-4 text-center text-xs text-slate-500">
            Centang produk di kiri untuk menambahkan ke keranjang.
          </p>
        {:else}
          <div class="space-y-1.5">
            {#each cart as item (item.id)}
              {@const supplierOpts = supplierOptionsFor(item)}
              {@const unitOpts = unitOptionsFor(item)}
              {@const lastPrice = lastPriceFor(item)}
              {@const subtotal = item.quantity * item.unitPrice}
              {@const expanded = expandedItems.has(item.id)}
              {@const supplierLabel =
                suppliers.getById(item.supplierId)?.name ?? '—'}
              {@const itemUnitCode = units.getById(item.unitId)?.code ?? ''}
              {@const baseUnitCode = units.getById(item.productUnitId)?.code ?? ''}
              {@const baseQty = item.quantity * item.unitFactor}
              <div class="rounded-lg border border-slate-200 bg-white">
                <!-- Compact row (always visible). Split jadi dua tombol
                     sebelahan supaya tidak nested <button>: kiri toggle
                     expand, kanan trash. -->
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50"
                    onclick={() => toggleExpand(item.id)}
                    aria-expanded={expanded}
                  >
                    <ChevronRight
                      class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform {expanded
                        ? 'rotate-90'
                        : ''}"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm font-medium text-slate-900">
                        {item.productName}
                        {#if item.variantName}
                          <span class="text-slate-500">· {item.variantName}</span>
                        {/if}
                      </div>
                      <div class="truncate text-[11px] text-slate-500">
                        {supplierLabel} · {item.quantity} {itemUnitCode} · {formatRupiah(subtotal)}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    class="mr-1.5 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Hapus dari keranjang"
                    onclick={() => removeFromCart(item.id)}
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>

                <!-- Expanded editor -->
                {#if expanded}
                  <div class="space-y-2 border-t border-slate-100 bg-slate-50/30 px-2.5 py-2.5">
                    <Select
                      label="Pemasok"
                      value={item.supplierId}
                      onchange={(e) =>
                        onItemSupplierChange(
                          item,
                          (e.currentTarget as HTMLSelectElement).value
                        )}
                      options={supplierOpts}
                    />

                    <Select
                      label="Satuan beli"
                      value={`${item.unitId}|${item.unitFactor}`}
                      onchange={(e) =>
                        onItemUnitChange(
                          item,
                          (e.currentTarget as HTMLSelectElement).value
                        )}
                      options={unitOpts}
                    />

                    {#if lastPrice}
                      <p class="text-[11px] text-slate-500">
                        Harga terakhir:
                        <span class="font-medium text-slate-700">
                          {formatRupiah(lastPrice.unitCost)}
                        </span>
                        <span class="text-slate-400">
                          ({lastPrice.daysAgo === 0
                            ? 'hari ini'
                            : lastPrice.daysAgo < 7
                              ? `${lastPrice.daysAgo} hari lalu`
                              : lastPrice.daysAgo < 30
                                ? `${Math.floor(lastPrice.daysAgo / 7)} mg lalu`
                                : `${Math.floor(lastPrice.daysAgo / 30)} bln lalu`})
                        </span>
                      </p>
                    {/if}

                    <div class="grid grid-cols-[80px_1fr] gap-2">
                      <Input
                        label="Qty"
                        type="number"
                        min="1"
                        step="1"
                        bind:value={item.quantity}
                      />
                      <Input
                        label="Harga estimasi"
                        type="number"
                        min="0"
                        step="any"
                        bind:value={item.unitPrice}
                      />
                    </div>

                    {#if item.unitFactor > 1 && baseUnitCode}
                      <p class="text-[11px] text-slate-500">
                        = <span class="font-medium text-slate-700">{baseQty} {baseUnitCode}</span>
                        ({item.quantity} × {item.unitFactor})
                      </p>
                    {/if}

                    <div class="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                      <span class="text-slate-500">Subtotal</span>
                      <span class="font-semibold text-slate-900">{formatRupiah(subtotal)}</span>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      {#if groups.length > 0}
        <Card>
          <div class="mb-3 flex items-center gap-2">
            <Layers class="h-4 w-4 text-slate-500" />
            <h3 class="text-sm font-semibold text-slate-900">Akan dibuat {groups.length} PO</h3>
          </div>
          <p class="mb-3 text-xs text-slate-500">
            Sistem otomatis bikin satu PO draft per pemasok. Setelah dibuat, kamu bisa buka
            masing-masing untuk review sebelum dikirim ke pemasok.
          </p>
          <div class="space-y-1.5">
            {#each groups as g (g.supplierId)}
              <div
                class="flex items-center justify-between gap-2 rounded-md bg-slate-50/60 px-2.5 py-2 text-sm"
              >
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-900">{g.supplierName}</div>
                  <div class="text-xs text-slate-500">{g.items.length} item</div>
                </div>
                <span class="font-semibold text-slate-900">{formatRupiah(g.totalEstimate)}</span>
              </div>
            {/each}
          </div>
          <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
            <span class="text-slate-500">Estimasi total semua PO</span>
            <span class="text-lg font-semibold text-slate-900">{formatRupiah(cartTotal)}</span>
          </div>
        </Card>
      {/if}
    </div>
  </div>

  <div
    class="sticky bottom-0 -mx-4 mt-6 flex items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
  >
    <div class="text-xs text-slate-500">
      {#if cart.length === 0}
        Mulai dengan mencentang produk di tabel kiri.
      {:else if itemsMissingSupplier > 0}
        <span class="text-rose-600">
          {itemsMissingSupplier} item belum punya pemasok terpilih.
        </span>
      {:else if itemsZeroQty > 0}
        <span class="text-rose-600">{itemsZeroQty} item qty-nya 0.</span>
      {:else}
        Siap membuat <span class="font-semibold">{groups.length} PO</span> untuk
        <span class="font-semibold">{cart.length} item</span>.
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <Button variant="outline" onclick={() => goto('/purchase-orders')}>Batal</Button>
      <Button onclick={attemptSubmit} disabled={!canSubmit}>
        Buat {groups.length} PO
        <ArrowRight class="h-4 w-4" />
      </Button>
    </div>
  </div>
{/if}

<ConfirmDialog
  bind:open={confirmSubmitOpen}
  title="Buat {groups.length} PO sekaligus?"
  message="{cart.length} item akan dibagi ke {groups.length} PO draft (satu per pemasok). Total estimasi: {formatRupiah(
    cartTotal
  )}. Setelah dibuat, tiap PO bisa di-review dan dikirim secara individual."
  confirmLabel="Buat semua PO"
  cancelLabel="Batalkan"
  variant="primary"
  onConfirm={doSubmit}
  onCancel={() => (confirmSubmitOpen = false)}
/>
