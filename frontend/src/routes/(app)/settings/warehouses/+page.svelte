<script lang="ts">
	import { getClient, APIError } from '$lib/api/client.js';
	import type { WarehouseResponse } from '$lib/api/types.js';
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

	let warehouses = $state<WarehouseResponse[]>([]);
	let loading = $state(true);
	let dialogOpen = $state(false);
	let error = $state('');
	let success = $state('');

	let formName = $state('');
	let formAddress = $state('');
	let formPhone = $state('');
	let formLoading = $state(false);

	createDataLoader(() => loadWarehouses());

	async function loadWarehouses() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			warehouses = await api.get<WarehouseResponse[]>('/v1/warehouses');
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load warehouses';
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
			await api.post('/v1/warehouses', {
				name: formName,
				address: formAddress || undefined,
				phone: formPhone || undefined
			});
			success = 'Warehouse created successfully';
			error = '';
			dialogOpen = false;
			await loadWarehouses();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}

	async function deactivateWarehouse(warehouse: WarehouseResponse) {
		try {
			const api = getClient();
			await api.del(`/v1/warehouses/${warehouse.id}`);
			success = 'Warehouse deactivated';
			error = '';
			await loadWarehouses();
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to deactivate warehouse';
		}
	}
</script>

<svelte:head>
	<title>Warehouses - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Warehouses</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Create Warehouse
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
					{:else if warehouses.length === 0}
						<Table.Row>
							<Table.Cell colspan={5} class="text-center text-muted-foreground py-8">
								No warehouses found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each warehouses as warehouse}
							<Table.Row>
								<Table.Cell class="font-medium">{warehouse.name}</Table.Cell>
								<Table.Cell>{warehouse.address || '-'}</Table.Cell>
								<Table.Cell>{warehouse.phone || '-'}</Table.Cell>
								<Table.Cell>
									<Badge variant={warehouse.is_active ? 'default' : 'secondary'}>
										{warehouse.is_active ? 'Active' : 'Inactive'}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									{#if warehouse.is_active}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => deactivateWarehouse(warehouse)}
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

<SimpleDialog bind:open={dialogOpen} title="Create Warehouse" description="Add a new warehouse location">
	<form onsubmit={handleCreate} class="space-y-4">
		<div class="space-y-2">
			<Label for="warehouseName">Name</Label>
			<Input id="warehouseName" bind:value={formName} required />
		</div>
		<div class="space-y-2">
			<Label for="warehouseAddress">Address (optional)</Label>
			<Input id="warehouseAddress" bind:value={formAddress} />
		</div>
		<div class="space-y-2">
			<Label for="warehousePhone">Phone (optional)</Label>
			<Input id="warehousePhone" bind:value={formPhone} />
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
