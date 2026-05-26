import { products } from './products.svelte';
import { locations } from './locations.svelte';
import {
  stockMovements,
  type StockMovementReference,
  type StockAdjustmentReason
} from './stockMovements.svelte';

export type BatchOwnership = 'owned' | 'consignment';

export type Batch = {
  id: string;
  code: string;                 // human-readable: BATCH-YYYY-NNN, used on printed labels
  productId: string;
  variantId?: string;
  ownership: BatchOwnership;
  supplierId?: string;
  sourcePurchaseOrderId?: string;
  sourcePurchaseOrderLineId?: string;
  unitCost: number;             // IDR per base unit at receipt time
  qtyReceived: number;          // base units; immutable after creation
  qtyRemaining: number;         // base units; decreases on sale / return / write-off
  receivedAt: string;           // ISO date — fallback FIFO sort key
  expiresAt?: string;           // ISO date when known; FIFO walks this first
  locationId: string;           // physical storage location id; defaults to locations.default()
  notes: string;
};

export type BatchInput = Omit<Batch, 'id' | 'code'>;

// Per-line snapshot of which batches were drawn down for a sale, written to the
// OrderLine at charge time. The single source of truth for the Consignor Payout
// report (sum where ownership === 'consignment'). Survives batch mutations,
// supplier renames, and batch deletion because every field is snapshotted at sale.
export type BatchAllocation = {
  batchId: string;
  qtyTaken: number;            // base units
  ownership: BatchOwnership;
  unitCost: number;            // snapshot at sale
  supplierId?: string;         // snapshot at sale
};

