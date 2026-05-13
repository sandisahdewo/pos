# Consignment — research and design notes

This is a research / design document captured before implementation. It explains how real POS and ERP systems handle consignment, what our current scaffold gets right and wrong, and a proposed middle-path implementation that fits the scaffold's scope.

> **Status:** Option B fully implemented (steps 1–5 of the migration sequence done) plus several post-launch enhancements:
> - Three-tier pricing UX on consignment PO lines (Q6)
> - `/inventory` route with Stock Adjustment dialog and Batches view (Q7 + Q8 — both moved here from the Produk form/list to enforce Produk = katalog / Inventaris = stok separation)
> - Variant-aware `currentCost` aggregation (Q9)
> - Auto-restock on order cancellation via `batchAllocations` replay
> - Partial PO receipts (`receivedQty` per line + per-line receive dialog)
> - **Per-product batch labeling + expiration tracking** — opt-in via `Product.requiresBatchLabel` / `requiresExpiration`. FIFO sort now prefers `expiresAt` ASC then `receivedAt` ASC. Thermal-printable label page at `/inventory/batches/[id]/label` with QR encoding `batch.code`. Expiring-soon badge on inventory rows. Bulk label print at `/inventory/po/[poId]/labels` covers every batch from a PO with per-batch qty multipliers (one label per crate up to N labels per unit) and "Cetak semua" sequencing.
> - **POS scan-to-sell** — the `/pos` search input resolves Enter input as product SKU, variant SKU, or batch code (in that priority). Scanning a QR label adds the matching product+variant to the cart at the current sale price; FIFO still picks the soonest-expiring batch on charge.
> **Last updated:** 2026-05-13.
> **Companion doc:** see [`PRODUCT_MODEL.md`](./PRODUCT_MODEL.md) for the current product/PO/order model; this doc only covers consignment-specific concerns.

## TL;DR

The current scaffold treats consignment as a **PO type flag** — which is the *right name* but the wrong semantics. We co-mingle consignment stock with owned stock, update product cost via weighted moving average on consignment receipts, and never create a payable to the consignor at sale time. There's literally no place that says "we owe Studio Karya Lokal Rp X for items sold this week."

Real systems land in one of two patterns:

- **Rigorous (Odoo)**: stock has an `owner` field; consignment stock has zero inventory value; sales create payables instead of COGS.
- **Pragmatic (Lightspeed / Vend)**: stock is tracked normally; a consignor-payout *report* sums per-supplier sales over a period; settlement is manual.

