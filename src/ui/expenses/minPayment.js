import { calcMinPayment } from '../../engine/finance.js';
import { toPence } from '../../engine/currency.js';

/**
 * Resolve the minimum payment to display for a credit-card debt.
 *
 * ── Money-unit boundary (read carefully) ──────────────────────────────────
 * `debtsRepo` returns money in **POUNDS** (pounds-at-the-edge convention), but
 * `finance.calcMinPayment` is an ENGINE function and works entirely in
 * **PENCE** — both its `balancePence` argument and its return value. So we
 * convert the repo's pounds balance and override up to pence with `toPence`
 * before touching the engine, and hand the resulting pence straight to
 * `formatGBP` (which also expects pence).
 *
 * An explicit `minPaymentOverridePence` (also pounds off the repo) always wins
 * over the computed figure.
 *
 * @param {object} debt - a debt row from `debtsRepo` (money fields in pounds).
 * @param {string|Date|null} [referenceDate] - date used for promo-rate checks.
 * @returns {{ pence: number, isOverride: boolean }}
 */
export function resolveMinPayment(debt, referenceDate = null) {
  const override = debt.minPaymentOverridePence;
  if (override != null && override !== '') {
    return { pence: toPence(override), isOverride: true }; // pounds → pence
  }
  const balancePence = toPence(debt.balancePence); // pounds → pence for the engine
  const pence = calcMinPayment(
    balancePence,
    debt.apr ?? 0,
    0,
    referenceDate,
    debt.promoEndDate ?? null
  );
  return { pence, isOverride: false };
}

/**
 * Approximate monthly outgoing for a debt, in **pence** — the figure shown as
 * "≈ £X / month" beside the balance. Credit cards use their current minimum
 * payment (or override); loans use their fixed monthly payment. Both money
 * fields arrive from the repo in POUNDS, so the loan branch converts.
 *
 * @param {object} debt - a debt row from `debtsRepo` (money fields in pounds).
 * @param {string|Date|null} [referenceDate] - passed through for promo checks.
 * @returns {number} pence
 */
export function debtMonthlyPence(debt, referenceDate = null) {
  if (debt.debtType === 'loan') {
    return toPence(debt.fixedMonthlyPaymentPence ?? 0); // pounds → pence
  }
  return resolveMinPayment(debt, referenceDate).pence;
}
