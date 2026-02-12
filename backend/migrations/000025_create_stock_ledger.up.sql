CREATE TYPE stock_reason AS ENUM ('purchase_delivery', 'sale', 'adjustment', 'transfer_in', 'transfer_out');

CREATE TABLE stock_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    quantity NUMERIC(12,4) NOT NULL,
    unit_id UUID NOT NULL REFERENCES units(id),
    reason stock_reason NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_ledger_variant_warehouse ON stock_ledger(product_variant_id, warehouse_id);
CREATE INDEX idx_stock_ledger_reference ON stock_ledger(reference_type, reference_id);
CREATE INDEX idx_stock_ledger_created ON stock_ledger(created_at);
