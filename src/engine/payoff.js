/**
 * payoff.js — pure adapters between the pence-domain debt rows (planData
 * shape) and the finance-module simulators, plus the combined "when am I
 * debt-free" projection the dashboard leads with.
 *
 * Everything is integer PENCE and driven by injected data + dates — no DB, no
 * clock (per the engine rules).
 *
 * ── Extra-payment convention (design decision, dashboard plan §Z1) ─────────
 * The payoff strategy (avalanche/snowball) is a credit-card concern: extra
 * money goes to the card plan, exactly as the Payoff tab models it. Loans run
 * at their fixed monthly payments with no overpayment. The projected debt-free
 * date is simply the later of the two plans finishing.
 */

import { addMonths, format, parseISO } from 'date-fns';
import { simulatePayoff, simulateLoanPayoff } from './finance.js';

// Both simulators stop at 600 months (50 years); a run that hits the cap
// never actually cleared.
export const SIMULATION_CAP_MONTHS = 600;

/**
 * Map pence-domain debts (from planData) into the finance-module shape.
 * Moved here from `ui/payoff/payoffModel.js` so engine modules (insights,
 * the dashboard projection) can share it without importing UI code;
 * `payoffModel.js` re-exports it unchanged.
 *
 * @param {Array} debts - planData-shape debts (pence).
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

/**
 * When does the household become debt-free under the persisted strategy?
 *
 * @param {Array} debts - planData-shape debts (pence).
 * @param {'avalanche'|'snowball'} strategy
 * @param {number} [extraPence=0] - monthly extra, applied to the card plan.
 * @param {string|Date} [startDate=new Date()]
 * @returns {{ hasDebts: boolean, monthsToClear: number, clearMonth: string|null,
 *   neverClears: boolean, totalInterestPence: number }}
 *   `clearMonth` is 'yyyy-MM' of the final payment (null when there is nothing
 *   to pay or the plan never clears).
 */
export function debtFreeProjection(debts, strategy, extraPence = 0, startDate = new Date()) {
  const { cards, loans } = toFinanceDebts(debts);
  if (cards.length === 0 && loans.length === 0) {
    return {
      hasDebts: false,
      monthsToClear: 0,
      clearMonth: null,
      neverClears: false,
      totalInterestPence: 0,
    };
  }

  let monthsToClear = 0;
  let neverClears = false;
  let totalInterestPence = 0;

  if (cards.length > 0) {
    const sim = simulatePayoff(cards, strategy, extraPence, startDate);
    monthsToClear = Math.max(monthsToClear, sim.monthsToClear);
    totalInterestPence += sim.totalInterest;
    if (sim.monthsToClear >= SIMULATION_CAP_MONTHS) neverClears = true;
  }
  if (loans.length > 0) {
    // 'term-reduction' = keep paying the fixed amount until cleared (no
    // payment recalculation) — the plain reading of a fixed-payment loan.
    const sim = simulateLoanPayoff(loans, 'term-reduction', 0, startDate);
    monthsToClear = Math.max(monthsToClear, sim.monthsToClear);
    totalInterestPence += sim.totalInterest;
    if (sim.monthsToClear >= SIMULATION_CAP_MONTHS) neverClears = true;
  }

  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  // Simulation month 1 is the start month (simulatePayoff: addMonths(start, months-1)).
  const clearMonth = neverClears
    ? null
    : format(addMonths(start, Math.max(0, monthsToClear - 1)), 'yyyy-MM');

  return { hasDebts: true, monthsToClear, clearMonth, neverClears, totalInterestPence };
}
