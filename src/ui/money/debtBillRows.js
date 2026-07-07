/**
 * debtBillRows.js — derive the read-only "debt payment" rows shown in the
 * Recurring Bills list (spec §4.2/§4.3, amended 2026-07-07).
 *
 * One row per active debt (a credit card with a balance, or a loan with a fixed
 * payment). Each row is COMPUTED at read time from the debt record — never
 * persisted — mirroring how the pay-period timeline derives debt outgoings. The
 * "next due" date and amount come from the SAME engine walker
 * (`nextMonthlyOccurrenceOnOrAfter` / `resolveMinPayment`) the plan uses, so a
 * derived row and the timeline can never disagree.
 *
 * ── Money convention ───────────────────────────────────────────────────────
 * `debts` are repository rows (POUNDS at the edge). `resolveMinPayment` and
 * `toPence` cross into the engine's PENCE domain; the returned row exposes both
 * `amountPence` (for the pence-based `<Money pence>` display) and `amountPounds`
 * (for `MarkPaidControl`, which speaks pounds).
 */

import { format, subMonths } from 'date-fns';
import { resolveMinPayment } from '../debts/minPayment.js';
import { toPence, fromPence } from '../../engine/currency.js';
import { nextMonthlyOccurrenceOnOrAfter } from '../../engine/plan.js';

/**
 * @param {Array} debts - repository debts (pounds edge).
 * @param {Array<{debtId:number,date:string}>} debtPayments - occurrences paid.
 * @param {Date} [now]
 * @returns {Array<{debtId, debtType, name, label, amountPence, amountPounds,
 *   occurrenceDate, isAdjusted}>}
 */
export function buildDebtBillRows(debts, debtPayments = [], now = new Date()) {
  const paid = new Set((debtPayments || []).map((p) => `${p.debtId}|${p.date}`));
  // Look back to the 1st of the previous month so an occurrence that already
  // fell earlier in the current pay period (but is still unpaid) is surfaced as
  // the "next due" — matching how an unpaid bill keeps a slightly-past due date.
  const fromStr = `${format(subMonths(now, 1), 'yyyy-MM')}-01`;

  const rows = [];
  for (const debt of debts || []) {
    const isLoan = debt.debtType === 'loan';

    if (isLoan) {
      if (toPence(debt.fixedMonthlyPaymentPence || 0) <= 0) continue;
    } else if (toPence(debt.balancePence || 0) <= 0) {
      continue;
    }

    const day = Number(debt.paymentDayOfMonth) || 1;
    const occ = nextMonthlyOccurrenceOnOrAfter(day, true, fromStr, (date) =>
      paid.has(`${debt.id}|${date}`),
    );
    if (!occ) continue;

    const amountPence = isLoan
      ? toPence(debt.fixedMonthlyPaymentPence || 0)
      : resolveMinPayment(debt, occ.date).pence;
    if (amountPence <= 0) continue;

    rows.push({
      debtId: debt.id,
      debtType: debt.debtType,
      name: debt.name,
      label: `${debt.name} — ${isLoan ? 'loan payment' : 'minimum payment'}`,
      amountPence,
      amountPounds: fromPence(amountPence),
      occurrenceDate: occ.date,
      isAdjusted: occ.isAdjusted,
    });
  }
  return rows;
}

export default buildDebtBillRows;
