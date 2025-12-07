<script lang="ts">
	import Button, { buttonVariants } from '$ui/button/button.svelte';
	import * as Dialog from '$ui/dialog/index.js';
	import Input from '$ui/input/input.svelte';
	import * as Field from '$ui/field';
	import { addActivity } from '$lib/remotes/activity.remote';
	import { getItinerary } from '$lib/remotes/itinerary.remote';
	import Spinner from '$ui/spinner/spinner.svelte';
	import { Plus } from '@lucide/svelte';

	let {
		dayId,
		itineraryId,
		open = $bindable(false),
		showTrigger = true
	}: {
		dayId: string;
		itineraryId: string;
		open?: boolean;
		showTrigger?: boolean;
	} = $props();

	async function onSubmitEnhance({ form, submit }: any) {
		try {
			await submit().updates(getItinerary(itineraryId));
			form.reset();
			if (addActivity.result?.success) {
				open = false;
			}
		} catch (e) {
			console.error('Error adding activity', e);
		}
	}
</script>

<Dialog.Root bind:open>
	{#if showTrigger}
		<Dialog.Trigger
			class={buttonVariants({ variant: 'ghost', size: 'icon' })}
			aria-label="Add activity"
		>
			<Plus />
		</Dialog.Trigger>
	{/if}

	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add an Activity</Dialog.Title>
			<Dialog.Description>Provide a name and optional details for this activity.</Dialog.Description
			>
		</Dialog.Header>

		{#each addActivity.fields.issues() as issue}
			<p class="text-sm text-red-600">{issue.message}</p>
		{/each}

		<form {...addActivity.for(dayId).enhance(onSubmitEnhance)} class="space-y-3">
			<Field.Field>
				<Field.Label for="name">Name</Field.Label>
				<Input
					id="name"
					{...addActivity.fields.name.as('text')}
					autocomplete="off"
					placeholder="e.g., Morning Hike"
				/>
				<Field.Error />
			</Field.Field>

			<Field.Field>
				<Field.Label for="description">Description</Field.Label>
				<textarea
					id="description"
					{...addActivity.fields.description.as('text')}
					rows="3"
					class="w-full rounded-md border p-2"
				></textarea>
				<Field.Error />
			</Field.Field>

			<div class="grid grid-cols-2 gap-2">
				<Field.Field>
					<Field.Label for="startTime">Start time</Field.Label>
					<Input
						id="startTime"
						{...addActivity.fields.startTime.as('text')}
						type="time"
						step="60"
						class="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
					/>
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label for="cost">Cost</Field.Label>
					<Input id="cost" {...addActivity.fields.cost.as('number')} min="0" step="0.01" />
					<Field.Error />
				</Field.Field>
			</div>

			<Field.Field>
				<Field.Label for="location">Location</Field.Label>
				<Input
					id="location"
					{...addActivity.fields.location.as('text')}
					placeholder="Optional location"
				/>
				<Field.Error />
			</Field.Field>

			<input type="hidden" name="dayId" value={dayId} />

			<div class="mt-4 flex justify-end">
				<Dialog.Footer>
					<Button type="submit" disabled={!!addActivity.pending}>
						{#if addActivity.pending}
							<Spinner class="size-4" />
						{:else}
							Add Activity
						{/if}
					</Button>
					<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				</Dialog.Footer>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
