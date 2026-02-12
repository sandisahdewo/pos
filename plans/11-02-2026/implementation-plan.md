# POS Feature Expansion: Categories, Units, Variants, Products, Purchase Orders

## Context

The POS system currently has core infrastructure (tenants, users, stores, roles, permissions, invitations). We need to add the full product management and procurement pipeline: master data entities (categories, units, variants, warehouses, suppliers), products with complex variant/pricing models, and purchase orders with delivery tracking.

**Key design decisions:**
- **Phased rollout**: Phase 1 (master data foundations) → Phase 2 (products) → Phase 3 (purchase orders)
- **Image storage**: S3-compatible (MinIO dev, S3 prod)
- **Categories link to units & variants**: Junction tables control which units/variants are available per category
- **PO workflow**: Draft → Sent → Partial → Delivered → Cancelled
- **Stock model**: Immutable ledger (entries for every change, current stock = SUM)
- **Price tiers**: Per-product default, variant can override
- **Pricing mode**: Per-category default (markup %/amount/fixed), product can override
- **Unit conversions**: Global per tenant

---

## Phase 1: Master Data Foundations

### 1.1 Database Migrations (start at `000014`)

Files in `backend/migrations/`:

**`000014_create_categories.up.sql`** — `categories` table
- `id UUID PK`, `tenant_id UUID FK→tenants`, `name VARCHAR(255) NOT NULL`, `description TEXT`
- `pricing_mode VARCHAR(50)` (nullable, values: `markup_percentage`, `markup_amount`, `fixed_price`)
- `markup_value NUMERIC(12,4)` (nullable, required when pricing_mode is set)
- `is_active BOOLEAN DEFAULT TRUE`, `created_at`, `updated_at`
- UNIQUE `(tenant_id, name)`, INDEX on `tenant_id`
- CHECK constraint: pricing_mode and markup_value must both be set or both null

**`000015_create_units.up.sql`** — `units` table
- `id UUID PK`, `tenant_id UUID FK→tenants`, `name VARCHAR(255) NOT NULL`, `description TEXT`
- `is_active`, `created_at`, `updated_at`
- UNIQUE `(tenant_id, name)`

**`000016_create_variants.up.sql`** — `variants` + `variant_values` tables
- `variants`: `id`, `tenant_id FK→tenants`, `name`, `description`, `is_active`, timestamps. UNIQUE `(tenant_id, name)`
- `variant_values`: `id`, `variant_id FK→variants ON DELETE CASCADE`, `value VARCHAR(255)`, `sort_order INT DEFAULT 0`, `is_active`, timestamps. UNIQUE `(variant_id, value)`

**`000017_create_category_links.up.sql`** — junction tables
- `category_units`: `id`, `category_id FK→categories`, `unit_id FK→units`, `created_at`. UNIQUE `(category_id, unit_id)`
- `category_variants`: `id`, `category_id FK→categories`, `variant_id FK→variants`, `created_at`. UNIQUE `(category_id, variant_id)`

**`000018_create_unit_conversions.up.sql`** — `unit_conversions` table
- `id`, `tenant_id FK→tenants`, `from_unit_id FK→units`, `to_unit_id FK→units`
- `conversion_factor NUMERIC(18,8) NOT NULL` (1 from_unit = factor × to_unit)
- UNIQUE `(tenant_id, from_unit_id, to_unit_id)`, CHECK `from_unit_id != to_unit_id`, CHECK `factor > 0`

**`000019_create_warehouses.up.sql`** — `warehouses` table
- `id`, `tenant_id FK→tenants`, `name`, `address TEXT`, `phone VARCHAR(50)`, `is_active`, timestamps
- UNIQUE `(tenant_id, name)`

**`000020_create_suppliers.up.sql`** — `suppliers` table
- `id`, `tenant_id FK→tenants`, `name`, `contact_name VARCHAR(255)`, `email VARCHAR(255)`, `phone`, `address TEXT`, `is_active`, timestamps
- UNIQUE `(tenant_id, name)`

### 1.2 SQLC Queries

New files in `backend/sqlc/queries/`:

