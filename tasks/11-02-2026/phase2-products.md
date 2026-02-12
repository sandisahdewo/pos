# Phase 2: Products

> **Depends on**: Phase 1 fully complete (categories, units, variants, warehouses exist)
> **Blocks**: Phase 3

---

## Stage 1: Infrastructure (SEQUENTIAL)

### 1.1 Add MinIO service to Docker
- **Assignee**: Backend
- **Parallel**: NO (must complete before 1.2)
- **Files to modify**:
  - `docker-compose.yml` — add minio service:
    - Image: minio/minio:latest
    - Command: `server /data --console-address ":9001"`
    - Ports: 9000 (API), 9001 (Console)
    - Volume: miniodata:/data
    - Healthcheck: `mc ready local`
    - Add minio to backend depends_on
    - Add `miniodata:` to volumes section
  - `.env.example` — add S3 vars:
    - S3_ENDPOINT=minio:9000
    - S3_ACCESS_KEY=minioadmin
    - S3_SECRET_KEY=minioadmin
    - S3_BUCKET=pos-uploads
    - S3_REGION=us-east-1
    - S3_USE_SSL=false
  - `.env` — copy same values for local dev
- **Verify**: `docker compose up minio` starts, console accessible at localhost:9001

### 1.2 Add S3 config to backend
- **Assignee**: Backend
- **Parallel**: NO (depends on 1.1)
- **File to modify**: `backend/internal/config/config.go`
- **Add**:
  - S3Config struct: Endpoint, AccessKey, SecretKey, Bucket, Region, UseSSL
  - Load from env vars in Load() function
  - Add S3 field to Config struct
- **Verify**: Backend starts and reads S3 config without errors

---

## Stage 2: Database & Code Generation (SEQUENTIAL)

### 2.1 Create product migration files
- **Assignee**: Backend
- **Parallel**: NO (must complete before 2.2)
- **Files to create**:
  - `backend/migrations/000021_create_products.up.sql` + `.down.sql`
    - ENUMs: sell_method (fifo, lifo), product_status (active, inactive)
    - products table: id, tenant_id FK, category_id FK→categories, name, description, has_variants BOOLEAN, sell_method, status, tax_rate NUMERIC(5,2), discount_rate NUMERIC(5,2), min_quantity NUMERIC(12,4), max_quantity NUMERIC(12,4), pricing_mode VARCHAR(50) nullable, markup_value NUMERIC(12,4), fixed_price NUMERIC(12,4), timestamps
    - UNIQUE (tenant_id, name)
  - `backend/migrations/000022_create_product_images.up.sql` + `.down.sql`
    - product_images: id, product_id FK CASCADE, image_url TEXT, sort_order INT, timestamps
  - `backend/migrations/000023_create_product_variants.up.sql` + `.down.sql`
    - product_variants: id, product_id FK CASCADE, sku VARCHAR(100), barcode VARCHAR(100), unit_id FK→units, retail_price NUMERIC(12,4), is_active, timestamps. UNIQUE (product_id, sku)
    - product_variant_values: id, product_variant_id FK CASCADE, variant_value_id FK→variant_values. UNIQUE (product_variant_id, variant_value_id)
    - product_variant_images: id, product_variant_id FK CASCADE, image_url TEXT, sort_order, timestamps
  - `backend/migrations/000024_create_price_tiers.up.sql` + `.down.sql`
    - price_tiers: id, product_id FK nullable, product_variant_id FK nullable, min_quantity INT, price NUMERIC(12,4), timestamps
    - CHECK: exactly one of product_id or product_variant_id is set
  - `backend/migrations/000025_create_stock_ledger.up.sql` + `.down.sql`
    - ENUM: stock_reason (purchase_delivery, sale, adjustment, transfer_in, transfer_out)
    - stock_ledger: id, tenant_id FK, product_variant_id FK, warehouse_id FK, quantity NUMERIC(12,4) (can be negative), unit_id FK, reason, reference_type VARCHAR(50), reference_id UUID, notes TEXT, created_at
    - IMMUTABLE: no update/delete queries
    - Indexes: (product_variant_id, warehouse_id), (reference_type, reference_id), created_at
