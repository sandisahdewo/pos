<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { APIError } from '$lib/api/client.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { LoginResponse } from '$lib/api/types.js';

	let firstName = $state('');
	let lastName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let error = $state('');

	const token = $derived(page.params.token);

	// Ensure auth client is initialized (this page is outside (auth)/(app) route groups)
	auth.initialize();

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}
		loading = true;
		try {
			// Use auth's client which is guaranteed to be initialized
			const api = auth.getApiClient();
			const res = await api.postPublic<LoginResponse>('/v1/auth/accept-invitation', {
				token,
				password,
				first_name: firstName,
				last_name: lastName
			});
			// Set up auth session with the returned tokens
			if (res.tokens) {
				await auth.loginWithTokens(res.tokens);
			}
			await goto('/dashboard');
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
	<title>Accept Invitation - POS</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-muted p-4">
	<div class="w-full max-w-md">
		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-2xl">Accept Invitation</Card.Title>
				<Card.Description>Set up your account to join the team</Card.Description>
			</Card.Header>
			<Card.Content>
				<form onsubmit={handleSubmit} class="space-y-4">
					{#if error}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					{/if}
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="firstName">First Name</Label>
							<Input id="firstName" placeholder="John" bind:value={firstName} required />
						</div>
						<div class="space-y-2">
							<Label for="lastName">Last Name</Label>
							<Input id="lastName" placeholder="Doe" bind:value={lastName} required />
						</div>
					</div>
					<div class="space-y-2">
						<Label for="password">Password</Label>
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
						{loading ? 'Setting up...' : 'Accept & Create Account'}
					</Button>
				</form>
			</Card.Content>
			<Card.Footer class="text-center text-sm">
				<p class="text-muted-foreground">
					Already have an account?
					<a href="/login" class="text-primary hover:underline">Sign in</a>
				</p>
			</Card.Footer>
		</Card.Root>
	</div>
</div>
