<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';

	import { registerUser } from '$lib/remotes/auth.remote';
</script>

<div class="flex h-screen">
	<div class="flex flex-1 items-center justify-center px-6 py-12">
		<div class="w-full max-w-md space-y-6">
			<!-- Header -->
			<div class="space-y-1 text-center">
				<h1 class="text-3xl text-foreground">Sign up</h1>
			</div>

			{#if registerUser.result?.success === false}
				<div class="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
					Registration failed. Please try again.
				</div>
			{/if}

			<!-- Form -->
			<form {...registerUser} class="space-y-4">
				{#each registerUser.fields.issues() as issue}
					<p class="text-sm text-destructive">{issue.message}</p>
				{/each}

				<div class="grid grid-cols-2 gap-3">
					<Field.Field>
						<Field.Label for="firstName">First name</Field.Label>
						<Input
							{...registerUser.fields.firstName.as('text')}
							id="firstName"
							autocomplete="given-name"
							placeholder="John"
						/>
						<Field.Error errors={registerUser.fields.firstName.issues()} />
					</Field.Field>
					<Field.Field>
						<Field.Label for="lastName">Last name</Field.Label>
						<Input
							{...registerUser.fields.lastName.as('text')}
							id="lastName"
							autocomplete="family-name"
							placeholder="Doe"
						/>
						<Field.Error />
					</Field.Field>
				</div>

				<Field.Field>
					<Field.Label for="email">Email</Field.Label>
					<Input
						{...registerUser.fields.email.as('email')}
						id="email"
						type="email"
						autocomplete="email"
						placeholder="john@example.com"
					/>
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label for="password">Password</Field.Label>
					<Input
						{...registerUser.fields.password.as('password')}
						id="password"
						type="password"
						autocomplete="new-password"
						placeholder="••••••••"
					/>
					<Field.Error />
				</Field.Field>

				<Field.Field>
					<Field.Label for="confirmPassword">Confirm password</Field.Label>
					<Input
						{...registerUser.fields.confirmPassword.as('password')}
						id="confirmPassword"
						type="password"
						autocomplete="new-password"
						placeholder="••••••••"
					/>
					<Field.Error />
				</Field.Field>

				<Button type="submit" class="w-full" size="lg" disabled={!!registerUser.pending}>
					{#if registerUser.pending}
						Creating account...
					{:else}
						Create Account
					{/if}
				</Button>
			</form>

			<!-- Footer -->
			<p class="text-center text-sm text-muted-foreground">
				Already have an account?
				<a href="/login" class="font-medium text-primary hover:underline">Sign in</a>
			</p>
		</div>
	</div>
</div>
