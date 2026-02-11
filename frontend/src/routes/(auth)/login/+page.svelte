<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { APIError } from '$lib/api/client.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			await auth.login({ email, password });
			goto('/dashboard');
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
	<title>Login - POS</title>
</svelte:head>

<Card.Root>
	<Card.Header class="text-center">
		<Card.Title class="text-2xl">Sign In</Card.Title>
		<Card.Description>Enter your credentials to access your account</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit} class="space-y-4">
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
			<div class="space-y-2">
				<Label for="password">Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="Enter your password"
					bind:value={password}
					required
					autocomplete="current-password"
				/>
			</div>
			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}

			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? 'Signing in...' : 'Sign In'}
			</Button>
		</form>
	</Card.Content>
	<Card.Footer class="flex flex-col gap-2 text-center text-sm">
		<a href="/forgot-password" class="text-muted-foreground hover:underline">
			Forgot password?
		</a>
		<p class="text-muted-foreground">
			Don't have an account?
			<a href="/register" class="text-primary hover:underline">Register</a>
		</p>
	</Card.Footer>
</Card.Root>
