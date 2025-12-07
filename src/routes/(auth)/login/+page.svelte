<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { loginUser } from '$lib/remotes/auth.remote';
</script>

<div class="mx-auto flex h-screen items-center justify-center border px-6">
	<div class="w-full max-w-md space-y-2">
		<div class="space-y-2">
			<h1 class=" mb-4 text-center text-2xl">Login</h1>
		</div>

		<div class="border-0 bg-transparent shadow-none">
			<form {...loginUser}>
				<Field.Set>
					<Field.Field>
						<Field.Label for="email">Email</Field.Label>
						<Input
							{...loginUser.fields.email.as('email')}
							autocomplete="off"
							placeholder="brad@example.com"
						/>
						<Field.Error />
					</Field.Field>
					<Field.Field>
						<Field.Label for="password">Password</Field.Label>
						<Input
							{...loginUser.fields.password.as('password')}
							type="password"
							autocomplete="off"
							placeholder="••••••••"
						/>
						<Field.Error />
					</Field.Field>
				</Field.Set>
				<Button type="submit" class="mt-4 w-full">
					{#if loginUser.pending}
						Logging in...
					{:else}
						Log In
					{/if}
				</Button>
			</form>
		</div>

		<div class="text-center">
			<div class="text-sm text-muted-foreground">
				Don't have an account?{' '}
				<a href="/register" class="font-medium text-primary hover:underline"> Sign up </a>
			</div>
		</div>
	</div>
</div>
