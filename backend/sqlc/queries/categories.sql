-- name: CreateCategory :one
INSERT INTO categories (tenant_id, name, description, pricing_mode, markup_value)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('name'), sqlc.arg('description'), sqlc.arg('pricing_mode'), sqlc.arg('markup_value'))
RETURNING *;

-- name: GetCategoryByID :one
SELECT * FROM categories
WHERE id = sqlc.arg('id');

-- name: GetCategoriesByTenant :many
SELECT * FROM categories
WHERE tenant_id = sqlc.arg('tenant_id')
ORDER BY created_at ASC;

-- name: GetActiveCategoriesByTenant :many
SELECT * FROM categories
WHERE tenant_id = sqlc.arg('tenant_id') AND is_active = TRUE
ORDER BY name ASC;

-- name: UpdateCategory :one
UPDATE categories
SET name = sqlc.arg('name'),
    description = sqlc.arg('description'),
    pricing_mode = sqlc.arg('pricing_mode'),
    markup_value = sqlc.arg('markup_value'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeactivateCategory :exec
UPDATE categories
SET is_active = FALSE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: AddCategoryUnit :exec
INSERT INTO category_units (category_id, unit_id)
VALUES (sqlc.arg('category_id'), sqlc.arg('unit_id'))
ON CONFLICT (category_id, unit_id) DO NOTHING;

-- name: RemoveCategoryUnit :exec
DELETE FROM category_units
WHERE category_id = sqlc.arg('category_id') AND unit_id = sqlc.arg('unit_id');

-- name: DeleteCategoryUnits :exec
DELETE FROM category_units
WHERE category_id = sqlc.arg('category_id');

-- name: GetCategoryUnits :many
SELECT u.* FROM units u
INNER JOIN category_units cu ON cu.unit_id = u.id
WHERE cu.category_id = sqlc.arg('category_id')
ORDER BY u.name ASC;

-- name: AddCategoryVariant :exec
INSERT INTO category_variants (category_id, variant_id)
VALUES (sqlc.arg('category_id'), sqlc.arg('variant_id'))
ON CONFLICT (category_id, variant_id) DO NOTHING;

-- name: RemoveCategoryVariant :exec
DELETE FROM category_variants
WHERE category_id = sqlc.arg('category_id') AND variant_id = sqlc.arg('variant_id');

-- name: DeleteCategoryVariants :exec
DELETE FROM category_variants
WHERE category_id = sqlc.arg('category_id');

-- name: GetCategoryVariants :many
SELECT v.* FROM variants v
INNER JOIN category_variants cv ON cv.variant_id = v.id
WHERE cv.category_id = sqlc.arg('category_id')
ORDER BY v.name ASC;
