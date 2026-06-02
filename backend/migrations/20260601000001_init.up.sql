SET statement_timeout = 0;

--bun:split

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--bun:split

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    name          TEXT        NOT NULL,
    phone         TEXT        NOT NULL DEFAULT '',
    status        TEXT        NOT NULL DEFAULT 'active',
    joined_at     DATE        NOT NULL DEFAULT CURRENT_DATE,
    pin           TEXT        NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- PIN must be unique when set. Empty PIN is allowed for users who don't
-- operate the till (managers, accountants, etc.).
CREATE UNIQUE INDEX users_pin_unique ON users(pin) WHERE pin <> '';

--bun:split

CREATE TABLE roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    -- System roles can have description edited but name + permissions locked
    -- by the API (mirroring the frontend convention before integration).
    is_system   BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- Permission strings are application-level identifiers like 'menu.dashboard'
-- or the wildcard '*' (granted to admin). The string itself isn't FK'd to a
-- separate table — the catalog lives in the frontend at lib/auth/permissions.ts.
CREATE TABLE role_permissions (
    role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    PRIMARY KEY (role_id, permission)
);

--bun:split

CREATE TABLE user_roles (
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID        NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

--bun:split

CREATE TABLE units (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    code        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

CREATE TABLE suppliers (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL,
    contact_person TEXT        NOT NULL DEFAULT '',
    email          TEXT        NOT NULL DEFAULT '',
    phone          TEXT        NOT NULL DEFAULT '',
    address        TEXT        NOT NULL DEFAULT '',
    lead_time_days INTEGER     NOT NULL DEFAULT 0,
    status         TEXT        NOT NULL DEFAULT 'active',
    notes          TEXT        NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- Tax rates use a TEXT primary key (slug-style) because they're a small
-- closed set referenced by product / category seed data using well-known
-- identifiers (tax_ppn11, tax_exempt, tax_zero). Keeping the IDs stable
-- across reseeds avoids needing to rewrite product seed UUIDs.
CREATE TABLE tax_rates (
    id          TEXT        PRIMARY KEY,
    name        TEXT        NOT NULL,
    rate        NUMERIC(6,3) NOT NULL DEFAULT 0,
    description TEXT        NOT NULL DEFAULT '',
    is_default  BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- At most one default tax rate at a time. Partial unique index enforces it.
CREATE UNIQUE INDEX tax_rates_one_default ON tax_rates ((is_default)) WHERE is_default;

--bun:split

CREATE TABLE categories (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL,
    slug         TEXT        NOT NULL UNIQUE,
    description  TEXT        NOT NULL DEFAULT '',
    color        TEXT        NOT NULL DEFAULT 'neutral',
    -- Tax rate is optional at the category level — empty means inherit from
    -- the parent (walked at read time) or fall back to the default rate.
    tax_rate_id  TEXT        REFERENCES tax_rates(id) ON DELETE RESTRICT,
    parent_id    UUID        REFERENCES categories(id) ON DELETE RESTRICT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

CREATE INDEX categories_parent_idx ON categories(parent_id);

--bun:split

CREATE TABLE brands (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    description TEXT        NOT NULL DEFAULT '',
    image_url   TEXT        NOT NULL DEFAULT '',
    status      TEXT        NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

CREATE TABLE tags (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL UNIQUE,
    color          TEXT        NOT NULL DEFAULT 'neutral',
    public_visible BOOLEAN     NOT NULL DEFAULT true,
    description    TEXT        NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

CREATE TABLE locations (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT        NOT NULL,
    slug               TEXT        NOT NULL UNIQUE,
    kind               TEXT        NOT NULL DEFAULT 'shelf',
    customer_visible   BOOLEAN     NOT NULL DEFAULT false,
    is_default_receipt BOOLEAN     NOT NULL DEFAULT false,
    display_order      INTEGER     NOT NULL DEFAULT 0,
    description        TEXT        NOT NULL DEFAULT '',
    status             TEXT        NOT NULL DEFAULT 'active',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- At most one default-receipt location at a time. Partial unique index enforces it.
CREATE UNIQUE INDEX locations_one_default_receipt
    ON locations ((is_default_receipt))
    WHERE is_default_receipt;

--bun:split

-- Products: core scalar columns. Nested arrays (variants, packagings,
-- suppliers, prices, components, extras, attributes) live in child tables
-- with proper FK enforcement. Free-form metadata stays JSONB.
CREATE TABLE products (
    id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    sku                             TEXT          NOT NULL UNIQUE,
    name                            TEXT          NOT NULL,
    kind                            TEXT          NOT NULL DEFAULT 'goods',
    category_id                     UUID          REFERENCES categories(id) ON DELETE RESTRICT,
    unit_id                         UUID          REFERENCES units(id) ON DELETE RESTRICT,
    cost                            NUMERIC(14,2) NOT NULL DEFAULT 0,
    status                          TEXT          NOT NULL DEFAULT 'active',
    description                     TEXT          NOT NULL DEFAULT '',
    tax_rate_id                     TEXT          REFERENCES tax_rates(id) ON DELETE RESTRICT,
    brand_id                        UUID          REFERENCES brands(id) ON DELETE RESTRICT,
    tags                            TEXT[]        NOT NULL DEFAULT '{}',
    image_url                       TEXT          NOT NULL DEFAULT '',
    barcode                         TEXT          NOT NULL DEFAULT '',
    metadata                        JSONB         NOT NULL DEFAULT '{}'::jsonb,
    requires_batch_label            BOOLEAN       NOT NULL DEFAULT false,
    requires_expiration             BOOLEAN       NOT NULL DEFAULT false,
    bpom_number                     TEXT          NOT NULL DEFAULT '',
    halal_cert_number               TEXT          NOT NULL DEFAULT '',
    warranty_months                 INTEGER,
    markup_cost_source              TEXT          NOT NULL DEFAULT 'manual',
    production_mode                 TEXT,
    shelf_life_after_production_hrs INTEGER,
    created_at                      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

--bun:split

CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_brand_idx    ON products(brand_id);
CREATE INDEX products_status_idx   ON products(status);

--bun:split

-- product_attributes: variant axes (e.g., Color: [Red, Blue]). Values stays
-- TEXT[] because it's a flat ordered list, not a relationship.
CREATE TABLE product_attributes (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    values     TEXT[]      NOT NULL DEFAULT '{}',
    position   INTEGER     NOT NULL DEFAULT 0,
    UNIQUE (product_id, name)
);

CREATE INDEX product_attributes_product_idx ON product_attributes(product_id);

--bun:split

-- product_variants: concrete combinations of attribute values.
-- `values` stays JSONB ({Color: 'Red', Size: 'M'}) — it's a small map keyed
-- by attribute name and doesn't warrant its own join table.
-- SKU is unique across the whole catalog (matches frontend expectation).
CREATE TABLE product_variants (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name            TEXT          NOT NULL DEFAULT '',
    sku             TEXT          NOT NULL UNIQUE,
    cost            NUMERIC(14,2) NOT NULL DEFAULT 0,
    barcode         TEXT          NOT NULL DEFAULT '',
    image_url       TEXT          NOT NULL DEFAULT '',
    values          JSONB         NOT NULL DEFAULT '{}'::jsonb,
    production_mode TEXT,
    position        INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX product_variants_product_idx ON product_variants(product_id);
CREATE INDEX product_variants_barcode_idx ON product_variants(barcode) WHERE barcode <> '';

--bun:split

CREATE TABLE product_packagings (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_id    UUID          NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    factor     NUMERIC(14,4) NOT NULL,
    barcode    TEXT          NOT NULL DEFAULT '',
    position   INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX product_packagings_product_idx ON product_packagings(product_id);
CREATE INDEX product_packagings_barcode_idx ON product_packagings(barcode) WHERE barcode <> '';

--bun:split

CREATE TABLE product_suppliers (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id     UUID          NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    is_primary      BOOLEAN       NOT NULL DEFAULT false,
    unit_cost       NUMERIC(14,2) NOT NULL DEFAULT 0,
    lead_time_days  INTEGER,
    supplier_sku    TEXT          NOT NULL DEFAULT '',
    min_order_qty   NUMERIC(14,4),
    notes           TEXT          NOT NULL DEFAULT '',
    UNIQUE (product_id, supplier_id)
);

-- At most one primary supplier per product. Partial unique enforces it.
CREATE UNIQUE INDEX product_suppliers_one_primary
    ON product_suppliers(product_id)
    WHERE is_primary;

CREATE INDEX product_suppliers_supplier_idx ON product_suppliers(supplier_id);

--bun:split

-- product_extras: optional add-ons (extra shot, upgrade, etc.). Each extra
-- can have its own recipe (rows in product_components with extra_id set).
CREATE TABLE product_extras (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name        TEXT          NOT NULL,
    price_delta NUMERIC(14,2) NOT NULL DEFAULT 0,
    position    INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX product_extras_product_idx ON product_extras(product_id);

--bun:split

-- product_prices: a pricing entry can attach at three scopes via discriminators:
--   - product-level     (variant_id IS NULL, packaging_id IS NULL)
--   - variant-level     (variant_id IS NOT NULL, packaging_id IS NULL)
--   - packaging-level   (variant_id IS NULL,    packaging_id IS NOT NULL)
-- CHECK enforces at most one of the two pointers is set.
CREATE TABLE product_prices (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id    UUID          REFERENCES product_variants(id) ON DELETE CASCADE,
    packaging_id  UUID          REFERENCES product_packagings(id) ON DELETE CASCADE,
    -- Pricelists not yet a real table; store the frontend slug ('pl_retail') for now.
    pricelist_id  TEXT          NOT NULL,
    pricing_kind  TEXT          NOT NULL,
    pricing_value NUMERIC(14,4) NOT NULL DEFAULT 0,
    CHECK (NOT (variant_id IS NOT NULL AND packaging_id IS NOT NULL))
);

CREATE INDEX product_prices_product_idx ON product_prices(product_id);
CREATE INDEX product_prices_variant_idx ON product_prices(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX product_prices_packaging_idx ON product_prices(packaging_id) WHERE packaging_id IS NOT NULL;

--bun:split

CREATE TABLE product_price_tiers (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    price_id      UUID          NOT NULL REFERENCES product_prices(id) ON DELETE CASCADE,
    min_qty       NUMERIC(14,4) NOT NULL,
    pricing_kind  TEXT          NOT NULL,
    pricing_value NUMERIC(14,4) NOT NULL DEFAULT 0
);

CREATE INDEX product_price_tiers_price_idx ON product_price_tiers(price_id);

--bun:split

-- product_components: recipe entries for composite products + extras.
-- The "parent" can be three things; at most one of the parent pointers is set:
--   - product-level recipe  (parent_variant_id IS NULL, extra_id IS NULL)
--   - variant-level recipe  (parent_variant_id IS NOT NULL, extra_id IS NULL)
--   - extra-attached recipe (parent_variant_id IS NULL,    extra_id IS NOT NULL)
-- product_id always points to the composite parent product (denormalized
-- shortcut so DELETE CASCADE flows from the parent product).
CREATE TABLE product_components (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id           UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    parent_variant_id    UUID          REFERENCES product_variants(id) ON DELETE CASCADE,
    extra_id             UUID          REFERENCES product_extras(id) ON DELETE CASCADE,
    component_product_id UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    component_variant_id UUID          REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity             NUMERIC(14,4) NOT NULL,
    unit_id              UUID          REFERENCES units(id) ON DELETE RESTRICT,
    unit_factor          NUMERIC(14,4),
    position             INTEGER       NOT NULL DEFAULT 0,
    CHECK (NOT (parent_variant_id IS NOT NULL AND extra_id IS NOT NULL))
);

CREATE INDEX product_components_product_idx ON product_components(product_id);
CREATE INDEX product_components_component_idx ON product_components(component_product_id);
