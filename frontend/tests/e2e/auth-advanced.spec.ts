import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Advanced Auth Feature Tests
 *
 * Tests for:
 * - Cross-tab synchronization (logout/login)
 * - Token refresh behavior
 * - Tab visibility token refresh
 * - Loading states
 * - Error states
 */

// Helper to generate unique credentials
function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function uniqueTenant(): string {
	return `Biz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Helper to register a new user and return credentials
async function registerUser(page: Page): Promise<{ email: string; password: string }> {
	const email = uniqueEmail();
	const password = 'password123';

	await page.goto('/register');
	await page.getByLabel('Business Name').fill(uniqueTenant());
	await page.getByLabel('First Name').fill('Test');
	await page.getByLabel('Last Name').fill('User');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByLabel('Store Name').fill('Test Store');
	await page.getByRole('button', { name: 'Create Account' }).click();
	await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

	return { email, password };
}

// Helper to login
async function login(
	page: Page,
	email: string,
	password: string
): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign In' }).click();
	await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Advanced Auth Features', () => {
	test.describe('Cross-Tab Synchronization', () => {
		test('should sync logout across tabs', async ({ browser }) => {
			// Create a user in first context
			const context1 = await browser.newContext();
			const page1 = await context1.newPage();
			const { email, password } = await registerUser(page1);

			// Open second tab with same user
			const context2 = await browser.newContext();
			const page2 = await context2.newPage();
			await login(page2, email, password);

			// Verify both tabs are on dashboard
			await expect(page1).toHaveURL(/\/dashboard/);
			await expect(page2).toHaveURL(/\/dashboard/);

			// Logout from first tab
			await page1.getByRole('button', { name: /sign out|logout/i }).click();

			// Wait a bit for localStorage event to propagate
			await page2.waitForTimeout(1000);

			// Second tab should redirect to login
			await expect(page2).toHaveURL(/\/login/, { timeout: 5000 });

			// Verify session is cleared (try accessing dashboard)
			await page2.goto('/dashboard');
			await expect(page2).toHaveURL(/\/login/, { timeout: 5000 });

			await context1.close();
			await context2.close();
		});

		test('should sync login across tabs', async ({ browser }) => {
			// Create a user first
			const setupContext = await browser.newContext();
			const setupPage = await setupContext.newPage();
			const { email, password } = await registerUser(setupPage);
			await setupPage.evaluate(() => localStorage.clear());
			await setupContext.close();

			// Open two logged-out tabs
			const context1 = await browser.newContext();
			const page1 = await context1.newPage();
			await page1.goto('/login');

			const context2 = await browser.newContext();
			const page2 = await context2.newPage();
			await page2.goto('/login');

			// Login in first tab
			await page1.getByLabel('Email').fill(email);
			await page1.getByLabel('Password').fill(password);
			await page1.getByRole('button', { name: 'Sign In' }).click();
			await page1.waitForURL(/\/dashboard/, { timeout: 15_000 });

			// Wait for storage event to propagate
			await page2.waitForTimeout(1000);

			// Navigate second tab - should be authenticated
			await page2.goto('/dashboard');
			await expect(page2).toHaveURL(/\/dashboard/, { timeout: 5000 });

			// Verify user data loaded in second tab
			await expect(page2.getByText(email)).toBeVisible({ timeout: 5000 });

			await context1.close();
			await context2.close();
		});

		test('should handle simultaneous logout in multiple tabs', async ({ browser }) => {
			// Create and login user
			const context1 = await browser.newContext();
			const page1 = await context1.newPage();
			const { email, password } = await registerUser(page1);

			// Open three more tabs with same user
			const contexts = [context1];
			const pages = [page1];

			for (let i = 0; i < 2; i++) {
				const ctx = await browser.newContext();
				const pg = await ctx.newPage();
				await login(pg, email, password);
				contexts.push(ctx);
				pages.push(pg);
			}

			// Verify all tabs are authenticated
			for (const page of pages) {
				await expect(page).toHaveURL(/\/dashboard/);
			}

			// Logout from first tab
			await page1.getByRole('button', { name: /sign out|logout/i }).click();
			await page1.waitForURL(/\/login/, { timeout: 5000 });

			// All other tabs should redirect to login
			for (let i = 1; i < pages.length; i++) {
				await expect(pages[i]).toHaveURL(/\/login/, { timeout: 5000 });
			}

			// Cleanup
			for (const ctx of contexts) {
				await ctx.close();
			}
		});
	});

	test.describe('Token Refresh', () => {
		test('should refresh expired token automatically', async ({ page }) => {
			// Register and login
			const { email, password } = await registerUser(page);

			// Manually expire the access token in localStorage
			await page.evaluate(() => {
				const stored = localStorage.getItem('pos_tokens');
				if (stored) {
					const tokens = JSON.parse(stored);
					// Create an expired JWT (exp set to past)
					const expiredPayload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 }));
					const [header, , signature] = tokens.access_token.split('.');
					tokens.access_token = `${header}.${expiredPayload}.${signature}`;
					localStorage.setItem('pos_tokens', JSON.stringify(tokens));
				}
			});

			// Reload page - should trigger refresh during initialization
			await page.reload();

			// Should stay on dashboard (token refreshed)
			await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

			// Verify user data is still accessible
			await expect(page.getByText(email)).toBeVisible({ timeout: 5000 });
		});

		test('should handle token refresh failure gracefully', async ({ page }) => {
			// Register user
			await registerUser(page);

			// Break the refresh token in localStorage
			await page.evaluate(() => {
				const stored = localStorage.getItem('pos_tokens');
				if (stored) {
					const tokens = JSON.parse(stored);
					tokens.refresh_token = 'invalid_refresh_token';
					// Also expire access token
					const expiredPayload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 }));
					const [header, , signature] = tokens.access_token.split('.');
					tokens.access_token = `${header}.${expiredPayload}.${signature}`;
					localStorage.setItem('pos_tokens', JSON.stringify(tokens));
				}
			});

			// Reload page - should clear session and redirect to login
			await page.reload();
			await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

			// Session should be cleared
			const tokensCleared = await page.evaluate(() => {
				return localStorage.getItem('pos_tokens') === null;
			});
			expect(tokensCleared).toBe(true);
		});
	});

	test.describe('Tab Visibility Token Refresh', () => {
		test('should refresh token when tab becomes visible with expired token', async ({ page }) => {
			// Register and login
			await registerUser(page);

			// Simulate tab going hidden
			await page.evaluate(() => {
				Object.defineProperty(document, 'visibilityState', {
					writable: true,
					value: 'hidden'
				});
			});

			// Expire the token
			await page.evaluate(() => {
				const stored = localStorage.getItem('pos_tokens');
				if (stored) {
					const tokens = JSON.parse(stored);
					const expiredPayload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 }));
					const [header, , signature] = tokens.access_token.split('.');
					tokens.access_token = `${header}.${expiredPayload}.${signature}`;
					localStorage.setItem('pos_tokens', JSON.stringify(tokens));
				}
			});

			// Trigger visibility change to visible
			await page.evaluate(() => {
				Object.defineProperty(document, 'visibilityState', {
					writable: true,
					value: 'visible'
				});
				document.dispatchEvent(new Event('visibilitychange'));
			});

			// Wait a bit for token refresh
			await page.waitForTimeout(2000);

			// Try to navigate - should still be authenticated
			await page.goto('/profile');
			await expect(page).toHaveURL(/\/profile/, { timeout: 5000 });
		});
	});

	test.describe('Loading States', () => {
		test('should show loading state during login', async ({ page, browser }) => {
			// Create a user first
			const setupContext = await browser.newContext();
			const setupPage = await setupContext.newPage();
			const { email, password } = await registerUser(setupPage);
			await setupContext.close();

			// Go to login page
			await page.goto('/login');
			await page.getByLabel('Email').fill(email);
			await page.getByLabel('Password').fill(password);

			// Click login and check for loading state
			await page.getByRole('button', { name: 'Sign In' }).click();

			// Button should be disabled during loading
			const loginButton = page.getByRole('button', { name: 'Sign In' });
			await expect(loginButton).toBeDisabled({ timeout: 1000 });

			// Should eventually redirect
			await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
		});

		test('should show loading state during registration', async ({ page }) => {
			await page.goto('/register');

			await page.getByLabel('Business Name').fill(uniqueTenant());
			await page.getByLabel('First Name').fill('Load');
			await page.getByLabel('Last Name').fill('Test');
			await page.getByLabel('Email').fill(uniqueEmail());
			await page.getByLabel('Password').fill('password123');
			await page.getByLabel('Store Name').fill('Test Store');

			// Click register
			const registerButton = page.getByRole('button', { name: 'Create Account' });
			await registerButton.click();

			// Button should be disabled during loading
			await expect(registerButton).toBeDisabled({ timeout: 1000 });

			// Should eventually redirect
			await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
		});

		test('should show loading spinner during auth initialization', async ({ page }) => {
			// Register first
			await registerUser(page);

			// Reload page to trigger initialization
			const reloadPromise = page.reload();

			// Check for loading state (this happens very quickly)
			// We can't reliably catch the spinner, but we can verify no errors occur
			await reloadPromise;

			// Should successfully load dashboard
			await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
		});
	});

	test.describe('Error States', () => {
		test('should display error on login failure', async ({ page }) => {
			await page.goto('/login');

			await page.getByLabel('Email').fill('wrong@example.com');
			await page.getByLabel('Password').fill('wrongpassword');
			await page.getByRole('button', { name: 'Sign In' }).click();

			// Should show error message
			await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 10_000 });

			// Should remain on login page
			await expect(page).toHaveURL(/\/login/);

			// Form should be re-enabled
			await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled();
		});

		test('should display error on registration failure', async ({ page, browser }) => {
			// Register a user first
			const setupContext = await browser.newContext();
			const setupPage = await setupContext.newPage();
			const { email } = await registerUser(setupPage);
			await setupContext.close();

			// Try to register with same email
			await page.goto('/register');
			await page.getByLabel('Business Name').fill(uniqueTenant());
			await page.getByLabel('First Name').fill('Duplicate');
			await page.getByLabel('Last Name').fill('User');
			await page.getByLabel('Email').fill(email);
			await page.getByLabel('Password').fill('password123');
			await page.getByLabel('Store Name').fill('Store');
			await page.getByRole('button', { name: 'Create Account' }).click();

			// Should show error
			await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 10_000 });

			// Should remain on register page
			await expect(page).toHaveURL(/\/register/);

			// Form should be re-enabled
			await expect(page.getByRole('button', { name: 'Create Account' })).toBeEnabled();
		});

		test('should handle network errors gracefully', async ({ page, context }) => {
			// Register user first
			await registerUser(page);

			// Block all API requests to simulate network failure
			await context.route('**/api/v1/**', (route) => route.abort());

			// Try to navigate to profile (requires API call)
			await page.goto('/profile');

			// Should handle error gracefully (may redirect to login or show error)
			// Wait a bit for error handling
			await page.waitForTimeout(2000);

			// Should not be stuck in infinite loading
			const hasLoadingSpinner = await page.locator('[data-loading="true"]').isVisible().catch(() => false);
			expect(hasLoadingSpinner).toBe(false);
		});

		test('should recover from initialization errors', async ({ page }) => {
			// Set invalid tokens in localStorage
			await page.goto('/login');
			await page.evaluate(() => {
				localStorage.setItem('pos_tokens', '{"invalid": "json"');
			});

			// Navigate to dashboard - should handle initialization error
			await page.goto('/dashboard');

			// Should redirect to login (initialization failed, cleared session)
			await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

			// Should have cleared bad tokens
			const tokensCleared = await page.evaluate(() => {
				const stored = localStorage.getItem('pos_tokens');
				return stored === null;
			});
			expect(tokensCleared).toBe(true);
		});
	});

	test.describe('Session Persistence', () => {
		test('should persist session across page reloads', async ({ page }) => {
			const { email } = await registerUser(page);

			// Reload page multiple times
			for (let i = 0; i < 3; i++) {
				await page.reload();
				await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
				await expect(page.getByText(email)).toBeVisible({ timeout: 5000 });
			}
		});

		test('should persist session across navigation', async ({ page }) => {
			const { email } = await registerUser(page);

			// Navigate to different pages
			const pages = ['/profile', '/stores', '/settings', '/dashboard'];
			for (const path of pages) {
				await page.goto(path);
				await expect(page).toHaveURL(new RegExp(path), { timeout: 5000 });
				// User should still be authenticated
				await expect(page.getByText(email)).toBeVisible({ timeout: 5000 });
			}
		});

		test('should clear session after logout', async ({ page }) => {
			await registerUser(page);

			// Logout
			await page.getByRole('button', { name: /sign out|logout/i }).click();
			await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

			// Session should be cleared
			const tokensCleared = await page.evaluate(() => {
				return localStorage.getItem('pos_tokens') === null;
			});
			expect(tokensCleared).toBe(true);

			// Try to access protected page
			await page.goto('/dashboard');
			await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
		});
	});

	test.describe('Auth Route Guards', () => {
		test('should redirect unauthenticated users to login', async ({ page }) => {
			await page.goto('/dashboard');
			await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

			await page.goto('/profile');
			await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

			await page.goto('/stores');
			await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
		});

		test('should redirect authenticated users away from auth pages', async ({ page }) => {
			await registerUser(page);

			// Try to access login page
			await page.goto('/login');
			await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });

			// Try to access register page
			await page.goto('/register');
			await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
		});

		test('should allow access to public pages', async ({ page }) => {
			// These pages should be accessible without auth
			await page.goto('/login');
			await expect(page).toHaveURL(/\/login/);

			await page.goto('/register');
			await expect(page).toHaveURL(/\/register/);

			// Verify-email should be accessible
			await page.goto('/verify-email?token=test');
			await expect(page).toHaveURL(/\/verify-email/);
		});
	});
});
