# Phase 1: Master Data Foundations

> **Depends on**: Nothing (can start immediately)
> **Blocks**: Phase 2, Phase 3

---

## Stage 1: Database & Code Generation (SEQUENTIAL — must run in order)

These tasks modify shared database state and must run sequentially.

### 1.1 Create all migration files
- **Assignee**: Backend
- **Parallel**: NO (must complete before 1.2)
- **Files to create**:
  - `backend/migrations/000014_create_categories.up.sql` + `.down.sql`
    - categories table: id, tenant_id FK, name, description, pricing_mode VARCHAR(50), markup_value NUMERIC(12,4), is_active, timestamps
    - UNIQUE (tenant_id, name), INDEX tenant_id
    - CHECK: pricing_mode and markup_value both set or both null
  - `backend/migrations/000015_create_units.up.sql` + `.down.sql`
    - units table: id, tenant_id FK, name, description, is_active, timestamps
    - UNIQUE (tenant_id, name)
  - `backend/migrations/000016_create_variants.up.sql` + `.down.sql`
    - variants table: id, tenant_id FK, name, description, is_active, timestamps. UNIQUE (tenant_id, name)
    - variant_values table: id, variant_id FK CASCADE, value, sort_order, is_active, timestamps. UNIQUE (variant_id, value)
  - `backend/migrations/000017_create_category_links.up.sql` + `.down.sql`
    - category_units: id, category_id FK, unit_id FK, created_at. UNIQUE (category_id, unit_id)
    - category_variants: id, category_id FK, variant_id FK, created_at. UNIQUE (category_id, variant_id)
  - `backend/migrations/000018_create_unit_conversions.up.sql` + `.down.sql`
    - unit_conversions: id, tenant_id FK, from_unit_id FK, to_unit_id FK, conversion_factor NUMERIC(18,8), timestamps
    - UNIQUE (tenant_id, from_unit_id, to_unit_id), CHECK from != to, CHECK factor > 0
  - `backend/migrations/000019_create_warehouses.up.sql` + `.down.sql`
    - warehouses: id, tenant_id FK, name, address TEXT, phone VARCHAR(50), is_active, timestamps. UNIQUE (tenant_id, name)
  - `backend/migrations/000020_create_suppliers.up.sql` + `.down.sql`
    - suppliers: id, tenant_id FK, name, contact_name, email, phone, address TEXT, is_active, timestamps. UNIQUE (tenant_id, name)
- **Verify**: `make migrate-up` succeeds

### 1.2 Create all SQLC query files + run code generation
- **Assignee**: Backend
- **Parallel**: NO (depends on 1.1, must complete before Stage 2)
- **Files to create**:
  - `backend/sqlc/queries/categories.sql` — CreateCategory, GetCategoryByID, GetCategoriesByTenant, GetActiveCategoriesByTenant, UpdateCategory, DeactivateCategory, AddCategoryUnit, RemoveCategoryUnit, DeleteCategoryUnits, GetCategoryUnits (JOIN units), AddCategoryVariant, RemoveCategoryVariant, DeleteCategoryVariants, GetCategoryVariants (JOIN variants)
  - `backend/sqlc/queries/units.sql` — CreateUnit, GetUnitByID, GetUnitsByTenant, GetActiveUnitsByTenant, UpdateUnit, DeactivateUnit
  - `backend/sqlc/queries/variants.sql` — CreateVariant, GetVariantByID, GetVariantsByTenant, GetActiveVariantsByTenant, UpdateVariant, DeactivateVariant, CreateVariantValue, GetVariantValues, UpdateVariantValue, DeleteVariantValue, DeleteVariantValuesByVariant
  - `backend/sqlc/queries/unit_conversions.sql` — CreateUnitConversion, GetUnitConversionByID, GetUnitConversionsByTenant (JOIN units for names), UpdateUnitConversion, DeleteUnitConversion, GetConversionFactor
  - `backend/sqlc/queries/warehouses.sql` — CreateWarehouse, GetWarehouseByID, GetWarehousesByTenant, GetActiveWarehousesByTenant, UpdateWarehouse, DeactivateWarehouse
  - `backend/sqlc/queries/suppliers.sql` — CreateSupplier, GetSupplierByID, GetSuppliersByTenant, GetActiveSuppliersByTenant, UpdateSupplier, DeactivateSupplier
