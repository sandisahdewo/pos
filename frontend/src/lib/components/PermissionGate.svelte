<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte.js';
	import type { Snippet } from 'svelte';

	interface Props {
		feature: string;
		action: string;
		children: Snippet;
		fallback?: Snippet;
	}

	let { feature, action, children, fallback }: Props = $props();

	const allowed = $derived(auth.hasPermission(feature, action));
</script>

{#if allowed}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
