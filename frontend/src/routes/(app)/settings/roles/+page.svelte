<script lang="ts">
	import { getClient, APIError } from '$lib/api/client.js';
	import type { RoleResponse } from '$lib/api/types.js';
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

	let roles = $state<RoleResponse[]>([]);
	let loading = $state(true);
	let dialogOpen = $state(false);
	let error = $state('');
	let success = $state('');

	let formName = $state('');
	let formDescription = $state('');
	let formLoading = $state(false);

	createDataLoader(() => loadRoles());

	async function loadRoles() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			roles = await api.get<RoleResponse[]>('/v1/roles');
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load roles';
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
			await api.post('/v1/roles', {
				name: formName,
				description: formDescription || undefined
			});
			success = 'Role created';
			error = '';
			dialogOpen = false;
			await loadRoles();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			formLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Roles - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Roles</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Create Role
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
						<Table.Head>Type</Table.Head>
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
					{:else if roles.length === 0}
						<Table.Row>
							<Table.Cell colspan={4} class="text-center text-muted-foreground py-8">
								No roles found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each roles as role}
							<Table.Row>
								<Table.Cell class="font-medium">{role.name}</Table.Cell>
								<Table.Cell>{role.description || '-'}</Table.Cell>
								<Table.Cell>
									{#if role.is_system_default}
										<Badge>System</Badge>
									{:else}
										<Badge variant="secondary">Custom</Badge>
									{/if}
								</Table.Cell>
								<Table.Cell>
									<a href="/settings/roles/{role.id}" class="text-sm text-primary hover:underline">
										Edit
									</a>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<SimpleDialog bind:open={dialogOpen} title="Create Role" description="Add a new role for your team">
	<form onsubmit={handleCreate} class="space-y-4">
		<div class="space-y-2">
			<Label for="roleName">Role Name</Label>
			<Input id="roleName" bind:value={formName} required />
		</div>
		<div class="space-y-2">
			<Label for="roleDescription">Description (optional)</Label>
			<Input id="roleDescription" bind:value={formDescription} />
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
