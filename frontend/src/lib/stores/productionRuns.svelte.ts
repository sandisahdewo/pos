import {
  componentBaseQty,
  products,
  productionModeOf,
  recipeOf,
  type CompositeComponent,
  type Product,
  type ProductVariant
} from './products.svelte';
import { batches, type Batch } from './batches.svelte';
import { locations } from './locations.svelte';
import { stockMovements } from './stockMovements.svelte';
import { units } from './units.svelte';

export type ProductionRunStatus = 'completed' | 'cancelled';

// One row per source batch we drew from when producing the composite. The
// snapshot fields (qtyConsumed, unitCost) survive batch mutations so the run
// detail and cost rollup stay accurate over time.
export type ConsumedComponent = {
  productId: string;
  variantId?: string;
  batchId: string;
  batchCode: string;
  qtyConsumed: number; // in base units of the component product
  unitCost: number;
};

export type ProductionRun = {
  id: string;
  code: string; // PROD-YYYY-NNN
  productId: string;
  variantId?: string;
  // intendedQty drives component consumption / real cost incurred.
  // producedQty (≤ intendedQty) drives the output batch size, so a fried
  // batch that lost 2 pieces to burning still records honest unit cost.
  intendedQty: number;
  producedQty: number;
  componentConsumptions: ConsumedComponent[];
  producedBatchId: string;
  unitCost: number; // Σ(consumed cost) / producedQty
  locationId: string;
  expiresAt?: string;
  shiftId?: string; // empty for now; populated once login→shift lands
  notes: string;
  createdAt: string;
  status: ProductionRunStatus;
};

export type ProductionRunInput = {
  productId: string;
  variantId?: string;
  intendedQty: number;
  producedQty?: number; // defaults to intendedQty
  locationId?: string;
  expiresAt?: string;
  shiftId?: string;
  notes?: string;
};

// A planned draw from one batch of one component. Returned by the planner so
// the modal can preview "you'll consume 3 from BATCH-2026-008 + 7 from -009".
export type PlannedDraw = {
  batchId: string;
  batchCode: string;
  take: number;
  unitCost: number;
};

// One row in the consumption plan — one component of the recipe, possibly
// spanning multiple batches. `sufficient: false` carries a `blockReason` the
// modal renders in red.
export type ComponentRequirement = {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  unitCode: string;
  requiredBase: number;
  availableBase: number;
  draws: PlannedDraw[];
  sufficient: boolean;
  blockReason?: string;
};

export type ConsumptionPlan = {
  ok: boolean;
  intendedQty: number;
  requirements: ComponentRequirement[];
  totalCost: number; // sum across `draws[].take × draws[].unitCost`
  bottleneckProducible: number; // min(available / required) across components
  blockReasons: string[]; // dedupe-friendly list for surfacing at top of modal
};

function fmtCodeNumber(n: number): string {
  return n.toString().padStart(3, '0');
}

function nameOf(p: Product, variantId?: string): { product: string; variant?: string } {
  const v = variantId ? p.variants.find((vv) => vv.id === variantId) : undefined;
  return { product: p.name, variant: v?.name };
}

function unitCodeFor(productId: string): string {
  const p = products.getById(productId);
  if (!p) return '';
  return units.getById(p.unitId)?.code ?? '';
}

// FIFO batches available for one component. When the component pins a variant,
// only that variant's batches qualify. When it doesn't, we walk every variant
// of the component product in FIFO order — matches `componentAvailableStock`
// in products.svelte, which the rest of the codebase already trusts.
function availableBatchesFor(c: CompositeComponent): Batch[] {
  if (c.variantId) {
    return batches.forStock(c.productId, c.variantId);
  }
  const p = products.getById(c.productId);
  if (!p) return [];
  if (p.variants.length === 0) return batches.forStock(c.productId);
  const all: Batch[] = [];
  for (const v of p.variants) {
    all.push(...batches.forStock(c.productId, v.id));
  }
  // Re-sort to keep FIFO order across variants.
  return all.sort((a, b) => {
    const aExp = a.expiresAt ?? '9999-12-31';
    const bExp = b.expiresAt ?? '9999-12-31';
    if (aExp !== bExp) return aExp.localeCompare(bExp);
    return a.receivedAt.localeCompare(b.receivedAt);
  });
}

