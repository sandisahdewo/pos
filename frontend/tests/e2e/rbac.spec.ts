import { test, expect, type Page } from '@playwright/test';

function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function uniqueTenant(): string {
	return `RBAC Biz ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Helper: register a new admin user and return credentials + authenticated page.
 */
async function registerAdmin(page: Page): Promise<{ email: string; password: string }> {
	const email = uniqueEmail();
	const password = 'password123';

	await page.goto('/register');
	await page.getByLabel('Business Name').fill(uniqueTenant());
	await page.getByLabel('First Name').fill('Admin');
	await page.getByLabel('Last Name').fill('User');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByLabel('Store Name').fill('Main Store');
	await page.getByRole('button', { name: 'Create Account' }).click();
	await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

	return { email, password };
}

test.describe('RBAC - Role Based Access Control', () => {
	test('admin user sees all sidebar navigation items', async ({ page }) => {
		await registerAdmin(page);

		// Navigate to dashboard
		await page.goto('/dashboard');

		// Admin should see main navigation items
		await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

		// Settings section should be visible
		await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Stores' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Roles' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();

		// New master data settings should also be visible
		await expect(page.getByRole('link', { name: 'Categories' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Units' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Variants' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Warehouses' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Suppliers' })).toBeVisible();
	});

	test('admin can create a new role', async ({ page }) => {
		await registerAdmin(page);

		// Navigate to roles page
		await page.goto('/settings/roles');
		await expect(page.getByText('Roles').first()).toBeVisible();

		// Should see the default Administrator role
		await expect(page.getByText('Administrator')).toBeVisible({ timeout: 10_000 });

		// Click "Create Role" button
		await page.getByRole('button', { name: 'Create Role' }).click();

		// Fill in the dialog form
		await expect(page.getByText('Add a new role for your team')).toBeVisible();
		await page.getByLabel('Role Name').fill('Sales Manager');
		await page.getByLabel('Description (optional)').fill('Can manage sales data');

		// Submit
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		// Should show the new role in the table
		await expect(page.getByText('Sales Manager')).toBeVisible({ timeout: 10_000 });

		// The new role should be marked as Custom (not System)
		await expect(page.getByText('Custom')).toBeVisible();
	});

	test('admin can view role details and edit permissions', async ({ page }) => {
		await registerAdmin(page);

		// Navigate to roles page
		await page.goto('/settings/roles');
		await expect(page.getByText('Administrator')).toBeVisible({ timeout: 10_000 });

		// Click edit on Administrator role
		await page.getByRole('link', { name: 'Edit' }).first().click();

		// Should navigate to role detail page
		await expect(page).toHaveURL(/\/settings\/roles\/.+/);
	});

	test('system default role is protected', async ({ page }) => {
		await registerAdmin(page);

		// Navigate to roles page
		await page.goto('/settings/roles');
		await expect(page.getByText('Administrator')).toBeVisible({ timeout: 10_000 });

		// Administrator role should be marked as System (badge)
		await expect(page.getByText('System', { exact: true })).toBeVisible();
	});

	test('admin can access all settings pages', async ({ page }) => {
		await registerAdmin(page);

		// Profile
		await page.goto('/settings/profile');
		await expect(page).toHaveURL(/\/settings\/profile/);

		// Stores
		await page.goto('/settings/stores');
		await expect(page.getByText('Stores').first()).toBeVisible();

		// Roles
		await page.goto('/settings/roles');
		await expect(page.getByText('Roles').first()).toBeVisible();

		// Users
		await page.goto('/settings/users');
		await expect(page.getByText('Users').first()).toBeVisible();
	});
});