- **Note**: All GetByID queries do NOT filter by tenant_id (service layer enforces)
- **Run**: `make sqlc` after creating all query files
- **Verify**: Generated code compiles without errors

### 1.3 Seed data — add new feature entries
- **Assignee**: Backend
- **Parallel**: NO (depends on 1.2)
- **File to modify**: `backend/cmd/seed/main.go`
- **Add features with stable UUIDs** (all under existing parent features):
  - `10000000-0000-0000-0000-000000000010` — master-data.category [read, create, edit, delete]
  - `10000000-0000-0000-0000-000000000011` — master-data.unit [read, create, edit, delete]
  - `10000000-0000-0000-0000-000000000012` — master-data.variant [read, create, edit, delete]
  - `10000000-0000-0000-0000-000000000013` — master-data.warehouse [read, create, edit, delete]
  - `10000000-0000-0000-0000-000000000014` — master-data.supplier [read, create, edit, delete]
  - `10000000-0000-0000-0000-000000000015` — purchase.order [read, create, edit, delete]
  - `10000000-0000-0000-0000-000000000016` — purchase.delivery [read, create, edit]
- **Run**: `make seed`
- **Verify**: Features appear in DB

---

## Stage 2: Backend Model & Service Layer (PARALLEL OK)

After Stage 1 completes (migrations + sqlc + seed), these tasks can run in parallel.

### 2.1 Add model request/response structs
- **Assignee**: Backend-A or Backend-B
- **Parallel**: YES — can run alongside 2.2
- **Files to modify**:
  - `backend/internal/model/requests.go` — add:
    - CreateCategoryRequest{Name, Description, PricingMode, MarkupValue}
    - UpdateCategoryRequest{Name, Description, PricingMode, MarkupValue, IsActive}
    - UpdateCategoryUnitsRequest{UnitIDs []uuid.UUID}
    - UpdateCategoryVariantsRequest{VariantIDs []uuid.UUID}
    - Create/UpdateUnitRequest{Name, Description, [IsActive]}
    - Create/UpdateVariantRequest{Name, Description, [Values], [IsActive]}
    - VariantValueEntry{Value, SortOrder}
    - Create/UpdateVariantValueRequest{Value, SortOrder, [IsActive]}
    - Create/UpdateUnitConversionRequest{FromUnitID, ToUnitID, ConversionFactor}
    - Create/UpdateWarehouseRequest{Name, Address, Phone, [IsActive]}
    - Create/UpdateSupplierRequest{Name, ContactName, Email, Phone, Address, [IsActive]}
  - `backend/internal/model/responses.go` — add:
    - CategoryResponse, CategoryDetailResponse{+Units, +Variants}
    - UnitResponse
    - VariantResponse, VariantDetailResponse{+Values}, VariantValueResponse
    - UnitConversionResponse{+FromUnitName, +ToUnitName}
    - WarehouseResponse
    - SupplierResponse

### 2.2 Add converter functions to helpers.go
- **Assignee**: Backend-A or Backend-B
- **Parallel**: YES — can run alongside 2.1
- **File to modify**: `backend/internal/service/helpers.go`
- **Add**: toCategoryResponse, toCategoryResponses, toUnitResponse, toUnitResponses, toVariantResponse, toVariantResponses, toVariantValueResponse, toUnitConversionResponse, toWarehouseResponse, toWarehouseResponses, toSupplierResponse, toSupplierResponses

---

## Stage 3: Backend Services (PARALLEL OK — per feature)

After Stage 2 completes. Each service is independent and can be built in parallel.

### 3.1 Unit service + handler
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 3.2-3.6
- **Create**: `backend/internal/service/unit.go`
  - UnitService{queries} — simple CRUD, same pattern as store.go
  - List, GetByID (tenant verify), Create, Update, Deactivate
- **Create**: `backend/internal/handler/unit.go`
  - UnitHandler{unit} — List, GetByID, Create, Update, Delete

### 3.2 Warehouse service + handler
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 3.1, 3.3-3.6
- **Create**: `backend/internal/service/warehouse.go`
  - WarehouseService{queries} — simple CRUD, same pattern as store.go
- **Create**: `backend/internal/handler/warehouse.go`

### 3.3 Supplier service + handler
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 3.1-3.2, 3.4-3.6
- **Create**: `backend/internal/service/supplier.go`
  - SupplierService{queries} — simple CRUD
- **Create**: `backend/internal/handler/supplier.go`

