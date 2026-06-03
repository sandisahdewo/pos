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

--bun:split

-- Purchase orders. Header table; lines and payments live in child tables.
-- Code is generated server-side as PO-YYYY-NNN with NNN being the count of
-- POs created this year + 1, padded to 3 digits. Slight race possible at
-- high concurrency — handler retries on UNIQUE violation.
CREATE TABLE purchase_orders (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT          NOT NULL UNIQUE,
    type          TEXT          NOT NULL DEFAULT 'standard',
    supplier_id   UUID          NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    status        TEXT          NOT NULL DEFAULT 'draft',
    order_date    TEXT          NOT NULL DEFAULT '',
    expected_date TEXT          NOT NULL DEFAULT '',
    received_date TEXT          NOT NULL DEFAULT '',
    paid_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes         TEXT          NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX purchase_orders_supplier_idx ON purchase_orders(supplier_id);
CREATE INDEX purchase_orders_status_idx   ON purchase_orders(status);
CREATE INDEX purchase_orders_order_date_idx ON purchase_orders(order_date);

--bun:split

CREATE TABLE purchase_order_lines (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id        UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id        UUID          REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity          NUMERIC(14,4) NOT NULL,
    received_qty      NUMERIC(14,4) NOT NULL DEFAULT 0,
    -- unit_id is the chosen unit for this line — base unit OR a packaging
    -- unit. Snapshot factor at PO time in case packaging factor later changes.
    unit_id           UUID          REFERENCES units(id) ON DELETE RESTRICT,
    unit_factor       NUMERIC(14,4) NOT NULL DEFAULT 1,
    unit_price        NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes             TEXT          NOT NULL DEFAULT '',
    position          INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX purchase_order_lines_po_idx ON purchase_order_lines(purchase_order_id);
CREATE INDEX purchase_order_lines_product_idx ON purchase_order_lines(product_id);

--bun:split

CREATE TABLE purchase_order_payments (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    amount            NUMERIC(14,2) NOT NULL,
    method            TEXT          NOT NULL DEFAULT 'cash',
    paid_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    notes             TEXT          NOT NULL DEFAULT ''
);

CREATE INDEX purchase_order_payments_po_idx ON purchase_order_payments(purchase_order_id);

--bun:split

-- Shift templates: reusable shift definitions (Pagi 06–14, Sore 14–22, etc.).
-- Times stored as TEXT "HH:MM" so the API and frontend can stay in lockstep.
CREATE TABLE shift_templates (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    start_time TEXT        NOT NULL DEFAULT '00:00',
    end_time   TEXT        NOT NULL DEFAULT '00:00',
    notes      TEXT        NOT NULL DEFAULT '',
    status     TEXT        NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--bun:split

-- Shift sessions: an actual shift opened by an employee (open → closed/cancelled).
-- opening_cash / closing_cash are small {total, denominations?[]} objects —
-- stored as JSONB to avoid two extra tables for what is a single read.
CREATE TABLE shift_sessions (
    id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code                  TEXT          NOT NULL UNIQUE,
    employee_id           UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    template_id           UUID          REFERENCES shift_templates(id) ON DELETE SET NULL,
    opened_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    closed_at             TIMESTAMPTZ,
    status                TEXT          NOT NULL DEFAULT 'open',
    opening_cash          JSONB         NOT NULL DEFAULT '{"total":0}'::jsonb,
    closing_cash          JSONB,
    expected_closing_cash NUMERIC(14,2),
    variance              NUMERIC(14,2),
    notes                 TEXT          NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX shift_sessions_employee_idx ON shift_sessions(employee_id);
CREATE INDEX shift_sessions_status_idx   ON shift_sessions(status);
-- At most one open shift across the till at any given time.
CREATE UNIQUE INDEX shift_sessions_one_open ON shift_sessions((status)) WHERE status = 'open';

--bun:split

-- Cash-in / cash-out entries that happened during a shift. Append-mostly; FK
-- cascade on shift_session delete.
CREATE TABLE shift_cash_entries (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_session_id UUID          NOT NULL REFERENCES shift_sessions(id) ON DELETE CASCADE,
    happened_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    kind             TEXT          NOT NULL,
    category         TEXT          NOT NULL DEFAULT 'lain',
    amount           NUMERIC(14,2) NOT NULL,
    notes            TEXT          NOT NULL DEFAULT '',
    performed_by     TEXT          NOT NULL DEFAULT '',
    position         INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX shift_cash_entries_session_idx ON shift_cash_entries(shift_session_id);

--bun:split

-- Shift assignments: planned schedule. Pairs (template, employee) on a date.
-- actual_shift_id is populated once the planned slot is fulfilled by an
-- opened session — kept as a soft link (SET NULL on session delete) so the
-- schedule isn't lost if the session row is purged.
CREATE TABLE shift_assignments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    date            TEXT        NOT NULL,
    template_id     UUID        NOT NULL REFERENCES shift_templates(id) ON DELETE RESTRICT,
    employee_id     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes           TEXT        NOT NULL DEFAULT '',
    status          TEXT        NOT NULL DEFAULT 'planned',
    actual_shift_id UUID        REFERENCES shift_sessions(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (date, template_id, employee_id)
);

CREATE INDEX shift_assignments_date_idx ON shift_assignments(date);
CREATE INDEX shift_assignments_employee_idx ON shift_assignments(employee_id);

--bun:split

-- Pricelists use TEXT PK (slug) — referenced by product seed via
-- well-known IDs ('pl_retail', 'pl_wholesale', 'pl_vip'). Same rationale as
-- tax_rates: small closed set with stable identifiers.
CREATE TABLE pricelists (
    id          TEXT        PRIMARY KEY,
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    is_default  BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pricelists_one_default ON pricelists((is_default)) WHERE is_default;

--bun:split

CREATE TABLE customers (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL,
    type           TEXT        NOT NULL DEFAULT 'individual',
    email          TEXT        NOT NULL DEFAULT '',
    phone          TEXT        NOT NULL DEFAULT '',
    address        TEXT        NOT NULL DEFAULT '',
    pricelist_id   TEXT        REFERENCES pricelists(id) ON DELETE RESTRICT,
    tax_id         TEXT        NOT NULL DEFAULT '',
    status         TEXT        NOT NULL DEFAULT 'active',
    credit_allowed BOOLEAN     NOT NULL DEFAULT false,
    notes          TEXT        NOT NULL DEFAULT '',
    joined_at      TEXT        NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customers_pricelist_idx ON customers(pricelist_id);

--bun:split

-- Orders: POS sales. Header + lines + payments. JSONB columns hold
-- per-sale snapshots that aren't query targets:
--   - orders.applied_promos: which promos triggered, snapshotted at sale
--   - order_lines.extras: which extras were picked + their snapshotted prices
--   - order_lines.batch_allocations: which batches got drawn down
-- service_type / table_number are F&B-only fields (null for retail).
CREATE TABLE orders (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT          NOT NULL UNIQUE,
    pricelist_id    TEXT          REFERENCES pricelists(id) ON DELETE RESTRICT,
    customer_id     UUID          REFERENCES customers(id) ON DELETE SET NULL,
    employee_id     UUID          REFERENCES users(id) ON DELETE SET NULL,
    shift_id        UUID          REFERENCES shift_sessions(id) ON DELETE SET NULL,
    payment_method  TEXT          NOT NULL DEFAULT 'cash',
    applied_promos  JSONB         NOT NULL DEFAULT '[]'::jsonb,
    promo_discount  NUMERIC(14,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_subtotal    NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
    total           NUMERIC(14,2) NOT NULL DEFAULT 0,
    paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    status          TEXT          NOT NULL DEFAULT 'paid',
    notes           TEXT          NOT NULL DEFAULT '',
    service_type    TEXT,
    table_number    TEXT          NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX orders_customer_idx   ON orders(customer_id);
CREATE INDEX orders_employee_idx   ON orders(employee_id);
CREATE INDEX orders_shift_idx      ON orders(shift_id);
CREATE INDEX orders_status_idx     ON orders(status);
CREATE INDEX orders_created_at_idx ON orders(created_at DESC);

--bun:split

CREATE TABLE order_lines (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id          UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id          UUID          REFERENCES product_variants(id) ON DELETE RESTRICT,
    product_name        TEXT          NOT NULL,
    variant_name        TEXT          NOT NULL DEFAULT '',
    unit_id             UUID          REFERENCES units(id) ON DELETE RESTRICT,
    unit_factor         NUMERIC(14,4) NOT NULL DEFAULT 1,
    unit_code           TEXT          NOT NULL DEFAULT '',
    quantity            NUMERIC(14,4) NOT NULL,
    unit_price          NUMERIC(14,2) NOT NULL DEFAULT 0,
    extras              JSONB         NOT NULL DEFAULT '[]'::jsonb,
    tax_rate_pct        NUMERIC(6,3)  NOT NULL DEFAULT 0,
    line_subtotal       NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_promo_discount NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_subtotal_net   NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_tax            NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_total          NUMERIC(14,2) NOT NULL DEFAULT 0,
    batch_allocations   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    position            INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX order_lines_order_idx   ON order_lines(order_id);
CREATE INDEX order_lines_product_idx ON order_lines(product_id);

--bun:split

CREATE TABLE order_payments (
    id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id  UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount    NUMERIC(14,2) NOT NULL,
    method    TEXT          NOT NULL DEFAULT 'cash',
    paid_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    notes     TEXT          NOT NULL DEFAULT ''
);

CREATE INDEX order_payments_order_idx ON order_payments(order_id);

--bun:split

-- batches: FIFO-tracked stock lots. Each lot carries cost + ownership +
-- source PO reference + location. qty_remaining decrements on sale, move,
-- return-to-consignor, or manual adjust-out. expires_at is TEXT (YYYY-MM-DD
-- or '') consistent with frontend date conventions.
CREATE TABLE batches (
    id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code                            TEXT          NOT NULL UNIQUE,
    product_id                      UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id                      UUID          REFERENCES product_variants(id) ON DELETE RESTRICT,
    ownership                       TEXT          NOT NULL DEFAULT 'owned',
    supplier_id                     UUID          REFERENCES suppliers(id) ON DELETE SET NULL,
    source_purchase_order_id        UUID          REFERENCES purchase_orders(id) ON DELETE SET NULL,
    source_purchase_order_line_id   UUID          REFERENCES purchase_order_lines(id) ON DELETE SET NULL,
    unit_cost                       NUMERIC(14,2) NOT NULL DEFAULT 0,
    qty_received                    NUMERIC(14,4) NOT NULL,
    qty_remaining                   NUMERIC(14,4) NOT NULL,
    received_at                     TEXT          NOT NULL DEFAULT '',
    expires_at                      TEXT          NOT NULL DEFAULT '',
    location_id                     UUID          NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    notes                           TEXT          NOT NULL DEFAULT '',
    created_at                      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX batches_product_idx   ON batches(product_id);
CREATE INDEX batches_variant_idx   ON batches(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX batches_location_idx  ON batches(location_id);
CREATE INDEX batches_supplier_idx  ON batches(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX batches_source_po_idx ON batches(source_purchase_order_id)
    WHERE source_purchase_order_id IS NOT NULL;
-- FIFO walk index — (product, variant, expires_at, received_at) only for
-- rows with stock left.
CREATE INDEX batches_fifo_idx ON batches(product_id, variant_id, expires_at, received_at)
    WHERE qty_remaining > 0;

--bun:split

-- stock_movements: append-only audit log. Every batch mutation that affects
-- qty_remaining (sale / cancel / adjust / move / return / production) gets
-- one row. reference is small JSONB ({kind, id, code?}).
CREATE TABLE stock_movements (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code         TEXT          NOT NULL UNIQUE,
    happened_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    kind         TEXT          NOT NULL,
    product_id   UUID          REFERENCES products(id) ON DELETE SET NULL,
    variant_id   UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
    location_id  UUID          REFERENCES locations(id) ON DELETE SET NULL,
    batch_id     UUID          REFERENCES batches(id) ON DELETE SET NULL,
    qty_delta    NUMERIC(14,4) NOT NULL,
    qty_after    NUMERIC(14,4) NOT NULL DEFAULT 0,
    unit_cost    NUMERIC(14,2),
    reference    JSONB         NOT NULL DEFAULT '{}'::jsonb,
    reason       TEXT,
    image_url    TEXT          NOT NULL DEFAULT '',
    performed_by TEXT          NOT NULL DEFAULT '',
    notes        TEXT          NOT NULL DEFAULT ''
);

CREATE INDEX stock_movements_product_idx  ON stock_movements(product_id);
CREATE INDEX stock_movements_batch_idx    ON stock_movements(batch_id);
CREATE INDEX stock_movements_location_idx ON stock_movements(location_id);
CREATE INDEX stock_movements_at_idx       ON stock_movements(happened_at DESC);
