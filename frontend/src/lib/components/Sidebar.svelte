<script lang="ts">
	import { page } from '$app/state';
	import { auth } from '$lib/stores/auth.svelte.js';
	import {
		LayoutDashboard,
		Package,
		BarChart3,
		ShoppingCart,
		Settings,
		User,
		Store,
		Shield,
		Users
	} from '@lucide/svelte';
	import { cn } from '$lib/utils.js';

	interface NavItem {
		label: string;
		href: string;
		icon: typeof LayoutDashboard;
		feature?: string;
		action?: string;
		children?: NavItem[];
	}

	const navItems: NavItem[] = [
		{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
		{
			label: 'Master Data',
			href: '/master-data/products',
			icon: Package,
			feature: 'master-data.product',
			action: 'read'
		},
		{
			label: 'Reporting',
			href: '/reporting/sales',
			icon: BarChart3,
			feature: 'reporting.sales',
			action: 'read'
		},
		{
			label: 'Purchase',
			href: '/purchase/products',
			icon: ShoppingCart,
			feature: 'purchase.product',
			action: 'read'
		}
	];

	const settingsItems: NavItem[] = [
		{ label: 'Profile', href: '/settings/profile', icon: User },
		{ label: 'Stores', href: '/settings/stores', icon: Store },
		{ label: 'Roles', href: '/settings/roles', icon: Shield },
		{ label: 'Users', href: '/settings/users', icon: Users }
	];

	function isActive(href: string): boolean {
		return page.url.pathname.startsWith(href);
	}

	function canSeeItem(item: NavItem): boolean {
		if (!item.feature || !item.action) return true;
		return auth.hasPermission(item.feature, item.action);
	}
</script>

<nav class="flex h-full flex-col gap-2 p-4">
	<div class="mb-4 px-2">
		<h2 class="text-lg font-semibold">POS System</h2>
	</div>

	<div class="flex flex-col gap-1">
		{#each navItems as item}
			{#if canSeeItem(item)}
				<a
					href={item.href}
					class={cn(
						'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
						isActive(item.href)
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
					)}
				>
					<item.icon class="h-4 w-4" />
					{item.label}
				</a>
			{/if}
		{/each}
	</div>

	<div class="my-2">
		<div class="border-t"></div>
	</div>

	<div class="flex flex-col gap-1">
		<span class="px-3 py-1 text-xs font-medium uppercase text-muted-foreground">Settings</span>
		{#each settingsItems as item}
			<a
				href={item.href}
				class={cn(
					'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
					isActive(item.href)
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
				)}
			>
				<item.icon class="h-4 w-4" />
				{item.label}
			</a>
		{/each}
	</div>

	<div class="mt-auto px-2 py-4">
		{#if auth.user}
			<div class="text-sm">
				<p class="font-medium">{auth.user.first_name} {auth.user.last_name}</p>
				<p class="text-muted-foreground">{auth.user.email}</p>
			</div>
		{/if}
	</div>
</nav>
