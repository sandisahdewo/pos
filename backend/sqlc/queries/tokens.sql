-- Refresh tokens

-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES (sqlc.arg('user_id'), sqlc.arg('token_hash'), sqlc.arg('expires_at'))
RETURNING *;

-- name: GetRefreshTokenByHash :one
SELECT * FROM refresh_tokens
WHERE token_hash = sqlc.arg('token_hash');

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens
SET revoked = TRUE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: RevokeAllUserRefreshTokens :exec
UPDATE refresh_tokens
SET revoked = TRUE,
    updated_at = NOW()
WHERE user_id = sqlc.arg('user_id');

-- Email verifications

-- name: CreateEmailVerification :one
INSERT INTO email_verifications (user_id, token_hash, expires_at)
VALUES (sqlc.arg('user_id'), sqlc.arg('token_hash'), sqlc.arg('expires_at'))
RETURNING *;

-- name: GetEmailVerificationByHash :one
SELECT * FROM email_verifications
WHERE token_hash = sqlc.arg('token_hash');

-- name: MarkEmailVerificationUsed :exec
UPDATE email_verifications
SET is_used = TRUE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');

-- Password resets

-- name: CreatePasswordReset :one
INSERT INTO password_resets (user_id, token_hash, expires_at)
VALUES (sqlc.arg('user_id'), sqlc.arg('token_hash'), sqlc.arg('expires_at'))
RETURNING *;

-- name: GetPasswordResetByHash :one
SELECT * FROM password_resets
WHERE token_hash = sqlc.arg('token_hash');

-- name: MarkPasswordResetUsed :exec
UPDATE password_resets
SET is_used = TRUE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');
