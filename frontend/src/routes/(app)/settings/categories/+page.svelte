<script lang="ts">
	import { getClient, APIError } from '$lib/api/client.js';
	import type { CategoryResponse } from '$lib/api/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import SimpleDialog from '$lib/components/SimpleDialog.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Plus } from '@lucide/svelte';
	import { createDataLoader } from '$lib/utils/data-loader.svelte.js';

	let categories = $state<CategoryResponse[]>([]);
	let loading = $state(true);
	let dialogOpen = $state(false);
	let error = $state('');
	let success = $state('');

	let formName = $state('');
	let formDescription = $state('');
	let formPricingMode = $state('');
	let formMarkupValue = $state(0);
	let formLoading = $state(false);

	createDataLoader(() => loadCategories());

	async function loadCategories() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			categories = await api.get<CategoryResponse[]>('/v1/categories');
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load categories';
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		formName = '';
		formDescription = '';
		formPricingMode = '';
		formMarkupValue = 0;
		dialogOpen = true;
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		formLoading = true;
		try {
			const api = getClient();
			await api.post('/v1/categories', {
				name: formName,
				description: formDescription || undefined,
				pricing_mode: formPricingMode || undefined,
				markup_value: formPricingMode ? formMarkupValue : undefined
			});
			success = 'Category created successfully';
			error = '';
			dialogOpen = false;
			await loadCategories();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}

	async function deactivateCategory(category: CategoryResponse) {
		try {
			const api = getClient();
			await api.del(`/v1/categories/${category.id}`);
			success = 'Category deactivated';
			error = '';
			await loadCategories();
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to deactivate category';
		}
	}

	function formatPricingMode(mode: string): string {
		if (!mode) return '-';
		if (mode === 'markup_percentage') return 'Markup %';
		if (mode === 'markup_fixed') return 'Markup Fixed';
		return mode;
	}
</script>

<svelte:head>
	<title>Categories - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Categories</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Create Category
		</Button>
	</div>

	<Alert type="error" bind:message={error} />
	<Alert type="success" bind:message={success} autoDismiss={true} />

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Description</Table.Head>
						<Table.Head>Pricing Mode</Table.Head>
						<Table.Head>Markup</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head class="w-32">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if loading}
						<Table.Row>
							<Table.Cell colspan={6} class="text-center text-muted-foreground py-8">
								Loading...
							</Table.Cell>
						</Table.Row>
					{:else if categories.length === 0}
						<Table.Row>
							<Table.Cell colspan={6} class="text-center text-muted-foreground py-8">
								No categories found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each categories as category}
							<Table.Row>
								<Table.Cell class="font-medium">{category.name}</Table.Cell>
								<Table.Cell>{category.description || '-'}</Table.Cell>
								<Table.Cell>{formatPricingMode(category.pricing_mode)}</Table.Cell>
								<Table.Cell>
									{category.pricing_mode ? category.markup_value : '-'}
								</Table.Cell>
								<Table.Cell>
									<Badge variant={category.is_active ? 'default' : 'secondary'}>
										{category.is_active ? 'Active' : 'Inactive'}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									<div class="flex gap-1">
										<Button
											variant="ghost"
											size="sm"
											href="/settings/categories/{category.id}"
										>
											Edit
										</Button>
										{#if category.is_active}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => deactivateCategory(category)}
											>
												Deactivate
											</Button>
										{/if}
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<SimpleDialog bind:open={dialogOpen} title="Create Category" description="Add a new product category">
	<form onsubmit={handleCreate} class="space-y-4">
		<div class="space-y-2">
			<Label for="categoryName">Name</Label>
			<Input id="categoryName" bind:value={formName} required />
		</div>
		<div class="space-y-2">
			<Label for="categoryDescription">Description (optional)</Label>
			<Input id="categoryDescription" bind:value={formDescription} />
		</div>
		<div class="space-y-2">
			<Label for="categoryPricingMode">Pricing Mode (optional)</Label>
			<select
				id="categoryPricingMode"
				bind:value={formPricingMode}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<option value="">None</option>
				<option value="markup_percentage">Markup Percentage</option>
				<option value="markup_fixed">Markup Fixed</option>
			</select>
		</div>
		{#if formPricingMode}
			<div class="space-y-2">
				<Label for="categoryMarkup">Markup Value</Label>
				<Input
					id="categoryMarkup"
					type="number"
					step="0.01"
					bind:value={formMarkupValue}
				/>
			</div>
		{/if}
		<div class="flex justify-end gap-2 mt-4">
			<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
				Cancel
			</Button>
			<Button type="submit" disabled={formLoading}>
				{formLoading ? 'Creating...' : 'Create'}
			</Button>
		</div>
	</form>
</SimpleDialog>
