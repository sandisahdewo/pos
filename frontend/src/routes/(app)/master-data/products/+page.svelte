<script lang="ts">
	import { storeSelector } from '$lib/stores/store-selector.svelte.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	const currentStoreName = $derived(() => {
		if (!storeSelector.selectedStoreId) {
			return auth.allStoresAccess ? 'All Stores' : auth.accessibleStores[0]?.name ?? '';
		}
		return auth.accessibleStores.find((s) => s.id === storeSelector.selectedStoreId)?.name ?? '';
	});
</script>

<svelte:head>
	<title>Products - Master Data - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Products</h1>
		<Badge variant="outline">Master Data</Badge>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Product List</Card.Title>
			<Card.Description>
				Showing products for: {currentStoreName()}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>SKU</Table.Head>
						<Table.Head>Price</Table.Head>
						<Table.Head>Stock</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					<Table.Row>
						<Table.Cell colspan={4} class="text-center text-muted-foreground py-8">
							No products yet. This feature is coming soon.
						</Table.Cell>
					</Table.Row>
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
