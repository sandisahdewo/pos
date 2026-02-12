<script lang="ts">
	import { getClient, APIError } from '$lib/api/client.js';
	import type { VariantResponse } from '$lib/api/types.js';
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

	let variants = $state<VariantResponse[]>([]);
	let loading = $state(true);
	let dialogOpen = $state(false);
	let error = $state('');
	let success = $state('');

	let formName = $state('');
	let formDescription = $state('');
	let formLoading = $state(false);

	createDataLoader(() => loadVariants());

	async function loadVariants() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			variants = await api.get<VariantResponse[]>('/v1/variants');
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load variants';
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		formName = '';
		formDescription = '';
		dialogOpen = true;
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		formLoading = true;
		try {
			const api = getClient();
			await api.post('/v1/variants', {
				name: formName,
				description: formDescription || undefined
			});
			success = 'Variant created successfully';
			error = '';
			dialogOpen = false;
			await loadVariants();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}

	async function deactivateVariant(variant: VariantResponse) {
		try {
			const api = getClient();
			await api.del(`/v1/variants/${variant.id}`);
			success = 'Variant deactivated';
			error = '';
			await loadVariants();
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to deactivate variant';
		}
	}
</script>

<svelte:head>
	<title>Variants - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Variants</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Create Variant
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
						<Table.Head>Status</Table.Head>
						<Table.Head class="w-32">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if loading}
						<Table.Row>
							<Table.Cell colspan={4} class="text-center text-muted-foreground py-8">
								Loading...
							</Table.Cell>
						</Table.Row>
					{:else if variants.length === 0}
						<Table.Row>
							<Table.Cell colspan={4} class="text-center text-muted-foreground py-8">
								No variants found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each variants as variant}
							<Table.Row>
								<Table.Cell class="font-medium">{variant.name}</Table.Cell>
								<Table.Cell>{variant.description || '-'}</Table.Cell>
								<Table.Cell>
									<Badge variant={variant.is_active ? 'default' : 'secondary'}>
										{variant.is_active ? 'Active' : 'Inactive'}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									<div class="flex gap-1">
										<Button
											variant="ghost"
											size="sm"
											href="/settings/variants/{variant.id}"
										>
											Edit
										</Button>
										{#if variant.is_active}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => deactivateVariant(variant)}
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

<SimpleDialog bind:open={dialogOpen} title="Create Variant" description="Add a new product variant type">
	<form onsubmit={handleCreate} class="space-y-4">
		<div class="space-y-2">
			<Label for="variantName">Name</Label>
			<Input id="variantName" bind:value={formName} required />
		</div>
		<div class="space-y-2">
			<Label for="variantDescription">Description (optional)</Label>
			<Input id="variantDescription" bind:value={formDescription} />
		</div>
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