// Seed batches mirror current product/variant stocks. Mugs (prd_4) are consignment
// from sup_3 — matches the Logo Mug description and PO-2026-003 supplier. All other
// initial stock is owned. See docs/CONSIGNMENT.md for the broader design.
const seed: Batch[] = [
  {
    id: 'batch_1',
    code: 'BATCH-2026-001',
    productId: 'prd_1',
    ownership: 'owned',
    supplierId: 'sup_1',
    unitCost: 5000,
    qtyReceived: 120,
    qtyRemaining: 116,
    receivedAt: '2026-04-22',
    locationId: 'loc_gudang',
    notes: 'Initial seed (received via PO-2026-001). 4 unit terjual ke ORD-2026-013 (piutang).'
  },
  {
    id: 'batch_2',
    code: 'BATCH-2026-002',
    productId: 'prd_2',
    ownership: 'owned',
    supplierId: 'sup_1',
    unitCost: 12000,
    qtyReceived: 80,
    qtyRemaining: 78,
    receivedAt: '2026-04-22',
    locationId: 'loc_gudang',
    notes: 'Initial seed (received via PO-2026-001). 2 unit terjual ke ORD-2026-013 (piutang).'
  },
  {
    id: 'batch_3',
    code: 'BATCH-2026-003',
    productId: 'prd_3',
    ownership: 'owned',
    unitCost: 8000,
    qtyReceived: 24,
    qtyRemaining: 24,
    receivedAt: '2026-05-12',
    expiresAt: '2026-05-15',
    locationId: 'loc_gudang',
    notes: 'Initial seed — baked fresh, sells out fast.'
  },
  {
    id: 'batch_4',
    code: 'BATCH-2026-004',
    productId: 'prd_4',
    variantId: 'v_1',
    ownership: 'consignment',
    supplierId: 'sup_3',
    unitCost: 50000,
    qtyReceived: 18,
    qtyRemaining: 12,
    receivedAt: '2026-03-01',
    locationId: 'loc_gudang',
    notes: 'Initial seed (prior consignment receipt — White colorway). 5 unit terjual + 1 unit di ORD-2026-014 (piutang).'
  },
  {
    id: 'batch_5',
    code: 'BATCH-2026-005',
    productId: 'prd_4',
    variantId: 'v_2',
    ownership: 'consignment',
    supplierId: 'sup_3',
    unitCost: 50000,
    qtyReceived: 12,
    qtyRemaining: 8,
    receivedAt: '2026-03-01',
    locationId: 'loc_gudang',
    notes: 'Initial seed (prior consignment receipt — Black colorway). 4 unit terjual via ORD-2026-003/009/012.'
  },
  {
    id: 'batch_6',
    code: 'BATCH-2026-006',
    productId: 'prd_4',
    variantId: 'v_3',
    ownership: 'consignment',
    supplierId: 'sup_3',
    unitCost: 60000,
    qtyReceived: 6,
    qtyRemaining: 3,
    receivedAt: '2026-03-01',
    locationId: 'loc_gudang',
    notes: 'Initial seed (prior consignment receipt — Brand Blue colorway). 2 unit dikembalikan ke konsinyor, 1 unit terjual via ORD-2026-010.'
  },
  {
    id: 'batch_7',
    code: 'BATCH-2026-007',
    productId: 'prd_5',
    ownership: 'owned',
    unitCost: 3500,
    qtyReceived: 360,
    qtyRemaining: 360,
    receivedAt: '2026-05-01',
    locationId: 'loc_gudang',
    notes: 'Initial seed.'
  },
  // Telur Ayam (prd_8) — three batches spanning the expiry spectrum so the
  // expiring-soon badge, FIFO-by-expiration, and overdue states are all visible.
  {
    id: 'batch_8',
    code: 'BATCH-2026-008',
    productId: 'prd_8',
    ownership: 'owned',
    supplierId: 'sup_2',
    unitCost: 2500,
    qtyReceived: 30,
    qtyRemaining: 12,
    receivedAt: '2026-05-08',
    expiresAt: '2026-05-10',
    locationId: 'loc_gudang',
    notes: 'Initial seed — overdue, contoh batch yang sudah kedaluwarsa.'
  },
  {
    id: 'batch_9',
    code: 'BATCH-2026-009',
    productId: 'prd_8',
    ownership: 'owned',
    supplierId: 'sup_2',
    unitCost: 2500,
    qtyReceived: 20,
    qtyRemaining: 20,
    receivedAt: '2026-05-12',
    expiresAt: '2026-05-14',
    locationId: 'loc_gudang',
    notes: 'Initial seed — kedaluwarsa besok.'
  },
  {
    id: 'batch_10',
    code: 'BATCH-2026-010',
    productId: 'prd_8',
    ownership: 'owned',
    supplierId: 'sup_2',
    unitCost: 2700,
    qtyReceived: 30,
    qtyRemaining: 30,
    receivedAt: '2026-05-13',
    expiresAt: '2026-05-20',
    locationId: 'loc_gudang',
    notes: 'Initial seed — masih segar, batch baru.'
  },
  // Daging Sapi Cincang (prd_9) — base unit is gram; this batch is 2 kg = 2000g
  {
    id: 'batch_11',
    code: 'BATCH-2026-011',
    productId: 'prd_9',
    ownership: 'owned',
    supplierId: 'sup_2',
    unitCost: 130,
    qtyReceived: 2000,
    qtyRemaining: 1450,
    receivedAt: '2026-05-12',
    expiresAt: '2026-05-15',
    locationId: 'loc_gudang',
    notes: 'Initial seed — 2 kg.'
  },
  // Ayam Mentah (prd_10) — one batch per cut so production runs have stock
  // to draw from immediately. Expiry set to a few days out; the fried-chicken
  // production flow will snapshot these costs into the produced batch.
  {
    id: 'batch_12',
    code: 'BATCH-2026-012',
    productId: 'prd_10',
    variantId: 'v_chk_paha',
    ownership: 'owned',
    supplierId: 'sup_2',
    unitCost: 12000,
    qtyReceived: 20,
    qtyRemaining: 20,
    receivedAt: '2026-05-21',
    expiresAt: '2026-05-24',
    locationId: 'loc_gudang',
    notes: 'Initial seed — paha ayam mentah.'
  },
  {
    id: 'batch_13',
    code: 'BATCH-2026-013',
    productId: 'prd_10',
    variantId: 'v_chk_dada',
    ownership: 'owned',
    supplierId: 'sup_2',
    unitCost: 15000,
    qtyReceived: 15,
    qtyRemaining: 15,
    receivedAt: '2026-05-21',
    expiresAt: '2026-05-24',
    locationId: 'loc_gudang',
    notes: 'Initial seed — dada ayam mentah.'
  },
  {
    id: 'batch_14',
    code: 'BATCH-2026-014',
    productId: 'prd_10',
    variantId: 'v_chk_sayap',
    ownership: 'owned',
    supplierId: 'sup_2',
    unitCost: 5000,
    qtyReceived: 30,
    qtyRemaining: 30,
    receivedAt: '2026-05-21',
    expiresAt: '2026-05-24',
    locationId: 'loc_gudang',
    notes: 'Initial seed — sayap ayam mentah.'
  },
  {
    id: 'batch_15',
    code: 'BATCH-2026-015',
    productId: 'prd_10',
    variantId: 'v_chk_drum',
    ownership: 'owned',
    supplierId: 'sup_2',
    unitCost: 8000,
    qtyReceived: 25,
    qtyRemaining: 25,
    receivedAt: '2026-05-21',
    expiresAt: '2026-05-24',
    locationId: 'loc_gudang',
    notes: 'Initial seed — drumstick ayam mentah.'
  },
  // Newer (more expensive) Latte batch — paired with prd_2's `fifo-current`
  // markup source to demo dynamic pricing. Sale stays at the batch_2 cost
  // (12.000) until batch_2 depletes, then snaps to batch_16's 13.000.
  {
    id: 'batch_16',
    code: 'BATCH-2026-016',
    productId: 'prd_2',
    ownership: 'owned',
    supplierId: 'sup_1',
    unitCost: 13000,
    qtyReceived: 40,
    qtyRemaining: 40,
    receivedAt: '2026-05-18',
    locationId: 'loc_gudang',
    notes: 'Initial seed — Latte stok lanjutan harga lebih tinggi.'
  }
];