- **Run**: `make migrate-up`
- **Verify**: All migrations apply cleanly

### 2.2 Create SQLC query files + generate code
- **Assignee**: Backend
- **Parallel**: NO (depends on 2.1)
- **Files to create**:
  - `backend/sqlc/queries/products.sql` — full CRUD:
    - CreateProduct, GetProductByID, GetProductsByTenant (paginated), CountProductsByTenant
    - GetProductsByTenantAndCategory (paginated), CountProductsByTenantAndCategory
    - UpdateProduct, DeactivateProduct
    - CreateProductVariant, GetProductVariants, UpdateProductVariant
    - CreateProductVariantValue, GetProductVariantValues, DeleteProductVariantValues
    - CreateProductImage, GetProductImages, DeleteProductImage
    - CreateProductVariantImage, GetProductVariantImages
    - CreatePriceTier, GetPriceTiersByProduct, GetPriceTiersByVariant, DeletePriceTiersByProduct, DeletePriceTiersByVariant
  - `backend/sqlc/queries/stock.sql`:
    - CreateStockLedgerEntry
    - GetCurrentStock (SUM of quantity for variant+warehouse)
    - GetStockByProduct (GROUP BY variant+warehouse with JOINs for names)
    - GetStockLedgerEntries (paginated history for variant+warehouse)
- **Run**: `make sqlc`
- **Verify**: Generated code compiles

---

## Stage 3: Backend Implementation (PARALLEL OK — per service)

### 3.1 Model structs for products
- **Assignee**: Backend-A or Backend-B
- **Parallel**: YES — should run first or alongside 3.2-3.5
- **Files to modify**:
  - `backend/internal/model/requests.go` — add:
    - CreateProductRequest{CategoryID, Name, Description, HasVariants, SellMethod, Status, TaxRate, DiscountRate, MinQuantity, MaxQuantity, PricingMode, MarkupValue, FixedPrice, Variants[], Images[], PriceTiers[]}
    - ProductVariantEntry{SKU, Barcode, UnitID, RetailPrice, Values[]uuid.UUID, Images[], PriceTiers[]}
    - PriceTierEntry{MinQuantity, Price}
    - UpdateProductRequest (similar to Create)
    - StockAdjustmentRequest{VariantID, WarehouseID, Quantity, UnitID, Reason, Notes}
  - `backend/internal/model/responses.go` — add:
    - ProductResponse, ProductDetailResponse{+Variants, +Images, +PriceTiers}
    - ProductVariantResponse{+Values, +Images, +PriceTiers}
    - ProductImageResponse, ProductVariantImageResponse
    - PriceTierResponse
    - StockSummaryResponse{WarehouseID, WarehouseName, VariantID, VariantSKU, CurrentStock}
    - StockLedgerEntryResponse
  - `backend/internal/service/helpers.go` — add converter functions:
    - toProductResponse, toProductResponses, toProductVariantResponse, toPriceTierResponse, toStockSummary, toStockLedgerEntry

### 3.2 Upload service (S3/MinIO)
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 3.3-3.5
- **Create**: `backend/internal/service/upload.go`
  - UploadService with MinIO/S3 client
  - InitBucket() — create bucket if not exists
  - UploadImage(ctx, tenantID, file, contentType) → imageURL string
  - DeleteImage(ctx, imageURL) → error
  - Uses minio-go SDK (add dependency: `github.com/minio/minio-go/v7`)
- **Create**: `backend/internal/handler/upload.go`
  - UploadHandler{upload}
  - UploadImage — ParseMultipartForm, validate file type/size, call service, return URL

### 3.3 Stock service
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 3.2, 3.4-3.5
- **Create**: `backend/internal/service/stock.go`
  - StockService{queries}
  - GetByProduct(ctx, productID, tenantID) → []StockSummary (verify product tenant)
  - GetLedger(ctx, variantID, warehouseID, tenantID, pagination) → PaginatedResponse
  - CreateEntry(ctx, tenantID, entry) — internal, called by purchase_delivery service (Phase 3)
