import { command, form, query } from '$app/server';
import { z } from 'zod';
import { getCurrentUser } from '$lib/remotes/auth.remote';
import { db } from '$db';
import { holdingTable, portfolioTable } from '$db/schemas/portfolio';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { InferSelectModel } from 'drizzle-orm';
import type { transactionTable, investmentTable } from '$db/schemas/portfolio';

type Transaction = InferSelectModel<typeof transactionTable>;
type Investment = InferSelectModel<typeof investmentTable>;
type Holding = InferSelectModel<typeof holdingTable>;

interface HoldingWithMetrics extends Holding {
	units: number;
	averagePrice: number;
	name: string;
	code: string;
	investment: Investment;
	transactions: Transaction[];
}

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
			// Don't adjust totalCost for sells, we keep the original cost basis
		}
	}

	const averagePrice = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;

	return { units: totalUnits, averagePrice };
}

export const getHoldings = query(z.string(), async (portfolioId: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	// Verify user owns the portfolio
	const portfolio = await db.query.portfolioTable.findFirst({
		where: eq(portfolioTable.id, portfolioId)
	});

	if (!portfolio) error(404, 'Portfolio not found');
	if (portfolio.userId !== user.id) error(403, 'Forbidden');

	const holdings = await db.query.holdingTable.findMany({
		where: eq(holdingTable.portfolioId, portfolioId),
		with: {
			investment: true,
			transactions: true
		}
	});

	// Add calculated units and averagePrice to each holding
	return holdings.map((holding): HoldingWithMetrics => {
		const { units, averagePrice } = calculateHoldingMetrics(holding.transactions);
		return {
			...holding,
			units,
			averagePrice,
			name: holding.investment.name,
			code: holding.investment.code
		};
	});
});

export const getHolding = query(z.string(), async (id: string) => {
	const user = await getCurrentUser();
	if (!user) error(401, 'Unauthorized');

	const holding = await db.query.holdingTable.findFirst({
		where: eq(holdingTable.id, id),
		with: {
			portfolio: true,
			investment: true,
			transactions: true
		}
	});

	if (!holding) error(404, 'Holding not found');
	if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

	const { units, averagePrice } = calculateHoldingMetrics(holding.transactions);

	return {
		...holding,
		units,
		averagePrice,
		name: holding.investment.name,
		code: holding.investment.code
	} as HoldingWithMetrics;
});

export const addHolding = form(
	z.object({
		portfolioId: z.string(),
		investmentId: z.string().min(1, 'Investment is required')
	}),
	async ({ portfolioId, investmentId }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		// Verify user owns the portfolio
		const portfolio = await db.query.portfolioTable.findFirst({
			where: eq(portfolioTable.id, portfolioId)
		});

		if (!portfolio) error(404, 'Portfolio not found');
		if (portfolio.userId !== user.id) error(403, 'Forbidden');

		const [newHolding] = await db
			.insert(holdingTable)
			.values({
				portfolioId,
				investmentId
			})
			.returning();

		return { success: true, holding: newHolding };
	}
);

export const editHolding = form(
	z.object({
		id: z.string(),
		investmentId: z.string().min(1, 'Investment is required')
	}),
	async ({ id, investmentId }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const holding = await db.query.holdingTable.findFirst({
			where: eq(holdingTable.id, id),
			with: {
				portfolio: true
			}
		});

		if (!holding) error(404, 'Holding not found');
		if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		const [updatedHolding] = await db
			.update(holdingTable)
			.set({ investmentId })
			.where(eq(holdingTable.id, id))
			.returning();

		return { success: true, holding: updatedHolding };
	}
);

export const deleteHolding = command(
	z.object({
		id: z.string()
	}),
	async ({ id }) => {
		const user = await getCurrentUser();
		if (!user) error(401, 'Unauthorized');

		const holding = await db.query.holdingTable.findFirst({
			where: eq(holdingTable.id, id),
			with: {
				portfolio: true
			}
		});

		if (!holding) error(404, 'Holding not found');
		if (holding.portfolio.userId !== user.id) error(403, 'Forbidden');

		await db.delete(holdingTable).where(eq(holdingTable.id, id));

		await getHoldings(holding.portfolioId).refresh();

		return { success: true };
	}
);
