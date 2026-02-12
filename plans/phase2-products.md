# Phase 2: Product Variants Redesign

## Summary

Redesign the variant system so that **variants are product-scoped instead of tenant-scoped master data**. Currently, variants (e.g., "Color", "Size") are standalone master data entities linked to categories. The new design makes variant types (called "option types") and their values defined directly on each product, enabling arbitrary multi-variant combinations per product.

**Example:**
- Product "T-Shirt" has option types: Color (blue, red, green), Size (S, M, L, XL)
- Variant 1: Color=Blue, Size=L → SKU: TS-BLU-L
- Variant 2: Color=Red, Size=M → SKU: TS-RED-M
- Variant 3: Color=Green, Size=XL → SKU: TS-GRN-XL

---

## Current State (What Exists)

### Database Tables
| Table | Purpose | Status |
|---|---|---|
| `variants` | Tenant-scoped variant types (Color, Size) | **REMOVE** |
| `variant_values` | Values per variant (Red, Blue, S, M) | **REMOVE** |
| `category_variants` | Links variants to categories | **REMOVE** |
| `product_variants` | SKU/barcode/price per combination | **KEEP (modify)** |
| `product_variant_values` | Links product_variant → variant_value | **REMOVE (replace)** |
| `product_variant_images` | Images per variant combination | **KEEP** |
| `price_tiers` | Tiered pricing | **KEEP** |
| `stock_ledger` | Stock tracking per product_variant | **KEEP** |

### Backend Code
| File | Status |
|---|---|
| `service/variant.go`, `service/variant_test.go` | **DELETE** |
| `handler/variant.go` | **DELETE** |
| `sqlc/queries/variants.sql` | **DELETE** |
| `sqlc/queries/categories.sql` (variant parts) | **MODIFY** - remove variant-related queries |
| `sqlc/queries/products.sql` | **MODIFY** - new option type/value queries |
| `service/category.go` | **MODIFY** - remove variant linking |
| `service/product.go` | **MODIFY** - new variant creation logic |
| `handler/category.go` | **MODIFY** - remove variant endpoints |
| `handler/product.go` | **MODIFY** - new request/response format |
| `model/requests.go` | **MODIFY** |
| `model/responses.go` | **MODIFY** |
| `router/router.go` | **MODIFY** - remove variant routes |

### Frontend Code
| Path | Status |
|---|---|
| `routes/(app)/settings/variants/` | **DELETE** (entire directory) |
| `routes/(app)/settings/categories/` | **MODIFY** - remove variant linking UI |
| `routes/(app)/master-data/products/` | **MODIFY** - new variant creation UI |
| `lib/api/types.ts` | **MODIFY** |
| `lib/components/Sidebar.svelte` | **MODIFY** - remove Variants nav item |

---

## New Design

### New Database Schema

#### New Table: `product_option_types`
Stores the variant dimensions for each product (e.g., "Color", "Size").

```sql
CREATE TABLE product_option_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,        -- e.g., "Color", "Size"
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, name)
);
```

#### New Table: `product_option_values`
Stores the possible values for each option type (e.g., "Blue", "Red" for Color).

```sql
CREATE TABLE product_option_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    option_type_id UUID NOT NULL REFERENCES product_option_types(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,       -- e.g., "Blue", "Red", "L", "XL"
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (option_type_id, value)
);
```

#### Modified Table: `product_variant_values` → `product_variant_options`
Links each product variant (SKU) to specific option values.

```sql
-- Drop old table
DROP TABLE IF EXISTS product_variant_values;

-- New table
CREATE TABLE product_variant_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    option_value_id UUID NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
    UNIQUE (product_variant_id, option_value_id)
);
```

#### Tables to Drop
```sql
DROP TABLE IF EXISTS category_variants;  -- from migration 000017
DROP TABLE IF EXISTS variant_values;     -- from migration 000016
DROP TABLE IF EXISTS variants;           -- from migration 000016
```

#### Tables Unchanged
- `product_variants` — still holds SKU, barcode, unit_id, retail_price per combination
- `product_variant_images` — still holds images per variant
- `price_tiers` — still holds tiered pricing
- `stock_ledger` — still references product_variant_id
- `category_units` — stays (units are still linked to categories)

