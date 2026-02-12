-- name: CreateSupplier :one
INSERT INTO suppliers (tenant_id, name, contact_name, email, phone, address)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('name'), sqlc.arg('contact_name'), sqlc.arg('email'), sqlc.arg('phone'), sqlc.arg('address'))
RETURNING *;

-- name: GetSupplierByID :one
SELECT * FROM suppliers
WHERE id = sqlc.arg('id');

-- name: GetSuppliersByTenant :many
SELECT * FROM suppliers
WHERE tenant_id = sqlc.arg('tenant_id')
ORDER BY created_at ASC;

-- name: GetActiveSuppliersByTenant :many
SELECT * FROM suppliers
WHERE tenant_id = sqlc.arg('tenant_id') AND is_active = TRUE
ORDER BY name ASC;

-- name: UpdateSupplier :one
UPDATE suppliers
SET name = sqlc.arg('name'),
    contact_name = sqlc.arg('contact_name'),
    email = sqlc.arg('email'),
    phone = sqlc.arg('phone'),
    address = sqlc.arg('address'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeactivateSupplier :exec
UPDATE suppliers
SET is_active = FALSE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');
