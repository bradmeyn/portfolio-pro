<script lang="ts">
	import Button, { buttonVariants } from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { addTransaction } from '$lib/remotes/transaction.remote';
	import { getTransactions } from '$lib/remotes/transaction.remote';
	import { getHolding } from '$lib/remotes/holding.remote';
	import Spinner from '$ui/spinner/spinner.svelte';
	import { Plus } from '@lucide/svelte';

	let {
		holdingId,
		open = $bindable(false),
		showTrigger = true
	}: {
		holdingId: string;
		open?: boolean;
		showTrigger?: boolean;
	} = $props();
</script>

<Dialog.Root bind:open>
	{#if showTrigger}
		<Dialog.Trigger
			class={buttonVariants({ variant: 'ghost', size: 'icon' })}
			aria-label="Add transaction"
		>
			<Plus />
		</Dialog.Trigger>
	{/if}

	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Transaction</Dialog.Title>
			<Dialog.Description>Record a buy or sell transaction for this holding.</Dialog.Description>
		</Dialog.Header>

		{#each addTransaction.fields.issues() as issue}
			<p class="text-sm text-red-600">{issue.message}</p>
		{/each}

		<form
			{...addTransaction.for(holdingId).enhance(async ({ form, submit }) => {
				try {
					await submit().updates(getTransactions(holdingId), getHolding(holdingId));
					form.reset();
					if (addTransaction.result?.success) {
						open = false;
					}
				} catch (e) {
					console.error('Error adding transaction', e);
				}
			})}
			class="space-y-4"
		>
			<Field.Field>
				<Field.Label for="type">Transaction Type</Field.Label>
				<select
					id="type"
					{...addTransaction.fields.type.as('text')}
					class="w-full rounded-md border border-input bg-background px-3 py-2"
				>
					<option value="">Select type</option>
					<option value="buy">Buy</option>
					<option value="sell">Sell</option>
				</select>
				<Field.Error />
			</Field.Field>

			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="quantity">Quantity</Field.Label>
					<Input id="quantity" {...addTransaction.fields.quantity.as('number')} min="1" step="1" />
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label for="pricePerUnit">Price Per Unit</Field.Label>
					<Input
						id="pricePerUnit"
						{...addTransaction.fields.pricePerUnit.as('number')}
						min="0"
						step="0.01"
					/>
					<Field.Error />
				</Field.Field>
			</div>

			<Field.Field>
				<Field.Label for="transactionDate">Transaction Date</Field.Label>
				<Input
					id="transactionDate"
					{...addTransaction.fields.transactionDate.as('text')}
					type="date"
				/>
				<Field.Error />
			</Field.Field>

			<input type="hidden" name="holdingId" value={holdingId} />

			<div class="mt-4 flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!addTransaction.pending}>
					{#if addTransaction.pending}
						<Spinner class="size-4" />
					{:else}
						Add Transaction
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
