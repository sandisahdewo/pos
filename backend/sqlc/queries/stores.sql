-- name: CreateStore :one
INSERT INTO stores (tenant_id, name, address, phone)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('name'), sqlc.arg('address'), sqlc.arg('phone'))
RETURNING *;

-- name: GetStoreByID :one
SELECT * FROM stores
WHERE id = sqlc.arg('id');

-- name: GetStoresByTenant :many
SELECT * FROM stores
WHERE tenant_id = sqlc.arg('tenant_id')
ORDER BY created_at ASC;

-- name: UpdateStore :one
UPDATE stores
SET name = sqlc.arg('name'),
    address = sqlc.arg('address'),
    phone = sqlc.arg('phone'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeactivateStore :exec
UPDATE stores
SET is_active = FALSE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: AssignUserStore :one
INSERT INTO user_stores (user_id, store_id, assigned_by)
VALUES (sqlc.arg('user_id'), sqlc.arg('store_id'), sqlc.arg('assigned_by'))
ON CONFLICT (user_id, store_id) DO NOTHING
RETURNING *;

-- name: UnassignUserStore :exec
DELETE FROM user_stores
WHERE user_id = sqlc.arg('user_id') AND store_id = sqlc.arg('store_id');

-- name: GetUserStores :many
SELECT s.* FROM stores s
INNER JOIN user_stores us ON us.store_id = s.id
WHERE us.user_id = sqlc.arg('user_id')
ORDER BY s.created_at ASC;

-- name: GetUserStoreIDs :many
SELECT store_id FROM user_stores
WHERE user_id = sqlc.arg('user_id');

-- name: DeleteUserStoresByUser :exec
DELETE FROM user_stores
WHERE user_id = sqlc.arg('user_id');
