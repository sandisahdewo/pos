import { test, expect } from '@playwright/test';

// Generate unique values per test run to avoid conflicts
function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function uniqueTenant(): string {
	return `Biz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function decodeQuotedPrintable(str: string): string {
	return str
		.replace(/=\r?\n/g, '') // Remove soft line breaks
		.replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
			String.fromCharCode(parseInt(hex, 16))
		);
}

test.describe('Authentication', () => {
	test.describe('Registration', () => {
		test('should register a new account with first store', async ({ page }) => {
			const email = uniqueEmail();

			await page.goto('/register');
			await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();

			await page.getByLabel('Business Name').fill(uniqueTenant());
			await page.getByLabel('First Name').fill('John');
			await page.getByLabel('Last Name').fill('Doe');
			await page.getByLabel('Email').fill(email);
			await page.getByLabel('Password').fill('password123');
			await page.getByLabel('Store Name').fill('Main Store');
			await page.getByLabel('Store Address (optional)').fill('123 Test St');

			await page.getByRole('button', { name: 'Create Account' }).click();

			// Should redirect to dashboard after successful registration
			await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
		});

		test('should show error for duplicate email registration', async ({ page }) => {
			const email = uniqueEmail();

			// Register first time
			await page.goto('/register');
			await page.getByLabel('Business Name').fill(uniqueTenant());
			await page.getByLabel('First Name').fill('Jane');
			await page.getByLabel('Last Name').fill('Doe');
			await page.getByLabel('Email').fill(email);
			await page.getByLabel('Password').fill('password123');
			await page.getByLabel('Store Name').fill('Store One');
			await page.getByRole('button', { name: 'Create Account' }).click();
			await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

			// Clear session and try to register again with same email
			await page.evaluate(() => localStorage.clear());
			await page.goto('/register');
			await page.getByLabel('Business Name').fill(uniqueTenant());
			await page.getByLabel('First Name').fill('Jane');
			await page.getByLabel('Last Name').fill('Doe');
			await page.getByLabel('Email').fill(email);
			await page.getByLabel('Password').fill('password123');
			await page.getByLabel('Store Name').fill('Store Two');
			await page.getByRole('button', { name: 'Create Account' }).click();

			// Should show an inline error message
			await expect(page.locator('.text-destructive')).toBeVisible({
				timeout: 10_000
			});
		});

		test('should have link to login page', async ({ page }) => {
			await page.goto('/register');
			const signInLink = page.getByRole('link', { name: 'Sign in' });
			await expect(signInLink).toBeVisible();
			await expect(signInLink).toHaveAttribute('href', '/login');
		});
	});

	test.describe('Login', () => {
		let email: string;
		const password = 'password123';

		test.beforeAll(async ({ browser }) => {
			// Create a user to login with
			email = uniqueEmail();
			const context = await browser.newContext();
			const page = await context.newPage();
			await page.goto('http://localhost:5173/register');
			await page.getByLabel('Business Name').fill(uniqueTenant());
			await page.getByLabel('First Name').fill('Test');
			await page.getByLabel('Last Name').fill('User');
			await page.getByLabel('Email').fill(email);
			await page.getByLabel('Password').fill(password);
			await page.getByLabel('Store Name').fill('Test Store');
			await page.getByRole('button', { name: 'Create Account' }).click();
			await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
			await context.close();
		});

		test('should login with valid credentials', async ({ page }) => {
			await page.goto('/login');
			await expect(page.getByText('Sign In').first()).toBeVisible();

			await page.getByLabel('Email').fill(email);
			await page.getByLabel('Password').fill(password);
			await page.getByRole('button', { name: 'Sign In' }).click();

			await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
		});

		test('should show error with invalid credentials', async ({ page }) => {
			await page.goto('/login');

			await page.getByLabel('Email').fill(email);
			await page.getByLabel('Password').fill('wrongpassword');
			await page.getByRole('button', { name: 'Sign In' }).click();

			// Should show inline error message
			await expect(page.locator('.text-destructive')).toBeVisible({
				timeout: 10_000
			});

			// Should remain on login page
			await expect(page).toHaveURL(/\/login/);
		});

		test('should show error with non-existent email', async ({ page }) => {
			await page.goto('/login');

			await page.getByLabel('Email').fill('nonexistent@example.com');
			await page.getByLabel('Password').fill('password123');
			await page.getByRole('button', { name: 'Sign In' }).click();

			// Should show inline error message
			await expect(page.locator('.text-destructive')).toBeVisible({
				timeout: 10_000
			});
		});

		test('should have links to register and forgot password', async ({ page }) => {
			await page.goto('/login');

			await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
			await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
		});
	});

	test.describe('Email Verification', () => {
		test('should register and verify email via MailHog', async ({ page, request }) => {
			const email = uniqueEmail();

			// Register
			await page.goto('/register');
			await page.getByLabel('Business Name').fill(uniqueTenant());
			await page.getByLabel('First Name').fill('Verify');
			await page.getByLabel('Last Name').fill('User');
			await page.getByLabel('Email').fill(email);
			await page.getByLabel('Password').fill('password123');
			await page.getByLabel('Store Name').fill('Verify Store');
			await page.getByRole('button', { name: 'Create Account' }).click();
			await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

			// Check MailHog for verification email (with retry for async delivery)
			let mailData: { total: number; items: Array<{ Content: { Body: string } }> } = {
				total: 0,
				items: []
			};
			for (let i = 0; i < 10; i++) {
				await page.waitForTimeout(1000);
				const mailResponse = await request.get(
					`http://mailhog:8025/api/v2/search?kind=to&query=${encodeURIComponent(email)}`
				);
				expect(mailResponse.ok()).toBe(true);
				mailData = await mailResponse.json();
				if (mailData.total > 0) break;
			}
			expect(mailData.total).toBeGreaterThan(0);

			// Extract token from the email body (decode quoted-printable encoding)
			const emailBody = decodeQuotedPrintable(mailData.items[0].Content.Body);
			const tokenMatch = emailBody.match(/[?&]token=([a-fA-F0-9]+)/);
			expect(tokenMatch).not.toBeNull();
			const token = tokenMatch![1];

			// Clear auth session so the (auth) layout doesn't redirect to /dashboard
			await page.evaluate(() => localStorage.clear());

			// Visit verification URL
			await page.goto(`/verify-email?token=${token}`);

			// Should show success message
			await expect(page.getByText('Your email has been verified successfully!')).toBeVisible({
				timeout: 10_000
			});
		});

		test('should show error for invalid verification token', async ({ page }) => {
			await page.goto('/verify-email?token=invalidtoken123');

			// Should show error
			await expect(page.getByText(/invalid|expired|error/i)).toBeVisible({ timeout: 10_000 });
		});

		test('should show error for missing verification token', async ({ page }) => {
			await page.goto('/verify-email');

			await expect(page.getByText('Invalid or missing verification token')).toBeVisible({
				timeout: 10_000
			});
		});
	});
});
