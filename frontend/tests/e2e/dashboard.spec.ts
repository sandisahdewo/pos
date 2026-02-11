import { test, expect } from '@playwright/test';

// Generate unique values per test run to avoid conflicts
function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function uniqueTenant(): string {
	return `Biz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe('Dashboard', () => {
	test('should load dashboard after login without getting stuck on Loading', async ({ page }) => {
		// Capture console logs
		page.on('console', (msg) => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));
		page.on('pageerror', (err) => console.error('[BROWSER ERROR]:', err));

		const email = uniqueEmail();
		const password = 'password123';
		const firstName = 'John';
		const storeName = 'Main Store';

		// Register a new user
		await page.goto('/register');
		await page.getByLabel('Business Name').fill(uniqueTenant());
		await page.getByLabel('First Name').fill(firstName);
		await page.getByLabel('Last Name').fill('Doe');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByLabel('Store Name').fill(storeName);
		await page.getByLabel('Store Address (optional)').fill('123 Test St');
		await page.getByRole('button', { name: 'Create Account' }).click();

		// Should redirect to dashboard
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

		// Should show the dashboard heading
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

		// Should show welcome message with user's first name (indicates auth initialized)
		await expect(page.getByText(`Welcome, ${firstName}!`)).toBeVisible({ timeout: 10_000 });

		// Should show the "Accessible Stores" card
		await expect(page.getByText('Accessible Stores')).toBeVisible();

		// Should show the "Permissions" card
		await expect(page.getByText('Permissions')).toBeVisible();

		// Should show the "Email Verified" card
		await expect(page.getByText('Email Verified')).toBeVisible();
	});

	test('should load dashboard from existing session', async ({ page }) => {
		const email = uniqueEmail();
		const password = 'password123';
		const firstName = 'Jane';

		// Register and login first
		await page.goto('/register');
		await page.getByLabel('Business Name').fill(uniqueTenant());
		await page.getByLabel('First Name').fill(firstName);
		await page.getByLabel('Last Name').fill('Smith');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByLabel('Store Name').fill('Test Store');
		await page.getByRole('button', { name: 'Create Account' }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

		// Verify dashboard loaded
		await expect(page.getByText(`Welcome, ${firstName}!`)).toBeVisible({ timeout: 10_000 });

		// Reload page to simulate returning with existing session
		await page.reload();

		// Should load and show dashboard content from existing session
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
		// Note: Due to Svelte 5 reactivity limitations with store getters,
		// we need a longer timeout for the user data to reactively update after reload
		await expect(page.getByText(`Welcome, ${firstName}!`)).toBeVisible({ timeout: 15_000 });
	});

	test('should show user information correctly on dashboard', async ({ page }) => {
		const email = uniqueEmail();
		const firstName = 'Alice';
		const lastName = 'Johnson';

		// Register
		await page.goto('/register');
		await page.getByLabel('Business Name').fill(uniqueTenant());
		await page.getByLabel('First Name').fill(firstName);
		await page.getByLabel('Last Name').fill(lastName);
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill('password123');
		await page.getByLabel('Store Name').fill('Store One');
		await page.getByRole('button', { name: 'Create Account' }).click();

		// Wait for dashboard
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

		// Verify user's first name appears in welcome message (indicates auth initialized)
		await expect(page.getByText(`Welcome, ${firstName}!`)).toBeVisible({ timeout: 10_000 });

		// Verify email verification status shows (should be "No" for new accounts)
		await expect(page.getByText('Email Verified')).toBeVisible();
		const emailVerifiedCard = page.locator('text=Email Verified').locator('..').locator('..');
		await expect(emailVerifiedCard.getByText('No')).toBeVisible();

		// Verify accessible stores shows (new registrations have all_stores_access = true, so shows "All")
		const storesCard = page.locator('text=Accessible Stores').locator('..').locator('..');
		await expect(storesCard.getByText('All')).toBeVisible();
	});
});