| File | Queries |
|------|---------|
| `categories.sql` | CreateCategory, GetCategoryByID, GetCategoriesByTenant, GetActiveCategoriesByTenant, UpdateCategory, DeactivateCategory, AddCategoryUnit, RemoveCategoryUnit, DeleteCategoryUnits, GetCategoryUnits (JOIN units), AddCategoryVariant, RemoveCategoryVariant, DeleteCategoryVariants, GetCategoryVariants (JOIN variants) |
| `units.sql` | CreateUnit, GetUnitByID, GetUnitsByTenant, GetActiveUnitsByTenant, UpdateUnit, DeactivateUnit |
| `variants.sql` | CreateVariant, GetVariantByID, GetVariantsByTenant, GetActiveVariantsByTenant, UpdateVariant, DeactivateVariant, CreateVariantValue, GetVariantValues, UpdateVariantValue, DeleteVariantValue, DeleteVariantValuesByVariant |
| `unit_conversions.sql` | CreateUnitConversion, GetUnitConversionByID, GetUnitConversionsByTenant (JOIN units for names), UpdateUnitConversion, DeleteUnitConversion, GetConversionFactor |
| `warehouses.sql` | CreateWarehouse, GetWarehouseByID, GetWarehousesByTenant, GetActiveWarehousesByTenant, UpdateWarehouse, DeactivateWarehouse |
| `suppliers.sql` | CreateSupplier, GetSupplierByID, GetSuppliersByTenant, GetActiveSuppliersByTenant, UpdateSupplier, DeactivateSupplier |

All GetByID queries do NOT filter by tenant_id (service layer enforces).

### 1.3 Backend Service Layer

New files in `backend/internal/service/`:

| File | Notes |
|------|-------|
| `category.go` | `CategoryService{pool, queries}` — needs pool for transactions (UpdateUnits/UpdateVariants: delete-all + re-insert in tx). GetByID returns `CategoryDetailResponse` with linked units & variants. |
| `unit.go` | `UnitService{queries}` — simple CRUD, same pattern as `store.go` |
| `variant.go` | `VariantService{pool, queries}` — needs pool for tx (Create variant + initial values). GetByID returns `VariantDetailResponse` with values. Sub-resource methods: AddValue, UpdateValue, DeleteValue. |
| `unit_conversion.go` | `UnitConversionService{queries}` — CRUD. List uses JOIN query for unit names. |
| `warehouse.go` | `WarehouseService{queries}` — simple CRUD, same pattern as `store.go` |
| `supplier.go` | `SupplierService{queries}` — simple CRUD |

Add converter functions to `backend/internal/service/helpers.go`: `toCategory*`, `toUnit*`, `toVariant*`, `toWarehouse*`, `toSupplier*`, `toUnitConversion*`.

### 1.4 Backend Handlers

New files in `backend/internal/handler/`: `category.go`, `unit.go`, `variant.go`, `unit_conversion.go`, `warehouse.go`, `supplier.go`

Each follows the existing pattern in `store.go`: decode JSON → validate → extract tenantID from context → call service → respondJSON/respondError.

**Variant handler** has sub-resource endpoints: `AddValue`, `UpdateValue`, `DeleteValue` (under `/variants/{id}/values/...`).

### 1.5 Model Structs

Add to `backend/internal/model/requests.go` and `responses.go`:

**Request structs**: `Create/UpdateCategoryRequest`, `UpdateCategoryUnitsRequest{UnitIDs}`, `UpdateCategoryVariantsRequest{VariantIDs}`, `Create/UpdateUnitRequest`, `Create/UpdateVariantRequest`, `VariantValueEntry{Value, SortOrder}`, `Create/UpdateVariantValueRequest`, `Create/UpdateUnitConversionRequest{FromUnitID, ToUnitID, ConversionFactor}`, `Create/UpdateWarehouseRequest`, `Create/UpdateSupplierRequest`

**Response structs**: `CategoryResponse`, `CategoryDetailResponse{+Units, +Variants}`, `UnitResponse`, `VariantResponse`, `VariantDetailResponse{+Values}`, `VariantValueResponse`, `UnitConversionResponse{+FromUnitName, +ToUnitName}`, `WarehouseResponse`, `SupplierResponse`

