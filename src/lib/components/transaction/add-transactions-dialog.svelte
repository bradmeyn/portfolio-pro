<script lang="ts">
	import Button, { buttonVariants } from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import * as NativeSelect from '$ui/native-select/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { addTransactions } from '$lib/remotes/transaction.remote';
	import Spinner from '$ui/spinner/spinner.svelte';
	import { Plus, Trash } from '@lucide/svelte';
	import DatePicker from '$ui/date-picker.svelte';
	import type { DateValue } from '@internationalized/date';

	let {
		holdingId,
		open = $bindable(false),
		showTrigger = true
	}: {
		holdingId: string;
		open?: boolean;
		showTrigger?: boolean;
	} = $props();

	let transactions = $state([{ id: 0 }]);
	let transactionDates = $state<(DateValue | undefined)[]>([undefined]);

	function addMore() {
		transactions = [...transactions, { id: transactions.length }];
		transactionDates = [...transactionDates, undefined];
	}

	function removeAt(index: number) {
		if (transactions.length <= 1) return;
		transactions = transactions.filter((_, i) => i !== index);
		transactionDates = transactionDates.filter((_, i) => i !== index);
	}

	function handleDateChange(index: number, date: DateValue | undefined) {
		if (date) {
			addTransactions.fields.transactions[index].transactionDate.set(date.toString());
		}
	}
</script>

<Dialog.Root bind:open>
	{#if showTrigger}
		<Dialog.Trigger class={buttonVariants({ variant: 'default' })}>Add Transactions</Dialog.Trigger>
	{/if}

	<Dialog.Content class="max-h-[90vh] min-w-2xl overflow-y-auto md:min-w-3xl">
		<Dialog.Header>
			<Dialog.Title>Add Transactions</Dialog.Title>
			<Dialog.Description>Add one or more transactions for this holding.</Dialog.Description>
		</Dialog.Header>

		{#each addTransactions.for(holdingId).fields.issues() as issue}
			<p class="text-sm text-red-600">{issue.message}</p>
		{/each}

		<form
			{...addTransactions.enhance(async ({ form, submit }) => {
				try {
					await submit();
					if (addTransactions.result?.success) {
						form.reset();
						transactions = [{ id: 0 }];
						transactionDates = [undefined];
						open = false;
					}
				} catch (e) {
					console.error('Error adding transactions', e);
				}
			})}
			class="space-y-3"
		>
			<div class="space-y-2">
				{#each transactions as transaction, i (transaction.id)}
					<div class="rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm">
						<div class="flex items-center gap-3">
							<Field.Field class="flex-1">
								<NativeSelect.Root
									{...addTransactions.fields.transactions[i].type.as('text')}
									disabled={!!addTransactions.pending}
								>
									<NativeSelect.Option value="">Type</NativeSelect.Option>
									<NativeSelect.Option value="buy">Buy</NativeSelect.Option>
									<NativeSelect.Option value="sell">Sell</NativeSelect.Option>
								</NativeSelect.Root>
								<Field.Error />
							</Field.Field>

							<Field.Field class="flex-1">
								<Input
									{...addTransactions.fields.transactions[i].quantity.as('number')}
									placeholder="Quantity"
									min="1"
									step="1"
									disabled={!!addTransactions.pending}
									class="text-sm"
								/>
								<Field.Error />
							</Field.Field>

							<Field.Field class="flex-1">
								<Input
									{...addTransactions.fields.transactions[i].pricePerUnit.as('number')}
									placeholder="Price"
									min="0"
									step="0.01"
									disabled={!!addTransactions.pending}
									class="text-sm"
								/>
								<Field.Error />
							</Field.Field>

							<Field.Field class="flex-1">
								<Input
									{...addTransactions.fields.transactions[i].brokerage.as('number')}
									placeholder="Brokerage"
									min="0"
									step="0.01"
									disabled={!!addTransactions.pending}
									class="text-sm"
								/>
								<Field.Error />
							</Field.Field>

							<Field.Field class="flex-[1.5]">
								<DatePicker
									bind:value={transactionDates[i]}
									onValueChange={(date) => handleDateChange(i, date)}
								/>
								<input
									type="hidden"
									{...addTransactions.fields.transactions[i].transactionDate.as('text')}
								/>
								<Field.Error />
							</Field.Field>

							<Button
								size="icon-sm"
								onclick={() => removeAt(i)}
								disabled={!!addTransactions.pending || transactions.length <= 1}
								variant="ghost"
								class="shrink-0"
							>
								<Trash class="size-4" />
							</Button>
						</div>
					</div>
				{/each}
			</div>

			<Button
				size="sm"
				onclick={addMore}
				disabled={!!addTransactions.pending}
				variant="outline"
				class="mt-2 gap-2"
			>
				<Plus class="size-4" />
				Add Another
			</Button>

			<input type="hidden" name="holdingId" value={holdingId} />

			<div class="mt-6 flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={!!addTransactions.pending}>
					{#if addTransactions.pending}
						<Spinner class="size-4" />
					{:else}
						Add {transactions.length} Transaction{transactions.length > 1 ? 's' : ''}
					{/if}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
