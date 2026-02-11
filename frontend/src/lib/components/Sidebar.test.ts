import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Sidebar from './Sidebar.svelte';

// Mock $app/state
vi.mock('$app/state', () => ({
	page: {
		url: new URL('http://localhost/dashboard')
	}
}));

// Mock auth store
const mockHasPermission = vi.fn();
let mockUser: { first_name: string; last_name: string; email: string } | null = null;

vi.mock('$lib/stores/auth.svelte.js', () => ({
	auth: {
		get user() {
			return mockUser;
		},
		hasPermission: (...args: unknown[]) => mockHasPermission(...args)
	}
}));

describe('Sidebar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUser = {
			first_name: 'John',
			last_name: 'Doe',
			email: 'john@example.com'
		};
		mockHasPermission.mockReturnValue(false);
	});

	it('renders the POS System heading', () => {
		render(Sidebar);
		expect(screen.getByText('POS System')).toBeDefined();
	});

	it('always shows Dashboard link', () => {
		mockHasPermission.mockReturnValue(false);
		render(Sidebar);
		expect(screen.getByText('Dashboard')).toBeDefined();
	});

	it('always shows all settings items regardless of permissions', () => {
		mockHasPermission.mockReturnValue(false);
		render(Sidebar);
		expect(screen.getByText('Profile')).toBeDefined();
		expect(screen.getByText('Stores')).toBeDefined();
		expect(screen.getByText('Roles')).toBeDefined();
		expect(screen.getByText('Users')).toBeDefined();
	});

	it('hides feature nav items when user lacks permissions', () => {
		mockHasPermission.mockReturnValue(false);
		render(Sidebar);
		expect(screen.queryByText('Master Data')).toBeNull();
		expect(screen.queryByText('Reporting')).toBeNull();
		expect(screen.queryByText('Purchase')).toBeNull();
	});

	it('shows Master Data when user has master-data.product read permission', () => {
		mockHasPermission.mockImplementation((feature: string, action: string) => {
			return feature === 'master-data.product' && action === 'read';
		});
		render(Sidebar);
		expect(screen.getByText('Master Data')).toBeDefined();
		expect(screen.queryByText('Reporting')).toBeNull();
		expect(screen.queryByText('Purchase')).toBeNull();
	});

	it('shows Reporting when user has reporting.sales read permission', () => {
		mockHasPermission.mockImplementation((feature: string, action: string) => {
			return feature === 'reporting.sales' && action === 'read';
		});
		render(Sidebar);
		expect(screen.getByText('Reporting')).toBeDefined();
		expect(screen.queryByText('Master Data')).toBeNull();
	});

	it('shows Purchase when user has purchase.product read permission', () => {
		mockHasPermission.mockImplementation((feature: string, action: string) => {
			return feature === 'purchase.product' && action === 'read';
		});
		render(Sidebar);
		expect(screen.getByText('Purchase')).toBeDefined();
	});

	it('shows all feature items when user has all permissions', () => {
		mockHasPermission.mockReturnValue(true);
		render(Sidebar);
		expect(screen.getByText('Dashboard')).toBeDefined();
		expect(screen.getByText('Master Data')).toBeDefined();
		expect(screen.getByText('Reporting')).toBeDefined();
		expect(screen.getByText('Purchase')).toBeDefined();
	});

	it('displays user name and email when user is set', () => {
		render(Sidebar);
		expect(screen.getByText('John Doe')).toBeDefined();
		expect(screen.getByText('john@example.com')).toBeDefined();
	});

	it('does not display user info when user is null', () => {
		mockUser = null;
		render(Sidebar);
		expect(screen.queryByText('John Doe')).toBeNull();
		expect(screen.queryByText('john@example.com')).toBeNull();
	});

	it('has correct href on navigation links', () => {
		mockHasPermission.mockReturnValue(true);
		render(Sidebar);

		const dashboardLink = screen.getByText('Dashboard').closest('a');
		expect(dashboardLink?.getAttribute('href')).toBe('/dashboard');

		const masterDataLink = screen.getByText('Master Data').closest('a');
		expect(masterDataLink?.getAttribute('href')).toBe('/master-data/products');

		const reportingLink = screen.getByText('Reporting').closest('a');
		expect(reportingLink?.getAttribute('href')).toBe('/reporting/sales');

		const purchaseLink = screen.getByText('Purchase').closest('a');
		expect(purchaseLink?.getAttribute('href')).toBe('/purchase/products');
	});

	it('has correct href on settings links', () => {
		render(Sidebar);

		const profileLink = screen.getByText('Profile').closest('a');
		expect(profileLink?.getAttribute('href')).toBe('/settings/profile');

		const storesLink = screen.getByText('Stores').closest('a');
		expect(storesLink?.getAttribute('href')).toBe('/settings/stores');

		const rolesLink = screen.getByText('Roles').closest('a');
		expect(rolesLink?.getAttribute('href')).toBe('/settings/roles');

		const usersLink = screen.getByText('Users').closest('a');
		expect(usersLink?.getAttribute('href')).toBe('/settings/users');
	});

	it('calls hasPermission with correct feature and action for each nav item', () => {
		mockHasPermission.mockReturnValue(false);
		render(Sidebar);
		expect(mockHasPermission).toHaveBeenCalledWith('master-data.product', 'read');
		expect(mockHasPermission).toHaveBeenCalledWith('reporting.sales', 'read');
		expect(mockHasPermission).toHaveBeenCalledWith('purchase.product', 'read');
	});
});
