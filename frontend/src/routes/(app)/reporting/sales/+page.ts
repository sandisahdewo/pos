import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { auth } from '$lib/stores/auth.svelte.js';
import type { PageLoad } from './$types.js';

export const load: PageLoad = async () => {
	if (browser && auth.initialized && !auth.hasPermission('reporting.sales', 'read')) {
		redirect(302, '/dashboard');
	}
};