function fmtCodeNumber(n: number): string {
  return n.toString().padStart(3, '0');
}

class BatchesStore {
  items = $state<Batch[]>([...seed]);
  private nextId = seed.length + 1;
  private nextCodeNum = seed.length + 1;

  private generateCode(): string {
    const year = new Date().getFullYear();
    return `BATCH-${year}-${fmtCodeNumber(this.nextCodeNum++)}`;
  }

  add(input: BatchInput): Batch {
    const batch: Batch = {
      ...input,
      id: `batch_${this.nextId++}`,
      code: this.generateCode()
    };
    this.items.push(batch);
    return batch;
  }

  update(id: string, patch: Partial<Batch>): Batch | undefined {
    const idx = this.items.findIndex((b) => b.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  getById(id: string): Batch | undefined {
    return this.items.find((b) => b.id === id);
  }

  // FIFO-ordered batches with stock left for a given (product, variant?). Callers
  // walk these in order to deduct on sale (see CONSIGNMENT.md §"Sale flow").
  //
  // Sort priority:
  //   1. Soonest expiresAt first (perishables sell before they spoil)
  //   2. Batches without expiresAt come after any with one
  //   3. Within the same bucket, oldest receivedAt first
  forStock(
    productId: string,
    variantId?: string,
    opts?: { locationIds?: string[] }
  ): Batch[] {
    const locFilter = opts?.locationIds ? new Set(opts.locationIds) : null;
    return this.items
      .filter(
        (b) =>
          b.productId === productId &&
          b.variantId === variantId &&
          b.qtyRemaining > 0 &&
          (!locFilter || locFilter.has(b.locationId))
      )
      .sort((a, b) => {
        const aExp = a.expiresAt ?? '9999-12-31';
        const bExp = b.expiresAt ?? '9999-12-31';
        if (aExp !== bExp) return aExp.localeCompare(bExp);
        return a.receivedAt.localeCompare(b.receivedAt);
      });
  }

  forSupplier(supplierId: string, ownership?: BatchOwnership): Batch[] {
    return this.items.filter(
      (b) =>
        b.supplierId === supplierId &&
        (ownership === undefined || b.ownership === ownership)
    );
  }

  // All batches created from a given PO, sorted by receivedAt ASC.
  // Used by the bulk label print page.
  forSourcePO(poId: string): Batch[] {
    return this.items
      .filter((b) => b.sourcePurchaseOrderId === poId)
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  }

  // Lookup by human-readable code (BATCH-YYYY-NNN). Used by POS scan flow.
  getByCode(code: string): Batch | undefined {
    return this.items.find((b) => b.code === code);
  }

  // All batches for a product (across variants, including depleted),
  // sorted by receivedAt ASC. Used by the inspection view on /products.
  forProduct(productId: string): Batch[] {
    return this.items
      .filter((b) => b.productId === productId)
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  }

  // Return unsold consignment stock to the consignor. Decrements an existing
  // consignment batch — no payable, no order, no revenue impact, because we never
  // owned the units. See docs/CONSIGNMENT.md §"Return unsold consignment stock".
  returnToConsignor(batchId: string, qty: number): { ok: boolean; reason?: string } {
    const batch = this.getById(batchId);
    if (!batch) return { ok: false, reason: 'Batch not found.' };
    if (batch.ownership !== 'consignment')
      return { ok: false, reason: 'Only consignment batches can be returned to the consignor.' };
    if (qty <= 0) return { ok: false, reason: 'Return quantity must be positive.' };
    if (qty > batch.qtyRemaining)
      return { ok: false, reason: `Only ${batch.qtyRemaining} units remain in this batch.` };
    const updated = this.update(batchId, { qtyRemaining: batch.qtyRemaining - qty });
    stockMovements.log({
      kind: 'return-consignor',
      productId: batch.productId,
      variantId: batch.variantId,
      locationId: batch.locationId,
      batchId: batch.id,
      qtyDelta: -qty,
      qtyAfter: updated?.qtyRemaining ?? batch.qtyRemaining - qty,
      unitCost: batch.unitCost,
      reference: { kind: 'return', id: batch.id, code: batch.code },
      notes: `Retur konsinyasi · ${batch.code}`
    });
    return { ok: true };
  }

  // Manual stock adjustment (write-offs, found stock, initial seed, form edits).
  // Positive delta → new owned batch (returned). Negative delta → LIFO decrement
  // across owned batches (newest first; preserves FIFO order for future sales) — returns undefined.
  //
  // `locationId` controls where positive deltas land and which location is depleted
  // first for negative deltas. When omitted, falls back to the default-receipt location.
  adjustStock(args: {
    productId: string;
    variantId?: string;
    delta: number;
    unitCost: number;
    expiresAt?: string;
    locationId?: string;
    reference?: StockMovementReference;
    reason?: StockAdjustmentReason;
    imageUrl?: string;
    notes?: string;
  }): Batch | undefined {
    if (args.delta === 0) return undefined;
    const todayISO = new Date().toISOString().slice(0, 10);
    const locId = args.locationId || locations.defaultId();
    const reference: StockMovementReference =
      args.reference ?? { kind: 'manual', id: 'inventory' };
    if (args.delta > 0) {
      const newBatch = this.add({
        productId: args.productId,
        variantId: args.variantId,
        ownership: 'owned',
        unitCost: args.unitCost,
        qtyReceived: args.delta,
        qtyRemaining: args.delta,
        receivedAt: todayISO,
        expiresAt: args.expiresAt || undefined,
        locationId: locId,
        notes: args.notes ?? 'Manual stock adjustment.'
      });
      stockMovements.log({
        kind: 'adjust-in',
        productId: args.productId,
        variantId: args.variantId,
        locationId: locId,
        batchId: newBatch.id,
        qtyDelta: args.delta,
        qtyAfter: newBatch.qtyRemaining,
        unitCost: args.unitCost,
        reference,
        reason: args.reason,
        imageUrl: args.imageUrl,
        notes: args.notes ?? 'Penyesuaian stok manual.'
      });
      return newBatch;
    }
    let remaining = -args.delta;
    const matching = this.items.filter(
      (b) =>
        b.productId === args.productId &&
        b.variantId === args.variantId &&
        b.ownership === 'owned' &&
        b.qtyRemaining > 0
    );
    // Decrement target-location batches first (LIFO), then fall through to other
    // locations if there's still shortfall.
    const atTarget = matching
      .filter((b) => b.locationId === locId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    const elsewhere = matching
      .filter((b) => b.locationId !== locId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    for (const batch of [...atTarget, ...elsewhere]) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.qtyRemaining);
      const updated = this.update(batch.id, { qtyRemaining: batch.qtyRemaining - take });
      stockMovements.log({
        kind: 'adjust-out',
        productId: args.productId,
        variantId: args.variantId,
        locationId: batch.locationId,
        batchId: batch.id,
        qtyDelta: -take,
        qtyAfter: updated?.qtyRemaining ?? batch.qtyRemaining - take,
        unitCost: batch.unitCost,
        reference,
        reason: args.reason,
        imageUrl: args.imageUrl,
        notes: args.notes ?? 'Penyesuaian stok manual.'
      });
      remaining -= take;
    }
    return undefined;
  }

  // Move qty units of a specific batch to another location. Splits the source by
  // creating a sibling batch at the destination preserving cost, expiry,
  // ownership, supplier, and source PO references. When qty == the full
  // remainder, mutates locationId in place (no zombie batches).
  moveStock(args: {
    batchId: string;
    toLocationId: string;
    qty: number;
    notes?: string;
    transferGroupId?: string;
  }): { ok: boolean; reason?: string; newBatch?: Batch } {
    const src = this.getById(args.batchId);
    if (!src) return { ok: false, reason: 'Batch tidak ditemukan.' };
    if (args.qty <= 0) return { ok: false, reason: 'Jumlah harus lebih dari 0.' };
    if (args.qty > src.qtyRemaining)
      return { ok: false, reason: `Sisa di batch hanya ${src.qtyRemaining}.` };
    if (src.locationId === args.toLocationId)
      return { ok: false, reason: 'Lokasi sumber dan tujuan sama.' };
    const transferId = args.transferGroupId ?? crypto.randomUUID();
    const fromLoc = locations.getById(src.locationId)?.name ?? src.locationId;
    const toLoc = locations.getById(args.toLocationId)?.name ?? args.toLocationId;
    const reference = { kind: 'transfer' as const, id: transferId };
    if (args.qty === src.qtyRemaining) {
      const updated = this.update(src.id, { locationId: args.toLocationId });
      stockMovements.log({
        kind: 'move-relocate',
        productId: src.productId,
        variantId: src.variantId,
        locationId: args.toLocationId,
        batchId: src.id,
        qtyDelta: 0,
        qtyAfter: updated?.qtyRemaining ?? src.qtyRemaining,
        unitCost: src.unitCost,
        reference,
        notes: args.notes ?? `Relokasi penuh · ${fromLoc} → ${toLoc} · ${src.code}`
      });
      return { ok: true, newBatch: updated };
    }
    const updatedSrc = this.update(src.id, { qtyRemaining: src.qtyRemaining - args.qty });
    stockMovements.log({
      kind: 'move-out',
      productId: src.productId,
      variantId: src.variantId,
      locationId: src.locationId,
      batchId: src.id,
      qtyDelta: -args.qty,
      qtyAfter: updatedSrc?.qtyRemaining ?? src.qtyRemaining - args.qty,
      unitCost: src.unitCost,
      reference,
      notes: args.notes ?? `Pindah ke ${toLoc} · ${src.code}`
    });
    const sibling = this.add({
      productId: src.productId,
      variantId: src.variantId,
      ownership: src.ownership,
      supplierId: src.supplierId,
      sourcePurchaseOrderId: src.sourcePurchaseOrderId,
      sourcePurchaseOrderLineId: src.sourcePurchaseOrderLineId,
      unitCost: src.unitCost,
      qtyReceived: args.qty,
      qtyRemaining: args.qty,
      receivedAt: src.receivedAt,
      expiresAt: src.expiresAt,
      locationId: args.toLocationId,
      notes: args.notes ?? `Dipindahkan dari ${src.code}.`
    });
    stockMovements.log({
      kind: 'move-in',
      productId: src.productId,
      variantId: src.variantId,
      locationId: args.toLocationId,
      batchId: sibling.id,
      qtyDelta: args.qty,
      qtyAfter: sibling.qtyRemaining,
      unitCost: src.unitCost,
      reference,
      notes: args.notes ?? `Pindah dari ${fromLoc} · sibling ${sibling.code}`
    });
    return { ok: true, newBatch: sibling };
  }

  // Move qty units of a product/variant from one location to another, walking
  // batches at the source sorted by expiry asc (so expiring stock moves to the
  // shelf first). Calls moveStock per batch until qty is satisfied.
  moveProductStock(args: {
    productId: string;
    variantId?: string;
    fromLocationId: string;
    toLocationId: string;
    qty: number;
    notes?: string;
  }): { ok: boolean; reason?: string; moved: number } {
    if (args.fromLocationId === args.toLocationId)
      return { ok: false, reason: 'Lokasi sumber dan tujuan sama.', moved: 0 };
    if (args.qty <= 0)
      return { ok: false, reason: 'Jumlah harus lebih dari 0.', moved: 0 };
    const sourceBatches = this.forStock(args.productId, args.variantId, {
      locationIds: [args.fromLocationId]
    });
    const available = sourceBatches.reduce((s, b) => s + b.qtyRemaining, 0);
    if (args.qty > available)
      return {
        ok: false,
        reason: `Stok di lokasi sumber hanya ${available}.`,
        moved: 0
      };
    const transferGroupId = crypto.randomUUID();
    let remaining = args.qty;
    for (const b of sourceBatches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, b.qtyRemaining);
      const result = this.moveStock({
        batchId: b.id,
        toLocationId: args.toLocationId,
        qty: take,
        notes: args.notes,
        transferGroupId
      });
      if (!result.ok) return { ok: false, reason: result.reason, moved: args.qty - remaining };
      remaining -= take;
    }
    return { ok: true, moved: args.qty };
  }
}

export const batches = new BatchesStore();

export function stockOf(productId: string, variantId?: string): number {
  return batches.forStock(productId, variantId).reduce((s, b) => s + b.qtyRemaining, 0);
}

export function stockBreakdown(
  productId: string,
  variantId?: string
): { owned: number; consignment: number } {
  let owned = 0;
  let consignment = 0;
  for (const b of batches.forStock(productId, variantId)) {
    if (b.ownership === 'owned') owned += b.qtyRemaining;
    else consignment += b.qtyRemaining;
  }
  return { owned, consignment };
}

// Per-location remaining stock for a (product, variant?). Locations with zero
// stock are omitted. Used by the inventory / products / POS breakdown chips.
export function stockByLocation(
  productId: string,
  variantId?: string
): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of batches.items) {
    if (b.productId !== productId) continue;
    if (b.variantId !== variantId) continue;
    if (b.qtyRemaining <= 0) continue;
    m.set(b.locationId, (m.get(b.locationId) ?? 0) + b.qtyRemaining);
  }
  return m;
}

