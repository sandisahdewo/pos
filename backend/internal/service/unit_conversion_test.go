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

func TestUnitConversionService_CRUD(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	unitSvc := service.NewUnitService(queries)
	svc := service.NewUnitConversionService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	// Create 2 units first
	unit1, err := unitSvc.Create(ctx, tenantID, model.CreateUnitRequest{
		Name:        "Kilogram",
		Description: "Metric unit of mass",
	})
	require.NoError(t, err)

	unit2, err := unitSvc.Create(ctx, tenantID, model.CreateUnitRequest{
		Name:        "Gram",
		Description: "Smaller metric unit",
	})
	require.NoError(t, err)

	var conversionID uuid.UUID

	t.Run("create conversion", func(t *testing.T) {
		conversion, err := svc.Create(ctx, tenantID, model.CreateUnitConversionRequest{
			FromUnitID:       unit1.ID,
			ToUnitID:         unit2.ID,
			ConversionFactor: 1000.0,
		})
		require.NoError(t, err)
		require.NotNil(t, conversion)
		assert.Equal(t, unit1.ID, conversion.FromUnitID)
		assert.Equal(t, unit2.ID, conversion.ToUnitID)
		assert.Equal(t, 1000.0, conversion.ConversionFactor)
		assert.Equal(t, "Kilogram", conversion.FromUnitName)
		assert.Equal(t, "Gram", conversion.ToUnitName)
		assert.Equal(t, tenantID, conversion.TenantID)
		conversionID = conversion.ID
	})

	t.Run("create duplicate conversion fails", func(t *testing.T) {
		conversion, err := svc.Create(ctx, tenantID, model.CreateUnitConversionRequest{
			FromUnitID:       unit1.ID,
			ToUnitID:         unit2.ID,
			ConversionFactor: 500.0,
		})
		assert.Nil(t, conversion)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("create with same from and to unit fails", func(t *testing.T) {
		conversion, err := svc.Create(ctx, tenantID, model.CreateUnitConversionRequest{
			FromUnitID:       unit1.ID,
			ToUnitID:         unit1.ID,
			ConversionFactor: 1.0,
		})
		assert.Nil(t, conversion)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnprocessableEntity, appErr.Code)
	})

	t.Run("get by ID", func(t *testing.T) {
		conversion, err := svc.GetByID(ctx, conversionID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, conversion)
		assert.Equal(t, 1000.0, conversion.ConversionFactor)
		assert.Equal(t, "Kilogram", conversion.FromUnitName)
		assert.Equal(t, "Gram", conversion.ToUnitName)
	})

	t.Run("get by ID with wrong tenant returns not found", func(t *testing.T) {
		conversion, err := svc.GetByID(ctx, conversionID, uuid.New())
		assert.Nil(t, conversion)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("get nonexistent conversion returns not found", func(t *testing.T) {
		conversion, err := svc.GetByID(ctx, uuid.New(), tenantID)
		assert.Nil(t, conversion)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("update conversion factor", func(t *testing.T) {
		conversion, err := svc.Update(ctx, conversionID, tenantID, model.UpdateUnitConversionRequest{
			FromUnitID:       unit1.ID,
			ToUnitID:         unit2.ID,
			ConversionFactor: 999.0,
		})
		require.NoError(t, err)
		require.NotNil(t, conversion)
		assert.Equal(t, 999.0, conversion.ConversionFactor)
		assert.Equal(t, "Kilogram", conversion.FromUnitName)
		assert.Equal(t, "Gram", conversion.ToUnitName)
	})

	t.Run("list returns conversions with unit names", func(t *testing.T) {
		conversions, err := svc.List(ctx, tenantID)
		require.NoError(t, err)
		require.Len(t, conversions, 1)
		assert.Equal(t, "Kilogram", conversions[0].FromUnitName)
		assert.Equal(t, "Gram", conversions[0].ToUnitName)
		assert.Equal(t, 999.0, conversions[0].ConversionFactor)
	})

	t.Run("delete conversion", func(t *testing.T) {
		err := svc.Delete(ctx, conversionID, tenantID)
		require.NoError(t, err)

		// Verify it's gone
		conversion, err := svc.GetByID(ctx, conversionID, tenantID)
		assert.Nil(t, conversion)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("delete with wrong tenant returns not found", func(t *testing.T) {
		// Create a new conversion to test wrong tenant delete
		conversion, err := svc.Create(ctx, tenantID, model.CreateUnitConversionRequest{
			FromUnitID:       unit2.ID,
			ToUnitID:         unit1.ID,
			ConversionFactor: 0.001,
		})
		require.NoError(t, err)

		err = svc.Delete(ctx, conversion.ID, uuid.New())
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}
