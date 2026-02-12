<script lang="ts">
	import { getClient, APIError } from '$lib/api/client.js';
	import type {
		UserDetailResponse,
		RoleResponse,
		StoreResponse,
		InvitationResponse,
		PaginatedResponse
	} from '$lib/api/types.js';
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

	let activeTab = $state<'users' | 'invitations'>('users');

	let users = $state<UserDetailResponse[]>([]);
	let roles = $state<RoleResponse[]>([]);
	let stores = $state<StoreResponse[]>([]);
	let invitations = $state<InvitationResponse[]>([]);
	let loading = $state(true);
	let error = $state('');
	let success = $state('');

	let inviteDialogOpen = $state(false);
	let inviteEmail = $state('');
	let inviteRoleId = $state('');
	let inviteStoreIds = $state<string[]>([]);
	let inviteLoading = $state(false);

	createDataLoader(loadData);

	async function loadData() {
		loading = true;
		error = '';
		try {
			const api = getClient();
			const [usersRes, rolesData, storesData, invitationsData] = await Promise.all([
				api.get<PaginatedResponse<UserDetailResponse>>('/v1/users?page=1&per_page=100'),
				api.get<RoleResponse[]>('/v1/roles'),
				api.get<StoreResponse[]>('/v1/stores'),
				api.get<InvitationResponse[]>('/v1/invitations')
			]);
			users = usersRes.data;
			roles = rolesData;
			stores = storesData;
			invitations = invitationsData;
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to load users';
		} finally {
			loading = false;
		}
	}

	function openInviteDialog() {
		inviteEmail = '';
		inviteRoleId = '';
		inviteStoreIds = [];
		inviteDialogOpen = true;
	}

	async function handleInvite(e: Event) {
		e.preventDefault();
		if (!inviteRoleId) {
			error = 'Please select a role';
			return;
		}
		inviteLoading = true;
		error = '';
		try {
			const api = getClient();
			await api.post('/v1/invitations', {
				email: inviteEmail,
				role_id: inviteRoleId,
				store_ids: inviteStoreIds.length > 0 ? inviteStoreIds : undefined
			});
			success = 'Invitation sent';
			error = '';
			inviteDialogOpen = false;
			await loadData();
		} catch (err) {
			error = err instanceof APIError ? err.toString() : 'An unexpected error occurred';
		} finally {
			inviteLoading = false;
		}
	}

	async function cancelInvitation(id: string) {
		error = '';
		try {
			const api = getClient();
			await api.del(`/v1/invitations/${id}`);
			success = 'Invitation cancelled';
			error = '';
			await loadData();
		} catch (err) {
			error = err instanceof APIError ? err.message : 'Failed to cancel invitation';
		}
	}
</script>

<svelte:head>
	<title>Users - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Users</h1>
		<Button onclick={openInviteDialog}>
			<Plus class="mr-2 h-4 w-4" />
			Invite User
		</Button>
	</div>

	<Alert type="error" bind:message={error} />
	<Alert type="success" bind:message={success} autoDismiss={true} />

	<div class="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
		<button
			class="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab === 'users' ? 'bg-background text-foreground shadow' : ''}"
			onclick={() => (activeTab = 'users')}
		>
			Users
		</button>
		<button
			class="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab === 'invitations' ? 'bg-background text-foreground shadow' : ''}"
			onclick={() => (activeTab = 'invitations')}
		>
			Pending Invitations
			{#if invitations.filter((i) => i.status === 'pending').length > 0}
				<Badge variant="secondary" class="ml-2">
					{invitations.filter((i) => i.status === 'pending').length}
				</Badge>
			{/if}
		</button>
	</div>

	{#if activeTab === 'users'}
		<Card.Root>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Name</Table.Head>
							<Table.Head>Email</Table.Head>
							<Table.Head>Role</Table.Head>
							<Table.Head>Stores</Table.Head>
							<Table.Head>Status</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if loading}
							<Table.Row>
								<Table.Cell colspan={5} class="text-center text-muted-foreground py-8">
									Loading...
								</Table.Cell>
							</Table.Row>
						{:else if users.length === 0}
							<Table.Row>
								<Table.Cell colspan={5} class="text-center text-muted-foreground py-8">
									No users found.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each users as user}
								<Table.Row>
									<Table.Cell class="font-medium">
										{user.first_name} {user.last_name}
									</Table.Cell>
									<Table.Cell>{user.email}</Table.Cell>
									<Table.Cell>
										{#if user.roles && user.roles.length > 0}
											{#each user.roles as role}
												<Badge variant={role.is_system_default ? 'default' : 'secondary'} class="mr-1">
													{role.name}
												</Badge>
											{/each}
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										{#if user.stores && user.stores.length > 0}
											{user.stores.map((s) => s.name).join(', ')}
										{:else}
											<span class="text-muted-foreground">All</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										<Badge variant={user.is_active ? 'default' : 'secondary'}>
											{user.is_active ? 'Active' : 'Inactive'}
										</Badge>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	{/if}

	{#if activeTab === 'invitations'}
		<Card.Root>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Email</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>Expires</Table.Head>
							<Table.Head class="w-24">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if invitations.length === 0}
							<Table.Row>
								<Table.Cell colspan={4} class="text-center text-muted-foreground py-8">
									No pending invitations.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each invitations as invitation}
								<Table.Row>
									<Table.Cell class="font-medium">{invitation.email}</Table.Cell>
									<Table.Cell>
										<Badge
											variant={invitation.status === 'pending' ? 'secondary' : 'default'}
										>
											{invitation.status}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										{new Date(invitation.expires_at).toLocaleDateString()}
									</Table.Cell>
									<Table.Cell>
										{#if invitation.status === 'pending'}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => cancelInvitation(invitation.id)}
											>
												Cancel
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
	{/if}
</div>

<SimpleDialog bind:open={inviteDialogOpen} title="Invite User" description="Send an invitation to join your team">
	<form onsubmit={handleInvite} class="space-y-4">
		<div class="space-y-2">
			<Label for="inviteEmail">Email</Label>
			<Input
				id="inviteEmail"
				type="email"
				bind:value={inviteEmail}
				required
				placeholder="user@example.com"
			/>
		</div>
		<div class="space-y-2">
			<Label for="inviteRole">Role</Label>
			<select
				id="inviteRole"
				bind:value={inviteRoleId}
				required
				class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<option value="">Select a role</option>
				{#each roles as role}
					<option value={role.id}>{role.name}</option>
				{/each}
			</select>
		</div>
		<div class="space-y-2">
			<Label>Store Access (optional)</Label>
			<p class="text-xs text-muted-foreground">
				Leave empty to grant access to all stores (for admin roles).
			</p>
			<div class="space-y-2">
				{#each stores as store}
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							value={store.id}
							checked={inviteStoreIds.includes(store.id)}
							onchange={(e) => {
								const target = e.currentTarget;
								inviteStoreIds = target.checked
									? [...inviteStoreIds, store.id]
									: inviteStoreIds.filter((id) => id !== store.id);
							}}
							class="h-4 w-4 rounded border-input"
						/>
						<span class="text-sm">{store.name}</span>
					</label>
				{/each}
			</div>
		</div>
		<div class="flex justify-end gap-2 mt-4">
			<Button type="button" variant="outline" onclick={() => (inviteDialogOpen = false)}>
				Cancel
			</Button>
			<Button type="submit" disabled={inviteLoading}>
				{inviteLoading ? 'Sending...' : 'Send Invitation'}
			</Button>
		</div>
	</form>
</SimpleDialog>
