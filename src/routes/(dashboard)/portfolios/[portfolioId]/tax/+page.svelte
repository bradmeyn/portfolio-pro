<script lang="ts">
	import { getPortfolioTaxSummary, type TaxSummary } from '$lib/remotes/portfolio.remote';
	import { page } from '$app/state';
	import * as Table from '$ui/table';
	import * as NativeSelect from '$ui/native-select/index.js';
	import Input from '$ui/input/input.svelte';
	import Button from '$ui/button/button.svelte';
	import { formatCurrency } from '$lib/utils';

	const portfolioId = page.params.portfolioId!;
	const taxSummary = $derived(await getPortfolioTaxSummary(portfolioId));

	// Australian Financial Year: July 1 - June 30
	const currentFY = $derived.by(() => {
		const now = new Date();
		const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
		return {
			label: `FY${year}-${year + 1}`,
			start: new Date(year, 6, 1), // July 1
			end: new Date(year + 1, 5, 30, 23, 59, 59) // June 30
		};
	});

	// Filter realised gains/losses for current FY
	const allFYGains = $derived(
		[...taxSummary.realisedGains.longTerm, ...taxSummary.realisedGains.shortTerm].filter((g) => {
			const saleDate = new Date(g.saleDate);
			return saleDate >= currentFY.start && saleDate <= currentFY.end;
		})
	);

	// Separate into gains and losses, then by term
	const fyShortTermGains = $derived(
		allFYGains
			.filter((g) => !g.isLongTerm && g.gain > 0)
			.sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime())
	);

	const fyLongTermGains = $derived(
		allFYGains
			.filter((g) => g.isLongTerm && g.gain > 0)
			.sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime())
	);

	const fyCapitalLosses = $derived(
		allFYGains
			.filter((g) => g.gain < 0)
			.sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime())
	);

	const fyTotalShortTermGains = $derived(fyShortTermGains.reduce((sum, g) => sum + g.gain, 0));
	const fyTotalLongTermGains = $derived(fyLongTermGains.reduce((sum, g) => sum + g.gain, 0));
	const fyTotalCapitalLosses = $derived(fyCapitalLosses.reduce((sum, g) => sum + g.gain, 0)); // negative number

	// Tax rate options (Australian marginal rates)
	const taxRates = [
		{ label: '0% (Tax-free threshold)', value: 0 },
		{ label: '19% ($18,201 - $45,000)', value: 19 },
		{ label: '32.5% ($45,001 - $120,000)', value: 32.5 },
		{ label: '37% ($120,001 - $180,000)', value: 37 },
		{ label: '45% ($180,001+)', value: 45 }
	];

	let selectedTaxRate = $state(32.5);

	// Mock sale simulator state - track units to sell per holding
	let unitsToSellByHolding = $state<Record<string, number>>({});

	// Calculate mock sale for a single holding using FIFO
	function calculateMockSale(holdingId: string, unitsToSell: number) {
		if (unitsToSell <= 0) return null;

		const holdingLots = taxSummary.unrealisedLots
			.filter((lot) => lot.holdingId === holdingId)
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

		let remainingToSell = unitsToSell;
		let shortTermGain = 0;
		let longTermGain = 0;
		let totalProceeds = 0;
		let totalCostBase = 0;

		for (const lot of holdingLots) {
			if (remainingToSell <= 0) break;

			const quantityFromLot = Math.min(lot.quantity, remainingToSell);
			const proceeds = quantityFromLot * lot.currentPrice;
			const costBase = quantityFromLot * lot.costPerUnit;
			const gain = proceeds - costBase;

			totalProceeds += proceeds;
			totalCostBase += costBase;

			if (lot.isLongTerm) {
				longTermGain += gain;
			} else {
				shortTermGain += gain;
			}

			remainingToSell -= quantityFromLot;
		}

		const totalGain = shortTermGain + longTermGain;
		const taxableShortTerm = shortTermGain;
		const taxableLongTerm = longTermGain > 0 ? longTermGain * 0.5 : longTermGain;
		const totalTaxableGain = taxableShortTerm + taxableLongTerm;
		const estimatedTax = totalTaxableGain > 0 ? totalTaxableGain * (selectedTaxRate / 100) : 0;

		return {
			unitsToSell: unitsToSell - remainingToSell,
			shortTermGain,
			longTermGain,
			totalGain,
			totalProceeds,
			totalCostBase,
			taxableShortTerm,
			taxableLongTerm,
			totalTaxableGain,
			estimatedTax
		};
	}

	// Combined mock sale results across all holdings
	const combinedMockSale = $derived.by(() => {
		let totalShortTermGain = 0;
		let totalLongTermGain = 0;
		let totalProceeds = 0;
		let totalCostBase = 0;
		let totalUnits = 0;

		for (const holding of taxSummary.holdings) {
			const units = unitsToSellByHolding[holding.id] || 0;
			if (units > 0) {
				const result = calculateMockSale(holding.id, units);
				if (result) {
					totalShortTermGain += result.shortTermGain;
					totalLongTermGain += result.longTermGain;
					totalProceeds += result.totalProceeds;
					totalCostBase += result.totalCostBase;
					totalUnits += result.unitsToSell;
				}
			}
		}

		if (totalUnits === 0) return null;

		const totalGain = totalShortTermGain + totalLongTermGain;
		const taxableShortTerm = totalShortTermGain;
		const taxableLongTerm = totalLongTermGain > 0 ? totalLongTermGain * 0.5 : totalLongTermGain;
		const totalTaxableGain = taxableShortTerm + taxableLongTerm;
		const estimatedTax = totalTaxableGain > 0 ? totalTaxableGain * (selectedTaxRate / 100) : 0;

		return {
			totalUnits,
			shortTermGain: totalShortTermGain,
			longTermGain: totalLongTermGain,
			totalGain,
			totalProceeds,
			totalCostBase,
			taxableShortTerm,
			taxableLongTerm,
			totalTaxableGain,
			estimatedTax
		};
	});

	// Calculate CGT with loss offsetting (losses offset short-term first, then long-term)
	const cgtCalc = $derived.by(() => {
		const totalLosses = Math.abs(fyTotalCapitalLosses); // positive number for offsetting

		// Step 1: Offset losses against short-term gains first
		const lossesAppliedToShortTerm = Math.min(totalLosses, fyTotalShortTermGains);
		const shortTermAfterLosses = fyTotalShortTermGains - lossesAppliedToShortTerm;
		const remainingLosses = totalLosses - lossesAppliedToShortTerm;

		// Step 2: Apply remaining losses to long-term gains
		const lossesAppliedToLongTerm = Math.min(remainingLosses, fyTotalLongTermGains);
		const longTermAfterLosses = fyTotalLongTermGains - lossesAppliedToLongTerm;

		// Step 3: Apply 50% CGT discount to long-term gains
		const cgtDiscount = longTermAfterLosses * 0.5;
		const longTermTaxable = longTermAfterLosses - cgtDiscount;

		// Total taxable capital gain
		const totalTaxableGain = shortTermAfterLosses + longTermTaxable;

		// Estimated tax
		const estimatedTax = totalTaxableGain > 0 ? totalTaxableGain * (selectedTaxRate / 100) : 0;

		return {
			shortTermGains: fyTotalShortTermGains,
			lossesAppliedToShortTerm,
			shortTermAfterLosses,
			longTermGains: fyTotalLongTermGains,
			lossesAppliedToLongTerm,
			longTermAfterLosses,
			cgtDiscount,
			longTermTaxable,
			totalTaxableGain,
			estimatedTax
		};
	});

	const formatDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-3xl font-semibold">Tax Summary - {currentFY.label}</h1>
