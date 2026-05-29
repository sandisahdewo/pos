<script lang="ts">
  import { Plus, Trash2, Receipt, AlertTriangle, TrendingUp, History } from 'lucide-svelte';
  import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Input,
    MoneyInput,
    Select,
    Textarea
  } from '$lib/components/ui';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import {
    products,
    basePrice,
    effectiveEntry,
    computeSalePrice,
    effectiveVariantCost
  } from '$lib/stores/products.svelte';
  import { pricelists } from '$lib/stores/pricelists.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { formatRupiah } from '$lib/utils/currency';
  import { latestSupplierPrice } from '$lib/utils/supplierAnalytics';
  import { toast } from '$lib/stores/toast.svelte';
  import {
    lineBaseQuantity,
    lineBaseUnitCost,
    lineSubtotal,
    purchaseOrderStatusLabels,
    purchaseOrderTypeLabels,
    type PurchaseOrder,
    type PurchaseOrderInput,
    type PurchaseOrderLine,
    type PurchaseOrderStatus,
    type PurchaseOrderType
  } from '$lib/stores/purchaseOrders.svelte';

  type Props = {
    purchaseOrder?: PurchaseOrder | null;
    submitLabel?: string;
    onSubmit: (data: PurchaseOrderInput) => void;
    onCancel: () => void;
  };

  let {
    purchaseOrder = null,
    submitLabel = 'Save draft',
    onSubmit,
    onCancel
  }: Props = $props();

  type FormState = {
    type: PurchaseOrderType;
    supplierId: string;
    status: PurchaseOrderStatus;
    orderDate: string;
    expectedDate: string;
    receivedDate: string;
    lines: PurchaseOrderLine[];
    notes: string;
  };

  function today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // Suggested HET (shelf price) per base unit from the default pricelist —
  // prefers the variant's own pricing when the line targets a variant.
  // Used to surface margin (HET − Setoran) on consignment PO lines.
  function suggestedHETPerBase(line: PurchaseOrderLine): number {
    const p = products.getById(line.productId);
    if (!p) return 0;
    const pricelistId = pricelists.defaultId();
    if (line.variantId) {
      const v = p.variants.find((vv) => vv.id === line.variantId);
      if (v) {
        const entry = effectiveEntry(v.prices, pricelistId, pricelistId);
        if (entry) return computeSalePrice(effectiveVariantCost(v, p), entry.pricing);
      }
    }
    return basePrice(p, pricelistId);
  }

  function initial(): FormState {
    return {
      type: purchaseOrder?.type ?? 'standard',
      supplierId: purchaseOrder?.supplierId ?? suppliers.active()[0]?.id ?? '',
      status: purchaseOrder?.status ?? 'draft',
      orderDate: purchaseOrder?.orderDate ?? today(),
      expectedDate: purchaseOrder?.expectedDate ?? '',
      receivedDate: purchaseOrder?.receivedDate ?? '',
      lines: purchaseOrder?.lines.map((l) => ({ ...l })) ?? [],
      notes: purchaseOrder?.notes ?? ''
    };
  }

  let form = $state<FormState>(initial());
  let errors = $state<Record<string, string>>({});

  // Pending state untuk konfirmasi ganti supplier. Saat operator ganti
  // supplier di header dan ada line yang produknya tidak terdaftar di
  // supplier baru, kita tahan perubahan + buka dialog konfirmasi sebelum
  // reset. Operator bisa cancel dan supplier kembali ke nilai semula.
  let pendingSupplierId = $state('');
  let confirmSupplierChangeOpen = $state(false);

  const typeOptions: { value: PurchaseOrderType; label: string }[] = [
    { value: 'standard', label: purchaseOrderTypeLabels.standard },
    { value: 'consignment', label: purchaseOrderTypeLabels.consignment }
  ];

  const supplierOptions = $derived(
    suppliers.active().map((s) => ({ value: s.id, label: s.name }))
  );

  // Filter produk berdasarkan pemasok yang dipilih di header. Operator
  // hanya bisa pilih produk yang punya entry di `Product.suppliers[]` untuk
  // pemasok ini — supaya master data tetap konsisten dengan pemasok yang
  // benar-benar bekerja sama. Kalau supplier belum dipilih, kosongkan dulu
  // (memaksa pilih supplier dulu).
  const productOptions = $derived(
    !form.supplierId
      ? []
      : products.items
          .filter((p) => p.status === 'active')
          .filter((p) => (p.suppliers ?? []).some((s) => s.supplierId === form.supplierId))
          .map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))
  );

  const productOptionsEmptyReason = $derived.by(() => {
    if (!form.supplierId) return 'pilih-supplier';
    if (productOptions.length === 0) return 'no-products-for-supplier';
    return 'has-products';
  });

  function variantOptionsFor(productId: string): { value: string; label: string }[] {
    const product = products.getById(productId);
    if (!product || product.variants.length === 0) return [];
    return [
      { value: '', label: '— Pick a variant —' },
      ...product.variants.map((v) => ({ value: v.id, label: `${v.name} (${v.sku})` }))
    ];
  }

  function unitOptionsFor(productId: string): { value: string; label: string }[] {
    const product = products.getById(productId);
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

  // Rantai prioritas untuk auto-suggest harga PO:
  //   1. variant.cost (paling spesifik kalau line pilih varian)
  //   2. ProductSupplier.unitCost untuk supplier yang dipilih di header
  //   3. product.cost (fallback master)
  // Operator tetap bebas override unitPrice di line.
  function productBaseCost(line: PurchaseOrderLine): number {
    const product = products.getById(line.productId);
    if (!product) return 0;
    if (line.variantId) {
      const v = product.variants.find((vv) => vv.id === line.variantId);
      if (v && v.cost > 0) return v.cost;
    }
    if (form.supplierId) {
      const ps = (product.suppliers ?? []).find((s) => s.supplierId === form.supplierId);
      if (ps && ps.unitCost > 0) return ps.unitCost;
    }
    return product.cost;
  }

  function defaultUnitPrice(line: PurchaseOrderLine): number {
    const factor = line.unitFactor > 0 ? line.unitFactor : 1;
    return productBaseCost(line) * factor;
  }

  // Hitung berapa line yang akan direset kalau supplier diganti ke `newId`.
  // "Reset" terjadi pada line yang sudah punya productId tapi produk itu
  // tidak terdaftar di pemasok baru.
  function countLinesToReset(newId: string): number {
    if (!newId) return 0;
    let count = 0;
    for (const line of form.lines) {
      if (!line.productId) continue;
      const product = products.getById(line.productId);
      const hasSupplier =
        product?.suppliers?.some((s) => s.supplierId === newId) ?? false;
      if (!hasSupplier) count++;
    }
    return count;
  }

  // Operator pilih supplier baru di Select. Cek apakah perubahan akan
  // mereset line; kalau iya, buka konfirmasi dulu. Kalau tidak ada line
  // yang terdampak (atau cuma reset 0 line), terapkan langsung.
  function requestSupplierChange(newId: string, selectEl: HTMLSelectElement) {
    if (newId === form.supplierId) return;
    const willReset = countLinesToReset(newId);
    if (willReset === 0) {
      form.supplierId = newId;
      applySupplierChange();
      return;
    }
    // Tahan dulu — buka dialog konfirmasi
    pendingSupplierId = newId;
    confirmSupplierChangeOpen = true;
    // Revert DOM select kembali ke supplier lama karena form.supplierId
    // belum berubah. Saat user konfirmasi, form.supplierId yang akan
    // di-update jadi pending value.
    selectEl.value = form.supplierId;
  }

  // Apply side effects setelah supplier benar-benar berganti:
  //   1. Line yang produknya valid → re-suggest unitPrice
  //   2. Line yang produknya tidak terdaftar → reset productId/variantId/
  //      unitId/factor/price. Qty + notes dipertahankan supaya operator
  //      bisa pick produk lain tanpa kehilangan plan.
  function applySupplierChange() {
    let resetCount = 0;
    for (const line of form.lines) {
      if (!line.productId) continue;
      const product = products.getById(line.productId);
      const hasSupplier =
        product?.suppliers?.some((s) => s.supplierId === form.supplierId) ?? false;
      if (!hasSupplier) {
        line.productId = '';
        line.variantId = undefined;
        line.unitId = '';
        line.unitFactor = 1;
        line.unitPrice = 0;
        resetCount++;
      } else {
        line.unitPrice = defaultUnitPrice(line);
      }
    }
    if (resetCount > 0) {
      toast.info(
        `${resetCount} baris direset`,
        'Pilih produk lagi di baris yang kosong. Qty & catatan kamu tetap utuh.'
      );
    }
  }

  function confirmSupplierChange() {
    form.supplierId = pendingSupplierId;
    applySupplierChange();
    pendingSupplierId = '';
    confirmSupplierChangeOpen = false;
  }

  function cancelSupplierChange() {
    pendingSupplierId = '';
    confirmSupplierChangeOpen = false;
    // DOM Select sudah kita revert sebelumnya di requestSupplierChange();
    // form.supplierId tidak pernah berubah, jadi nothing else to do.
  }

  // Konversi jumlah hari → label Indonesia yang natural.
  function daysAgoLabel(days: number): string {
    if (days <= 0) return 'hari ini';
    if (days === 1) return 'kemarin';
    if (days < 7) return `${days} hari lalu`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} minggu lalu`;
    }
    if (days < 365) {
      const months = Math.floor(days / 30);
      return `${months} bulan lalu`;
    }
    const years = Math.floor(days / 365);
    return `${years} tahun lalu`;
  }

  function addLine() {
    const firstProduct = productOptions[0]?.value ?? '';
    const product = products.getById(firstProduct);
    const initialPrice = product?.cost ?? 0;
    form.lines = [
      ...form.lines,
      {
        id: crypto.randomUUID(),
        productId: firstProduct,
        variantId: undefined,
        quantity: 1,
        receivedQty: 0,
        unitId: product?.unitId ?? '',
        unitFactor: 1,
        unitPrice: initialPrice,
        notes: ''
      }
    ];
  }

  function removeLine(i: number) {
    form.lines = form.lines.filter((_, idx) => idx !== i);
  }

  function onProductChange(line: PurchaseOrderLine) {
    const product = products.getById(line.productId);
    line.variantId = undefined;
    line.unitId = product?.unitId ?? '';
    line.unitFactor = 1;
    line.unitPrice = defaultUnitPrice(line);
  }

  function onVariantChange(line: PurchaseOrderLine) {
    line.unitPrice = defaultUnitPrice(line);
  }

  function onLineUnitChange(line: PurchaseOrderLine, value: string) {
    const [unitId, factorStr] = value.split('|');
    line.unitId = unitId;
    line.unitFactor = Number(factorStr) || 1;
    line.unitPrice = defaultUnitPrice(line);
  }

  const total = $derived(form.lines.reduce((s, l) => s + lineSubtotal(l), 0));
  const isEditing = $derived(!!purchaseOrder);
  const readOnly = $derived(isEditing && form.status !== 'draft');

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.supplierId) next.supplierId = 'Pilih pemasok.';
    if (!form.orderDate) next.orderDate = 'Tanggal order wajib diisi.';
    if (form.lines.length === 0) next.lines = 'Tambahkan minimal satu item.';

    form.lines.forEach((line, i) => {
      if (!line.productId) next[`l${i}_product`] = 'Pilih produk.';
      const product = products.getById(line.productId);
      if (product && product.variants.length > 0 && !line.variantId)
        next[`l${i}_variant`] = 'Pilih varian.';
      if (!Number.isInteger(line.quantity) || line.quantity <= 0)
        next[`l${i}_quantity`] = 'Kuantitas harus bilangan bulat positif.';
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0)
        next[`l${i}_unitPrice`] = 'Harga satuan harus 0 atau lebih.';
    });

    errors = next;
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (readOnly) return;
    if (!validate()) return;
    const payload: PurchaseOrderInput = {
      type: form.type,
      supplierId: form.supplierId,
      status: form.status,
      orderDate: form.orderDate,
      expectedDate: form.expectedDate,
      receivedDate: form.receivedDate,
      lines: form.lines,
      notes: form.notes.trim()
    };
    onSubmit(payload);
  }
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
  <div class="space-y-4 lg:col-span-2">
    <Card title="Header" description="Tipe, pemasok, dan tanggal.">
      <div class="grid gap-4 sm:grid-cols-2">
        <Select
          label="Tipe"
          bind:value={form.type}
          options={typeOptions}
          hint={form.type === 'consignment'
            ? 'Tidak ada utang dibuat saat diterima; dibayar saat barang terjual.'
            : 'Pembelian standar — membuat utang ke pemasok saat diterima.'}
        />
        <Select
          label="Pemasok"
          placeholder="Pilih pemasok"
          value={form.supplierId}
          onchange={(e) => {
            const target = e.currentTarget as HTMLSelectElement;
            requestSupplierChange(target.value, target);
          }}
          options={supplierOptions}
          error={errors.supplierId}
        />
        <Input
          label="Tanggal order"
          type="date"
          bind:value={form.orderDate}
          error={errors.orderDate}
        />
        <Input
          label="Estimasi tiba"
          type="date"
          bind:value={form.expectedDate}
          hint="Opsional. Estimasi tanggal kedatangan."
        />
        <Textarea
          class="sm:col-span-2"
          label="Catatan"
          placeholder="Termin pembayaran, preferensi pengiriman, dll."
          bind:value={form.notes}
        />
      </div>
    </Card>

    <Card>
      {#snippet header()}
        <Button
          size="sm"
          variant="outline"
          onclick={addLine}
          disabled={productOptions.length === 0}
        >
          <Plus class="h-4 w-4" />
          Tambah item
        </Button>
      {/snippet}
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-semibold text-slate-900">Item</h3>
        <p class="text-xs text-slate-500">
          Produk yang akan diorder dari pemasok. Harga estimasi otomatis terisi dari harga supplier
          atau biaya produk saat ini — harga sebenarnya bisa direvisi saat penerimaan barang.
        </p>
      </div>

      {#if errors.lines}
        <p class="mt-3 text-xs text-rose-600">{errors.lines}</p>
      {/if}

      {#if productOptionsEmptyReason === 'pilih-supplier'}
        <div
          class="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center"
        >
          <p class="text-sm font-medium text-slate-600">Pilih pemasok dulu</p>
          <p class="mt-1 text-xs text-slate-500">
            Daftar produk akan disesuaikan dengan pemasok yang dipilih di atas — hanya produk
            yang terdaftar di pemasok itu yang bisa di-PO.
          </p>
        </div>
      {:else if productOptionsEmptyReason === 'no-products-for-supplier'}
        <div
          class="mt-4 rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-4 py-6 text-center"
        >
          <p class="text-sm font-medium text-amber-800">Belum ada produk untuk pemasok ini</p>
          <p class="mt-1 text-xs text-amber-700">
            Tambahkan pemasok ini ke master produk dulu. Buka
            <a href="/products" class="font-medium underline hover:text-amber-900">Master Produk</a>
            → pilih produk → kartu Pemasok → tambah pemasok.
          </p>
        </div>
      {:else if form.lines.length === 0}
        <div
          class="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 py-6 text-center text-xs text-slate-500"
        >
          Belum ada item — klik "Tambah item" untuk menambahkan produk.
        </div>
      {:else}
        <div class="mt-4 space-y-3">
          {#each form.lines as line, i (line.id)}
            {@const variantOpts = variantOptionsFor(line.productId)}
            {@const unitOpts = unitOptionsFor(line.productId)}
            {@const subtotal = lineSubtotal(line)}
            {@const baseQty = lineBaseQuantity(line)}
            {@const baseUnitCost = lineBaseUnitCost(line)}
            {@const baseUnit = (() => {
              const p = products.getById(line.productId);
              return p ? units.getById(p.unitId) : undefined;
            })()}
            {@const isConsignment = form.type === 'consignment'}
            {@const hetPerBase = isConsignment && line.productId ? suggestedHETPerBase(line) : 0}
            {@const hetPerLineUnit = hetPerBase * (line.unitFactor || 1)}
            {@const lineMargin = hetPerLineUnit - line.unitPrice}
            {@const marginPct =
              hetPerLineUnit > 0 ? (lineMargin / hetPerLineUnit) * 100 : 0}
            {@const marginNegative = isConsignment && hetPerLineUnit > 0 && lineMargin < 0}
            {@const productForLine = products.getById(line.productId)}
            {@const supplierMOQ = (() => {
              if (!productForLine || !form.supplierId) return 0;
              const ps = (productForLine.suppliers ?? []).find(
                (s) => s.supplierId === form.supplierId
              );
              return ps?.minOrderQty ?? 0;
            })()}
            {@const moqShortfall = supplierMOQ > 0 && baseQty > 0 && baseQty < supplierMOQ}
            {@const lastFromSupplier =
              !isConsignment && line.productId && form.supplierId
                ? latestSupplierPrice(line.productId, line.variantId, form.supplierId)
                : null}
            {@const lastInLineUnit = lastFromSupplier
              ? lastFromSupplier.unitCost * (line.unitFactor || 1)
              : 0}
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <div class="grid gap-3 md:grid-cols-[2fr_1.5fr_auto] md:items-end">
                <Select
                  label="Produk"
                  placeholder="Pilih produk"
                  value={line.productId}
                  onchange={(e) => {
                    line.productId = (e.currentTarget as HTMLSelectElement).value;
                    onProductChange(line);
                  }}
                  options={productOptions}
                  error={errors[`l${i}_product`]}
                />
                {#if variantOpts.length > 0}
                  <Select
                    label="Varian"
                    value={line.variantId ?? ''}
                    onchange={(e) => {
                      const v = (e.currentTarget as HTMLSelectElement).value;
                      line.variantId = v || undefined;
                      onVariantChange(line);
                    }}
                    options={variantOpts}
                    error={errors[`l${i}_variant`]}
                  />
                {:else}
                  <div class="hidden md:block"></div>
                {/if}
                <button
                  type="button"
                  class="mb-[2px] inline-flex h-9 items-center justify-center rounded-md px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Hapus item"
                  onclick={() => removeLine(i)}
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <div class="mt-3 grid gap-3 md:grid-cols-[0.6fr_1.4fr_1fr_1fr_auto] md:items-end">
                <Input
                  label="Qty"
                  type="number"
                  step="1"
                  min="1"
                  bind:value={line.quantity}
                  error={errors[`l${i}_quantity`]}
                />
                <Select
                  label="Satuan"
                  value={`${line.unitId}|${line.unitFactor}`}
                  options={unitOpts}
                  onchange={(e) =>
                    onLineUnitChange(line, (e.currentTarget as HTMLSelectElement).value)}
                />
                <MoneyInput
                  label={isConsignment ? 'Setoran' : 'Harga estimasi'}
                  tooltip={isConsignment
                    ? 'Nilai setoran ke consignor — biasanya sudah disepakati di awal.'
                    : 'Estimasi harga yang dibayar ke pemasok. Sementara — bisa direvisi saat penerimaan kalau invoice supplier ternyata beda. Sumber autofill: harga supplier (kalau ada) → biaya varian → biaya master.'}
                  bind:value={line.unitPrice}
                  error={errors[`l${i}_unitPrice`]}
                />
                <Input label="Catatan item" placeholder="opsional" bind:value={line.notes} />
                <div class="text-right">
                  <span class="block text-xs font-medium text-slate-500">
                    {isConsignment ? 'Subtotal' : 'Estimasi subtotal'}
                  </span>
                  <span class="text-sm font-semibold text-slate-900">
                    {formatRupiah(subtotal)}
                  </span>
                </div>
              </div>
              {#if line.unitFactor !== 1 && baseUnit}
                <p class="mt-2 text-xs text-slate-500">
                  <span class="font-medium text-slate-700">{line.quantity} × {line.unitFactor}</span>
                  = <span class="font-medium text-slate-700">{baseQty} {baseUnit.code}</span>
                  &middot; biaya per {baseUnit.code}
                  <span class="font-medium text-slate-700">{formatRupiah(baseUnitCost)}</span>
                </p>
              {/if}
              {#if moqShortfall && baseUnit}
                <div
                  class="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
                >
                  <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Pemasok ini biasanya minta minimal
                    <span class="font-semibold">{supplierMOQ} {baseUnit.code}</span>
                    per pesanan. Saat ini cuma {baseQty} {baseUnit.code}.
                  </span>
                </div>
              {/if}
              {#if lastFromSupplier && baseUnit}
                {@const unitLabel = line.unitFactor > 1 ? line.unitId : baseUnit.id}
                {@const lineUnitObj = units.getById(unitLabel)}
                {@const lineUnitCode = lineUnitObj?.code ?? baseUnit.code}
                <div
                  class="mt-2 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs text-sky-900"
                >
                  <History class="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div class="flex-1 flex-wrap">
                    <span>
                      Harga terakhir dari pemasok ini:
                      <span class="font-semibold">{formatRupiah(lastInLineUnit)}</span> / {lineUnitCode}
                      <span class="text-sky-700">· {daysAgoLabel(lastFromSupplier.daysAgo)}</span>
                    </span>
                    {#if lastFromSupplier.previousCost !== undefined && Math.abs(lastFromSupplier.deltaPct) > 0.5}
                      <span class="ml-2">
                        <Badge
                          variant={lastFromSupplier.deltaPct > 0 ? 'danger' : 'success'}
                          size="sm"
                        >
                          {lastFromSupplier.deltaPct > 0 ? '+' : ''}{lastFromSupplier.deltaPct.toFixed(1)}% dari sebelumnya
                        </Badge>
                      </span>
                    {/if}
                    {#if lastFromSupplier.totalReceipts > 1}
                      <span class="text-sky-700">
                        · sudah {lastFromSupplier.totalReceipts}× diterima
                      </span>
                    {/if}
                  </div>
                </div>
              {/if}
              {#if isConsignment && line.productId}
                <div
                  class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-2.5 py-1.5 text-xs
                    {marginNegative
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-100 bg-emerald-50/60 text-emerald-800'}"
                >
                  {#if marginNegative}
                    <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                  {:else}
                    <TrendingUp class="h-3.5 w-3.5 shrink-0" />
                  {/if}
                  {#if hetPerLineUnit > 0}
                    <span>
                      HET disarankan
                      <span class="font-semibold">{formatRupiah(hetPerLineUnit)}</span>
                    </span>
                    <span class="text-slate-400">·</span>
                    <span>
                      Margin
                      <span class="font-semibold">
                        {lineMargin >= 0 ? '+' : ''}{formatRupiah(lineMargin)}
                      </span>
                      {#if marginPct !== 0}
                        <span class="opacity-70">({marginPct.toFixed(1)}%)</span>
                      {/if}
                    </span>
                    {#if marginNegative}
                      <span class="ml-auto font-semibold">
                        Setoran melebihi harga jual saat ini.
                      </span>
                    {/if}
                  {:else}
                    <span class="text-slate-500">
                      Produk ini belum memiliki harga jual — margin tidak bisa ditampilkan.
                    </span>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if form.lines.length > 0}
        <div class="mt-4 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
          <span class="text-sm text-slate-500">
            {form.type === 'consignment' ? 'Total' : 'Estimasi total'}
          </span>
          <span class="text-lg font-semibold text-slate-900">{formatRupiah(total)}</span>
        </div>
        {#if form.type !== 'consignment'}
          <p class="mt-1 text-right text-xs text-slate-500">
            Harga sebenarnya diisi saat penerimaan barang.
          </p>
        {/if}
      {/if}
    </Card>
  </div>

  <div class="space-y-4">
    <Card title="Summary">
      <dl class="space-y-2 text-sm">
        {#if purchaseOrder?.code}
          <div class="flex justify-between">
            <dt class="text-slate-500">Code</dt>
            <dd class="font-mono text-xs font-medium text-slate-900">{purchaseOrder.code}</dd>
          </div>
        {/if}
        <div class="flex justify-between">
          <dt class="text-slate-500">Status</dt>
          <dd>
            <Badge variant={form.status === 'draft' ? 'neutral' : 'brand'} size="sm">
              {purchaseOrderStatusLabels[form.status]}
            </Badge>
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-slate-500">Tipe</dt>
          <dd class="font-medium text-slate-900">
            {purchaseOrderTypeLabels[form.type]}
          </dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-slate-500">Item</dt>
          <dd class="font-medium text-slate-900">{form.lines.length}</dd>
        </div>
        <div class="flex justify-between border-t border-slate-100 pt-2">
          <dt class="text-slate-500">
            {form.type === 'consignment' ? 'Total' : 'Estimasi total'}
          </dt>
          <dd class="font-semibold text-slate-900">{formatRupiah(total)}</dd>
        </div>
      </dl>
    </Card>

    <Card>
      <div class="flex items-start gap-2">
        <Receipt class="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p class="text-xs text-slate-500">
          {form.type === 'consignment'
            ? 'PO konsinyasi menambah stok saat diterima, tetapi tidak menciptakan utang ke pemasok sampai barang terjual.'
            : 'PO standar menambah stok dan mencatat batch baru saat diterima. Utang ke pemasok akan dibuat ketika modul akuntansi siap.'}
        </p>
      </div>
    </Card>
  </div>
</div>

<div
  class="sticky bottom-0 -mx-4 mt-6 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
>
  <Button variant="outline" onclick={onCancel}>Batal</Button>
  <Button onclick={submit}>{submitLabel}</Button>
</div>

<ConfirmDialog
  bind:open={confirmSupplierChangeOpen}
  title="Ganti pemasok?"
  message={(() => {
    const newName = suppliers.getById(pendingSupplierId)?.name ?? 'pemasok baru';
    const oldName = suppliers.getById(form.supplierId)?.name ?? 'pemasok lama';
    const resetCount = countLinesToReset(pendingSupplierId);
    return `Ganti dari "${oldName}" ke "${newName}"? ${resetCount} baris akan kehilangan pilihan produk karena produknya tidak terdaftar di "${newName}". Qty & catatan kamu tetap utuh — kamu cukup pilih produk lagi.`;
  })()}
  confirmLabel="Lanjut ganti pemasok"
  cancelLabel="Batalkan"
  variant="primary"
  onConfirm={confirmSupplierChange}
  onCancel={cancelSupplierChange}
/>