// Build the per-component plan without mutating anything. The store calls this
// twice: once for the modal preview, once again right before consuming (in
// case stock changed between modal-open and submit).
export function planConsumption(
  productId: string,
  variantId: string | undefined,
  intendedQty: number
): ConsumptionPlan {
  const product = products.getById(productId);
  const empty: ConsumptionPlan = {
    ok: false,
    intendedQty,
    requirements: [],
    totalCost: 0,
    bottleneckProducible: 0,
    blockReasons: []
  };
  if (!product) {
    empty.blockReasons = ['Produk tidak ditemukan.'];
    return empty;
  }
  if (product.kind !== 'composite') {
    empty.blockReasons = ['Hanya produk komposit yang bisa diproduksi.'];
    return empty;
  }
  if (intendedQty <= 0) {
    empty.blockReasons = ['Jumlah produksi harus lebih dari 0.'];
    return empty;
  }
  const recipe = recipeOf(product, variantId);
  if (recipe.length === 0) {
    empty.blockReasons = ['Resep kosong — atur komponen lebih dulu di produk.'];
    return empty;
  }

  const reasons: string[] = [];
  const requirements: ComponentRequirement[] = [];
  let totalCost = 0;
  let bottleneck = Number.POSITIVE_INFINITY;

  for (const c of recipe) {
    const compProduct = products.getById(c.productId);
    // qty di komponen mungkin dalam satuan kemasan (mis. 1 ekor = 8 pcs);
    // konversi ke base unit dulu sebelum hitung kebutuhan & ketersediaan.
    const perOutput = componentBaseQty(c);
    const required = perOutput * intendedQty;
    const names = compProduct ? nameOf(compProduct, c.variantId) : { product: c.productId };
    const unitCode = unitCodeFor(c.productId);
    const req: ComponentRequirement = {
      productId: c.productId,
      variantId: c.variantId,
      productName: names.product,
      variantName: names.variant,
      unitCode,
      requiredBase: required,
      availableBase: 0,
      draws: [],
      sufficient: false
    };

    if (!compProduct) {
      req.blockReason = 'Produk komponen tidak ditemukan.';
      reasons.push(`${names.product}: produk tidak ditemukan`);
      requirements.push(req);
      bottleneck = 0;
      continue;
    }

    // Sub-composite policy: at production time the component must have its
    // own produced batches. We don't recursively make-from-raw — that would
    // muddy the audit and surprise the operator. Operator must produce the
    // sub-composite first.
    if (compProduct.kind === 'composite') {
      const have = batches
        .forStock(c.productId, c.variantId)
        .reduce((s, b) => s + b.qtyRemaining, 0);
      req.availableBase = have;
      if (have >= required) {
        const draws: PlannedDraw[] = [];
        let need = required;
        for (const b of availableBatchesFor(c)) {
          if (need <= 0) break;
          const take = Math.min(need, b.qtyRemaining);
          draws.push({ batchId: b.id, batchCode: b.code, take, unitCost: b.unitCost });
          totalCost += take * b.unitCost;
          need -= take;
        }
        req.draws = draws;
        req.sufficient = true;
        bottleneck = Math.min(bottleneck, Math.floor(have / perOutput));
      } else {
        req.blockReason = `Produksi ${compProduct.name}${
          req.variantName ? ` · ${req.variantName}` : ''
        } dulu — butuh ${required} ${unitCode}, hanya ada ${have}.`;
        reasons.push(req.blockReason);
        bottleneck = Math.min(bottleneck, Math.floor(have / perOutput));
      }
      requirements.push(req);
      continue;
    }

    // Goods component — straight FIFO across batches.
    const avail = availableBatchesFor(c);
    const haveTotal = avail.reduce((s, b) => s + b.qtyRemaining, 0);
    req.availableBase = haveTotal;
    if (haveTotal < required) {
      req.blockReason = `Butuh ${required} ${unitCode}, hanya ada ${haveTotal}.`;
      reasons.push(`${names.product}: ${req.blockReason}`);
      bottleneck = Math.min(bottleneck, Math.floor(haveTotal / perOutput));
      requirements.push(req);
      continue;
    }
    let need = required;
    const draws: PlannedDraw[] = [];
    for (const b of avail) {
      if (need <= 0) break;
      const take = Math.min(need, b.qtyRemaining);
      draws.push({ batchId: b.id, batchCode: b.code, take, unitCost: b.unitCost });
      totalCost += take * b.unitCost;
      need -= take;
    }
    req.draws = draws;
    req.sufficient = true;
    bottleneck = Math.min(bottleneck, Math.floor(haveTotal / perOutput));
    requirements.push(req);
  }

  const ok = requirements.every((r) => r.sufficient) && intendedQty > 0;
  return {
    ok,
    intendedQty,
    requirements,
    totalCost,
    bottleneckProducible: Number.isFinite(bottleneck) ? bottleneck : 0,
    blockReasons: reasons
  };
}