### Data Model Relationships

```
Product
├── product_option_types (Color, Size, Material, ...)
│   └── product_option_values (Blue, Red, L, XL, ...)
├── product_variants (one per combination: Blue+L, Red+M, ...)
│   ├── product_variant_options → product_option_values
│   ├── product_variant_images
│   └── price_tiers (variant-level)
├── product_images
└── price_tiers (product-level)
```

### API Design

#### Removed Endpoints
```
DELETE  /api/v1/variants                      (entire resource)
DELETE  /api/v1/variants/{id}
DELETE  /api/v1/variants/{id}/values
DELETE  /api/v1/variants/{id}/values/{valueId}
DELETE  PUT /api/v1/categories/{id}/variants  (category-variant linking)
```

#### Modified Endpoints

**POST /api/v1/products** — Create Product

New request body for variant products:
```json
{
  "category_id": "uuid",
  "name": "T-Shirt",
  "has_variants": true,
  "sell_method": "fifo",
  "status": "active",
  "option_types": [
    {
      "name": "Color",
      "sort_order": 0,
      "values": ["Blue", "Red", "Green"]
    },
    {
      "name": "Size",
      "sort_order": 1,
      "values": ["S", "M", "L", "XL"]
    }
  ],
  "variants": [
    {
      "sku": "TS-BLU-L",
      "barcode": "",
      "unit_id": "uuid",
      "retail_price": 29.99,
      "option_values": ["Blue", "L"],
      "images": [],
      "price_tiers": []
    },
    {
      "sku": "TS-RED-M",
      "unit_id": "uuid",
      "retail_price": 29.99,
      "option_values": ["Red", "M"]
    }
  ],
  "images": [],
  "price_tiers": []
}
```

The `option_values` array in each variant maps positionally to `option_types` — the first value corresponds to the first option type, the second to the second, etc.

**GET /api/v1/products/{id}** — Get Product Detail

New response:
```json
{
  "id": "uuid",
  "name": "T-Shirt",
  "has_variants": true,
  "option_types": [
    {
      "id": "uuid",
      "name": "Color",
      "sort_order": 0,
      "values": [
        {"id": "uuid", "value": "Blue", "sort_order": 0},
        {"id": "uuid", "value": "Red", "sort_order": 1},
        {"id": "uuid", "value": "Green", "sort_order": 2}
      ]
    },
    {
      "id": "uuid",
      "name": "Size",
      "sort_order": 1,
      "values": [
        {"id": "uuid", "value": "S", "sort_order": 0},
        {"id": "uuid", "value": "M", "sort_order": 1},
        {"id": "uuid", "value": "L", "sort_order": 2},
        {"id": "uuid", "value": "XL", "sort_order": 3}
      ]
    }
  ],
  "variants": [
    {
      "id": "uuid",
      "sku": "TS-BLU-L",
      "retail_price": 29.99,
      "options": [
        {"option_type_name": "Color", "value": "Blue"},
        {"option_type_name": "Size", "value": "L"}
      ],
      "images": [],
      "price_tiers": []
    }
  ],
  "..."
}
```

**PUT /api/v1/products/{id}** — same structure as Create

**GET /api/v1/categories/{id}** — remove `variants` from detail response (keep `units`)

---

## Implementation Steps

### Step 1: Database Migration

**File:** `backend/migrations/000026_redesign_product_variants.up.sql`

```sql
-- 1. Drop tables that depend on old variants system
DROP TABLE IF EXISTS category_variants;
DROP TABLE IF EXISTS product_variant_values;

-- 2. Drop old variant master data
DROP TABLE IF EXISTS variant_values;
DROP TABLE IF EXISTS variants;

-- 3. Create new product-scoped option types
CREATE TABLE product_option_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, name)
);

CREATE TABLE product_option_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    option_type_id UUID NOT NULL REFERENCES product_option_types(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (option_type_id, value)
);

CREATE TABLE product_variant_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    option_value_id UUID NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
    UNIQUE (product_variant_id, option_value_id)
);

-- 4. Index for fast lookups
CREATE INDEX idx_product_option_types_product ON product_option_types(product_id);
CREATE INDEX idx_product_option_values_type ON product_option_values(option_type_id);
CREATE INDEX idx_product_variant_options_variant ON product_variant_options(product_variant_id);
```

