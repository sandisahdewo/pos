<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { onMount } from 'svelte';

	onMount(async () => {
		if (browser) {
			await auth.initialize();
			if (auth.tokens !== null && auth.user !== null) {
				goto('/dashboard');
			} else {
				goto('/login');
			}
		}
	});
</script>

<div class="flex h-screen items-center justify-center">
	<p class="text-muted-foreground">Redirecting...</p>
</div>