class ProductionRunsStore {
  items = $state<ProductionRun[]>([]);
  private nextId = 1;
  private nextCodeNum = 1;

  private generateCode(): string {
    const year = new Date().getFullYear();
    return `PROD-${year}-${fmtCodeNumber(this.nextCodeNum++)}`;
  }

  async add(
    input: ProductionRunInput
  ): Promise<{ ok: boolean; reason?: string; run?: ProductionRun }> {
    const product = products.getById(input.productId);
    if (!product) return { ok: false, reason: 'Produk tidak ditemukan.' };
    if (product.kind !== 'composite')
      return { ok: false, reason: 'Hanya produk komposit yang bisa diproduksi.' };
    if (input.intendedQty <= 0)
      return { ok: false, reason: 'Jumlah produksi harus lebih dari 0.' };
    if (product.variants.length > 0 && !input.variantId)
      return { ok: false, reason: 'Pilih varian yang akan diproduksi.' };

    const variant: ProductVariant | undefined = input.variantId
      ? product.variants.find((v) => v.id === input.variantId)
      : undefined;
    if (input.variantId && !variant)
      return { ok: false, reason: 'Varian tidak ditemukan.' };

    const producedQty = input.producedQty ?? input.intendedQty;
    if (producedQty <= 0)
      return { ok: false, reason: 'Jumlah yang dihasilkan harus lebih dari 0.' };
    if (producedQty > input.intendedQty)
      return {
        ok: false,
        reason: 'Jumlah yang dihasilkan tidak boleh lebih dari yang direncanakan.'
      };

    // Recompute the plan right before consuming so we catch any stock change
    // that happened between modal-open and submit.
    const plan = planConsumption(product.id, input.variantId, input.intendedQty);
    if (!plan.ok) {
      return {
        ok: false,
        reason: plan.blockReasons[0] ?? 'Stok komponen tidak cukup.'
      };
    }

    const locId = input.locationId || locations.defaultId();
    const todayISO = new Date().toISOString().slice(0, 10);
    const nowISO = new Date().toISOString();

    // 1) Reserve a code + id so produced batch & movements reference it.
    const runId = `prod_${this.nextId++}`;
    const runCode = this.generateCode();
    const reference = { kind: 'production' as const, id: runId, code: runCode };

    // 2) FIFO-consume each planned draw, logging production-out per batch.
    const consumptions: ConsumedComponent[] = [];
    let actualTotalCost = 0;
    for (const req of plan.requirements) {
      for (const draw of req.draws) {
        const batch = batches.getById(draw.batchId);
        if (!batch || batch.qtyRemaining < draw.take) {
          // Plan went stale between preview and submit. Roll back? In this
          // memory-only seed app the loss is acceptable; the planner re-runs
          // pre-submit so this should be extremely rare.
          return {
            ok: false,
            reason: `Stok ${req.productName} berubah selama persiapan. Coba lagi.`
          };
        }
        const updated = await batches.update(batch.id, {
          qtyRemaining: batch.qtyRemaining - draw.take
        });
        consumptions.push({
          productId: req.productId,
          variantId: req.variantId,
          batchId: batch.id,
          batchCode: batch.code,
          qtyConsumed: draw.take,
          unitCost: draw.unitCost
        });
        actualTotalCost += draw.take * draw.unitCost;
        await stockMovements.log({
          kind: 'production-out',
          productId: req.productId,
          variantId: req.variantId,
          locationId: batch.locationId,
          batchId: batch.id,
          qtyDelta: -draw.take,
          qtyAfter: updated?.qtyRemaining ?? batch.qtyRemaining - draw.take,
          unitCost: draw.unitCost,
          reference,
          notes: `Produksi ${product.name}${variant ? ` · ${variant.name}` : ''} · ${runCode}`
        });
      }
    }

    // 3) Resolve expiresAt — explicit field wins; otherwise derive from
    //    shelf-life-after-production (hours from now).
    let expiresAt = input.expiresAt;
    if (!expiresAt && product.shelfLifeAfterProductionHours) {
      const d = new Date();
      d.setHours(d.getHours() + product.shelfLifeAfterProductionHours);
      expiresAt = d.toISOString().slice(0, 10);
    }

    const perUnitCost = actualTotalCost / producedQty;
    const producedBatch = await batches.add({
      productId: product.id,
      variantId: input.variantId,
      ownership: 'owned',
      unitCost: perUnitCost,
      qtyReceived: producedQty,
      qtyRemaining: producedQty,
      receivedAt: todayISO,
      expiresAt: expiresAt || undefined,
      locationId: locId,
      notes:
        input.notes?.trim() ||
        `Hasil produksi ${runCode}${variant ? ` — ${variant.name}` : ''}`
    });
    await stockMovements.log({
      kind: 'production-in',
      productId: product.id,
      variantId: input.variantId,
      locationId: locId,
      batchId: producedBatch.id,
      qtyDelta: producedQty,
      qtyAfter: producedQty,
      unitCost: perUnitCost,
      reference,
      notes: `Produksi ${product.name}${variant ? ` · ${variant.name}` : ''} · ${runCode}`
    });

    // 5) Persist the run record.
    const run: ProductionRun = {
      id: runId,
      code: runCode,
      productId: product.id,
      variantId: input.variantId,
      intendedQty: input.intendedQty,
      producedQty,
      componentConsumptions: consumptions,
      producedBatchId: producedBatch.id,
      unitCost: perUnitCost,
      locationId: locId,
      expiresAt: expiresAt || undefined,
      shiftId: input.shiftId,
      notes: input.notes ?? '',
      createdAt: nowISO,
      status: 'completed'
    };
    this.items.push(run);
    return { ok: true, run };
  }

  getById(id: string): ProductionRun | undefined {
    return this.items.find((r) => r.id === id);
  }

  forProduct(productId: string, variantId?: string): ProductionRun[] {
    return this.items
      .filter(
        (r) =>
          r.productId === productId &&
          (variantId === undefined || r.variantId === variantId)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  recent(limit = 100): ProductionRun[] {
    return [...this.items]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  totalProducedSince(sinceISO: string): { runs: number; units: number } {
    let runs = 0;
    let units = 0;
    for (const r of this.items) {
      if (r.status !== 'completed') continue;
      if (r.createdAt < sinceISO) continue;
      runs += 1;
      units += r.producedQty;
    }
    return { runs, units };
  }
}

export const productionRuns = new ProductionRunsStore();