### 1.6 Router Registration

Modify `backend/internal/router/router.go`:

1. Add to `Handlers` struct: `Category`, `Unit`, `Variant`, `UnitConversion`, `Warehouse`, `Supplier`
2. Add route groups inside authenticated group with `RequirePermission` middleware:

```
/categories       — master-data.category (read/create/edit/delete)
  PUT /{id}/units     — edit permission
  PUT /{id}/variants  — edit permission
/units            — master-data.unit
/variants         — master-data.variant
  POST /{id}/values       — edit permission
  PUT /{id}/values/{vid}  — edit permission
  DELETE /{id}/values/{vid} — delete permission
/unit-conversions — master-data.unit (reuse unit permission)
/warehouses       — master-data.warehouse
/suppliers        — master-data.supplier
```

### 1.7 DI Wiring

Modify `backend/cmd/api/main.go`: instantiate 6 new services → 6 new handlers → add to `router.Handlers` struct.

### 1.8 Seed Data

Modify `backend/cmd/seed/main.go` — add features with stable UUIDs:

| Feature | Slug | Actions | UUID suffix |
|---------|------|---------|-------------|
| Category | `master-data.category` | read, create, edit, delete | `...0010` |
| Unit | `master-data.unit` | read, create, edit, delete | `...0011` |
| Variant | `master-data.variant` | read, create, edit, delete | `...0012` |
| Warehouse | `master-data.warehouse` | read, create, edit, delete | `...0013` |
| Supplier | `master-data.supplier` | read, create, edit, delete | `...0014` |
| Purchase Order | `purchase.order` | read, create, edit, delete | `...0015` |
| Purchase Delivery | `purchase.delivery` | read, create, edit | `...0016` |

All under existing parent features (`master-data` or `purchase`).

### 1.9 Frontend Types

Add to `frontend/src/lib/api/types.ts`: TypeScript interfaces for all request/response types listed in 1.5.

### 1.10 Frontend Pages

New pages under `frontend/src/routes/(app)/settings/`:

| Page | Pattern | Notes |
|------|---------|-------|
| `categories/+page.svelte` | CRUD list, SimpleDialog for create/edit | Fields: name, description, pricing_mode (select), markup_value |
| `categories/[id]/+page.svelte` | Detail page | Tabs (plain HTML buttons) for linked Units and Variants checklists + Save |
| `units/+page.svelte` | CRUD list | Simple: name, description |
| `variants/+page.svelte` | CRUD list | "Edit" links to detail page |
| `variants/[id]/+page.svelte` | Detail page | Variant info + inline value management (add/edit/delete values) |
| `unit-conversions/+page.svelte` | CRUD list | from_unit (select), to_unit (select), factor. Shows unit names from joined response |
| `warehouses/+page.svelte` | CRUD list | Same pattern as stores: name, address, phone |
| `suppliers/+page.svelte` | CRUD list | name, contact_name, email, phone, address |

All pages follow the stores page pattern: `createDataLoader`, `$state` for list/loading/error/success, Alert component, SimpleDialog, Card+Table.

### 1.11 Sidebar Updates

Modify `frontend/src/lib/components/Sidebar.svelte`:

1. Add imports for icons: `Boxes, Ruler, Palette, ArrowLeftRight, Warehouse, Truck` from `@lucide/svelte`
2. Add entries to `settingsItems` with `feature`/`action` properties for permission gating
3. Update settings items rendering to use `canSeeItem()` filter (currently missing)

---

## Phase 2: Products

### 2.1 Infrastructure: MinIO

