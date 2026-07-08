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

/**
 * Projected total-debt balance by month for the payoff chart (dashboard plan
 * §Z5): the chosen strategy (with the extra payment) drawn against the
 * minimums-only baseline — the gap between the lines is what the extra
 * payments buy. Loans run at their fixed payments in both series.
 *
 * @returns {Array<{month: string, chosenPence: number, minimumsPence: number}>}
 *   index 0 is the start month at current balances; entry i is the balance
 *   after i simulated months. Ends when both series reach zero (or the
 *   simulators' 600-month cap).
 */
export function payoffBalanceSeries(debts, strategy, extraPence = 0, startDate = new Date()) {
  const { cards, loans } = toFinanceDebts(debts);
  if (cards.length === 0 && loans.length === 0) return [];

  const startBalance =
    cards.reduce((t, c) => t + c.currentBalance, 0) +
    loans.reduce((t, l) => t + l.currentBalance, 0);

  const cardChosen = cards.length ? simulatePayoff(cards, strategy, extraPence, startDate) : null;
  const cardMin = cards.length ? simulatePayoff(cards, 'min', 0, startDate) : null;
  const loanSim = loans.length ? simulateLoanPayoff(loans, 'term-reduction', 0, startDate) : null;

  const at = (sim, i) =>
    !sim ? 0 : i < sim.history.length ? sim.history[i].totalRemainingBalance : 0;

  const months = Math.max(
    cardChosen?.history.length || 0,
    cardMin?.history.length || 0,
    loanSim?.history.length || 0
  );

  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const series = [{ month: format(start, 'yyyy-MM'), chosenPence: startBalance, minimumsPence: startBalance }];
  for (let i = 0; i < months; i += 1) {
    series.push({
      month: format(addMonths(start, i + 1), 'yyyy-MM'),
      chosenPence: at(cardChosen, i) + at(loanSim, i),
      minimumsPence: at(cardMin, i) + at(loanSim, i),
    });
  }
  return series;
}

/**
 * Actual total-debt observations from the `balanceUpdates` log (dashboard
 * plan §7) — the dots proving the plan is working.
 *
 * A total is only honest when every current debt has a known balance, so a
 * point is emitted for an update date only once EVERY debt in `debts` has at
 * least one logged balance on or before it (creation seeds the log, so this
 * holds from the moment a debt is added; debts predating the log start
 * contributing once they get their first update). The latest logged balance
 * per debt as of that date is summed.
 *
 * @param {Array<{debtId, date, balancePence}>} updates - pence domain.
 * @param {Array<{id}>} debts - the CURRENT debts (deleted debts' logs cascade away).
 * @returns {Array<{date: string, totalPence: number}>} oldest first, one per date.
 */
export function actualDebtPoints(updates, debts) {
  const wanted = new Set((debts || []).map((d) => d.id));
  if (wanted.size === 0) return [];

  const sorted = (updates || [])
    .filter((u) => wanted.has(u.debtId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0)));

  const latest = new Map(); // debtId → balancePence
  const points = [];
  for (let i = 0; i < sorted.length; i += 1) {
    latest.set(sorted[i].debtId, sorted[i].balancePence || 0);
    const isLastForDate = i === sorted.length - 1 || sorted[i + 1].date !== sorted[i].date;
    if (isLastForDate && latest.size === wanted.size) {
      points.push({
        date: sorted[i].date,
        totalPence: [...latest.values()].reduce((t, v) => t + v, 0),
      });
    }
  }
  return points;
}