### 3.4 Variant service + handler
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 3.1-3.3, 3.5-3.6
- **Create**: `backend/internal/service/variant.go`
  - VariantService{pool, queries} — needs pool for tx (Create with initial values)
  - List, GetByID (returns VariantDetailResponse with values), Create (tx), Update, Deactivate
  - AddValue, UpdateValue, DeleteValue (sub-resource methods, verify variant tenant)
- **Create**: `backend/internal/handler/variant.go`
  - VariantHandler — standard CRUD + AddValue, UpdateValue, DeleteValue

### 3.5 Category service + handler
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 3.1-3.4, 3.6
- **Create**: `backend/internal/service/category.go`
  - CategoryService{pool, queries} — needs pool for tx (UpdateUnits/UpdateVariants)
  - List, GetByID (returns CategoryDetailResponse with linked units & variants), Create, Update, Deactivate
  - UpdateUnits (tx: DeleteCategoryUnits → loop AddCategoryUnit), UpdateVariants (same pattern)
- **Create**: `backend/internal/handler/category.go`
  - CategoryHandler — standard CRUD + UpdateUnits, UpdateVariants

### 3.6 Unit conversion service + handler
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 3.1-3.5
- **Create**: `backend/internal/service/unit_conversion.go`
  - UnitConversionService{queries} — List uses JOIN query for unit names
  - Create (validate from != to), Update, Delete
- **Create**: `backend/internal/handler/unit_conversion.go`

---

## Stage 4: Backend Wiring (SEQUENTIAL — must run after all Stage 3 tasks)

### 4.1 Router registration + DI wiring
- **Assignee**: Backend
- **Parallel**: NO (touches shared files, must run after all services/handlers exist)
- **Files to modify**:
  - `backend/internal/router/router.go`
    - Add to Handlers struct: Category, Unit, Variant, UnitConversion, Warehouse, Supplier
    - Add route groups with RequirePermission middleware (see plan 1.6 for route layout)
  - `backend/cmd/api/main.go`
    - Instantiate 6 services → 6 handlers → add to router.Handlers
- **Verify**: `make test-backend` passes, backend starts without errors

---

## Stage 5: Frontend (PARALLEL OK — per feature)

Can start after Stage 1 completes (seed data needed for permissions). Independent of backend Stages 3-4 for the types/pages themselves, but API calls need backend running.

### 5.1 Frontend types
- **Assignee**: Frontend
- **Parallel**: YES — should run first or alongside 5.2-5.8
- **File to modify**: `frontend/src/lib/api/types.ts`
- **Add**: CategoryResponse, CategoryDetailResponse, CreateCategoryRequest, UpdateCategoryRequest, UnitResponse, CreateUnitRequest, UpdateUnitRequest, VariantResponse, VariantDetailResponse, VariantValueResponse, CreateVariantRequest, UnitConversionResponse, CreateUnitConversionRequest, WarehouseResponse, CreateWarehouseRequest, SupplierResponse, CreateSupplierRequest

### 5.2 Units page
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 5.3-5.8
- **Create**: `frontend/src/routes/(app)/settings/units/+page.svelte`
- **Pattern**: CRUD list (same as stores page). Fields: name, description
- **Reference**: `frontend/src/routes/(app)/settings/stores/+page.svelte`

### 5.3 Warehouses page
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 5.2, 5.4-5.8
- **Create**: `frontend/src/routes/(app)/settings/warehouses/+page.svelte`
- **Pattern**: CRUD list. Fields: name, address, phone

### 5.4 Suppliers page
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 5.2-5.3, 5.5-5.8
- **Create**: `frontend/src/routes/(app)/settings/suppliers/+page.svelte`
- **Pattern**: CRUD list. Fields: name, contact_name, email, phone, address

### 5.5 Categories list page
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 5.2-5.4, 5.6-5.8
- **Create**: `frontend/src/routes/(app)/settings/categories/+page.svelte`
- **Pattern**: CRUD list with SimpleDialog. Fields: name, description, pricing_mode (select), markup_value (conditional)
- **Note**: "Edit" button links to detail page [id]

### 5.6 Categories detail page
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 5.2-5.5, 5.7-5.8
- **Create**: `frontend/src/routes/(app)/settings/categories/[id]/+page.svelte`
- **Pattern**: Detail page with tabs (plain HTML buttons, NOT bits-ui Tabs)
  - Tab 1: Linked Units — checklist of all tenant units, check = linked. Save calls PUT /categories/{id}/units
  - Tab 2: Linked Variants — same pattern. Save calls PUT /categories/{id}/variants

