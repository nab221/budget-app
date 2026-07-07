/**
 * Category reference check (spec §4.7: categories are deletable only when
 * unused). Counts transactions and recurring bills that point at a category so
 * the UI can block deletion with a clear message.
 */

import { db } from '../../db/schema.js';

/**
 * @param {number} categoryId
 * @returns {Promise<{ transactions: number, bills: number, inUse: boolean }>}
 */
export async function findCategoryUsage(categoryId) {
  const [transactions, bills] = await Promise.all([
    db.transactions.where('categoryId').equals(categoryId).count(),
    db.recurringBills.where('categoryId').equals(categoryId).count(),
  ]);
  return { transactions, bills, inUse: transactions > 0 || bills > 0 };
}

/** Human-readable reason a category can't be deleted, or null if it can. */
export function usageBlockMessage(usage) {
  if (!usage || !usage.inUse) return null;
  const parts = [];
  if (usage.transactions > 0) {
    parts.push(`${usage.transactions} transaction${usage.transactions === 1 ? '' : 's'}`);
  }
  if (usage.bills > 0) {
    parts.push(`${usage.bills} recurring bill${usage.bills === 1 ? '' : 's'}`);
  }
  return `Can't delete: still used by ${parts.join(' and ')}.`;
}
