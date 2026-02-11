<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte.js';
	import { storeSelector } from '$lib/stores/store-selector.svelte.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Store } from '@lucide/svelte';

	const stores = $derived(auth.accessibleStores);
	const showSelector = $derived(stores.length > 1 || auth.allStoresAccess);

	const selectedLabel = $derived(() => {
		if (!storeSelector.selectedStoreId) {
			return auth.allStoresAccess ? 'All Stores' : stores[0]?.name ?? 'No Store';
		}
		const found = stores.find((s) => s.id === storeSelector.selectedStoreId);
		return found?.name ?? 'All Stores';
	});

	function handleSelect(value: string | undefined) {
		storeSelector.select(value === 'all' ? null : (value ?? null));
	}
</script>

{#if stores.length === 0}
	<div class="flex items-center gap-2 text-sm text-muted-foreground">
		<Store class="h-4 w-4" />
		<span>No stores</span>
	</div>
{:else if !showSelector}
	<div class="flex items-center gap-2 text-sm">
		<Store class="h-4 w-4" />
		<span>{stores[0].name}</span>
	</div>
{:else}
	<Select.Root
		type="single"
		value={storeSelector.selectedStoreId ?? 'all'}
		onValueChange={handleSelect}
	>
		<Select.Trigger class="w-[200px]">
			<div class="flex items-center gap-2">
				<Store class="h-4 w-4" />
				<span>{selectedLabel()}</span>
			</div>
		</Select.Trigger>
		<Select.Content>
			{#if auth.allStoresAccess}
				<Select.Item value="all">All Stores</Select.Item>
			{/if}
			{#each stores as store}
				<Select.Item value={store.id}>{store.name}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
{/if}
