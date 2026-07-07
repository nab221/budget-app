/**
 * billConfirmation.js — turning a planned recurring-bill occurrence into an
 * actual `transactions` row, and back again.
 *
 * Lives in `src/db/` (NOT the engine) because it touches the repositories. The
 * frequency date-math it needs comes from the engine's single shared stepper
 * (`advanceByFrequency` in `src/engine/plan.js`) so the read-time plan and the
 * persisted `nextDueDate` bump can never disagree — in particular `annual`
 * always means +12 months here, matching `plan.js` (unlike
 * `recurrence.advanceNextDate`, which treats it as monthly).
 *
 * ── Money convention ───────────────────────────────────────────────────────
 * `bill.amountPence` and the `amountPounds` option are POUNDS (the repository
 * edge). We hand them straight to `transactionsRepo.add`, which converts to
 * pence at rest. No pence arithmetic happens in this file.
 *
 * ── Occurrence / date semantics ────────────────────────────────────────────
 * `occurrenceDate` is the bill's NOMINAL due date being marked paid — callers
 * pass `bill.nextDueDate`. On confirm we advance `nextDueDate` to exactly one
 * frequency step after `occurrenceDate`, so the confirmed occurrence drops out
 * of the read-time plan (it is no longer "upcoming"). The transaction's `date`
 * is `occurrenceDate`, which makes the confirm ⇄ unconfirm round-trip exact.
 */

import { transactionsRepo, recurringBillsRepo } from './repositories.js';
import { advanceByFrequency } from '../engine/plan.js';

/**
 * Mark a recurring-bill occurrence as paid.
 *
 * Idempotent-guarded: if a `source:'bill'` transaction already exists for this
 * `billId` + `occurrenceDate`, nothing is created or advanced.
 *
 * @param {object} bill - repository bill (pounds edge): needs
 *   { id, label, categoryId, frequency, nextDueDate, amountPence }.
 * @param {string} [occurrenceDate] - ISO yyyy-MM-dd of the occurrence being
 *   confirmed; defaults to `bill.nextDueDate`.
 * @param {{ amountPounds?: number }} [opts]
 * @returns {Promise<{ created: boolean, alreadyConfirmed?: boolean,
 *   transactionId: number|null, nextDueDate?: string }>}
 */
export async function confirmBillPayment(bill, occurrenceDate = bill?.nextDueDate, opts = {}) {
  if (!bill || bill.id == null) throw new Error('confirmBillPayment: a bill with an id is required');
  if (!occurrenceDate) throw new Error('confirmBillPayment: occurrenceDate (or bill.nextDueDate) is required');

  // Idempotent guard — refuse a duplicate confirm for the same occurrence.
  const existing = await transactionsRepo.findBillPayment(bill.id, occurrenceDate);
  if (existing) {
    return { created: false, alreadyConfirmed: true, transactionId: existing.id };
  }

  const amountPounds = opts.amountPounds != null ? opts.amountPounds : bill.amountPence;

  const transactionId = await transactionsRepo.add({
    date: occurrenceDate,
    kind: 'spend',
    amountPence: amountPounds, // pounds at the repository edge
    categoryId: bill.categoryId,
    description: bill.label || 'Bill',
    source: 'bill',
    billId: bill.id,
  });

  // Advance the bill's next due date by exactly one frequency step past the
  // confirmed occurrence, so the plan stops surfacing it as upcoming.
  const nextDueDate = advanceByFrequency(occurrenceDate, bill.frequency, 1);
  await recurringBillsRepo.update(bill.id, { nextDueDate });

  return { created: true, transactionId, nextDueDate };
}

/**
 * Undo a bill confirmation: delete the transaction row and, when safe, roll the
 * bill's `nextDueDate` back one step to the confirmed occurrence.
 *
 * Resilient: the rollback only happens when the bill's current `nextDueDate` is
 * still exactly one frequency step ahead of the transaction's occurrence (i.e.
 * nothing has drifted it since — a later confirm, a manual edit). Otherwise the
 * row is still deleted but the date is left untouched, and the caller is warned
 * via the return value.
 *
 * @param {object} transaction - the `source:'bill'` transaction (repo shape):
 *   needs { id, date, billId }.
 * @returns {Promise<{ deleted: boolean, rolledBack: boolean,
 *   nextDueDate?: string, reason?: string, warning?: string }>}
 */
export async function unconfirmBillPayment(transaction) {
  if (!transaction || transaction.id == null) {
    throw new Error('unconfirmBillPayment: a transaction with an id is required');
  }

  const bill = transaction.billId != null ? await recurringBillsRepo.get(transaction.billId) : null;

  await transactionsRepo.delete(transaction.id);

  if (!bill) {
    return {
      deleted: true,
      rolledBack: false,
      reason: 'bill-missing',
      warning: 'Linked bill no longer exists; deleted the row without rolling back a due date.',
    };
  }

  const expected = advanceByFrequency(transaction.date, bill.frequency, 1);
  if (bill.nextDueDate === expected) {
    await recurringBillsRepo.update(bill.id, { nextDueDate: transaction.date });
    return { deleted: true, rolledBack: true, nextDueDate: transaction.date };
  }

  return {
    deleted: true,
    rolledBack: false,
    reason: 'drifted',
    warning:
      "The bill's next due date has moved since this was confirmed; deleted the row but left the due date unchanged.",
  };
}

export default { confirmBillPayment, unconfirmBillPayment };
