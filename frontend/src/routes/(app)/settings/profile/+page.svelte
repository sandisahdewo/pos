<script lang="ts">
	import { auth, authState } from '$lib/stores/auth.svelte.js';
	import { getClient, APIError } from '$lib/api/client.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	console.log('[profile] Initial - auth.user:', auth.user);
	console.log('[profile] Initial - authState:', authState);

	// Local state for form fields, derived from auth.user
	let firstName = $derived(auth.user?.first_name ?? '');
	let lastName = $derived(auth.user?.last_name ?? '');
	let email = $derived(auth.user?.email ?? '');

	// Track changes to auth.user
	$effect(() => {
		console.log('[profile] $effect triggered - auth.user changed to:', auth.user);
		console.log('[profile] $effect triggered - authState.user:', authState.user);
		console.log('[profile] $effect - derived firstName:', firstName);
	});

	let profileLoading = $state(false);
	let profileError = $state('');
	let profileSuccess = $state('');

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let passwordLoading = $state(false);
	let passwordError = $state('');
	let passwordSuccess = $state('');

	async function handleProfileUpdate(e: Event) {
		e.preventDefault();
		if (!auth.user) return;

		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;

		profileLoading = true;
		profileError = '';
		profileSuccess = '';
		try {
			const api = getClient();
			await api.put(`/v1/users/${auth.user.id}`, {
				first_name: firstName,
				last_name: lastName
			});
			await auth.refreshUser();
			profileSuccess = 'Profile updated';
		} catch (err) {
			if (err instanceof APIError) {
				profileError = err.message;
			} else {
				profileError = 'An unexpected error occurred';
			}
		} finally {
			profileLoading = false;
		}
	}

	async function handlePasswordChange(e: Event) {
		e.preventDefault();
		passwordError = '';
		passwordSuccess = '';
		if (newPassword !== confirmPassword) {
			passwordError = 'Passwords do not match';
			return;
		}
		passwordLoading = true;
		try {
			const api = getClient();
			await api.put('/v1/auth/change-password', {
				current_password: currentPassword,
				new_password: newPassword
			});
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			passwordSuccess = 'Password changed';
		} catch (err) {
			if (err instanceof APIError) {
				passwordError = err.message;
			} else {
				passwordError = 'An unexpected error occurred';
			}
		} finally {
			passwordLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Profile - Settings - POS</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Profile</h1>

	<Card.Root>
		<Card.Header>
			<Card.Title>Personal Information</Card.Title>
			<Card.Description>Update your name and personal details</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleProfileUpdate} class="space-y-4">
				{#if profileError}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{profileError}
					</div>
				{/if}
				{#if profileSuccess}
					<div class="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
						{profileSuccess}
					</div>
				{/if}
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="firstName">First Name</Label>
						<Input id="firstName" name="firstName" value={firstName} required />
					</div>
					<div class="space-y-2">
						<Label for="lastName">Last Name</Label>
						<Input id="lastName" name="lastName" value={lastName} required />
					</div>
				</div>
				<div class="space-y-2">
					<Label for="email">Email</Label>
					<Input id="email" value={email} disabled />
				</div>
				<Button type="submit" disabled={profileLoading}>
					{profileLoading ? 'Saving...' : 'Save Changes'}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<Separator />

	<Card.Root>
		<Card.Header>
			<Card.Title>Change Password</Card.Title>
			<Card.Description>Update your account password</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handlePasswordChange} class="space-y-4">
				{#if passwordError}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{passwordError}
					</div>
				{/if}
				{#if passwordSuccess}
					<div class="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
						{passwordSuccess}
					</div>
				{/if}
				<div class="space-y-2">
					<Label for="currentPassword">Current Password</Label>
					<Input
						id="currentPassword"
						type="password"
						bind:value={currentPassword}
						required
						autocomplete="current-password"
					/>
				</div>
				<div class="space-y-2">
					<Label for="newPassword">New Password</Label>
					<Input
						id="newPassword"
						type="password"
						bind:value={newPassword}
						required
						minlength={8}
						autocomplete="new-password"
					/>
				</div>
				<div class="space-y-2">
					<Label for="confirmPassword">Confirm New Password</Label>
					<Input
						id="confirmPassword"
						type="password"
						bind:value={confirmPassword}
						required
						minlength={8}
						autocomplete="new-password"
					/>
				</div>
				<Button type="submit" disabled={passwordLoading}>
					{passwordLoading ? 'Changing...' : 'Change Password'}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
