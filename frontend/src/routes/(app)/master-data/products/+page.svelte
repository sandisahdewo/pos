<script lang="ts">
	import { onMount } from 'svelte';
	import { getClient, APIError } from '$lib/api/client.js';
	import type { ProductResponse, CategoryResponse, PaginatedResponse } from '$lib/api/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import Alert from '$lib/components/Alert.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Plus } from '@lucide/svelte';
	import { createDataLoader } from '$lib/utils/data-loader.svelte.js';

	let products = $state<ProductResponse[]>([]);
	let categories = $state<CategoryResponse[]>([]);
	let loading = $state(true);
	let error = $state('');
	let totalProducts = $state(0);
	let currentPage = $state(1);
	let perPage = $state(20);
	let totalPages = $state(0);
	let categoryFilter = $state('');

	let mounted = $state(false);
	onMount(() => { mounted = true; });

	createDataLoader(() => {
		loadCategories();
		loadProducts();
	});

	async function loadCategories() {
		try {
			const api = getClient();
			categories = await api.get<CategoryResponse[]>('/v1/categories');
		} catch {
			// non-critical
		}
	}

	async function loadProducts() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			let url = `/v1/products?page=${currentPage}&per_page=${perPage}`;
			if (categoryFilter) url += `&category_id=${categoryFilter}`;
			const resp = await api.get<PaginatedResponse<ProductResponse>>(url);
			products = resp.data;
			totalProducts = resp.pagination.total;
			totalPages = resp.pagination.total_pages;
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load products';
		} finally {
			loading = false;
		}
	}

	function onCategoryChange(e: Event) {
		categoryFilter = (e.target as HTMLSelectElement).value;
		currentPage = 1;
		loadProducts();
	}

	function goToPage(page: number) {
		currentPage = page;
		loadProducts();
	}
</script>

<svelte:head>
	<title>Products - Master Data - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Products</h1>
		<Button href="/master-data/products/create">
			<Plus class="mr-2 h-4 w-4" />
			Create Product
		</Button>
	</div>

	<Alert type="error" bind:message={error} />

	<div class="flex gap-4">
		<select
			id="categoryFilter"
			value={categoryFilter}
			onchange={onCategoryChange}
			class="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
		>
			<option value="">All Categories</option>
			{#each categories as cat}
				<option value={cat.id}>{cat.name}</option>
			{/each}
		</select>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Category</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head>Sell Method</Table.Head>
						<Table.Head>Variants</Table.Head>
						<Table.Head>Created</Table.Head>
						<Table.Head class="w-32">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if loading}
						<Table.Row>
							<Table.Cell colspan={7} class="text-center text-muted-foreground py-8">
								Loading...
							</Table.Cell>
						</Table.Row>
					{:else if products.length === 0}
						<Table.Row>
							<Table.Cell colspan={7} class="text-center text-muted-foreground py-8">
								No products found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each products as product}
							<Table.Row>
								<Table.Cell class="font-medium">{product.name}</Table.Cell>
								<Table.Cell>{product.category_name}</Table.Cell>
								<Table.Cell>
									<Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
										{product.status}
									</Badge>
								</Table.Cell>
								<Table.Cell class="uppercase">{product.sell_method}</Table.Cell>
								<Table.Cell>
									<Badge variant="outline">
										{product.has_variants ? 'Multiple' : 'Single'}
									</Badge>
								</Table.Cell>
								<Table.Cell>{new Date(product.created_at).toLocaleDateString()}</Table.Cell>
								<Table.Cell>
									<div class="flex gap-1">
										<Button variant="ghost" size="sm" href="/master-data/products/{product.id}">
											Edit
										</Button>
										<Button variant="ghost" size="sm" href="/master-data/products/{product.id}/stock">
											Stock
										</Button>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	{#if totalPages > 1}
		<div class="flex items-center justify-center gap-2">
			<Button variant="outline" size="sm" disabled={currentPage <= 1} onclick={() => goToPage(currentPage - 1)}>
				Previous
			</Button>
			<span class="text-sm text-muted-foreground">
				Page {currentPage} of {totalPages} ({totalProducts} total)
			</span>
			<Button variant="outline" size="sm" disabled={currentPage >= totalPages} onclick={() => goToPage(currentPage + 1)}>
				Next
			</Button>
		</div>
	{/if}
</div>