### 5.7 Variants list + detail pages
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 5.2-5.6, 5.8
- **Create**:
  - `frontend/src/routes/(app)/settings/variants/+page.svelte` — CRUD list. "Edit" links to detail page
  - `frontend/src/routes/(app)/settings/variants/[id]/+page.svelte` — Detail: variant info + inline variant values management (add/edit/delete values via SimpleDialog)

### 5.8 Unit conversions page
- **Assignee**: Frontend-A or Frontend-B
- **Parallel**: YES — can run alongside 5.2-5.7
- **Create**: `frontend/src/routes/(app)/settings/unit-conversions/+page.svelte`
- **Pattern**: CRUD list. Fields: from_unit (select dropdown), to_unit (select dropdown), conversion_factor (number input)
- **Note**: Needs to load units list for the dropdowns

### 5.9 Sidebar updates
- **Assignee**: Frontend
- **Parallel**: NO (touches shared file, do after pages are created)
- **File to modify**: `frontend/src/lib/components/Sidebar.svelte`
- **Changes**:
  - Add icon imports: Boxes, Ruler, Palette, ArrowLeftRight, Warehouse, Truck from @lucide/svelte
  - Add to settingsItems: Categories, Units, Variants, Conversions, Warehouses, Suppliers (with feature/action for permission gating)
  - Update settings rendering loop to use `canSeeItem()` filter (currently missing — only navItems use it)

---

## Stage 6: Backend Tests (PARALLEL OK — per feature)

Depends on Stage 4 (all services wired). Tests follow the exact pattern in `backend/internal/service/store_test.go`.

### 6.0 Update test utilities
- **Assignee**: Backend
- **Parallel**: NO (must complete before 6.1-6.6)
- **File to modify**: `backend/internal/testutil/helpers.go`
- **Changes**:
  - Add new table DDLs to `runMigrations()` — categories, units, variants, variant_values, category_units, category_variants, unit_conversions, warehouses, suppliers (matching migration SQL exactly)
  - Add new feature UUIDs to package vars:
    ```go
    MasterDataCategory  = uuid.MustParse("10000000-0000-0000-0000-000000000010")
    MasterDataUnit      = uuid.MustParse("10000000-0000-0000-0000-000000000011")
    MasterDataVariant   = uuid.MustParse("10000000-0000-0000-0000-000000000012")
    MasterDataWarehouse = uuid.MustParse("10000000-0000-0000-0000-000000000013")
    MasterDataSupplier  = uuid.MustParse("10000000-0000-0000-0000-000000000014")
    PurchaseOrder       = uuid.MustParse("10000000-0000-0000-0000-000000000015")
    PurchaseDelivery    = uuid.MustParse("10000000-0000-0000-0000-000000000016")
    ```
  - Add new features to `seedFeatures()` (children of MasterDataID and PurchaseID)
- **Reference**: Existing pattern in `testutil/helpers.go` lines 229-253
- **Verify**: `make test-backend` — existing tests still pass with updated helpers

### 6.1 Unit service tests
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 6.2-6.6
- **Create**: `backend/internal/service/unit_test.go`
- **Pattern**: Same as `store_test.go`. Use `testutil.SetupTestDB(t)`, `testutil.CreateTestUser(t, pool, queries)`
- **Test cases** (`TestUnitService_CRUD`):
  - `list units returns empty initially` — no units created yet
  - `create unit` — name, description. Assert fields + tenantID
  - `create duplicate unit name fails` — same tenant, same name → ConflictError (409)
  - `get by ID` — verify all fields
  - `get by ID with wrong tenant returns not found` — uuid.New() as tenant → ErrNotFound
  - `get nonexistent unit returns not found` — uuid.New() as ID → ErrNotFound
  - `update unit` — change name/description, verify updated fields
  - `update unit with wrong tenant returns not found` — ErrNotFound
  - `deactivate unit` — verify is_active=false after deactivation
  - `deactivate with wrong tenant returns not found`

### 6.2 Warehouse service tests
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 6.1, 6.3-6.6
- **Create**: `backend/internal/service/warehouse_test.go`
- **Test cases** (`TestWarehouseService_CRUD`): Same CRUD pattern as 6.1
  - create, duplicate fails, get by ID, wrong tenant, update, deactivate
  - Extra: verify address and phone nullable fields

