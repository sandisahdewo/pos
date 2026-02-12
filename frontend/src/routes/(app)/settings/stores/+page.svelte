<script lang="ts">
	import { getClient, APIError } from '$lib/api/client.js';
	import type { StoreResponse } from '$lib/api/types.js';
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

	let stores = $state<StoreResponse[]>([]);
	let loading = $state(true);
	let dialogOpen = $state(false);
	let error = $state('');
	let success = $state('');

	let formName = $state('');
	let formAddress = $state('');
	let formPhone = $state('');
	let formLoading = $state(false);

	// Use createDataLoader for one-time initialization
	createDataLoader(() => loadStores());

	async function loadStores() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			stores = await api.get<StoreResponse[]>('/v1/stores');
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load stores';
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		formName = '';
		formAddress = '';
		formPhone = '';
		dialogOpen = true;
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		formLoading = true;
		try {
			const api = getClient();
			await api.post('/v1/stores', {
				name: formName,
				address: formAddress || undefined,
				phone: formPhone || undefined
			});
			success = 'Store created successfully';
			error = '';
			dialogOpen = false;
			await loadStores();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}

	async function deactivateStore(store: StoreResponse) {
		try {
			const api = getClient();
			await api.del(`/v1/stores/${store.id}`);
			success = 'Store deactivated';
			error = '';
			await loadStores();
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to deactivate store';
		}
	}
</script>

<svelte:head>
	<title>Stores - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Stores</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Create Store
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
						<Table.Head>Address</Table.Head>
						<Table.Head>Phone</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head class="w-24">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if loading}
						<Table.Row>
							<Table.Cell colspan={5} class="text-center text-muted-foreground py-8">
								Loading...
							</Table.Cell>
						</Table.Row>
					{:else if stores.length === 0}
						<Table.Row>
							<Table.Cell colspan={5} class="text-center text-muted-foreground py-8">
								No stores found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each stores as store}
							<Table.Row>
								<Table.Cell class="font-medium">{store.name}</Table.Cell>
								<Table.Cell>{store.address || '-'}</Table.Cell>
								<Table.Cell>{store.phone || '-'}</Table.Cell>
								<Table.Cell>
									<Badge variant={store.is_active ? 'default' : 'secondary'}>
										{store.is_active ? 'Active' : 'Inactive'}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									{#if store.is_active}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => deactivateStore(store)}
										>
											Deactivate
										</Button>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<SimpleDialog bind:open={dialogOpen} title="Create Store" description="Add a new store to your business">
	<form onsubmit={handleCreate} class="space-y-4">
		<div class="space-y-2">
			<Label for="storeName">Store Name</Label>
			<Input id="storeName" bind:value={formName} required />
		</div>
		<div class="space-y-2">
			<Label for="storeAddress">Address (optional)</Label>
			<Input id="storeAddress" bind:value={formAddress} />
		</div>
		<div class="space-y-2">
			<Label for="storePhone">Phone (optional)</Label>
			<Input id="storePhone" bind:value={formPhone} />
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
