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

func TestCategoryService_CRUD(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	svc := service.NewCategoryService(pool, queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	t.Run("list categories returns empty initially", func(t *testing.T) {
		categories, err := svc.List(ctx, tenantID)
		require.NoError(t, err)
		assert.Len(t, categories, 0)
	})

	var newCategoryID uuid.UUID

	t.Run("create category", func(t *testing.T) {
		category, err := svc.Create(ctx, tenantID, model.CreateCategoryRequest{
			Name:        "Electronics",
			Description: "Electronic devices and accessories",
			PricingMode: "markup",
			MarkupValue: 15.5,
		})
		require.NoError(t, err)
		require.NotNil(t, category)
		assert.Equal(t, "Electronics", category.Name)
		assert.Equal(t, "Electronic devices and accessories", category.Description)
		assert.Equal(t, "markup", category.PricingMode)
		assert.Equal(t, 15.5, category.MarkupValue)
		assert.True(t, category.IsActive)
		assert.Equal(t, tenantID, category.TenantID)
		newCategoryID = category.ID
	})

	t.Run("create duplicate category name fails", func(t *testing.T) {
		category, err := svc.Create(ctx, tenantID, model.CreateCategoryRequest{
			Name:        "Electronics",
			PricingMode: "markup",
			MarkupValue: 10.0,
		})
		assert.Nil(t, category)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("get by ID", func(t *testing.T) {
		category, err := svc.GetByID(ctx, newCategoryID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, category)
		assert.Equal(t, "Electronics", category.Name)
		assert.Equal(t, "Electronic devices and accessories", category.Description)
		assert.Equal(t, "markup", category.PricingMode)
		assert.Equal(t, 15.5, category.MarkupValue)
		assert.True(t, category.IsActive)
		assert.Equal(t, tenantID, category.TenantID)
		assert.NotNil(t, category.Units)
		assert.NotNil(t, category.Variants)
	})

	t.Run("get by ID with wrong tenant returns not found", func(t *testing.T) {
		fakeTenant := uuid.New()
		category, err := svc.GetByID(ctx, newCategoryID, fakeTenant)
		assert.Nil(t, category)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("get nonexistent category returns not found", func(t *testing.T) {
		category, err := svc.GetByID(ctx, uuid.New(), tenantID)
		assert.Nil(t, category)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("update category", func(t *testing.T) {
		category, err := svc.Update(ctx, newCategoryID, tenantID, model.UpdateCategoryRequest{
			Name:        "Updated Electronics",
			Description: "Updated description",
			PricingMode: "fixed",
			MarkupValue: 20.0,
			IsActive:    true,
		})
		require.NoError(t, err)
		require.NotNil(t, category)
		assert.Equal(t, "Updated Electronics", category.Name)
		assert.Equal(t, "Updated description", category.Description)
		assert.Equal(t, "fixed", category.PricingMode)
		assert.Equal(t, 20.0, category.MarkupValue)
	})

	t.Run("update category with wrong tenant returns not found", func(t *testing.T) {
		category, err := svc.Update(ctx, newCategoryID, uuid.New(), model.UpdateCategoryRequest{
			Name:     "Hack",
			IsActive: true,
		})
		assert.Nil(t, category)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("deactivate category", func(t *testing.T) {
		err := svc.Deactivate(ctx, newCategoryID, tenantID)
		require.NoError(t, err)

		category, err := svc.GetByID(ctx, newCategoryID, tenantID)
		require.NoError(t, err)
		assert.False(t, category.IsActive)
	})

	t.Run("deactivate with wrong tenant returns not found", func(t *testing.T) {
		err := svc.Deactivate(ctx, newCategoryID, uuid.New())
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}

func TestCategoryService_LinkUnits(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	categorySvc := service.NewCategoryService(pool, queries)
	unitSvc := service.NewUnitService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	// Create a category
	category, err := categorySvc.Create(ctx, tenantID, model.CreateCategoryRequest{
		Name:        "Beverages",
		PricingMode: "markup",
		MarkupValue: 10.0,
	})
	require.NoError(t, err)
	categoryID := category.ID

	// Create 3 units
	unit1, err := unitSvc.Create(ctx, tenantID, model.CreateUnitRequest{Name: "Liter"})
	require.NoError(t, err)
	unit2, err := unitSvc.Create(ctx, tenantID, model.CreateUnitRequest{Name: "Milliliter"})
	require.NoError(t, err)
	unit3, err := unitSvc.Create(ctx, tenantID, model.CreateUnitRequest{Name: "Gallon"})
	require.NoError(t, err)

	t.Run("link 2 units to category", func(t *testing.T) {
		units, err := categorySvc.UpdateUnits(ctx, categoryID, tenantID, model.UpdateCategoryUnitsRequest{
			UnitIDs: []uuid.UUID{unit1.ID, unit2.ID},
		})
		require.NoError(t, err)
		require.Len(t, units, 2)
	})

	t.Run("verify linked units via GetByID", func(t *testing.T) {
		detail, err := categorySvc.GetByID(ctx, categoryID, tenantID)
		require.NoError(t, err)
		require.Len(t, detail.Units, 2)
	})

	t.Run("replace with different 2 units", func(t *testing.T) {
		units, err := categorySvc.UpdateUnits(ctx, categoryID, tenantID, model.UpdateCategoryUnitsRequest{
			UnitIDs: []uuid.UUID{unit2.ID, unit3.ID},
		})
		require.NoError(t, err)
		require.Len(t, units, 2)

		// Verify via GetByID
		detail, err := categorySvc.GetByID(ctx, categoryID, tenantID)
		require.NoError(t, err)
		require.Len(t, detail.Units, 2)

		// Verify the correct units are linked
		unitIDs := make(map[uuid.UUID]bool)
		for _, u := range detail.Units {
			unitIDs[u.ID] = true
		}
		assert.True(t, unitIDs[unit2.ID])
		assert.True(t, unitIDs[unit3.ID])
		assert.False(t, unitIDs[unit1.ID])
	})

	t.Run("update units with wrong tenant returns not found", func(t *testing.T) {
		units, err := categorySvc.UpdateUnits(ctx, categoryID, uuid.New(), model.UpdateCategoryUnitsRequest{
			UnitIDs: []uuid.UUID{unit1.ID},
		})
		assert.Nil(t, units)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}

func TestCategoryService_LinkVariants(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	categorySvc := service.NewCategoryService(pool, queries)
	variantSvc := service.NewVariantService(pool, queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	// Create a category
	category, err := categorySvc.Create(ctx, tenantID, model.CreateCategoryRequest{
		Name:        "Clothing",
		PricingMode: "markup",
		MarkupValue: 10.0,
	})
	require.NoError(t, err)
	categoryID := category.ID

	// Create 3 variants
	v1, err := variantSvc.Create(ctx, tenantID, model.CreateVariantRequest{Name: "Color"})
	require.NoError(t, err)
	v2, err := variantSvc.Create(ctx, tenantID, model.CreateVariantRequest{Name: "Size"})
	require.NoError(t, err)
	v3, err := variantSvc.Create(ctx, tenantID, model.CreateVariantRequest{Name: "Material"})
	require.NoError(t, err)

	t.Run("link 2 variants to category", func(t *testing.T) {
		variants, err := categorySvc.UpdateVariants(ctx, categoryID, tenantID, model.UpdateCategoryVariantsRequest{
			VariantIDs: []uuid.UUID{v1.ID, v2.ID},
		})
		require.NoError(t, err)
		require.Len(t, variants, 2)
	})

	t.Run("verify linked variants via GetByID", func(t *testing.T) {
		detail, err := categorySvc.GetByID(ctx, categoryID, tenantID)
		require.NoError(t, err)
		require.Len(t, detail.Variants, 2)
	})

	t.Run("replace with different 2 variants", func(t *testing.T) {
		variants, err := categorySvc.UpdateVariants(ctx, categoryID, tenantID, model.UpdateCategoryVariantsRequest{
			VariantIDs: []uuid.UUID{v2.ID, v3.ID},
		})
		require.NoError(t, err)
		require.Len(t, variants, 2)

		// Verify via GetByID
		detail, err := categorySvc.GetByID(ctx, categoryID, tenantID)
		require.NoError(t, err)
		require.Len(t, detail.Variants, 2)

		// Verify the correct variants are linked
		variantIDs := make(map[uuid.UUID]bool)
		for _, v := range detail.Variants {
			variantIDs[v.ID] = true
		}
		assert.True(t, variantIDs[v2.ID])
		assert.True(t, variantIDs[v3.ID])
		assert.False(t, variantIDs[v1.ID])
	})

	t.Run("update variants with wrong tenant returns not found", func(t *testing.T) {
		variants, err := categorySvc.UpdateVariants(ctx, categoryID, uuid.New(), model.UpdateCategoryVariantsRequest{
			VariantIDs: []uuid.UUID{v1.ID},
		})
		assert.Nil(t, variants)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}
