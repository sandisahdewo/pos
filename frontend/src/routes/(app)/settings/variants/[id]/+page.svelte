<script lang="ts">
	import { page } from '$app/state';
	import { getClient, APIError } from '$lib/api/client.js';
	import type { VariantDetailResponse, VariantValueResponse } from '$lib/api/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import SimpleDialog from '$lib/components/SimpleDialog.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { ArrowLeft, Plus } from '@lucide/svelte';
	import { createDataLoader } from '$lib/utils/data-loader.svelte.js';

	let variant = $state<VariantDetailResponse | null>(null);
	let loading = $state(true);
	let error = $state('');
	let success = $state('');

	let dialogOpen = $state(false);
	let editDialogOpen = $state(false);
	let editingValue = $state<VariantValueResponse | null>(null);

	let formValue = $state('');
	let formSortOrder = $state(0);
	let formLoading = $state(false);

	const variantId = $derived(page.params.id);

	createDataLoader(() => loadVariant());

	async function loadVariant() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			variant = await api.get<VariantDetailResponse>(`/v1/variants/${variantId}`);
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load variant';
		} finally {
			loading = false;
		}
	}

	function openAddDialog() {
		formValue = '';
		formSortOrder = (variant?.values?.length ?? 0) + 1;
		dialogOpen = true;
	}

	function openEditDialog(val: VariantValueResponse) {
		editingValue = val;
		formValue = val.value;
		formSortOrder = val.sort_order;
		editDialogOpen = true;
	}

	async function handleAdd(e: Event) {
		e.preventDefault();
		formLoading = true;
		try {
			const api = getClient();
			await api.post(`/v1/variants/${variantId}/values`, {
				value: formValue,
				sort_order: formSortOrder
			});
			success = 'Value added successfully';
			error = '';
			dialogOpen = false;
			await loadVariant();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}

	async function handleEdit(e: Event) {
		e.preventDefault();
		if (!editingValue) return;
		formLoading = true;
		try {
			const api = getClient();
			await api.put(`/v1/variants/${variantId}/values/${editingValue.id}`, {
				value: formValue,
				sort_order: formSortOrder,
				is_active: editingValue.is_active
			});
			success = 'Value updated successfully';
			error = '';
			editDialogOpen = false;
			editingValue = null;
			await loadVariant();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}

	async function deleteValue(val: VariantValueResponse) {
		try {
			const api = getClient();
			await api.del(`/v1/variants/${variantId}/values/${val.id}`);
			success = 'Value deleted';
			error = '';
			await loadVariant();
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to delete value';
		}
	}
</script>

<svelte:head>
	<title>{variant?.name ?? 'Variant'} - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/settings/variants">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<h1 class="text-2xl font-bold">{variant?.name ?? 'Variant Details'}</h1>
		{#if variant}
			<Badge variant={variant.is_active ? 'default' : 'secondary'}>
				{variant.is_active ? 'Active' : 'Inactive'}
			</Badge>
		{/if}
	</div>

	<Alert type="error" bind:message={error} />
	<Alert type="success" bind:message={success} autoDismiss={true} />

	{#if loading}
		<p class="text-muted-foreground">Loading...</p>
	{:else if variant}
		<Card.Root>
			<Card.Content class="pt-6">
				<dl class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<dt class="text-muted-foreground">Name</dt>
						<dd class="font-medium">{variant.name}</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Description</dt>
						<dd class="font-medium">{variant.description || '-'}</dd>
					</div>
				</dl>
			</Card.Content>
		</Card.Root>

		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold">Values</h2>
			<Button onclick={openAddDialog} size="sm">
				<Plus class="mr-2 h-4 w-4" />
				Add Value
			</Button>
		</div>

		<Card.Root>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Value</Table.Head>
							<Table.Head>Sort Order</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head class="w-32">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if !variant.values || variant.values.length === 0}
							<Table.Row>
								<Table.Cell colspan={4} class="text-center text-muted-foreground py-8">
									No values found. Add a value to get started.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each variant.values as val}
								<Table.Row>
									<Table.Cell class="font-medium">{val.value}</Table.Cell>
									<Table.Cell>{val.sort_order}</Table.Cell>
									<Table.Cell>
										<Badge variant={val.is_active ? 'default' : 'secondary'}>
											{val.is_active ? 'Active' : 'Inactive'}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										<div class="flex gap-1">
											<Button
												variant="ghost"
												size="sm"
												onclick={() => openEditDialog(val)}
											>
												Edit
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onclick={() => deleteValue(val)}
											>
												Delete
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
	{/if}
</div>

<SimpleDialog bind:open={dialogOpen} title="Add Value" description="Add a new variant value">
		<form onsubmit={handleAdd} class="space-y-4">
			<div class="space-y-2">
				<Label for="valueName">Value</Label>
				<Input id="valueName" bind:value={formValue} required />
			</div>
			<div class="space-y-2">
				<Label for="valueSortOrder">Sort Order</Label>
				<Input id="valueSortOrder" type="number" bind:value={formSortOrder} />
			</div>
			<div class="flex justify-end gap-2 mt-4">
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
					Cancel
				</Button>
				<Button type="submit" disabled={formLoading}>
					{formLoading ? 'Adding...' : 'Add'}
				</Button>
			</div>
		</form>
	</SimpleDialog>

	<SimpleDialog bind:open={editDialogOpen} title="Edit Value" description="Update variant value">
		<form onsubmit={handleEdit} class="space-y-4">
			<div class="space-y-2">
				<Label for="editValueName">Value</Label>
				<Input id="editValueName" bind:value={formValue} required />
			</div>
			<div class="space-y-2">
				<Label for="editValueSortOrder">Sort Order</Label>
				<Input id="editValueSortOrder" type="number" bind:value={formSortOrder} />
			</div>
			<div class="flex justify-end gap-2 mt-4">
				<Button type="button" variant="outline" onclick={() => (editDialogOpen = false)}>
					Cancel
				</Button>
				<Button type="submit" disabled={formLoading}>
					{formLoading ? 'Saving...' : 'Save'}
				</Button>
			</div>
		</form>
	</SimpleDialog>
