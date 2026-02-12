-- name: CreateUnit :one
INSERT INTO units (tenant_id, name, description)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('name'), sqlc.arg('description'))
RETURNING *;

-- name: GetUnitByID :one
SELECT * FROM units
WHERE id = sqlc.arg('id');

-- name: GetUnitsByTenant :many
SELECT * FROM units
WHERE tenant_id = sqlc.arg('tenant_id')
ORDER BY created_at ASC;

-- name: GetActiveUnitsByTenant :many
SELECT * FROM units
WHERE tenant_id = sqlc.arg('tenant_id') AND is_active = TRUE
ORDER BY name ASC;

-- name: UpdateUnit :one
UPDATE units
SET name = sqlc.arg('name'),
    description = sqlc.arg('description'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeactivateUnit :exec
UPDATE units
SET is_active = FALSE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');
