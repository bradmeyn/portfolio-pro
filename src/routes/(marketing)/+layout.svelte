<script lang="ts">
	import '../../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col">
	<div class="flex-1">
		{@render children?.()}
	</div>
	<footer></footer>
</div>
