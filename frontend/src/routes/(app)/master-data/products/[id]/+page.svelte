<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getClient, APIError } from '$lib/api/client.js';
	import { auth } from '$lib/stores/auth.svelte.js';
	import type {
		ProductDetailResponse,
		CategoryResponse,
		UnitResponse,
		UpdateProductRequest,
		ProductVariantEntry,
		PriceTierEntry
	} from '$lib/api/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import Alert from '$lib/components/Alert.svelte';
	import SimpleDialog from '$lib/components/SimpleDialog.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { ArrowLeft, Trash2, Plus } from '@lucide/svelte';
	import { createDataLoader } from '$lib/utils/data-loader.svelte.js';

	let product = $state<ProductDetailResponse | null>(null);
	let categories = $state<CategoryResponse[]>([]);
	let units = $state<UnitResponse[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');
	let deactivateDialogOpen = $state(false);

	// Form fields
	let name = $state('');
	let description = $state('');
	let categoryId = $state('');
	let sellMethod = $state('fifo');
	let statusField = $state('active');
	let hasVariants = $state(false);
	let taxRate = $state(0);
	let discountRate = $state(0);
	let minQuantity = $state(0);
	let maxQuantity = $state(0);

	// Price tiers (product-level)
	let priceTiers = $state<{ min_quantity: number; price: number }[]>([]);

	// Image uploads
	let imageUrls = $state<string[]>([]);
	let uploadingImage = $state(false);

	let mounted = $state(false);
	onMount(() => { mounted = true; });

	createDataLoader(() => {
		loadProduct();
		loadCategories();
		loadUnits();
	});

	async function loadProduct() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			const id = page.params.id;
			product = await api.get<ProductDetailResponse>(`/v1/products/${id}`);
			populateForm(product);
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load product';
		} finally {
			loading = false;
		}
	}

	function populateForm(p: ProductDetailResponse) {
		name = p.name;
		description = p.description || '';
		categoryId = p.category_id;
		sellMethod = p.sell_method;
		statusField = p.status;
		hasVariants = p.has_variants;
		taxRate = p.tax_rate;
		discountRate = p.discount_rate;
		minQuantity = p.min_quantity;
		maxQuantity = p.max_quantity;
		priceTiers = (p.price_tiers || []).map((t) => ({
			min_quantity: t.min_quantity,
			price: t.price
		}));
		imageUrls = (p.images || []).map((img) => img.image_url);
	}

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
		if (!product) return;

		saving = true;
		error = '';

		try {
			const api = getClient();

			const variantEntries: ProductVariantEntry[] = (product.variants || []).map((v) => ({
				sku: v.sku,
				barcode: v.barcode || undefined,
				unit_id: v.unit_id,
				retail_price: v.retail_price,
				values: v.values?.map((val) => val.variant_value_id)
			}));

			const tierEntries: PriceTierEntry[] = priceTiers
				.filter((t) => t.min_quantity > 0 && t.price > 0)
				.map((t) => ({ min_quantity: t.min_quantity, price: t.price }));

			const body: UpdateProductRequest = {
				category_id: categoryId,
				name,
				description: description || undefined,
				has_variants: hasVariants,
				sell_method: sellMethod,
				status: statusField,
				tax_rate: taxRate || undefined,
				discount_rate: discountRate || undefined,
				min_quantity: minQuantity || undefined,
				max_quantity: maxQuantity || undefined,
				is_active: product!.is_active,
				variants: variantEntries,
				images: imageUrls.length > 0 ? imageUrls : undefined,
				price_tiers: tierEntries.length > 0 ? tierEntries : undefined
			};

			product = await api.put<ProductDetailResponse>(`/v1/products/${page.params.id}`, body);
			populateForm(product);
			success = 'Product updated successfully';
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			saving = false;
		}
	}

	async function handleDeactivate() {
		try {
			const api = getClient();
			await api.del(`/v1/products/${page.params.id}`);
			goto('/master-data/products');
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to deactivate product';
			deactivateDialogOpen = false;
		}
	}
</script>

<svelte:head>
	<title>{product?.name ?? 'Product Detail'} - Master Data - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="sm" href="/master-data/products">
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back
			</Button>
			<h1 class="text-2xl font-bold">{product?.name ?? 'Product Detail'}</h1>
		</div>
		{#if product}
			<div class="flex gap-2">
				<Button variant="outline" size="sm" href="/master-data/products/{page.params.id}/stock">
					View Stock
				</Button>
				<Button variant="destructive" size="sm" onclick={() => (deactivateDialogOpen = true)}>
					Deactivate
				</Button>
			</div>
		{/if}
	</div>

	<Alert type="error" bind:message={error} />
	<Alert type="success" bind:message={success} autoDismiss={true} />

	{#if loading}
		<div class="text-center text-muted-foreground py-12">Loading product...</div>
	{:else if product}
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
								bind:value={statusField}
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
				</Card.Content>
			</Card.Root>

			<!-- Variants (read-only) -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Variants</Card.Title>
				</Card.Header>
				<Card.Content class="p-0">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>SKU</Table.Head>
								<Table.Head>Barcode</Table.Head>
								<Table.Head>Unit</Table.Head>
								<Table.Head>Retail Price</Table.Head>
								<Table.Head>Status</Table.Head>
								{#if hasVariants}
									<Table.Head>Values</Table.Head>
								{/if}
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#if (product.variants || []).length === 0}
								<Table.Row>
									<Table.Cell colspan={hasVariants ? 6 : 5} class="text-center text-muted-foreground py-8">
										No variants.
									</Table.Cell>
								</Table.Row>
							{:else}
								{#each product.variants as variant}
									<Table.Row>
										<Table.Cell class="font-mono text-sm">{variant.sku}</Table.Cell>
										<Table.Cell>{variant.barcode || '-'}</Table.Cell>
										<Table.Cell>{variant.unit_name}</Table.Cell>
										<Table.Cell>{variant.retail_price.toLocaleString()}</Table.Cell>
										<Table.Cell>
											<Badge variant={variant.is_active ? 'default' : 'secondary'}>
												{variant.is_active ? 'Active' : 'Inactive'}
											</Badge>
										</Table.Cell>
										{#if hasVariants}
											<Table.Cell>
												{#each variant.values || [] as val}
													<Badge variant="outline" class="mr-1">{val.variant_name}: {val.value}</Badge>
												{/each}
											</Table.Cell>
										{/if}
									</Table.Row>
								{/each}
							{/if}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>

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
						<Card.Title>Price Tiers</Card.Title>
						<Button type="button" variant="outline" size="sm" onclick={addPriceTier}>
							<Plus class="mr-2 h-4 w-4" />
							Add Tier
						</Button>
					</div>
				</Card.Header>
				<Card.Content class="space-y-3">
					{#if priceTiers.length === 0}
						<p class="text-sm text-muted-foreground text-center py-4">
							No price tiers configured.
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
				<Button type="submit" disabled={saving}>
					{saving ? 'Saving...' : 'Save Changes'}
				</Button>
			</div>
		</form>
	{/if}
</div>

<SimpleDialog bind:open={deactivateDialogOpen} title="Deactivate Product" description="Are you sure you want to deactivate this product? It will no longer be available for sale.">
	<div class="flex justify-end gap-2 mt-4">
		<Button variant="outline" onclick={() => (deactivateDialogOpen = false)}>Cancel</Button>
		<Button variant="destructive" onclick={handleDeactivate}>Deactivate</Button>
	</div>
</SimpleDialog>
