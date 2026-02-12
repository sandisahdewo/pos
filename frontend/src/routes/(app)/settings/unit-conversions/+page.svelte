<script lang="ts">
	import { getClient, APIError } from '$lib/api/client.js';
	import type { UnitConversionResponse, UnitResponse } from '$lib/api/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import SimpleDialog from '$lib/components/SimpleDialog.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Plus } from '@lucide/svelte';
	import { createDataLoader } from '$lib/utils/data-loader.svelte.js';

	let conversions = $state<UnitConversionResponse[]>([]);
	let units = $state<UnitResponse[]>([]);
	let loading = $state(true);
	let dialogOpen = $state(false);
	let error = $state('');
	let success = $state('');

	let formFromUnitId = $state('');
	let formToUnitId = $state('');
	let formConversionFactor = $state(1);
	let formLoading = $state(false);

	createDataLoader(() => loadData());

	async function loadData() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			const [convs, unitList] = await Promise.all([
				api.get<UnitConversionResponse[]>('/v1/unit-conversions'),
				api.get<UnitResponse[]>('/v1/units')
			]);
			conversions = convs;
			units = unitList;
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load data';
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		formFromUnitId = '';
		formToUnitId = '';
		formConversionFactor = 1;
		dialogOpen = true;
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		formLoading = true;
		try {
			const api = getClient();
			await api.post('/v1/unit-conversions', {
				from_unit_id: formFromUnitId,
				to_unit_id: formToUnitId,
				conversion_factor: formConversionFactor
			});
			success = 'Unit conversion created successfully';
			error = '';
			dialogOpen = false;
			await loadData();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}

	async function deleteConversion(conversion: UnitConversionResponse) {
		try {
			const api = getClient();
			await api.del(`/v1/unit-conversions/${conversion.id}`);
			success = 'Unit conversion deleted';
			error = '';
			await loadData();
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to delete conversion';
		}
	}
</script>

<svelte:head>
	<title>Unit Conversions - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Unit Conversions</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Create Conversion
		</Button>
	</div>

	<Alert type="error" bind:message={error} />
	<Alert type="success" bind:message={success} autoDismiss={true} />

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>From Unit</Table.Head>
						<Table.Head>To Unit</Table.Head>
						<Table.Head>Factor</Table.Head>
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
					{:else if conversions.length === 0}
						<Table.Row>
							<Table.Cell colspan={4} class="text-center text-muted-foreground py-8">
								No unit conversions found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each conversions as conversion}
							<Table.Row>
								<Table.Cell class="font-medium">{conversion.from_unit_name}</Table.Cell>
								<Table.Cell>{conversion.to_unit_name}</Table.Cell>
								<Table.Cell>{conversion.conversion_factor}</Table.Cell>
								<Table.Cell>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => deleteConversion(conversion)}
									>
										Delete
									</Button>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<SimpleDialog bind:open={dialogOpen} title="Create Unit Conversion" description="Define a conversion between two units">
	<form onsubmit={handleCreate} class="space-y-4">
		<div class="space-y-2">
			<Label for="fromUnit">From Unit</Label>
			<select
				id="fromUnit"
				bind:value={formFromUnitId}
				required
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<option value="" disabled>Select a unit</option>
				{#each units as unit}
					<option value={unit.id}>{unit.name}</option>
				{/each}
			</select>
		</div>
		<div class="space-y-2">
			<Label for="toUnit">To Unit</Label>
			<select
				id="toUnit"
				bind:value={formToUnitId}
				required
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<option value="" disabled>Select a unit</option>
				{#each units as unit}
					<option value={unit.id}>{unit.name}</option>
				{/each}
			</select>
		</div>
		<div class="space-y-2">
			<Label for="conversionFactor">Conversion Factor</Label>
			<Input
				id="conversionFactor"
				type="number"
				step="0.000001"
				bind:value={formConversionFactor}
				required
			/>
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
