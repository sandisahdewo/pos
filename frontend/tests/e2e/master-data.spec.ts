import { test, expect, type Page } from '@playwright/test';

function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function uniqueTenant(): string {
	return `MD Biz ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function registerAdmin(page: Page): Promise<void> {
	await page.goto('/register');
	await page.getByLabel('Business Name').fill(uniqueTenant());
	await page.getByLabel('First Name').fill('Admin');
	await page.getByLabel('Last Name').fill('User');
	await page.getByLabel('Email').fill(uniqueEmail());
	await page.getByLabel('Password').fill('password123');
	await page.getByLabel('Store Name').fill('Test Store');
	await page.getByRole('button', { name: 'Create Account' }).click();
	await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

/**
 * Helper: wait for an item row to appear in the table.
 */
async function expectRowVisible(page: Page, text: string) {
	await expect(page.locator('tr', { hasText: text })).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
test.describe('Categories', () => {
	test('admin can create a category', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/categories');
		await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 10_000 });

		// Open create dialog
		await page.getByRole('button', { name: 'Create Category' }).click();
		await expect(page.getByText('Add a new product category')).toBeVisible();

		// Fill form using specific IDs
		await page.locator('#categoryName').fill('Beverages');
		await page.locator('#categoryDescription').fill('Drinks and beverages');
		// Pricing mode is needed due to DB CHECK constraint on categories table
		await page.locator('#categoryPricingMode').selectOption('markup_percentage');
		await page.locator('#categoryMarkup').fill('10');

		// Submit
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		// Dialog should close and item should appear in table
		await expectRowVisible(page, 'Beverages');
		await expect(page.getByText('Drinks and beverages')).toBeVisible();
	});

	test('admin can create a category with pricing mode', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/categories');
		await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Category' }).click();
		await expect(page.getByText('Add a new product category')).toBeVisible();

		await page.locator('#categoryName').fill('Electronics');
		await page.locator('#categoryPricingMode').selectOption('markup_percentage');
		await page.locator('#categoryMarkup').fill('15');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		await expectRowVisible(page, 'Electronics');
		await expect(page.getByText('Markup %')).toBeVisible();
	});

	test('new category shows as Active', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/categories');
		await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Category' }).click();
		await expect(page.getByText('Add a new product category')).toBeVisible();

		await page.locator('#categoryName').fill('Snacks');
		await page.locator('#categoryPricingMode').selectOption('markup_fixed');
		await page.locator('#categoryMarkup').fill('5');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		const row = page.locator('tr', { hasText: 'Snacks' });
		await expect(row).toBeVisible({ timeout: 10_000 });
		await expect(row.getByText('Active', { exact: true })).toBeVisible();
	});

	test('admin can deactivate a category', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/categories');
		await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 10_000 });

		// Create a category first
		await page.getByRole('button', { name: 'Create Category' }).click();
		await expect(page.getByText('Add a new product category')).toBeVisible();
		await page.locator('#categoryName').fill('Temp Category');
		await page.locator('#categoryPricingMode').selectOption('markup_percentage');
		await page.locator('#categoryMarkup').fill('10');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		const row = page.locator('tr', { hasText: 'Temp Category' });
		await expect(row).toBeVisible({ timeout: 10_000 });

		// Deactivate it
		await row.getByRole('button', { name: 'Deactivate' }).click();

		await expect(row.getByText('Inactive')).toBeVisible({ timeout: 10_000 });
	});

	test('shows empty state when no categories', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/categories');
		await expect(page.getByText('No categories found.')).toBeVisible({ timeout: 10_000 });
	});
});

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------
test.describe('Units', () => {
	test('admin can create a unit', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/units');
		await expect(page.getByRole('heading', { name: 'Units' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Unit' }).click();
		await expect(page.getByText('Add a new unit of measurement')).toBeVisible();

		await page.locator('#unitName').fill('Kilogram');
		await page.locator('#unitDescription').fill('Metric weight unit');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		await expectRowVisible(page, 'Kilogram');
		await expect(page.getByText('Metric weight unit')).toBeVisible();
	});

	test('admin can create multiple units', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/units');
		await expect(page.getByRole('heading', { name: 'Units' })).toBeVisible({ timeout: 10_000 });

		// Create first unit
		await page.getByRole('button', { name: 'Create Unit' }).click();
		await expect(page.getByText('Add a new unit of measurement')).toBeVisible();
		await page.locator('#unitName').fill('Piece');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expectRowVisible(page, 'Piece');

		// Create second unit
		await page.getByRole('button', { name: 'Create Unit' }).click();
		await expect(page.getByText('Add a new unit of measurement')).toBeVisible();
		await page.locator('#unitName').fill('Box');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expectRowVisible(page, 'Box');

		// Both should be visible
		await expect(page.locator('tr', { hasText: 'Piece' })).toBeVisible();
		await expect(page.locator('tr', { hasText: 'Box' })).toBeVisible();
	});

	test('admin can deactivate a unit', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/units');
		await expect(page.getByRole('heading', { name: 'Units' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Unit' }).click();
		await expect(page.getByText('Add a new unit of measurement')).toBeVisible();
		await page.locator('#unitName').fill('Temp Unit');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		const row = page.locator('tr', { hasText: 'Temp Unit' });
		await expect(row).toBeVisible({ timeout: 10_000 });

		await row.getByRole('button', { name: 'Deactivate' }).click();

		await expect(row.getByText('Inactive')).toBeVisible({ timeout: 10_000 });
	});

	test('shows empty state when no units', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/units');
		await expect(page.getByText('No units found.')).toBeVisible({ timeout: 10_000 });
	});
});

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------
test.describe('Variants', () => {
	test('admin can create a variant', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/variants');
		await expect(page.getByRole('heading', { name: 'Variants' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Variant' }).click();
		await expect(page.getByText('Add a new product variant type')).toBeVisible();

		await page.locator('#variantName').fill('Size');
		await page.locator('#variantDescription').fill('Product size options');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		await expectRowVisible(page, 'Size');
		await expect(page.getByText('Product size options')).toBeVisible();
	});

	test('admin can create multiple variants', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/variants');
		await expect(page.getByRole('heading', { name: 'Variants' })).toBeVisible({ timeout: 10_000 });

		// Create first variant
		await page.getByRole('button', { name: 'Create Variant' }).click();
		await expect(page.getByText('Add a new product variant type')).toBeVisible();
		await page.locator('#variantName').fill('Size');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expectRowVisible(page, 'Size');

		// Create second variant
		await page.getByRole('button', { name: 'Create Variant' }).click();
		await expect(page.getByText('Add a new product variant type')).toBeVisible();
		await page.locator('#variantName').fill('Material');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expectRowVisible(page, 'Material');

		await expect(page.locator('tr', { hasText: 'Size' })).toBeVisible();
		await expect(page.locator('tr', { hasText: 'Material' })).toBeVisible();
	});

	test('admin can deactivate a variant', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/variants');
		await expect(page.getByRole('heading', { name: 'Variants' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Variant' }).click();
		await expect(page.getByText('Add a new product variant type')).toBeVisible();
		await page.locator('#variantName').fill('Temp Variant');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		const row = page.locator('tr', { hasText: 'Temp Variant' });
		await expect(row).toBeVisible({ timeout: 10_000 });

		await row.getByRole('button', { name: 'Deactivate' }).click();

		await expect(row.getByText('Inactive')).toBeVisible({ timeout: 10_000 });
	});

	test('shows empty state when no variants', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/variants');
		await expect(page.getByText('No variants found.')).toBeVisible({ timeout: 10_000 });
	});
});

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------
test.describe('Warehouses', () => {
	test('admin can create a warehouse', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/warehouses');
		await expect(page.getByRole('heading', { name: 'Warehouses' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Warehouse' }).click();
		await expect(page.getByText('Add a new warehouse location')).toBeVisible();

		await page.locator('#warehouseName').fill('Main Warehouse');
		await page.locator('#warehouseAddress').fill('123 Storage Rd');
		await page.locator('#warehousePhone').fill('555-0100');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		await expectRowVisible(page, 'Main Warehouse');
		await expect(page.getByText('123 Storage Rd')).toBeVisible();
		await expect(page.getByText('555-0100')).toBeVisible();
	});

	test('new warehouse shows as Active', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/warehouses');
		await expect(page.getByRole('heading', { name: 'Warehouses' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Warehouse' }).click();
		await expect(page.getByText('Add a new warehouse location')).toBeVisible();
		await page.locator('#warehouseName').fill('Central WH');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		const row = page.locator('tr', { hasText: 'Central WH' });
		await expect(row).toBeVisible({ timeout: 10_000 });
		await expect(row.getByText('Active', { exact: true })).toBeVisible();
	});

	test('admin can deactivate a warehouse', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/warehouses');
		await expect(page.getByRole('heading', { name: 'Warehouses' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Warehouse' }).click();
		await expect(page.getByText('Add a new warehouse location')).toBeVisible();
		await page.locator('#warehouseName').fill('Temp Warehouse');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		const row = page.locator('tr', { hasText: 'Temp Warehouse' });
		await expect(row).toBeVisible({ timeout: 10_000 });

		await row.getByRole('button', { name: 'Deactivate' }).click();

		await expect(row.getByText('Inactive')).toBeVisible({ timeout: 10_000 });
	});

	test('shows empty state when no warehouses', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/warehouses');
		await expect(page.getByText('No warehouses found.')).toBeVisible({ timeout: 10_000 });
	});
});

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
test.describe('Suppliers', () => {
	test('admin can create a supplier with all fields', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/suppliers');
		await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Supplier' }).click();
		await expect(page.getByText('Add a new supplier')).toBeVisible();

		await page.locator('#supplierName').fill('Acme Corp');
		await page.locator('#supplierContact').fill('John Doe');
		await page.locator('#supplierEmail').fill('john@acme.com');
		await page.locator('#supplierPhone').fill('555-0300');
		await page.locator('#supplierAddress').fill('456 Supplier St');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		await expectRowVisible(page, 'Acme Corp');
		await expect(page.getByText('John Doe')).toBeVisible();
		await expect(page.getByText('john@acme.com')).toBeVisible();
		await expect(page.getByText('555-0300')).toBeVisible();
	});

	test('admin can create a supplier with only required fields', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/suppliers');
		await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Supplier' }).click();
		await expect(page.getByText('Add a new supplier')).toBeVisible();
		await page.locator('#supplierName').fill('Simple Supplier');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		await expectRowVisible(page, 'Simple Supplier');
	});

	test('admin can deactivate a supplier', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/suppliers');
		await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Supplier' }).click();
		await expect(page.getByText('Add a new supplier')).toBeVisible();
		await page.locator('#supplierName').fill('Temp Supplier');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		const row = page.locator('tr', { hasText: 'Temp Supplier' });
		await expect(row).toBeVisible({ timeout: 10_000 });

		await row.getByRole('button', { name: 'Deactivate' }).click();

		await expect(row.getByText('Inactive')).toBeVisible({ timeout: 10_000 });
	});

	test('shows empty state when no suppliers', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/suppliers');
		await expect(page.getByText('No suppliers found.')).toBeVisible({ timeout: 10_000 });
	});
});

// ---------------------------------------------------------------------------
// Unit Conversions
// ---------------------------------------------------------------------------
test.describe('Unit Conversions', () => {
	test('admin can create a unit conversion', async ({ page }) => {
		await registerAdmin(page);

		// First create two units that we can convert between
		await page.goto('/settings/units');
		await expect(page.getByRole('heading', { name: 'Units' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Unit' }).click();
		await expect(page.getByText('Add a new unit of measurement')).toBeVisible();
		await page.locator('#unitName').fill('Kilogram');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expectRowVisible(page, 'Kilogram');

		await page.getByRole('button', { name: 'Create Unit' }).click();
		await expect(page.getByText('Add a new unit of measurement')).toBeVisible();
		await page.locator('#unitName').fill('Pound');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expectRowVisible(page, 'Pound');

		// Now navigate to unit conversions
		await page.goto('/settings/unit-conversions');
		await expect(page.getByRole('heading', { name: 'Unit Conversions' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Conversion' }).click();
		await expect(page.getByText('Define a conversion between two units')).toBeVisible();

		// Select from and to units
		await page.locator('#fromUnit').selectOption({ label: 'Kilogram' });
		await page.locator('#toUnit').selectOption({ label: 'Pound' });
		await page.locator('#conversionFactor').fill('2.205');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		// Verify the conversion row appears in the table
		const row = page.locator('tr', { hasText: 'Kilogram' });
		await expect(row).toBeVisible({ timeout: 10_000 });
		await expect(row.getByText('Pound', { exact: true })).toBeVisible();
		await expect(row.getByText('2.205')).toBeVisible();
	});

	test('admin can delete a unit conversion', async ({ page }) => {
		await registerAdmin(page);

		// Create units
		await page.goto('/settings/units');
		await expect(page.getByRole('heading', { name: 'Units' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Unit' }).click();
		await expect(page.getByText('Add a new unit of measurement')).toBeVisible();
		await page.locator('#unitName').fill('Liter');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expectRowVisible(page, 'Liter');

		await page.getByRole('button', { name: 'Create Unit' }).click();
		await expect(page.getByText('Add a new unit of measurement')).toBeVisible();
		await page.locator('#unitName').fill('Gallon');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expectRowVisible(page, 'Gallon');

		// Create conversion
		await page.goto('/settings/unit-conversions');
		await expect(page.getByRole('heading', { name: 'Unit Conversions' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: 'Create Conversion' }).click();
		await expect(page.getByText('Define a conversion between two units')).toBeVisible();
		await page.locator('#fromUnit').selectOption({ label: 'Liter' });
		await page.locator('#toUnit').selectOption({ label: 'Gallon' });
		await page.locator('#conversionFactor').fill('0.264');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		const row = page.locator('tr', { hasText: 'Liter' });
		await expect(row).toBeVisible({ timeout: 10_000 });

		// Delete it
		await row.getByRole('button', { name: 'Delete' }).click();

		await expect(page.getByText('No unit conversions found.')).toBeVisible({ timeout: 10_000 });
	});

	test('shows empty state when no conversions', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/unit-conversions');
		await expect(page.getByText('No unit conversions found.')).toBeVisible({ timeout: 10_000 });
	});
});

// ---------------------------------------------------------------------------
// Sidebar Navigation
// ---------------------------------------------------------------------------
test.describe('Master Data Navigation', () => {
	test('sidebar shows all master data links', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/dashboard');

		await expect(page.getByRole('link', { name: 'Categories' })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('link', { name: 'Units' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Variants' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Conversions' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Warehouses' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Suppliers' })).toBeVisible();
	});

	test('sidebar links navigate to correct pages', async ({ page }) => {
		await registerAdmin(page);

		await page.getByRole('link', { name: 'Categories' }).click();
		await expect(page).toHaveURL(/\/settings\/categories/);
		await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('link', { name: 'Units' }).click();
		await expect(page).toHaveURL(/\/settings\/units/);
		await expect(page.getByRole('heading', { name: 'Units' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('link', { name: 'Variants' }).click();
		await expect(page).toHaveURL(/\/settings\/variants/);
		await expect(page.getByRole('heading', { name: 'Variants' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('link', { name: 'Warehouses' }).click();
		await expect(page).toHaveURL(/\/settings\/warehouses/);
		await expect(page.getByRole('heading', { name: 'Warehouses' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('link', { name: 'Suppliers' }).click();
		await expect(page).toHaveURL(/\/settings\/suppliers/);
		await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('link', { name: 'Conversions' }).click();
		await expect(page).toHaveURL(/\/settings\/unit-conversions/);
		await expect(page.getByRole('heading', { name: 'Unit Conversions' })).toBeVisible({ timeout: 10_000 });
	});
});
