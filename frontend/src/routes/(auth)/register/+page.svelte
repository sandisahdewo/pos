<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte.js';
	import { APIError } from '$lib/api/client.js';
	import Alert from '$lib/components/Alert.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	let tenantName = $state('');
	let email = $state('');
	let password = $state('');
	let firstName = $state('');
	let lastName = $state('');
	let storeName = $state('');
	let storeAddress = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			await auth.register({
				tenant_name: tenantName,
				email,
				password,
				first_name: firstName,
				last_name: lastName,
				store_name: storeName,
				store_address: storeAddress || undefined
			});
			goto('/dashboard');
		} catch (err) {
			if (err instanceof APIError) {
				if (err.details) {
					error = Object.values(err.details).join(', ');
				} else {
					error = err.message;
				}
			} else {
				error = 'An unexpected error occurred';
			}
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Register - POS</title>
</svelte:head>

<Card.Root>
	<Card.Header class="text-center">
		<Card.Title class="text-2xl">Create Account</Card.Title>
		<Card.Description>Register your business and first store</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-2">
				<Label for="tenantName">Business Name</Label>
				<Input
					id="tenantName"
					placeholder="My Business"
					bind:value={tenantName}
					required
					minlength={2}
				/>
			</div>
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
					placeholder="At least 8 characters"
					bind:value={password}
					required
					minlength={8}
					autocomplete="new-password"
				/>
			</div>

			<div class="border-t pt-4">
				<p class="mb-3 text-sm font-medium">First Store</p>
				<div class="space-y-4">
					<div class="space-y-2">
						<Label for="storeName">Store Name</Label>
						<Input id="storeName" placeholder="Main Store" bind:value={storeName} required />
					</div>
					<div class="space-y-2">
						<Label for="storeAddress">Store Address (optional)</Label>
						<Input id="storeAddress" placeholder="123 Main St" bind:value={storeAddress} />
					</div>
				</div>
			</div>

			<Alert type="error" bind:message={error} />

			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? 'Creating account...' : 'Create Account'}
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
