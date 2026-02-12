import { test, expect, type Page } from '@playwright/test';

function uniqueEmail(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function uniqueTenant(): string {
	return `Invite Biz ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function decodeQuotedPrintable(str: string): string {
	return str
		.replace(/=\r?\n/g, '') // Remove soft line breaks
		.replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
			String.fromCharCode(parseInt(hex, 16))
		);
}

async function registerAdmin(page: Page): Promise<{ email: string; password: string }> {
	const email = uniqueEmail();
	const password = 'password123';

	await page.goto('/register');
	await page.getByLabel('Business Name').fill(uniqueTenant());
	await page.getByLabel('First Name').fill('Admin');
	await page.getByLabel('Last Name').fill('Boss');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByLabel('Store Name').fill('HQ Store');
	await page.getByRole('button', { name: 'Create Account' }).click();
	await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

	return { email, password };
}

async function sendInvitation(page: Page, inviteeEmail: string) {
	await page.getByRole('button', { name: 'Invite User' }).click();
	await page.getByLabel('Email').fill(inviteeEmail);
	// Role selector is a native <select> element
	await page.getByLabel('Role').selectOption({ label: 'Administrator' });
	await page.getByRole('button', { name: 'Send Invitation' }).click();
	await expect(page.getByText('Invitation sent')).toBeVisible({ timeout: 10_000 });
}

test.describe('Invitations', () => {
	test('admin can invite a user', async ({ page }) => {
		await registerAdmin(page);
		const inviteeEmail = uniqueEmail();

		// Go to users page
		await page.goto('/settings/users');
		await expect(page.getByText('Users').first()).toBeVisible({ timeout: 10_000 });

		// Send the invitation
		await sendInvitation(page, inviteeEmail);
	});

	test('invited user appears in pending invitations tab', async ({ page }) => {
		await registerAdmin(page);
		const inviteeEmail = uniqueEmail();

		// Send invitation
		await page.goto('/settings/users');
		await sendInvitation(page, inviteeEmail);

		// Switch to Pending Invitations tab (plain HTML button)
		await page.getByRole('button', { name: /Pending Invitations/ }).click();

		// Invitee email should appear
		await expect(page.getByText(inviteeEmail)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('pending', { exact: true })).toBeVisible();
	});

	test('admin can cancel a pending invitation', async ({ page }) => {
		await registerAdmin(page);
		const inviteeEmail = uniqueEmail();

		// Send invitation
		await page.goto('/settings/users');
		await sendInvitation(page, inviteeEmail);

		// Switch to Pending Invitations tab
		await page.getByRole('button', { name: /Pending Invitations/ }).click();
		await expect(page.getByText(inviteeEmail)).toBeVisible({ timeout: 10_000 });

		// Cancel the invitation
		await page.getByRole('button', { name: 'Cancel' }).click();

		// Invitation should be removed
		await expect(page.getByText(inviteeEmail)).not.toBeVisible({ timeout: 10_000 });
	});

	test('invited user can accept invitation via MailHog token', async ({
		page,
		request,
		browser
	}) => {
		// Register admin
		await registerAdmin(page);
		const inviteeEmail = uniqueEmail();

		// Send invitation
		await page.goto('/settings/users');
		await sendInvitation(page, inviteeEmail);

		// Fetch invitation token from MailHog
		// Wait a moment for the background job to send the email
		await page.waitForTimeout(2000);

		const mailResponse = await request.get(
			`http://mailhog:8025/api/v2/search?kind=to&query=${encodeURIComponent(inviteeEmail)}`
		);
		expect(mailResponse.ok()).toBe(true);

		const mailData = await mailResponse.json();
		expect(mailData.total).toBeGreaterThan(0);

		// Extract token from email body (decode quoted-printable encoding)
		const emailBody = decodeQuotedPrintable(mailData.items[0].Content.Body);
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

		// Should show inline error message
		await expect(page.getByText(/error|failed|invalid/i)).toBeVisible({
			timeout: 10_000
		});
	});
});
