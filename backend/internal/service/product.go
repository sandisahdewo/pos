package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"pos/internal/database/sqlc"
	"pos/internal/model"
)

type ProductService struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewProductService(pool *pgxpool.Pool, queries *sqlc.Queries) *ProductService {
	return &ProductService{pool: pool, queries: queries}
}

func (s *ProductService) List(ctx context.Context, tenantID uuid.UUID, categoryID *uuid.UUID, pagination model.PaginationRequest) (*model.PaginatedResponse, error) {
	pagination.Normalize()

	if categoryID != nil {
		products, err := s.queries.GetProductsByTenantAndCategory(ctx, sqlc.GetProductsByTenantAndCategoryParams{
			TenantID:   tenantID,
			CategoryID: *categoryID,
			OffsetVal:  pagination.Offset(),
			LimitVal:   pagination.Limit(),
		})
		if err != nil {
			return nil, model.InternalError("failed to list products", err)
		}

		total, err := s.queries.CountProductsByTenantAndCategory(ctx, sqlc.CountProductsByTenantAndCategoryParams{
			TenantID:   tenantID,
			CategoryID: *categoryID,
		})
		if err != nil {
			return nil, model.InternalError("failed to count products", err)
		}

		return &model.PaginatedResponse{
			Data:       toProductResponsesFromCategoryRows(products),
			Pagination: model.NewPaginationResponse(total, pagination.Page, pagination.PerPage),
		}, nil
	}

	products, err := s.queries.GetProductsByTenant(ctx, sqlc.GetProductsByTenantParams{
		TenantID:  tenantID,
		OffsetVal: pagination.Offset(),
		LimitVal:  pagination.Limit(),
	})
	if err != nil {
		return nil, model.InternalError("failed to list products", err)
	}

	total, err := s.queries.CountProductsByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to count products", err)
	}

	return &model.PaginatedResponse{
		Data:       toProductResponses(products),
		Pagination: model.NewPaginationResponse(total, pagination.Page, pagination.PerPage),
	}, nil
}

func (s *ProductService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.ProductDetailResponse, error) {
	product, err := s.queries.GetProductByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get product", err)
	}

	if product.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	variants, err := s.queries.GetProductVariants(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get product variants", err)
	}

	variantResponses := make([]model.ProductVariantResponse, len(variants))
	for i, v := range variants {
		vr := toProductVariantResponse(v)

		values, err := s.queries.GetProductVariantValues(ctx, v.ID)
		if err != nil {
			return nil, model.InternalError("failed to get variant values", err)
		}
		vr.Values = toProductVariantValueResponses(values)

		variantImages, err := s.queries.GetProductVariantImages(ctx, v.ID)
		if err != nil {
			return nil, model.InternalError("failed to get variant images", err)
		}
		vr.Images = toProductVariantImageResponses(variantImages)

		variantTiers, err := s.queries.GetPriceTiersByVariant(ctx, pgtype.UUID{Bytes: v.ID, Valid: true})
		if err != nil {
			return nil, model.InternalError("failed to get variant price tiers", err)
		}
		vr.PriceTiers = toPriceTierResponses(variantTiers)

		variantResponses[i] = vr
	}

	images, err := s.queries.GetProductImages(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get product images", err)
	}

	priceTiers, err := s.queries.GetPriceTiersByProduct(ctx, pgtype.UUID{Bytes: id, Valid: true})
	if err != nil {
		return nil, model.InternalError("failed to get product price tiers", err)
	}

	return &model.ProductDetailResponse{
		ProductResponse: toProductResponseFromRow(product),
		Variants:        variantResponses,
		Images:          toProductImageResponses(images),
		PriceTiers:      toPriceTierResponses(priceTiers),
	}, nil
}