**File:** `backend/migrations/000026_redesign_product_variants.down.sql`

```sql
-- Reverse: drop new tables, recreate old ones
DROP TABLE IF EXISTS product_variant_options;
DROP TABLE IF EXISTS product_option_values;
DROP TABLE IF EXISTS product_option_types;

-- Recreate old variant tables
CREATE TABLE variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE variant_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (variant_id, value)
);

CREATE TABLE category_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, variant_id)
);

CREATE TABLE product_variant_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    variant_value_id UUID NOT NULL REFERENCES variant_values(id),
    UNIQUE (product_variant_id, variant_value_id)
);
```

### Step 2: Delete Old Variant Backend Code

**Delete files:**
- `backend/internal/service/variant.go`
- `backend/internal/service/variant_test.go`
- `backend/internal/handler/variant.go`
- `backend/sqlc/queries/variants.sql`
- `backend/internal/database/sqlc/variants.sql.go` (regenerated by sqlc)

### Step 3: Update sqlc Queries

**File:** `backend/sqlc/queries/categories.sql` — Remove these queries:
- `AddCategoryVariant`
- `RemoveCategoryVariant`
- `DeleteCategoryVariants`
- `GetCategoryVariants`

**File:** `backend/sqlc/queries/products.sql` — Remove old variant value queries, add new:

```sql
-- Product Option Types
-- name: CreateProductOptionType :one
INSERT INTO product_option_types (product_id, name, sort_order)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetProductOptionTypes :many
SELECT * FROM product_option_types
WHERE product_id = $1
ORDER BY sort_order, name;

-- name: DeleteProductOptionTypesByProduct :exec
DELETE FROM product_option_types WHERE product_id = $1;

-- Product Option Values
-- name: CreateProductOptionValue :one
INSERT INTO product_option_values (option_type_id, value, sort_order)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetProductOptionValues :many
SELECT * FROM product_option_values
WHERE option_type_id = $1
ORDER BY sort_order, value;

-- name: GetProductOptionValuesByProduct :many
SELECT pov.*, pot.name AS option_type_name, pot.sort_order AS option_type_sort_order
FROM product_option_values pov
JOIN product_option_types pot ON pot.id = pov.option_type_id
WHERE pot.product_id = $1
ORDER BY pot.sort_order, pov.sort_order;

-- name: DeleteProductOptionValuesByType :exec
DELETE FROM product_option_values WHERE option_type_id = $1;

-- Product Variant Options (linking variants to option values)
-- name: CreateProductVariantOption :one
INSERT INTO product_variant_options (product_variant_id, option_value_id)
VALUES ($1, $2)
RETURNING *;

-- name: GetProductVariantOptions :many
SELECT pvo.*, pov.value, pot.name AS option_type_name, pot.id AS option_type_id
FROM product_variant_options pvo
JOIN product_option_values pov ON pov.id = pvo.option_value_id
JOIN product_option_types pot ON pot.id = pov.option_type_id
WHERE pvo.product_variant_id = $1
ORDER BY pot.sort_order;

-- name: DeleteProductVariantOptions :exec
DELETE FROM product_variant_options WHERE product_variant_id = $1;

-- name: DeleteProductVariantOptionsByProduct :exec
DELETE FROM product_variant_options
WHERE product_variant_id IN (
    SELECT id FROM product_variants WHERE product_id = $1
);
```

Remove from `products.sql`:
- `CreateProductVariantValue`
- `GetProductVariantValues`
- `DeleteProductVariantValues`

### Step 4: Regenerate sqlc

```bash
make sqlc
```

This regenerates all files in `backend/internal/database/sqlc/`. The old `variants.sql.go` will be removed since `variants.sql` is deleted.

### Step 5: Update Backend Models

**File:** `backend/internal/model/requests.go`

Remove:
- `CreateVariantRequest`
- `UpdateVariantRequest`
- `VariantValueEntry`
- `CreateVariantValueRequest`
- `UpdateVariantValueRequest`
- `UpdateCategoryVariantsRequest`

