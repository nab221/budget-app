import { simulatePayoff } from '../../engine/finance.js';

/**
 * Pure helpers backing the Payoff tab. All money is integer PENCE (the debts
 * passed in are already in the pence domain, mapped to the finance-module shape
 * `{ id, name, currentBalance, apr, promoEndDate, postPromoApr }`).
 */

/**
 * The extra-payment input defaults to the current pay-period "safe to pay"
 * figure until the owner sets their own value (spec §4.4). A persisted value of
 * 0/null means "unset" → fall back to the live safeExtra.
 *
 * @param {number|null} persistedExtraPence
 * @param {number|null} safeExtraPence
 * @returns {number}
 */
export function defaultExtraPence(persistedExtraPence, safeExtraPence) {
  if (persistedExtraPence != null && persistedExtraPence > 0) return persistedExtraPence;
  return safeExtraPence != null && safeExtraPence > 0 ? safeExtraPence : 0;
}

/**
 * Build the avalanche vs snowball vs minimums-only comparison. Interest saved is
 * measured against the minimums-only baseline.
 *
 * @param {Array} debts - finance-shape debts (pence).
 * @param {number} extraPence
 * @param {Date|string} [startDate]
 * @returns {{
 *   rows: Array<{ key, label, monthsToClear:number, totalInterestPence:number, interestSavedPence:number }>,
 *   baselineInterestPence:number
 * }}
 */
export function buildStrategyComparison(debts, extraPence, startDate = new Date()) {
  const minOnly = simulatePayoff(debts, 'min', 0, startDate);
  const baselineInterestPence = minOnly.totalInterest;

  const make = (key, label, sim) => ({
    key,
    label,
    monthsToClear: sim.monthsToClear,
    totalInterestPence: sim.totalInterest,
    interestSavedPence: Math.max(0, baselineInterestPence - sim.totalInterest),
    // A run that hits the 600-month safety cap never actually clears.
    neverClears: sim.monthsToClear >= 600,
  });

  const avalanche = simulatePayoff(debts, 'avalanche', extraPence, startDate);
  const snowball = simulatePayoff(debts, 'snowball', extraPence, startDate);

  return {
    baselineInterestPence,
    rows: [
      make('avalanche', 'Avalanche (highest APR first)', avalanche),
      make('snowball', 'Snowball (smallest balance first)', snowball),
      make('min', 'Minimums only', minOnly),
    ],
  };
}

/**
 * Map pence-domain debts (from planData) into the finance-module shape.
 * @param {Array} debts
 * @returns {{ cards: Array, loans: Array }}
 */
export function toFinanceDebts(debts) {
  const cards = [];
  const loans = [];
  for (const d of debts || []) {
    if ((d.balancePence || 0) <= 0) continue;
    if (d.debtType === 'loan') {
      loans.push({
        id: d.id,
        name: d.name,
        currentBalance: d.balancePence,
        interestRate: d.interestRate ?? 0,
        fixedMonthlyPayment: d.fixedMonthlyPaymentPence ?? 0,
        // Enable overpayments with no early-repayment charge (spec keeps loans simple).
        earlyRepaymentAllowed: true,
        earlyRepaymentFee: 0,
      });
    } else {
      cards.push({
        id: d.id,
        name: d.name,
        currentBalance: d.balancePence,
        apr: d.apr ?? 0,
        promoEndDate: d.promoEndDate ?? null,
        postPromoApr: d.postPromoApr ?? null,
      });
    }
  }
  return { cards, loans };
}
