<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { getClient, APIError } from '$lib/api/client.js';
	import * as Card from '$lib/components/ui/card/index.js';

	let status = $state<'loading' | 'success' | 'error'>('loading');
	let errorMessage = $state('');

	const token = $derived(page.url.searchParams.get('token') ?? '');

	$effect(() => {
		if (browser && token) {
			verifyEmail();
		} else if (browser && !token) {
			status = 'error';
			errorMessage = 'Invalid or missing verification token.';
		}
	});

	async function verifyEmail() {
		try {
			const api = getClient();
			await api.postPublic('/v1/auth/verify-email', { token });
			status = 'success';
		} catch (err) {
			status = 'error';
			if (err instanceof APIError) {
				errorMessage = err.message;
			} else {
				errorMessage = 'An unexpected error occurred';
			}
		}
	}
</script>

<svelte:head>
	<title>Verify Email - POS</title>
</svelte:head>

<Card.Root>
	<Card.Header class="text-center">
		<Card.Title class="text-2xl">Email Verification</Card.Title>
	</Card.Header>
	<Card.Content class="text-center">
		{#if status === 'loading'}
			<p class="text-muted-foreground">Verifying your email...</p>
		{:else if status === 'success'}
			<div class="space-y-2">
				<p class="text-sm">Your email has been verified successfully!</p>
				<a href="/login" class="text-primary hover:underline">Go to login</a>
			</div>
		{:else}
			<div class="space-y-2">
				<p class="text-sm text-destructive">{errorMessage}</p>
				<a href="/login" class="text-primary hover:underline">Go to login</a>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
