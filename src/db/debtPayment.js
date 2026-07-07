/**
 * debtPayment.js — marking a derived debt-payment occurrence paid, and undoing
 * it. The mirror of `billConfirmation.js` for the read-only debt-payment rows
 * that appear in the Recurring Bills list (spec §4.2/§4.3, amended 2026-07-07).
 *
 * Key difference from a bill: a debt has no stored `nextDueDate` to advance. The
 * ONLY record that an occurrence was paid is the `transactions` row itself — it
 * carries the debt's `debtId` and is dated on the occurrence. The plan engine
 * and the derived-row builder both read those transactions to skip paid
 * occurrences. The debt's BALANCE is never touched (spec §4.3 — balances stay
 * honest, updated by hand or from a card-statement PDF).
 *
 * ── Money convention ───────────────────────────────────────────────────────
 * `amountPounds` is POUNDS (the repository edge); it is handed straight to
 * `transactionsRepo.add`, which stores pence. No pence arithmetic here.
 */

import { db } from './schema.js';
import { transactionsRepo, categoriesRepo } from './repositories.js';

/**
 * The category id a debt payment should be logged under: the seeded
 * 'Debt Payment' spending category by name, else the first spending category.
 * Resolved BEFORE the write transaction opens (it reads `categories`, which
 * isn't in the write transaction's scope).
 * @param {Array} [categories] - pre-loaded categories (pounds edge); optional.
 * @returns {Promise<number|null>}
 */
export async function resolveDebtCategoryId(categories = null) {
  const cats = categories || (await categoriesRepo.getAll());
  const named = cats.find((c) => c.name === 'Debt Payment' && c.kind === 'spending');
  if (named) return named.id;
  const firstSpend = cats.find((c) => c.kind === 'spending');
  return firstSpend ? firstSpend.id : null;
}

/**
 * Mark a debt's payment occurrence paid: log a spend transaction linked to the
 * debt. Idempotent — a second confirm for the same debt + occurrence date is a
 * no-op. The debt balance is not modified.
 *
 * @param {object} debt - repository debt (needs { id, name }).
 * @param {string} occurrenceDate - ISO yyyy-MM-dd of the occurrence being paid.
 * @param {{ amountPounds: number, categoryId?: number, categories?: Array }} opts
 * @returns {Promise<{ created: boolean, alreadyConfirmed?: boolean, transactionId: number|null }>}
 */
export async function confirmDebtPayment(debt, occurrenceDate, opts = {}) {
  if (!debt || debt.id == null) throw new Error('confirmDebtPayment: a debt with an id is required');
  if (!occurrenceDate) throw new Error('confirmDebtPayment: occurrenceDate is required');

  const amountPounds = opts.amountPounds;
  // Resolve the category OUTSIDE the write transaction (reads `categories`).
  const categoryId =
    opts.categoryId != null ? opts.categoryId : await resolveDebtCategoryId(opts.categories);

  return db.transaction('rw', db.transactions, async () => {
    const existing = await transactionsRepo.findDebtPayment(debt.id, occurrenceDate);
    if (existing) {
      return { created: false, alreadyConfirmed: true, transactionId: existing.id };
    }
    const transactionId = await transactionsRepo.add({
      date: occurrenceDate,
      kind: 'spend',
      amountPence: amountPounds, // pounds at the repository edge
      categoryId,
      description: `${debt.name} payment`,
      source: 'bill',
      debtId: debt.id,
    });
    return { created: true, transactionId };
  });
}

/**
 * Undo a debt-payment confirmation: delete the transaction row. There is no due
 * date to roll back (debts derive their next occurrence at read time), so the
 * occurrence simply re-appears in the plan and derived row once the row is gone.
 * @param {object} transaction - the debt-payment transaction (needs { id }).
 */
export async function unconfirmDebtPayment(transaction) {
  if (!transaction || transaction.id == null) {
    throw new Error('unconfirmDebtPayment: a transaction with an id is required');
  }
  await transactionsRepo.delete(transaction.id);
  return { deleted: true };
}

export default { confirmDebtPayment, unconfirmDebtPayment, resolveDebtCategoryId };
