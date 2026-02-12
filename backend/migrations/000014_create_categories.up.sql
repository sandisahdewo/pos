CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pricing_mode VARCHAR(50),
    markup_value NUMERIC(12,4),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name),
    CONSTRAINT chk_pricing_mode_markup CHECK (
        (pricing_mode IS NULL AND markup_value IS NULL) OR
        (pricing_mode IS NOT NULL AND markup_value IS NOT NULL)
    )
);

CREATE INDEX idx_categories_tenant_id ON categories (tenant_id);
