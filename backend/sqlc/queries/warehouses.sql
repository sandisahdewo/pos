-- name: CreateWarehouse :one
INSERT INTO warehouses (tenant_id, name, address, phone)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('name'), sqlc.arg('address'), sqlc.arg('phone'))
RETURNING *;

-- name: GetWarehouseByID :one
SELECT * FROM warehouses
WHERE id = sqlc.arg('id');

-- name: GetWarehousesByTenant :many
SELECT * FROM warehouses
WHERE tenant_id = sqlc.arg('tenant_id')
ORDER BY created_at ASC;

-- name: GetActiveWarehousesByTenant :many
SELECT * FROM warehouses
WHERE tenant_id = sqlc.arg('tenant_id') AND is_active = TRUE
ORDER BY name ASC;

-- name: UpdateWarehouse :one
UPDATE warehouses
SET name = sqlc.arg('name'),
    address = sqlc.arg('address'),
    phone = sqlc.arg('phone'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeactivateWarehouse :exec
UPDATE warehouses
SET is_active = FALSE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');
