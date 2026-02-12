<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { X } from '@lucide/svelte';

	let { open = $bindable(false), title, description, children } = $props();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			open = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('keydown', handleKeydown);
			return () => document.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/80"
		onclick={handleBackdropClick}
		role="presentation"
	>
		<div
			class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2"
			role="dialog"
			aria-modal="true"
			aria-labelledby="dialog-title"
			aria-describedby={description ? 'dialog-description' : undefined}
		>
			<div class="bg-background border rounded-lg shadow-lg p-6 space-y-4 relative">
				<Button
					variant="ghost"
					size="icon"
					class="absolute right-4 top-4 h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					onclick={() => (open = false)}
				>
					<X class="h-4 w-4" />
					<span class="sr-only">Close</span>
				</Button>
				<div class="space-y-2 pr-8">
					<h2 id="dialog-title" class="text-lg font-semibold">{title}</h2>
					{#if description}
						<p id="dialog-description" class="text-sm text-muted-foreground">{description}</p>
					{/if}
				</div>
				<div>
					{@render children()}
				</div>
			</div>
		</div>
	</div>
{/if}
