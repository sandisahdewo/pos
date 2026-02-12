package service_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"pos/internal/model"
	"pos/internal/service"
	"pos/internal/testutil"
)

func TestProductService_CRUD(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	productSvc := service.NewProductService(pool, queries)
	categorySvc := service.NewCategoryService(pool, queries)
	unitSvc := service.NewUnitService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	// Create prerequisites
	category, err := categorySvc.Create(ctx, tenantID, model.CreateCategoryRequest{
		Name:        "Electronics",
		PricingMode: "markup",
		MarkupValue: 15.0,
	})
	require.NoError(t, err)
	categoryID := category.ID

	unit, err := unitSvc.Create(ctx, tenantID, model.CreateUnitRequest{Name: "Piece"})
	require.NoError(t, err)
	unitID := unit.ID

	t.Run("list products returns empty initially", func(t *testing.T) {
		result, err := productSvc.List(ctx, tenantID, nil, model.PaginationRequest{Page: 1, PerPage: 20})
		require.NoError(t, err)
		require.NotNil(t, result)
		items := result.Data.([]model.ProductResponse)
		assert.Len(t, items, 0)
		assert.Equal(t, int64(0), result.Pagination.Total)
	})

	var productID uuid.UUID

	t.Run("create simple product (no variants)", func(t *testing.T) {
		product, err := productSvc.Create(ctx, tenantID, model.CreateProductRequest{
			CategoryID:  categoryID,
			Name:        "USB Cable",
			Description: "A basic USB cable",
			HasVariants: false,
			SellMethod:  "fifo",
			Status:      "active",
			TaxRate:     10.0,
			DiscountRate: 0,
			PricingMode: "markup",
			MarkupValue: 20.0,
			Variants: []model.ProductVariantEntry{
				{
					SKU:         "USB-001",
					Barcode:     "1234567890",
					UnitID:      unitID,
					RetailPrice: 9.99,
				},
			},
			Images: []string{"https://example.com/usb.jpg"},
			PriceTiers: []model.PriceTierEntry{
				{MinQuantity: 10, Price: 8.99},
				{MinQuantity: 50, Price: 7.99},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, product)
		assert.Equal(t, "USB Cable", product.Name)
		assert.Equal(t, "A basic USB cable", product.Description)
		assert.Equal(t, categoryID, product.CategoryID)
		assert.False(t, product.HasVariants)
		assert.Equal(t, "fifo", product.SellMethod)
		assert.Equal(t, "active", product.Status)
		assert.Equal(t, 10.0, product.TaxRate)
		assert.Equal(t, "markup", product.PricingMode)
		assert.Equal(t, 20.0, product.MarkupValue)
		assert.True(t, product.IsActive)
		assert.Equal(t, tenantID, product.TenantID)

		// Verify variant
		require.Len(t, product.Variants, 1)
		assert.Equal(t, "USB-001", product.Variants[0].SKU)
		assert.Equal(t, "1234567890", product.Variants[0].Barcode)
		assert.Equal(t, unitID, product.Variants[0].UnitID)
		assert.Equal(t, 9.99, product.Variants[0].RetailPrice)

		// Verify images
		require.Len(t, product.Images, 1)
		assert.Equal(t, "https://example.com/usb.jpg", product.Images[0].ImageURL)

		// Verify price tiers
		require.Len(t, product.PriceTiers, 2)

		productID = product.ID
	})

	t.Run("create duplicate product name fails", func(t *testing.T) {
		product, err := productSvc.Create(ctx, tenantID, model.CreateProductRequest{
			CategoryID: categoryID,
			Name:       "USB Cable",
			SellMethod: "fifo",
			Status:     "active",
			Variants: []model.ProductVariantEntry{
				{SKU: "USB-DUP", UnitID: unitID},
			},
		})
		assert.Nil(t, product)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("get by ID returns full detail", func(t *testing.T) {
		product, err := productSvc.GetByID(ctx, productID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, product)
		assert.Equal(t, "USB Cable", product.Name)
		assert.Equal(t, categoryID, product.CategoryID)
		require.Len(t, product.Variants, 1)
		assert.Equal(t, "USB-001", product.Variants[0].SKU)
		require.Len(t, product.Images, 1)
		require.Len(t, product.PriceTiers, 2)
	})

	t.Run("get by ID with wrong tenant returns not found", func(t *testing.T) {
		fakeTenant := uuid.New()
		product, err := productSvc.GetByID(ctx, productID, fakeTenant)
		assert.Nil(t, product)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("get nonexistent product returns not found", func(t *testing.T) {
		product, err := productSvc.GetByID(ctx, uuid.New(), tenantID)
		assert.Nil(t, product)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("update product", func(t *testing.T) {
		product, err := productSvc.Update(ctx, productID, tenantID, model.UpdateProductRequest{
			CategoryID: categoryID,
			Name:       "Updated USB Cable",
			Description: "An updated USB cable",
			HasVariants: false,
			SellMethod:  "fifo",
			Status:      "active",
			TaxRate:     12.0,
			PricingMode: "fixed",
			FixedPrice:  15.0,
			IsActive:    true,
			Variants: []model.ProductVariantEntry{
				{
					SKU:         "USB-001-V2",
					UnitID:      unitID,
					RetailPrice: 14.99,
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, product)
		assert.Equal(t, "Updated USB Cable", product.Name)
		assert.Equal(t, "An updated USB cable", product.Description)
		assert.Equal(t, 12.0, product.TaxRate)
		assert.Equal(t, "fixed", product.PricingMode)
		assert.Equal(t, 15.0, product.FixedPrice)
		require.Len(t, product.Variants, 1)
		assert.Equal(t, "USB-001-V2", product.Variants[0].SKU)
	})

	t.Run("update product with wrong tenant returns not found", func(t *testing.T) {
		product, err := productSvc.Update(ctx, productID, uuid.New(), model.UpdateProductRequest{
			CategoryID: categoryID,
			Name:       "Hacked",
			SellMethod: "fifo",
			Status:     "active",
			IsActive:   true,
			Variants:   []model.ProductVariantEntry{{SKU: "HACK", UnitID: unitID}},
		})
		assert.Nil(t, product)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("deactivate product", func(t *testing.T) {
		err := productSvc.Deactivate(ctx, productID, tenantID)
		require.NoError(t, err)

		product, err := productSvc.GetByID(ctx, productID, tenantID)
		require.NoError(t, err)
		assert.False(t, product.IsActive)
	})

	t.Run("deactivate with wrong tenant returns not found", func(t *testing.T) {
		err := productSvc.Deactivate(ctx, productID, uuid.New())
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("list products returns created products", func(t *testing.T) {
		result, err := productSvc.List(ctx, tenantID, nil, model.PaginationRequest{Page: 1, PerPage: 20})
		require.NoError(t, err)
		require.NotNil(t, result)
		items := result.Data.([]model.ProductResponse)
		assert.Len(t, items, 1)
		assert.Equal(t, int64(1), result.Pagination.Total)
		assert.Equal(t, "Updated USB Cable", items[0].Name)
	})
}

func TestProductService_WithVariants(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	productSvc := service.NewProductService(pool, queries)
	categorySvc := service.NewCategoryService(pool, queries)
	unitSvc := service.NewUnitService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	category, err := categorySvc.Create(ctx, tenantID, model.CreateCategoryRequest{
		Name:        "Clothing",
		PricingMode: "markup",
		MarkupValue: 25.0,
	})
	require.NoError(t, err)
	categoryID := category.ID

	unit, err := unitSvc.Create(ctx, tenantID, model.CreateUnitRequest{Name: "Piece"})
	require.NoError(t, err)
	unitID := unit.ID

	var productID uuid.UUID

	t.Run("create product with multiple variants", func(t *testing.T) {
		product, err := productSvc.Create(ctx, tenantID, model.CreateProductRequest{
			CategoryID:  categoryID,
			Name:        "T-Shirt",
			Description: "A cotton t-shirt",
			HasVariants: true,
			SellMethod:  "fifo",
			Status:      "active",
			Variants: []model.ProductVariantEntry{
				{
					SKU:         "TSHIRT-S",
					Barcode:     "TS-SMALL",
					UnitID:      unitID,
					RetailPrice: 19.99,
				},
				{
					SKU:         "TSHIRT-M",
					Barcode:     "TS-MEDIUM",
					UnitID:      unitID,
					RetailPrice: 19.99,
				},
				{
					SKU:         "TSHIRT-L",
					Barcode:     "TS-LARGE",
					UnitID:      unitID,
					RetailPrice: 21.99,
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, product)
		assert.Equal(t, "T-Shirt", product.Name)
		assert.True(t, product.HasVariants)
		require.Len(t, product.Variants, 3)
		productID = product.ID

		// Verify all variant SKUs
		skus := make(map[string]bool)
		for _, v := range product.Variants {
			skus[v.SKU] = true
			assert.Equal(t, unitID, v.UnitID)
		}
		assert.True(t, skus["TSHIRT-S"])
		assert.True(t, skus["TSHIRT-M"])
		assert.True(t, skus["TSHIRT-L"])
	})

	t.Run("get by ID returns all variants", func(t *testing.T) {
		product, err := productSvc.GetByID(ctx, productID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, product)
		require.Len(t, product.Variants, 3)

		for _, v := range product.Variants {
			assert.Equal(t, productID, v.ProductID)
			assert.NotEmpty(t, v.SKU)
			assert.True(t, v.IsActive)
		}
	})
}

func TestProductService_WithPriceTiers(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	productSvc := service.NewProductService(pool, queries)
	categorySvc := service.NewCategoryService(pool, queries)
	unitSvc := service.NewUnitService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	category, err := categorySvc.Create(ctx, tenantID, model.CreateCategoryRequest{
		Name:        "Bulk Goods",
		PricingMode: "markup",
		MarkupValue: 5.0,
	})
	require.NoError(t, err)
	categoryID := category.ID

	unit, err := unitSvc.Create(ctx, tenantID, model.CreateUnitRequest{Name: "Kg"})
	require.NoError(t, err)
	unitID := unit.ID

	var productID uuid.UUID

	t.Run("create product with price tiers", func(t *testing.T) {
		product, err := productSvc.Create(ctx, tenantID, model.CreateProductRequest{
			CategoryID:  categoryID,
			Name:        "Rice",
			HasVariants: false,
			SellMethod:  "fifo",
			Status:      "active",
			Variants: []model.ProductVariantEntry{
				{SKU: "RICE-01", UnitID: unitID, RetailPrice: 5.0},
			},
			PriceTiers: []model.PriceTierEntry{
				{MinQuantity: 10, Price: 4.50},
				{MinQuantity: 50, Price: 4.00},
				{MinQuantity: 100, Price: 3.50},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, product)
		require.Len(t, product.PriceTiers, 3)
		productID = product.ID

		// Verify tiers
		tierPrices := make(map[int32]float64)
		for _, tier := range product.PriceTiers {
			tierPrices[tier.MinQuantity] = tier.Price
		}
		assert.Equal(t, 4.50, tierPrices[10])
		assert.Equal(t, 4.00, tierPrices[50])
		assert.Equal(t, 3.50, tierPrices[100])
	})

	t.Run("update product replaces price tiers", func(t *testing.T) {
		product, err := productSvc.Update(ctx, productID, tenantID, model.UpdateProductRequest{
			CategoryID:  categoryID,
			Name:        "Rice",
			HasVariants: false,
			SellMethod:  "fifo",
			Status:      "active",
			IsActive:    true,
			Variants: []model.ProductVariantEntry{
				{SKU: "RICE-01", UnitID: unitID, RetailPrice: 5.0},
			},
			PriceTiers: []model.PriceTierEntry{
				{MinQuantity: 20, Price: 4.25},
				{MinQuantity: 100, Price: 3.25},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, product)
		require.Len(t, product.PriceTiers, 2)

		tierPrices := make(map[int32]float64)
		for _, tier := range product.PriceTiers {
			tierPrices[tier.MinQuantity] = tier.Price
		}
		assert.Equal(t, 4.25, tierPrices[20])
		assert.Equal(t, 3.25, tierPrices[100])
		// Old tier at qty 10 and 50 should be gone
		_, has10 := tierPrices[10]
		assert.False(t, has10)
		_, has50 := tierPrices[50]
		assert.False(t, has50)
	})
}

func TestStockService_GetByProduct(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	productSvc := service.NewProductService(pool, queries)
	categorySvc := service.NewCategoryService(pool, queries)
	unitSvc := service.NewUnitService(queries)
	warehouseSvc := service.NewWarehouseService(queries)
	stockSvc := service.NewStockService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	// Create prerequisites
	category, err := categorySvc.Create(ctx, tenantID, model.CreateCategoryRequest{
		Name:        "Gadgets",
		PricingMode: "markup",
		MarkupValue: 10.0,
	})
	require.NoError(t, err)

	unit, err := unitSvc.Create(ctx, tenantID, model.CreateUnitRequest{Name: "Piece"})
	require.NoError(t, err)

	// Create a product
	product, err := productSvc.Create(ctx, tenantID, model.CreateProductRequest{
		CategoryID:  category.ID,
		Name:        "Gadget X",
		HasVariants: false,
		SellMethod:  "fifo",
		Status:      "active",
		Variants: []model.ProductVariantEntry{
			{SKU: "GDX-001", UnitID: unit.ID, RetailPrice: 99.99},
		},
	})
	require.NoError(t, err)

	// Create a warehouse
	_, err = warehouseSvc.Create(ctx, tenantID, model.CreateWarehouseRequest{
		Name:    "Main Warehouse",
		Address: "123 Storage St",
	})
	require.NoError(t, err)

	t.Run("returns empty stock for new product", func(t *testing.T) {
		stock, err := stockSvc.GetByProduct(ctx, product.ID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, stock)
		// No stock ledger entries exist, so the cross-join may return rows
		// with zero stock or an empty result depending on the query.
		// Either way, verify no error and all entries have zero stock.
		for _, s := range stock {
			assert.Equal(t, float64(0), s.CurrentStock)
		}
	})

	t.Run("get stock with wrong tenant returns not found", func(t *testing.T) {
		stock, err := stockSvc.GetByProduct(ctx, product.ID, uuid.New())
		assert.Nil(t, stock)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}
