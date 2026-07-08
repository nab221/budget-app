import { simulatePayoff, orderDebtsByStrategy, calcMinPayment } from '../../engine/finance.js';

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
  const orderNames = (key) => orderDebtsByStrategy(debts, key, startDate).map((d) => d.name);

  return {
    baselineInterestPence,
    rows: [
      { ...make('avalanche', 'Avalanche (highest APR first)', avalanche), orderNames: orderNames('avalanche') },
      { ...make('snowball', 'Snowball (smallest balance first)', snowball), orderNames: orderNames('snowball') },
      { ...make('min', 'Minimums only', minOnly), orderNames: null },
    ],
  };
}

/**
 * Per-debt breakdown for the chosen strategy: the priority order (which card
 * the extra money attacks first), how this month's payment splits into
 * minimum + extra, and when each debt clears. Runs the simulation once and
 * returns it so callers can reuse it for the schedule table.
 *
 * @param {Array} debts - finance-shape card debts (pence).
 * @param {'avalanche'|'snowball'} strategy
 * @param {number} extraPence
 * @param {Date|string} [startDate]
 * @returns {{
 *   rows: Array<{ id, name, priority, balancePence, effectiveApr, promoActive,
 *     paymentPence, minPence, extraPence, clearedMonth, clearedLabel,
 *     totalInterestPence, neverClears }>,
 *   focusId: *,
 *   sim: object
 * }}
 */
export function buildDebtBreakdown(debts, strategy, extraPence, startDate = new Date()) {
  const sim = simulatePayoff(debts, strategy, extraPence, startDate);
  const ordered = orderDebtsByStrategy(debts, strategy, startDate);
  const firstMonth = sim.history[0] || { payments: [] };
  const paymentById = new Map(firstMonth.payments.map((p) => [p.debtId, p.amount]));
  const resultById = new Map(sim.resultsByDebt.map((r) => [r.id, r]));

  const rows = ordered.map((d, i) => {
    const result = resultById.get(d.id) || {};
    const minPence = calcMinPayment(d.balance, d.effectiveApr);
    const paymentPence = paymentById.get(d.id) ?? 0;
    // The sim never clears a run that hits its 600-month cap.
    const clearedMonth =
      Number.isFinite(result.monthsToClear) && result.monthsToClear < 600
        ? result.monthsToClear
        : null;
    return {
      id: d.id,
      name: d.name,
      priority: i + 1,
      balancePence: d.balance,
      effectiveApr: d.effectiveApr,
      promoActive: Boolean(d.promoEndDate) && d.effectiveApr === 0,
      paymentPence,
      minPence: Math.min(paymentPence, minPence),
      extraPence: Math.max(0, paymentPence - minPence),
      clearedMonth,
      clearedLabel: clearedMonth ? (sim.history[clearedMonth - 1]?.date ?? null) : null,
      totalInterestPence: result.totalInterest ?? 0,
      neverClears: clearedMonth == null,
    };
  });

  // The focus card is the one the extra money actually lands on this month —
  // usually priority 1, but a tiny top-priority balance can be swallowed by
  // its own minimum, cascading the extra to the next card down.
  const focus = rows.find((r) => r.extraPence > 0) ?? rows[0] ?? null;
  return { rows, focusId: focus ? focus.id : null, sim };
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
        // Omit postPromoApr entirely when blank so the finance engine falls back
        // to `apr` rather than seeing a null and simulating the card at 0% (H1).
        ...(d.postPromoApr != null ? { postPromoApr: d.postPromoApr } : {}),
      });
    }
  }
  return { cards, loans };
}
