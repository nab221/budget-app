/**
 * First-run seeding.
 *
 * Seeds the default category set when the `categories` table is empty. Uses
 * bulkAdd (not the repository, which dispatches per-write) and is idempotent:
 * running it against a non-empty table is a no-op.
 */

import { db } from './schema.js';
import { dispatchMutation } from './events.js';

// Plan Phase 1 step 3 — 2 income + 8 spending = 10 categories.
export const DEFAULT_CATEGORIES = [
  { name: 'Salary', kind: 'income' },
  { name: 'Other Income', kind: 'income' },
  { name: 'Groceries', kind: 'spending' },
  { name: 'Utilities', kind: 'spending' },
  { name: 'Housing', kind: 'spending' },
  { name: 'Transport', kind: 'spending' },
  { name: 'Eating Out', kind: 'spending' },
  { name: 'Kids', kind: 'spending' },
  { name: 'Debt Payment', kind: 'spending' },
  { name: 'Other', kind: 'spending' },
];

/**
 * Seed default categories if none exist.
 * @returns {Promise<boolean>} true if seeding ran, false if it was skipped.
 */
export async function seedDefaultCategories() {
  // Count + bulkAdd in one rw transaction (L3) so two first-run callers racing
  // (e.g. two tabs, or React StrictMode's double-invoke) can't both pass the
  // empty check and double-seed — the second transaction sees the rows.
  const seeded = await db.transaction('rw', db.categories, async () => {
    const count = await db.categories.count();
    if (count > 0) return false;
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c })));
    return true;
  });
  if (seeded) dispatchMutation();
  return seeded;
}
