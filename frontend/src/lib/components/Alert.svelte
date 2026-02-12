<script lang="ts">
	import { onMount } from 'svelte';
	import { X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	type AlertType = 'error' | 'success' | 'info' | 'warning';

	let {
		type = 'info',
		message = $bindable(''),
		dismissible = true,
		autoDismiss = false,
		autoDismissDelay = 5000
	}: {
		type?: AlertType;
		message?: string;
		dismissible?: boolean;
		autoDismiss?: boolean;
		autoDismissDelay?: number;
	} = $props();

	let visible = $derived(!!message);

	const typeStyles = {
		error: 'border-destructive/50 bg-destructive/10 text-destructive',
		success: 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400',
		warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
		info: 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400'
	};

	function dismiss() {
		message = '';
	}

	onMount(() => {
		if (autoDismiss && message) {
			const timer = setTimeout(dismiss, autoDismissDelay);
			return () => clearTimeout(timer);
		}
	});

	// Watch for message changes to set up auto-dismiss
	$effect(() => {
		if (autoDismiss && message) {
			const timer = setTimeout(dismiss, autoDismissDelay);
			return () => clearTimeout(timer);
		}
	});
</script>

{#if visible}
	<div class="rounded-md border p-3 text-sm {typeStyles[type]} flex items-start gap-2">
		<p class="flex-1">{message}</p>
		{#if dismissible}
			<Button variant="ghost" size="icon" class="h-5 w-5 -mr-1 -mt-1" onclick={dismiss}>
				<X class="h-3 w-3" />
				<span class="sr-only">Dismiss</span>
			</Button>
		{/if}
	</div>
{/if}
