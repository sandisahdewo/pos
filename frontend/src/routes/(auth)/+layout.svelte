<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte.js';

	let { children } = $props();

	// Use $effect instead of onMount (more reliable in Svelte 5 layouts)
	let initialized = $state(false);

	$effect(() => {
		if (initialized) return;
		initialized = true;

		(async () => {
			await auth.initialize();

			// Redirect to dashboard if already authenticated
			if (auth.isAuthenticated) {
				goto('/dashboard');
			}
		})();
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-muted p-4">
	<div class="w-full max-w-md">
		{@render children()}
	</div>
</div>
