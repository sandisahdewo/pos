<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	let { open = $bindable(false), title, description, children } = $props();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			open = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/80"
		onclick={handleBackdropClick}
		role="presentation"
	>
		<div class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2">
			<div class="bg-background border rounded-lg shadow-lg p-6 space-y-4">
				<div class="space-y-2">
					<h2 class="text-lg font-semibold">{title}</h2>
					{#if description}
						<p class="text-sm text-muted-foreground">{description}</p>
					{/if}
				</div>
				<div>
					{@render children()}
				</div>
			</div>
		</div>
	</div>
{/if}
