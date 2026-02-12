CREATE TABLE price_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    min_quantity INTEGER NOT NULL,
    price NUMERIC(12,4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_price_tier_target CHECK (
        (product_id IS NOT NULL AND product_variant_id IS NULL) OR
        (product_id IS NULL AND product_variant_id IS NOT NULL)
    )
);
