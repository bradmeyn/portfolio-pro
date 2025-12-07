<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { getCurrentUser } from '$lib/remotes/auth.remote';

	const user = getCurrentUser();
</script>

<div class="container mx-auto flex h-screen justify-center">
	<!-- Content -->

	<div class="mx-auto mt-32">
		<h1 class=" mb-4 text-5xl font-light md:text-7xl lg:text-9xl">Portfolio Pro</h1>

		<div class="mx-auto mt-6 flex items-center gap-6">
			{#if user.current}
				<Button size="lg" href="/portfolios" class="mx-auto">
					<span>Dashboard</span>
					<ArrowRight class="ml-2 size-4" />
				</Button>
			{:else if user.ready}
				<div class="mx-auto flex items-center gap-4">
					<Button size="lg" href="/register">
						<span>Register</span>
					</Button>
					<Button size="lg" href="/login" variant="outline">Login</Button>
				</div>
			{/if}
		</div>
	</div>
</div>
