<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getClient, APIError } from '$lib/api/client.js';
	import Alert from '$lib/components/Alert.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let error = $state('');
	let successMessage = $state('');

	const token = $derived(page.url.searchParams.get('token') ?? '');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}
		if (!token) {
			error = 'Invalid reset link';
			return;
		}
		loading = true;
		try {
			const api = getClient();
			await api.postPublic('/v1/auth/reset-password', { token, password });
			successMessage = 'Password reset successfully! Redirecting to login...';
			setTimeout(() => goto('/login'), 2000);
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
	<title>Reset Password - POS</title>
</svelte:head>

<Card.Root>
	<Card.Header class="text-center">
		<Card.Title class="text-2xl">Reset Password</Card.Title>
		<Card.Description>Enter your new password</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if !token}
			<p class="text-center text-sm text-destructive">
				Invalid or missing reset token. Please request a new reset link.
			</p>
		{:else}
			<form onsubmit={handleSubmit} class="space-y-4">
				<Alert type="error" bind:message={error} />
				<Alert type="success" bind:message={successMessage} />

				<div class="space-y-2">
					<Label for="password">New Password</Label>
					<Input
						id="password"
						type="password"
						placeholder="At least 8 characters"
						bind:value={password}
						required
						minlength={8}
						autocomplete="new-password"
					/>
				</div>
				<div class="space-y-2">
					<Label for="confirmPassword">Confirm Password</Label>
					<Input
						id="confirmPassword"
						type="password"
						placeholder="Confirm your password"
						bind:value={confirmPassword}
						required
						minlength={8}
						autocomplete="new-password"
					/>
				</div>
				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Resetting...' : 'Reset Password'}
				</Button>
			</form>
		{/if}
	</Card.Content>
	<Card.Footer class="text-center text-sm">
		<a href="/login" class="text-muted-foreground hover:underline">Back to login</a>
	</Card.Footer>
</Card.Root>
