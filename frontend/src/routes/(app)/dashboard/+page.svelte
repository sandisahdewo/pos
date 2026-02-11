<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte.js';
	import * as Card from '$lib/components/ui/card/index.js';
</script>

<svelte:head>
	<title>Dashboard - POS</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Dashboard</h1>

	<Card.Root>
		<Card.Header>
			<Card.Title>Welcome{auth.user?.first_name ? `, ${auth.user.first_name}` : ''}!</Card.Title>
			<Card.Description>
				Here is an overview of your POS system.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Card.Root>
					<Card.Header>
						<Card.Description>Accessible Stores</Card.Description>
						<Card.Title class="text-2xl">
							{auth.user?.all_stores_access ? 'All' : auth.user?.stores.length || 0}
						</Card.Title>
					</Card.Header>
				</Card.Root>
				<Card.Root>
					<Card.Header>
						<Card.Description>Permissions</Card.Description>
						<Card.Title class="text-2xl">
							{Object.keys(auth.user?.permissions || {}).length} features
						</Card.Title>
					</Card.Header>
				</Card.Root>
				<Card.Root>
					<Card.Header>
						<Card.Description>Email Verified</Card.Description>
						<Card.Title class="text-2xl">
							{auth.user?.is_email_verified ? 'Yes' : 'No'}
						</Card.Title>
					</Card.Header>
				</Card.Root>
			</div>
		</Card.Content>
	</Card.Root>
</div>