func (s *ProductService) Create(ctx context.Context, tenantID uuid.UUID, req model.CreateProductRequest) (*model.ProductDetailResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	product, err := qtx.CreateProduct(ctx, sqlc.CreateProductParams{
		TenantID:     tenantID,
		CategoryID:   req.CategoryID,
		Name:         req.Name,
		Description:  pgtype.Text{String: req.Description, Valid: req.Description != ""},
		HasVariants:  req.HasVariants,
		SellMethod:   sqlc.SellMethod(req.SellMethod),
		Status:       sqlc.ProductStatus(req.Status),
		TaxRate:      float64ToNumeric(req.TaxRate),
		DiscountRate: float64ToNumeric(req.DiscountRate),
		MinQuantity:  float64ToNumeric(req.MinQuantity),
		MaxQuantity:  float64ToNumeric(req.MaxQuantity),
		PricingMode:  pgtype.Text{String: req.PricingMode, Valid: req.PricingMode != ""},
		MarkupValue:  float64ToNumeric(req.MarkupValue),
		FixedPrice:   float64ToNumeric(req.FixedPrice),
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a product with this name already exists")
		}
		return nil, model.InternalError("failed to create product", err)
	}

	if !req.HasVariants {
		// Single product: create one default variant
		var ve model.ProductVariantEntry
		if len(req.Variants) > 0 {
			ve = req.Variants[0]
		} else {
			ve = model.ProductVariantEntry{
				SKU:    req.Name,
				UnitID: uuid.Nil,
			}
		}

		variant, err := qtx.CreateProductVariant(ctx, sqlc.CreateProductVariantParams{
			ProductID:   product.ID,
			Sku:         ve.SKU,
			Barcode:     pgtype.Text{String: ve.Barcode, Valid: ve.Barcode != ""},
			UnitID:      ve.UnitID,
			RetailPrice: float64ToNumeric(ve.RetailPrice),
		})
		if err != nil {
			return nil, model.InternalError("failed to create product variant", err)
		}

		for _, valueID := range ve.Values {
			if err := qtx.CreateProductVariantValue(ctx, sqlc.CreateProductVariantValueParams{
				ProductVariantID: variant.ID,
				VariantValueID:   valueID,
			}); err != nil {
				return nil, model.InternalError("failed to create variant value", err)
			}
		}

		for j, imgURL := range ve.Images {
			if _, err := qtx.CreateProductVariantImage(ctx, sqlc.CreateProductVariantImageParams{
				ProductVariantID: variant.ID,
				ImageUrl:         imgURL,
				SortOrder:        int32(j),
			}); err != nil {
				return nil, model.InternalError("failed to create variant image", err)
			}
		}

		for _, tier := range ve.PriceTiers {
			if _, err := qtx.CreatePriceTier(ctx, sqlc.CreatePriceTierParams{
				ProductID:        pgtype.UUID{Valid: false},
				ProductVariantID: pgtype.UUID{Bytes: variant.ID, Valid: true},
				MinQuantity:      tier.MinQuantity,
				Price:            float64ToNumeric(tier.Price),
			}); err != nil {
				return nil, model.InternalError("failed to create variant price tier", err)
			}
		}
	} else {
		// Multi-variant product
		for _, ve := range req.Variants {
			variant, err := qtx.CreateProductVariant(ctx, sqlc.CreateProductVariantParams{
				ProductID:   product.ID,
				Sku:         ve.SKU,
				Barcode:     pgtype.Text{String: ve.Barcode, Valid: ve.Barcode != ""},
				UnitID:      ve.UnitID,
				RetailPrice: float64ToNumeric(ve.RetailPrice),
			})
			if err != nil {
				return nil, model.InternalError("failed to create product variant", err)
			}

			for _, valueID := range ve.Values {
				if err := qtx.CreateProductVariantValue(ctx, sqlc.CreateProductVariantValueParams{
					ProductVariantID: variant.ID,
					VariantValueID:   valueID,
				}); err != nil {
					return nil, model.InternalError("failed to create variant value", err)
				}
			}

			for j, imgURL := range ve.Images {
				if _, err := qtx.CreateProductVariantImage(ctx, sqlc.CreateProductVariantImageParams{
					ProductVariantID: variant.ID,
					ImageUrl:         imgURL,
					SortOrder:        int32(j),
				}); err != nil {
					return nil, model.InternalError("failed to create variant image", err)
				}
			}

			for _, tier := range ve.PriceTiers {
				if _, err := qtx.CreatePriceTier(ctx, sqlc.CreatePriceTierParams{
					ProductID:        pgtype.UUID{Valid: false},
					ProductVariantID: pgtype.UUID{Bytes: variant.ID, Valid: true},
					MinQuantity:      tier.MinQuantity,
					Price:            float64ToNumeric(tier.Price),
				}); err != nil {
					return nil, model.InternalError("failed to create variant price tier", err)
				}
			}
		}
	}

	// Create product-level images
	for i, imgURL := range req.Images {
		if _, err := qtx.CreateProductImage(ctx, sqlc.CreateProductImageParams{
			ProductID: product.ID,
			ImageUrl:  imgURL,
			SortOrder: int32(i),
		}); err != nil {
			return nil, model.InternalError("failed to create product image", err)
		}
	}

	// Create product-level price tiers
	for _, tier := range req.PriceTiers {
		if _, err := qtx.CreatePriceTier(ctx, sqlc.CreatePriceTierParams{
			ProductID:        pgtype.UUID{Bytes: product.ID, Valid: true},
			ProductVariantID: pgtype.UUID{Valid: false},
			MinQuantity:      tier.MinQuantity,
			Price:            float64ToNumeric(tier.Price),
		}); err != nil {
			return nil, model.InternalError("failed to create product price tier", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, model.InternalError("failed to commit product creation", err)
	}

	return s.GetByID(ctx, product.ID, tenantID)
}

func (s *ProductService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateProductRequest) (*model.ProductDetailResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	existing, err := qtx.GetProductByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get product", err)
	}

	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	_, err = qtx.UpdateProduct(ctx, sqlc.UpdateProductParams{
		ID:           id,
		Name:         req.Name,
		Description:  pgtype.Text{String: req.Description, Valid: req.Description != ""},
		CategoryID:   req.CategoryID,
		HasVariants:  req.HasVariants,
		SellMethod:   sqlc.SellMethod(req.SellMethod),
		Status:       sqlc.ProductStatus(req.Status),
		TaxRate:      float64ToNumeric(req.TaxRate),
		DiscountRate: float64ToNumeric(req.DiscountRate),
		MinQuantity:  float64ToNumeric(req.MinQuantity),
		MaxQuantity:  float64ToNumeric(req.MaxQuantity),
		PricingMode:  pgtype.Text{String: req.PricingMode, Valid: req.PricingMode != ""},
		MarkupValue:  float64ToNumeric(req.MarkupValue),
		FixedPrice:   float64ToNumeric(req.FixedPrice),
		IsActive:     req.IsActive,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a product with this name already exists")
		}
		return nil, model.InternalError("failed to update product", err)
	}

	// Delete existing child records (variants cascade to values/images)
	if err := qtx.DeleteProductVariantsByProduct(ctx, id); err != nil {
		return nil, model.InternalError("failed to delete product variants", err)
	}
	if err := qtx.DeleteProductImagesByProduct(ctx, id); err != nil {
		return nil, model.InternalError("failed to delete product images", err)
	}
	if err := qtx.DeletePriceTiersByProduct(ctx, pgtype.UUID{Bytes: id, Valid: true}); err != nil {
		return nil, model.InternalError("failed to delete product price tiers", err)
	}

	// Re-create variants
	if !req.HasVariants {
		var ve model.ProductVariantEntry
		if len(req.Variants) > 0 {
			ve = req.Variants[0]
		} else {
			ve = model.ProductVariantEntry{
				SKU:    req.Name,
				UnitID: uuid.Nil,
			}
		}

		variant, err := qtx.CreateProductVariant(ctx, sqlc.CreateProductVariantParams{
			ProductID:   id,
			Sku:         ve.SKU,
			Barcode:     pgtype.Text{String: ve.Barcode, Valid: ve.Barcode != ""},
			UnitID:      ve.UnitID,
			RetailPrice: float64ToNumeric(ve.RetailPrice),
		})
		if err != nil {
			return nil, model.InternalError("failed to create product variant", err)
		}

		for _, valueID := range ve.Values {
			if err := qtx.CreateProductVariantValue(ctx, sqlc.CreateProductVariantValueParams{
				ProductVariantID: variant.ID,
				VariantValueID:   valueID,
			}); err != nil {
				return nil, model.InternalError("failed to create variant value", err)
			}
		}

		for j, imgURL := range ve.Images {
			if _, err := qtx.CreateProductVariantImage(ctx, sqlc.CreateProductVariantImageParams{
				ProductVariantID: variant.ID,
				ImageUrl:         imgURL,
				SortOrder:        int32(j),
			}); err != nil {
				return nil, model.InternalError("failed to create variant image", err)
			}
		}

		for _, tier := range ve.PriceTiers {
			if _, err := qtx.CreatePriceTier(ctx, sqlc.CreatePriceTierParams{
				ProductID:        pgtype.UUID{Valid: false},
				ProductVariantID: pgtype.UUID{Bytes: variant.ID, Valid: true},
				MinQuantity:      tier.MinQuantity,
				Price:            float64ToNumeric(tier.Price),
			}); err != nil {
				return nil, model.InternalError("failed to create variant price tier", err)
			}
		}
	} else {
		for _, ve := range req.Variants {
			variant, err := qtx.CreateProductVariant(ctx, sqlc.CreateProductVariantParams{
				ProductID:   id,
				Sku:         ve.SKU,
				Barcode:     pgtype.Text{String: ve.Barcode, Valid: ve.Barcode != ""},
				UnitID:      ve.UnitID,
				RetailPrice: float64ToNumeric(ve.RetailPrice),
			})
			if err != nil {
				return nil, model.InternalError("failed to create product variant", err)
			}

			for _, valueID := range ve.Values {
				if err := qtx.CreateProductVariantValue(ctx, sqlc.CreateProductVariantValueParams{
					ProductVariantID: variant.ID,
					VariantValueID:   valueID,
				}); err != nil {
					return nil, model.InternalError("failed to create variant value", err)
				}
			}

			for j, imgURL := range ve.Images {
				if _, err := qtx.CreateProductVariantImage(ctx, sqlc.CreateProductVariantImageParams{
					ProductVariantID: variant.ID,
					ImageUrl:         imgURL,
					SortOrder:        int32(j),
				}); err != nil {
					return nil, model.InternalError("failed to create variant image", err)
				}
			}

			for _, tier := range ve.PriceTiers {
				if _, err := qtx.CreatePriceTier(ctx, sqlc.CreatePriceTierParams{
					ProductID:        pgtype.UUID{Valid: false},
					ProductVariantID: pgtype.UUID{Bytes: variant.ID, Valid: true},
					MinQuantity:      tier.MinQuantity,
					Price:            float64ToNumeric(tier.Price),
				}); err != nil {
					return nil, model.InternalError("failed to create variant price tier", err)
				}
			}
		}
	}

	// Re-create product images
	for i, imgURL := range req.Images {
		if _, err := qtx.CreateProductImage(ctx, sqlc.CreateProductImageParams{
			ProductID: id,
			ImageUrl:  imgURL,
			SortOrder: int32(i),
		}); err != nil {
			return nil, model.InternalError("failed to create product image", err)
		}
	}

	// Re-create product price tiers
	for _, tier := range req.PriceTiers {
		if _, err := qtx.CreatePriceTier(ctx, sqlc.CreatePriceTierParams{
			ProductID:        pgtype.UUID{Bytes: id, Valid: true},
			ProductVariantID: pgtype.UUID{Valid: false},
			MinQuantity:      tier.MinQuantity,
			Price:            float64ToNumeric(tier.Price),
		}); err != nil {
			return nil, model.InternalError("failed to create product price tier", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, model.InternalError("failed to commit product update", err)
	}

	return s.GetByID(ctx, id, tenantID)
}

func (s *ProductService) Deactivate(ctx context.Context, id, tenantID uuid.UUID) error {
	product, err := s.queries.GetProductByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get product", err)
	}

	if product.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeactivateProduct(ctx, id); err != nil {
		return model.InternalError("failed to deactivate product", err)
	}

	return nil
}
