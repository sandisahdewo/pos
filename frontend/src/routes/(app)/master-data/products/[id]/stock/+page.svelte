<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getClient, APIError } from '$lib/api/client.js';
	import type { StockSummaryResponse } from '$lib/api/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import Alert from '$lib/components/Alert.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ArrowLeft } from '@lucide/svelte';
	import { createDataLoader } from '$lib/utils/data-loader.svelte.js';

	let stockItems = $state<StockSummaryResponse[]>([]);
	let loading = $state(true);
	let error = $state('');

	let mounted = $state(false);
	onMount(() => { mounted = true; });

	createDataLoader(() => loadStock());

	async function loadStock() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			stockItems = await api.get<StockSummaryResponse[]>(`/v1/products/${page.params.id}/stock`);
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load stock data';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Product Stock - Master Data - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="sm" href="/master-data/products/{page.params.id}">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back to Product
		</Button>
		<h1 class="text-2xl font-bold">Stock Overview</h1>
	</div>

	<Alert type="error" bind:message={error} />

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Variant SKU</Table.Head>
						<Table.Head>Warehouse</Table.Head>
						<Table.Head class="text-right">Current Stock</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if loading}
						<Table.Row>
							<Table.Cell colspan={3} class="text-center text-muted-foreground py-8">
								Loading...
							</Table.Cell>
						</Table.Row>
					{:else if stockItems.length === 0}
						<Table.Row>
							<Table.Cell colspan={3} class="text-center text-muted-foreground py-8">
								No stock data available.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each stockItems as item}
							<Table.Row>
								<Table.Cell class="font-mono text-sm">{item.variant_sku}</Table.Cell>
								<Table.Cell>{item.warehouse_name}</Table.Cell>
								<Table.Cell class="text-right font-medium">{item.current_stock.toLocaleString()}</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
