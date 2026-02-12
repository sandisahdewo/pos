-- name: CreateProduct :one
INSERT INTO products (tenant_id, category_id, name, description, has_variants, sell_method, status, tax_rate, discount_rate, min_quantity, max_quantity, pricing_mode, markup_value, fixed_price)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('category_id'), sqlc.arg('name'), sqlc.arg('description'), sqlc.arg('has_variants'), sqlc.arg('sell_method'), sqlc.arg('status'), sqlc.arg('tax_rate'), sqlc.arg('discount_rate'), sqlc.arg('min_quantity'), sqlc.arg('max_quantity'), sqlc.arg('pricing_mode'), sqlc.arg('markup_value'), sqlc.arg('fixed_price'))
RETURNING *;

-- name: GetProductByID :one
SELECT p.*, c.name AS category_name
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.id = sqlc.arg('id');

-- name: GetProductsByTenant :many
SELECT p.*, c.name AS category_name
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.tenant_id = sqlc.arg('tenant_id')
ORDER BY p.created_at DESC
LIMIT sqlc.arg('limit_val') OFFSET sqlc.arg('offset_val');

-- name: CountProductsByTenant :one
SELECT COUNT(*) FROM products
WHERE tenant_id = sqlc.arg('tenant_id');

-- name: GetProductsByTenantAndCategory :many
SELECT p.*, c.name AS category_name
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.tenant_id = sqlc.arg('tenant_id') AND p.category_id = sqlc.arg('category_id')
ORDER BY p.created_at DESC
LIMIT sqlc.arg('limit_val') OFFSET sqlc.arg('offset_val');

-- name: CountProductsByTenantAndCategory :one
SELECT COUNT(*) FROM products
WHERE tenant_id = sqlc.arg('tenant_id') AND category_id = sqlc.arg('category_id');

-- name: UpdateProduct :one
UPDATE products
SET name = sqlc.arg('name'),
    description = sqlc.arg('description'),
    category_id = sqlc.arg('category_id'),
    has_variants = sqlc.arg('has_variants'),
    sell_method = sqlc.arg('sell_method'),
    status = sqlc.arg('status'),
    tax_rate = sqlc.arg('tax_rate'),
    discount_rate = sqlc.arg('discount_rate'),
    min_quantity = sqlc.arg('min_quantity'),
    max_quantity = sqlc.arg('max_quantity'),
    pricing_mode = sqlc.arg('pricing_mode'),
    markup_value = sqlc.arg('markup_value'),
    fixed_price = sqlc.arg('fixed_price'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeactivateProduct :exec
UPDATE products
SET status = 'inactive', is_active = FALSE, updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: CreateProductVariant :one
INSERT INTO product_variants (product_id, sku, barcode, unit_id, retail_price)
VALUES (sqlc.arg('product_id'), sqlc.arg('sku'), sqlc.arg('barcode'), sqlc.arg('unit_id'), sqlc.arg('retail_price'))
RETURNING *;

-- name: GetProductVariants :many
SELECT pv.*, u.name AS unit_name
FROM product_variants pv
JOIN units u ON u.id = pv.unit_id
WHERE pv.product_id = sqlc.arg('product_id')
ORDER BY pv.created_at ASC;

-- name: UpdateProductVariant :one
UPDATE product_variants
SET sku = sqlc.arg('sku'),
    barcode = sqlc.arg('barcode'),
    unit_id = sqlc.arg('unit_id'),
    retail_price = sqlc.arg('retail_price'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteProductVariantsByProduct :exec
DELETE FROM product_variants WHERE product_id = sqlc.arg('product_id');

-- name: CreateProductVariantValue :exec
INSERT INTO product_variant_values (product_variant_id, variant_value_id)
VALUES (sqlc.arg('product_variant_id'), sqlc.arg('variant_value_id'));

-- name: GetProductVariantValues :many
SELECT pvv.*, vv.value, v.id AS variant_id, v.name AS variant_name
FROM product_variant_values pvv
JOIN variant_values vv ON vv.id = pvv.variant_value_id
JOIN variants v ON v.id = vv.variant_id
WHERE pvv.product_variant_id = sqlc.arg('product_variant_id')
ORDER BY v.name ASC;

-- name: DeleteProductVariantValues :exec
DELETE FROM product_variant_values WHERE product_variant_id = sqlc.arg('product_variant_id');

-- name: CreateProductImage :one
INSERT INTO product_images (product_id, image_url, sort_order)
VALUES (sqlc.arg('product_id'), sqlc.arg('image_url'), sqlc.arg('sort_order'))
RETURNING *;

-- name: GetProductImages :many
SELECT * FROM product_images
WHERE product_id = sqlc.arg('product_id')
ORDER BY sort_order ASC;

-- name: DeleteProductImage :exec
DELETE FROM product_images WHERE id = sqlc.arg('id');

-- name: DeleteProductImagesByProduct :exec
DELETE FROM product_images WHERE product_id = sqlc.arg('product_id');

-- name: CreateProductVariantImage :one
INSERT INTO product_variant_images (product_variant_id, image_url, sort_order)
VALUES (sqlc.arg('product_variant_id'), sqlc.arg('image_url'), sqlc.arg('sort_order'))
RETURNING *;

-- name: GetProductVariantImages :many
SELECT * FROM product_variant_images
WHERE product_variant_id = sqlc.arg('product_variant_id')
ORDER BY sort_order ASC;

-- name: CreatePriceTier :one
INSERT INTO price_tiers (product_id, product_variant_id, min_quantity, price)
VALUES (sqlc.arg('product_id'), sqlc.arg('product_variant_id'), sqlc.arg('min_quantity'), sqlc.arg('price'))
RETURNING *;

-- name: GetPriceTiersByProduct :many
SELECT * FROM price_tiers
WHERE product_id = sqlc.arg('product_id')
ORDER BY min_quantity ASC;

-- name: GetPriceTiersByVariant :many
SELECT * FROM price_tiers
WHERE product_variant_id = sqlc.arg('product_variant_id')
ORDER BY min_quantity ASC;

-- name: DeletePriceTiersByProduct :exec
DELETE FROM price_tiers WHERE product_id = sqlc.arg('product_id');

-- name: DeletePriceTiersByVariant :exec
DELETE FROM price_tiers WHERE product_variant_id = sqlc.arg('product_variant_id');
