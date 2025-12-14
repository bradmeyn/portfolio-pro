import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '$lib/remotes/auth.remote';
import { db } from '$db';
import { portfolioTable } from '$db/schemas/portfolio';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { InferSelectModel } from 'drizzle-orm';
import type { transactionTable } from '$db/schemas/portfolio';
import { getStockPrices } from '$lib/server/prices';

type Transaction = InferSelectModel<typeof transactionTable>;

// Helper function to calculate units, average price, and cost base from transactions
function calculateHoldingMetrics(transactions: Transaction[]) {
	let totalUnits = 0;
	let totalCost = 0;

	for (const transaction of transactions) {
		if (transaction.type === 'buy' || transaction.type === 'reinvestment') {
			totalUnits += transaction.quantity;
			totalCost += transaction.quantity * transaction.pricePerUnit;
		} else if (transaction.type === 'sell') {
			totalUnits -= transaction.quantity;
		}
	}

	const averagePrice = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;
	const costBase = totalUnits > 0 ? totalUnits * averagePrice : 0;

	return { units: totalUnits, averagePrice, costBase };
}

export const getPortfolios = query(async () => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolios = await db.query.portfolioTable.findMany({
		where: eq(portfolioTable.userId, user.id),
		with: {
			holdings: {
				with: {
					investment: true,
					transactions: true
				}
			}
		}
	});

	return portfolios.map((portfolio) => ({
		...portfolio,
		holdings: portfolio.holdings.map((holding) => {
			const { units, averagePrice } = calculateHoldingMetrics(holding.transactions);
			return {
				...holding,
				units,
				averagePrice,
				name: holding.investment.name,
				code: holding.investment.code
			};
		})
	}));
});

export const getPortfolio = query(z.string(), async (id: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, id),
		with: {
			holdings: {
				with: {
					investment: true,
					transactions: true
				}
			}
		}
	});

	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');

	// Get all unique investment codes
	const codes = [...new Set(portfolio.holdings.map((h) => h.investment.code))];

	// Fetch current prices for all holdings
	const prices = await getStockPrices(codes);

	// Calculate metrics for each holding
	const holdingsWithMetrics = portfolio.holdings.map((holding) => {
		const { units, averagePrice, costBase } = calculateHoldingMetrics(holding.transactions);
		const currentPrice = prices.get(holding.investment.code) ?? averagePrice; // Fallback to avg price
		const currentValue = units * currentPrice;
		const unrealisedGain = currentValue - costBase;
		const unrealisedGainPercent = costBase > 0 ? (unrealisedGain / costBase) * 100 : 0;

		return {
			...holding,
			units,
			averagePrice,
			costBase,
			currentPrice,
			currentValue,
			unrealisedGain,
			unrealisedGainPercent,
			name: holding.investment.name,
			code: holding.investment.code
		};
	});

	// Calculate portfolio totals
	const totalCostBase = holdingsWithMetrics.reduce((sum, h) => sum + h.costBase, 0);
	const totalValue = holdingsWithMetrics.reduce((sum, h) => sum + h.currentValue, 0);
	const totalUnrealisedGain = totalValue - totalCostBase;
	const totalUnrealisedGainPercent =
		totalCostBase > 0 ? (totalUnrealisedGain / totalCostBase) * 100 : 0;

	return {
		...portfolio,
		holdings: holdingsWithMetrics,
		totalCostBase,
		totalValue,
		totalUnrealisedGain,
		totalUnrealisedGainPercent
	};
});

export const addPortfolio = form(
	z.object({
		name: z.string().min(1, 'Name is required')
	}),
	async ({ name }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const [newPortfolio] = await db
			.insert(portfolioTable)
			.values({
				name,
				userId: user.id
			})
			.returning();

		return { success: true, portfolio: newPortfolio };
	}
);

export const editPortfolio = form(
	z.object({
		id: z.string(),
		name: z.string().min(1, 'Name is required')
	}),
	async ({ id, name }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const portfolio = await db.query.portfolioTable.findFirst({
			where: eq(portfolioTable.id, id)
		});

		if (!portfolio) {
			error(404, 'Portfolio not found');
		}

		if (portfolio.userId !== user.id) {
			error(403, 'Forbidden');
		}

		const [updatedPortfolio] = await db
			.update(portfolioTable)
			.set({ name })
			.where(eq(portfolioTable.id, id))
			.returning();

		return { success: true, portfolio: updatedPortfolio };
	}
);

export const deletePortfolio = command(
	z.object({
		id: z.string()
	}),
	async ({ id }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const portfolio = await db.query.portfolioTable.findFirst({
			where: eq(portfolioTable.id, id)
		});

		if (!portfolio) {
			error(404, 'Portfolio not found');
		}

		if (portfolio.userId !== user.id) {
			error(403, 'Forbidden');
		}

		await db.delete(portfolioTable).where(eq(portfolioTable.id, id));

		await getPortfolios().refresh();

		return { success: true };
	}
);

// Tax calculation types
interface TaxLot {
	date: Date;
	quantity: number;
	costPerUnit: number; // in cents
	holdingId: string;
	holdingName: string;
	holdingCode: string;
}

