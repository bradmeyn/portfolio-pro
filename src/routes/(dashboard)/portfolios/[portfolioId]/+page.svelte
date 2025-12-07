<script lang="ts">
	import { getPortfolio } from '$lib/remotes/portfolio.remote';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import Button from '$ui/button/button.svelte';
	import AddHoldingDialog from '$lib/components/holding/add-holding-dialog.svelte';

	const portfolio = $derived(await getPortfolio(page.params.portfolioId!));

	$inspect(portfolio);
	const portfolioId = page.params.portfolioId!;

	let addHoldingOpen = $state(false);
</script>

<div class="container mx-auto max-w-3xl py-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-semibold">{portfolio.name}</h1>
		<AddHoldingDialog {portfolioId} bind:open={addHoldingOpen} />
	</div>

	{#if portfolio.holdings.length > 0}
		<div class="card">
			<Table.Root class="bg-white">
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Code</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Avg Price</Table.Head>
						<Table.Head class="text-right">Total Value</Table.Head>
						<Table.Head class="text-right">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each portfolio.holdings as holding}
						<Table.Row>
							<Table.Cell class="font-medium">{holding.name}</Table.Cell>
							<Table.Cell>{holding.code}</Table.Cell>
							<Table.Cell class="text-right">{holding.units}</Table.Cell>
							<Table.Cell class="text-right">${(holding.averagePrice / 100).toFixed(2)}</Table.Cell>
							<Table.Cell class="text-right">
								${((holding.units * holding.averagePrice) / 100).toFixed(2)}
							</Table.Cell>
							<Table.Cell class="text-right">
								<a href="/portfolios/{portfolioId}/{holding.id}">
									<Button variant="outline" size="sm">View Details</Button>
								</a>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<p class="mb-4 text-muted-foreground">
				No holdings yet. Add your first holding to get started.
			</p>
			<Button onclick={() => (addHoldingOpen = true)}>Add Holding</Button>
		</div>
	{/if}
</div>
