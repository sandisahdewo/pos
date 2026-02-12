import { untrack } from 'svelte';

/**
 * Creates a one-time data loader that runs in $effect
 * This is needed because onMount doesn't fire reliably when components
 * are conditionally rendered by parent layouts
 */
export function createDataLoader(loadFn: () => void | Promise<void>) {
	let initialized = $state(false);

	$effect(() => {
		if (!initialized) {
			initialized = true;
			untrack(() => {
				const result = loadFn();
				if (result instanceof Promise) {
					result.catch((error) => {
						console.error('[data-loader] Load function failed:', error);
					});
				}
			});
		}
	});

	return {
		get initialized() {
			return initialized;
		}
	};
}
