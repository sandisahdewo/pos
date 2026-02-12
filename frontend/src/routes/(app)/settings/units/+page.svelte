<script lang="ts">
	import { getClient, APIError } from '$lib/api/client.js';
	import type { UnitResponse } from '$lib/api/types.js';
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

	let units = $state<UnitResponse[]>([]);
	let loading = $state(true);
	let dialogOpen = $state(false);
	let error = $state('');
	let success = $state('');

	let formName = $state('');
	let formDescription = $state('');
	let formLoading = $state(false);

	createDataLoader(() => loadUnits());

	async function loadUnits() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			units = await api.get<UnitResponse[]>('/v1/units');
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load units';
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
			await api.post('/v1/units', {
				name: formName,
				description: formDescription || undefined
			});
			success = 'Unit created successfully';
			error = '';
			dialogOpen = false;
			await loadUnits();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}

	async function deactivateUnit(unit: UnitResponse) {
		try {
			const api = getClient();
			await api.del(`/v1/units/${unit.id}`);
			success = 'Unit deactivated';
			error = '';
			await loadUnits();
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to deactivate unit';
		}
	}
</script>

<svelte:head>
	<title>Units - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Units</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Create Unit
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
						<Table.Head class="w-24">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if loading}
						<Table.Row>
							<Table.Cell colspan={4} class="text-center text-muted-foreground py-8">
								Loading...
							</Table.Cell>
						</Table.Row>
					{:else if units.length === 0}
						<Table.Row>
							<Table.Cell colspan={4} class="text-center text-muted-foreground py-8">
								No units found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each units as unit}
							<Table.Row>
								<Table.Cell class="font-medium">{unit.name}</Table.Cell>
								<Table.Cell>{unit.description || '-'}</Table.Cell>
								<Table.Cell>
									<Badge variant={unit.is_active ? 'default' : 'secondary'}>
										{unit.is_active ? 'Active' : 'Inactive'}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									{#if unit.is_active}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => deactivateUnit(unit)}
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

<SimpleDialog bind:open={dialogOpen} title="Create Unit" description="Add a new unit of measurement">
	<form onsubmit={handleCreate} class="space-y-4">
		<div class="space-y-2">
			<Label for="unitName">Name</Label>
			<Input id="unitName" bind:value={formName} required />
		</div>
		<div class="space-y-2">
			<Label for="unitDescription">Description (optional)</Label>
			<Input id="unitDescription" bind:value={formDescription} />
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