Add:
```go
// ProductOptionTypeEntry is used when creating/updating a product
type ProductOptionTypeEntry struct {
    Name      string   `json:"name" validate:"required,min=1,max=255"`
    SortOrder int32    `json:"sort_order"`
    Values    []string `json:"values" validate:"required,min=1,dive,required,min=1,max=255"`
}
```

Modify `CreateProductRequest`:
```go
type CreateProductRequest struct {
    // ... existing fields ...
    OptionTypes []ProductOptionTypeEntry `json:"option_types" validate:"omitempty,dive"`
    Variants    []ProductVariantEntry    `json:"variants" validate:"omitempty,dive"`
    // ... existing fields ...
}
```

Modify `ProductVariantEntry`:
```go
type ProductVariantEntry struct {
    SKU          string           `json:"sku" validate:"required,min=1,max=100"`
    Barcode      string           `json:"barcode" validate:"omitempty,max=100"`
    UnitID       uuid.UUID        `json:"unit_id" validate:"required"`
    RetailPrice  float64          `json:"retail_price" validate:"min=0"`
    OptionValues []string         `json:"option_values" validate:"omitempty"` // positional mapping to option_types
    Images       []string         `json:"images" validate:"omitempty"`
    PriceTiers   []PriceTierEntry `json:"price_tiers" validate:"omitempty,dive"`
}
```

**File:** `backend/internal/model/responses.go`

Remove:
- `VariantResponse`
- `VariantDetailResponse`
- `VariantValueResponse`
- `ProductVariantValueResponse`

Add:
```go
type ProductOptionTypeResponse struct {
    ID        uuid.UUID                    `json:"id"`
    ProductID uuid.UUID                    `json:"product_id"`
    Name      string                       `json:"name"`
    SortOrder int32                        `json:"sort_order"`
    Values    []ProductOptionValueResponse `json:"values"`
    CreatedAt time.Time                    `json:"created_at"`
    UpdatedAt time.Time                    `json:"updated_at"`
}

type ProductOptionValueResponse struct {
    ID        uuid.UUID `json:"id"`
    Value     string    `json:"value"`
    SortOrder int32     `json:"sort_order"`
}

type ProductVariantOptionResponse struct {
    OptionTypeName string `json:"option_type_name"`
    Value          string `json:"value"`
}
```

Modify `ProductDetailResponse`:
```go
type ProductDetailResponse struct {
    ProductResponse
    OptionTypes []ProductOptionTypeResponse    `json:"option_types"`  // NEW
    Variants    []ProductVariantResponse       `json:"variants"`
    Images      []ProductImageResponse         `json:"images"`
    PriceTiers  []PriceTierResponse            `json:"price_tiers"`
}
```

Modify `ProductVariantResponse`:
```go
type ProductVariantResponse struct {
    // ... existing fields ...
    Options    []ProductVariantOptionResponse  `json:"options"`  // was "values"
    Images     []ProductVariantImageResponse   `json:"images"`
    PriceTiers []PriceTierResponse             `json:"price_tiers"`
}
```

Modify `CategoryDetailResponse`:
```go
type CategoryDetailResponse struct {
    CategoryResponse
    Units []UnitResponse `json:"units"`
    // Variants field removed
}
```

### Step 6: Update Backend Services

**File:** `backend/internal/service/product.go`

**Create method** — update the transaction to:
1. Create product record
2. If `has_variants=true` and `option_types` provided:
   a. Create each `product_option_type` record
   b. Create `product_option_value` records for each type's values
   c. Build a lookup map: `{optionTypeName: {valueName: valueID}}`
3. For each variant entry:
   a. Create `product_variant` (SKU, barcode, unit, price)
   b. For each `option_value` string in the variant's `option_values` array:
      - Look up the corresponding option type by position index
      - Find the value ID from the lookup map
      - Create `product_variant_option` record
   c. Create variant images and price tiers
4. Create product-level images and price tiers

**GetByID method** — update to:
1. Get product
2. Get `product_option_types` for product → with their `product_option_values`
3. Get `product_variants` for product → with their `product_variant_options`, images, price tiers
4. Assemble full response