- Add `minio` service to `docker-compose.yml` (minio/minio:latest, ports 9000/9001, `miniodata` volume)
- Add S3 env vars to `.env.example`: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_USE_SSL`
- Add `S3Config` struct to `backend/internal/config/config.go`

### 2.2 Database Migrations

**`000021_create_products.up.sql`** — `products` table + ENUMs
- ENUMs: `sell_method (fifo, lifo)`, `product_status (active, inactive)`
- Columns: `id`, `tenant_id`, `category_id FK→categories`, `name`, `description`, `has_variants BOOLEAN`, `sell_method`, `status`, `tax_rate NUMERIC(5,2)`, `discount_rate NUMERIC(5,2)`, `min_quantity NUMERIC(12,4)`, `max_quantity NUMERIC(12,4)`, `pricing_mode VARCHAR(50)` (nullable = inherit from category), `markup_value NUMERIC(12,4)`, `fixed_price NUMERIC(12,4)`, timestamps
- UNIQUE `(tenant_id, name)`

**`000022_create_product_images.up.sql`** — `product_images` table
- `id`, `product_id FK→products`, `image_url TEXT`, `sort_order`, timestamps

**`000023_create_product_variants.up.sql`** — `product_variants`, `product_variant_values`, `product_variant_images`
- `product_variants`: `id`, `product_id FK`, `sku VARCHAR(100) UNIQUE(product_id, sku)`, `barcode VARCHAR(100)`, `unit_id FK→units`, `retail_price NUMERIC(12,4)`, `is_active`, timestamps
- `product_variant_values`: `id`, `product_variant_id FK`, `variant_value_id FK→variant_values`, UNIQUE `(product_variant_id, variant_value_id)`
- `product_variant_images`: `id`, `product_variant_id FK`, `image_url TEXT`, `sort_order`, timestamps

**`000024_create_price_tiers.up.sql`** — `price_tiers` table
- `id`, `product_id FK` (nullable), `product_variant_id FK` (nullable), `min_quantity INT`, `price NUMERIC(12,4)`, timestamps
- CHECK: exactly one of product_id or product_variant_id is set

**`000025_create_stock_ledger.up.sql`** — `stock_ledger` table
- ENUM: `stock_reason (purchase_delivery, sale, adjustment, transfer_in, transfer_out)`
- Columns: `id`, `tenant_id`, `product_variant_id FK`, `warehouse_id FK`, `quantity NUMERIC(12,4)` (can be negative), `unit_id FK`, `reason`, `reference_type VARCHAR(50)`, `reference_id UUID`, `notes TEXT`, `created_at`
- Immutable: no UPDATE/DELETE queries
- Indexes: `(product_variant_id, warehouse_id)`, `(reference_type, reference_id)`, `created_at`

### 2.3 SQLC Queries

| File | Key queries |
|------|-------------|
| `products.sql` | Full CRUD for products, product_variants, product_variant_values, product_images, product_variant_images, price_tiers. Pagination with tenant filter. Filter by category_id/status. |
| `stock.sql` | CreateStockLedgerEntry, GetCurrentStock (SUM), GetStockByProduct (GROUP BY variant+warehouse with JOIN), GetStockLedgerEntries (paginated history) |

### 2.4 Backend

**New services**: `product.go` (complex — tx for multi-table create/update), `stock.go` (read stock, create ledger entries), `upload.go` (S3/MinIO client for image upload/delete)

**New handlers**: `product.go`, `stock.go`, `upload.go`

**Routes**:
```
/products         — master-data.product (existing permission)
  GET /{id}/stock — read