- **Create**: `backend/internal/handler/stock.go`
  - StockHandler{stock}
  - GetByProduct — GET /products/{id}/stock

### 3.4 Product service (COMPLEX)
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 3.2-3.3, 3.5
- **Create**: `backend/internal/service/product.go`
  - ProductService{pool, queries}
  - List(ctx, tenantID, categoryID, status, pagination) → PaginatedResponse
  - GetByID(ctx, id, tenantID) → ProductDetailResponse (aggregates: product + variants + values + images + tiers)
  - Create(ctx, tenantID, req) → ProductDetailResponse
    - TRANSACTION: create product → if has_variants=false, create single "default" variant → else create variants with values → create images → create price tiers
  - Update(ctx, id, tenantID, req) → ProductDetailResponse
    - TRANSACTION: verify tenant, update product, sync variants/values/images/tiers
  - Deactivate(ctx, id, tenantID)
- **Note**: Most complex service in the system. Handle has_variants=false as single implicit variant.

### 3.5 Router + DI wiring for Phase 2
- **Assignee**: Backend
- **Parallel**: NO (must run after 3.1-3.4 complete)
- **Files to modify**:
  - `backend/internal/router/router.go`
    - Add to Handlers: Product, Stock, Upload
    - Routes:
      - /products — CRUD with RequirePermission("master-data.product", *)
      - GET /products/{id}/stock — read permission
      - POST /uploads/images — authenticated only
  - `backend/cmd/api/main.go`
    - Initialize MinIO/S3 client
    - Instantiate UploadService, StockService, ProductService
    - Instantiate handlers, add to router.Handlers
- **Verify**: `make test-backend`, backend starts, all routes registered

---

## Stage 4: Frontend (PARALLEL OK — per page)

### 4.1 Frontend types for products
- **Assignee**: Frontend
- **Parallel**: YES — should run first
- **File to modify**: `frontend/src/lib/api/types.ts`
- **Add**: ProductResponse, ProductDetailResponse, ProductVariantResponse, ProductImageResponse, PriceTierResponse, StockSummaryResponse, StockLedgerEntryResponse, CreateProductRequest, ProductVariantEntry, PriceTierEntry, UpdateProductRequest

### 4.2 Product list page
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 4.3-4.5
- **Modify**: `frontend/src/routes/(app)/master-data/products/+page.svelte` (replace placeholder)
- **Features**:
  - Category filter dropdown (load from /categories API)
  - Status filter (active/inactive/all)
  - Table: Name, Category, Status, Variants count, Created
  - "Create Product" button → /master-data/products/create

### 4.3 Product create page
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 4.2, 4.4-4.5
- **Create**: `frontend/src/routes/(app)/master-data/products/create/+page.svelte`
- **Features**:
  - Basic info: name, description, category (select — loads from API)
  - has_variants toggle
  - If no variants: single SKU, barcode, unit (select from category units), retail_price
  - If has variants: select variant types from category's variants → auto-generate combinations → fill SKU/barcode/unit/price per combination
  - Pricing mode: inherit from category OR override (select + value input)
  - sell_method select (FIFO/LIFO)
  - Optional: tax_rate, discount_rate, min/max quantity
  - Image upload section (drag & drop or file picker)
  - Price tiers section (add/remove rows: min_quantity + price)
  - Submit → POST /products

### 4.4 Product detail/edit page
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 4.2-4.3, 4.5
- **Create**: `frontend/src/routes/(app)/master-data/products/[id]/+page.svelte`
- **Features**:
  - Edit product info
  - Manage variants (add/edit/deactivate)
  - Manage images (upload/reorder/delete)
  - Manage price tiers

### 4.5 Product stock page
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 4.2-4.4
- **Create**: `frontend/src/routes/(app)/master-data/products/[id]/stock/+page.svelte`
- **Features**:
  - Read-only table: Variant SKU, Warehouse, Current Stock, Unit
  - Loads from GET /products/{id}/stock

