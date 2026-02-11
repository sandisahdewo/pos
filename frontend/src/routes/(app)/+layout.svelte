<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { auth, authState } from '$lib/stores/auth.svelte.js';
	import { storeSelector } from '$lib/stores/store-selector.svelte.js';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import StoreSelector from '$lib/components/StoreSelector.svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Menu, LogOut, Loader2 } from '@lucide/svelte';

	let { children } = $props();

	let mounted = $state(false);
	let mobileOpen = $state(false);

	onMount(() => {
		mounted = true;
		storeSelector.initialize();
	});

	// Close mobile sidebar when navigating to a new page
	afterNavigate(() => {
		mobileOpen = false;
	});
</script>

{#if !authState.initialized}
	<div class="flex h-screen items-center justify-center">
		<div class="flex flex-col items-center gap-4">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
			<p class="text-sm text-muted-foreground">Loading...</p>
		</div>
	</div>
{:else}
	<div class="flex h-screen">
	<!-- Desktop sidebar -->
	<aside class="hidden w-64 shrink-0 border-r bg-sidebar lg:block">
		<Sidebar />
	</aside>

	<!-- Main content -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Header -->
		<header class="flex h-14 items-center gap-4 border-b px-4 lg:px-6">
			<!-- Mobile menu button + Sheet -->
			{#if mounted}
				<Sheet.Root bind:open={mobileOpen}>
					<Sheet.Trigger asChild>
						<Button variant="ghost" size="icon" class="lg:hidden">
							<Menu class="h-5 w-5" />
							<span class="sr-only">Toggle menu</span>
						</Button>
					</Sheet.Trigger>
					<Sheet.Content side="left" class="w-64 p-0">
						<Sheet.Header class="sr-only">
							<Sheet.Title>Navigation</Sheet.Title>
							<Sheet.Description>App navigation menu</Sheet.Description>
						</Sheet.Header>
						<Sidebar />
					</Sheet.Content>
				</Sheet.Root>
			{/if}

			<div class="flex-1">
				{#if mounted}
					<StoreSelector />
				{/if}
			</div>

			<Button variant="ghost" size="icon" onclick={() => auth.logout()}>
				<LogOut class="h-4 w-4" />
				<span class="sr-only">Log out</span>
			</Button>
		</header>

		<!-- Page content -->
		<main class="flex-1 overflow-auto p-4 lg:p-6">
			{@render children()}
		</main>
	</div>
</div>
{/if}
