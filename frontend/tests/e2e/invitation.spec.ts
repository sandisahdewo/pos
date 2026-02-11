import { test, expect, type Page } from '@playwright/test';

function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerAdmin(page: Page): Promise<{ email: string; password: string }> {
	const email = uniqueEmail();
	const password = 'password123';

	await page.goto('/register');
	await page.getByLabel('Business Name').fill('Invite Test Biz');
	await page.getByLabel('First Name').fill('Admin');
	await page.getByLabel('Last Name').fill('Boss');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByLabel('Store Name').fill('HQ Store');
	await page.getByRole('button', { name: 'Create Account' }).click();
	await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

	return { email, password };
}

test.describe('Invitations', () => {
	test('admin can invite a user', async ({ page }) => {
		await registerAdmin(page);
		const inviteeEmail = uniqueEmail();

		// Go to users page
		await page.goto('/settings/users');
		await expect(page.getByText('Users').first()).toBeVisible({ timeout: 10_000 });

		// Click "Invite User"
		await page.getByRole('button', { name: 'Invite User' }).click();

		// Fill invite dialog
		await expect(page.getByText('Send an invitation to join your team')).toBeVisible();
		await page.getByLabel('Email').fill(inviteeEmail);

		// Select a role (click the role selector trigger, then pick a role)
		await page.locator('button:has-text("Select a role")').click();
		await page.getByText('Administrator').click();

		// Submit the invitation
		await page.getByRole('button', { name: 'Send Invitation' }).click();

		// Should close dialog and show success
		await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible({
			timeout: 10_000
		});
	});

	test('invited user appears in pending invitations tab', async ({ page }) => {
		await registerAdmin(page);
		const inviteeEmail = uniqueEmail();

		// Send invitation
		await page.goto('/settings/users');
		await page.getByRole('button', { name: 'Invite User' }).click();
		await page.getByLabel('Email').fill(inviteeEmail);
		await page.locator('button:has-text("Select a role")').click();
		await page.getByText('Administrator').click();
		await page.getByRole('button', { name: 'Send Invitation' }).click();
		await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible({
			timeout: 10_000
		});

		// Switch to Pending Invitations tab
		await page.getByRole('tab', { name: /Pending Invitations/ }).click();

		// Invitee email should appear
		await expect(page.getByText(inviteeEmail)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('pending')).toBeVisible();
	});

	test('admin can cancel a pending invitation', async ({ page }) => {
		await registerAdmin(page);
		const inviteeEmail = uniqueEmail();

		// Send invitation
		await page.goto('/settings/users');
		await page.getByRole('button', { name: 'Invite User' }).click();
		await page.getByLabel('Email').fill(inviteeEmail);
		await page.locator('button:has-text("Select a role")').click();
		await page.getByText('Administrator').click();
		await page.getByRole('button', { name: 'Send Invitation' }).click();
		await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible({
			timeout: 10_000
		});

		// Switch to Pending Invitations tab
		await page.getByRole('tab', { name: /Pending Invitations/ }).click();
		await expect(page.getByText(inviteeEmail)).toBeVisible({ timeout: 10_000 });

		// Cancel the invitation
		await page.getByRole('button', { name: 'Cancel' }).click();

		// Invitation should be removed
		await expect(page.getByText(inviteeEmail)).not.toBeVisible({ timeout: 10_000 });
	});

	test('invited user can accept invitation via MailHog token', async ({ page, request, browser }) => {
		// Register admin
		await registerAdmin(page);
		const inviteeEmail = uniqueEmail();

		// Send invitation
		await page.goto('/settings/users');
		await page.getByRole('button', { name: 'Invite User' }).click();
		await page.getByLabel('Email').fill(inviteeEmail);
		await page.locator('button:has-text("Select a role")').click();
		await page.getByText('Administrator').click();
		await page.getByRole('button', { name: 'Send Invitation' }).click();
		await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible({
			timeout: 10_000
		});

		// Fetch invitation token from MailHog
		// Wait a moment for the background job to send the email
		await page.waitForTimeout(2000);

		const mailResponse = await request.get(
			`http://localhost:8025/api/v2/search?kind=to&query=${encodeURIComponent(inviteeEmail)}`
		);
		expect(mailResponse.ok()).toBe(true);

		const mailData = await mailResponse.json();
		expect(mailData.total).toBeGreaterThan(0);

		// Extract token from email body
		const emailBody = mailData.items[0].Content.Body;
		const tokenMatch = emailBody.match(/invitation\/([a-fA-F0-9]+)/);
		expect(tokenMatch).not.toBeNull();
		const token = tokenMatch![1];

		// Open new browser context (new user session) to accept invitation
		const inviteeContext = await browser.newContext();
		const inviteePage = await inviteeContext.newPage();

		await inviteePage.goto(`http://localhost:5173/invitation/${token}`);
		await expect(inviteePage.getByText('Accept Invitation')).toBeVisible();

		// Fill in account details
		await inviteePage.getByLabel('First Name').fill('Invited');
		await inviteePage.getByLabel('Last Name').fill('Partner');
		await inviteePage.getByLabel('Password', { exact: true }).fill('newpassword123');
		await inviteePage.getByLabel('Confirm Password').fill('newpassword123');
		await inviteePage.getByRole('button', { name: 'Accept & Create Account' }).click();

		// Should redirect to dashboard
		await expect(inviteePage).toHaveURL(/\/dashboard/, { timeout: 15_000 });

		await inviteeContext.close();
	});

	test('invitation acceptance page shows error for invalid token', async ({ page }) => {
		await page.goto('/invitation/invalidtoken123');
		await expect(page.getByText('Accept Invitation')).toBeVisible();

		await page.getByLabel('First Name').fill('Test');
		await page.getByLabel('Last Name').fill('User');
		await page.getByLabel('Password', { exact: true }).fill('password123');
		await page.getByLabel('Confirm Password').fill('password123');
		await page.getByRole('button', { name: 'Accept & Create Account' }).click();

		// Should show error
		await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible({
			timeout: 10_000
		});
	});
});