**Decision: adopt the rigorous model, scaled to the scaffold.** Introduce a `Batch` entity that snapshots ownership (`owned` | `consignment`), unit cost, source PO, supplier, and remaining quantity per receipt. Stock becomes derived (sum of matching batches' `qtyRemaining`). Sales deplete batches **FIFO by `receivedAt`** and stamp the depletion onto the order line, from which consignor payables are computed exactly — no heuristics. The pragmatic middle path was rejected because it still co-mingles owned and consigned cost basis and depends on a fuzzy "which sales are consignment?" rule.

## What consignment actually means

Consignment is an arrangement where a vendor (the **consignor**) places goods at a retailer (the **consignee**) without the retailer paying upfront. Title stays with the consignor until the goods sell. When a unit sells:

- Customer pays the retailer (revenue → retailer)
- Retailer owes the consignor a per-unit amount (often: "Harga Setoran" in Indonesia, "consignment cost" elsewhere)
- The retailer keeps the difference as commission/margin

Unsold goods can be returned to the consignor with no financial impact, because the retailer never owned them.

In Indonesian retail this is called *konsinyasi* or, colloquially, *titipan* — "to entrust / to deposit goods." Common in warungs, school canteens, souvenir shops, minimarkets, art galleries, antique shops, and second-hand stores.

### The Indonesian three-tier pricing convention

Indonesian accounting/POS guidance (Jurnal, Kledo, Mekari) usually models consignment with three explicit price tiers per product:

| Tier | Indonesian term | Who sets it | What it means |
|---|---|---|---|
| **HPP** | Harga Pokok Produksi | Consignor | Production / landed cost |
| **Harga Setoran** | (no English equivalent — "deposit price") | Consignor | What the consignor wants per unit when it sells. HPP + producer margin. |
| **HET** | Harga Eceran Tertinggi | Consignee | Consumer-facing sale price. Setoran + store commission (typically 10–25%). |

So for a mug: HPP = Rp 30k (producer cost) → Setoran = Rp 50k (consignor's ask) → HET = Rp 80k (shelf price). When the mug sells for Rp 80k, the store records:

- Revenue: Rp 80k
- Owe to consignor: Rp 50k
- Store gross margin: Rp 30k

The store *never pays the Rp 50k upfront*. They settle periodically (weekly/monthly) based on what actually sold.

## How real systems handle it

### Odoo (Inventory + Accounting) — the rigorous model

Odoo treats consignment as a fundamental **ownership** attribute on stock, not a tag.

- **Enabling**: Inventory → Configuration → Settings → Traceability → check "Consignment."
- **Receiving**: No PO. You create a manual receipt where `Receive From` = the supplier and `Assign Owner` = the same supplier. Goods appear in stock but are "owned by" the supplier.
- **Inventory valuation**: Consignment units do **not** appear in the stock valuation report. They are off-balance-sheet by design.
- **Selling**: Standard sales order. When delivered, revenue is recognized but inventory cost doesn't flow out (because you never owned the cost basis). A payable to the owner is created instead.
- **Reporting**: You can group stock moves by `Owner` to see which supplier still has goods sitting in your warehouse.
- **Reconciliation**: A separate "payouts to consignors" workflow settles what's owed.

This requires lot/batch-aware inventory — each receipt is a tracked event with its own owner. It's the financially correct model.

### Lightspeed Retail / Vend — the pragmatic model

Less rigorous, more common at small-to-mid retail:

- Products are **tagged** with a consignor (no separate stock buckets)
- Stock tracked normally — consignment units sit in the same warehouse number as owned units
- Sales tracked normally
- A **Consignor Payout Report** sums per-consignor sales over a period and exports as CSV
- Payouts are manual: cashier/owner cuts a check or transfers money, records the payout against the consignor's running balance
- Limitation Lightspeed itself documents: "no native consignor accounts; requires manual workflows using product tags or custom reporting"

This is what most small consignment shops, art galleries, and resellers actually use. The accounting isn't strictly correct (consignment units do show as inventory) but the operational outputs (who's owed what) are accurate.

### Indonesian accounting software (Jurnal, Kledo, Mekari)

Indonesian software often models consignment via **multi-warehouse**: each consignment relationship becomes a separate "warehouse" or location. Goods you've consigned-out to other stores live in those virtual warehouses. When a consignee reports back what sold, you create an invoice/sales record against that warehouse.

This is from the *consignor* perspective (you're a producer placing goods at other stores), not the *consignee* perspective (you're a retailer receiving titipan from suppliers). The two perspectives are mirror images.

Our POS scaffold is built for the **consignee** perspective.

## What our scaffold currently does

| Aspect | Current behavior | Verdict |
|---|---|---|
| Consignment marker | `PurchaseOrder.type: 'consignment'` discriminates the PO at creation | Right concept, right place |
| Stock on receipt | Increases like owned stock; mixed into the same `product.stock` field | OK pragmatically, but co-mingles owned + consigned units |
| Cost on receipt | Weighted moving average updates `product.cost` | **Wrong.** We don't own that cost. Mixing consignment unit prices into owned cost distorts margin reporting |
| Sale → payable | Nothing happens — no payable to consignor created | **Missing.** This is the load-bearing gap |
| Per-line provenance | Lost — once stock arrives, units are indistinguishable from owned | Limits what we can report later |
| Payout / reconciliation | Doesn't exist | **Missing.** No way to settle with consignors |
| Return to consignor | Doesn't exist | Minor — return-unsold-stock flow |
| List badge | Yes — Products list shows "Consignment" via `purchaseOrders.hasConsignmentFor(productId)` | Works as a visibility hint |

The core problem in one sentence: **we marked the door but didn't build the room.** The PO type discriminator exists; the financial behavior behind it doesn't.

## Proposed implementation — batch-tracked stock with FIFO depletion

The core change is to make **stock provenance first-class**. Every received quantity becomes a `Batch` row carrying who owns it, what it cost, where it came from, and how much remains. `Product.stock` and `ProductVariant.stock` become *derived* from those batches. Sales deplete batches FIFO by `receivedAt`, and the depletion is stamped onto the order line — so the payable to each consignor is computed from concrete history, never a heuristic. This is the Odoo-strict model, adapted to the scaffold's footprint.

### 1. The `Batch` entity

```ts
type BatchOwnership = 'owned' | 'consignment';

type Batch = {
  id: string;
  code: string;                   // human-readable: BATCH-YYYY-NNN, used on printed labels
  productId: string;
  variantId?: string;             // present when the product has variants
  ownership: BatchOwnership;      // snapshotted from source PO at creation
  supplierId?: string;            // consignor for consignment, vendor for owned-from-PO, undefined for manual adjustments
  sourcePurchaseOrderId?: string;
  sourcePurchaseOrderLineId?: string;
  unitCost: number;               // IDR per base unit at receipt time
  qtyReceived: number;            // base units; immutable after creation
  qtyRemaining: number;           // base units; decreases as sales/returns deplete; never negative
  receivedAt: string;             // ISO date — fallback FIFO sort key
  expiresAt?: string;             // ISO date when set; FIFO walks this ASC first, then receivedAt
  notes: string;                  // free-form (e.g., "initial seed", "found stock")
};
```

Lives in a new store `src/lib/stores/batches.svelte.ts`. A batch is created in three situations:

1. **PO receive** — one per PO line, `ownership` derived from `po.type`
2. **Manual stock adjustment** — `ownership: 'owned'`, no source PO, for initial seeding, found stock, count corrections
3. **Return-to-consignor decrement** — does not create a new batch; decrements an existing consignment batch's `qtyRemaining`

### 2. Stock becomes derived from batches

The scalar fields `Product.stock` and `ProductVariant.stock` are removed from the model. Stock is always queried through helpers:

```ts
stockOf(productId, variantId?): number
  // = sum of qtyRemaining across matching batches

stockBreakdown(productId, variantId?): { owned: number; consignment: number }
  // for richer displays: "80 owned + 10 consignment = 90 on hand"
```

All existing readers of `product.stock` and `variant.stock` (`totalStock`, `producibleStock`, the products list, the cart, `applyOrderToStock`) switch to `stockOf(...)`. Composite products' `producibleStock` recomputes via `stockOf` for each component — the existing per-variant recipe behavior is preserved.

The product form's Stock input is replaced by a small "Stock adjustment" action: enter a delta (+/−) with a reason. Positive deltas create a new owned batch; negative deltas decrement newest-first across owned batches (LIFO for write-offs preserves FIFO ordering of remaining stock for future sales).

### 3. `purchaseOrders.receive` creates batches; no more cost mutation

`receive(id)` stops touching `product.cost`/`variant.cost` and `product.stock`/`variant.stock`. For each PO line it creates one batch:

```ts
batches.create({
  productId: line.productId,
  variantId: line.variantId,
  ownership: po.type === 'consignment' ? 'consignment' : 'owned',
  supplierId: po.supplierId,
  sourcePurchaseOrderId: po.id,
  sourcePurchaseOrderLineId: line.id,
  unitCost: line.unitPrice / line.unitFactor,
  qtyReceived: line.quantity * line.unitFactor,
  qtyRemaining: line.quantity * line.unitFactor,
  receivedAt: po.receivedDate ?? todayISO(),
  notes: ''
});
```

Stock for the product/variant rises automatically because `stockOf` sums batches.

### 4. Sale flow depletes batches FIFO and stamps the order line

`applyOrderToStock(order)` deducts in base units, walking batches by `receivedAt` ASC. For composites, the same walk runs per component (existing per-variant or product-level recipe).

```ts
for each line:
  remaining := line.quantity * line.unitFactor
  allocations := []
  for batch in batches.matching(productId, variantId).orderBy(receivedAt ASC):
    if remaining == 0: break
    take := min(remaining, batch.qtyRemaining)
    batch.qtyRemaining -= take
    allocations.push({
      batchId: batch.id,
      qtyTaken: take,
      ownership: batch.ownership,
      unitCost: batch.unitCost,
      supplierId: batch.supplierId
    })
    remaining -= take
  if remaining > 0: abort — oversold (cart should not have permitted this)
  line.batchAllocations = allocations
```

`OrderLine` gains:

```ts
type BatchAllocation = {
  batchId: string;
  qtyTaken: number;        // base units
  ownership: BatchOwnership;
  unitCost: number;        // snapshot at sale
  supplierId?: string;     // snapshot at sale
};

// new field on OrderLine
batchAllocations: BatchAllocation[];
```

The allocations are **snapshotted onto the order line** — they survive batch mutations, batch deletion, and supplier renames, just like the existing per-line snapshots for product name, unit, tax rate, etc. This is the single source of truth for the Consignor Payout report and for any future COGS analysis.

### 5. Cost: manual field for bootstrap, derived helper for display

`Product.cost` and `ProductVariant.cost` stay editable in the form, but are **no longer auto-updated on receive**. They serve as:

- The bootstrap value for products with no batches yet
- The fallback for pricing math (`computeSalePrice`, `priceForQty`) when there are no owned batches

A new helper exposes the live picture:

```ts
currentCost(productId, variantId?): number
  // weighted avg of (qtyRemaining × unitCost) across OWNED batches
  // falls back to product.cost / variant.cost when no owned batches exist
```

We deliberately don't auto-overwrite the manual `cost` because consignment batches have **no cost basis to the retailer** and mixing them into pricing-cost is exactly the bug that motivated this refactor. The retailer can revise their manual `cost` themselves based on `currentCost` displays if they want to. (This also reverses the position in PRODUCT_MODEL.md §"Key decision 6: Cost is PO-derived" — that note will need a cross-update once this lands.)

### 6. Consignor Payout report and Payout entity

New route: `/payouts` (standalone; link from Supplier detail page). The report is driven entirely by stamped `batchAllocations`.

For a chosen date range and optional supplier filter, walk orders with `status === 'paid'`, and for each `OrderLine.batchAllocations` entry where `ownership === 'consignment'`:

- Group by `supplierId`
- **Units owed** = sum of `qtyTaken`
- **Amount owed** = sum of `qtyTaken × unitCost`
- **Already paid** = sum of `Payout.amount` for that supplier up to the range end
- **Outstanding** = owed − paid

```ts
type PayoutMethod = 'cash' | 'transfer' | 'other';

type Payout = {
  id: string;
  code: string;                   // PAYOUT-YYYY-NNN
  supplierId: string;
  amount: number;                 // IDR
  paidAt: string;                 // ISO date
  method: PayoutMethod;
  coversPeriodStart: string;      // ISO date
  coversPeriodEnd: string;        // ISO date
  notes: string;
};
```

Lives in `src/lib/stores/payouts.svelte.ts`. Single action on the report: "Record payout to {supplier}" → form (amount + method + period + notes). Outstanding column updates immediately.

### 7. Return unsold consignment stock

A "Return unsold consignment stock" action surfaces a list of consignment batches with `qtyRemaining > 0`, scoped to a supplier. The user picks a batch, enters a return quantity, the batch's `qtyRemaining` decrements. No payable, no order, no revenue impact — the retailer never owed for unsold units. The decrement is reflected in `stockOf(...)` immediately.

### 8. Worked example

Studio Karya Lokal sends 10 mugs on consignment. Setoran (consignor's per-unit ask) is Rp 50.000. We've also bought 10 mugs from a wholesaler at Rp 30.000. Shelf price (HET) is Rp 80.000.

| Day | Event | Batch state | `stockOf(mug)` | `currentCost(mug)` |
|---|---|---|---|---|
| 1 | Receive owned PO (10 × Rp 30k) | Batch O created: owned, qtyRemaining 10, unitCost 30k | 10 | Rp 30k |
| 5 | Receive consignment PO (10 × Rp 50k) | Batch C created: consignment, qtyRemaining 10, unitCost 50k | 20 | Rp 30k *(consignment ignored)* |
| 12 | Customer buys 12 mugs at Rp 80k | Batch O → 0, Batch C → 8. OrderLine.batchAllocations = `[{O, 10, owned, 30k}, {C, 2, consignment, 50k}]` | 8 | falls back to `product.cost` |
| 15 | Payout report shows Studio Karya Lokal owed Rp 100k (2 × 50k). Record payout Rp 100k by transfer. | unchanged | 8 | unchanged |
| 20 | Return 8 unsold consigned mugs to Studio Karya Lokal | Batch C → 0 | 0 | unchanged |

The customer paid Rp 960k. Our COGS on the sale: 10 × Rp 30k = Rp 300k. We owed the consignor: 2 × Rp 50k = Rp 100k. Gross margin: Rp 560k. None of this requires us to know up front whether a sale is "consignment" — it falls out of the FIFO walk and the stamped allocations.

### Migration sequence

1. **Rollback the cost mutation** in `purchaseOrders.receive` first (3-line change). Keeps the codebase honest in the meantime while the batch refactor is built. *(done)*
2. **Introduce `Batch` store + `stockOf`/`currentCost` helpers.** Populate batches lazily from existing PO history (or as a single synthetic "initial seed" owned batch per product/variant during one-time migration of seed data). *(done)*
3. **Switch the read-path helpers** in `products.svelte.ts` (`totalStock`, `producibleStock`, `producibleVariantStock`, `componentAvailableStock`) to delegate to `stockOf`. `producibleVariantStock` gains a `productId` parameter. Split into two sub-steps to keep each diff reviewable:
   - **3a.** Switch readers AND dual-write in `receive()` and `applyOrderToStock` so batches stay in sync with the still-authoritative scalar fields during transition. *(done)*
   - **3b.** Form translates its Stock input into `batches.adjustStock` calls (positive delta → new owned batch; negative → LIFO decrement). Scalar dual-writes stripped from `receive()` and `applyOrderToStock`. `Product.stock` and `ProductVariant.stock` removed from the type definitions. *(done)*
4. **Wire `applyOrderToStock` to the FIFO walk + `batchAllocations` stamping.** Add the `batchAllocations` field to `OrderLine`. (Step 3a already does the FIFO walk; step 4 adds the per-line snapshot needed for payouts.) *(done — `BatchAllocation` type exported from `batches.svelte.ts`; `deductBatchesFIFO` now returns the allocations; `applyOrderToStock` accumulates them across goods, composite components, and extras' components, then writes `line.batchAllocations = allocations`.)*
5. **Build `/payouts` route + `Payout` entity + return-to-consignor action.** Link from Supplier detail. *(done — `payouts.svelte.ts` store with `Payout` / `PayoutMethod` types and `paidToSupplier` helper; `consignmentOwedBySupplier` aggregation helper in `orders.svelte.ts`; `batches.returnToConsignor(batchId, qty)` method; `/payouts` route with Outstanding + History cards and Record-payout / Return-stock modals; sidebar nav under Procurement. Supplier detail page doesn't exist yet — link will be added when it ships.)*

## What to explicitly defer (and acknowledge)

The batch model covers stock-owner tracking, FIFO COGS for consignment, owned-vs-consigned separation, and the return-to-consignor flow — those used to be deferred and now aren't. What remains out of scope:

| Feature | Why deferred |
|---|---|
| Off-balance-sheet inventory valuation | Without an accounting module, valuation reports don't exist. The batch model would support it (sum `unitCost × qtyRemaining` per ownership), but rendering valuation reports is downstream work. |
| Consignor portal / supplier-facing view | Out of scope — supplier-facing UI is a different product surface. |
| Physical lot barcoding | Batches are a *logical* construct — one cashier-visible SKU on the shelf, no distinction at pickup. Tagging physical units with batch-specific barcodes is a separate inventory-tracking capability. |
| Multi-warehouse / per-location batches | Each batch could carry a `locationId` later. Same shape, one extra dimension to filter on. |

## Open design questions

### Resolved

1. **Which sales are consignment?** ✅ Resolved by Option B (batches): every stock-out is stamped with the originating batch's ownership at sale time. No heuristic, no per-product flag. The Option A (any-consignment-PO) and Option C (explicit per-product flag) routes from the earlier draft are abandoned.

2. **Deduction policy when both owned and consignment stock exist for the same SKU.** ✅ **FIFO by `receivedAt`** — pure date-based, ownership-agnostic. Matches Odoo's default and keeps the rule predictable. (Considered: owned-first for cash-flow, consignment-first for return-risk, per-supplier configurable. All rejected in favor of date-pure FIFO; revisit if a customer surfaces a real need.)

3. **Where does the Consignor Payout report live?** ✅ `/payouts` standalone, linked from the Supplier detail page. Settlement is a workflow, not a report drilldown — it warrants top-level visibility.

4. **Different shelf prices for the consignor's units?** ✅ Different shelf price = different product (or product variant). Batches handle ownership and cost basis; shelf price is a product/variant concern. Same physical object with different commercial offerings becomes separate SKUs. See PRODUCT_MODEL.md §"ProductVariant" for the variant model. Rationale: the POS cashier scans a barcode → product → price; a single SKU cannot display two prices simultaneously, and customers can't tell physical units apart. If a consignor wants a different shelf price, they're describing a different commercial offering.

5. **Rollback the current cost-update branch first, or refactor in place?** ✅ Rollback the 3-line cost mutation in `purchaseOrders.receive()` first to stop the bleeding, then build the batch model. Captured in the migration sequence above.

6. **Surface the three-tier pricing convention (HPP / Setoran / HET) on consignment PO lines?** ✅ Resolved: on consignment POs, the line's price input is labeled "Setoran" instead of "Harga satuan", and a derived strip below the line shows "HET disarankan {Rp X} · Margin +Rp Y (Z%)" pulled from the product's default pricelist (or variant pricing when targeted). Strip turns rose-colored when Setoran exceeds HET (negative margin). Implemented in `PurchaseOrderForm.svelte` via a `suggestedHETPerBase(line)` helper.

8. **Should we expose a "Batches" view for inspection?** ✅ Resolved: per-product modal accessible from the products list. The PackageSearch icon on each row opens a modal showing all batches (variant, ownership badge, received qty, remaining, unit cost, supplier, received date, source PO link, notes) plus a header with the owned/consignment breakdown and active/depleted counts. The per-supplier view (showing all consignment batches outstanding for a supplier) is still useful operationally and lives implicitly inside the Return-stock modal on `/payouts`.

9. **What does `currentCost` do for variant products with mixed-variant batches?** ✅ Resolved: when called with no `variantId` on a product that has variants, aggregate the weighted-average across all owned batches for that product (regardless of variant). Falls back to manual `product.cost` when no owned batches exist anywhere. Reverses the earlier "return undefined" stance because callers benefit from getting a sensible number; if a caller needs per-variant precision, they pass `variantId`.

7. **Where does the Stock Adjustment UI live?** ✅ Resolved: `/inventory` route. Each product row has "Atur stok" (Stock Adjustment) and "Lihat batch" (Batches view) actions. The adjustment dialog: variant picker (if applicable) → current stock display → signed delta input → unit cost (defaults to `currentCost`) → reason note → calls `batches.adjustStock`. The Produk form no longer has Stok inputs — that field used to live there but was removed to enforce a single source of truth (Produk = katalog, Inventaris = stok). New products start at 0; users adjust in Inventaris.

## Sources

- [Odoo Inventory: Consignment — buy and sell stock without owning it (v19)](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/daily_operations/owned_stock.html)
- [Odoo Inventory: Consignment (v18)](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/shipping_receiving/daily_operations/owned_stock.html)
- [Cybrosys: How to Use Odoo 17 Consignment to Manage Your Inventory](https://www.cybrosys.com/blog/how-to-use-odoo-17-consignment-to-manage-your-inventory)
- [Lightspeed Retail X-Series Support: Recording consignment sales and reports](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25533794499611-Recording-consignment-sales-and-reports)
- [Lightspeed Blog: What Is Consignment Inventory and How Does It Work?](https://www.lightspeedhq.com/blog/what-is-consignment-inventory/)
- [Merchant Maverick: Best POS Systems For Consignment Stores](https://www.merchantmaverick.com/pos-system-for-consignment-shop/)
- [Consignment POS: 7 Best POS Software for Consignment and Resale Shops](https://consignmentpos.com/7-best-pos-software-for-consignment-and-resale-shops/)
- [Mekari Jurnal: Konsinyasi Titip Jual (Indonesian workflow)](https://help-center.jurnal.id/hc/id/articles/4417369449881-Konsinyasi-Titip-Jual)
- [Kledo: Cara Mencatat Konsinyasi (Titip Jual)](https://kledo.com/cara-mencatat-konsinyasi-titip-jual/)
- [UKM Indonesia: Consignment overview (Indonesian)](https://ukmindonesia.id/baca-deskripsi-posts/consignment)
- [Ukirama: Sistem Consignment — Pengertian, Keuntungan, Risikonya](https://ukirama.com/blogs/konsinyasi-consignment)
- [Klikpajak: Pengertian Konsinyasi (Indonesian tax & accounting context)](https://klikpajak.id/blog/pengertian-konsinyasi-adalah/)
