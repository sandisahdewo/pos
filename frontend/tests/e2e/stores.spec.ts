import { test, expect, type Page } from '@playwright/test';

function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function uniqueTenant(): string {
	return `Store Biz ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function registerAdmin(page: Page): Promise<{ email: string; password: string }> {
	const email = uniqueEmail();
	const password = 'password123';

	await page.goto('/register');
	await page.getByLabel('Business Name').fill(uniqueTenant());
	await page.getByLabel('First Name').fill('Admin');
	await page.getByLabel('Last Name').fill('Manager');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByLabel('Store Name').fill('Main Store');
	await page.getByLabel('Store Address (optional)').fill('100 Main St');
	await page.getByRole('button', { name: 'Create Account' }).click();
	await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

	return { email, password };
}

test.describe('Store Management', () => {
	test('registration creates the first store', async ({ page }) => {
		await registerAdmin(page);

		// Navigate to stores page
		await page.goto('/settings/stores');
		await expect(page.getByText('Stores').first()).toBeVisible({ timeout: 10_000 });

		// Should see the first store created during registration
		await expect(page.getByText('Main Store')).toBeVisible();
		await expect(page.getByText('100 Main St')).toBeVisible();
		await expect(page.getByText('Active')).toBeVisible();
	});

	test('admin can create a new store', async ({ page }) => {
		await registerAdmin(page);

		// Navigate to stores page
		await page.goto('/settings/stores');
		await expect(page.getByText('Main Store')).toBeVisible({ timeout: 10_000 });

		// Click "Create Store"
		await page.getByRole('button', { name: 'Create Store' }).click();

		// Fill in the dialog
		await expect(page.getByText('Add a new store to your business')).toBeVisible();
		await page.getByLabel('Store Name').fill('Branch Store');
		await page.getByLabel('Address (optional)').fill('200 Branch Ave');
		await page.getByLabel('Phone (optional)').fill('555-0200');

		// Submit
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		// Should show success message
		await expect(page.getByText('Store created successfully')).toBeVisible({
			timeout: 10_000
		});

		// New store should appear in the table
		await expect(page.getByText('Branch Store')).toBeVisible();
		await expect(page.getByText('200 Branch Ave')).toBeVisible();
	});

	test('admin can create multiple stores', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/stores');
		await expect(page.getByText('Main Store')).toBeVisible({ timeout: 10_000 });

		// Create second store
		await page.getByRole('button', { name: 'Create Store' }).click();
		await page.getByLabel('Store Name').fill('North Branch');
		await page.getByLabel('Address (optional)').fill('300 North St');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expect(page.getByText('Store created successfully')).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByText('North Branch')).toBeVisible();

		// Create third store
		await page.getByRole('button', { name: 'Create Store' }).click();
		await page.getByLabel('Store Name').fill('South Branch');
		await page.getByLabel('Address (optional)').fill('400 South St');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		// All three stores should be visible
		await expect(page.getByText('Main Store')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('North Branch')).toBeVisible();
		await expect(page.getByText('South Branch')).toBeVisible();
	});

	test('admin can deactivate a store', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/stores');
		await expect(page.getByText('Main Store')).toBeVisible({ timeout: 10_000 });

		// Create a store to deactivate
		await page.getByRole('button', { name: 'Create Store' }).click();
		await page.getByLabel('Store Name').fill('Temp Store');
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expect(page.getByText('Temp Store')).toBeVisible({ timeout: 10_000 });

		// Deactivate the new store
		// Find the row with "Temp Store" and click its Deactivate button
		const tempRow = page.locator('tr', { hasText: 'Temp Store' });
		await tempRow.getByRole('button', { name: 'Deactivate' }).click();

		// Should show success message
		await expect(page.getByText('Store deactivated')).toBeVisible({
			timeout: 10_000
		});

		// Store should now show as Inactive
		await expect(tempRow.getByText('Inactive')).toBeVisible({ timeout: 10_000 });
	});

	test('dashboard shows accessible stores info for admin user', async ({ page }) => {
		await registerAdmin(page);

		// Admin with all_stores_access should see Accessible Stores: All on dashboard
		await page.goto('/dashboard');
		await expect(page.getByText('Accessible Stores')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('All')).toBeVisible();
	});

	test('cannot create store with duplicate name in same tenant', async ({ page }) => {
		await registerAdmin(page);
		await page.goto('/settings/stores');
		await expect(page.getByText('Main Store')).toBeVisible({ timeout: 10_000 });

		// Try to create a store with the same name
		await page.getByRole('button', { name: 'Create Store' }).click();
		await page.getByLabel('Store Name').fill('Main Store');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		// Should show error message (inline Alert)
		await expect(page.getByText(/already exists|conflict/i)).toBeVisible({
			timeout: 10_000
		});
	});
});
