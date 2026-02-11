<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
</script>

<svelte:head>
	<title>Error - POS</title>
</svelte:head>

<div class="flex items-center justify-center p-8">
	<Card.Root class="max-w-md">
		<Card.Header>
			<Card.Title>Something went wrong</Card.Title>
			<Card.Description>
				{page.error?.message ?? 'An unexpected error occurred'}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<p class="text-sm text-muted-foreground">Status: {page.status}</p>
		</Card.Content>
		<Card.Footer>
			<Button href="/dashboard">Back to Dashboard</Button>
		</Card.Footer>
	</Card.Root>
</div>
