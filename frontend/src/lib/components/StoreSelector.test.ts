import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StoreSelector from './StoreSelector.svelte';
import type { StoreResponse } from '$lib/api/types.js';

const mockStores: StoreResponse[] = [
	{ id: 'store-1', name: 'Main Store', tenant_id: 't1', address: '123 Main St', phone: '555-0100', is_active: true, created_at: '', updated_at: '' },
	{ id: 'store-2', name: 'Branch Store', tenant_id: 't1', address: '456 Branch Ave', phone: '555-0200', is_active: true, created_at: '', updated_at: '' }
];

let mockAccessibleStores: StoreResponse[] = [];
let mockAllStoresAccess = false;
let mockSelectedStoreId: string | null = null;
const mockSelect = vi.fn();

vi.mock('$lib/stores/auth.svelte.js', () => ({
	auth: {
		get accessibleStores() {
			return mockAccessibleStores;
		},
		get allStoresAccess() {
			return mockAllStoresAccess;
		}
	}
}));

vi.mock('$lib/stores/store-selector.svelte.js', () => ({
	storeSelector: {
		get selectedStoreId() {
			return mockSelectedStoreId;
		},
		select: (...args: unknown[]) => mockSelect(...args)
	}
}));

describe('StoreSelector', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAccessibleStores = [...mockStores];
		mockAllStoresAccess = false;
		mockSelectedStoreId = null;
	});

	it('shows "No stores" when user has no stores', () => {
		mockAccessibleStores = [];
		render(StoreSelector);
		expect(screen.getByText('No stores')).toBeDefined();
	});

	it('shows static store name for single-store non-admin user', () => {
		mockAccessibleStores = [mockStores[0]];
		mockAllStoresAccess = false;
		render(StoreSelector);
		expect(screen.getByText('Main Store')).toBeDefined();
		// Should NOT render a select/button since there's only one store and not admin
		const buttons = document.querySelectorAll('button');
		expect(buttons.length).toBe(0);
	});

	it('shows dropdown selector for multi-store user', () => {
		mockAccessibleStores = mockStores;
		mockAllStoresAccess = false;
		render(StoreSelector);
		// With multiple stores, it should render a Select trigger (button)
		const trigger = document.querySelector('button');
		expect(trigger).not.toBeNull();
	});

	it('shows dropdown selector for admin with allStoresAccess even with single store', () => {
		mockAccessibleStores = [mockStores[0]];
		mockAllStoresAccess = true;
		render(StoreSelector);
		// Admin should see the selector even with one store
		const trigger = document.querySelector('button');
		expect(trigger).not.toBeNull();
	});

	it('shows dropdown selector for admin with multiple stores', () => {
		mockAccessibleStores = mockStores;
		mockAllStoresAccess = true;
		render(StoreSelector);
		const trigger = document.querySelector('button');
		expect(trigger).not.toBeNull();
	});
});
