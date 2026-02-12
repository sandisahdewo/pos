-- Enums
CREATE TYPE sell_method AS ENUM ('fifo', 'lifo');
CREATE TYPE product_status AS ENUM ('active', 'inactive');

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    has_variants BOOLEAN NOT NULL DEFAULT FALSE,
    sell_method sell_method NOT NULL DEFAULT 'fifo',
    status product_status NOT NULL DEFAULT 'active',
    tax_rate NUMERIC(5,2) DEFAULT 0,
    discount_rate NUMERIC(5,2) DEFAULT 0,
    min_quantity NUMERIC(12,4),
    max_quantity NUMERIC(12,4),
    pricing_mode VARCHAR(50),
    markup_value NUMERIC(12,4),
    fixed_price NUMERIC(12,4),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);