### 6.3 Supplier service tests
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 6.1-6.2, 6.4-6.6
- **Create**: `backend/internal/service/supplier_test.go`
- **Test cases** (`TestSupplierService_CRUD`): Same pattern
  - create, duplicate fails, get by ID, wrong tenant, update, deactivate
  - Extra: verify contact_name, email, phone, address nullable fields

### 6.4 Variant service tests
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 6.1-6.3, 6.5-6.6
- **Create**: `backend/internal/service/variant_test.go`
- **Test cases**:
  - `TestVariantService_CRUD` — standard CRUD: create, duplicate fails, get by ID, wrong tenant, update, deactivate
  - `TestVariantService_WithValues` — create variant with initial values, verify GetByID returns VariantDetailResponse with values
  - `TestVariantService_ValueManagement`:
    - `add value` — create variant, add value, verify it appears in GetByID
    - `add duplicate value fails` — same variant, same value string → ConflictError
    - `update value` — change value string and sort_order
    - `delete value` — remove value, verify gone from GetByID
    - `add value with wrong tenant returns not found` — variant belongs to different tenant

### 6.5 Category service tests
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 6.1-6.4, 6.6
- **Create**: `backend/internal/service/category_test.go`
- **Test cases**:
  - `TestCategoryService_CRUD` — standard CRUD with pricing_mode/markup_value fields
  - `TestCategoryService_LinkUnits`:
    - Create category + 3 units
    - `update units` — link 2 units, verify GetByID returns CategoryDetailResponse with 2 units
    - `update units replaces` — link different 2 units, verify old ones removed
    - `update units with wrong tenant returns not found`
  - `TestCategoryService_LinkVariants`: Same pattern as LinkUnits but with variants

### 6.6 Unit conversion service tests
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 6.1-6.5
- **Create**: `backend/internal/service/unit_conversion_test.go`
- **Test cases** (`TestUnitConversionService_CRUD`):
  - Create 2 units first (setup)
  - `create conversion` — from_unit → to_unit, factor. Verify fields + unit names in response
  - `create duplicate conversion fails` — same from/to pair → ConflictError
  - `create conversion with same unit fails` — from_unit == to_unit → ValidationError
  - `get by ID with wrong tenant returns not found`
  - `update conversion` — change factor
  - `delete conversion` — verify gone from list
  - `list conversions` — verify JOIN returns unit names

---

## Stage 7: Frontend Unit Tests (PARALLEL OK — per page)

Depends on Stage 5 (pages exist). Tests follow the pattern in `frontend/src/lib/components/Sidebar.test.ts` and `frontend/src/routes/(auth)/login/login.test.ts`.

### 7.1 Sidebar test update
- **Assignee**: Frontend
- **Parallel**: YES — can run alongside 7.2-7.5
- **File to modify**: `frontend/src/lib/components/Sidebar.test.ts`
- **Add test cases**:
  - `shows Categories when user has master-data.category read permission`
  - `shows Units when user has master-data.unit read permission`
  - `shows Variants when user has master-data.variant read permission`
  - `shows Warehouses when user has master-data.warehouse read permission`
  - `shows Suppliers when user has master-data.supplier read permission`
  - `hides Categories when user lacks permission`
  - `has correct href for new settings items` — /settings/categories, /settings/units, etc.
- **Pattern**: Mock `auth.hasPermission` to return true/false per feature slug

### 7.2 Units page test
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 7.1, 7.3-7.5
- **Create**: `frontend/src/routes/(app)/settings/units/units.test.ts`
- **Mock**: `vi.mock('$lib/api/client.js')` — mock `getClient()` to return mock API
- **Test cases**:
  - `renders page title` — "Units" heading visible
  - `shows loading state` — loading spinner while data loads
  - `renders units in table after load` — mock API returns unit list, verify table rows
  - `shows empty state when no units` — mock returns [], verify empty message
  - `opens create dialog on button click` — click "Create Unit", dialog opens
  - `shows error on failed load` — mock API throws APIError, verify Alert visible

### 7.3 Warehouses page test
- **Assignee**: Frontend-A
- **Parallel**: YES — same pattern as 7.2
- **Create**: `frontend/src/routes/(app)/settings/warehouses/warehouses.test.ts`
- **Test cases**: Same as 7.2 adapted for warehouse fields (name, address, phone)

