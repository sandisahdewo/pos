<script lang="ts">
	import { getClient, APIError } from '$lib/api/client.js';
	import type { SupplierResponse } from '$lib/api/types.js';
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

	let suppliers = $state<SupplierResponse[]>([]);
	let loading = $state(true);
	let dialogOpen = $state(false);
	let error = $state('');
	let success = $state('');

	let formName = $state('');
	let formContactName = $state('');
	let formEmail = $state('');
	let formPhone = $state('');
	let formAddress = $state('');
	let formLoading = $state(false);

	createDataLoader(() => loadSuppliers());

	async function loadSuppliers() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			suppliers = await api.get<SupplierResponse[]>('/v1/suppliers');
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load suppliers';
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		formName = '';
		formContactName = '';
		formEmail = '';
		formPhone = '';
		formAddress = '';
		dialogOpen = true;
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		formLoading = true;
		try {
			const api = getClient();
			await api.post('/v1/suppliers', {
				name: formName,
				contact_name: formContactName || undefined,
				email: formEmail || undefined,
				phone: formPhone || undefined,
				address: formAddress || undefined
			});
			success = 'Supplier created successfully';
			error = '';
			dialogOpen = false;
			await loadSuppliers();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}

	async function deactivateSupplier(supplier: SupplierResponse) {
		try {
			const api = getClient();
			await api.del(`/v1/suppliers/${supplier.id}`);
			success = 'Supplier deactivated';
			error = '';
			await loadSuppliers();
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to deactivate supplier';
		}
	}
</script>

<svelte:head>
	<title>Suppliers - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Suppliers</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Create Supplier
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
						<Table.Head>Contact</Table.Head>
						<Table.Head>Email</Table.Head>
						<Table.Head>Phone</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head class="w-24">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if loading}
						<Table.Row>
							<Table.Cell colspan={6} class="text-center text-muted-foreground py-8">
								Loading...
							</Table.Cell>
						</Table.Row>
					{:else if suppliers.length === 0}
						<Table.Row>
							<Table.Cell colspan={6} class="text-center text-muted-foreground py-8">
								No suppliers found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each suppliers as supplier}
							<Table.Row>
								<Table.Cell class="font-medium">{supplier.name}</Table.Cell>
								<Table.Cell>{supplier.contact_name || '-'}</Table.Cell>
								<Table.Cell>{supplier.email || '-'}</Table.Cell>
								<Table.Cell>{supplier.phone || '-'}</Table.Cell>
								<Table.Cell>
									<Badge variant={supplier.is_active ? 'default' : 'secondary'}>
										{supplier.is_active ? 'Active' : 'Inactive'}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									{#if supplier.is_active}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => deactivateSupplier(supplier)}
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

<SimpleDialog bind:open={dialogOpen} title="Create Supplier" description="Add a new supplier">
	<form onsubmit={handleCreate} class="space-y-4">
		<div class="space-y-2">
			<Label for="supplierName">Name</Label>
			<Input id="supplierName" bind:value={formName} required />
		</div>
		<div class="space-y-2">
			<Label for="supplierContact">Contact Name (optional)</Label>
			<Input id="supplierContact" bind:value={formContactName} />
		</div>
		<div class="space-y-2">
			<Label for="supplierEmail">Email (optional)</Label>
			<Input id="supplierEmail" type="email" bind:value={formEmail} />
		</div>
		<div class="space-y-2">
			<Label for="supplierPhone">Phone (optional)</Label>
			<Input id="supplierPhone" bind:value={formPhone} />
		</div>
		<div class="space-y-2">
			<Label for="supplierAddress">Address (optional)</Label>
			<Input id="supplierAddress" bind:value={formAddress} />
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