</div>

<!-- Short-Term Gains Table -->
<div class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-bold">Short-Term Gains</h2>
		<div class="text-right">
			<p class="text-xl font-bold text-green-600">
				{formatCurrency(fyTotalShortTermGains)}
			</p>
			<p class="text-xs text-muted-foreground">Held ≤ 12 months</p>
		</div>
	</div>

	{#if fyShortTermGains.length > 0}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Sale Date</Table.Head>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Proceeds</Table.Head>
						<Table.Head class="text-right">Cost Base</Table.Head>
						<Table.Head class="text-right">Gain</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each fyShortTermGains as gain}
						<Table.Row>
							<Table.Cell>{formatDate(gain.saleDate)}</Table.Cell>
							<Table.Cell class="font-medium">{gain.holdingName} ({gain.holdingCode})</Table.Cell>
							<Table.Cell class="text-right">{gain.quantity}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(gain.proceeds)}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(gain.costBase)}</Table.Cell>
							<Table.Cell class="text-right text-green-600">
								{formatCurrency(gain.gain)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
				<Table.Footer>
					<Table.Row>
						<Table.Cell colspan={5} class="font-medium">Total</Table.Cell>
						<Table.Cell class="text-right font-bold text-green-600">
							{formatCurrency(fyTotalShortTermGains)}
						</Table.Cell>
					</Table.Row>
				</Table.Footer>
			</Table.Root>
		</div>
	{:else}
		<div class="card py-8 text-center text-muted-foreground">
			No short-term gains in {currentFY.label}.
		</div>
	{/if}
</div>

<!-- Long-Term Gains Table -->
<div class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-bold">Long-Term Gains</h2>
		<div class="text-right">
			<p class="text-xl font-bold text-green-600">
				{formatCurrency(fyTotalLongTermGains)}
			</p>
			<p class="text-xs text-muted-foreground">Held &gt; 12 months (50% discount eligible)</p>
		</div>
	</div>

	{#if fyLongTermGains.length > 0}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Sale Date</Table.Head>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Proceeds</Table.Head>
						<Table.Head class="text-right">Cost Base</Table.Head>
						<Table.Head class="text-right">Gain</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each fyLongTermGains as gain}
						<Table.Row>
							<Table.Cell>{formatDate(gain.saleDate)}</Table.Cell>
							<Table.Cell class="font-medium">{gain.holdingName} ({gain.holdingCode})</Table.Cell>
							<Table.Cell class="text-right">{gain.quantity}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(gain.proceeds)}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(gain.costBase)}</Table.Cell>
							<Table.Cell class="text-right text-green-600">
								{formatCurrency(gain.gain)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
				<Table.Footer>
					<Table.Row>
						<Table.Cell colspan={5} class="font-medium">Total</Table.Cell>
						<Table.Cell class="text-right font-bold text-green-600">
							{formatCurrency(fyTotalLongTermGains)}
						</Table.Cell>
					</Table.Row>
				</Table.Footer>
			</Table.Root>
		</div>
	{:else}
		<div class="card py-8 text-center text-muted-foreground">
			No long-term gains in {currentFY.label}.
		</div>
	{/if}
</div>

<!-- Capital Losses Table -->
<div class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-bold">Capital Losses</h2>
		<div class="text-right">
			<p class="text-xl font-bold text-red-600">
				{formatCurrency(fyTotalCapitalLosses)}
			</p>
			<p class="text-xs text-muted-foreground">Offset against gains</p>
		</div>
	</div>

	{#if fyCapitalLosses.length > 0}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Sale Date</Table.Head>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Proceeds</Table.Head>
						<Table.Head class="text-right">Cost Base</Table.Head>
						<Table.Head class="text-right">Loss</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each fyCapitalLosses as loss}
						<Table.Row>
							<Table.Cell>{formatDate(loss.saleDate)}</Table.Cell>
							<Table.Cell class="font-medium">{loss.holdingName} ({loss.holdingCode})</Table.Cell>
							<Table.Cell class="text-right">{loss.quantity}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(loss.proceeds)}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(loss.costBase)}</Table.Cell>
							<Table.Cell class="text-right text-red-600">
								{formatCurrency(loss.gain)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
				<Table.Footer>
					<Table.Row>
						<Table.Cell colspan={5} class="font-medium">Total</Table.Cell>
						<Table.Cell class="text-right font-bold text-red-600">
							{formatCurrency(fyTotalCapitalLosses)}
						</Table.Cell>
					</Table.Row>
				</Table.Footer>
			</Table.Root>
		</div>
	{:else}
		<div class="card py-8 text-center text-muted-foreground">
			No capital losses in {currentFY.label}.
		</div>
	{/if}
</div>

<!-- CGT Summary -->
<div class="mb-8">
	<h2 class="mb-4 text-2xl font-bold">Summary</h2>
	<p class="mb-4 text-sm text-muted-foreground">
		Capital losses are first offset against short-term gains, then long-term gains. Long-term gains
		receive a 50% CGT discount.
	</p>

	<div class="card">
		<!-- Short-Term Section -->
		<div class="mb-6">
			<h3 class="mb-3 font-semibold">
				Capital Gains on shares applicable for 'Other' method (short-term gains)
			</h3>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span>Short Term Gains</span>
					<span>{formatCurrency(cgtCalc.shortTermGains)}</span>
				</div>
				<div class="flex justify-between border-b pb-2">
					<span class="italic">less Capital losses available to offset</span>
					<span class="text-red-600">{formatCurrency(-cgtCalc.lossesAppliedToShortTerm)}</span>
				</div>
				<div class="flex justify-between font-medium">
					<span></span>
					<span>{formatCurrency(cgtCalc.shortTermAfterLosses)}</span>
				</div>
			</div>
		</div>

		<!-- Long-Term Section -->
		<div class="mb-6">
			<h3 class="mb-3 font-semibold">
				Capital Gains on shares applicable for 'Discount' method (long-term gains)
			</h3>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span>Long Term Gains</span>
					<span>{formatCurrency(cgtCalc.longTermGains)}</span>
				</div>
				<div class="flex justify-between border-b pb-2">
					<span class="italic">less Capital losses available to offset</span>
					<span class="text-red-600">{formatCurrency(-cgtCalc.lossesAppliedToLongTerm)}</span>
				</div>
				<div class="flex justify-between">
					<span></span>
					<span>{formatCurrency(cgtCalc.longTermAfterLosses)}</span>
				</div>
				<div class="flex justify-between border-b pb-2">
					<span class="italic">less CGT Concession Amount @ 50%</span>
					<span class="text-red-600">{formatCurrency(-cgtCalc.cgtDiscount)}</span>
				</div>
			</div>
		</div>

		<!-- Total -->
		<div class="border-t-2 border-foreground pt-4">
			<div class="flex justify-between text-lg font-bold">
				<span>Capital Gain</span>
				<span>{formatCurrency(cgtCalc.totalTaxableGain)}</span>
			</div>
			<div class="mt-2 flex items-center justify-between text-lg">
				<span class="flex items-center gap-2">
					Estimated Tax @
					<NativeSelect.Root class="w-40" bind:value={selectedTaxRate}>
						{#each taxRates as rate}
							<NativeSelect.Option value={rate.value}>{rate.value}%</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				</span>
				<span class="font-bold text-orange-600">{formatCurrency(cgtCalc.estimatedTax)}</span>
			</div>
		</div>
	</div>
</div>

<!-- Sale Simulator -->
<div class="mb-8">
	<h2 class="mb-4 text-2xl font-bold">Sale Simulator</h2>
	<p class="mb-4 text-muted-foreground">
		Estimate the tax impact of selling units using FIFO (First In, First Out) method.
	</p>

	{#if taxSummary.holdings.length > 0}
		<div class="card mb-4">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Holding</Table.Head>
						<Table.Head class="text-right">Price</Table.Head>
						<Table.Head class="text-right">Available</Table.Head>
						<Table.Head class="text-right">Units to Sell</Table.Head>
						<Table.Head class="text-right">Proceeds</Table.Head>
						<Table.Head class="text-right">Gain/Loss</Table.Head>
						<Table.Head class="text-right">Est. Tax</Table.Head>
						<Table.Head></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each taxSummary.holdings as holding}
						{@const unitsToSell = unitsToSellByHolding[holding.id] || 0}
						{@const mockResult = calculateMockSale(holding.id, unitsToSell)}
						<Table.Row>
							<Table.Cell>
								<p class="font-medium">{holding.name}</p>
								<p class="text-sm text-muted-foreground">{holding.code}</p>
							</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(holding.currentPrice)}</Table.Cell>
							<Table.Cell class="text-right">{holding.units}</Table.Cell>
							<Table.Cell class="text-right">
								<Input
									type="number"
									value={unitsToSell}
									oninput={(e) => {
										const value = parseInt(e.currentTarget.value) || 0;
										unitsToSellByHolding = {
											...unitsToSellByHolding,
											[holding.id]: Math.min(value, holding.units)
										};
									}}
									min="0"
									max={holding.units}
									placeholder="0"
									class="w-24 text-right"
								/>
							</Table.Cell>
							<Table.Cell class="text-right">
								{mockResult ? formatCurrency(mockResult.totalProceeds) : '-'}
							</Table.Cell>
							<Table.Cell class="text-right">
								{#if mockResult}
									<span class={mockResult.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}>
										{formatCurrency(mockResult.totalGain)}
									</span>
								{:else}
									-
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								{#if mockResult}
									<span class="text-orange-600">{formatCurrency(mockResult.estimatedTax)}</span>
								{:else}
									-
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-1">
									<Button
										variant="outline"
										size="sm"
										onclick={() =>
											(unitsToSellByHolding = {
												...unitsToSellByHolding,
												[holding.id]: holding.units
											})}
									>
										All
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onclick={() =>
											(unitsToSellByHolding = { ...unitsToSellByHolding, [holding.id]: 0 })}
									>
										Clear
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		{#if combinedMockSale}
			<div class="card border-2 border-primary">
				<h3 class="mb-4 text-lg font-semibold">Combined Sale Summary</h3>
				<div class="grid gap-4 md:grid-cols-4">
					<div>
						<p class="text-sm text-muted-foreground">Total Proceeds</p>
						<p class="text-2xl font-bold">{formatCurrency(combinedMockSale.totalProceeds)}</p>
						<p class="text-xs text-muted-foreground">{combinedMockSale.totalUnits} units</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Cost Base</p>
						<p class="text-2xl font-bold">{formatCurrency(combinedMockSale.totalCostBase)}</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Total Gain</p>
						<p
							class="text-2xl font-bold {combinedMockSale.totalGain >= 0
								? 'text-green-600'
								: 'text-red-600'}"
						>
							{formatCurrency(combinedMockSale.totalGain)}
						</p>
						<p class="text-xs text-muted-foreground">
							Short: {formatCurrency(combinedMockSale.shortTermGain)} | Long: {formatCurrency(
								combinedMockSale.longTermGain
							)}
						</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">Estimated Tax</p>
						<p class="text-2xl font-bold text-orange-600">
							{formatCurrency(combinedMockSale.estimatedTax)}
						</p>
						<p class="text-xs text-muted-foreground">
							Taxable: {formatCurrency(combinedMockSale.totalTaxableGain)} at {selectedTaxRate}%
						</p>
					</div>
				</div>

				{#if combinedMockSale.longTermGain > 0}
					<div
						class="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950"
					>
						<p class="text-sm text-green-800 dark:text-green-200">
							<strong>CGT Discount Applied:</strong> Long-term gains of {formatCurrency(
								combinedMockSale.longTermGain
							)}
							reduced to {formatCurrency(combinedMockSale.taxableLongTerm)} (50% discount).
						</p>
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="card py-8 text-center text-muted-foreground">No holdings to simulate sales.</div>
	{/if}
</div>

<!-- Unrealised Tax Lots -->
<div class="mb-8">
	<h2 class="mb-4 text-2xl font-bold">Unrealised Tax Lots (FIFO)</h2>
	<p class="mb-4 text-muted-foreground">
		Your current holdings broken down by purchase date for CGT purposes.
	</p>

	{#if taxSummary.unrealisedLots.length > 0}
		<div class="card">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Holding</Table.Head>
						<Table.Head>Purchase Date</Table.Head>
						<Table.Head class="text-right">Units</Table.Head>
						<Table.Head class="text-right">Cost/Unit</Table.Head>
						<Table.Head class="text-right">Current Price</Table.Head>
						<Table.Head class="text-right">Unrealised Gain</Table.Head>
						<Table.Head>Discount Status</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each taxSummary.unrealisedLots as lot}
						<Table.Row>
							<Table.Cell class="font-medium">{lot.holdingName} ({lot.holdingCode})</Table.Cell>
							<Table.Cell>{formatDate(lot.date)}</Table.Cell>
							<Table.Cell class="text-right">{lot.quantity}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(lot.costPerUnit)}</Table.Cell>
							<Table.Cell class="text-right">{formatCurrency(lot.currentPrice)}</Table.Cell>
							<Table.Cell
								class="text-right {lot.unrealisedGain >= 0 ? 'text-green-600' : 'text-red-600'}"
							>
								{formatCurrency(lot.unrealisedGain)}
							</Table.Cell>
							<Table.Cell>
								{#if lot.isLongTerm}
									<span class="rounded bg-green-100 px-2 py-1 text-xs text-green-800"
										>50% Discount</span
									>
								{:else}
									<span class="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800"
										>Not Yet Eligible</span
									>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{:else}
		<div class="card py-8 text-center text-muted-foreground">
			No unrealised tax lots. Add transactions to see your tax lot breakdown.
		</div>
	{/if}
</div>