/uploads/images   — authenticated, POST multipart
```

### 2.5 Frontend Pages

| Page | Description |
|------|-------------|
| `master-data/products/+page.svelte` | Product list with category/status filters. Replace existing placeholder. |
| `master-data/products/create/+page.svelte` | Complex form: basic info + variant toggle. No variants = single SKU/unit/price. With variants = dynamic combination builder. Image upload. Price tiers. |
| `master-data/products/[id]/+page.svelte` | Product detail/edit + variant management |
| `master-data/products/[id]/stock/+page.svelte` | Read-only stock levels per warehouse per variant |

---

## Phase 3: Purchase Orders & Deliveries

### 3.1 Database Migrations

**`000026_create_purchase_orders.up.sql`**
- ENUM: `po_status (draft, sent, partial, delivered, cancelled)`
- `purchase_orders`: `id`, `tenant_id`, `warehouse_id FK`, `supplier_id FK`, `order_number VARCHAR(50) UNIQUE(tenant_id, order_number)`, `status`, `notes`, `ordered_at`, timestamps
- `purchase_order_items`: `id`, `purchase_order_id FK`, `product_variant_id FK`, `quantity NUMERIC(12,4)`, `unit_id FK`, `unit_price NUMERIC(12,4)`, timestamps
- `purchase_order_sequences`: `tenant_id PK FK→tenants`, `last_number INT DEFAULT 0` (for auto-generating PO numbers)

**`000027_create_purchase_deliveries.up.sql`**
- `purchase_deliveries`: `id`, `purchase_order_id FK`, `delivery_number VARCHAR(50)`, `received_at`, `notes`, timestamps
- `purchase_delivery_items`: `id`, `purchase_delivery_id FK`, `purchase_order_item_id FK`, `delivered_quantity`, `delivered_unit_id FK`, `delivered_unit_price`, `is_accepted BOOLEAN`, `notes`, timestamps

### 3.2 SQLC Queries

| File | Key queries |
|------|-------------|
| `purchase_orders.sql` | GetNextPONumber (upsert sequence), CRUD for POs + items, status transitions, pagination with optional status filter |
| `purchase_deliveries.sql` | Create delivery + items, list by order, GetDeliveredQuantityByOrderItem (SUM for partial delivery tracking) |

### 3.3 Backend

**New services**:
- `purchase_order.go` — CRUD, status transitions (Send: draft→sent, Cancel: draft/sent→cancelled). Only editable in draft.
- `purchase_delivery.go` — Create delivery with tx: verify PO status (sent/partial), create delivery + items, create stock_ledger entries for accepted items, update PO status (partial/delivered based on remaining qty)

**New handlers**: `purchase_order.go`, `purchase_delivery.go`

**Routes**:
```
/purchase-orders              — purchase.order
  POST /{id}/send             — edit permission
  POST /{id}/cancel           — edit permission
  /purchase-orders/{id}/deliveries — purchase.delivery (nested)
```

### 3.4 Frontend Pages

| Page | Description |
|------|-------------|
| `purchase/orders/+page.svelte` | PO list with status filter tabs. Replace existing `purchase/products` placeholder. |
| `purchase/orders/create/+page.svelte` | Form: select warehouse, supplier, add line items (search product variant, qty, unit, price). Save as draft. |
| `purchase/orders/[id]/+page.svelte` | PO detail: header, items table, deliveries list. Actions: Send, Cancel, Create Delivery. |
| `purchase/orders/[id]/delivery/+page.svelte` | Delivery form: shows PO items with ordered vs remaining qty, input delivered qty/price per item, accept/reject toggle. |

Update Sidebar: Purchase nav item points to `/purchase/orders` with `purchase.order` permission.

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `backend/internal/router/router.go` | Add to Handlers struct, register all new routes with RBAC middleware |
| `backend/cmd/api/main.go` | Instantiate all new services + handlers, wire into Handlers struct |
| `backend/cmd/seed/main.go` | Add 7 new feature entries with stable UUIDs |
| `backend/internal/model/requests.go` | Add all request structs |
| `backend/internal/model/responses.go` | Add all response structs |
| `backend/internal/service/helpers.go` | Add converter functions for all new entities |
| `frontend/src/lib/api/types.ts` | Add all TypeScript interfaces |
| `frontend/src/lib/components/Sidebar.svelte` | Add new nav items + permission gating for settings section |
| `docker-compose.yml` | Add MinIO service (Phase 2) |
| `backend/internal/config/config.go` | Add S3Config (Phase 2) |
| `.env.example` | Add S3 env vars (Phase 2) |

## Verification

After each phase:
1. `make migrate-up` — verify migrations apply cleanly
2. `make sqlc` — verify generated code compiles
3. `make seed` — verify new features appear
4. `make test-backend` — all existing tests pass
5. Manual API testing via curl/Postman for each new endpoint
6. `make build` — verify Docker builds succeed
7. Frontend manual testing: navigate to each new page, create/edit/delete entities
8. Verify RBAC: remove permissions from a role, confirm UI hides items and API returns 403
