<script lang="ts">
	import { getClient } from '$lib/api/client.js';
	import { APIError } from '$lib/api/client.js';
	import Alert from '$lib/components/Alert.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	let email = $state('');
	let loading = $state(false);
	let submitted = $state(false);
	let error = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			const api = getClient();
			await api.postPublic('/v1/auth/forgot-password', { email });
			submitted = true;
		} catch (err) {
			if (err instanceof APIError) {
				error = err.message;
			} else {
				error = 'An unexpected error occurred';
			}
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot Password - POS</title>
</svelte:head>

<Card.Root>
	<Card.Header class="text-center">
		<Card.Title class="text-2xl">Forgot Password</Card.Title>
		<Card.Description>Enter your email to receive a reset link</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if submitted}
			<div class="text-center">
				<p class="text-sm text-muted-foreground">
					If an account with that email exists, we've sent a password reset link.
					Check your inbox.
				</p>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="space-y-4">
				<Alert type="error" bind:message={error} />

				<div class="space-y-2">
					<Label for="email">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="you@example.com"
						bind:value={email}
						required
						autocomplete="email"
					/>
				</div>
				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Sending...' : 'Send Reset Link'}
				</Button>
			</form>
		{/if}
	</Card.Content>
	<Card.Footer class="text-center text-sm">
		<a href="/login" class="text-muted-foreground hover:underline">Back to login</a>
	</Card.Footer>
</Card.Root>
