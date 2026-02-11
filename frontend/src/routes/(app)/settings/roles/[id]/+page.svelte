<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { getClient, APIError } from '$lib/api/client.js';
	import type { RoleDetailResponse, FeatureResponse } from '$lib/api/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	const roleId = $derived(page.params.id);

	let role = $state<RoleDetailResponse | null>(null);
	let features = $state<FeatureResponse[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Permission state: featureId -> Set of actions
	let permissionMap = $state<Map<string, Set<string>>>(new Map());

	// Use $effect for data loading - onMount doesn't fire reliably
	// when the component is conditionally rendered by the parent layout
	let initialized = $state(false);
	$effect(() => {
		if (!initialized) {
			initialized = true;
			untrack(() => {
				loadRoleData();
			});
		}
	});

	async function loadRoleData() {
		loading = true;
		error = null;
		try {
			const api = getClient();
			const [roleData, featureData] = await Promise.all([
				api.get<RoleDetailResponse>(`/v1/roles/${roleId}`),
				api.get<FeatureResponse[]>('/v1/features')
			]);
			role = roleData;
			// Keep the nested structure for tree display
			features = featureData;

			// Build permission map from existing role permissions
			const map = new Map<string, Set<string>>();
			for (const perm of roleData.permissions) {
				map.set(perm.feature_id, new Set(perm.actions));
			}
			permissionMap = map;
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load role data';
		} finally {
			loading = false;
		}
	}

	function toggleAction(featureId: string, action: string) {
		const current = permissionMap.get(featureId) ?? new Set();
		if (current.has(action)) {
			current.delete(action);
		} else {
			current.add(action);
		}
		if (current.size === 0) {
			permissionMap.delete(featureId);
		} else {
			permissionMap.set(featureId, current);
		}
		// Trigger reactivity
		permissionMap = new Map(permissionMap);
	}

	function hasAction(featureId: string, action: string): boolean {
		return permissionMap.get(featureId)?.has(action) ?? false;
	}

	// Get all unique actions across all child features in a specific order
	const allActions = $derived.by(() => {
		const actions = new Set<string>();
		for (const parent of features) {
			if (parent.children) {
				for (const child of parent.children) {
					for (const action of child.actions) {
						actions.add(action);
					}
				}
			}
		}
		// Sort in the desired order: read, create, edit, delete
		const actionOrder = ['read', 'create', 'edit', 'delete'];
		return Array.from(actions).sort((a, b) => {
			const indexA = actionOrder.indexOf(a.toLowerCase());
			const indexB = actionOrder.indexOf(b.toLowerCase());
			if (indexA === -1) return 1;
			if (indexB === -1) return -1;
			return indexA - indexB;
		});
	});

	// Get parent features that have children with actions
	const parentFeatures = $derived(
		features.filter((f) => f.children && f.children.some((c) => c.actions.length > 0))
	);

	async function handleSave() {
		saving = true;
		error = null;
		try {
			const api = getClient();
			const permissions = Array.from(permissionMap.entries())
				.filter(([, actions]) => actions.size > 0)
				.map(([featureId, actions]) => ({
					feature_id: featureId,
					actions: Array.from(actions)
				}));

			await api.put(`/v1/roles/${roleId}/permissions`, { permissions });
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to save permissions';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{role?.name ?? 'Role'} - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	{#if error}
		<div class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
			{error}
		</div>
	{/if}

	{#if loading}
		<p class="text-muted-foreground">Loading...</p>
	{:else if role}
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold">{role.name}</h1>
				{#if role.description}
					<p class="text-muted-foreground">{role.description}</p>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if role.is_system_default}
					<Badge>System Role</Badge>
				{/if}
				<a href="/settings/roles" class="text-sm text-muted-foreground hover:underline">
					Back to roles
				</a>
			</div>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Permission Matrix</Card.Title>
				<Card.Description>Configure what this role can do</Card.Description>
			</Card.Header>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Feature</Table.Head>
							{#each allActions as action}
								<Table.Head class="text-center capitalize">{action}</Table.Head>
							{/each}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each parentFeatures as parent}
							<!-- Parent row (header) -->
							<Table.Row class="bg-muted/50">
								<Table.Cell colspan={allActions.length + 1} class="font-semibold">
									{parent.name}
								</Table.Cell>
							</Table.Row>
							<!-- Child rows -->
							{#if parent.children}
								{#each parent.children.filter((c) => c.actions.length > 0) as child}
									<Table.Row>
										<Table.Cell class="pl-8">
											{child.name}
										</Table.Cell>
										{#each allActions as action}
											<Table.Cell class="text-center">
												{#if child.actions.includes(action)}
													<input
														type="checkbox"
														checked={hasAction(child.id, action)}
														onchange={() => toggleAction(child.id, action)}
														class="h-4 w-4 rounded border-input"
													/>
												{:else}
													<span class="text-muted-foreground">-</span>
												{/if}
											</Table.Cell>
										{/each}
									</Table.Row>
								{/each}
							{/if}
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
			<Card.Footer>
				<Button onclick={handleSave} disabled={saving}>
					{saving ? 'Saving...' : 'Save Permissions'}
				</Button>
			</Card.Footer>
		</Card.Root>
	{/if}
</div>
