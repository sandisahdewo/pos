// Analitik harga supplier — semua derivasi dari `batches.items`. Tidak ada
// model baru: tiap Batch sudah menyimpan supplierId, unitCost, receivedAt,
// sourcePurchaseOrderId, jadi historynya emergent. Pakai ini di PO form
// panel kontekstual ("harga terakhir dari supplier ini") dan di modal
// perbandingan supplier per-produk.

import { batches, type Batch } from '$lib/stores/batches.svelte';
import { products } from '$lib/stores/products.svelte';
import { suppliers } from '$lib/stores/suppliers.svelte';

export type PriceHistoryPoint = {
  receivedAt: string;
  unitCost: number;        // per base unit
  batchId: string;
  batchCode: string;
  qtyReceived: number;
  sourcePurchaseOrderId?: string;
};

// History harga per (product, variant?, supplier) — sorted by receivedAt asc.
// Kunci utama panel kontekstual "harga terakhir dari supplier ini".
export function priceHistoryFor(
  productId: string,
  variantId: string | undefined,
  supplierId: string
): PriceHistoryPoint[] {
  return batches.items
    .filter(
      (b) =>
        b.productId === productId &&
        b.variantId === variantId &&
        b.supplierId === supplierId &&
        b.ownership === 'owned'
    )
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    .map((b) => ({
      receivedAt: b.receivedAt,
      unitCost: b.unitCost,
      batchId: b.id,
      batchCode: b.code,
      qtyReceived: b.qtyReceived,
      sourcePurchaseOrderId: b.sourcePurchaseOrderId
    }));
}

export type SupplierComparison = {
  supplierId: string;
  supplierName: string;
  avgCost: number;          // simple average (tidak weighted by qty)
  weightedAvgCost: number;  // weighted by qtyReceived — lebih representatif
  latestCost: number;       // dari batch terbaru
  previousCost?: number;    // dari batch sebelum terbaru (untuk delta)
  minCost: number;
  maxCost: number;
  batchCount: number;
  totalQtyReceived: number;
  lastReceivedAt: string;
  // Berapa kali harga naik antar receive consecutive.
  priceIncreaseCount: number;
  priceDecreaseCount: number;
};

// Bandingkan semua supplier yang pernah kirim produk ini. Digunakan di
// panel perbandingan per-produk supaya operator bisa decide PO berikutnya
// ke siapa.
//
// `variantId`:
//   - `undefined` → aggregate semua batch produk ini, lintas varian (cocok
//     untuk overview per-produk di ProductForm)
//   - string → strict filter ke varian itu saja
export function supplierComparison(
  productId: string,
  variantId?: string
): SupplierComparison[] {
  const byId = new Map<string, Batch[]>();
  for (const b of batches.items) {
    if (b.productId !== productId) continue;
    if (variantId !== undefined && b.variantId !== variantId) continue;
    if (b.ownership !== 'owned') continue;
    if (!b.supplierId) continue;
    const list = byId.get(b.supplierId) ?? [];
    list.push(b);
    byId.set(b.supplierId, list);
  }
  const out: SupplierComparison[] = [];
  for (const [supplierId, list] of byId) {
    const sorted = [...list].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const costs = sorted.map((b) => b.unitCost);
    const avgCost = costs.reduce((s, c) => s + c, 0) / costs.length;
    const totalQty = sorted.reduce((s, b) => s + b.qtyReceived, 0);
    const weightedAvgCost =
      totalQty > 0
        ? sorted.reduce((s, b) => s + b.unitCost * b.qtyReceived, 0) / totalQty
        : avgCost;
    const last = sorted[sorted.length - 1];
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : undefined;
    let priceIncrease = 0;
    let priceDecrease = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].unitCost > sorted[i - 1].unitCost) priceIncrease++;
      else if (sorted[i].unitCost < sorted[i - 1].unitCost) priceDecrease++;
    }
    out.push({
      supplierId,
      supplierName: suppliers.getById(supplierId)?.name ?? supplierId,
      avgCost,
      weightedAvgCost,
      latestCost: last.unitCost,
      previousCost: prev?.unitCost,
      minCost: Math.min(...costs),
      maxCost: Math.max(...costs),
      batchCount: sorted.length,
      totalQtyReceived: totalQty,
      lastReceivedAt: last.receivedAt,
      priceIncreaseCount: priceIncrease,
      priceDecreaseCount: priceDecrease
    });
  }
  // Sort by latestCost ASC — supplier termurah duluan untuk di-pertimbangkan.
  return out.sort((a, b) => a.latestCost - b.latestCost);
}

