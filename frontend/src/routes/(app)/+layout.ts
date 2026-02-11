import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/stores/auth.svelte.js';
import type { LayoutLoad } from './$types.js';

export const load: LayoutLoad = async () => {
	if (browser) {
		await auth.initialize();
		if (!auth.isAuthenticated) {
			redirect(302, '/login');
		}
	}
};
