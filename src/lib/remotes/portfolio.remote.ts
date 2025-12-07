import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '$lib/remotes/auth.remote';
import { db } from '$db';
import { portfolioTable } from '$db/schemas/portfolio';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { InferSelectModel } from 'drizzle-orm';
import type { transactionTable } from '$db/schemas/portfolio';

type Transaction = InferSelectModel<typeof transactionTable>;

// Helper function to calculate units and average price from transactions
function calculateHoldingMetrics(transactions: Transaction[]) {
	let totalUnits = 0;
	let totalCost = 0;

	for (const transaction of transactions) {
		if (transaction.type === 'buy') {
			totalUnits += transaction.quantity;
			totalCost += transaction.quantity * transaction.pricePerUnit;
		} else if (transaction.type === 'sell') {
			totalUnits -= transaction.quantity;
		}
	}

	const averagePrice = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;

	return { units: totalUnits, averagePrice };
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

	return {
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