interface RealisedGain {
	holdingName: string;
	holdingCode: string;
	saleDate: Date;
	quantity: number;
	proceeds: number; // in cents
	costBase: number; // in cents
	gain: number; // in cents
	isLongTerm: boolean; // held > 12 months
}

interface UnrealisedTaxLot extends TaxLot {
	currentPrice: number;
	unrealisedGain: number;
	isLongTerm: boolean;
}

export interface TaxSummary {
	realisedGains: {
		shortTerm: RealisedGain[];
		longTerm: RealisedGain[];
		totalShortTermGain: number;
		totalLongTermGain: number;
		totalGain: number;
	};
	unrealisedLots: UnrealisedTaxLot[];
	holdings: {
		id: string;
		name: string;
		code: string;
		units: number;
		currentPrice: number;
		currentValue: number;
		unrealisedGain: number;
	}[];
}

export const getPortfolioTaxSummary = query(z.string(), async (id: string): Promise<TaxSummary> => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, id),
		with: {
			holdings: {
				with: {
					investment: true,
					transactions: true
				}
			}
		}
	});

	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');

	// Get current prices
	const codes = [...new Set(portfolio.holdings.map((h) => h.investment.code))];
	const prices = await getStockPrices(codes);

	const realisedGainsShortTerm: RealisedGain[] = [];
	const realisedGainsLongTerm: RealisedGain[] = [];
	const unrealisedLots: UnrealisedTaxLot[] = [];
	const holdingsSummary: TaxSummary['holdings'] = [];

	for (const holding of portfolio.holdings) {
		const currentPrice = prices.get(holding.investment.code) ?? 0;

		// Sort transactions by date for FIFO processing
		const sortedTransactions = [...holding.transactions].sort(
			(a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
		);

		// Tax lots using FIFO
		const taxLots: TaxLot[] = [];

		for (const tx of sortedTransactions) {
			if (tx.type === 'buy' || tx.type === 'reinvestment') {
				// Add to tax lots
				taxLots.push({
					date: new Date(tx.transactionDate),
					quantity: tx.quantity,
					costPerUnit: tx.pricePerUnit,
					holdingId: holding.id,
					holdingName: holding.investment.name,
					holdingCode: holding.investment.code
				});
			} else if (tx.type === 'sell') {
				// FIFO: consume oldest lots first
				let remainingToSell = tx.quantity;
				const saleDate = new Date(tx.transactionDate);
				const salePrice = tx.pricePerUnit;

				while (remainingToSell > 0 && taxLots.length > 0) {
					const lot = taxLots[0];
					const quantityFromLot = Math.min(lot.quantity, remainingToSell);

					// Calculate gain for this portion
					const proceeds = quantityFromLot * salePrice;
					const costBase = quantityFromLot * lot.costPerUnit;
					const gain = proceeds - costBase;

					// Check if held > 12 months
					const holdingPeriodMs = saleDate.getTime() - lot.date.getTime();
					const isLongTerm = holdingPeriodMs > 365 * 24 * 60 * 60 * 1000;

					const realisedGain: RealisedGain = {
						holdingName: holding.investment.name,
						holdingCode: holding.investment.code,
						saleDate,
						quantity: quantityFromLot,
						proceeds,
						costBase,
						gain,
						isLongTerm
					};

					if (isLongTerm) {
						realisedGainsLongTerm.push(realisedGain);
					} else {
						realisedGainsShortTerm.push(realisedGain);
					}

					// Update lot
					lot.quantity -= quantityFromLot;
					remainingToSell -= quantityFromLot;

					// Remove exhausted lot
					if (lot.quantity === 0) {
						taxLots.shift();
					}
				}
			}
		}

		// Remaining lots are unrealised
		let totalUnits = 0;
		let totalCostBase = 0;

		for (const lot of taxLots) {
			const holdingPeriodMs = Date.now() - lot.date.getTime();
			const isLongTerm = holdingPeriodMs > 365 * 24 * 60 * 60 * 1000;
			const unrealisedGain = lot.quantity * (currentPrice - lot.costPerUnit);

			unrealisedLots.push({
				...lot,
				currentPrice,
				unrealisedGain,
				isLongTerm
			});

			totalUnits += lot.quantity;
			totalCostBase += lot.quantity * lot.costPerUnit;
		}

		const currentValue = totalUnits * currentPrice;
		const unrealisedGain = currentValue - totalCostBase;

		if (totalUnits > 0) {
			holdingsSummary.push({
				id: holding.id,
				name: holding.investment.name,
				code: holding.investment.code,
				units: totalUnits,
				currentPrice,
				currentValue,
				unrealisedGain
			});
		}
	}

	const totalShortTermGain = realisedGainsShortTerm.reduce((sum, g) => sum + g.gain, 0);
	const totalLongTermGain = realisedGainsLongTerm.reduce((sum, g) => sum + g.gain, 0);

	return {
		realisedGains: {
			shortTerm: realisedGainsShortTerm,
			longTerm: realisedGainsLongTerm,
			totalShortTermGain,
			totalLongTermGain,
			totalGain: totalShortTermGain + totalLongTermGain
		},
		unrealisedLots,
		holdings: holdingsSummary
	};
});
