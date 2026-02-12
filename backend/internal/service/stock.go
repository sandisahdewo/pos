package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"pos/internal/database/sqlc"
	"pos/internal/model"
)

type StockService struct {
	queries *sqlc.Queries
}

func NewStockService(queries *sqlc.Queries) *StockService {
	return &StockService{queries: queries}
}

func (s *StockService) GetByProduct(ctx context.Context, productID, tenantID uuid.UUID) ([]model.StockSummaryResponse, error) {
	// Verify product exists and belongs to tenant
	product, err := s.queries.GetProductByID(ctx, productID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get product", err)
	}
	if product.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	rows, err := s.queries.GetStockByProduct(ctx, sqlc.GetStockByProductParams{
		ProductID: productID,
		TenantID:  tenantID,
	})
	if err != nil {
		return nil, model.InternalError("failed to get stock", err)
	}

	return toStockSummaryResponses(rows), nil
}

func (s *StockService) GetLedger(ctx context.Context, variantID, warehouseID, tenantID uuid.UUID, pagination model.PaginationRequest) (*model.PaginatedResponse, error) {
	pagination.Normalize()

	count, err := s.queries.CountStockLedgerEntries(ctx, sqlc.CountStockLedgerEntriesParams{
		ProductVariantID: variantID,
		WarehouseID:      warehouseID,
	})
	if err != nil {
		return nil, model.InternalError("failed to count stock entries", err)
	}

	entries, err := s.queries.GetStockLedgerEntries(ctx, sqlc.GetStockLedgerEntriesParams{
		ProductVariantID: variantID,
		WarehouseID:      warehouseID,
		OffsetVal:        pagination.Offset(),
		LimitVal:         pagination.Limit(),
	})
	if err != nil {
		return nil, model.InternalError("failed to get stock entries", err)
	}

	return &model.PaginatedResponse{
		Data:       toStockLedgerEntryResponses(entries),
		Pagination: model.NewPaginationResponse(count, pagination.Page, pagination.PerPage),
	}, nil
}