// Weighted average of OWNED batches' unitCost across qtyRemaining. Consignment
// batches are excluded (they're not the retailer's cost basis). Falls back to the
// product's / variant's manual cost when no owned batches exist — that's the
// bootstrap value used by pricing math.
//
// When variantId is omitted on a product that has variants, aggregates across
// all owned batches for the product (any variant) instead of trying to match
// variantId === undefined (which would always return zero for variant products).
export function currentCost(productId: string, variantId?: string): number {
  let ownedBatches;
  if (variantId !== undefined) {
    ownedBatches = batches
      .forStock(productId, variantId)
      .filter((b) => b.ownership === 'owned');
  } else {
    const product = products.getById(productId);
    if (product && product.variants.length > 0) {
      ownedBatches = batches
        .forProduct(productId)
        .filter((b) => b.ownership === 'owned' && b.qtyRemaining > 0);
    } else {
      ownedBatches = batches
        .forStock(productId)
        .filter((b) => b.ownership === 'owned');
    }
  }

  const totalQty = ownedBatches.reduce((s, b) => s + b.qtyRemaining, 0);
  if (totalQty <= 0) {
    const product = products.getById(productId);
    if (!product) return 0;
    if (variantId) {
      return product.variants.find((v) => v.id === variantId)?.cost ?? product.cost;
    }
    return product.cost;
  }
  return ownedBatches.reduce((s, b) => s + b.qtyRemaining * b.unitCost, 0) / totalQty;
}
