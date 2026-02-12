import { test, expect } from '@playwright/test';

// Generate unique values per test run to avoid conflicts
function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function uniqueTenant(): string {
	return `Biz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe('Profile Settings', () => {
	test('should display user information correctly in profile page', async ({ page }) => {
		const email = uniqueEmail();
		const password = 'password123';
		const firstName = 'Alice';
		const lastName = 'Johnson';
		const businessName = uniqueTenant();

		// Register a new user
		await page.goto('/register');
		await page.getByLabel('Business Name').fill(businessName);
		await page.getByLabel('First Name').fill(firstName);
		await page.getByLabel('Last Name').fill(lastName);
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByLabel('Store Name').fill('Test Store');
		await page.getByRole('button', { name: 'Create Account' }).click();

		// Wait for redirect to dashboard
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

		// Navigate to profile settings
		await page.goto('/settings/profile');

		// Wait for profile page to load
		await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

		// Verify personal information fields are filled correctly
		const firstNameInput = page.getByLabel('First Name');
		const lastNameInput = page.getByLabel('Last Name');
		const emailInput = page.getByLabel('Email');

		// Wait for fields to be populated (auth initialization)
		// Note: Due to Svelte 5 reactivity limitations, fields may take time to populate
		await expect(firstNameInput).toHaveValue(firstName, { timeout: 20_000 });
		await expect(lastNameInput).toHaveValue(lastName, { timeout: 5_000 });
		await expect(emailInput).toHaveValue(email, { timeout: 5_000 });

		// Verify email field is disabled
		await expect(emailInput).toBeDisabled();
	});

	test('should update profile information successfully', async ({ page }) => {
		const email = uniqueEmail();
		const password = 'password123';
		const originalFirstName = 'John';
		const originalLastName = 'Doe';
		const updatedFirstName = 'Jane';
		const updatedLastName = 'Smith';

		// Register and login
		await page.goto('/register');
		await page.getByLabel('Business Name').fill(uniqueTenant());
		await page.getByLabel('First Name').fill(originalFirstName);
		await page.getByLabel('Last Name').fill(originalLastName);
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByLabel('Store Name').fill('My Store');
		await page.getByRole('button', { name: 'Create Account' }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

		// Navigate to profile
		await page.goto('/settings/profile');
		await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

		// Wait for fields to populate
		await expect(page.getByLabel('First Name')).toHaveValue(originalFirstName, {
			timeout: 10_000
		});

		// Update profile information
		await page.getByLabel('First Name').fill(updatedFirstName);
		await page.getByLabel('Last Name').fill(updatedLastName);
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Wait for success message
		await expect(page.getByText('Profile updated')).toBeVisible({ timeout: 10_000 });

		// Verify the form still shows updated values
		await expect(page.getByLabel('First Name')).toHaveValue(updatedFirstName);
		await expect(page.getByLabel('Last Name')).toHaveValue(updatedLastName);

		// Navigate to dashboard to verify the name updated there too
		await page.goto('/dashboard');
		await expect(page.getByText(`Welcome, ${updatedFirstName}!`)).toBeVisible({
			timeout: 10_000
		});
	});

	test('should show validation error when passwords do not match', async ({ page }) => {
		const email = uniqueEmail();
		const password = 'password123';

		// Register and login
		await page.goto('/register');
		await page.getByLabel('Business Name').fill(uniqueTenant());
		await page.getByLabel('First Name').fill('Test');
		await page.getByLabel('Last Name').fill('User');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByLabel('Store Name').fill('Test Store');
		await page.getByRole('button', { name: 'Create Account' }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

		// Navigate to profile
		await page.goto('/settings/profile');
		await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

		// Try to change password with mismatched passwords
		await page.getByLabel('Current Password').fill(password);
		await page.getByLabel('New Password', { exact: true }).fill('newpassword123');
		await page.getByLabel('Confirm New Password').fill('differentpassword');
		await page.getByRole('button', { name: 'Change Password' }).click();

		// Should show error message
		await expect(page.getByText('Passwords do not match')).toBeVisible({ timeout: 5_000 });
	});
});