---

## Stage 5: Backend Tests (PARALLEL OK — per service)

Depends on Stage 3 (services wired). Tests follow existing pattern in `store_test.go`.

### 5.0 Update test utilities for Phase 2 tables
- **Assignee**: Backend
- **Parallel**: NO (must complete before 5.1-5.3)
- **File to modify**: `backend/internal/testutil/helpers.go`
- **Changes**:
  - Add new table DDLs to `runMigrations()`: products (with ENUMs sell_method, product_status), product_images, product_variants, product_variant_values, product_variant_images, price_tiers, stock_ledger (with ENUM stock_reason)
  - Add helper: `CreateTestCategory(t, queries, tenantID) CategoryResponse` — creates a category for product tests
  - Add helper: `CreateTestUnit(t, queries, tenantID) UnitResponse` — creates a unit for variant/product tests
  - Add helper: `CreateTestVariantWithValues(t, pool, queries, tenantID) VariantDetailResponse` — creates variant + values for product tests
- **Verify**: Existing Phase 1 tests still pass

### 5.1 Product service tests (COMPLEX)
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 5.2-5.3
- **Create**: `backend/internal/service/product_test.go`
- **Setup per test**: Create tenant user, create category, create units, create variant+values, link units/variants to category
- **Test cases**:
  - `TestProductService_CRUD`:
    - `list products returns empty initially`
    - `create product without variants` — has_variants=false, verify single implicit variant created with SKU, unit, price
    - `create product with variants` — has_variants=true, 2 variant combinations (e.g., Blue/M, Red/L), verify all variants created with correct values
    - `create duplicate product name fails` — ConflictError
    - `get by ID returns full detail` — verify product + variants + values + images + price_tiers aggregated
    - `get by ID with wrong tenant returns not found`
    - `update product` — change name, status, pricing fields
    - `deactivate product`
  - `TestProductService_PricingInheritance`:
    - `product inherits pricing_mode from category when null`
    - `product overrides category pricing_mode when set`
  - `TestProductService_PriceTiers`:
    - `create product with price tiers` — 3 tiers (qty 1=$10, qty 10=$9, qty 100=$8)
    - `variant overrides product price tiers`
  - `TestProductService_FilterByCategory`:
    - Create products in 2 categories, list with category filter, verify only matching returned
  - `TestProductService_Pagination`:
    - Create 5 products, list page 1 (limit 2), verify 2 returned + pagination metadata

### 5.2 Stock service tests
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 5.1, 5.3
- **Create**: `backend/internal/service/stock_test.go`
- **Setup**: Create tenant, product (with variant), warehouse
- **Test cases** (`TestStockService`):
  - `get stock returns zero initially` — no ledger entries, stock = 0
  - `create ledger entry increases stock` — add entry with qty 100, verify stock = 100
  - `create negative ledger entry decreases stock` — add entry with qty -30, verify stock = 70
  - `stock is per variant per warehouse` — 2 warehouses, verify independent stock levels
  - `get stock by product` — verify aggregated response per variant + warehouse
  - `get ledger entries paginated` — create 5 entries, get page 1 (limit 2), verify 2 returned in desc order
  - `ledger entry with wrong tenant` — verify tenant isolation on reads

### 5.3 Upload service tests
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 5.1-5.2
- **Create**: `backend/internal/service/upload_test.go`
- **Note**: Requires MinIO running. Skip with `t.Skip()` if S3_ENDPOINT env not set.
- **Test cases** (`TestUploadService`):
  - `upload image returns URL` — upload a small test PNG, verify URL returned
  - `delete image succeeds` — upload then delete, verify no error
  - `upload rejects invalid content type` — try uploading text/plain → error

---

## Stage 6: Frontend Unit Tests (PARALLEL OK)

Depends on Stage 4 (pages exist).

