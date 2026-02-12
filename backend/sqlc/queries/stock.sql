-- name: CreateStockLedgerEntry :one
INSERT INTO stock_ledger (tenant_id, product_variant_id, warehouse_id, quantity, unit_id, reason, reference_type, reference_id, notes)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('product_variant_id'), sqlc.arg('warehouse_id'), sqlc.arg('quantity'), sqlc.arg('unit_id'), sqlc.arg('reason'), sqlc.arg('reference_type'), sqlc.arg('reference_id'), sqlc.arg('notes'))
RETURNING *;

-- name: GetCurrentStock :one
SELECT COALESCE(SUM(quantity), 0)::NUMERIC(12,4) AS current_stock
FROM stock_ledger
WHERE product_variant_id = sqlc.arg('product_variant_id')
  AND warehouse_id = sqlc.arg('warehouse_id');

-- name: GetStockByProduct :many
SELECT
    pv.id AS variant_id,
    pv.sku AS variant_sku,
    w.id AS warehouse_id,
    w.name AS warehouse_name,
    COALESCE(SUM(sl.quantity), 0)::NUMERIC(12,4) AS current_stock
FROM product_variants pv
CROSS JOIN warehouses w
LEFT JOIN stock_ledger sl ON sl.product_variant_id = pv.id AND sl.warehouse_id = w.id
WHERE pv.product_id = sqlc.arg('product_id')
  AND w.tenant_id = sqlc.arg('tenant_id')
  AND w.is_active = TRUE
GROUP BY pv.id, pv.sku, w.id, w.name
ORDER BY pv.sku, w.name;

-- name: GetStockLedgerEntries :many
SELECT sl.*, u.name AS unit_name
FROM stock_ledger sl
JOIN units u ON u.id = sl.unit_id
WHERE sl.product_variant_id = sqlc.arg('product_variant_id')
  AND sl.warehouse_id = sqlc.arg('warehouse_id')
ORDER BY sl.created_at DESC
LIMIT sqlc.arg('limit_val') OFFSET sqlc.arg('offset_val');

-- name: CountStockLedgerEntries :one
SELECT COUNT(*) FROM stock_ledger
WHERE product_variant_id = sqlc.arg('product_variant_id')
  AND warehouse_id = sqlc.arg('warehouse_id');
