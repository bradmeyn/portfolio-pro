import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency
	}).format(amount / 100); // assuming amount is in cents
}

export function formatPercent(value: number): string {
	return `${(value / 100).toFixed(2)}%`; // assuming value is in basis points
}

/**
 * Check if an asset is eligible for the 50% CGT discount in Australia
 * Must be held for more than 12 months
 */
export function isEligibleForCgtDiscount(purchaseDate: Date): boolean {
	const now = new Date();
	const oneYearAgo = new Date(now);
	oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
	return purchaseDate < oneYearAgo;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
