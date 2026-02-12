import { test, expect, type Page } from '@playwright/test';

function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function uniqueTenant(): string {
	return `Prod Biz ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
 * Helper: create a category prerequisite for products
 */
async function createCategory(page: Page, name: string): Promise<void> {
	await page.goto('/settings/categories');
	await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 10_000 });

	await page.getByRole('button', { name: 'Create Category' }).click();
	await expect(page.getByText('Add a new product category')).toBeVisible();

	await page.locator('#categoryName').fill(name);
	await page.locator('#categoryPricingMode').selectOption('markup_percentage');
	await page.locator('#categoryMarkup').fill('10');
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page.locator('tr', { hasText: name })).toBeVisible({ timeout: 10_000 });
}

/**
 * Helper: create a unit prerequisite for products
 */
async function createUnit(page: Page, name: string): Promise<void> {
	await page.goto('/settings/units');
	await expect(page.getByRole('heading', { name: 'Units' })).toBeVisible({ timeout: 10_000 });

	await page.getByRole('button', { name: 'Create Unit' }).click();
	await expect(page.getByText('Add a new unit of measurement')).toBeVisible();

	await page.locator('#unitName').fill(name);
	await page.getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page.locator('tr', { hasText: name })).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Products - List Page
// ---------------------------------------------------------------------------
test.describe('Products - List', () => {
	test('shows empty state when no products', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/master-data/products');
		await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('No products found.')).toBeVisible({ timeout: 10_000 });
	});

	test('shows Create Product button', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/master-data/products');
		await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('link', { name: 'Create Product' })).toBeVisible();
	});

	test('Master Data sidebar link navigates to products', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/dashboard');
		await page.getByRole('link', { name: 'Master Data' }).click();
		await expect(page).toHaveURL(/\/master-data\/products/);
		await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible({ timeout: 10_000 });
	});
});

// ---------------------------------------------------------------------------
// Products - Create Flow
// ---------------------------------------------------------------------------
test.describe('Products - Create', () => {
	test('admin can create a simple product', async ({ page }) => {
		await registerAdmin(page);

		// Create prerequisites
		await createCategory(page, 'Electronics');
		await createUnit(page, 'Piece');

		// Navigate to create product
		await page.goto('/master-data/products/create');
		await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible({ timeout: 10_000 });

		// Fill basic information
		await page.getByLabel('Product Name').fill('USB Cable');
		await page.locator('#category').selectOption({ label: 'Electronics' });
		await page.locator('#sellMethod').selectOption('fifo');

		// Fill single variant details
		await page.getByLabel('SKU').fill('USB-001');
		await page.locator('#unit').selectOption({ label: 'Piece' });
		await page.getByLabel('Retail Price').fill('9.99');

		// Submit
		await page.getByRole('button', { name: 'Create Product' }).click();

		// Should redirect to product list
		await page.waitForURL(/\/master-data\/products$/, { timeout: 15_000 });

		// Product should appear in the list
		await expect(page.locator('tr', { hasText: 'USB Cable' })).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('tr', { hasText: 'Electronics' })).toBeVisible();
	});

	test('new product shows as active with correct status', async ({ page }) => {
		await registerAdmin(page);
		await createCategory(page, 'Gadgets');
		await createUnit(page, 'Box');

		await page.goto('/master-data/products/create');
		await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible({ timeout: 10_000 });

		await page.getByLabel('Product Name').fill('Phone Charger');
		await page.locator('#category').selectOption({ label: 'Gadgets' });

		await page.getByLabel('SKU').fill('CHG-001');
		await page.locator('#unit').selectOption({ label: 'Box' });
		await page.getByLabel('Retail Price').fill('15.00');

		await page.getByRole('button', { name: 'Create Product' }).click();
		await page.waitForURL(/\/master-data\/products$/, { timeout: 15_000 });

		const row = page.locator('tr', { hasText: 'Phone Charger' });
		await expect(row).toBeVisible({ timeout: 10_000 });
		await expect(row.getByText('active')).toBeVisible();
		await expect(row.getByText('FIFO')).toBeVisible();
	});

	test('back button returns to product list', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/master-data/products/create');
		await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible({ timeout: 10_000 });

		await page.getByRole('link', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/master-data\/products$/);
	});
});

// ---------------------------------------------------------------------------
// Products - Detail / Edit
// ---------------------------------------------------------------------------
test.describe('Products - Detail', () => {
	test('admin can view product detail', async ({ page }) => {
		await registerAdmin(page);
		await createCategory(page, 'Audio');
		await createUnit(page, 'Piece');

		// Create a product first
		await page.goto('/master-data/products/create');
		await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible({ timeout: 10_000 });

		await page.getByLabel('Product Name').fill('Headphones');
		await page.locator('#category').selectOption({ label: 'Audio' });
		await page.getByLabel('SKU').fill('HEAD-001');
		await page.locator('#unit').selectOption({ label: 'Piece' });
		await page.getByLabel('Retail Price').fill('49.99');

		await page.getByRole('button', { name: 'Create Product' }).click();
		await page.waitForURL(/\/master-data\/products$/, { timeout: 15_000 });

		// Click edit to go to detail page
		const row = page.locator('tr', { hasText: 'Headphones' });
		await expect(row).toBeVisible({ timeout: 10_000 });
		await row.getByRole('link', { name: 'Edit' }).click();

		// Verify detail page
		await expect(page.getByRole('heading', { name: 'Headphones' })).toBeVisible({ timeout: 10_000 });

		// Verify variant table
		await expect(page.getByText('HEAD-001')).toBeVisible();
	});

	test('admin can update product name', async ({ page }) => {
		await registerAdmin(page);
		await createCategory(page, 'Cables');
		await createUnit(page, 'Meter');

		// Create product
		await page.goto('/master-data/products/create');
		await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible({ timeout: 10_000 });

		await page.getByLabel('Product Name').fill('HDMI Cable');
		await page.locator('#category').selectOption({ label: 'Cables' });
		await page.getByLabel('SKU').fill('HDMI-001');
		await page.locator('#unit').selectOption({ label: 'Meter' });
		await page.getByLabel('Retail Price').fill('12.50');

		await page.getByRole('button', { name: 'Create Product' }).click();
		await page.waitForURL(/\/master-data\/products$/, { timeout: 15_000 });

		// Navigate to detail
		const row = page.locator('tr', { hasText: 'HDMI Cable' });
		await expect(row).toBeVisible({ timeout: 10_000 });
		await row.getByRole('link', { name: 'Edit' }).click();
		await expect(page.getByRole('heading', { name: 'HDMI Cable' })).toBeVisible({ timeout: 10_000 });

		// Update the name
		await page.getByLabel('Product Name').fill('Premium HDMI Cable');
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Success message
		await expect(page.getByText('Product updated successfully')).toBeVisible({ timeout: 10_000 });

		// Go back and verify list
		await page.getByRole('link', { name: 'Back' }).first().click();
		await expect(page.locator('tr', { hasText: 'Premium HDMI Cable' })).toBeVisible({ timeout: 10_000 });
	});

	test('admin can deactivate product', async ({ page }) => {
		await registerAdmin(page);
		await createCategory(page, 'Tools');
		await createUnit(page, 'Piece');

		// Create product
		await page.goto('/master-data/products/create');
		await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible({ timeout: 10_000 });

		await page.getByLabel('Product Name').fill('Screwdriver');
		await page.locator('#category').selectOption({ label: 'Tools' });
		await page.getByLabel('SKU').fill('SCRW-001');
		await page.locator('#unit').selectOption({ label: 'Piece' });
		await page.getByLabel('Retail Price').fill('8.00');

		await page.getByRole('button', { name: 'Create Product' }).click();
		await page.waitForURL(/\/master-data\/products$/, { timeout: 15_000 });

		// Navigate to detail
		const row = page.locator('tr', { hasText: 'Screwdriver' });
		await expect(row).toBeVisible({ timeout: 10_000 });
		await row.getByRole('link', { name: 'Edit' }).click();
		await expect(page.getByRole('heading', { name: 'Screwdriver' })).toBeVisible({ timeout: 10_000 });

		// Click deactivate
		await page.getByRole('button', { name: 'Deactivate' }).first().click();

		// Confirm in dialog
		await expect(page.getByText('Are you sure you want to deactivate this product?')).toBeVisible({ timeout: 5_000 });
		await page.getByRole('button', { name: 'Deactivate' }).last().click();

		// Should redirect to list
		await page.waitForURL(/\/master-data\/products$/, { timeout: 15_000 });
	});
});

// ---------------------------------------------------------------------------
// Products - Stock Page
// ---------------------------------------------------------------------------
test.describe('Products - Stock', () => {
	test('admin can view stock page', async ({ page }) => {
		await registerAdmin(page);
		await createCategory(page, 'Beverages');
		await createUnit(page, 'Bottle');

		// Create product
		await page.goto('/master-data/products/create');
		await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible({ timeout: 10_000 });

		await page.getByLabel('Product Name').fill('Water');
		await page.locator('#category').selectOption({ label: 'Beverages' });
		await page.getByLabel('SKU').fill('WTR-001');
		await page.locator('#unit').selectOption({ label: 'Bottle' });
		await page.getByLabel('Retail Price').fill('1.50');

		await page.getByRole('button', { name: 'Create Product' }).click();
		await page.waitForURL(/\/master-data\/products$/, { timeout: 15_000 });

		// Click stock link
		const row = page.locator('tr', { hasText: 'Water' });
		await expect(row).toBeVisible({ timeout: 10_000 });
		await row.getByRole('link', { name: 'Stock' }).click();

		// Verify stock page
		await expect(page.getByRole('heading', { name: 'Stock Overview' })).toBeVisible({ timeout: 10_000 });

		// Should show empty stock or No stock data message
		await expect(page.getByText('No stock data available.')).toBeVisible({ timeout: 10_000 });
	});

	test('stock page has back link to product detail', async ({ page }) => {
		await registerAdmin(page);
		await createCategory(page, 'Snacks');
		await createUnit(page, 'Pack');

		// Create product
		await page.goto('/master-data/products/create');
		await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible({ timeout: 10_000 });

		await page.getByLabel('Product Name').fill('Chips');
		await page.locator('#category').selectOption({ label: 'Snacks' });
		await page.getByLabel('SKU').fill('CHP-001');
		await page.locator('#unit').selectOption({ label: 'Pack' });
		await page.getByLabel('Retail Price').fill('3.00');

		await page.getByRole('button', { name: 'Create Product' }).click();
		await page.waitForURL(/\/master-data\/products$/, { timeout: 15_000 });

		// Navigate to stock
		const row = page.locator('tr', { hasText: 'Chips' });
		await expect(row).toBeVisible({ timeout: 10_000 });
		await row.getByRole('link', { name: 'Stock' }).click();
		await expect(page.getByRole('heading', { name: 'Stock Overview' })).toBeVisible({ timeout: 10_000 });

		// Click back
		await page.getByRole('link', { name: 'Back to Product' }).click();
		await expect(page.getByRole('heading', { name: 'Chips' })).toBeVisible({ timeout: 10_000 });
	});
});

// ---------------------------------------------------------------------------
// Products - Category Filter
// ---------------------------------------------------------------------------
test.describe('Products - Category Filter', () => {
	test('category filter shows created categories', async ({ page }) => {
		await registerAdmin(page);
		await createCategory(page, 'FilterCat1');
		await createCategory(page, 'FilterCat2');

		await page.goto('/master-data/products');
		await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible({ timeout: 10_000 });

		// Both categories should appear in filter dropdown
		const select = page.locator('#categoryFilter');
		await expect(select).toBeVisible();
		await expect(select.locator('option', { hasText: 'FilterCat1' })).toBeAttached();
		await expect(select.locator('option', { hasText: 'FilterCat2' })).toBeAttached();
	});
});