**Update method** — full replacement approach (same as current):
1. Delete existing option types (cascades to values and variant options)
2. Delete existing variants (cascades to variant images, variant options)
3. Delete existing product images and price tiers
4. Recreate everything from the request

**File:** `backend/internal/service/category.go`

Remove methods:
- `UpdateVariants`

Remove from `GetByID`:
- The query/assembly of `Variants []VariantResponse` from category detail

**File:** `backend/internal/handler/category.go`

Remove:
- `UpdateVariants` handler method

### Step 7: Update Router

**File:** `backend/internal/router/router.go`

Remove:
- Entire `/api/v1/variants` route group
- `PUT /api/v1/categories/{id}/variants` route

### Step 8: Update Frontend Types

**File:** `frontend/src/lib/api/types.ts`

Remove:
- `VariantResponse`, `VariantDetailResponse`, `VariantValueResponse`
- `CreateVariantRequest`, `CreateVariantValueRequest`, `UpdateVariantValueRequest`
- `UpdateCategoryVariantsRequest`
- `ProductVariantValueResponse`

Add:
```ts
interface ProductOptionTypeResponse {
    id: string;
    product_id: string;
    name: string;
    sort_order: number;
    values: ProductOptionValueResponse[];
    created_at: string;
    updated_at: string;
}

interface ProductOptionValueResponse {
    id: string;
    value: string;
    sort_order: number;
}

interface ProductVariantOptionResponse {
    option_type_name: string;
    value: string;
}
```

Modify:
- `ProductDetailResponse` — add `option_types: ProductOptionTypeResponse[]`, keep `variants`
- `ProductVariantResponse` — change `values` to `options: ProductVariantOptionResponse[]`
- `CategoryDetailResponse` — remove `variants` field
- `CreateProductRequest` — add `option_types`, change `variants` field
- `ProductVariantEntry` — replace `values?: string[]` with `option_values?: string[]`

### Step 9: Delete Frontend Variant Pages

**Delete entire directory:**
- `frontend/src/routes/(app)/settings/variants/`

### Step 10: Update Frontend Sidebar

**File:** `frontend/src/lib/components/Sidebar.svelte`

Remove the "Variants" navigation item from the Settings section.

### Step 11: Update Frontend Category Pages

**File:** `frontend/src/routes/(app)/settings/categories/+page.svelte` (if it has variant linking UI)
**File:** `frontend/src/routes/(app)/settings/categories/[id]/+page.svelte` (if it has variant display)

Remove any UI related to linking/displaying variants on categories.

### Step 12: Update Frontend Product Pages

**File:** `frontend/src/routes/(app)/master-data/products/create/+page.svelte`

Redesign the variant section:
1. When "Has Variants" is toggled ON, show:
   - **Option Types section**: Dynamic list of option types
     - Each type has: Name input (e.g., "Color"), Values input (comma-separated or tag-style: "Blue, Red, Green")
     - "Add Option Type" button
     - "Remove" button per option type
   - **Variant Combinations section**: Auto-generated or manually created
     - Table showing all defined variants
     - Columns: Option values (one col per option type), SKU, Barcode, Unit, Retail Price, Actions
     - "Generate All Combinations" button (creates cartesian product of all option values)
     - "Add Variant" button for manual addition
     - Each row can be individually edited or removed
2. When "Has Variants" is toggled OFF:
   - Show single SKU/Barcode/Unit/RetailPrice form (same as current)

**File:** `frontend/src/routes/(app)/master-data/products/[id]/+page.svelte`

Same redesign as create page, pre-populated with existing data.

### Step 13: Update Frontend Product List Page

**File:** `frontend/src/routes/(app)/master-data/products/+page.svelte`

Update the Variants column to show the count of option types and variants:
- e.g., "2 options, 6 variants" or "Single" for non-variant products

### Step 14: Update E2E Tests

**File:** `frontend/tests/e2e/master-data.spec.ts` or `products.spec.ts`

Update tests to:
- Remove any variant master data creation steps
- Test creating a product with option types and variant combinations
- Test editing product variants
- Test the "Generate All Combinations" feature

### Step 15: Update Backend Tests

**Delete:**
- `backend/internal/service/variant_test.go`

