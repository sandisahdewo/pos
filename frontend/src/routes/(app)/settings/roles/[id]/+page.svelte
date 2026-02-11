<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
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

	// Permission state: featureId -> Set of actions
	let permissionMap = $state<Map<string, Set<string>>>(new Map());

	onMount(async () => {
		try {
			const api = getClient();
			const [roleData, featureData] = await Promise.all([
				api.get<RoleDetailResponse>(`/v1/roles/${roleId}`),
				api.get<FeatureResponse[]>('/v1/features')
			]);
			role = roleData;
			features = featureData;

			// Build permission map from existing role permissions
			const map = new Map<string, Set<string>>();
			for (const perm of roleData.permissions) {
				map.set(perm.feature_id, new Set(perm.actions));
			}
			permissionMap = map;
		} catch (err) {
			if (err instanceof APIError) {
				// err.message);
			}
		} finally {
			loading = false;
		}
	});

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

	// Get child features (non-parent features with actions)
	const childFeatures = $derived(features.filter((f) => f.parent_id !== null && f.actions.length > 0));

	// Get all unique actions across all features
	const allActions = $derived.by(() => {
		const actions = new Set<string>();
		for (const f of childFeatures) {
			for (const a of f.actions) {
				actions.add(a);
			}
		}
		return Array.from(actions);
	});

	async function handleSave() {
		saving = true;
		try {
			const api = getClient();
			const permissions = Array.from(permissionMap.entries())
				.filter(([, actions]) => actions.size > 0)
				.map(([featureId, actions]) => ({
					feature_id: featureId,
					actions: Array.from(actions)
				}));

			await api.put(`/v1/roles/${roleId}/permissions`, { permissions });
			// 'Permissions saved');
		} catch (err) {
			if (err instanceof APIError) {
				// err.message);
			} else {
				// 'An unexpected error occurred');
			}
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{role?.name ?? 'Role'} - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
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
						{#each childFeatures as feature}
							<Table.Row>
								<Table.Cell class="font-medium">
									{feature.module} / {feature.name}
								</Table.Cell>
								{#each allActions as action}
									<Table.Cell class="text-center">
										{#if feature.actions.includes(action)}
											<input
												type="checkbox"
												checked={hasAction(feature.id, action)}
												onchange={() => toggleAction(feature.id, action)}
												class="h-4 w-4 rounded border-input"
											/>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
								{/each}
							</Table.Row>
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
