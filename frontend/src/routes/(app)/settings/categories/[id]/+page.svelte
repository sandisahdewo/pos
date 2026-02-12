<script lang="ts">
	import { page } from '$app/state';
	import { getClient, APIError } from '$lib/api/client.js';
	import type { CategoryDetailResponse, UnitResponse, VariantResponse } from '$lib/api/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import Alert from '$lib/components/Alert.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { ArrowLeft } from '@lucide/svelte';
	import { createDataLoader } from '$lib/utils/data-loader.svelte.js';

	let category = $state<CategoryDetailResponse | null>(null);
	let allUnits = $state<UnitResponse[]>([]);
	let allVariants = $state<VariantResponse[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');

	let activeTab = $state<'units' | 'variants'>('units');
	let selectedUnitIds = $state<Set<string>>(new Set());
	let selectedVariantIds = $state<Set<string>>(new Set());

	const categoryId = $derived(page.params.id);

	createDataLoader(() => loadData());

	async function loadData() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			const [cat, units, variants] = await Promise.all([
				api.get<CategoryDetailResponse>(`/v1/categories/${categoryId}`),
				api.get<UnitResponse[]>('/v1/units'),
				api.get<VariantResponse[]>('/v1/variants')
			]);
			category = cat;
			allUnits = units;
			allVariants = variants;
			selectedUnitIds = new Set(cat.units?.map((u) => u.id) ?? []);
			selectedVariantIds = new Set(cat.variants?.map((v) => v.id) ?? []);
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load category details';
		} finally {
			loading = false;
		}
	}

	function toggleUnit(unitId: string) {
		const next = new Set(selectedUnitIds);
		if (next.has(unitId)) {
			next.delete(unitId);
		} else {
			next.add(unitId);
		}
		selectedUnitIds = next;
	}

	function toggleVariant(variantId: string) {
		const next = new Set(selectedVariantIds);
		if (next.has(variantId)) {
			next.delete(variantId);
		} else {
			next.add(variantId);
		}
		selectedVariantIds = next;
	}

	async function saveUnits() {
		saving = true;
		error = '';
		try {
			const api = getClient();
			await api.put(`/v1/categories/${categoryId}/units`, {
				unit_ids: Array.from(selectedUnitIds)
			});
			success = 'Units updated successfully';
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to update units';
		} finally {
			saving = false;
		}
	}

	async function saveVariants() {
		saving = true;
		error = '';
		try {
			const api = getClient();
			await api.put(`/v1/categories/${categoryId}/variants`, {
				variant_ids: Array.from(selectedVariantIds)
			});
			success = 'Variants updated successfully';
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to update variants';
		} finally {
			saving = false;
		}
	}

	function formatPricingMode(mode: string): string {
		if (!mode) return 'None';
		if (mode === 'markup_percentage') return 'Markup %';
		if (mode === 'markup_fixed') return 'Markup Fixed';
		return mode;
	}
</script>

<svelte:head>
	<title>{category?.name ?? 'Category'} - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/settings/categories">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<h1 class="text-2xl font-bold">{category?.name ?? 'Category Details'}</h1>
		{#if category}
			<Badge variant={category.is_active ? 'default' : 'secondary'}>
				{category.is_active ? 'Active' : 'Inactive'}
			</Badge>
		{/if}
	</div>

	<Alert type="error" bind:message={error} />
	<Alert type="success" bind:message={success} autoDismiss={true} />

	{#if loading}
		<p class="text-muted-foreground">Loading...</p>
	{:else if category}
		<Card.Root>
			<Card.Content class="pt-6">
				<dl class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<dt class="text-muted-foreground">Description</dt>
						<dd class="font-medium">{category.description || '-'}</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Pricing Mode</dt>
						<dd class="font-medium">{formatPricingMode(category.pricing_mode)}</dd>
					</div>
					{#if category.pricing_mode}
						<div>
							<dt class="text-muted-foreground">Markup Value</dt>
							<dd class="font-medium">{category.markup_value}</dd>
						</div>
					{/if}
				</dl>
			</Card.Content>
		</Card.Root>

		<div>
			<div class="flex border-b">
				<button
					class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'units'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeTab = 'units')}
				>
					Linked Units
				</button>
				<button
					class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'variants'
						? 'border-primary text-primary'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeTab = 'variants')}
				>
					Linked Variants
				</button>
			</div>

			{#if activeTab === 'units'}
				<Card.Root class="mt-4">
					<Card.Content class="pt-6">
						{#if allUnits.length === 0}
							<p class="text-muted-foreground text-sm">No units available. Create units first.</p>
						{:else}
							<div class="space-y-3">
								{#each allUnits as unit}
									<label class="flex items-center gap-3 cursor-pointer">
										<input
											type="checkbox"
											checked={selectedUnitIds.has(unit.id)}
											onchange={() => toggleUnit(unit.id)}
											class="h-4 w-4 rounded border-gray-300"
										/>
										<span class="text-sm font-medium">{unit.name}</span>
										{#if unit.description}
											<span class="text-sm text-muted-foreground">- {unit.description}</span>
										{/if}
										{#if !unit.is_active}
											<Badge variant="secondary">Inactive</Badge>
										{/if}
									</label>
								{/each}
							</div>
							<div class="mt-4 flex justify-end">
								<Button onclick={saveUnits} disabled={saving}>
									{saving ? 'Saving...' : 'Save Units'}
								</Button>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			{#if activeTab === 'variants'}
				<Card.Root class="mt-4">
					<Card.Content class="pt-6">
						{#if allVariants.length === 0}
							<p class="text-muted-foreground text-sm">No variants available. Create variants first.</p>
						{:else}
							<div class="space-y-3">
								{#each allVariants as variant}
									<label class="flex items-center gap-3 cursor-pointer">
										<input
											type="checkbox"
											checked={selectedVariantIds.has(variant.id)}
											onchange={() => toggleVariant(variant.id)}
											class="h-4 w-4 rounded border-gray-300"
										/>
										<span class="text-sm font-medium">{variant.name}</span>
										{#if variant.description}
											<span class="text-sm text-muted-foreground">- {variant.description}</span>
										{/if}
										{#if !variant.is_active}
											<Badge variant="secondary">Inactive</Badge>
										{/if}
									</label>
								{/each}
							</div>
							<div class="mt-4 flex justify-end">
								<Button onclick={saveVariants} disabled={saving}>
									{saving ? 'Saving...' : 'Save Variants'}
								</Button>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	{/if}
</div>
