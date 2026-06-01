<script lang="ts">
  import {
    Search,
    TrendingDown,
    AlertCircle,
    Package,
    Truck,
    Boxes,
    Settings as SettingsIcon,
    ClipboardList,
    ExternalLink,
    Check,
    CheckSquare,
    Square,
    X as XIcon
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
    Textarea
  } from '$lib/components/ui';
  import {
    dailySalesRate,
    daysOfSupply,
    formatRunway,
    forecastSubjects,
    leadDaysFor,
    runwayBandFor,
    runwayBandLabels,
    runwayBandVariant,
    suggestedReorderQty,
    type ForecastSubject,
    type RunwayBand
  } from '$lib/utils/forecast';
  import { categories } from '$lib/stores/categories.svelte';
  import { units } from '$lib/stores/units.svelte';
  import { suppliers } from '$lib/stores/suppliers.svelte';
  import {
    costFromSupplier,
    primarySupplier,
    productLeadDays,
    products,
    type ProductSupplier
  } from '$lib/stores/products.svelte';
  import { stockByLocation } from '$lib/stores/batches.svelte';
  import { locations } from '$lib/stores/locations.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { purchaseOrders } from '$lib/stores/purchaseOrders.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  const locationsOn = $derived(settings.value.inventory.locationsEnabled);

  let search = $state('');
  let windowDaysStr = $state<string>('30');
  const windowDays = $derived(Number(windowDaysStr) || 30);
  let bufferDays = $state<number>(7);
  let categoryFilter = $state<string>('');
  let locationFilter = $state<string>('');
  let supplierFilter = $state<string>('');
  let urgencyFilter = $state<'' | RunwayBand>('');
  let hideNoSales = $state<boolean>(true);

  // Multi-select state for bulk PO
  let selectedById = $state<Record<string, boolean>>({});

  function selectionKey(r: { productId: string; variantId?: string }): string {
    return `${r.productId}::${r.variantId ?? ''}`;
  }
  function isSelected(r: { productId: string; variantId?: string }): boolean {
    return !!selectedById[selectionKey(r)];
  }
  function toggleSelected(r: { productId: string; variantId?: string }, checked: boolean) {
    selectedById = { ...selectedById, [selectionKey(r)]: checked };
  }
  function selectAllFiltered(rows: { productId: string; variantId?: string }[]) {
    const next: Record<string, boolean> = { ...selectedById };
    for (const r of rows) next[selectionKey(r)] = true;
    selectedById = next;
  }
  function clearSelection() {
    selectedById = {};
  }

  const windowOptions = [
    { value: '7', label: 'Rolling 7 hari' },
    { value: '14', label: 'Rolling 14 hari' },
    { value: '30', label: 'Rolling 30 hari' },
    { value: '60', label: 'Rolling 60 hari' },
    { value: '90', label: 'Rolling 90 hari' }
  ];

  const categoryOptions = $derived([
    { value: '', label: 'Semua kategori' },
    ...categories.items.map((c) => ({ value: c.id, label: c.name }))
  ]);

  const locationOptions = $derived([
    { value: '', label: 'Semua lokasi' },
    ...locations.sortedActive().map((l) => ({ value: l.id, label: l.name }))
  ]);

  const supplierFilterOptions = $derived([
    { value: '', label: 'Semua pemasok' },
    { value: '__none__', label: 'Tanpa pemasok' },
    ...suppliers.active().map((s) => ({
      value: s.id,
      label: s.leadTimeDays > 0 ? `${s.name} (tunggu ${s.leadTimeDays}h)` : s.name
    }))
  ]);

  const urgencyOptions: { value: '' | RunwayBand; label: string }[] = [
    { value: '', label: 'Semua tingkat' },
    { value: 'critical', label: '🔴 Kritis (≤3 hari)' },
    { value: 'low', label: '🟠 Menipis (≤7 hari)' },
    { value: 'watch', label: '🟡 Perhatikan (≤14 hari)' },
    { value: 'ok', label: '🟢 Aman (>14 hari)' },
    { value: 'inactive', label: '⚪ Tidak ada penjualan' }
  ];

  type Row = ForecastSubject & {
    rate: number;
    stock: number;
    runway: number;
    band: RunwayBand;
    reorderQty: number;
    leadDays: number;
    supplierName: string;
  };

  function stockAtLocation(productId: string, variantId: string | undefined, locId: string): number {
    return stockByLocation(productId, variantId).get(locId) ?? 0;
  }

  function buildRow(s: ForecastSubject): Row {
    const rate = dailySalesRate(s.productId, s.variantId, windowDays);
    const stock =
      locationsOn && locationFilter
        ? stockAtLocation(s.productId, s.variantId, locationFilter)
        : // currentStockFor is the right primitive for both goods & composite
          (() => {
            // inline to avoid importing — we already have producible* / stockOf semantics elsewhere
            const p = products.getById(s.productId);
            if (!p) return 0;
            if (p.kind === 'composite') {
              // composites use producibleStock; for variants use producibleVariantStock
              // simpler: compute via daysOfSupply * rate inverse — but we want raw stock
              // Just call into the util's currentStockFor by re-importing if needed
              return rate > 0 ? rate * daysOfSupply(s.productId, s.variantId, windowDays) : 0;
            }
            // Goods: stock is independent of rate. Use a direct value via daysOfSupply
            // (Infinity rate-0 case handled separately above; here rate > 0)
            return rate > 0
              ? rate * daysOfSupply(s.productId, s.variantId, windowDays)
              : // when no sales, compute stock directly via stockByLocation summed
                [...stockByLocation(s.productId, s.variantId).values()].reduce((a, b) => a + b, 0);
          })();
    const runway = daysOfSupply(s.productId, s.variantId, windowDays);
    const band = runwayBandFor(runway);
    const leadDays = leadDaysFor(s.productId);
    const reorderQty = suggestedReorderQty({
      productId: s.productId,
      variantId: s.variantId,
      windowDays,
      leadDays,
      bufferDays
    });
    const supplierName = s.defaultSupplierId
      ? suppliers.getById(s.defaultSupplierId)?.name ?? '—'
      : '—';
    return {
      ...s,
      rate,
      stock,
      runway,
      band,
      reorderQty,
      leadDays,
      supplierName
    };
  }

  const allRows = $derived(forecastSubjects().map(buildRow));

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return allRows
      .filter((r) => {
        if (categoryFilter && r.categoryId !== categoryFilter) return false;
        if (hideNoSales && r.band === 'inactive') return false;
        if (urgencyFilter && r.band !== urgencyFilter) return false;
        if (locationsOn && locationFilter && r.stock <= 0) return false;
        if (supplierFilter === '__none__') {
          if (r.defaultSupplierId) return false;
        } else if (supplierFilter) {
          if (r.defaultSupplierId !== supplierFilter) return false;
        }
        if (!q) return true;
        const hay = `${r.productName} ${r.variantName ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        if (a.band === 'inactive' && b.band !== 'inactive') return 1;
        if (b.band === 'inactive' && a.band !== 'inactive') return -1;
        return a.runway - b.runway;
      });
  });

  const selectedRows = $derived(allRows.filter((r) => isSelected(r)));
  const selectedCount = $derived(selectedRows.length);
  const selectedWithSupplier = $derived(
    selectedRows.filter((r) => r.defaultSupplierId)
  );
  const selectedWithoutSupplier = $derived(
    selectedRows.filter((r) => !r.defaultSupplierId)
  );
  const selectedSupplierCount = $derived(
    new Set(selectedWithSupplier.map((r) => r.defaultSupplierId)).size
  );

  // Stats: count of items in each band (regardless of urgencyFilter)
  const bandCounts = $derived.by(() => {
    const counts: Record<RunwayBand, number> = {
      critical: 0,
      low: 0,
      watch: 0,
      ok: 0,
      inactive: 0
    };
    for (const r of allRows) {
      if (categoryFilter && r.categoryId !== categoryFilter) continue;
      if (locationsOn && locationFilter && r.stock <= 0) continue;
      counts[r.band] += 1;
    }
    return counts;
  });

  function unitCodeFor(productId: string): string {
    const p = products.getById(productId);
    if (!p) return '';
    return units.getById(p.unitId)?.code ?? '';
  }

  function fmtRate(rate: number, productId: string): string {
    if (rate <= 0) return '—';
    const u = unitCodeFor(productId);
    if (rate < 1) return `~${rate.toFixed(2)}/hari${u ? ` ${u}` : ''}`;
    if (rate < 10) return `~${rate.toFixed(1)}/hari${u ? ` ${u}` : ''}`;
    return `~${Math.round(rate)}/hari${u ? ` ${u}` : ''}`;
  }

  const columns = [
    { key: 'select' as const, label: '', width: '44px' },
    { key: 'product' as const, label: 'Produk' },
    { key: 'stock' as const, label: 'Stok', align: 'right' as const, width: '110px' },
    { key: 'rate' as const, label: 'Kecepatan jual', align: 'right' as const, width: '160px' },
    { key: 'runway' as const, label: 'Sisa hari', align: 'right' as const, width: '150px' },
    { key: 'reorder' as const, label: 'Reorder ideal', align: 'right' as const, width: '160px' },
    { key: 'supplier' as const, label: 'Pemasok', width: '160px' },
    { key: 'actions' as const, label: '', align: 'right' as const, width: '140px' }
  ];

  // === Buat PO modal ===
  let poOpen = $state(false);
  let poRow = $state<Row | null>(null);
  let poQty = $state<number>(0);
  let poSupplierId = $state<string>('');
  let poUnitPrice = $state<number>(0);
  let poNotes = $state<string>('');
  let poError = $state<string>('');

  // Supplier options for the single-row Buat PO modal: product's own supplier
  // list first (primary highlighted), then a "Lainnya" group with the rest of
  // the active suppliers (in case admin wants to source from someone new).
  const poSupplierOptions = $derived.by(() => {
    if (!poRow) {
      return [{ value: '', label: 'Pilih pemasok…' }];
    }
    const product = products.getById(poRow.productId);
    const productSupplierIds = new Set(product?.suppliers.map((s) => s.supplierId) ?? []);
    const productEntries = (product?.suppliers ?? [])
      .map((ps) => {
        const sup = suppliers.getById(ps.supplierId);
        if (!sup) return null;
        return {
          value: ps.supplierId,
          label: `${ps.isPrimary ? '★ ' : ''}${sup.name} · Rp ${ps.unitCost.toLocaleString('id-ID')}${ps.leadTimeDays !== undefined ? ` · tunggu ${ps.leadTimeDays}h` : sup.leadTimeDays > 0 ? ` · tunggu ${sup.leadTimeDays}h` : ''}`
        };
      })
      .filter((o): o is { value: string; label: string } => o !== null);
    const others = suppliers
      .active()
      .filter((s) => !productSupplierIds.has(s.id))
      .map((s) => ({
        value: s.id,
        label: `· ${s.name}${s.leadTimeDays > 0 ? ` (tunggu ${s.leadTimeDays}h)` : ''}`
      }));
    return [
      { value: '', label: 'Pilih pemasok…' },
      ...productEntries,
      ...(others.length > 0
        ? [{ value: '__sep__', label: '— Pemasok lain —' }, ...others]
        : [])
    ];
  });

  // Recompute suggested qty when supplier changes. Uses product-specific
  // lead-time override when present, falls back to Supplier.leadTimeDays.
  const poSuggestedQty = $derived.by(() => {
    if (!poRow) return 0;
    const lead = poSupplierId
      ? leadDaysFor(poRow.productId, poSupplierId)
      : poRow.leadDays;
    if (poRow.rate <= 0) return 0;
    return Math.ceil(poRow.rate * (lead + bufferDays));
  });

  function openBuatPO(row: Row) {
    poRow = row;
    const product = products.getById(row.productId);
    const ps = product ? primarySupplier(product) : undefined;
    poSupplierId = ps?.supplierId ?? row.defaultSupplierId ?? '';
    poQty = row.reorderQty > 0 ? row.reorderQty : Math.max(1, Math.ceil(row.rate * 14));
    if (product && poSupplierId) {
      poUnitPrice = costFromSupplier(product, poSupplierId);
    } else if (row.variantId && product) {
      const v = product.variants.find((vv) => vv.id === row.variantId);
      poUnitPrice = v?.cost ?? product.cost ?? 0;
    } else {
      poUnitPrice = product?.cost ?? 0;
    }
    poNotes = `Auto-generated dari Prediksi Stok · sisa ${formatRunway(row.runway)} · kecepatan ${fmtRate(row.rate, row.productId)}`;
    poError = '';
    poQtyDirty = false;
    poOpen = true;
  }

  // Auto-update qty + price when supplier changes (uses new supplier's
  // lead-time + ProductSupplier.unitCost). Qty is sticky if admin edited it.
  let poQtyDirty = $state(false);
  function onPOSupplierChange() {
    // Reject the separator selection
    if (poSupplierId === '__sep__') {
      poSupplierId = '';
      return;
    }
    if (!poQtyDirty) {
      poQty = poSuggestedQty;
    }
    if (poRow && poSupplierId) {
      const product = products.getById(poRow.productId);
      if (product) {
        poUnitPrice = costFromSupplier(product, poSupplierId);
      }
    }
  }
  function onPOQtyInput(v: number) {
    poQty = v;
    poQtyDirty = true;
  }

  // === Bulk Buat PO modal ===
  // Each line is flat with its own supplierId; groups are derived live so that
  // changing one line's supplier moves it to a different (or new) group.
  type BulkLine = {
    rowKey: string;
    row: Row;
    qty: number;
    supplierId: string;
    unitPrice: number;
  };
  type BulkGroup = {
    supplierId: string;
    supplierName: string;
    leadTimeDays: number;
    lines: BulkLine[];
  };

  let bulkOpen = $state(false);
  let bulkLines = $state<BulkLine[]>([]);
  let bulkError = $state<string>('');

  function defaultQtyFor(row: Row): number {
    if (row.reorderQty > 0) return row.reorderQty;
    return Math.max(1, Math.ceil(row.rate * 14));
  }

  function openBulkPO() {
    if (selectedWithSupplier.length === 0) {
      bulkError = 'Tidak ada item yang punya pemasok default. Set pemasok di Data Master → Produk dulu.';
      bulkOpen = true;
      bulkLines = [];
      return;
    }
    const lines: BulkLine[] = [];
    for (const row of selectedWithSupplier) {
      const product = products.getById(row.productId);
      const ps = product ? primarySupplier(product) : undefined;
      const supId = ps?.supplierId ?? row.defaultSupplierId ?? '';
      const unitPrice = product && supId ? costFromSupplier(product, supId) : 0;
      lines.push({
        rowKey: selectionKey(row),
        row,
        qty: defaultQtyFor(row),
        supplierId: supId,
        unitPrice
      });
    }
    bulkLines = lines;
    bulkError = '';
    bulkOpen = true;
  }

  const bulkGroups = $derived.by<BulkGroup[]>(() => {
    const grouped = new Map<string, BulkGroup>();
    for (const l of bulkLines) {
      if (!l.supplierId) continue;
      const sup = suppliers.getById(l.supplierId);
      if (!sup) continue;
      let group = grouped.get(l.supplierId);
      if (!group) {
        group = {
          supplierId: l.supplierId,
          supplierName: sup.name,
          leadTimeDays: sup.leadTimeDays,
          lines: []
        };
        grouped.set(l.supplierId, group);
      }
      group.lines.push(l);
    }
    return [...grouped.values()].sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName)
    );
  });

  function updateBulkQty(rowKey: string, qty: number) {
    bulkLines = bulkLines.map((l) =>
      l.rowKey !== rowKey ? l : { ...l, qty: Math.max(0, qty) }
    );
  }
  function updateBulkPrice(rowKey: string, unitPrice: number) {
    bulkLines = bulkLines.map((l) =>
      l.rowKey !== rowKey ? l : { ...l, unitPrice: Math.max(0, unitPrice) }
    );
  }
  function updateBulkSupplier(rowKey: string, supplierId: string) {
    if (supplierId === '__sep__') return;
    bulkLines = bulkLines.map((l) => {
      if (l.rowKey !== rowKey) return l;
      const product = products.getById(l.row.productId);
      const newPrice =
        product && supplierId ? costFromSupplier(product, supplierId) : l.unitPrice;
      return { ...l, supplierId, unitPrice: newPrice };
    });
  }
  function removeBulkLine(rowKey: string) {
    bulkLines = bulkLines.filter((l) => l.rowKey !== rowKey);
  }

  // Supplier options for a single bulk line (product's suppliers + others).
  function bulkSupplierOptionsForLine(line: BulkLine): { value: string; label: string }[] {
    const product = products.getById(line.row.productId);
    const productSupplierIds = new Set(product?.suppliers.map((s) => s.supplierId) ?? []);
    const productEntries = (product?.suppliers ?? [])
      .map((ps) => {
        const sup = suppliers.getById(ps.supplierId);
        if (!sup) return null;
        return {
          value: ps.supplierId,
          label: `${ps.isPrimary ? '★ ' : ''}${sup.name} · Rp ${ps.unitCost.toLocaleString('id-ID')}`
        };
      })
      .filter((o): o is { value: string; label: string } => o !== null);
    const others = suppliers
      .active()
      .filter((s) => !productSupplierIds.has(s.id))
      .map((s) => ({
        value: s.id,
        label: `· ${s.name}`
      }));
    return [
      ...productEntries,
      ...(others.length > 0
        ? [{ value: '__sep__', label: '— Pemasok lain —' }, ...others]
        : [])
    ];
  }

  function bulkGroupTotal(g: BulkGroup): number {
    return g.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  }
  const bulkGrandTotal = $derived(
    bulkGroups.reduce((s, g) => s + bulkGroupTotal(g), 0)
  );
  const bulkLineCount = $derived(bulkLines.length);

  function saveBulkPOs() {
    bulkError = '';
    if (bulkGroups.length === 0) {
      bulkError = 'Tidak ada item untuk dibuat PO.';
      return;
    }
    for (const g of bulkGroups) {
      for (const l of g.lines) {
        if (!Number.isFinite(l.qty) || l.qty <= 0) {
          bulkError = `Qty ${l.row.productName}${l.row.variantName ? ` — ${l.row.variantName}` : ''} di ${g.supplierName} harus > 0.`;
          return;
        }
        if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0) {
          bulkError = `Harga ${l.row.productName} di ${g.supplierName} harus ≥ 0.`;
          return;
        }
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const createdPOs = [];
    for (const g of bulkGroups) {
      const expected = new Date(Date.now() + g.leadTimeDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const lines = g.lines.map((l) => {
        const product = products.getById(l.row.productId);
        return {
          id: `pol_bulk_${crypto.randomUUID()}`,
          productId: l.row.productId,
          variantId: l.row.variantId,
          quantity: l.qty,
          receivedQty: 0,
          unitId: product?.unitId ?? '',
          unitFactor: 1,
          unitPrice: l.unitPrice,
          notes: ''
        };
      });
      const created = purchaseOrders.add({
        type: 'standard',
        supplierId: g.supplierId,
        status: 'draft',
        orderDate: today,
        expectedDate: expected,
        receivedDate: '',
        lines,
        notes: `Auto-generated dari Prediksi Stok · ${lines.length} item`
      });
      createdPOs.push(created);
    }

    toast.success(
      `${createdPOs.length} draft PO dibuat`,
      `${bulkLineCount} item dari ${createdPOs.length} pemasok.`
    );

    clearSelection();
    bulkOpen = false;
    if (createdPOs.length === 1) {
      goto(`/purchase-orders/${createdPOs[0].id}`);
    } else {
      goto('/purchase-orders');
    }
  }

  function savePO() {
    poError = '';
    if (!poRow) return;
    if (!poSupplierId) {
      poError = 'Pilih pemasok terlebih dulu.';
      return;
    }
    if (!Number.isFinite(poQty) || poQty <= 0) {
      poError = 'Jumlah harus lebih dari 0.';
      return;
    }
    if (!Number.isFinite(poUnitPrice) || poUnitPrice < 0) {
      poError = 'Harga beli harus 0 atau lebih.';
      return;
    }
    const product = products.getById(poRow.productId);
    if (!product) {
      poError = 'Produk tidak ditemukan.';
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const sup = suppliers.getById(poSupplierId);
    const lead = sup?.leadTimeDays ?? 0;
    const expected = new Date(Date.now() + lead * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const created = purchaseOrders.add({
      type: 'standard',
      supplierId: poSupplierId,
      status: 'draft',
      orderDate: today,
      expectedDate: expected,
      receivedDate: '',
      lines: [
        {
          id: `pol_fc_${crypto.randomUUID()}`,
          productId: poRow.productId,
          variantId: poRow.variantId,
          quantity: poQty,
          receivedQty: 0,
          unitId: product.unitId,
          unitFactor: 1,
          unitPrice: poUnitPrice,
          notes: ''
        }
      ],
      notes: poNotes.trim()
    });

    toast.success(
      `PO dibuat · ${created.code}`,
      `${poQty} ${units.getById(product.unitId)?.code ?? ''} ${poRow.productName}${poRow.variantName ? ` — ${poRow.variantName}` : ''}`
    );
    poOpen = false;
    poQtyDirty = false;
    goto(`/purchase-orders/${created.id}`);
  }

  function variantLabel(r: Row): string {
    if (!r.variantName) return r.productName;
    return `${r.productName} — ${r.variantName}`;
  }
</script>

<svelte:head>
  <title>Prediksi Stok · POS Admin</title>
</svelte:head>

<PageHeader
  title="Prediksi Stok"
  description="Perkiraan kapan stok produk akan habis berdasarkan kecepatan penjualan. Gunakan untuk merencanakan reorder."
  breadcrumb={[{ label: 'Wawasan' }, { label: 'Prediksi Stok' }]}
/>

<div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
  <div class="rounded-card border border-rose-200 bg-rose-50/40 p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-rose-700 uppercase">🔴 Kritis (≤3 hari)</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-rose-800">{bandCounts.critical}</p>
    <p class="mt-1 text-xs text-rose-700/70">Reorder hari ini juga</p>
  </div>
  <div class="rounded-card border border-amber-200 bg-amber-50/40 p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-amber-800 uppercase">🟠 Menipis (≤7 hari)</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-amber-900">{bandCounts.low}</p>
    <p class="mt-1 text-xs text-amber-800/70">Reorder minggu ini</p>
  </div>
  <div class="rounded-card border border-sky-200 bg-sky-50/40 p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-sky-700 uppercase">🟡 Perhatikan (≤14 hari)</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-sky-800">{bandCounts.watch}</p>
    <p class="mt-1 text-xs text-sky-700/70">Pantau, mulai siapkan PO</p>
  </div>
  <div class="rounded-card border border-emerald-200 bg-emerald-50/40 p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-emerald-700 uppercase">🟢 Aman (>14 hari)</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-emerald-800">{bandCounts.ok}</p>
    <p class="mt-1 text-xs text-emerald-700/70">Belum perlu tindakan</p>
  </div>
  <div class="rounded-card border border-slate-200 bg-slate-50/40 p-4 shadow-card">
    <p class="text-xs font-medium tracking-wide text-slate-600 uppercase">⚪ Tanpa penjualan</p>
    <p class="mt-2 text-2xl font-semibold tracking-tight text-slate-700">{bandCounts.inactive}</p>
    <p class="mt-1 text-xs text-slate-500">Tidak ada data 30 hari</p>
  </div>
</div>

<Card padded={false}>
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="min-w-[220px] flex-1">
      <Input placeholder="Cari produk atau varian…" bind:value={search}>
        {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
      </Input>
    </div>
    <Select bind:value={windowDaysStr} options={windowOptions} class="w-48" />
    <Select bind:value={categoryFilter} options={categoryOptions} class="w-44" />
    {#if locationsOn}
      <Select bind:value={locationFilter} options={locationOptions} class="w-40" />
    {/if}
    <Select bind:value={supplierFilter} options={supplierFilterOptions} class="w-52" />
    <Select bind:value={urgencyFilter} options={urgencyOptions} class="w-52" />
    <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
      <input
        type="checkbox"
        class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
        bind:checked={hideNoSales}
      />
      <span>Sembunyikan tanpa penjualan</span>
    </label>
  </div>

  <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-600">
    <div class="flex items-center gap-2">
      <SettingsIcon class="h-3.5 w-3.5 text-slate-400" />
      Cadangan reorder:
      <input
        type="number"
        min="0"
        max="30"
        bind:value={bufferDays}
        class="w-14 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-right text-xs focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span>hari (selain waktu tunggu pemasok)</span>
    </div>
    <span>
      {filtered.length} dari {allRows.length} produk
    </span>
  </div>

  {#if selectedCount > 0}
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-brand-50 px-4 py-2.5 text-sm">
      <div class="flex items-center gap-2 text-brand-900">
        <Check class="h-4 w-4 text-brand-600" />
        <span class="font-medium">
          {selectedCount} item dipilih
          {#if selectedSupplierCount > 0}
            <span class="ml-1 text-xs font-normal text-brand-700">
              · {selectedSupplierCount} pemasok berbeda → akan jadi {selectedSupplierCount} draft PO terpisah
            </span>
          {/if}
          {#if selectedWithoutSupplier.length > 0}
            <span class="ml-1 text-xs font-normal text-amber-700">
              · {selectedWithoutSupplier.length} item tanpa pemasok akan diabaikan
            </span>
          {/if}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <Button variant="outline" size="sm" onclick={clearSelection}>
          <XIcon class="h-3.5 w-3.5" />
          Batal pilih
        </Button>
        <Button size="sm" onclick={openBulkPO} disabled={selectedWithSupplier.length === 0}>
          <ClipboardList class="h-3.5 w-3.5" />
          Buat PO banyak
        </Button>
      </div>
    </div>
  {:else}
    <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
      <span>
        Pilih beberapa item untuk membuat banyak PO sekaligus (dikelompokkan per pemasok).
      </span>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        onclick={() => selectAllFiltered(filtered)}
        disabled={filtered.length === 0}
      >
        <CheckSquare class="h-3.5 w-3.5" />
        Pilih semua ({filtered.length})
      </button>
    </div>
  {/if}

  <Table {columns} rows={filtered} rowKey={(r) => `${r.productId}::${r.variantId ?? ''}`}>
    {#snippet cell({ row, column })}
      {#if column.key === 'select'}
        {@const sel = isSelected(row)}
        <label class="inline-flex cursor-pointer items-center">
          <span class="relative inline-flex h-5 w-5 items-center justify-center">
            <input
              type="checkbox"
              checked={sel}
              onchange={(e) => toggleSelected(row, (e.currentTarget as HTMLInputElement).checked)}
              class="peer absolute inset-0 h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white transition checked:border-brand-600 checked:bg-brand-600 hover:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
            <Check
              class="pointer-events-none h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
              strokeWidth={3}
            />
          </span>
        </label>
      {:else if column.key === 'product'}
        <div>
          <a
            href="/inventory/{row.productId}/history"
            class="text-sm font-medium text-slate-900 hover:text-brand-700"
          >
            {variantLabel(row)}
          </a>
          {#if row.kind === 'composite'}
            <Badge variant="info" size="sm" class="ml-1">Komposit</Badge>
          {/if}
        </div>
      {:else if column.key === 'stock'}
        {@const u = unitCodeFor(row.productId)}
        <span class="font-medium text-slate-900">
          {Math.round(row.stock)}
          {#if u}<span class="ml-0.5 text-[10px] font-normal text-slate-400">{u}</span>{/if}
        </span>
      {:else if column.key === 'rate'}
        <span class="text-sm text-slate-600">{fmtRate(row.rate, row.productId)}</span>
      {:else if column.key === 'runway'}
        <Badge variant={runwayBandVariant[row.band]} size="sm">
          {formatRunway(row.runway)}
        </Badge>
        <span class="ml-1 hidden text-[10px] text-slate-400 sm:inline">{runwayBandLabels[row.band]}</span>
      {:else if column.key === 'reorder'}
        {@const u = unitCodeFor(row.productId)}
        {#if row.reorderQty > 0}
          <span class="font-medium text-slate-800">
            {row.reorderQty}
            {#if u}<span class="ml-0.5 text-[10px] font-normal text-slate-400">{u}</span>{/if}
          </span>
          <div class="text-[10px] text-slate-400">
            tunggu {row.leadDays}h + cadangan {bufferDays}h
          </div>
        {:else}
          <span class="text-xs text-slate-400">—</span>
        {/if}
      {:else if column.key === 'supplier'}
        {#if row.defaultSupplierId}
          <div class="flex items-center gap-1.5 text-slate-700">
            <Truck class="h-3.5 w-3.5 text-slate-400" />
            <span class="text-sm">{row.supplierName}</span>
          </div>
        {:else}
          <span class="text-xs text-slate-400">Belum di-set</span>
        {/if}
      {:else if column.key === 'actions'}
        {#if row.band !== 'inactive'}
          <Button size="sm" variant="outline" onclick={() => openBuatPO(row)}>
            <ClipboardList class="h-3.5 w-3.5" />
            Buat PO
          </Button>
        {:else}
          <span class="text-xs text-slate-400">—</span>
        {/if}
      {/if}
    {/snippet}

    {#snippet empty()}
      <div class="flex flex-col items-center gap-2 py-12 text-center">
        {#if allRows.length === 0}
          <Package class="h-10 w-10 text-slate-300" />
          <p class="text-sm font-medium text-slate-600">Belum ada produk aktif</p>
          <p class="max-w-md text-xs text-slate-400">
            Tambahkan produk dan lakukan transaksi untuk mulai melihat prediksi stok di sini.
          </p>
        {:else if filtered.length === 0 && hideNoSales}
          <TrendingDown class="h-10 w-10 text-slate-300" />
          <p class="text-sm font-medium text-slate-600">Tidak ada produk yang cocok</p>
          <p class="max-w-md text-xs text-slate-400">
            Coba aktifkan "Sembunyikan tanpa penjualan" atau ubah filter — atau lakukan beberapa transaksi
            terlebih dulu agar prediksi punya data.
          </p>
        {:else}
          <Boxes class="h-10 w-10 text-slate-300" />
          <p class="text-sm font-medium text-slate-600">Tidak ada produk yang cocok</p>
          <p class="text-xs text-slate-400">Sesuaikan filter atau pencarian.</p>
        {/if}
      </div>
    {/snippet}
  </Table>
</Card>

<div class="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
  <p class="flex items-start gap-1.5">
    <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
    <span>
      Prediksi pakai <span class="font-medium text-slate-800">rata-rata penjualan harian</span> selama
      window terakhir. Spike musiman / akhir pekan tidak terdeteksi — jadikan ini panduan, bukan kebenaran
      absolut. <span class="font-medium text-slate-800">Reorder ideal</span> = kecepatan harian × (waktu
      tunggu pemasok + cadangan). Atur waktu tunggu per pemasok di Data Master → Pemasok.
    </span>
  </p>
</div>

<Modal
  bind:open={poOpen}
  size="lg"
  title="Buat PO{poRow ? ` · ${poRow.productName}${poRow.variantName ? ` — ${poRow.variantName}` : ''}` : ''}"
  description="Order pembelian baru sebagai draft. Anda bisa lanjutkan menambah baris atau langsung kirim ke pemasok dari halaman PO."
>
  {#if poRow}
    <div class="grid gap-4">
      <!-- Context box -->
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <span class="text-slate-500">Stok saat ini:</span>
            <span class="ml-1 font-medium text-slate-800">
              {Math.round(poRow.stock)}
              {units.getById(products.getById(poRow.productId)?.unitId ?? '')?.code ?? ''}
            </span>
          </div>
          <div>
            <span class="text-slate-500">Kecepatan:</span>
            <span class="ml-1 font-medium text-slate-800">{fmtRate(poRow.rate, poRow.productId)}</span>
          </div>
          <div>
            <span class="text-slate-500">Sisa hari:</span>
            <span class="ml-1 font-medium {poRow.band === 'critical' ? 'text-rose-700' : poRow.band === 'low' ? 'text-amber-700' : 'text-sky-700'}">
              {formatRunway(poRow.runway)}
            </span>
          </div>
          <div>
            <span class="text-slate-500">Saran qty:</span>
            <span class="ml-1 font-medium text-slate-800">
              {poSuggestedQty}
              {units.getById(products.getById(poRow.productId)?.unitId ?? '')?.code ?? ''}
            </span>
            <span class="ml-1 text-[10px] text-slate-400">
              (tunggu {suppliers.getById(poSupplierId)?.leadTimeDays ?? poRow.leadDays}h + cadangan {bufferDays}h)
            </span>
          </div>
        </div>
      </div>

      <Select
        label="Pemasok"
        bind:value={poSupplierId}
        options={poSupplierOptions}
        onchange={onPOSupplierChange}
        hint="Mengubah pemasok akan menyesuaikan saran qty (jika belum diubah manual) berdasarkan waktu tunggu pemasok baru."
      />

      <div class="grid gap-3 sm:grid-cols-2">
        <Input
          label="Qty pesan"
          type="number"
          min="1"
          step="1"
          value={poQty}
          oninput={(e) => onPOQtyInput(Number((e.currentTarget as HTMLInputElement).value))}
          hint={poQty !== poSuggestedQty && !poQtyDirty
            ? `Saran: ${poSuggestedQty}`
            : poQty < poSuggestedQty
              ? `Saran: ${poSuggestedQty} (kurang dari ideal)`
              : poQty > poSuggestedQty
                ? `Saran: ${poSuggestedQty} (lebih banyak dari ideal)`
                : 'Sesuai saran'}
        />
        <MoneyInput
          label="Harga beli per unit"
          bind:value={poUnitPrice}
          hint="Default: biaya saat ini. Sesuaikan jika kontrak pemasok berbeda."
        />
      </div>

      <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
        <div class="flex justify-between">
          <span class="text-slate-500">Total estimasi</span>
          <span class="font-semibold text-slate-900">{formatRupiah(poQty * poUnitPrice)}</span>
        </div>
      </div>

      <Textarea
        label="Catatan"
        bind:value={poNotes}
        placeholder="Detail pengiriman, syarat pembayaran, dll."
      />

      {#if poError}
        <p class="text-sm text-rose-600">{poError}</p>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (poOpen = false)}>Batal</Button>
    <Button onclick={savePO}>
      <ExternalLink class="h-4 w-4" />
      Buat draft & buka PO
    </Button>
  {/snippet}
</Modal>

<Modal
  bind:open={bulkOpen}
  size="xl"
  title="Buat banyak PO sekaligus"
  description="Item dikelompokkan per pemasok — setiap kelompok jadi satu draft PO. Anda bisa sesuaikan qty dan harga per baris, atau hapus baris yang tidak jadi dipesan."
>
  {#if bulkGroups.length === 0}
    <div class="flex flex-col items-center gap-2 py-12 text-center">
      <AlertCircle class="h-10 w-10 text-amber-500" />
      <p class="text-base font-semibold text-slate-900">Tidak ada item dengan pemasok</p>
      <p class="max-w-md text-sm text-slate-600">
        Semua item yang dipilih belum di-set pemasok default-nya. Buka Data Master → Produk dan set
        <span class="font-medium">Pemasok utama</span> dulu, atau pakai aksi
        <span class="font-medium">Buat PO</span> per baris untuk memilih pemasok manual.
      </p>
    </div>
  {:else}
    <div class="space-y-5">
      <div class="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-900">
        <div class="flex flex-wrap justify-between gap-2">
          <span>
            <span class="font-semibold">{bulkLineCount} baris</span>
            akan dibagi jadi <span class="font-semibold">{bulkGroups.length} draft PO</span>.
          </span>
          <span>
            Total estimasi: <span class="font-semibold">{formatRupiah(bulkGrandTotal)}</span>
          </span>
        </div>
      </div>

      {#each bulkGroups as g (g.supplierId)}
        {@const groupTotal = bulkGroupTotal(g)}
        <div class="overflow-hidden rounded-lg border border-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
            <div class="flex items-center gap-2">
              <Truck class="h-4 w-4 text-slate-500" />
              <span class="text-sm font-semibold text-slate-900">{g.supplierName}</span>
              <Badge variant="neutral" size="sm">
                Tunggu {g.leadTimeDays}h
              </Badge>
              <span class="text-xs text-slate-500">· {g.lines.length} baris</span>
            </div>
            <span class="text-sm font-semibold text-slate-900">{formatRupiah(groupTotal)}</span>
          </div>

          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-3 py-1.5 text-left font-medium">Produk</th>
                <th class="px-3 py-1.5 text-left font-medium" style="width: 200px;">Pemasok</th>
                <th class="px-3 py-1.5 text-right font-medium" style="width: 130px;">Qty pesan</th>
                <th class="px-3 py-1.5 text-right font-medium" style="width: 150px;">Harga / unit</th>
                <th class="px-3 py-1.5 text-right font-medium" style="width: 130px;">Subtotal</th>
                <th class="px-3 py-1.5" style="width: 40px;"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each g.lines as l (l.rowKey)}
                {@const u = unitCodeFor(l.row.productId)}
                {@const supOpts = bulkSupplierOptionsForLine(l)}
                <tr>
                  <td class="px-3 py-2">
                    <div class="text-sm font-medium text-slate-900">
                      {l.row.productName}
                      {#if l.row.variantName}
                        <span class="text-slate-500">— {l.row.variantName}</span>
                      {/if}
                    </div>
                    <div class="text-[10px] text-slate-500">
                      Stok {Math.round(l.row.stock)} {u} · sisa
                      <span class={l.row.band === 'critical' ? 'text-rose-700' : l.row.band === 'low' ? 'text-amber-700' : 'text-sky-700'}>
                        {formatRunway(l.row.runway)}
                      </span>
                      · saran {l.row.reorderQty} {u}
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <select
                      value={l.supplierId}
                      onchange={(e) =>
                        updateBulkSupplier(
                          l.rowKey,
                          (e.currentTarget as HTMLSelectElement).value
                        )}
                      class="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                    >
                      {#each supOpts as o (o.value)}
                        <option value={o.value} disabled={o.value === '__sep__'}>
                          {o.label}
                        </option>
                      {/each}
                    </select>
                  </td>
                  <td class="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={l.qty}
                      oninput={(e) =>
                        updateBulkQty(
                          l.rowKey,
                          Number((e.currentTarget as HTMLInputElement).value)
                        )}
                      class="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    {#if u}<span class="ml-1 text-[10px] text-slate-400">{u}</span>{/if}
                  </td>
                  <td class="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={l.unitPrice}
                      oninput={(e) =>
                        updateBulkPrice(
                          l.rowKey,
                          Number((e.currentTarget as HTMLInputElement).value)
                        )}
                      class="w-28 rounded-md border border-slate-200 px-2 py-1 text-right text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </td>
                  <td class="px-3 py-2 text-right text-sm font-semibold text-slate-900">
                    {formatRupiah(l.qty * l.unitPrice)}
                  </td>
                  <td class="px-1 py-2 text-right">
                    <button
                      type="button"
                      class="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Hapus baris"
                      onclick={() => removeBulkLine(l.rowKey)}
                    >
                      <XIcon class="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}

      {#if selectedWithoutSupplier.length > 0}
        <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p class="font-semibold">
            {selectedWithoutSupplier.length} item dipilih tapi tanpa pemasok default — diabaikan
          </p>
          <ul class="mt-1 list-disc pl-4">
            {#each selectedWithoutSupplier as r (selectionKey(r))}
              <li>
                {r.productName}{r.variantName ? ` — ${r.variantName}` : ''} (set Pemasok utama di Data Master → Produk)
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if bulkError}
        <p class="text-sm text-rose-600">{bulkError}</p>
      {/if}
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (bulkOpen = false)}>Batal</Button>
    {#if bulkGroups.length > 0}
      <Button onclick={saveBulkPOs}>
        <ClipboardList class="h-4 w-4" />
        Buat {bulkGroups.length} draft PO
      </Button>
    {/if}
  {/snippet}
</Modal>
