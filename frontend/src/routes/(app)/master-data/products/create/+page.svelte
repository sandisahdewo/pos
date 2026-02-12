<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getClient, APIError } from '$lib/api/client.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import type {
		CategoryResponse,
		UnitResponse,
		CreateProductRequest,
		ProductVariantEntry,
		PriceTierEntry,
		ProductDetailResponse
	} from '$lib/api/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import Alert from '$lib/components/Alert.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Plus, Trash2, ArrowLeft } from '@lucide/svelte';
	import { createDataLoader } from '$lib/utils/data-loader.svelte.js';

	let categories = $state<CategoryResponse[]>([]);
	let units = $state<UnitResponse[]>([]);
	let loading = $state(false);
	let error = $state('');
	let success = $state('');

	// Form fields
	let name = $state('');
	let description = $state('');
	let categoryId = $state('');
	let sellMethod = $state('fifo');
	let status = $state('active');
	let hasVariants = $state(false);
	let taxRate = $state(0);
	let discountRate = $state(0);
	let minQuantity = $state(0);
	let maxQuantity = $state(0);

	// Single variant fields (when hasVariants is false)
	let sku = $state('');
	let barcode = $state('');
	let unitId = $state('');
	let retailPrice = $state(0);

	// Multiple variants (when hasVariants is true)
	let variants = $state<{
		sku: string;
		barcode: string;
		unit_id: string;
		retail_price: number;
		values: string[];
	}[]>([]);

	// Price tiers
	let priceTiers = $state<{ min_quantity: number; price: number }[]>([]);

	// Image uploads
	let imageUrls = $state<string[]>([]);
	let uploadingImage = $state(false);

	let mounted = $state(false);
	onMount(() => { mounted = true; });

	createDataLoader(() => {
		loadCategories();
		loadUnits();
	});

	async function loadCategories() {
		try {
			const api = getClient();
			categories = await api.get<CategoryResponse[]>('/v1/categories');
		} catch {
			// non-critical
		}
	}

	async function loadUnits() {
		try {
			const api = getClient();
			units = await api.get<UnitResponse[]>('/v1/units');
		} catch {
			// non-critical
		}
	}

	function addVariant() {
		variants = [...variants, { sku: '', barcode: '', unit_id: '', retail_price: 0, values: [] }];
	}

	function removeVariant(index: number) {
		variants = variants.filter((_, i) => i !== index);
	}

	function addPriceTier() {
		priceTiers = [...priceTiers, { min_quantity: 0, price: 0 }];
	}

	function removePriceTier(index: number) {
		priceTiers = priceTiers.filter((_, i) => i !== index);
	}

	async function handleImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploadingImage = true;
		try {
			const formData = new FormData();
			formData.append('file', file);

			const headers: Record<string, string> = {};
			const tokens = auth.tokens;
			if (tokens?.access_token) {
				headers['Authorization'] = `Bearer ${tokens.access_token}`;
			}

			const res = await fetch('/api/v1/uploads/images', {
				method: 'POST',
				headers,
				body: formData
			});

			if (!res.ok) {
				const errBody = await res.json().catch(() => ({ error: 'Upload failed' }));
				throw new APIError(res.status, errBody.error);
			}

			const resp: { image_url: string } = await res.json();
			imageUrls = [...imageUrls, resp.image_url];
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to upload image';
		} finally {
			uploadingImage = false;
			input.value = '';
		}
	}

	function removeImage(index: number) {
		imageUrls = imageUrls.filter((_, i) => i !== index);
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		try {
			const api = getClient();

			const variantEntries: ProductVariantEntry[] = hasVariants
				? variants.map((v) => ({
						sku: v.sku,
						barcode: v.barcode || undefined,
						unit_id: v.unit_id,
						retail_price: v.retail_price,
						values: v.values.length > 0 ? v.values : undefined
					}))
				: [
						{
							sku,
							barcode: barcode || undefined,
							unit_id: unitId,
							retail_price: retailPrice
						}
					];

			const tierEntries: PriceTierEntry[] = priceTiers
				.filter((t) => t.min_quantity > 0 && t.price > 0)
				.map((t) => ({ min_quantity: t.min_quantity, price: t.price }));

			const body: CreateProductRequest = {
				category_id: categoryId,
				name,
				description: description || undefined,
				has_variants: hasVariants,
				sell_method: sellMethod,
				status,
				tax_rate: taxRate || undefined,
				discount_rate: discountRate || undefined,
				min_quantity: minQuantity || undefined,
				max_quantity: maxQuantity || undefined,
				variants: variantEntries,
				images: imageUrls.length > 0 ? imageUrls : undefined,
				price_tiers: tierEntries.length > 0 ? tierEntries : undefined
			};

			await api.post<ProductDetailResponse>('/v1/products', body);
			goto('/master-data/products');
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Create Product - Master Data - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="sm" href="/master-data/products">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back
		</Button>
		<h1 class="text-2xl font-bold">Create Product</h1>
	</div>

	<Alert type="error" bind:message={error} />
	<Alert type="success" bind:message={success} autoDismiss={true} />

	<form onsubmit={handleSubmit} class="space-y-6">
		<!-- Basic Information -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Basic Information</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="name">Product Name</Label>
						<Input id="name" bind:value={name} required />
					</div>
					<div class="space-y-2">
						<Label for="category">Category</Label>
						<select
							id="category"
							bind:value={categoryId}
							required
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<option value="">Select category</option>
							{#each categories as cat}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="description">Description (optional)</Label>
					<textarea
						id="description"
						bind:value={description}
						rows={3}
						class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					></textarea>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="space-y-2">
						<Label for="sellMethod">Sell Method</Label>
						<select
							id="sellMethod"
							bind:value={sellMethod}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<option value="fifo">FIFO (First In, First Out)</option>
							<option value="lifo">LIFO (Last In, First Out)</option>
						</select>
					</div>
					<div class="space-y-2">
						<Label for="status">Status</Label>
						<select
							id="status"
							bind:value={status}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
						</select>
					</div>
					<div class="space-y-2">
						<Label for="taxRate">Tax Rate (%)</Label>
						<Input id="taxRate" type="number" step="0.01" min="0" bind:value={taxRate} />
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="space-y-2">
						<Label for="discountRate">Discount Rate (%)</Label>
						<Input id="discountRate" type="number" step="0.01" min="0" bind:value={discountRate} />
					</div>
					<div class="space-y-2">
						<Label for="minQty">Min Quantity</Label>
						<Input id="minQty" type="number" step="0.01" min="0" bind:value={minQuantity} />
					</div>
					<div class="space-y-2">
						<Label for="maxQty">Max Quantity</Label>
						<Input id="maxQty" type="number" step="0.01" min="0" bind:value={maxQuantity} />
					</div>
				</div>

				<div class="flex items-center gap-2">
					<input
						type="checkbox"
						id="hasVariants"
						bind:checked={hasVariants}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="hasVariants">This product has multiple variants</Label>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Single Variant (no variants) -->
		{#if !hasVariants}
			<Card.Root>
				<Card.Header>
					<Card.Title>Product Details</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="sku">SKU</Label>
							<Input id="sku" bind:value={sku} required />
						</div>
						<div class="space-y-2">
							<Label for="barcode">Barcode (optional)</Label>
							<Input id="barcode" bind:value={barcode} />
						</div>
					</div>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="unit">Unit</Label>
							<select
								id="unit"
								bind:value={unitId}
								required
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<option value="">Select unit</option>
								{#each units as unit}
									<option value={unit.id}>{unit.name}</option>
								{/each}
							</select>
						</div>
						<div class="space-y-2">
							<Label for="retailPrice">Retail Price</Label>
							<Input id="retailPrice" type="number" step="0.01" min="0" bind:value={retailPrice} required />
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Multiple Variants -->
		{#if hasVariants}
			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between">
						<Card.Title>Variants</Card.Title>
						<Button type="button" variant="outline" size="sm" onclick={addVariant}>
							<Plus class="mr-2 h-4 w-4" />
							Add Variant
						</Button>
					</div>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if variants.length === 0}
						<p class="text-sm text-muted-foreground text-center py-4">
							No variants added. Click "Add Variant" to add one.
						</p>
					{/if}
					{#each variants as variant, index}
						<div class="rounded-md border p-4 space-y-3">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium">Variant {index + 1}</span>
								<Button type="button" variant="ghost" size="sm" onclick={() => removeVariant(index)}>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
							<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
								<div class="space-y-2">
									<Label>SKU</Label>
									<Input bind:value={variant.sku} required />
								</div>
								<div class="space-y-2">
									<Label>Barcode (optional)</Label>
									<Input bind:value={variant.barcode} />
								</div>
							</div>
							<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
								<div class="space-y-2">
									<Label>Unit</Label>
									<select
										bind:value={variant.unit_id}
										required
										class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									>
										<option value="">Select unit</option>
										{#each units as unit}
											<option value={unit.id}>{unit.name}</option>
										{/each}
									</select>
								</div>
								<div class="space-y-2">
									<Label>Retail Price</Label>
									<Input type="number" step="0.01" min="0" bind:value={variant.retail_price} required />
								</div>
							</div>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Images -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Images</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex flex-wrap gap-4">
					{#each imageUrls as url, index}
						<div class="relative h-24 w-24 rounded-md border overflow-hidden group">
							<img src={url} alt="Product" class="h-full w-full object-cover" />
							<button
								type="button"
								class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
								onclick={() => removeImage(index)}
							>
								<Trash2 class="h-4 w-4 text-white" />
							</button>
						</div>
					{/each}
				</div>
				<div>
					<input
						type="file"
						accept="image/*"
						onchange={handleImageUpload}
						disabled={uploadingImage}
						class="text-sm"
					/>
					{#if uploadingImage}
						<span class="text-sm text-muted-foreground ml-2">Uploading...</span>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Price Tiers -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<Card.Title>Price Tiers (optional)</Card.Title>
					<Button type="button" variant="outline" size="sm" onclick={addPriceTier}>
						<Plus class="mr-2 h-4 w-4" />
						Add Tier
					</Button>
				</div>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#if priceTiers.length === 0}
					<p class="text-sm text-muted-foreground text-center py-4">
						No price tiers. Add tiers for quantity-based pricing.
					</p>
				{/if}
				{#each priceTiers as tier, index}
					<div class="flex items-end gap-3">
						<div class="space-y-2 flex-1">
							<Label>Min Quantity</Label>
							<Input type="number" step="1" min="1" bind:value={tier.min_quantity} />
						</div>
						<div class="space-y-2 flex-1">
							<Label>Price</Label>
							<Input type="number" step="0.01" min="0" bind:value={tier.price} />
						</div>
						<Button type="button" variant="ghost" size="sm" onclick={() => removePriceTier(index)}>
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>

		<!-- Submit -->
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" href="/master-data/products">Cancel</Button>
			<Button type="submit" disabled={loading}>
				{loading ? 'Creating...' : 'Create Product'}
			</Button>
		</div>
	</form>
</div>
