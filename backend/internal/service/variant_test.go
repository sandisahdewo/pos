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

func TestVariantService_CRUD(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	svc := service.NewVariantService(pool, queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	t.Run("list variants returns empty initially", func(t *testing.T) {
		variants, err := svc.List(ctx, tenantID)
		require.NoError(t, err)
		assert.Len(t, variants, 0)
	})

	var newVariantID uuid.UUID

	t.Run("create variant", func(t *testing.T) {
		variant, err := svc.Create(ctx, tenantID, model.CreateVariantRequest{
			Name:        "Color",
			Description: "Product color options",
		})
		require.NoError(t, err)
		require.NotNil(t, variant)
		assert.Equal(t, "Color", variant.Name)
		assert.Equal(t, "Product color options", variant.Description)
		assert.True(t, variant.IsActive)
		assert.Equal(t, tenantID, variant.TenantID)
		assert.Len(t, variant.Values, 0)
		newVariantID = variant.ID
	})

	t.Run("create duplicate variant name fails", func(t *testing.T) {
		variant, err := svc.Create(ctx, tenantID, model.CreateVariantRequest{
			Name: "Color",
		})
		assert.Nil(t, variant)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("get by ID", func(t *testing.T) {
		variant, err := svc.GetByID(ctx, newVariantID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, variant)
		assert.Equal(t, "Color", variant.Name)
		assert.Equal(t, "Product color options", variant.Description)
		assert.True(t, variant.IsActive)
		assert.Equal(t, tenantID, variant.TenantID)
	})

	t.Run("get by ID with wrong tenant returns not found", func(t *testing.T) {
		fakeTenant := uuid.New()
		variant, err := svc.GetByID(ctx, newVariantID, fakeTenant)
		assert.Nil(t, variant)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("get nonexistent variant returns not found", func(t *testing.T) {
		variant, err := svc.GetByID(ctx, uuid.New(), tenantID)
		assert.Nil(t, variant)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("update variant", func(t *testing.T) {
		variant, err := svc.Update(ctx, newVariantID, tenantID, model.UpdateVariantRequest{
			Name:        "Size",
			Description: "Product size options",
			IsActive:    true,
		})
		require.NoError(t, err)
		require.NotNil(t, variant)
		assert.Equal(t, "Size", variant.Name)
		assert.Equal(t, "Product size options", variant.Description)
	})

	t.Run("update variant with wrong tenant returns not found", func(t *testing.T) {
		variant, err := svc.Update(ctx, newVariantID, uuid.New(), model.UpdateVariantRequest{
			Name:     "Hack",
			IsActive: true,
		})
		assert.Nil(t, variant)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("deactivate variant", func(t *testing.T) {
		err := svc.Deactivate(ctx, newVariantID, tenantID)
		require.NoError(t, err)

		variant, err := svc.GetByID(ctx, newVariantID, tenantID)
		require.NoError(t, err)
		assert.False(t, variant.IsActive)
	})

	t.Run("deactivate with wrong tenant returns not found", func(t *testing.T) {
		err := svc.Deactivate(ctx, newVariantID, uuid.New())
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}

func TestVariantService_WithValues(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	svc := service.NewVariantService(pool, queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	t.Run("create variant with initial values", func(t *testing.T) {
		variant, err := svc.Create(ctx, tenantID, model.CreateVariantRequest{
			Name:        "Color",
			Description: "Product colors",
			Values: []model.VariantValueEntry{
				{Value: "Red", SortOrder: 1},
				{Value: "Blue", SortOrder: 2},
				{Value: "Green", SortOrder: 3},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, variant)
		assert.Equal(t, "Color", variant.Name)
		require.Len(t, variant.Values, 3)
		assert.Equal(t, "Red", variant.Values[0].Value)
		assert.Equal(t, int32(1), variant.Values[0].SortOrder)
		assert.Equal(t, "Blue", variant.Values[1].Value)
		assert.Equal(t, int32(2), variant.Values[1].SortOrder)
		assert.Equal(t, "Green", variant.Values[2].Value)
		assert.Equal(t, int32(3), variant.Values[2].SortOrder)

		// Verify GetByID returns the values
		detail, err := svc.GetByID(ctx, variant.ID, tenantID)
		require.NoError(t, err)
		require.Len(t, detail.Values, 3)
	})
}

func TestVariantService_ValueManagement(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	svc := service.NewVariantService(pool, queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	// Create a variant to work with
	variant, err := svc.Create(ctx, tenantID, model.CreateVariantRequest{
		Name:        "Size",
		Description: "Product sizes",
	})
	require.NoError(t, err)
	variantID := variant.ID

	var valueID uuid.UUID

	t.Run("add value", func(t *testing.T) {
		val, err := svc.AddValue(ctx, variantID, tenantID, model.CreateVariantValueRequest{
			Value:     "Small",
			SortOrder: 1,
		})
		require.NoError(t, err)
		require.NotNil(t, val)
		assert.Equal(t, "Small", val.Value)
		assert.Equal(t, int32(1), val.SortOrder)
		assert.True(t, val.IsActive)
		assert.Equal(t, variantID, val.VariantID)
		valueID = val.ID
	})

	t.Run("add duplicate value fails", func(t *testing.T) {
		val, err := svc.AddValue(ctx, variantID, tenantID, model.CreateVariantValueRequest{
			Value:     "Small",
			SortOrder: 2,
		})
		assert.Nil(t, val)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("update value", func(t *testing.T) {
		val, err := svc.UpdateValue(ctx, variantID, valueID, tenantID, model.UpdateVariantValueRequest{
			Value:     "Medium",
			SortOrder: 2,
			IsActive:  true,
		})
		require.NoError(t, err)
		require.NotNil(t, val)
		assert.Equal(t, "Medium", val.Value)
		assert.Equal(t, int32(2), val.SortOrder)
	})

	t.Run("delete value", func(t *testing.T) {
		err := svc.DeleteValue(ctx, variantID, valueID, tenantID)
		require.NoError(t, err)

		// Verify variant has no values
		detail, err := svc.GetByID(ctx, variantID, tenantID)
		require.NoError(t, err)
		assert.Len(t, detail.Values, 0)
	})

	t.Run("add value with wrong tenant returns not found", func(t *testing.T) {
		val, err := svc.AddValue(ctx, variantID, uuid.New(), model.CreateVariantValueRequest{
			Value:     "Large",
			SortOrder: 3,
		})
		assert.Nil(t, val)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}