**Update:**
- `backend/internal/service/product_test.go` — test with new option_types/option_values structure
- `backend/internal/service/category_test.go` — remove variant-linking tests

### Step 16: Update Seed Data

**File:** `backend/cmd/seed/main.go`

If the seeder creates variant master data, remove that. If it creates products with variants, update to use the new option_types structure.

---

## Migration Safety Notes

1. **Data Loss Warning:** This migration drops `variants`, `variant_values`, `category_variants`, and `product_variant_values`. Any existing variant data in these tables will be lost. Since this is a development system, this is acceptable.

2. **stock_ledger is safe:** The `stock_ledger` table references `product_variants(id)`, not the variant master data. Since `product_variants` is kept, stock data is preserved.

3. **product_variants is safe:** The `product_variants` table itself is unchanged. Only the linking table (`product_variant_values` → `product_variant_options`) changes.

4. **Foreign key cascade:** `product_option_types` cascades on product delete. `product_option_values` cascades on option type delete. `product_variant_options` cascades on both product variant and option value delete.

---

## File Change Summary

### Files to DELETE
| File | Reason |
|---|---|
| `backend/internal/service/variant.go` | Old variant service |
| `backend/internal/service/variant_test.go` | Old variant tests |
| `backend/internal/handler/variant.go` | Old variant handler |
| `backend/sqlc/queries/variants.sql` | Old variant queries |
| `frontend/src/routes/(app)/settings/variants/` | Entire variant settings UI |

### Files to CREATE
| File | Purpose |
|---|---|
| `backend/migrations/000026_redesign_product_variants.up.sql` | New schema |
| `backend/migrations/000026_redesign_product_variants.down.sql` | Rollback |

### Files to MODIFY
| File | Changes |
|---|---|
| `backend/sqlc/queries/products.sql` | Add option type/value queries, remove old variant value queries |
| `backend/sqlc/queries/categories.sql` | Remove variant-related queries |
| `backend/internal/model/requests.go` | Remove variant types, add option types, modify product request |
| `backend/internal/model/responses.go` | Remove variant types, add option types, modify product/category response |
| `backend/internal/service/product.go` | New create/update/getByID logic with option types |
| `backend/internal/service/product_test.go` | Update tests for new structure |
| `backend/internal/service/category.go` | Remove UpdateVariants, remove variants from GetByID |
| `backend/internal/service/category_test.go` | Remove variant-linking tests |
| `backend/internal/handler/category.go` | Remove UpdateVariants handler |
| `backend/internal/handler/product.go` | Update request parsing (if needed) |
| `backend/internal/router/router.go` | Remove variant routes and category-variant route |
| `backend/cmd/seed/main.go` | Update seed data |
| `frontend/src/lib/api/types.ts` | Remove variant types, add option types |
| `frontend/src/lib/components/Sidebar.svelte` | Remove Variants nav item |
| `frontend/src/routes/(app)/settings/categories/+page.svelte` | Remove variant linking |
| `frontend/src/routes/(app)/settings/categories/[id]/+page.svelte` | Remove variant display |
| `frontend/src/routes/(app)/master-data/products/+page.svelte` | Update variants column display |
| `frontend/src/routes/(app)/master-data/products/create/+page.svelte` | New option types + variant combination UI |
| `frontend/src/routes/(app)/master-data/products/[id]/+page.svelte` | Same updates as create |
| `frontend/tests/e2e/products.spec.ts` | Update tests |
| `frontend/tests/e2e/master-data.spec.ts` | Update tests |

---

## Execution Order

1. **Migration** — Create migration files, run `make migrate-up`
2. **sqlc** — Update queries, delete old query file, run `make sqlc`
3. **Backend models** — Update request/response structs
4. **Backend services** — Delete variant service, update category & product services
5. **Backend handlers** — Delete variant handler, update category handler
6. **Backend router** — Remove old routes
7. **Backend tests** — Update/delete tests, run `make test-backend`
8. **Frontend types** — Update TypeScript interfaces
9. **Frontend pages** — Delete variant pages, update category & product pages, update sidebar
10. **Frontend tests** — Update E2E tests
11. **Seed data** — Update seeder
12. **Full test** — `make test` + `make test-e2e`
