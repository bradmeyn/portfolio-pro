<script lang="ts">
	import '../../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/header.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header />
	<div class="flex-1 bg-gray-50 py-8">
		<div class="container mx-auto max-w-6xl">
			{@render children?.()}
		</div>
	</div>
	<footer></footer>
</div>
