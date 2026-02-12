-- name: CreateVariant :one
INSERT INTO variants (tenant_id, name, description)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('name'), sqlc.arg('description'))
RETURNING *;

-- name: GetVariantByID :one
SELECT * FROM variants
WHERE id = sqlc.arg('id');

-- name: GetVariantsByTenant :many
SELECT * FROM variants
WHERE tenant_id = sqlc.arg('tenant_id')
ORDER BY created_at ASC;

-- name: GetActiveVariantsByTenant :many
SELECT * FROM variants
WHERE tenant_id = sqlc.arg('tenant_id') AND is_active = TRUE
ORDER BY name ASC;

-- name: UpdateVariant :one
UPDATE variants
SET name = sqlc.arg('name'),
    description = sqlc.arg('description'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeactivateVariant :exec
UPDATE variants
SET is_active = FALSE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: CreateVariantValue :one
INSERT INTO variant_values (variant_id, value, sort_order)
VALUES (sqlc.arg('variant_id'), sqlc.arg('value'), sqlc.arg('sort_order'))
RETURNING *;

-- name: GetVariantValues :many
SELECT * FROM variant_values
WHERE variant_id = sqlc.arg('variant_id')
ORDER BY sort_order ASC, value ASC;

-- name: UpdateVariantValue :one
UPDATE variant_values
SET value = sqlc.arg('value'),
    sort_order = sqlc.arg('sort_order'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteVariantValue :exec
DELETE FROM variant_values
WHERE id = sqlc.arg('id');

-- name: DeleteVariantValuesByVariant :exec
DELETE FROM variant_values
WHERE variant_id = sqlc.arg('variant_id');