export type SupplierProductTrend = {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  latestCost: number;
  previousCost?: number;
  deltaPct: number;          // 0 kalau tidak ada previous
  totalReceipts: number;
  totalQtyReceived: number;
  lastReceivedAt: string;
};

// Per supplier: list semua produk yang pernah dia kirim, dengan trend
// harga (latest vs previous). Cocok untuk halaman supplier detail —
// "supplier ini paling sering naikkan harga produk apa?"
export function supplierPriceTrend(supplierId: string): SupplierProductTrend[] {
  const byKey = new Map<string, Batch[]>();
  for (const b of batches.items) {
    if (b.supplierId !== supplierId) continue;
    if (b.ownership !== 'owned') continue;
    const key = `${b.productId}|${b.variantId ?? ''}`;
    const list = byKey.get(key) ?? [];
    list.push(b);
    byKey.set(key, list);
  }
  const out: SupplierProductTrend[] = [];
  for (const [, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const last = sorted[sorted.length - 1];
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : undefined;
    const product = products.getById(last.productId);
    const variant = last.variantId
      ? product?.variants.find((v) => v.id === last.variantId)
      : undefined;
    const deltaPct =
      prev && prev.unitCost > 0
        ? ((last.unitCost - prev.unitCost) / prev.unitCost) * 100
        : 0;
    out.push({
      productId: last.productId,
      productName: product?.name ?? last.productId,
      variantId: last.variantId,
      variantName: variant?.name,
      latestCost: last.unitCost,
      previousCost: prev?.unitCost,
      deltaPct,
      totalReceipts: sorted.length,
      totalQtyReceived: sorted.reduce((s, b) => s + b.qtyReceived, 0),
      lastReceivedAt: last.receivedAt
    });
  }
  // Sort by absolute deltaPct DESC — produk dengan perubahan paling besar
  // di atas. Operator paling perlu perhatian ke yang naik banyak.
  return out.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}

// Satu titik data untuk grid ringkasan (semua produk × semua pemasok).
// Variant-aware: produk dengan varian menghasilkan multiple rows (satu per varian).
export type SupplierProductPair = {
  productId: string;
  productName: string;
  productSku: string;
  categoryId: string;
  variantId?: string;
  variantName?: string;
  supplierId: string;
  supplierName: string;
  latestCost: number;        // per base unit, dari batch terakhir
  previousCost?: number;
  deltaPct: number;
  batchCount: number;
  totalQtyReceived: number;
  lastReceivedAt: string;
  weightedAvgCost: number;
};

// Iterate semua (productId, variantId, supplierId) yang punya minimal 1
// batch owned. Dipakai untuk grid ringkasan di halaman analitik.
export function allSupplierProductPairs(): SupplierProductPair[] {
  const groups = new Map<string, Batch[]>();
  for (const b of batches.items) {
    if (b.ownership !== 'owned') continue;
    if (!b.supplierId) continue;
    const key = `${b.productId}|${b.variantId ?? ''}|${b.supplierId}`;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }
  const out: SupplierProductPair[] = [];
  for (const [, list] of groups) {
    const sorted = [...list].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const last = sorted[sorted.length - 1];
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : undefined;
    const totalQty = sorted.reduce((s, b) => s + b.qtyReceived, 0);
    const weightedAvg =
      totalQty > 0
        ? sorted.reduce((s, b) => s + b.unitCost * b.qtyReceived, 0) / totalQty
        : last.unitCost;
    const deltaPct =
      prev && prev.unitCost > 0
        ? ((last.unitCost - prev.unitCost) / prev.unitCost) * 100
        : 0;
    const product = products.getById(last.productId);
    const variant = last.variantId
      ? product?.variants.find((v) => v.id === last.variantId)
      : undefined;
    out.push({
      productId: last.productId,
      productName: product?.name ?? last.productId,
      productSku: variant?.sku ?? product?.sku ?? '',
      categoryId: product?.categoryId ?? '',
      variantId: last.variantId,
      variantName: variant?.name,
      supplierId: last.supplierId!,
      supplierName: suppliers.getById(last.supplierId!)?.name ?? last.supplierId!,
      latestCost: last.unitCost,
      previousCost: prev?.unitCost,
      deltaPct,
      batchCount: sorted.length,
      totalQtyReceived: totalQty,
      lastReceivedAt: last.receivedAt,
      weightedAvgCost: weightedAvg
    });
  }
  return out;
}

export type SupplierComparePair = {
  productId: string;
  productName: string;
  productSku: string;
  variantId?: string;
  variantName?: string;
  costA: number;            // latest dari supplier A
  costB: number;            // latest dari supplier B
  diff: number;             // costA - costB (positif = A lebih mahal)
  diffPct: number;          // dihitung dari rata-rata A & B sebagai dasar
  cheaperBy: 'A' | 'B' | 'equal';
  lastReceivedA: string;
  lastReceivedB: string;
};

// Bandingkan dua pemasok side-by-side per produk yang dua-duanya pernah
// kirim. Sorted by |diffPct| DESC supaya selisih besar di atas.
export function compareSuppliers(
  supplierAId: string,
  supplierBId: string
): SupplierComparePair[] {
  if (!supplierAId || !supplierBId || supplierAId === supplierBId) return [];
  // Build (product, variant) → latest batch per supplier
  const latestByKeyAndSupplier = new Map<string, Map<string, Batch>>();
  for (const b of batches.items) {
    if (b.ownership !== 'owned') continue;
    if (!b.supplierId) continue;
    if (b.supplierId !== supplierAId && b.supplierId !== supplierBId) continue;
    const key = `${b.productId}|${b.variantId ?? ''}`;
    let bySupplier = latestByKeyAndSupplier.get(key);
    if (!bySupplier) {
      bySupplier = new Map();
      latestByKeyAndSupplier.set(key, bySupplier);
    }
    const existing = bySupplier.get(b.supplierId);
    if (!existing || b.receivedAt.localeCompare(existing.receivedAt) > 0) {
      bySupplier.set(b.supplierId, b);
    }
  }
  const out: SupplierComparePair[] = [];
  for (const [, bySupplier] of latestByKeyAndSupplier) {
    const batchA = bySupplier.get(supplierAId);
    const batchB = bySupplier.get(supplierBId);
    if (!batchA || !batchB) continue; // hanya tampilkan yang dua-duanya supply
    const costA = batchA.unitCost;
    const costB = batchB.unitCost;
    const diff = costA - costB;
    const mid = (costA + costB) / 2;
    const diffPct = mid > 0 ? (diff / mid) * 100 : 0;
    const product = products.getById(batchA.productId);
    const variant = batchA.variantId
      ? product?.variants.find((v) => v.id === batchA.variantId)
      : undefined;
    out.push({
      productId: batchA.productId,
      productName: product?.name ?? batchA.productId,
      productSku: variant?.sku ?? product?.sku ?? '',
      variantId: batchA.variantId,
      variantName: variant?.name,
      costA,
      costB,
      diff,
      diffPct,
      cheaperBy: Math.abs(diff) < 0.5 ? 'equal' : diff > 0 ? 'B' : 'A',
      lastReceivedA: batchA.receivedAt,
      lastReceivedB: batchB.receivedAt
    });
  }
  // Sort: selisih (% absolute) DESC supaya gap besar di atas.
  return out.sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct));
}

// Helper convenience untuk PO line panel kontekstual. Return null kalau
// belum ada history untuk (produk, varian, supplier) ini.
export function latestSupplierPrice(
  productId: string,
  variantId: string | undefined,
  supplierId: string
): {
  unitCost: number;
  receivedAt: string;
  daysAgo: number;
  previousCost?: number;
  deltaPct: number;
  totalReceipts: number;
} | null {
  const history = priceHistoryFor(productId, variantId, supplierId);
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  const prev = history.length >= 2 ? history[history.length - 2] : undefined;
  const now = new Date();
  const lastDate = new Date(last.receivedAt);
  const daysAgo = Math.max(0, Math.floor((now.getTime() - lastDate.getTime()) / 86400000));
  const deltaPct =
    prev && prev.unitCost > 0
      ? ((last.unitCost - prev.unitCost) / prev.unitCost) * 100
      : 0;
  return {
    unitCost: last.unitCost,
    receivedAt: last.receivedAt,
    daysAgo,
    previousCost: prev?.unitCost,
    deltaPct,
    totalReceipts: history.length
  };
}
