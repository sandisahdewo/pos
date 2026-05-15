# Master Product Model

This document captures the design decisions, data model, and conventions for the **product master** in this POS scaffold. The goal is to give a future maintainer — human or AI agent — enough context to extend the system without re-deriving the rationale.

> **Status:** scaffold, frontend-only. No backend yet; all data is in-memory `$state` and resets on reload.
> **Last updated:** 2026-05-15 (Tax rates, Suppliers, Product images, Purchase Orders, Composite products, ProductKind discriminator, per-variant recipes, Extras, Customers, POS terminal + Orders added; consignment refactored to be PO-driven; scalar `Product.stock` / `ProductVariant.stock` removed and replaced by `Batch` rows with FIFO depletion; `Payout` entity + `/payouts` route ship the Consignor Payout report and return-to-consignor flow — see [`CONSIGNMENT.md`](./CONSIGNMENT.md) for the full design; `Location` resource and `Batch.locationId` added as an opt-in feature behind `settings.inventory.locationsEnabled`; `StockMovement` ledger + `StockOpname` cycle-count workflow added as an opt-in feature behind `settings.inventory.auditTrailEnabled` — every batch mutation logs a row, the count screen has an inline "Selidiki" panel for theft investigation).

## Table of contents

1. [Context](#context)
2. [The five dimensions of variation](#the-five-dimensions-of-variation)
3. [Data model](#data-model)
4. [Key decisions and why](#key-decisions-and-why)
5. [Form UX principles](#form-ux-principles)
6. [File map](#file-map)
7. [Helpers quick reference](#helpers-quick-reference)
8. [Conventions when extending](#conventions-when-extending)
9. [What's intentionally deferred](#whats-intentionally-deferred)
10. [Glossary](#glossary)

---

## Context

`/home/sandi/code/pos` is a SvelteKit 2 + Svelte 5 (runes) admin app for a Point-of-Sale system. The stack:

- SvelteKit 2 / Svelte 5 with `$state` / `$derived` / `$props` / `$bindable` / `$effect`
- Tailwind CSS v4 (CSS-first config in `src/app.css`, brand palette + tokens)
- `lucide-svelte` icons
- TypeScript
- `@sveltejs/adapter-auto`

Currently shipped: **Master Data** routes (Employees, Categories, Units, Pricelists, Tax rates, Products, Suppliers, Customers), **Sales** routes (POS with scan-to-sell, Orders), **Procurement** routes (Purchase Orders with partial receipts + expiration capture, Payouts), and **Inventory** (`/inventory` with Stock Adjustment + Batches view + per-batch label print + bulk PO label print at `/inventory/po/[poId]/labels`). Still 404: Dashboard widgets (data), Reports, Settings.

This doc focuses on the **Product** master because its model is significantly richer than the other resources.

---

## The five dimensions of variation

A Product can vary along several orthogonal axes, but with a **kind discriminator** (`'goods' | 'composite'`) that gates which combinations make sense:

| Dimension | Example | Lives on | Goods | Composite |
|---|---|---|---|---|
| **Customer tier** | Retail Rp 8.000 / Wholesale Rp 7.000 | `Product.prices: PricelistEntry[]` | ✓ | ✓ |
| **Quantity** | Buy 24+ for Rp 6.500 | `PricelistEntry.tiers: PricingTier[]` | ✓ | ✓ |
| **Packaging** | 1 pc / 6-pack / case of 24 | `Product.units: ProductPackaging[]` | ✓ | — |
| **Variant** | Red/S, Red/M, Blue/L | `Product.variants: ProductVariant[]` | ✓ | ✓ (with per-variant recipe) |
| **Pricing strategy** | Fixed, markup+amount, markup% | `PricelistEntry.pricing: PricingStrategy` | ✓ | ✓ |
| **Components (recipe / bundle)** | Combo = 1 espresso + 1 croissant | `Product.components: CompositeComponent[]` + per-variant | — | ✓ |
| **Extras / modifiers** | Extra cheese, extra sauce | `Product.extras: ProductExtra[]` | ✓ | ✓ |

Most products only use one or two dimensions. The form is designed so simple products see only the essentials and complex products opt into more, with the kind selector at the top of Basics filtering which feature chips appear.

**Tax** is orthogonal to pricing — it's applied on top of the computed sale price. Tax rate is resolved through a fallback chain: `Product.taxRateId` (optional override) → `Category.taxRateId` (category default) → global default `TaxRate.isDefault`. See [Tax](#tax) below.

---

## Data model

All types live in `src/lib/stores/products.svelte.ts`.

### `Product`

```ts
type ProductKind = 'goods' | 'composite';

type Product = {
  id: string;
  sku: string;
  name: string;
  kind: ProductKind;                              // discriminator — drives form gating
  categoryId: string;             // FK -> categories store
  unitId: string;                 // FK -> units store (base unit, e.g. "pcs")
  cost: number;                   // IDR per base unit; bootstrap value, not auto-updated by POs (see CONSIGNMENT.md)
  prices: PricelistEntry[];       // sale pricing per pricelist
  // stock is no longer a scalar field. Live stock is `stockOf(product.id)` summed
  // over matching `Batch` rows (see src/lib/stores/batches.svelte.ts).
  status: 'active' | 'archived';
  description: string;
  taxRateId?: string;             // optional override; inherits from category when omitted
  defaultSupplierId?: string;     // primary supplier; autofills new POs for this product
  imageUrl: string;               // URL or empty string; upload UI deferred to backend
  units: ProductPackaging[];      // additional packagings (base unit stays on `unitId`)
  attributes: ProductAttribute[]; // option templates for variant generation
  variants: ProductVariant[];
  components: CompositeComponent[]; // product-level recipe (used when no variants)
  extras: ProductExtra[];           // optional add-ons at sale time (sauces, toppings, gift wrap)
  requiresBatchLabel?: boolean;     // print a thermal label per received batch (perishables, lot-tracked)
  requiresExpiration?: boolean;     // capture expiration date on every batch; FIFO walks expiresAt ASC
};
```

There is **no `advanced` flag**. Use `isAdvanced(p)`, derived from `units.length || variants.length || attributes.length`.

### `PricingStrategy`, `PricelistEntry`, `PricingTier`

```ts
type PricingStrategy =
  | { kind: 'fixed'; value: number }          // sale = value
  | { kind: 'markup_amount'; value: number }  // sale = cost + value
  | { kind: 'markup_pct'; value: number };    // sale = cost × (1 + value/100)

type PricingTier = {
  minQty: number;
  pricing: PricingStrategy;
};

type PricelistEntry = {
  pricelistId: string;       // FK -> pricelists store
  pricing: PricingStrategy;  // base price (qty < smallest minQty)
  tiers: PricingTier[];      // ordered by ascending minQty; highest matching minQty wins
};
```

**Sale price is never stored.** Always compute via `computeSalePrice(cost, strategy)` or `priceForQty(entry, qty, cost)`.

### `ProductVariant`

```ts
type ProductVariant = {
  id: string;                      // uuid
  name: string;                    // display, e.g., "Red / Large"
  sku: string;
  cost: number;                    // own cost (used when components are empty); bootstrap value, not auto-updated by POs
  prices: PricelistEntry[];        // own pricing per pricelist
  // stock is derived from batches keyed by (productId, variantId).
  // Call `stockOf(productId, v.id)` to read it.
  barcode: string;
  values: Record<string, string>;  // {Color: "Red", Size: "Large"} — links to attributes
  imageUrl: string;                // URL or empty string
  components: CompositeComponent[]; // per-variant recipe (for composite kind only)
};
```

`values` is the structural key for the variant generator. Empty `values: {}` = manually-added variant; generated variants have a key per active attribute.

### `ProductPackaging`

```ts
type ProductPackaging = {
  unitId: string;              // e.g., "box"
  factor: number;              // how many base units this contains; e.g., 24
  prices: PricelistEntry[];
  barcode: string;
};
```

A packaging's effective cost is `factor × product.cost`. The base unit (`pcs`) is **not** repeated in `units[]`; it lives on `product.unitId`.

### `ProductAttribute`

```ts
type ProductAttribute = {
  id: string;
  name: string;        // e.g., "Color"
  values: string[];    // e.g., ["Red", "Green", "Blue"]
};
```

Drives the variant generator. `generateVariants(attrs, defaults)` returns the Cartesian product; `regenerateVariants(attrs, existing, defaults)` preserves edits on combos that still exist and drops orphans.

### `CompositeComponent`

```ts
type CompositeComponent = {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;     // in the component's base unit
};
```

A product is **composite** (a bundle or a recipe/BOM) when `components.length > 0`. The same model covers both:

- **Bundle**: "Coffee & Croissant Combo" — components are also sold individually
- **BOM / manufactured**: "Mie Tek-Tek = noodle + egg + mayo" — components may or may not be sold separately; whether they're individually sellable is just their `status` (active vs archived)

For composites, two product-level numbers are **derived** rather than stored:

- `effectiveCost(p) = sum(component.quantity × componentBaseCost)`. The product's manual `cost` field is ignored when components exist. Pricing strategies (markup_pct etc.) apply to this effective cost, so margins auto-update when component costs change.
- `producibleStock(p) = min(floor(componentStock / componentQuantity))`. "How many full units can we make from current ingredients?" Limited by the rarest component. Component stock is read via `stockOf(componentProductId, componentVariantId?)`.

The form switches the cost field to a read-only "Effective cost" display when components are present, and shows the read-only "Producible stock" derived from component availability. The form has **no Stok field** for goods either — stock is exclusively managed at `/inventory` (Stock Adjustment dialog / receive POs / sales / returns). This preserves the Produk = katalog / Inventaris = stok separation.

**Per-variant recipes**: when a composite product has variants, each variant has its own `components` array. Pricing math switches per-variant: `effectiveVariantCost(v) = sum(qty × componentCost)` when `v.components` is non-empty, else falls back to `v.cost`. Same for `producibleVariantStock`. The variant generator pre-seeds new variants with the product-level components as a starting point, then the user adjusts per variant (e.g., Combo Small: 1 noodle + 1 egg; Combo Large: 1 noodle + 3 eggs).

**Scaffold limitations:** components currently use the component product's base unit only (no sub-base units like "100 grams of flour" when flour's base is kg). The form's component product Select hides products that are themselves composite, to keep recursion out (no composite-of-composites yet).

### `ProductExtra`

```ts
type ProductExtra = {
  id: string;
  name: string;            // "Extra cheese"
  priceDelta: number;      // added to sale price when picked
  components: CompositeComponent[];  // optional stock impact when picked
};
```

Extras are **optional add-ons at sale time** that apply to either kind (goods or composite). Each extra carries a price delta added to the sale price and an optional list of components that get deducted from ingredient stock when the customer picks it. At the future POS terminal:

- `salePrice = baseProductPrice + sum(picked extras' priceDelta)`
- stock deducted: from base product/variant components + each picked extra's components

Extras are stored per product; no shared "modifier groups" master-data resource yet (could be added later for "Sauces" / "Toppings" reused across products). `required` flag (force-pick like "must choose size S/M/L") is **not implemented** in this scaffold — all extras are treated as optional toggles. Add it when POS sale UX needs single-select groups.

### `Supplier`

Lives in `src/lib/stores/suppliers.svelte.ts`. Master-data resource at `/suppliers`.

```ts
type Supplier = {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;      // typical days from order to delivery
  status: 'active' | 'archived';
  notes: string;
};
```

Suppliers power Purchase Orders (see below). `Product.defaultSupplierId` is a soft reference to a primary supplier — used to autofill the supplier when creating a new PO for that product. If the supplier is deleted, the reference dangles harmlessly and `defaultSupplier(p)` returns undefined.

### `Location`

Lives in `src/lib/stores/locations.svelte.ts`. Master-data resource at `/locations`. **Opt-in via `settings.inventory.locationsEnabled` (default off)** — small stores keeping everything in one place don't see the UI at all. The data model is always-on (every batch carries a `locationId`), so toggling later is zero-migration.

```ts
type LocationKind = 'shelf' | 'rack' | 'warehouse';

type Location = {
  id: string;
  name: string;              // "Etalase", "Rak Belakang", "Gudang"
  slug: string;
  kind: LocationKind;        // shelf → customer-visible by default
  customerVisible: boolean;  // overridable per zone
  isDefaultReceipt: boolean; // exactly one; PO receipts land here
  displayOrder: number;
  description: string;
  status: 'active' | 'archived';
};
```

Three locations are seeded: `Etalase` (shelf, customer-visible), `Rak Belakang` (rack, hidden), and `Gudang` (warehouse, hidden, **default receipt**). `locations.default()` returns the default-receipt entry; `locations.customerVisibleIds()` returns the set used by display chips. The store enforces "exactly one `isDefaultReceipt`" the same way `pricelists` enforces `isDefault`. `locations.remove(id)` returns `{ ok, reason? }` and blocks deleting the default location or any location still holding batches with `qtyRemaining > 0`.

**Storage model.** `Batch.locationId` is the only stock-location axis — a product with 5 on the shelf and 20 in gudang is two batches with the same `(productId, variantId)` and different `locationId`. The total `stockOf(...)` aggregates across all locations (single source of truth); `stockByLocation(...)` returns the per-location breakdown. **Sales walk `batches.forStock(...)` in unchanged FIFO order** (expiry asc, then receivedAt asc) — no shelf-first preference, so perishables stay protected regardless of where they sit.

**Stock movement.** `batches.moveStock({ batchId, toLocationId, qty, notes?, transferGroupId? })` splits the source batch into a sibling at the destination (preserving `unitCost`, `expiresAt`, `receivedAt`, `ownership`, `supplierId`, `sourcePurchaseOrderId/LineId`) so history stays intact. When `qty === src.qtyRemaining`, it mutates `locationId` in place to avoid zero-history zombies. `batches.moveProductStock({ productId, variantId?, fromLocationId, toLocationId, qty, notes? })` is the convenience wrapper that walks source batches sorted by **expiry asc** (the admin-awareness nudge — move expiring stock to Etalase first) and calls `moveStock` until satisfied. Callers can pass a shared `transferGroupId` so multiple `moveStock` calls land as one logical transfer in the movement log.

**Three move flows** sharing the same underlying `moveStock` call — pick whichever matches your physical context:

| Flow | Route | When to use |
|---|---|---|
| **Row modal** (per-product) | `/inventory` → "Pindah" button on a row | Desktop review-and-decide. Surfaces the batch-expiry preview panel inline before submit. |
| **Scan & Pindah** (basket) | `/inventory/move/scan` | Phone/handheld in the warehouse. Scan batch codes / SKUs (USB scanner emits as keyboard events with Enter; manual typing also works), accumulate in a basket, submit all to one destination with a shared `transferGroupId`. |
| **Pindah Massal** (from-location) | `/inventory/move/bulk` | Weekly refill / large reorganization. Pick source location once, check many batches (sorted by expiry asc with red/yellow hint badges), one destination, one submit. "Pilih yang mendekati kedaluwarsa" quick-action handles the "rotate perishables to the shelf" pattern. |

**Display visibility.** "Is this product on display for customers" is emergent from where its batches sit, not a product-level flag. A product is "warehouse-only" iff `stockByLocation(...)` has no entry at any `customerVisible` location. The POS surfaces this with a yellow "Ambil dari: Gudang · 80" chip; otherwise it shows per-location quantities (`Etalase · 5 / Gudang · 20`).

### `StockMovement` and `StockOpname` (audit trail + cycle count)

Lives in `src/lib/stores/stockMovements.svelte.ts` and `src/lib/stores/stockOpnames.svelte.ts`. **Opt-in via `settings.inventory.auditTrailEnabled` (default off)** — when off, the `stockMovements.log()` calls embedded at every batch mutation site are no-ops, so there's zero overhead.

```ts
type StockMovementKind =
  | 'receive' | 'sale' | 'sale-cancel'
  | 'adjust-in' | 'adjust-out'
  | 'move-out' | 'move-in' | 'move-relocate'
  | 'return-consignor';

type StockMovement = {
  id: string;
  code: string;          // MOV-YYYY-NNN
  at: string;            // ISO datetime
  kind: StockMovementKind;
  productId: string;
  variantId?: string;
  locationId: string;
  batchId: string;       // every movement attaches to a specific batch
  qtyDelta: number;      // signed base units (positive=+, negative=−, 0 for move-relocate)
  qtyAfter: number;      // batch's qtyRemaining post-mutation snapshot
  unitCost: number;      // snapshot for cost-impact reporting
  reference?: { kind: 'po' | 'order' | 'opname' | 'manual' | 'transfer' | 'return'; id: string; code?: string };
  performedBy: string;   // user.current.name snapshot
  notes: string;
};
```

**Hook sites (exhaustive):**
- `purchaseOrders.receive()` → `receive` (one per line).
- `applyOrderToStock` (via `deductBatchesFIFO`) → `sale` (one per `BatchAllocation` — a 5-line order across 10 batches = up to 50 rows).
- `orders.cancel()` → `sale-cancel` (one per allocation).
- `batches.adjustStock` → `adjust-in` (positive delta) or `adjust-out` (per batch in the LIFO walk).
- `batches.moveStock` → `move-out` + `move-in` for partial splits (sharing a `transferGroupId`), or `move-relocate` for full-remainder moves (qtyDelta=0).
- `batches.returnToConsignor` → `return-consignor`.

**`StockOpname` and the count workflow:**

```ts
type OpnameLine = {
  id: string;
  productId: string;
  variantId?: string;
  expectedQty: number;       // snapshot from stockByLocation at draft time
  countedQty: number | null; // admin enters during count; null = skip
  unitCost: number;          // snapshot for shrinkage value
  notes: string;
};

type StockOpname = {
  id: string;
  code: string;              // OPN-YYYY-NNN
  locationId?: string;       // omitted when locations feature is off
  startedAt: string;
  completedAt?: string;
  status: 'draft' | 'completed' | 'cancelled';
  lines: OpnameLine[];
  performedBy: string;
  notes: string;
};
```

`stockOpnames.buildDraft({ locationId?, categoryIds?, productIds?, notes? })` snapshots `expectedQty` and `unitCost` per (product, variant?) and returns a draft. `stockOpnames.complete(id, { skipUncounted })` walks lines with non-zero variance and calls `batches.adjustStock` with `reference: { kind: 'opname', id, code }` — so the resulting `adjust-in` / `adjust-out` movement rows are stamped to the opname for forward and reverse traceability.

**Investigation (theft detection):** the count screen at `/stock-opname/[id]` has a per-row "Selidiki" button that opens a side panel showing `stockMovements.forProduct(productId, variantId, { locationId, since: startedAt - 30d })` as a chronological timeline. When the admin sees a -1 variance, the panel reveals the trail: e.g. `+30 move-in (transfer) → -3 sale (ORD-2026-042) → -1 adjust-out (OPN-2026-001 shrinkage)` so they can spot any unaccounted gap.

### `PurchaseOrder`

Lives in `src/lib/stores/purchaseOrders.svelte.ts`. Routes at `/purchase-orders` (list), `/purchase-orders/new`, `/purchase-orders/[id]` (detail), `/purchase-orders/[id]/edit`.

```ts
type PurchaseOrderType = 'standard' | 'consignment';
type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

type PurchaseOrderLine = {
  id: string;
  productId: string;
  variantId?: string;       // required when product has variants
  quantity: number;         // ordered quantity (chosen unit)
  receivedQty: number;      // already received (chosen unit); 0 ≤ receivedQty ≤ quantity
  unitId: string;           // base unit or one of the product's packaging units
  unitFactor: number;       // base units per 1 of unitId; snapshot at PO creation
  unitPrice: number;        // IDR per unit (per chosen unit, not per base unit)
  notes: string;
};

type PurchaseOrder = {
  id: string;
  code: string;             // human-readable, auto-generated: PO-YYYY-NNN
  type: PurchaseOrderType;
  supplierId: string;
  status: PurchaseOrderStatus;
  orderDate: string;        // ISO date
  expectedDate: string;     // optional ISO date
  receivedDate: string;     // set when status -> received
  lines: PurchaseOrderLine[];
  notes: string;
};
```

**Status workflow:** `draft → sent → received` (one-way) with `cancelled` available from `draft` or `sent`. The detail page has the action buttons (`Mark as sent`, `Receive`, `Cancel`). Only drafts are editable.

**PO lines support packaging units.** A line can buy in the base unit OR any of the product's packaging units (a Cola line can buy "20 case at Rp 78.000" instead of "480 pcs at Rp 3.250"). The line stores `unitId` + `unitFactor` (factor is snapshotted at line creation so the PO doesn't drift if the product's packaging config changes later). The form's unit Select offers `base` and each packaging; when the user changes unit, `unitPrice` defaults to `(variant?.cost ?? product.cost) × factor`. Helpers `lineBaseQuantity(line)` and `lineBaseUnitCost(line)` convert to base units for display and stock math.

**Receive action** (`purchaseOrders.receive(id, opts?)`):
- Supports partial fulfillment. `opts.receiveQty` is a map `lineId → qty` (in the line's chosen unit). Omitted lines receive their full remaining `quantity − receivedQty`. Set qty to 0 to skip a line this round.
- For each line touched: creates one `Batch` row with `qtyReceived = qtyRemaining = qtyToReceive × unitFactor`, `unitCost = unitPrice / unitFactor`, `ownership = po.type === 'consignment' ? 'consignment' : 'owned'`, snapshotting `supplierId`, `sourcePurchaseOrderId`, `sourcePurchaseOrderLineId`, and `receivedAt`. The line's `receivedQty` is incremented by `qtyToReceive`.
- Status transitions: every line fully received → `received`; some but not all → `partial`. The PO can be received again from `partial` to complete remaining lines.
- Stock for the product/variant rises automatically because `stockOf(...)` sums batches. No scalar `product.stock` write happens any more.
- Cost is **not** auto-updated for either PO type. The manual `product.cost` / `variant.cost` field is the bootstrap value; live cost is `currentCost(productId, variantId?)` — weighted avg of owned batches' `unitCost`, falling back to the manual field when no owned batches exist. Consignment batches are deliberately excluded from `currentCost` since they aren't part of our cost basis.
- (Future) Standard PO will create an AP entry; consignment PO settles per-sale via the Consignor Payout report once the accounting / `/payouts` modules ship.

See [`CONSIGNMENT.md`](./CONSIGNMENT.md) §"Proposed implementation" for the full batch model.

**Consignment is now PO-driven.** There is no `consignment` field on Product anymore. A product is "on consignment" if it has at least one non-cancelled consignment-type PO referencing it. The helper `purchaseOrders.hasConsignmentFor(productId)` answers this; the products list page uses it to render the Consignment badge.

### `Customer` and pricelist assignment

Lives in `src/lib/stores/customers.svelte.ts`. Master-data resource at `/customers`.

```ts
type CustomerType = 'individual' | 'business';

type Customer = {
  id: string;
  name: string;
  type: CustomerType;
  email: string;
  phone: string;
  address: string;
  pricelistId: string;        // FK to Pricelist — drives checkout prices
  taxId: string;              // NPWP for businesses (Indonesian tax ID)
  status: 'active' | 'archived';
  notes: string;
  joinedAt: string;           // ISO date
};
```

Every customer has a `pricelistId`. When the POS terminal ships, selecting a customer at checkout switches the cart's effective pricelist to that customer's — drives `priceForQty` lookups for every line. Walk-in customers (no explicit customer selected at POS) use the global default pricelist (`pricelists.default()`).

The store exposes `customers.countByPricelist(id)` which the Pricelists list page uses to surface customer counts inline ("2 customers" linked back to `/customers?pricelist=pl_wholesale`). The `pricelist` URL query param pre-selects the pricelist filter on the customers list.

For Indonesian B2B compliance, business-type customers can store an `NPWP` (tax ID); the form shows that field only when `type === 'business'`. PPN-compliant invoices (future) will pull this onto the receipt.

### `Order` — sales from the POS terminal

Lives in `src/lib/stores/orders.svelte.ts`. Routes at `/pos` (terminal), `/orders` (list), `/orders/[id]` (detail).

```ts
type OrderStatus = 'paid' | 'cancelled';
type PaymentMethod = 'cash' | 'card' | 'qris' | 'transfer';

type OrderLineExtra = {
  extraId: string;
  name: string;            // snapshot
  priceDelta: number;      // snapshot
};

type OrderLine = {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;     // snapshot for receipt durability
  variantName: string;     // snapshot
  unitId: string;
  unitFactor: number;      // snapshot
  unitCode: string;        // snapshot
  quantity: number;        // in chosen unit
  unitPrice: number;       // resolved after tier; snapshot
  extras: OrderLineExtra[];
  taxRatePct: number;      // snapshot of tax % at sale time
  lineSubtotal: number;    // qty × (unitPrice + Σ extras.priceDelta)
  lineTax: number;         // lineSubtotal × taxRatePct/100
  lineTotal: number;       // lineSubtotal + lineTax
  batchAllocations: BatchAllocation[];  // populated by applyOrderToStock at charge — exact batches drawn down, snapshotted
};

type Order = {
  id: string;
  code: string;            // ORD-YYYY-NNN
  pricelistId: string;     // snapshot — even if customer's pricelist changes later, this stays
  customerId?: string;     // undefined for walk-in
  paymentMethod: PaymentMethod;
  lines: OrderLine[];
  subtotal: number;        // sum of line subtotals (pre-tax)
  taxTotal: number;        // sum of line taxes
  total: number;           // subtotal + taxTotal
  status: OrderStatus;
  notes: string;
  createdAt: string;       // ISO datetime
};
```

**All financial and product info is snapshotted onto the order** — product name, variant name, unit code, factor, prices, tax rates, and (per line) `batchAllocations`. If a product is renamed, repriced, or its batches mutated/deleted, historical orders remain accurate and the Consignor Payout report stays correct.

The POS terminal at `/pos` supports **multiple concurrent cart sessions** ("tabs"). The cashier can hold one customer's cart while serving the next — common when a customer steps away to grab something they forgot. A horizontal tab strip at the top of the cart panel shows each open session; clicking switches between them. New tabs auto-create with labels like "Tab 2"; once a customer is selected on a tab, the tab's label switches to the customer's name. Closing a tab with items shows a confirm dialog ("Discard 3 items?"). On Charge, the active session becomes an Order and is removed; if it was the last open tab, a fresh blank "Tab N" is auto-created. Session state lives in `src/lib/stores/cartSessions.svelte.ts` as a singleton — it survives navigating away from `/pos` within the same browser session but does **not** persist across reloads (real production would back this with localStorage or server state).

The POS terminal at `/pos` is a two-pane layout: product grid (left) + cart panel (right) with the tab strip on top of the cart. It resolves prices through the full chain:
- Customer's pricelist drives the active pricelist (walk-in → default)
- Each cart line finds its `PricelistEntry` based on whether it's a base / variant / packaging line
- `priceForQty(entry, qty, cost)` resolves quantity tiers
- Extras add their `priceDelta` per quantity
- `taxRateFor(product)` resolves the chain (product override → category → default tax rate); tax is computed per line and shown both inline and aggregated

**Scan-to-sell.** The search input doubles as a barcode/QR target. Pressing Enter triggers `resolveScanToken(text)`, which matches the typed/scanned text in priority order:
1. Exact `product.sku` (case-insensitive)
2. Exact `variant.sku` (case-insensitive)
3. Exact `batch.code` via `batches.getByCode(code)` — resolves to the batch's product + variantId

On a successful match, the line is added to the cart with the correct variant (if any) at the active pricelist's price, and the input clears. Composite products work too — scanning resolves to the composite product; `applyOrderToStock` then deducts each component normally. If no exact match, the text stays as a search filter (existing behavior).

USB barcode scanners that emulate keyboard + Enter work without extra setup. The QR codes printed on batch labels encode `batch.code`, so scanning a label at POS adds the right SKU. Note that scanning a batch QR is *product identification*, not *batch enforcement* — `applyOrderToStock` still walks FIFO on charge, so the soonest-expiring batch is decremented regardless of which batch was scanned.

`applyOrderToStock(order)` (called on charge) deducts stock by walking `Batch` rows FIFO (oldest `receivedAt` first):
- For simple goods: decrement `qtyRemaining` across batches matching `(productId, variantId?)` until `quantity × unitFactor` is satisfied
- For composite products: same FIFO walk per component (per-variant recipe if variant set, else product-level recipe)
- For each picked extra: walk batches for the extra's components per quantity sold
- Every batch touched is stamped onto the line's `batchAllocations` (snapshot of `batchId`, `qtyTaken`, `ownership`, `unitCost`, `supplierId`). The Consignor Payout report aggregates `batchAllocations` where `ownership === 'consignment'` to compute exact per-supplier payables — see the `Payout` section below.

Cancellation (`orders.cancel(id)`) flips status to `cancelled` AND restocks: walks each line's `batchAllocations` and adds `qtyTaken` back to each original batch's `qtyRemaining`. Batches that have been deleted are skipped silently. The `batchAllocations` snapshot remains on the cancelled order as a historical record of what was originally deducted.

### `Payout` — consignor settlements

Lives in `src/lib/stores/payouts.svelte.ts`. Route at `/payouts`.

```ts
type PayoutMethod = 'cash' | 'transfer' | 'other';

type Payout = {
  id: string;
  code: string;                // PAYOUT-YYYY-NNN
  supplierId: string;
  amount: number;              // IDR
  paidAt: string;              // ISO date
  method: PayoutMethod;
  coversPeriodStart: string;   // ISO date
  coversPeriodEnd: string;     // ISO date
  notes: string;
};
```

A `Payout` records a settlement to a consignor — money out the door. The `/payouts` page computes outstanding payables from `consignmentOwedBySupplier(...)` (which walks paid orders' `batchAllocations`) minus `payouts.paidToSupplier(supplierId, asOf?)`, then offers a Record-payout modal to log new settlements. The page also exposes a Return-stock action backed by `batches.returnToConsignor(batchId, qty)` so a retailer can hand back unsold consignment units without financial impact.

### `Pricelist` (cross-reference)

Lives in `src/lib/stores/pricelists.svelte.ts`. Master-data resource at `/pricelists`.

```ts
type Pricelist = {
  id: string;
  name: string;          // "Retail", "Wholesale", "VIP"
  isDefault: boolean;    // exactly one true; store enforces
  description: string;
};
```

Seed: Retail (default), Wholesale, VIP. The default cannot be deleted; the last remaining list cannot be deleted.

### `TaxRate` and tax resolution

Lives in `src/lib/stores/taxRates.svelte.ts`. Master-data resource at `/taxes`.

```ts
type TaxRate = {
  id: string;
  name: string;          // "PPN 11%", "Tax-exempt", "Zero-rated"
  rate: number;          // percentage (e.g., 11 for 11%)
  description: string;
  isDefault: boolean;    // exactly one true; used when neither product nor category specifies
};
```

Seed: PPN 11% (default), Tax-exempt, Zero-rated. The default cannot be deleted; the last rate cannot be deleted.

**Tax is resolved per product**, not per pricelist or per tier:

- `Category.taxRateId: string` — required. Each category has a default tax rate.
- `Product.taxRateId?: string` — optional override. When unset, the product inherits from its category.
- `taxRateFor(product)` walks the chain: product override → category default → global default. Always returns a TaxRate (or undefined only in degenerate cases).
- `priceWithTax(price, rate)` returns the tax-inclusive price for any computed sale price.

This matches the Indonesian retail reality: most items are PPN 11%, certain items (basic food, education, healthcare per UU HPP) are exempt, and you set this at the category level so individual products rarely need to override. The override exists for cases where one product within a category has a different status.

---

## Key decisions and why

These are load-bearing. If you disagree, change them deliberately — don't accidentally undo them.

### 1. No `margin_pct` strategy — markup only

Originally we had four strategies (fixed, markup_amount, markup_pct, margin_pct). Margin was removed because **markup is more intuitive for product pricing**. Markup answers "how much do I add to cost?"; margin answers "what fraction of sale is profit?". Both are real, but small retailers think in markup. Margin% is still displayed as informational text in the `PricingInput` preview alongside markup%.

### 2. Sale price is computed, never stored

`PricelistEntry.pricing` is the *strategy*; the actual price number is computed on read via `computeSalePrice`. Reason: when supplier cost changes (eventually via Purchase Orders), all markup-based prices auto-update without writes. UI should never multiply/add directly — use `basePrice(p)`, `priceRange(p)`, `priceForQty(entry, qty, cost)`.

### 3. Pricing is per-row, not just per-product

Each `ProductVariant`, `ProductPackaging`, and the `Product` itself has its own `prices: PricelistEntry[]`. A premium variant can have its own markup; a wholesale-only 24-pack can have its own tier ladder. Variant `cost` is also per-variant (a Brand Blue mug may cost more than White).

### 4. Pricelists rendered as a vertical list, not tabs

The form renders each pricelist as a stacked card. We tried tabs first; the problem was **hidden state** — errors on inactive tabs were invisible, and users developed anxiety about "what's in the other tab." The vertical list shows everything at once. Adding/removing a pricelist cascades the change to **all** variants and packagings to keep entries in sync.

### 5. `advanced: boolean` was dropped

There used to be `advanced: boolean` on Product that gated the form's packagings/variants visibility. It was removed because:
- It bundled three orthogonal features into one toggle
- "Advanced" is a meaningless label — users don't know what they're opting into
- It can be derived: `isAdvanced(p)` from data presence

Form now uses **progressive disclosure** — opt-in chips like `+ Add packaging`, `+ Add variants`. Sections appear only when populated.

### 6. Cost lives on batches; `product.cost` is a manual bootstrap fallback

Each `Batch` carries its own `unitCost` snapshotted at receipt time, and `currentCost(productId, variantId?)` returns the weighted average across remaining **owned** batches. `product.cost` / `variant.cost` are not auto-updated by `receive()` any more — they exist only as:
- The bootstrap value used by pricing math (`computeSalePrice`, `priceForQty`) before any batches exist for a product
- A manual fallback that's still editable in the product form

Consignment batches are deliberately excluded from `currentCost` since they aren't part of our cost basis. See [`CONSIGNMENT.md`](./CONSIGNMENT.md) §"Cost" for the full rationale.

### 7. Variant generator preserves edits on regenerate

When the user clicks "Generate variants" with attributes set, we don't wipe existing variants. `regenerateVariants` matches by `values: Record<string, string>` and preserves edited rows whose combo still exists. Orphans (combos no longer in the attribute set) are dropped. Manual variants (empty `values`) are also dropped. This is non-destructive enough that no confirm dialog is needed.

### 8. Quantity tiers stored per pricelist entry, not per product

`PricelistEntry.tiers` lives inside the entry, not at the product level. This is critical for the "wholesale customers get more aggressive volume tiers than retail" scenario — same product, different ladders per customer tier. `priceForQty(entry, qty, cost)` returns the right price for any quantity by walking tiers (highest matching `minQty` wins).

### 9. Currency is Indonesian Rupiah throughout

Locale `id-ID`, 0 fraction digits, dot as thousands separator (e.g., `Rp 25.000`). Helpers in `src/lib/utils/currency.ts` — `formatRupiah`, `formatRupiahNumber`, `parseRupiahNumber`. All monetary inputs use `<MoneyInput>` which formats live with thousand separators and preserves cursor position. If you ever change currency, change there and the seed prices.

### Tax

Tax is **always resolved through the fallback chain**: product override → category default → global default. The system never assumes "no tax" silently — there's always a resolved TaxRate, even if its rate is 0. This makes reports and POS calculations predictable.

Tax rate ≠ tax included in price. The PricelistEntry pricing is **tax-exclusive**. `priceWithTax(salePrice, rate)` computes the tax-inclusive figure. At the POS, you typically display tax-inclusive prices to walk-in customers (Indonesian retail convention) but break out the tax line on the receipt. The data model supports both views.

If you change tax behavior (e.g., display tax-inclusive in pricelists), do it in helpers, not by mutating stored values. Stored prices stay tax-exclusive.

### 10. UI primitives vs product-domain components

| Type | Location | Purpose |
|---|---|---|
| Reusable across any feature | `src/lib/components/ui/` | `Button`, `Input`, `Select`, `Modal`, `Card`, `Table`, `PricingInput`, `MoneyInput`, `ChipInput`, `Collapsible`, etc. Re-exported from `index.ts`. |
| Product-domain specific | `src/lib/components/products/` | `ProductForm.svelte`, `TierEditor.svelte` |

When in doubt, default to `ui/` only if it's truly generic. The product form and tier editor know about the product model and stay in `products/`.

---

## Form UX principles

The form (`ProductForm.svelte`) follows these rules. Future changes should respect them.

1. **Simple by default.** First-time user adding "Espresso, Rp 25.000" sees only Basics + Pricing (single pricelist) + Stock. Nothing else.

2. **Opt-in via chips.** New features (packagings, variants, additional pricelists, volume tiers) are added via labeled dashed-border chips. Clicking creates the first row and reveals its section.

3. **Cards, not tabs.** Major concepts (Basics, Pricing & inventory, Packagings, Variants, Organization) each get their own Card. Conditional cards (Packagings, Variants) only render when their data exists.

4. **Collapsible for repeat patterns.** Volume tier editors and per-pricelist pricing blocks inside variant/packaging cards use `<Collapsible>` to stay compact. The header summary shows current state (e.g., `Volume tiers (3)`, or `Sale pricing — Rp 150.000 (Retail) +1`).

5. **Sticky bottom action bar.** Cancel / Save stay on screen regardless of scroll position.

6. **Validation surfaces inline AND via toast.** Per-field errors render below their input. If submit blocks, a single toast tells the user to "fix the highlighted fields." All pricelists' entries are validated on every submit — no hidden errors.

7. **No tabs anywhere in the form.** Tabs hide state. We tried them for pricelists, removed them. Don't reintroduce them without a strong reason.

---

## File map

The shortest path to understanding the system:

```
src/
├── routes/
│   ├── pricelists/+page.svelte           # Pricelist CRUD (Modal-based)
│   ├── categories/+page.svelte           # Category CRUD (Modal-based)
│   ├── units/+page.svelte                # Unit CRUD (Modal-based)
│   ├── employees/+page.svelte            # Employee CRUD (Modal-based)
│   └── products/
│       ├── +page.svelte                  # Product list with filters
│       ├── new/+page.svelte              # Wraps ProductForm for create
│       └── [id]/edit/+page.svelte        # Wraps ProductForm for edit
├── lib/
│   ├── stores/                           # $state-backed singletons
│   │   ├── pricelists.svelte.ts          # Pricelist resource
│   │   ├── categories.svelte.ts
│   │   ├── units.svelte.ts
│   │   ├── employees.svelte.ts
│   │   ├── products.svelte.ts            # Product types + helpers (THE BIG ONE)
│   │   ├── sidebar.svelte.ts             # Sidebar collapse/mobile state
│   │   ├── toast.svelte.ts               # Toast notifications
│   │   └── user.svelte.ts                # User dropdown state
│   ├── utils/
│   │   └── currency.ts                   # Rupiah formatter/parser
│   └── components/
│       ├── layout/
│       │   ├── Sidebar.svelte            # Nav (Master Data group lives here)
│       │   ├── TopBar.svelte
│       │   └── ToastContainer.svelte
│       ├── ui/                           # Reusable primitives
│       │   ├── Button.svelte             # Supports `href` prop
│       │   ├── Input.svelte
│       │   ├── MoneyInput.svelte         # Rupiah formatting + cursor preservation
│       │   ├── PricingInput.svelte       # Strategy + value + live preview
│       │   ├── ChipInput.svelte          # Tag/chip input
│       │   ├── Collapsible.svelte        # Chevron expand/collapse
│       │   ├── ConfirmDialog.svelte
│       │   ├── Modal.svelte
│       │   ├── Tabs.svelte               # Available but NOT used in ProductForm
│       │   ├── Table.svelte
│       │   ├── ...
│       │   └── index.ts                  # Re-exports
│       └── products/
│           ├── ProductForm.svelte        # The big form (shared by new + edit)
│           └── TierEditor.svelte         # Volume-tier repeater
└── app.css                               # Tailwind v4 theme tokens
```

---

## Helpers quick reference

All in `src/lib/stores/products.svelte.ts` unless noted.

### Pricing math

| Helper | Returns | Notes |
|---|---|---|
| `computeSalePrice(cost, strategy)` | `number` | Core. Returns `NaN` if strategy value isn't finite. |
| `priceForQty(entry, qty, cost)` | `number` | Walks tiers; highest `minQty ≤ qty` wins. |
| `basePrice(p, pricelistId?)` | `number` | Defaults to default pricelist; falls back if missing. |
| `priceRange(p, pricelistId?)` | `{min, max}` | Across base + variants + packagings. |

### Pricelist entry lookups

| Helper | Returns | Notes |
|---|---|---|
| `findEntry(entries, pricelistId)` | `PricelistEntry \| undefined` | Strict match. |
| `effectiveEntry(entries, pricelistId, fallbackId?)` | `PricelistEntry \| undefined` | Falls back if missing. |
| `emptyEntry(pricelistId)` | `PricelistEntry` | Fixed strategy, value 0, no tiers. |
| `cloneEntry(entry)` | `PricelistEntry` | Deep clone (pricing and tiers). |
| `tierFor(entry, qty)` | `PricingTier \| null` | Highest matching tier. |

### Strategy + validation

| Helper | Returns | Notes |
|---|---|---|
| `validatePricing(strategy)` | `string \| null` | Inline error message or null. |
| `defaultPricing(value=0)` | `PricingStrategy` | `{ kind: 'fixed', value }`. |
| `isPercentKind(kind)` | `boolean` | `true` for `markup_pct`. Used by PricingInput to switch input type. |
| `pricingKindOptions` | `{value, label}[]` | For Select. |

### Variant generator

| Helper | Returns | Notes |
|---|---|---|
| `activeAttributes(attrs)` | `ProductAttribute[]` | Filters out attrs with empty name or no values. |
| `variantCombinations(attrs)` | `Record<string,string>[]` | Cartesian product. |
| `valuesMatch(a, b)` | `boolean` | Same keys + same values. |
| `generateVariants(attrs, defaults)` | `ProductVariant[]` | Fresh generation, ignores existing. |
| `regenerateVariants(attrs, existing, defaults)` | `ProductVariant[]` | Preserves edits on matching combos. |

### Product introspection

| Helper | Returns | Notes |
|---|---|---|
| `isAdvanced(p)` | `boolean` | True if packagings/variants/attributes exist. |
| `isComposite(p)` | `boolean` | True if `p.components.length > 0` (legacy — prefer `p.kind === 'composite'`). |
| `effectiveCost(p)` | `number` | For composites: `sum(qty × componentCost)`. For simple: `p.cost`. |
| `effectiveVariantCost(v)` | `number` | Per-variant: `sum(qty × componentCost)` if `v.components` non-empty, else `v.cost`. |
| `producibleStock(p)` | `number` | For composites: limited by rarest component (via `stockOf` per component). For simple: `stockOf(p.id)`. |
| `producibleVariantStock(productId, v)` | `number` | Per-variant: limited by rarest component if `v.components` non-empty, else `stockOf(productId, v.id)`. Signature gained `productId` so it can query batches. |
| `totalStock(p)` | `number` | Variants: sum of `producibleVariantStock(p.id, v)`. Composites (no variants): `producibleStock`. Else: `stockOf(p.id)`. |
| `pricelistEntries(p)` | `Set<string>` | All pricelist IDs across product, variants, packagings. |
| `hasAnyTier(p)` | `boolean` | True if any entry anywhere has tiers. |
| `taxRateFor(product)` | `TaxRate \| undefined` | Resolves the chain: product → category → default. |
| `priceWithTax(price, rate)` | `number` | Tax-inclusive of a sale price. |
| `defaultSupplier(p)` | `Supplier \| undefined` | Resolves `p.defaultSupplierId` to a Supplier; undefined if id is stale. |
| `purchaseOrders.hasConsignmentFor(productId)` | `boolean` | True if any non-cancelled consignment PO references this product. |
| `purchaseOrders.receive(id)` | `{ ok, reason? }` | Marks PO as received. Creates one `Batch` per line (ownership derived from PO type). No scalar `product.stock` / `product.cost` write. |
| `stockOf(productId, variantId?)` | `number` | Live stock — sum of `qtyRemaining` across matching batches. The single source of truth. |
| `stockBreakdown(productId, variantId?)` | `{ owned, consignment }` | Same as `stockOf` but split by ownership. For displays like "80 owned + 10 consignment". |
| `currentCost(productId, variantId?)` | `number` | Weighted avg of owned batches' `unitCost` across `qtyRemaining`; falls back to `product.cost` / `variant.cost` when no owned batches exist. Consignment batches excluded (not our cost basis). |
| `batches.forStock(productId, variantId?)` | `Batch[]` | FIFO-ordered batches with `qtyRemaining > 0`. Sort key: `expiresAt` ASC first (perishables sell first), then `receivedAt` ASC as fallback. Used by `applyOrderToStock` and any FIFO-walk caller. |
| `batches.forSupplier(supplierId, ownership?)` | `Batch[]` | Supplier-scoped batch list. Powers the consignor payout / return flows. |
| `batches.forSourcePO(poId)` | `Batch[]` | All batches created from a given PO, sorted by `receivedAt` ASC. Drives `/inventory/po/[poId]/labels`. |
| `batches.getByCode(code)` | `Batch \| undefined` | Look up by human-readable `BATCH-YYYY-NNN`. Used by the POS scan flow. |
| `batches.adjustStock({ productId, variantId?, delta, unitCost, locationId?, notes? })` | `void` | Manual stock adjustment. Positive delta → new owned batch at `locationId` (defaults to `locations.default().id`). Negative → LIFO decrement starting at `locationId`, falling through to other locations if shortfall remains. Used by the product form save. |
| `batches.forProduct(productId)` | `Batch[]` | All batches for a product (across variants, including depleted), sorted by `receivedAt` ASC. Drives the per-product Batches modal on the products list. |
| `batches.returnToConsignor(batchId, qty)` | `{ ok, reason? }` | Decrements a consignment batch's `qtyRemaining`. No payable, no revenue. Used by the Return-stock modal on `/payouts`. |
| `stockByLocation(productId, variantId?)` | `Map<locationId, qty>` | Per-location remaining stock for a (product, variant?). Drives the breakdown chips on `/inventory`, `/products`, and `/pos`. |
| `batches.moveStock({ batchId, toLocationId, qty, notes? })` | `{ ok, reason?, newBatch? }` | Splits the source batch into a sibling at the destination preserving all snapshotted fields. Full-remainder moves mutate `locationId` in place. |
| `batches.moveProductStock({ productId, variantId?, fromLocationId, toLocationId, qty, notes? })` | `{ ok, reason?, moved }` | Convenience wrapper. Walks source batches sorted by `expiresAt` ASC and chains `moveStock` calls until satisfied. Used by the Pindahkan modal on `/inventory`. |
| `locations.default()` / `locations.defaultId()` | `Location` / `string` | The single `isDefaultReceipt: true` location. PO receipts and unspecified positive adjustments land here. |
| `locations.customerVisibleIds()` | `Set<string>` | IDs of locations flagged customer-visible. Used to detect "warehouse-only" products and tint breakdown chips. |
| `locations.sortedActive()` | `Location[]` | Active locations sorted by `displayOrder` asc — used for consistent ordering across all surfaces. |
| `stockMovements.log({ kind, productId, batchId, locationId, qtyDelta, qtyAfter, unitCost, reference?, notes })` | `StockMovement \| undefined` | Append a ledger row; no-op when `settings.inventory.auditTrailEnabled` is off. Captures `performedBy` from `user.current.name` and `at` from `new Date().toISOString()` unless overridden. |
| `stockMovements.forProduct(productId, variantId?, { locationId?, since?, until?, limit? })` | `StockMovement[]` | Filtered chronological history (desc). Powers the Selidiki investigation panel. |
| `stockMovements.forReference(kind, id)` | `StockMovement[]` | All rows referencing a given source doc (PO, Order, Opname, transfer group, return). Asc by `at`. |
| `stockOpnames.buildDraft({ locationId?, categoryIds?, productIds?, notes? })` | `StockOpname` | Snapshots expected qty + unit cost per line. Composite products excluded. |
| `stockOpnames.complete(id, { skipUncounted? })` | `{ ok, reason?, adjusted, skipped }` | Reconciles non-zero variances via `batches.adjustStock` with an opname reference, sets status `completed`. |
| `opnameTotals(opname)` | `{ totalExpected, totalCounted, totalVariance, totalShrinkageValue, totalSurplusValue, countedLines, uncountedLines }` | Aggregates across lines; powers the StatCard strip on the count screen. |
| `consignmentOwedBySupplier({ start?, end? })` | `Map<supplierId, { units, amount }>` | Aggregates per-supplier consignment payable from paid orders' `batchAllocations` in a date range. Drives the Outstanding card on `/payouts`. |
| `payouts.add(input)` | `Payout` | Records a settlement to a supplier; auto-generates `PAYOUT-YYYY-NNN` code. |
| `payouts.paidToSupplier(supplierId, asOf?)` | `number` | Sum of recorded payouts to a supplier, optionally up to a cutoff date. The Outstanding column subtracts this from the owed amount. |
| `purchaseOrders.markSent(id)` | `{ ok, reason? }` | Transitions draft → sent. |
| `purchaseOrders.cancel(id)` | `{ ok, reason? }` | Transitions draft or sent → cancelled. |
| `poTotal(po)` | `number` | Sum of line subtotals. |
| `lineSubtotal(line)` | `number` | `quantity × unitPrice`. |
| `lineBaseQuantity(line)` | `number` | `quantity × unitFactor` — converted to base units. |
| `lineBaseUnitCost(line)` | `number` | `unitPrice / unitFactor` — per-base-unit price for cost math. |
| `products.countByCategory(id)` | `number` | Used by Categories page badge. |
| `products.countByUnit(id)` | `number` | Used by Units page badge. |
| `products.countByPricelist(id)` | `number` | Used by Pricelist page (not yet wired). |

### Currency (`src/lib/utils/currency.ts`)

| Helper | Returns | Notes |
|---|---|---|
| `formatRupiah(value)` | `string` | `Rp 25.000`. Returns `—` for non-finite. |
| `formatRupiahNumber(value)` | `string` | `25.000` (no symbol). |
| `parseRupiahNumber(input)` | `number` | Strips non-digits. |

---

## Conventions when extending

- **State management:** `$state`-backed class singletons in `src/lib/stores/*.svelte.ts`. See `toast.svelte.ts` (simple) and `products.svelte.ts` (complex) for patterns.
- **New master-data resource:** mirror the Categories / Units pattern — store with seed + `add` / `update` / `remove` / `getById`, Modal-based form for create/edit, `<ConfirmDialog>` for delete, add a nav item to the Master Data group in `Sidebar.svelte`.
- **Money:** always use `<MoneyInput>` for input, `formatRupiah()` for display. Never raw number inputs for currency.
- **Pricing math:** always go through `computeSalePrice` / `priceForQty` / `basePrice` / `priceRange`. Don't multiply/add directly.
- **Pricelist sync:** when adding or removing a pricelist on a product, mirror the change to every variant and packaging (see `addProductPricelist` / `removeProductPricelist` in `ProductForm.svelte`). Lookups gracefully fall back to the default pricelist, but writes should be explicit.
- **New UI primitive:** `src/lib/components/ui/`, exported from `index.ts`. Keep it generic (no domain knowledge).
- **Routes:** `+page.svelte` under `src/routes/<slug>/`. Dynamic params: `src/routes/<slug>/[id]/+page.svelte`. SvelteKit's `page.params.id` is typed as `string | undefined` — handle the missing case.
- **Frontend stack:** Svelte 5 runes only — no legacy `let`/stores. Tailwind v4 utilities. `lucide-svelte` for icons.
- **Validation:** inline errors per field + a single toast on submit. Don't show validation walls.
- **Form sections:** Cards, not tabs. Progressive disclosure for optional features.

---

## What's intentionally deferred

These exist in the mental model but aren't built:

| Feature | Status | Notes |
|---|---|---|
| Receipt printing | Not built | Order detail page is receipt-ready in layout; integrating ESC/POS or browser print is a future task. |
| Refunds / returns | Not built | Line-level partial refunds. Whole-order cancellation already restocks via `batchAllocations` replay (see `orders.cancel`). |
| Order discounts | Not built | Neither line-level nor order-level discounts implemented. Would add `discount: PricingStrategy` per line and per order. |
| Session persistence across reloads | Not built | Multi-session ("tabs") works, but state lives in memory. Backing with localStorage or a server-side store is future work for real cashier workflows. |
| Image upload | Not built | `imageUrl` is a URL string only. Backend needed for file uploads; storage choice (S3, local) and thumbnail generation TBD. |
| Excel/CSV import (`/products/import`) | Not built | Planned. Will use SheetJS `xlsx` client-side, row-per-SKU flat format with `Parent SKU` for variants, attribute columns (`Color`, `Size`), one price column per pricelist (`Retail Price`, `Wholesale Price`). Pricing strategies + tiers will be UI-only (import sets fixed prices) |
| Accounts Payable for POs | Not built | Currently receive() updates stock + cost, but no AP entry is created. When accounting lands, standard POs will create AP on receipt; consignment POs will create AP per-sale instead. |
| Customer → pricelist assignment | Not built | At checkout, a customer's `pricelistId` should drive `priceForQty` lookup |
| Orphaned `PricelistEntry` cleanup | Not done | When a Pricelist is deleted, dangling entries on products are harmless (fallback to default) but a sweep helper would tidy things |
| Backwards-compatible accordion on cards | Considered | If the form ever feels too long for products with both packagings and variants, make the card headers collapsible (accordion) rather than introduce tabs |
| Inventory movement log | Not built | Adjustments and sales create batches / decrement `qtyRemaining`, but there's no audit log surface. Could derive from batch creation timestamps + order batchAllocations for a future Movement view. |
| Multi-branch / multi-store | Not built | Single-store only. The current `Location` model covers multi-zone within one store (Etalase / Rak / Gudang); branching to multiple physical stores would need a `Store` axis above `Location`. |
| Per-location reorder points | Not built | A "low at Etalase, plenty at Gudang" alert that auto-suggests a transfer would close the loop on the manual move flow. |
| Movement log persistence / pruning | Not built | In-memory; resets on reload. Real audit needs a server-side append-only store with retention policy and tamper-evidence (hash chain). |
| Auth-bound performer tracking | Not built | `StockMovement.performedBy` snapshots `user.current.name` (hardcoded). When real session auth lands, switch to `employeeId`. |

---

## Glossary

| Term | Meaning |
|---|---|
| **Base unit** | The smallest unit you count in (e.g., `pcs`). Lives on `Product.unitId`. |
| **Packaging** | An alternative sellable form, e.g., a box of 24. `factor` is how many base units it contains. |
| **Variant** | A variation of a product (Red/M T-shirt vs Blue/L T-shirt). Each has own SKU, cost, prices, stock. |
| **Attribute** | An option type (`Color`, `Size`). Has a name + list of values. Used by the variant generator. |
| **Pricelist** | A customer tier (Retail, Wholesale, VIP). Determines which `PricelistEntry` applies. |
| **Pricelist entry** | A product's (or variant's, or packaging's) sale pricing for one pricelist. Has a base strategy + optional volume tiers. |
| **Pricing strategy** | How sale price relates to cost. Fixed price, cost + amount, or cost × markup%. |
| **Tier** | A higher-quantity override inside a pricelist entry. `{minQty, pricing}`. Highest matching `minQty` wins. |
| **Cost** | Per-base-unit cost. Lives on individual `Batch` rows (`unitCost`); the manual `product.cost` is a bootstrap fallback used when no owned batches exist. `currentCost(productId, variantId?)` returns the weighted average across remaining owned batches. |
| **Sale price** | What the customer pays. Computed from `cost + pricing` at read time. Never stored. |
| **Markup %** | Pricing strategy: `sale = cost × (1 + pct/100)`. |
| **Cost + amount** | Pricing strategy: `sale = cost + amount`. |
| **Fixed price** | Pricing strategy: `sale = value`, ignores cost. |
| **Tax rate** | A percentage applied on top of sale price (e.g., PPN 11%). Resolved per product via fallback chain. |
| **PPN** | Pajak Pertambahan Nilai — Indonesian VAT, standard 11% per UU HPP. |
| **Consignment / titipan** | Inventory supplied by a vendor that the store doesn't pay for until sold. Tracked via consignment-type Purchase Orders rather than a flag on the product. |
| **Supplier** | A vendor that supplies products via Purchase Orders. Master-data resource at `/suppliers`. |
| **Purchase Order (PO)** | A document recording an order placed with a supplier. Has a type (`standard` / `consignment`) that drives AP behavior on receipt. |
| **Goods receipt** | The act of marking a PO as received. Creates one `Batch` row per line; no scalar stock or cost mutation. |
| **Batch** | One received quantity of a (product, variant?) with its own `unitCost`, `qtyRemaining`, `ownership` (`owned` \| `consignment`), source PO, and `receivedAt` date. The single source of truth for stock. See [`CONSIGNMENT.md`](./CONSIGNMENT.md). |
| **Batch ownership** | `owned` (the retailer paid for it via a standard PO or initial seeding) or `consignment` (the consignor still owns it; we owe per-unit only on sale). `currentCost` only averages owned batches. |
| **FIFO depletion** | Sale deducts from batches ordered by `expiresAt` ASC, then `receivedAt` ASC. `applyOrderToStock` walks `batches.forStock(...)` and decrements `qtyRemaining` soonest-expiring first, then oldest-first. **No location preference** — perishables are protected regardless of where they sit. Location-aware filtering is available via `forStock(productId, variantId?, { locationIds })` but the sales path doesn't use it. |
| **Location** | A physical storage zone in the store (Etalase, Rak Belakang, Gudang). Lives on every `Batch` via `locationId`. Customer-visible flag controls whether stock there counts toward "displayed to pelanggan." Opt-in via `settings.inventory.locationsEnabled` — when off, the UI surface hides everywhere but the data model still records `locationId: 'loc_gudang'` by default. |
| **Move stock / pindahkan** | Splitting a batch's remaining quantity by location. Source batch decrements; a sibling is created at the destination preserving every other field. The Pindahkan modal on `/inventory` walks source batches by expiry asc so the admin moves expiring stock to Etalase first. |
| **Stock movement / pergerakan stok** | An entry in the audit ledger (`StockMovement`). Written by every batch mutation site when `auditTrailEnabled` is on. Carries kind, qty delta, qty-after, unit cost, reference doc, performer, timestamp. The single source of truth for "what happened to this product." |
| **Opname / stok opname** | Cycle count / physical audit. Admin picks a location + product scope, snapshots expected qty, enters counted qty, and the system records the difference as shrinkage (variance < 0) or surplus (variance > 0) via batch adjustments referenced back to the opname. Routes at `/stock-opname`. |
| **Shrinkage** | Negative variance discovered during opname — stock that exists in the system but not on the shelf. Most common cause: theft, breakage, miscounting. Reported as `|negativeVariance| × unitCost` aggregated per opname. |
| **Selidiki (investigate)** | Per-row action on the opname count screen that opens a side panel timeline of recent `StockMovement` rows for that (product, variant?, location). Used to trace where a missing unit went. |
| **Stock adjustment** | Manual change to on-hand quantity that doesn't come from a PO or sale (write-off, found stock, count correction, initial seed via the product form). Positive deltas create a new owned batch; negative deltas LIFO-decrement owned batches. |
| **Composite product** | A product built from other products (bundles, recipes, manufactured goods). `kind === 'composite'`; `cost` and `stock` are derived from components. |
| **Bundle** | A composite product whose components are typically sold individually too (e.g., "Coffee + Croissant Combo"). |
| **BOM (Bill of Materials)** | A composite product whose components are ingredients (e.g., "Mie Tek-Tek = noodle + egg + mayo"). Same data model as bundle; intent differs. |
| **Product kind** | The discriminator `'goods' \| 'composite'` chosen at the top of the product form. Filters which feature chips (packagings, components) appear. |
| **Per-variant recipe** | Each variant of a composite product can have its own `components` array, so e.g. Combo Small / Medium / Large can have different ingredient quantities. |
| **Extras / modifiers** | Optional add-ons picked at sale time (sauces, toppings, gift wrap). Each has a price delta and optional stock impact. Apply to either kind. |
| **Lead time / Waktu tunggu** | Typical days from placing an order to receiving goods. Stored on `Supplier.leadTimeDays` (global per supplier) with optional per-product override on `ProductSupplier.leadTimeDays`. Used for reorder-point math on /forecast. UI label: "Waktu tunggu". |
| **Buffer / Cadangan** | Extra days of safety stock added on top of waktu tunggu in the reorder formula. `bufferDays` arg defaults to 7. UI label: "Cadangan". |

---

## Newer features (built 2026-05-15)

The sections above describe the foundation. The features below extend it — payment lifecycle on orders + POs, the two finance pages, the per-product history view + reusable timeline component, the forecast subsystem, and a few POS terminal improvements. All described at the code-shape level (types, helpers, file paths); rationale for each lives in [Part II — Key design decisions](#key-design-decisions).

### Customer credit flag (`Customer.creditAllowed`)

```ts
// src/lib/stores/customers.svelte.ts
type Customer = {
  ...existing fields...
  creditAllowed: boolean;  // default false. Walk-in always treated as false.
};
```

Toggled per customer in the customer form (and in the inline "Tambah" modal on `/pos`). When `false`, the POS terminal refuses to complete any transaction where `paymentAmount < total`. Default seed: `cust_1`, `cust_2`, `cust_3` are `true`; `cust_4` (Siti Rahayu, walk-in regular) stays `false`.

### Order payments lifecycle (`status: 'credit'`)

```ts
// src/lib/stores/orders.svelte.ts
export type OrderStatus = 'paid' | 'credit' | 'cancelled';

export type OrderPayment = {
  id: string;        // opay_<uuid>
  amount: number;
  method: PaymentMethod;
  at: string;        // ISO datetime
  notes: string;
};

export type Order = {
  ...existing fields...
  paidAmount: number;        // cumulative payments received
  payments: OrderPayment[];  // chronological, includes the initial payment
};
```

**Behaviors:**
- `orders.add(input)` auto-seeds the first `OrderPayment` from the cart's `paymentMethod` + `paidAmount` when `paidAmount > 0`. So a fully-paid order has `payments: [oneEntry]` and a fully-credit order has `payments: []`.
- `orders.recordPayment(orderId, { amount, method, notes? })` appends a payment, increments `paidAmount`, flips status to `'paid'` when `paidAmount >= total`. Rejects overpay (`amount > outstanding`) and cancelled orders.
- `orderStatusLabels.credit = 'Piutang'`.

**POS validation** (`charge()` in `/pos/+page.svelte`):
- Computes `isPartialCash = isCash && paymentAmount < cartTotal`.
- If partial cash AND walk-in → blocked with toast.
- If partial cash AND customer without `creditAllowed` → blocked with toast.
- Otherwise: `paidAmount = isCash ? min(paymentAmount, cartTotal) : cartTotal`, `status = paidAmount >= total ? 'paid' : 'credit'`.
- Inline amber banner shows expected sisa piutang; rose banner explains rejection.
- Button copy switches from `Bayar Rp X` → `Catat piutang` when partial-cash + permitted.

### PurchaseOrder payments lifecycle

```ts
// src/lib/stores/purchaseOrders.svelte.ts
export type PurchaseOrderPaymentMethod = 'cash' | 'transfer' | 'other';

export type PurchaseOrderPayment = {
  id: string;        // popay_<uuid>
  amount: number;
  method: PurchaseOrderPaymentMethod;
  at: string;
  notes: string;
};

export type PurchaseOrder = {
  ...existing fields...
  paidAmount: number;
  payments: PurchaseOrderPayment[];
};
```

`purchaseOrders.recordPayment(poId, { amount, method, notes? })`:
- Rejects consignment POs (use `/payouts` instead).
- Rejects cancelled POs.
- Rejects overpay.
- Appends payment, increments `paidAmount`. (No status field flip — `PurchaseOrderStatus` is about receipt lifecycle, not payment.)

`poTotal(po) - po.paidAmount` is the outstanding utang.

Default seed: `PO-2026-001` paid 200k of 490k, `PO-2026-005` paid 100k of 477k. Drives non-empty `/utang` on first paint.

### `/utang` — Accounts payable to suppliers

`src/routes/utang/+page.svelte`. Standalone page; not an extension of `/payouts` (consignment payouts are deliberately separate, see [decision](#separate-utang--piutang-pages)).

**Row set:** every standard PO with status in `{sent, partial, received}` and `outstanding > 0` (default). Cancelled and drafts excluded.

**Stat cards:** total committed, total paid, total outstanding.

**Filters:** search (code/supplier/notes), supplier Select, status (`'open' | 'paid' | ''`), date range.

**Row actions:** Detail modal (payment timeline + Buka PO link) + Bayar modal (calls `purchaseOrders.recordPayment`).

### `/piutang` — Accounts receivable from customers

`src/routes/piutang/+page.svelte`. Standalone page.

**Row set:** orders with `customerId` set AND (`status === 'credit'` OR `status === 'paid' && payments.length > 1`). The second clause keeps historical multi-payment lifecycle orders visible in the "paid" view.

**Per-customer rekap card** (above the main table): groups outstanding by `customerId`, sorted by outstanding desc. Click a row to filter the main table. Shows a red "Piutang tidak diizinkan" badge when the customer's `creditAllowed` is false (data-integrity safety net).

**Stat cards:** total dijual on credit, total received, total outstanding.

**Filters:** search, customer, status (`'open' | 'paid' | ''`), date range.

**Row actions:** Detail modal (payment timeline + Buka pesanan link) + Terima modal (calls `orders.recordPayment`).

### `<MovementTimeline>` component

```svelte
<!-- src/lib/components/inventory/MovementTimeline.svelte -->
<script lang="ts">
  type Props = {
    movements: StockMovement[];
    emptyTitle?: string;
    emptyHint?: string;
    onImageClick?: (movement: StockMovement) => void;
  };
</script>
```

Vertical timeline (left border + colored dots). Each row: kind Badge with up/down arrow, signed colored qty delta, "→ sisa N", `Intl.DateTimeFormat('id-ID')` timestamp, performer, clickable reference code (link based on `reference.kind` → `/purchase-orders/[id]`, `/orders/[id]`, `/stock-opname/[id]`), reason badge, 40×40 image thumbnail, notes line.

Used by:
- Opname Selidiki panel (`/stock-opname/[id]`).
- Per-product history page (`/inventory/[productId]/history`).

### `/inventory/[productId]/history` — Per-product timeline

`src/routes/inventory/[productId]/history/+page.svelte`. Full-page audit story for one product.

**Header card:** product name + SKU. Back link to `/inventory`. Audit-off empty state when toggle is disabled.

**5 stat cards:**
- **Stok saat ini** — `stockOf(productId, variantFilter?)` with per-location breakdown when locations on.
- **Diterima** — sum of `receive` qtyDelta in window.
- **Terjual** — net of `sale` − `sale-cancel` deltas.
- **Penyesuaian** — split `+/-` of `adjust-in` / `adjust-out`, with shrinkage value (`Σ |negative adjust × unitCost|`) in IDR.
- **Pemindahan** — separate ↑ `move-in` / ↓ `move-out` totals.

**Filter strip:** search, variant Select (when product has variants), kind, location (when on), reason, date range.

**Timeline:** `<MovementTimeline>` fed with `stockMovements.forProduct(productId, variantId?)` filtered by the strip. Image preview Modal for clicked thumbs.

**Entry points to this page:**
- `/inventory` row Activity icon (when `auditOn`).
- "Lihat riwayat lengkap" link in the inventory Batches modal footer.
- "Buka riwayat lengkap" link in the opname Selidiki panel footer.

### Forecast subsystem

```ts
// src/lib/utils/forecast.ts
export function dailySalesRate(productId, variantId?, windowDays = 30): number;
export function currentStockFor(productId, variantId?): number;
export function daysOfSupply(productId, variantId?, windowDays = 30): number;
export function suggestedReorderQty({
  productId, variantId?, windowDays?, leadDays?, bufferDays?
}): number;
export function runwayBandFor(days): 'critical' | 'low' | 'watch' | 'ok' | 'inactive';
export const runwayBandLabels: Record<RunwayBand, string>;
export const runwayBandVariant: Record<RunwayBand, 'danger'|'warning'|'info'|'success'|'neutral'>;
export function formatRunway(days): string;        // '5.2 hari', 'Tidak ada penjualan', etc.
export function leadDaysFor(productId): number;     // resolves Supplier.leadTimeDays via Product.defaultSupplierId
export function forecastSubjects(): ForecastSubject[]; // flat list of (product, variant?) pairs
```

**Method:** sums non-cancelled `order.lines.quantity × unitFactor` for matching `(productId, variantId)` over the window, divides by windowDays. Works for goods + composites because every order line carries the parent productId (composites count "1 combo per line" regardless of how many ingredient units it consumed). Sales of ingredients via composites also count at the ingredient level via `applyOrderToStock` → `deductComponents` movements.

**Composite support:** `currentStockFor` picks `producibleStock` / `producibleVariantStock` for composites; `stockOf` for goods.

**Suggested reorder formula:** `ceil(rate × (lead + buffer))` where `lead = Supplier.leadTimeDays` and `buffer = bufferDays` arg (default 7).

**Bands:**
| Band | Days of supply | Use |
|---|---|---|
| `critical` | ≤3 (or negative) | Reorder hari ini |
| `low` | 4–7 | Reorder minggu ini |
| `watch` | 8–14 | Pantau, siapkan PO |
| `ok` | >14 | Belum perlu tindakan |
| `inactive` | `Infinity` (no sales) | Tidak ada data |

### `/forecast` — Prediksi Stok page

`src/routes/forecast/+page.svelte`.

**5 colored stat cards** counting items per band (Kritis / Menipis / Perhatikan / Aman / Tidak ada penjualan), filtered by category + location.

**Filter strip:** search, window (7/14/30/60/90), category, location (when on), urgency band, "Sembunyikan tanpa penjualan" toggle.

**Tunable buffer-days input** in the strip between header and rows — affects suggested reorder live.

**Table** sorted by runway asc, with rows: product+variant (linked to `/inventory/[id]/history`, with optional "Komposit" badge), stock with unit suffix, velocity ("~24/hari pcs"), runway Badge, suggested reorder qty with "lead 7h + buffer 7h" sub-line, supplier name (or "Belum di-set").

**Empty states** differentiate "no products" / "no products + hide-no-sales" / "no match for filter."

### Per-row forecast badge on `/inventory`

Small pill in the stock cell, shown only when `daysOfSupply(row.id, undefined, 30)` lands in `critical` / `low` / `watch` band. Colored rose / amber / sky to match band. Hidden for `ok` and `inactive` to avoid clutter. Title attr: "Berdasarkan rata-rata penjualan 30 hari terakhir."

### POS card quick-pick (variants + packagings)

Product cards in `/pos` grow a button strip below the main click area:

- **Has variants only** — one button per variant: `+ White ·N`, `+ Black ·N` (with per-variant available stock). Disables individual buttons when that variant has 0 stock.
- **Has packagings only** — `+ base` plus one per packaging: `+ Pack ·6`, `+ Box ·24`. Each tap = new cart line at that unit.
- **Both** — variant strip wins; packaging is switched on the cart line after add.
- **Neither** — no strip; main card click still adds 1 base unit.

Main click on the card still adds **first variant + base unit** (backward compatibility — cashier in a hurry doesn't have to aim).

`addToCart(p, variantId?, unitId?, unitFactor = 1)`.

### Inline "+ Tambah" customer on `/pos`

Small dashed-border button next to the Pelanggan label in the cart sidebar. Opens a focused modal:
- Name (required)
- Phone
- Type (Individu/Bisnis)
- Daftar harga
- `creditAllowed` Toggle
- Notes

Save → calls `customers.add(...)` with empty defaults for the rest (email/address/taxId), sets `joinedAt` to today, then auto-sets `session.customerId = created.id` so the new customer is immediately active in the tab.

### Atur Stok reason + image

```ts
// src/lib/stores/stockMovements.svelte.ts
export type StockAdjustmentReason =
  | 'damaged' | 'expired' | 'lost' | 'sample'
  | 'found' | 'initial-seed' | 'correction' | 'other';

export const adjustmentReasonLabels: Record<StockAdjustmentReason, string>;
export const adjustmentReasonsForOut: StockAdjustmentReason[];  // damaged/expired/lost/sample/correction/other
export const adjustmentReasonsForIn: StockAdjustmentReason[];   // found/initial-seed/correction/other

export type StockMovement = {
  ...existing fields...
  reason?: StockAdjustmentReason;
  imageUrl?: string;   // optional data URL via FileReader.readAsDataURL
};
```

`batches.adjustStock(...)` gains `reason?` and `imageUrl?` args; forwards both to `stockMovements.log` for every emitted row (both positive new-batch path and negative LIFO walk).

`/inventory` Atur stok modal:
- Required Alasan Select. Options switch based on Add/Subtract mode — picking Tambah shows only intake reasons, Kurangi shows only outflow reasons. Mode toggle resets the selection.
- Foto bukti uploader (dashed drop zone) → FileReader → data URL. 96×96 preview with "Hapus foto" button.
- Save validates reason set. If notes left blank, auto-fills with the reason label.

`/stock-movements`:
- Notes column renders 32×32 thumbnail (clickable → opens full image in a Modal with caption `MOV-… · Product · Reason`) + reason Badge + existing notes text.
- Toolbar gains a reason filter Select.
- Search matches the reason label too.

### Three move flows (scan basket, bulk picker)

In addition to the existing per-row `Pindah` modal:

**`/inventory/move/scan`** — scan-first basket. Top: destination Select. Center: large autofocused input that accepts `BATCH-YYYY-NNN`, variant SKU, or product SKU (parent SKU rejected on multi-variant products). Enter → `resolveToken` resolves to a specific batch and adds (or increments) a row in the basket. Each basket row has its own qty stepper + unit selector (when product has packagings — qty stored in BASE, display in chosen unit, steppers move by `factor`). Submit fires `moveStock` per item with a shared `transferGroupId`. Input refocuses after each scan and after submit for hands-free workflow.

**`/inventory/move/bulk`** — from-location batch picker. Pick source location once → batch list at source sorted by expiry asc. Each row: checkbox + per-row unit selector + qty input (default = batch qtyRemaining, capped). "Pilih semua" / "Pilih yang mendekati kedaluwarsa" / "Bersihkan" quick-actions. Submit moves all selected with shared `transferGroupId`.

Both flows: `batches.moveStock` accepts an optional `transferGroupId` so multi-batch transfers group as one logical operation in the ledger.

### Sidebar additions

New nav items added by these features:
- "Lokasi" — Data Master group (gated on `locationsEnabled`).
- "Opname Stok" — Katalog group (gated on `auditTrailEnabled`).
- "Riwayat Stok" — Wawasan group (gated on `auditTrailEnabled`).
- "Prediksi Stok" — Wawasan group (always shown).
- "Utang Pembelian" — new **Keuangan** group.
- "Piutang Pelanggan" — new **Keuangan** group.

`/payouts` (Pembayaran Konsinyasi) stays under Pengadaan (consignment-specific).

### Helpers quick reference (additions)

| Helper | Returns | Notes |
|---|---|---|
| `orders.recordPayment(id, { amount, method, notes? })` | `{ ok, reason?, order? }` | Appends `OrderPayment`, updates `paidAmount`, flips status to `'paid'` when fully covered. Rejects overpay/cancelled. |
| `purchaseOrders.recordPayment(id, { amount, method, notes? })` | `{ ok, reason?, po? }` | Same for POs. Rejects consignment POs (use `/payouts`) + cancelled + overpay. |
| `dailySalesRate(productId, variantId?, windowDays = 30)` | `number` | Σ `quantity × unitFactor` for non-cancelled order lines in window ÷ windowDays. |
| `currentStockFor(productId, variantId?)` | `number` | Picks `producibleStock`/`producibleVariantStock` for composites, `stockOf` for goods. |
| `daysOfSupply(productId, variantId?, windowDays = 30)` | `number` | `currentStock / rate`; `Infinity` when no sales. |
| `suggestedReorderQty({ productId, variantId?, leadDays?, bufferDays? = 7 })` | `number` | `ceil(rate × (lead + buffer))`. 0 when no sales. |
| `runwayBandFor(days)` | `'critical'\|'low'\|'watch'\|'ok'\|'inactive'` | ≤3 / ≤7 / ≤14 / >14 / no-sales. |
| `formatRunway(days)` | `string` | "5.2 hari" / "Tidak ada penjualan" / "Sudah habis" / "<1 hari". |
| `leadDaysFor(productId)` | `number` | Resolves `Product.defaultSupplierId` → `Supplier.leadTimeDays`. |
| `forecastSubjects()` | `ForecastSubject[]` | Flat list of (product, variant?) pairs for forecast iteration. |
| `customers.add({ ..., creditAllowed })` | `Customer` | Extends existing add; `creditAllowed` defaults false in form, true in seed for selected customers. |

### File map (additions)

```
src/lib/stores/
  customers.svelte.ts         + creditAllowed field on Customer
  orders.svelte.ts            + OrderStatus 'credit', OrderPayment, paidAmount, payments, recordPayment
  purchaseOrders.svelte.ts    + PurchaseOrderPaymentMethod, PurchaseOrderPayment, paidAmount, payments, recordPayment
  stockMovements.svelte.ts    + StockAdjustmentReason types + labels + option lists; movement reason/imageUrl fields
  batches.svelte.ts           + adjustStock reason/imageUrl args; moveStock transferGroupId; moveProductStock wrapper

src/lib/utils/
  forecast.ts                 NEW — daily rate, days of supply, reorder, runway bands, subject iterator

src/lib/components/inventory/
  MovementTimeline.svelte     NEW — reusable vertical timeline component

src/routes/
  customers/+page.svelte      + creditAllowed Toggle in form
  pos/+page.svelte            + quick-pick variant/packaging buttons, + Tambah customer modal, piutang validation
  inventory/+page.svelte      + forecast badge in stock cell, Riwayat row action, reason+image in Atur modal,
                               Lihat batch modal "Lihat riwayat lengkap" footer
  inventory/[productId]/history/+page.svelte  NEW
  inventory/move/scan/+page.svelte            NEW
  inventory/move/bulk/+page.svelte            NEW
  stock-movements/+page.svelte                + reason filter, reason badge + image thumb + preview modal
  stock-opname/[id]/+page.svelte              + multi-packaging count input, Selidiki uses MovementTimeline,
                                                "Buka riwayat lengkap" footer link
  utang/+page.svelte          NEW
  piutang/+page.svelte        NEW
  forecast/+page.svelte       NEW
```

### Seed data summary (drives non-empty first-paint demos)

- **14 orders** (`ORD-2026-001..014`): 1 cancelled (Espresso), 4 paid Telur/Daging (referenced from movements), 7 paid consignment-mug sales (drive `/payouts` owed for `sup_3`), 2 credit orders (`ORD-013` Andi partial 100k/166.5k, `ORD-014` PT Distributor full credit 122.1k → drive `/piutang`).
- **26 movements** total. Anchored to seed batches; each batch's final qtyAfter matches its current `qtyRemaining` for full reconciliation.
- **10 opnames** (`OPN-2026-001..010`): 1 with Telur shrinkage (cross-linked from `mov_seed_10`), 6 zero-variance completed, 2 drafts, 1 cancelled.
- **3 payouts** to `sup_3` (200k + 150k + 80k = 430k paid of 510k owed → 80k outstanding).
- **2 PO partial payments** (PO-2026-001 200k of 490k, PO-2026-005 100k of 477k).
- Batches reconciled: `batch_1` 116/120, `batch_2` 78/80, `batch_4` 12/18, `batch_5` 8/12, `batch_6` 3/6, others unchanged.

---

## Shift & Kas (built 2026-05-15)

Cashier shift tracking with PIN authentication, planned shift templates, and per-shift cash reconciliation (drawer in/out + variance against cash sales). Opt-in via `settings.operations.shiftsEnabled` (default on); when off, POS works as before and no shift attribution happens.

### `Employee.pin`

```ts
// src/lib/stores/employees.svelte.ts
type Employee = {
  ...existing fields...
  pin: string;  // 4-digit numeric, plaintext for the scaffold
};
employees.verifyPin(employeeId, pin): boolean;
```

PIN is enforced unique across employees at the form-validation layer in `/employees`. Re-seeded with Indonesian warmindo-context names (Sari Wahyuni admin, Joko Susilo manajer, Rina Marlina kasir, Andi Pratama kasir, Dimas Saputra staf).

### `ShiftTemplate`

```ts
// src/lib/stores/shiftTemplates.svelte.ts
type ShiftTemplate = {
  id: string;
  name: string;          // "Pagi", "Sore", "Malam"
  startTime: string;     // "HH:MM"
  endTime: string;       // "HH:MM" — wraps past midnight (22:00 → 06:00 OK)
  notes: string;
  status: 'active' | 'archived';
};
plannedDurationHours(t): number;   // handles overnight wrap
formatShiftRange(t): string;       // "06:00–14:00"
```

Templates are **labels + planned hours**, not hard gates. Actual start/end is logged from real time at open/close. CRUD inlined into `/settings` page (no separate route).

### `ShiftSession`

```ts
// src/lib/stores/shifts.svelte.ts
type CashDenomination = { unit: number; count: number };
type CashCount = {
  total: number;
  denominations?: CashDenomination[];  // optional — collapsed by default
};
type CashEntry = {
  id: string;
  at: string;
  kind: 'in' | 'out';
  category: CashEntryCategory;  // modal-tambahan | beli-bahan | operasional | ...
  amount: number;
  notes: string;
  performedBy: string;
};
type ShiftSession = {
  id: string;
  code: string;          // SHF-YYYY-NNN
  employeeId: string;
  templateId?: string;
  openedAt: string;
  closedAt?: string;
  status: 'open' | 'closed' | 'cancelled';
  openingCash: CashCount;
  closingCash?: CashCount;
  expectedClosingCash?: number;  // computed at close
  variance?: number;             // closingCash.total - expectedClosingCash
  entries: CashEntry[];
  notes: string;
};
```

Store API: `shifts.open()`, `shifts.addEntry()`, `shifts.removeEntry()`, `shifts.close()`, `shifts.cancel()`, `shifts.active()`. Only ONE shift can be open at a time (`open()` rejects when one is already active).

Helpers:
- `expectedClosingCash(shift)` — openingCash + cash sales in window + cash entries (in) - cash entries (out)
- `salesSummary(shift)` — `{ orderCount, grossTotal, byMethod, outstandingCredit }`, scoped to orders where `shiftId === shift.id` AND created within the open/close window
- `cashSalesIn(shift)` — sum of `OrderPayment` where method='cash' and time within the shift window
- `denominationTotal(denoms[])` — `sum(unit × count)`
- `shiftDurationHours(s)` / `formatDuration(hours)`

`IDR_DENOMINATIONS` constant (`[100000, 50000, ..., 100]`) drives the optional per-pecahan input rows. The `CashCountInput` component (in `src/lib/components/shifts/`) wraps a `MoneyInput` for the total with a collapsible "Hitung per pecahan" section that, when expanded, syncs total to `sum(unit × count)` live.

### `Order.shiftId` attribution

```ts
type Order = {
  ...existing fields...
  shiftId?: string;     // populated by POS only when shifts feature is on AND an active shift exists
};
```

Soft attribution — POS never blocks sales for absent shift. When shifts off, `shiftId` stays undefined and `salesSummary` falls back to time-window matching only.

### Routes

| Route | What it does |
|---|---|
| `/shifts` | List of all shifts. Stat cards (active count, closed today, today's cash sales, today's variance). Filter by employee/status/date. Active shift banner pinned to top. |
| `/shifts/[id]` | Detail page. Header card (employee + template + duration + notes). Catatan kas card (opening cash, sales-tunai, each cash entry, expected total). Rekap penjualan card (count, gross, per-method breakdown, piutang baru). Pesanan list at the bottom. Actions: Tambah kas / Tutup shift / Batalkan (when open). |
| `/settings` | Hosts the shifts toggle + shift template editor (add/edit/archive/delete templates inline). |

### Components (`src/lib/components/shifts/`)

| File | Purpose |
|---|---|
| `CashCountInput.svelte` | Bindable `CashCount` field. Total via `MoneyInput`, optional collapsible denomination breakdown that syncs total. |
| `OpenShiftModal.svelte` | Pick employee → PIN entry (4-digit, show/hide toggle) → pick template (or "Bebas") → opening cash → optional notes. Verifies PIN via `employees.verifyPin`, opens via `shifts.open`. |
| `CloseShiftModal.svelte` | Shows live ringkasan (kas awal + tunai + entries → seharusnya), enters closing cash (with optional denom breakdown), live variance preview color-coded (emerald/sky/rose). Calls `shifts.close`. |
| `CashEntryModal.svelte` | In/out toggle (color-coded buttons), category Select (different lists for in vs out), MoneyInput, notes Textarea. Calls `shifts.addEntry`. |

### POS terminal integration (`/pos`)

When `shiftsEnabled` is on:
- **Active shift banner** (emerald): cashier name, code, template label, open time, live order count + cash total, "Tambah kas" / "Detail" / "Tutup shift" buttons.
- **No active shift banner** (amber): "Belum ada shift terbuka" + "Buka shift" button. Sales still allowed (soft gate).
- New orders auto-stamp `shiftId` and `employeeId` from `shifts.active()`.

### Sidebar

When `shiftsEnabled` is on, a new "Operasional" group appears with "Shift Kasir" → `/shifts` (icon: `CalendarClock`). When off, the group is hidden.

### Decision: PIN, not session login

The user wants PIN-based clock-in rather than username/password login or just a dropdown pick. PIN strikes the right balance for warmindo: fast (4 digits), prevents misattribution if a kasir accidentally picks the wrong name, and doesn't require an auth stack the rest of the app doesn't have. PIN is stored plaintext at the scaffold level — when persistence + real auth land, hash it.

### Decision: Soft attribution (no shift required to sell)

Other POS systems hard-gate sales behind an open shift. Warmindo are flexible — owner sometimes operates without formal shifts during quiet hours, and forcing a shift open would create friction. POS allows sales either way; the amber "no shift" banner is advisory. When backed by real auth + multiple registers, this can grow into per-register required shifts; for now soft attribution is the right default.

### Decision: Per-shift cash drawer, not per-register

A single open shift at a time, drawer is whichever cashier is logged in. Multi-cashier parallel shifts (e.g., front register + delivery register) is plausible but deferred. The store's `active()` returns the single open session; `open()` rejects if one is already open.

### Decision: Cash entries inline, not separate ledger

Cash in/out lives **inside** the shift session as `entries[]`, not as a global cash ledger. Reason: every cash entry happens within a shift context (someone authorized it on their watch), and a global "kas keluar" history can be derived later by flattening `shifts[].entries[]`. Keeps the data model tight; no orphan rows.

### Shift schedule (jadwal shift)

Owner/admin plans which employee works which template on which day — for one week, one month, or one year — without manually creating each day.

```ts
// src/lib/stores/shiftSchedule.svelte.ts
type AssignmentStatus = 'planned' | 'completed' | 'absent' | 'replaced';
type ShiftAssignment = {
  id: string;
  date: string;              // YYYY-MM-DD
  templateId: string;
  employeeId: string;
  notes: string;
  status: AssignmentStatus;
  actualShiftId?: string;    // populated when the planned assignment turns into a real ShiftSession
};
```

Store API:
- `add`, `update`, `remove`, `getById`
- `forDate(iso)` / `forRange(start, end)` / `forEmployee(id, opts)`
- `bulkGenerate({ startDate, endDate, pattern, skipExisting?, notes? })` — `pattern` is `Record<dayOfWeek 0..6, WeekdayPattern[]>` where each slot is `{ templateId, employeeId }`. Walks the date range, emits assignments per slot for matching day-of-week, dedupes (date + template + employee) when `skipExisting`. Returns `{ created, skipped, invalid }`.
- `markCompleted(assignmentId, shiftSessionId)` — flips `status` → `completed` and links to the real session.

### `/shifts/schedule` — monthly calendar

- 6-row × 7-column grid, week starts Senin (Indonesian convention).
- Each cell shows up to 3 assignment chips (employee initials + template name), color-coded by template (5-color palette cycling by template index). Overflow shows `+N`.
- Click empty cell → `AssignmentModal` (add single).
- Click chip → `AssignmentModal` (edit/delete).
- Month nav (chevrons + "Hari ini" button), legend showing template colors, total assignments count for the visible month.
- Generate Massal CTA opens `BulkGenerateModal`.

### `BulkGenerateModal`

- Date range with quick buttons: **+1 minggu / +1 bulan / +1 tahun** (jump endDate relative to startDate).
- Per-day-of-week section (Senin → Minggu order). Each day has 0+ slots; admin clicks "Tambah slot" to append `(template Select + employee Select)` rows.
- "Tiru ke semua hari" button on a day's header — copies that day's slot list to every other day. Useful for uniform schedules ("kasir yang sama setiap hari").
- "Lewati jadwal yang sudah ada" checkbox (default on) — bulkGenerate dedupes via `skipExisting`.
- Submit toasts e.g., "12 jadwal dibuat · 3 dilewati (sudah ada)".

### `AssignmentModal`

- Template Select + Employee Select + notes Textarea.
- Delete button visible when editing.
- When the assignment was already `completed` (linked to a real shift), an info Alert warns that changes here don't affect the running shift.

### POS prefill from today's schedule

`OpenShiftModal` consults `shiftSchedule.forDate(today)` when it opens. If any `planned` assignment is found, it prefills `employeeId` and `templateId` from the first one and shows an info Alert "Sesuai jadwal hari ini". Cashier still types the PIN to verify. On successful `shifts.open()`, the prefilled assignment is auto-marked `completed` via `markCompleted`. Cashier can override the prefill freely (handles last-minute swaps).

### `/shifts` schedule preview banner

When there's no active shift but today has planned assignments, a sky-blue banner lists today's planned shifts (template · employee) at the top of `/shifts`, with a "Lihat kalender" button. Decays to nothing once a shift opens (the green active-shift banner takes precedence).

### Decisions

**Day-of-week pattern (not interval).** Bulk-generate keys the pattern by Sen/Sel/Rab/… instead of "every N days" or rrule-style recurrence. Most warmindo schedules cycle weekly with different staffing on weekends — `Record<0..6, slots[]>` covers this with zero ceremony.

**Schedule prefills, doesn't lock.** OpenShiftModal prefills but allows override. Hard-locking to scheduled employees would block legitimate last-minute swaps; soft prefill captures the 90% common case while staying flexible.

**Calendar starts Senin.** Indonesian week convention. Day headers ordered `[1, 2, 3, 4, 5, 6, 0]` to map Senin → Minggu.

---

That's the master product. If you're picking this up cold, read this doc, then open `src/lib/stores/products.svelte.ts` and `src/lib/components/products/ProductForm.svelte` — those two files plus this doc are 90% of the surface area.

---

# Part II — Business plan, decisions, and rationale

> Everything below is the **why**. The sections above are the **what** (data shapes, helpers, code paths). When the two disagree, the sections below are the intent; sections above are the implementation.
>
> **Last reviewed:** 2026-05-15

## Vision & positioning

A point-of-sale + inventory admin tool for **small-to-medium Indonesian retail**. Target persona: warmindo / warung / café owner who manages a single store and wants to grow into multi-zone storage, consignment supply, audit-grade accountability, and credit-customer (bon/piutang) sales without buying enterprise software.

**Promise:** start as simple as a paper notebook ("ketik produk, cetak harga, terima uang"), but every feature the owner needs as they grow — multi-location stock, cycle count for theft detection, piutang ledger for regular customers, consignment tracking, stock forecasting — is one toggle away and uses the data they're already entering.

**Positioning:**
- **Not** ERP-class (no general ledger, no chart of accounts, no double-entry). Focused on operational reality of a small store.
- **Not** SaaS-templated. Indonesian-language UI, IDR-only pricing, tax rules (PPN 11% / exempt) baked in.
- **Not** "POS for restaurants only" nor "POS for retail only" — supports both: composite recipes (mie ayam = noodle + chicken + sauce) AND retail packaging (1 pcs / 1 box of 24).

## Target user

**Primary persona: Pak/Bu Warmindo Owner**
- Single physical store (warmindo, warung, kelontong, café, small toko).
- Sells goods (drinks, snacks, packaged food) AND prepared items (recipes from ingredients).
- 50–500 SKUs.
- 1–4 staff: owner + cashier(s); maybe a kitchen worker.
- Phone or shared desktop/tablet; rarely both.
- 2–10 suppliers; some consign mugs/merch.
- 0–30 "langganan tetap" who might "bon dulu, bayar minggu depan."
- Currently tracks stock in a notebook or spreadsheet; loses 5–15% to shrinkage they can't trace.

**Secondary persona: Kasir**
- Fast pick (variant + packaging shortcut buttons), fast scan (USB scanner), clear blockers when transaction is rejected.
- Doesn't manage inventory directly; might do moves and opname.

**Anti-persona:** multi-branch chain (out of scope), restaurant with full table-service / reservations / kitchen tickets, B2B distributor primarily on net-90 invoices.

## Constraints & defaults

| Aspect | Choice | Why |
|---|---|---|
| Currency | IDR only | Domestic Indonesian retail. `formatRupiah` uses `id-ID`, 0 fraction digits. |
| Language | Bahasa Indonesia | UI labels, errors, badges, notes. English in code/comments. |
| Tax | PPN 11% default, `tax_exempt` available | Per UU HPP. Fallback: product → category → default. Bahan Segar defaults exempt. |
| Date locale | `id-ID` | Display via `Intl.DateTimeFormat`. ISO 8601 for storage. |
| Time zone | Local (browser) | No multi-TZ handling. |
| Scale | Single store, multi-zone | One physical location with internal zones (Etalase, Rak, Gudang). |
| Persistence | In-memory only | `$state` singletons; refresh wipes runtime data. Backend deferred. |
| Auth | Hardcoded user | `user.current.name` for performer attribution. Blocked on backend. |
| Decimal qty | Allowed via packaging factor | Base units always integer (pcs, g, mL). Fractional packaging input rounds on store. |
| Negative stock | Not allowed | Atur stok / opname enforce min 0. Sales blocked when `stockOf <= 0`. |

## Architecture philosophy

### Opt-in features for small stores
Every non-trivial workflow (multi-zone storage, audit trail, opname) is **gated behind a toggle in /settings**, designed off-by-default for production (currently `true` for dev convenience). A warmindo with 20 SKUs and one cashier should not see "Pindahkan stok" / "Riwayat Stok" / "Opname Stok" until they enable them.

When a toggle is **off**: data layer keeps working (every batch carries `locationId: 'loc_gudang'`; `stockMovements.log` no-ops). UI surface vanishes (sidebar entries hide, row actions hide, page-level empty states explain enabling). Toggling on later = zero migration.

### Audit-first when enabled
When audit toggle is on, **every** batch mutation writes a `StockMovement` row — no exceptions. Sales (per-allocation), receives, manual adjustments, moves, opname reconciliations, consignment returns. The ledger is the single source of truth for "what happened, to what, when, where, by whom, with what reason."

### Frontend-first scaffold
`$state`-backed singletons are the "stores," seeded with realistic data. Lets the user iterate on UX without committing to a backend stack. Forces clean separation between UI and "API" (store method calls). Backend migration becomes mostly mechanical (store methods → API endpoints; `$state` arrays → SQL queries).

### Single source of truth for stock
Stock lives **only** on `Batch.qtyRemaining`. No scalar `Product.stock` / `Variant.stock`. Every derived value (`stockOf`, `stockBreakdown`, `stockByLocation`, `producibleStock`, `producibleVariantStock`, `totalStock`) computed at read. Eliminates "displayed stock ≠ actual stock" bug class. Cost is similarly derived (`currentCost` = weighted average of owned batches).

### Reverse-only audit operations
Non-destructive where possible:
- `moveStock` full-remainder transfer mutates `locationId` in place but logs `move-relocate` for traceability.
- Partial transfers create sibling batches preserving `unitCost`, `expiresAt`, `receivedAt`, supplier, source PO.
- Cancelled orders don't delete `batchAllocations`; they replay them in reverse to restock.
- Manual `adjust-out` decrements existing batches LIFO (newest first) to preserve FIFO order for future sales.

## Feature inventory

Grouped by domain. Each lists its surfaces and key behaviors.

### Product catalog
**Surfaces:** `/products`, `/products/new`, `/products/[id]/edit`, master-data CRUD for category/unit/pricelist/tax/supplier.

- **Two product kinds:** `goods` (bought finished) and `composite` (made from other products — bundles, BOM recipes).
- **Variants** (Red/M, Black/L) with own SKU, cost, prices, barcode, image, FIFO stock queue.
- **Packagings** (1 pcs / 6-pack / 24-box) with own pricing entries + barcode.
- **Attributes** (Color, Size) drive variant generator; `regenerateVariants` preserves manual edits.
- **Extras / modifiers** (extra shot, almond milk) — optional add-ons with price delta + optional component deductions.
- **Tax fallback chain:** product → category → default.
- **Default supplier** soft reference; used for autofill at PO creation + forecast reorder math.

### Inventory: batches + locations
**Surfaces:** `/inventory`, `/inventory/[id]/history`, `/locations`, `/inventory/move/scan`, `/inventory/move/bulk`, `/inventory/batches/[id]/label`, `/inventory/po/[poId]/labels`.

- **Batches** are SoT: `{ id, code (BATCH-YYYY-NNN), productId, variantId?, ownership, supplierId?, unitCost, qtyReceived, qtyRemaining, receivedAt, expiresAt?, locationId, notes }`.
- **FIFO depletion** sorts by `expiresAt` ASC then `receivedAt` ASC.
- **Locations** (opt-in): Etalase / Rak Belakang / Gudang, each with `customerVisible` + `kind`. One flagged `isDefaultReceipt`.
- **Three move flows** ([decision](#three-move-flows-not-one)): per-row modal, scan basket, bulk picker.
- **Stock adjustments** — Atur stok modal with required reason enum + optional photo (FileReader → data URL).
- **Expiry tracking** — `requiresExpiration` products require date at receive/adjust. Per-product expiry-soon warning on inventory.
- **Per-product history** — `/inventory/[id]/history` with timeline + stats (Diterima, Terjual, Penyesuaian, Pemindahan, Shrinkage value).

### Audit trail & opname
**Surfaces:** `/stock-movements`, `/stock-opname`, `/stock-opname/new`, `/stock-opname/[id]`.

- **StockMovement ledger** — every mutation logs `{ kind, qtyDelta, qtyAfter, unitCost, reference, performedBy, at, reason?, imageUrl?, notes }`. Nine kinds: `receive`, `sale`, `sale-cancel`, `adjust-in`, `adjust-out`, `move-out`, `move-in`, `move-relocate`, `return-consignor`.
- **Opname workflow** — admin picks location + category + product subset → system snapshots `expectedQty` per (product, variant) → admin enters `countedQty` → system reconciles non-zero variance via `batches.adjustStock` with opname reference.
- **Multi-packaging count input** — per-row unit selector on opname count screen. Admin counts "3 trays" → system records `30 pcs` + shows "= 30 pcs" hint.
- **Selidiki investigation** — per-row button → side panel with `MovementTimeline` (last 30 days for that product/variant at that location). For tracing missing units.
- **Reusable `<MovementTimeline>`** component shared by Selidiki + per-product history page.

### POS terminal (Kasir)
**Surface:** `/pos`.

- **Multi-tab cart sessions** — tab strip with customer name + line count + close.
- **Product grid** — click adds 1 base unit.
- **Quick-pick buttons:**
  - Packagings: button strip (`+ pcs`, `+ Box ·24`). One tap = new cart line at that unit.
  - Variants: button strip (`+ White`, `+ Black`). One tap = new cart line for that variant. Variants win when both present (packaging switched on cart line).
- **+ Tambah** customer button next to Pelanggan label → inline add-customer modal, auto-selects new customer.
- **Pricelist resolution** — customer's `pricelistId` drives `priceForQty`. Pricelist name shown.
- **Scan/search** — Enter resolves to product SKU / variant SKU / batch code.
- **Tax-inclusive line totals.**
- **Payment methods:** Tunai, QRIS, Kartu, Transfer.
- **Cash partial payment** ([decision](#piutang-requires-per-customer-permission)):
  - Walk-in → blocked.
  - Customer without `creditAllowed` → blocked.
  - Customer with `creditAllowed` → order saved as `'credit'`, `paidAmount = paymentAmount`, sisa = piutang.

### Procurement: Purchase Orders
**Surfaces:** `/purchase-orders`, `/purchase-orders/new`, `/purchase-orders/[id]`, `/purchase-orders/[id]/edit`.

- **PO types:** `standard` (utang per PO total) and `consignment` (utang per-sale via `/payouts`).
- **Statuses:** `draft` → `sent` → `partial`/`received` → `cancelled`. Transitions explicit.
- **Goods receipt** creates one `Batch` per line, snapshotting unit cost / supplier / source PO line. Supports partial fulfillment. Auto-flips status.
- **Per-line expiry** — `requiresExpiration` products require `expiresAt` at receive.
- **Label printing** — single-batch + per-PO bulk for thermal-printer output.

### Finance: Utang, Piutang, Konsinyasi
**`/utang` — Accounts Payable to suppliers (standard POs):**
- Lists every `standard` PO with `paidAmount < poTotal`.
- Stat cards: committed / paid / outstanding. Filter by supplier / status / date.
- **Catat pembayaran** modal → `purchaseOrders.recordPayment` with amount + method.
- Detail modal: full payment timeline.

**`/piutang` — Accounts Receivable from customers:**
- Lists orders with `status: 'credit'` OR `status: 'paid'` with multi-payment lifecycle.
- Per-customer rekap card (sorted by outstanding desc; click to filter table).
- Stat cards: dijual / received / outstanding.
- **Catat penerimaan** modal → `orders.recordPayment`. Flips to `paid` when fully covered.
- Detail modal: full payment timeline per order.

**`/payouts` — Consignment-specific payable:**
- Reads `consignmentOwedBySupplier` (walks paid orders' `batchAllocations` where `ownership === 'consignment'`).
- Outstanding = total per supplier − sum of payouts.
- Return-to-consignor flow (`batches.returnToConsignor`) decrements without payable impact.

### Forecasting
**Surface:** `/forecast`.

- **Simple moving-average daily rate** over a window (7/14/30/60/90 days).
- **Bands:** 🔴 Kritis (≤3d), 🟠 Menipis (≤7d), 🟡 Perhatikan (≤14d), 🟢 Aman (>14d), ⚪ Tidak ada penjualan.
- **Suggested reorder qty** = `ceil(rate × (supplier.leadTimeDays + bufferDays))`. Buffer tunable inline.
- **Filter** by category / location / urgency / hide-no-sales. Composite products forecast via `producibleStock` ÷ composite-line velocity.
- **Inventory row badge** mirrors runway (only when band is critical/low/watch).

### Master data
`/employees`, `/suppliers`, `/categories`, `/units`, `/pricelists`, `/taxes`, `/locations` (opt-in), `/products`, `/customers`. List page with search/filter + modal CRUD (products and POs use dedicated `/new` and `/[id]/edit` pages when forms get tall).

## Key design decisions

### Consignment as PO type, not product flag
**Decision:** Product is "on consignment" iff at least one non-cancelled consignment-type PO references it.
**Why:** Reality. Same SKU can be retailed (owned) AND consigned (titipan) from different suppliers. A product-level flag forces an artificial decision.
**Alternative considered:** `Product.isConsigned: boolean`. Rejected as too coarse.

### Batches as single source of truth (no scalar stock)
**Decision:** Stock lives on `Batch.qtyRemaining`. No scalar `Product.stock` / `Variant.stock`.
**Why:** Removes "displayed ≠ actual" bug class. FIFO depletion, cost-per-batch, consignment flag fall out naturally.
**Alternative:** Scalar updated on every sale/receive. Rejected for sync bugs.

### Locations as opt-in feature
**Decision:** `Location` resource + `Batch.locationId` always present in data layer; UI gated by `settings.inventory.locationsEnabled`.
**Why:** Small stores keep everything in one place. Multi-zone adds real cognitive overhead.
**Alternative:** Always show locations. Rejected for friction.

### Three move flows (not one)
**Decision:** Per-row modal (review and decide) + scan basket (phone in warehouse) + bulk picker (weekly refill).
**Why:** Different physical contexts call for different inputs. Unifying makes all three worse.
**Alternative:** One unified UI. Rejected.

### Required reason + photo on manual adjustments
**Decision:** Atur stok requires typed reason (`damaged`/`expired`/`lost`/`sample`/`found`/`initial-seed`/`correction`/`other`). Optional photo upload via FileReader → data URL.
**Why:** Audit value. Without reason, "manual adjust" rows are unqueryable. Photo proof matters for insurance / disputes / supplier returns.
**Alternative:** Free-text notes only. Rejected as not queryable.

### Atur stok and opname coexist
**Decision:** Keep both. Atur surgical ("known cause, known qty"); Opname procedural ("count and discover").
**Why:** Forcing single broken egg through multi-step opname is friction staff will skip by faking numbers. Atur is 3 clicks; Opname for one item is ~7.
**Alternative:** Remove Atur, route everything through Opname. Rejected.

### Quick-pick buttons on POS cards
**Decision:** Variant or packaging button strip on product cards. Main click still adds first variant + base unit.
**Why:** Tap-twice (open dropdown, change unit) is slow during a queue.
**Alternative:** Dropdown-only. Rejected for queue speed.

### Separate /utang and /piutang pages
**Decision:** Dedicated pages, not extension of `/payouts`.
**Why:** They model different things. Utang = standard PO payables. Piutang = customer receivables. Payouts = consignment-specific (consignor owns the goods).
**Alternative:** Extend `/payouts`. Rejected.

### Piutang requires per-customer permission
**Decision:** `Customer.creditAllowed: boolean` (default `false`). Walk-in cannot do piutang. POS rejects partial cash for customers without the flag.
**Why:** Without explicit permission, every walk-in could rack up uncollectable debt.
**Alternative:** Allow for any selected customer. Rejected as too leaky.

### Simple moving average for forecast
**Decision:** Daily rate = `sum(qty over window) / windowDays`. No seasonality, trend, or exponential smoothing.
**Why:** Accurate enough at warmindo scale. Day-of-week / seasonality fix specific issues but add complexity not yet justified. Forecast page labels itself "panduan, bukan kebenaran absolut."
**Alternative:** Exponential smoothing / weekday weights / ML. Deferred until simple-average is failing.

### Opt-in toggle defaults
**Decision:** `locationsEnabled` and `auditTrailEnabled` currently default `true` for dev convenience.
**Why for production:** Should flip to `false` before first real deploy so small stores see simple flow first. Release-prep checklist item.

## Opt-in toggles (in `/settings`)

### `inventory.locationsEnabled`
- **On:** "Lokasi" sidebar entry; `/inventory` gains location filter + breakdown chips + Pindahkan action + Scan/Bulk move pages; `/products` location breakdown; `/pos` location chips ("Etalase · 5 / Gudang · 90" or "Ambil dari: Gudang · 80"); Atur stok modal location Select.
- **Off:** All location UI hidden. Stock still tracked per batch with `locationId: 'loc_gudang'`. Toggle on later = instant unlock.

### `inventory.auditTrailEnabled`
- **On:** "Opname Stok" + "Riwayat Stok" sidebar; every batch mutation logs `StockMovement`; Atur stok requires reason; opname workflow available; investigation panels and per-product history populated.
- **Off:** No log writes. Pages accessible direct via URL but show "Aktifkan di Pengaturan" empty state.

### `operations.shiftsEnabled`
- **On:** "Operasional → Shift Kasir" sidebar entry; `/pos` shows shift banner (active or "Buka shift" CTA); new orders auto-stamp `shiftId` + `employeeId`; shift templates editor visible in `/settings`.
- **Off:** No shift UI in POS; sidebar group hidden. Existing shift data preserved.

**Future toggles to add:**
- `inventory.compositeEnabled` — hide BOM / recipe products for stores that only resell.
- `sales.piutangEnabled` — hide customer credit flow for cash-only stores.
- `sales.taxEnabled` — for non-PKP stores that don't charge PPN.
- `operations.multiCashier` — allow parallel open shifts on different registers (future).

## Data model decisions (for backend planning)

### Variants in separate table
When backend lands: `products` and `product_variants` as separate tables with FK. Every `variantId` slot in current code becomes a real FK.

### Polymorphic pricelist entries
Pricing exists at three scopes today: product, variant, packaging. Backend: one `pricelist_entries` table with polymorphic scope (`scope_kind`, `scope_id`) + `pricelist_id` + JSONB `pricing` + JSONB `tiers`.

### Polymorphic composite components
`product.components`, `variant.components`, `extra.components` are the same shape. Backend: single `composite_components` table with polymorphic parent.

### Global SKU uniqueness
SKU unique across `products.sku` and `product_variants.sku` so POS scan resolver matches without ambiguity. Partial unique index OR app-level overlap check.

### JSONB for attributes config
`Product.attributes` and `variant.values` as JSONB columns. Less normalized but always whole-blob read/write.

### BatchAllocation snapshot for audit
Every order line carries `batchAllocations` snapshotted at sale time. Survives batch mutations / deletions / supplier renames. Keeps consignor payout correct, cancellation restock accurate, per-product history reconstructible.

### Audit log append-only
`stockMovements.items` is conceptually immutable. Store doesn't expose update/remove. Backend: append-only table with tamper-evident hash-chain for real audit (out of scope for scaffold).

### Performer via name string
`StockMovement.performedBy` is a string snapshot. Becomes `employeeId` FK when auth lands.

## Roadmap & deferred

### Near-term (2–4 weeks)
| Item | Why now | Effort |
|---|---|---|
| localStorage persistence | Refresh wipes everything; biggest dev-UX gap. | S |
| Receipt printing | POS sale loop incomplete. | S–M |
| Line-level refunds | Currently only whole-order cancel. | M |
| Per-customer outstanding view on `/customers/[id]` | Customer-side piutang history. | S |
| Forecast → "Buat PO" action | One-click prefill PO from forecast row. | M |

### Mid-term (1–3 months)
| Item | Why | Effort |
|---|---|---|
| Backend integration | Production persistence. Supabase (Postgres + Auth + Storage) target. | XL |
| Auth + per-employee permissions | Real performer tracking; role-based access. | L |
| Reports / Laporan | Sales summary, top products, shrinkage trend, expiring batches. | M |
| Image upload backend | Replace data-URLs with object storage. | M |
| Mobile-optimized POS | Thumb-friendly `/pos` and scan flow. | M |
| CSV import for products | Bulk SKU load via SheetJS. | M |
| Order discounts | Line + order level. | M |

### Long-term (3–12 months)
| Item | Why | Effort |
|---|---|---|
| Multi-branch / multi-store | `Store` axis above `Location`. | XL |
| Accounting integration | GL entries from sales/PO/payout. | XL |
| Per-location reorder points | "Etalase low for X, auto-suggest transfer." | M |
| Transfer audit log | Dedicated Transfer entity. | M |
| Tamper-evident ledger | Hash-chain on movement rows. | M |
| Customer pricing auto-apply at checkout | Currently half-built. | S |
| Loyalty / points | Per-customer balance + redemption. | L |
| Day-of-week weighted forecast | Weekend spikes matter. | M |

### Explicitly out of scope (won't build)
- Restaurant table service / reservations / kitchen tickets — different domain.
- Multi-currency — IDR only.
- Multi-tenant SaaS — single-tenant deployment per store.
- Built-in payment processing — cashier records method; reconciliation external.
- Built-in printer driver — browser print + ESC/POS via separate tooling.

## Additional Bahasa Indonesia terms

(Supplements the technical glossary above with business-flavored terms.)

| Term | English | Meaning here |
|---|---|---|
| Warmindo | "warung makan Indonesia mie" | Small Indonesian eatery serving instant noodles + light meals. Primary persona. |
| Warung | small shop / kiosk | Generic small Indonesian retail. |
| Etalase | display case / shelf | Customer-facing storage zone. Default `customerVisible: true`. |
| Gudang | warehouse / storeroom | Bulk storage, not customer-facing. Default location for PO receipts. |
| Rak (Belakang) | back rack | Behind-counter storage, cashier-accessible. |
| Pindahkan / Pindah | move | Stock transfer between locations. |
| Opname / Stok opname | cycle count | Physical audit reconciling system vs reality. |
| Selidiki | investigate | Opname row action → movement history side panel. |
| Shrinkage | shrinkage | Negative variance from opname (theft / breakage / miscount). |
| Bon / Piutang | tab / receivable | Customer credit; requires `creditAllowed`. |
| Utang | payable | Money owed to suppliers from standard POs. |
| Konsinyasi / Titipan | consignment | Vendor-supplied inventory; we owe per-unit on sale. |
| PPN | VAT | Pajak Pertambahan Nilai, default 11% per UU HPP. |
| Net-30 / Net-14 | net-30 / net-14 | Pay within N days of invoice. |
| Kasir | cashier | POS terminal user; also `/pos` route title. |
| Pelanggan walk-in | walk-in | Customer not in system. Cannot do piutang. |
| Atur stok | adjust stock | Surgical manual change (write-off / found / sample). |
| DP / Down payment | DP | Initial partial payment on a credit order. |
| Kedaluwarsa | expired | Past expiry date. |
| Penyesuaian | adjustment | Manual stock change (`adjust-in` / `adjust-out` movements). |
| Penerimaan | receipt / receiving | Goods receipt at PO time OR customer payment receipt for piutang. |
| Lokasi default penerimaan | default receipt location | Where new PO receipts land (typically Gudang). |
| Catat pembayaran / penerimaan | record payment / receipt | Logging supplier payment (utang) / customer payment (piutang). |
| Berjenjang | tiered | Pricing with quantity thresholds. |
| Komposit | composite | Product built from components. |
| Varian | variant | Sellable variation (color/size). |

## Open questions

Things to decide later. None block current development.

1. **When to flip toggle defaults to `false`?** Both `locationsEnabled` and `auditTrailEnabled` default `true` today. Should flip before first real deploy so small stores see the simple flow.
2. **Receipt printing approach.** Browser print to PDF? ESC/POS over WebUSB? Local print service? Each has tradeoffs for warmindo hardware reality (cheap thermal printers shared via USB).
3. **Auth approach.** Email/password? PIN-per-employee (faster shift change)? Magic link? PIN seems right for the persona.
4. **Multi-currency support — never?** Designed IDR-only; revisit only if expanding into tourist-area markets.
5. **Where does Laporan land?** User pivoted away from reports toward utang/piutang. May stay deferred indefinitely.
6. **Refund vs cancellation.** Currently only whole-order cancel restocks. Line-level partial refund deferred (proportional batch restock + payment record).
7. **Composite product forecast.** Today uses `producibleStock` ÷ composite-velocity. Doesn't reflect "8 sold direct, 2 via combo" subtleties. Component-level forecast already counts both implicitly — confirm with real usage.
8. **Image storage when backend lands.** Today: data-URLs embedded. Backend: object storage with URL. Migration path TBD.
9. **Lead-time variability.** Currently `Supplier.leadTimeDays` is a single number. Per-product override (`Product.defaultSupplierLeadTimeDays`) more accurate but deferred.
10. **Opname for composite products.** Today excluded (no batches). Real warmindo counts components implicitly. Admin can opname components individually for now.

---

*This Part II is a living document. Update when load-bearing decisions change, when toggles are added, when defaults flip, or when persona shifts. Keep it in sync with the technical sections above at major checkpoints.*
