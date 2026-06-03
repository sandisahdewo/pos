import { products } from './products.svelte';
import { locations } from './locations.svelte';
import {
  stockMovements,
  type StockMovementReference,
  type StockAdjustmentReason
} from './stockMovements.svelte';
import {
  listBatches,
  createBatch,
  updateBatch as apiUpdateBatch
} from '$lib/api/batches';

function normalizeBatch(raw: unknown): Batch {
  const r = raw as Partial<Batch> & Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    productId: String(r.productId ?? ''),
    variantId: (r.variantId as string | undefined) || undefined,
    ownership: (r.ownership ?? 'owned') as BatchOwnership,
    supplierId: (r.supplierId as string | undefined) || undefined,
    sourcePurchaseOrderId: (r.sourcePurchaseOrderId as string | undefined) || undefined,
    sourcePurchaseOrderLineId: (r.sourcePurchaseOrderLineId as string | undefined) || undefined,
    unitCost: Number(r.unitCost ?? 0),
    qtyReceived: Number(r.qtyReceived ?? 0),
    qtyRemaining: Number(r.qtyRemaining ?? 0),
    receivedAt: (r.receivedAt ?? '') as string,
    expiresAt: (r.expiresAt as string | undefined) || undefined,
    locationId: String(r.locationId ?? ''),
    notes: (r.notes ?? '') as string
  };
}

function toBatchPayload(b: BatchInput): Record<string, unknown> {
  return {
    productId: b.productId,
    variantId: b.variantId || null,
    ownership: b.ownership,
    supplierId: b.supplierId || null,
    sourcePurchaseOrderId: b.sourcePurchaseOrderId || null,
    sourcePurchaseOrderLineId: b.sourcePurchaseOrderLineId || null,
    unitCost: b.unitCost,
    qtyReceived: b.qtyReceived,
    qtyRemaining: b.qtyRemaining,
    receivedAt: b.receivedAt,
    expiresAt: b.expiresAt || '',
    locationId: b.locationId,
    notes: b.notes ?? ''
  };
}

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

class BatchesStore {
  items = $state<Batch[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listBatches();
      this.items = list.map(normalizeBatch);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: BatchInput): Promise<Batch> {
    const created = await createBatch(toBatchPayload(input));
    const b = normalizeBatch(created);
    this.items = [...this.items, b];
    return b;
  }

  /**
   * Partial update — only fields the API understands (qtyRemaining, location,
   * expires, notes). Other fields are snapshot at insert and stay immutable.
   */
  async update(id: string, patch: Partial<Batch>): Promise<Batch | undefined> {
    const apiPatch: {
      qtyRemaining?: number;
      locationId?: string;
      expiresAt?: string;
      notes?: string;
    } = {};
    if (patch.qtyRemaining !== undefined) apiPatch.qtyRemaining = patch.qtyRemaining;
    if (patch.locationId !== undefined) apiPatch.locationId = patch.locationId;
    if (patch.expiresAt !== undefined) apiPatch.expiresAt = patch.expiresAt || '';
    if (patch.notes !== undefined) apiPatch.notes = patch.notes;
    if (Object.keys(apiPatch).length === 0) return this.getById(id);
    const updated = await apiUpdateBatch(id, apiPatch);
    const b = normalizeBatch(updated);
    this.items = this.items.map((x) => (x.id === id ? b : x));
    return b;
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
  async returnToConsignor(
    batchId: string,
    qty: number
  ): Promise<{ ok: boolean; reason?: string }> {
    const batch = this.getById(batchId);
    if (!batch) return { ok: false, reason: 'Batch not found.' };
    if (batch.ownership !== 'consignment')
      return { ok: false, reason: 'Only consignment batches can be returned to the consignor.' };
    if (qty <= 0) return { ok: false, reason: 'Return quantity must be positive.' };
    if (qty > batch.qtyRemaining)
      return { ok: false, reason: `Only ${batch.qtyRemaining} units remain in this batch.` };
    const updated = await this.update(batchId, { qtyRemaining: batch.qtyRemaining - qty });
    await stockMovements.log({
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
  async adjustStock(args: {
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
  }): Promise<Batch | undefined> {
    if (args.delta === 0) return undefined;
    const todayISO = new Date().toISOString().slice(0, 10);
    const locId = args.locationId || locations.defaultId();
    const reference: StockMovementReference =
      args.reference ?? { kind: 'manual', id: 'inventory' };
    if (args.delta > 0) {
      const newBatch = await this.add({
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
      await stockMovements.log({
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
    const atTarget = matching
      .filter((b) => b.locationId === locId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    const elsewhere = matching
      .filter((b) => b.locationId !== locId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    for (const batch of [...atTarget, ...elsewhere]) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.qtyRemaining);
      const updated = await this.update(batch.id, { qtyRemaining: batch.qtyRemaining - take });
      await stockMovements.log({
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
  async moveStock(args: {
    batchId: string;
    toLocationId: string;
    qty: number;
    notes?: string;
    transferGroupId?: string;
  }): Promise<{ ok: boolean; reason?: string; newBatch?: Batch }> {
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
      const updated = await this.update(src.id, { locationId: args.toLocationId });
      await stockMovements.log({
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
    const updatedSrc = await this.update(src.id, { qtyRemaining: src.qtyRemaining - args.qty });
    await stockMovements.log({
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
    const sibling = await this.add({
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
    await stockMovements.log({
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

  async moveProductStock(args: {
    productId: string;
    variantId?: string;
    fromLocationId: string;
    toLocationId: string;
    qty: number;
    notes?: string;
  }): Promise<{ ok: boolean; reason?: string; moved: number }> {
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
      const result = await this.moveStock({
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
