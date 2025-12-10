<script lang="ts">
	import { getHolding } from '$lib/remotes/holding.remote';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import Button from '$ui/button/button.svelte';
	import AddTransactionsDialog from '$lib/components/transaction/add-transactions-dialog.svelte';
	import TransactionRow from '$lib/components/transaction/transaction-row.svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import { formatCurrency } from '$lib/utils';

	const holdingId = page.params.holdingId!;
	const portfolioId = page.params.portfolioId!;

	const holding = $derived(await getHolding(holdingId));

	let addTransactionsOpen = $state(false);
</script>

<div class="container mx-auto py-6">
	<div class="mb-6">
		<a
			href="/portfolios/{portfolioId}"
			class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="size-4" />
			Back to Portfolio
		</a>
		<div class="mt-4 flex items-start justify-between">
			<div>
				<h1 class="text-3xl font-bold">{holding.investment.name}</h1>
				<p class="text-lg text-muted-foreground">{holding.investment.code}</p>
			</div>
			<AddTransactionsDialog {holdingId} bind:open={addTransactionsOpen} showTrigger={false} />
		</div>
	</div>

	<!-- Holding Summary -->
	<div class="mb-6 grid gap-4 md:grid-cols-4">
		<div class="card">
			<p class="text-sm text-muted-foreground">Total Units</p>
			<p class="text-2xl font-bold">{holding.units || 0}</p>
		</div>
		<div class="card">
			<p class="text-sm text-muted-foreground">Average Price</p>
			<p class="text-2xl font-bold">
				{holding.averagePrice ? formatCurrency(holding.averagePrice) : '$0.00'}
			</p>
		</div>
		<div class="card">
			<p class="text-sm text-muted-foreground">Total Value</p>
			<p class="text-2xl font-bold">
				{holding.units && holding.averagePrice
					? formatCurrency(holding.units * holding.averagePrice)
					: '$0.00'}
			</p>
		</div>
	</div>

	<!-- Transactions Section -->
	<div>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-2xl font-bold">Transactions</h2>
			<Button onclick={() => (addTransactionsOpen = true)}>Add Transactions</Button>
		</div>

		{#if holding.transactions.length > 0}
			<div class="card">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Date</Table.Head>
							<Table.Head>Type</Table.Head>
							<Table.Head class="text-right">Quantity</Table.Head>
							<Table.Head class="text-right">Price per Unit</Table.Head>
							<Table.Head class="text-right">Total</Table.Head>
							<Table.Head class="text-right">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each holding.transactions as transaction}
							<TransactionRow {transaction} {holdingId} />
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{:else}
			<div class="card flex flex-col items-center justify-center py-12 text-center">
				<p class="mb-4 text-muted-foreground">
					No transactions yet. Add your first transaction to get started.
				</p>
				<Button onclick={() => (addTransactionsOpen = true)}>Add Transactions</Button>
			</div>
		{/if}
	</div>
</div>