### 7.4 Categories page test
- **Assignee**: Frontend-B
- **Parallel**: YES
- **Create**: `frontend/src/routes/(app)/settings/categories/categories.test.ts`
- **Test cases**: Same CRUD list pattern + verify pricing_mode select is present in dialog

### 7.5 Variants page test
- **Assignee**: Frontend-B
- **Parallel**: YES
- **Create**: `frontend/src/routes/(app)/settings/variants/variants.test.ts`
- **Test cases**: Same CRUD list pattern + verify "Edit" links to /settings/variants/[id]

---

## Stage 8: E2E Tests (SEQUENTIAL — needs full stack running)

Depends on Stage 4 (backend wired) + Stage 5 (frontend pages). Follow pattern in `frontend/tests/e2e/stores.spec.ts`.

### 8.1 Master data E2E tests
- **Assignee**: Any
- **Parallel**: NO (E2E tests run serially per Playwright config)
- **Create**: `frontend/tests/e2e/master-data.spec.ts`
- **Helper**: Reuse `registerAdmin(page)` pattern from stores.spec.ts
- **Test suites**:

  **Unit Management**:
  - `admin can create a unit` — navigate to /settings/units, click Create, fill name+description, submit, verify appears in table
  - `admin can create multiple units` — create 3 units, verify all visible
  - `cannot create unit with duplicate name` — create unit, create again with same name → error visible
  - `admin can deactivate a unit` — create, deactivate, verify Inactive badge

  **Warehouse Management**:
  - `admin can create a warehouse` — same pattern: name, address, phone
  - `admin can deactivate a warehouse`
  - `cannot create warehouse with duplicate name`

  **Supplier Management**:
  - `admin can create a supplier` — name, contact_name, email, phone, address
  - `admin can deactivate a supplier`

  **Category Management**:
  - `admin can create a category` — name, description, pricing_mode, markup_value
  - `admin can view category detail` — create category, click Edit, verify detail page loads
  - `admin can link units to category` — create category + units, go to detail, check unit checkboxes, save
  - `admin can link variants to category` — same pattern with variants

  **Variant Management**:
  - `admin can create a variant` — name, description
  - `admin can manage variant values` — create variant, go to detail, add values "Blue", "Red", "Green", verify listed
  - `admin can delete a variant value` — remove a value, verify gone

  **Unit Conversions**:
  - `admin can create a unit conversion` — create 2 units first, then create conversion with from/to/factor
  - `admin can delete a unit conversion`

---

## Stage 9: Final Verification

### 9.1 Full test suite
- **Assignee**: Any
- **Parallel**: NO
- **Steps**:
  1. `make test-backend` — all backend tests pass (existing + new)
  2. `make test-frontend` — all frontend unit tests pass
  3. `make test-e2e` — all E2E tests pass
  4. `make test` — combined backend + frontend pass
  5. `make build` — Docker builds succeed

---

## Parallelism Summary

```
Stage 1 (SEQUENTIAL):  1.1 → 1.2 → 1.3
                            ↓
Stage 2 (PARALLEL):    [2.1] [2.2]
                            ↓
Stage 3 (PARALLEL):    [3.1] [3.2] [3.3] [3.4] [3.5] [3.6]
                            ↓
Stage 4 (SEQUENTIAL):  4.1
                            ↓
Stage 5 (PARALLEL):    [5.1] then [5.2] [5.3] [5.4] [5.5] [5.6] [5.7] [5.8] then [5.9]
                            ↓
Stage 6 (PARALLEL):    [6.0] then [6.1] [6.2] [6.3] [6.4] [6.5] [6.6]
                            ↓
Stage 7 (PARALLEL):    [7.1] [7.2] [7.3] [7.4] [7.5]
                            ↓
Stage 8 (SEQUENTIAL):  8.1
                            ↓
Stage 9 (SEQUENTIAL):  9.1

Notes:
  - Stage 5 (frontend) can start after Stage 1 for types/pages
  - Stage 6 (backend tests) can run in parallel with Stage 5 (frontend)
  - Stage 7 (frontend tests) depends on Stage 5 (pages must exist)
  - Stage 8 (E2E) needs both Stage 4 + Stage 5 complete
  - Two teams can work simultaneously:
    Backend: Stages 2-4, then 6
    Frontend: Stages 5, then 7
    E2E: Stage 8 after both teams done
```
