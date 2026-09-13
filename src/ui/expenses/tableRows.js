/**
 * Row models for the Expenses tab's Table view (design 2026-09-12 §3). Pure,
 * PENCE in and PENCE out: the caller passes the engine-shaped data the tab
 * already builds (`mapDebtsToPence`, `mapBillsToPence`,
 * `childcareDepositsFromChildren`). Nothing here is persisted.
 */
import { addMonths, format, parseISO } from 'date-fns';
import { effectiveApr, monthlyInterestPence } from '../../engine/insights.js';
import { creditCardMinPence } from '../../engine/plan.js';
import { simulatePayoff, simulateLoanPayoff } from '../../engine/finance.js';
import { toFinanceDebts, SIMULATION_CAP_MONTHS } from '../../engine/payoff.js';
import {
  annualisedBillPence,
  annualToPeriodPence,
  nextDebtPayment,
  nextBillOccurrence,
  nextChildcareDeposit,
} from '../../engine/spending.js';
import { cardDomId } from './cardIds.js';

/** 'yyyy-MM' a debt clears; simulation month 1 is the month of `fromStr`. */
function clearMonth(monthsToClear, fromStr) {
  if (!Number.isFinite(monthsToClear) || monthsToClear >= SIMULATION_CAP_MONTHS) return null;
  return format(addMonths(parseISO(fromStr), Math.max(0, monthsToClear - 1)), 'yyyy-MM');
}

/**
 * Per-debt payoff month under the persisted strategy: cards through the card
 * simulator (with the extra payment), loans at their fixed payment. Debts with
 * no balance are skipped by `toFinanceDebts` and simply have no entry.
 * @returns {Map<*, {payoffMonth: string|null, neverClears: boolean}>}
 */
function payoffByDebtId(debts, strategy, extraPence, fromStr) {
  const { cards, loans } = toFinanceDebts(debts);
  const out = new Map();
  const collect = (sim) => {
    for (const r of sim.resultsByDebt) {
      const payoffMonth = clearMonth(r.monthsToClear, fromStr);
      out.set(r.id, { payoffMonth, neverClears: payoffMonth == null });
    }
  };
  if (cards.length > 0) collect(simulatePayoff(cards, strategy, extraPence, fromStr));
  if (loans.length > 0) collect(simulateLoanPayoff(loans, 'term-reduction', 0, fromStr));
  return out;
}

/**
 * @param {{debts: Array, strategy?: 'avalanche'|'snowball', extraPence?: number, fromStr: string}} args
 * @returns {Array<object>} one DebtRow per debt (see plan Task 3 Interfaces)
 */
export function buildDebtRows({ debts, strategy = 'avalanche', extraPence = 0, fromStr }) {
  const list = debts || [];
  const interestById = new Map(monthlyInterestPence(list, fromStr).byDebt.map((d) => [d.id, d.pence]));
  const payoff = payoffByDebtId(list, strategy, extraPence, fromStr);

  return list.map((d) => {
    const isCard = d.debtType !== 'loan';
    const balance = d.balancePence || 0;
    const limit = isCard ? d.creditLimitPence || 0 : 0;
    const promoActive = isCard && Boolean(d.promoEndDate) && fromStr < d.promoEndDate;
    const paymentPence = isCard
      ? balance > 0
        ? creditCardMinPence(d, fromStr)
        : 0
      : d.fixedMonthlyPaymentPence || 0;
    const p = payoff.get(d.id) || { payoffMonth: null, neverClears: false };
    const next = nextDebtPayment(d, fromStr);
    return {
      id: d.id,
      domId: cardDomId('debt', d.id),
      name: d.name,
      type: isCard ? 'Card' : 'Loan',
      balancePence: balance,
      ratePercent: effectiveApr(d, fromStr),
      promoActive,
      promoEndDate: promoActive ? d.promoEndDate : null,
      postPromoApr: promoActive ? (d.postPromoApr ?? d.apr ?? 0) : null,
      paymentPence,
      interestPence: interestById.get(d.id) || 0,
      utilisation: limit > 0 ? Math.min(100, Math.max(0, (balance / limit) * 100)) : null,
      creditLimitPence: limit > 0 ? limit : null,
      payoffMonth: p.payoffMonth,
      neverClears: p.neverClears,
      nextDate: next ? next.date : null,
      nextAdjusted: Boolean(next && next.isAdjusted),
    };
  });
}

/**
 * @param {{bills: Array, childcareDeposits: Array, categories: Array, fromStr: string}} args
 * @returns {Array<object>} one ExpenseRow per bill, then one per childcare deposit
 */
export function buildExpenseRows({ bills, childcareDeposits, categories, fromStr }) {
  const categoryName = new Map((categories || []).map((c) => [c.id, c.name]));

  const rows = (bills || []).map((b) => {
    const paused = b.active === false;
    const next = paused ? null : nextBillOccurrence(b, fromStr);
    const status = paused ? 'paused' : next ? 'active' : 'ended';
    // Paused and ended rows keep their amount but count for nothing.
    const perYearPence = status === 'active' ? Math.round(annualisedBillPence(b)) : 0;
    return {
      id: b.id,
      domId: cardDomId('bill', b.id),
      kind: 'bill',
      name: b.label,
      category: categoryName.get(b.categoryId) ?? 'Uncategorised',
      amountPence: b.amountPence || 0,
      frequency: b.frequency,
      perMonthPence: status === 'active' ? annualToPeriodPence(annualisedBillPence(b), 'month') : 0,
      perYearPence,
      nextDate: next ? next.date : null,
      nextAdjusted: Boolean(next && next.isAdjusted),
      status,
    };
  });

  for (const dep of childcareDeposits || []) {
    const next = nextChildcareDeposit(dep, fromStr);
    rows.push({
      id: `childcare:${dep.label}`,
      domId: cardDomId('childcare', dep.label),
      kind: 'childcare',
      name: dep.label,
      category: 'Childcare',
      amountPence: dep.amountPence || 0,
      frequency: 'monthly',
      perMonthPence: dep.amountPence || 0,
      perYearPence: (dep.amountPence || 0) * 12,
      nextDate: next ? next.date : null,
      nextAdjusted: Boolean(next && next.isAdjusted),
      status: 'active',
    });
  }
  return rows;
}

/** Totals row for the debts table (pence). */
export function debtTotals(rows) {
  return rows.reduce(
    (t, r) => ({
      balancePence: t.balancePence + (r.balancePence || 0),
      paymentPence: t.paymentPence + (r.paymentPence || 0),
      interestPence: t.interestPence + (r.interestPence || 0),
    }),
    { balancePence: 0, paymentPence: 0, interestPence: 0 },
  );
}

/** Totals row for the expenses table (pence). Inactive rows already carry 0. */
export function expenseTotals(rows) {
  return rows.reduce(
    (t, r) => ({
      perMonthPence: t.perMonthPence + (r.perMonthPence || 0),
      perYearPence: t.perYearPence + (r.perYearPence || 0),
    }),
    { perMonthPence: 0, perYearPence: 0 },
  );
}
