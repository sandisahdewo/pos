-- name: CreateInvitation :one
INSERT INTO invitations (tenant_id, invited_by, email, role_id, store_ids, token_hash, status, expires_at)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('invited_by'), sqlc.arg('email'), sqlc.arg('role_id'), sqlc.arg('store_ids'), sqlc.arg('token_hash'), 'pending', sqlc.arg('expires_at'))
RETURNING *;

-- name: GetInvitationByID :one
SELECT * FROM invitations
WHERE id = sqlc.arg('id');

-- name: GetInvitationByTokenHash :one
SELECT * FROM invitations
WHERE token_hash = sqlc.arg('token_hash');

-- name: GetInvitationsByTenant :many
SELECT * FROM invitations
WHERE tenant_id = sqlc.arg('tenant_id')
ORDER BY created_at DESC;

-- name: GetInvitationsByEmail :many
SELECT * FROM invitations
WHERE email = sqlc.arg('email')
ORDER BY created_at DESC;

-- name: UpdateInvitationStatus :exec
UPDATE invitations
SET status = sqlc.arg('status'),
    updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: DeleteInvitation :exec
DELETE FROM invitations
WHERE id = sqlc.arg('id');