### 6.1 Product list page test
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 6.2-6.3
- **Create**: `frontend/src/routes/(app)/master-data/products/products.test.ts`
- **Mock**: `vi.mock('$lib/api/client.js')` for API, `vi.mock('$lib/stores/auth.svelte.js')` for auth
- **Test cases**:
  - `renders product list page title`
  - `shows loading state initially`
  - `renders products in table after load` — mock returns product list with category names, status badges
  - `shows empty state when no products`
  - `category filter dropdown is present`
  - `status filter is present`
  - `create product link navigates to /master-data/products/create`

### 6.2 Product create page test
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 6.1, 6.3
- **Create**: `frontend/src/routes/(app)/master-data/products/create/create.test.ts`
- **Test cases**:
  - `renders create product form`
  - `shows simple variant form when has_variants is off` — single SKU, barcode, unit, price fields
  - `shows variant combination builder when has_variants is on` — variant selector, combination table
  - `category select loads categories from API`
  - `pricing mode defaults to category setting`
  - `shows price tiers section`

### 6.3 Product stock page test
- **Assignee**: Frontend-A
- **Parallel**: YES
- **Create**: `frontend/src/routes/(app)/master-data/products/[id]/stock/stock.test.ts`
- **Test cases**:
  - `renders stock page title`
  - `shows stock table with variant and warehouse columns`
  - `shows zero stock for new products`

---

## Stage 7: E2E Tests (SEQUENTIAL)

Depends on Stages 3 + 4 complete (full stack running).

### 7.1 Product E2E tests
- **Assignee**: Any
- **Parallel**: NO (E2E tests run serially)
- **Create**: `frontend/tests/e2e/products.spec.ts`
- **Setup helper**: `registerAdminWithMasterData(page)` — registers user, creates a category with linked units and variants (reusable setup for product tests)
- **Test cases**:

  **Product without variants**:
  - `admin can create a simple product` — navigate to /master-data/products/create, fill basic info, has_variants=off, fill single variant fields (SKU, unit, price), submit, verify product appears in list
  - `product detail shows single variant` — navigate to product detail, verify one variant row

  **Product with variants**:
  - `admin can create a product with variants` — has_variants=on, select variant types, fill generated combinations, submit
  - `product detail shows all variant combinations` — verify each combination listed with correct values

  **Product list**:
  - `product list shows all products` — create 2 products, verify both in table
  - `product list filters by category` — create products in different categories, apply filter

  **Stock page**:
  - `stock page shows zero stock for new product` — create product, navigate to stock page, verify zero quantities

---

## Stage 8: Final Verification

### 8.1 Full test suite
- **Assignee**: Any
- **Parallel**: NO
- **Steps**:
  1. `make test-backend` — all backend tests pass (Phase 1 + Phase 2)
  2. `make test-frontend` — all frontend unit tests pass
  3. `make test-e2e` — all E2E tests pass (including new product tests)
  4. `make build` — Docker builds succeed with MinIO

---

## Parallelism Summary

```
Stage 1 (SEQUENTIAL):  1.1 → 1.2
                            ↓
Stage 2 (SEQUENTIAL):  2.1 → 2.2
                            ↓
Stage 3 (PARALLEL):    [3.1] then [3.2] [3.3] [3.4] then [3.5]
                            ↓
Stage 4 (PARALLEL):    [4.1] then [4.2] [4.3] [4.4] [4.5]
                            ↓
Stage 5 (PARALLEL):    [5.0] then [5.1] [5.2] [5.3]
                            ↓
Stage 6 (PARALLEL):    [6.1] [6.2] [6.3]
                            ↓
Stage 7 (SEQUENTIAL):  7.1
                            ↓
Stage 8 (SEQUENTIAL):  8.1

Three-team split:
  Backend team:  Stages 1 → 2 → 3 → 5 (backend tests)
  Frontend team: Stage 4 → 6 (frontend tests)
  E2E:           Stage 7 (after both teams done)

Within backend tests (Stage 5):
  Backend-A: 5.2 (stock), 5.3 (upload) — lighter tests
  Backend-B: 5.1 (product) — complex test suite
```
