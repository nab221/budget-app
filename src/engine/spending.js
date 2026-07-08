/**
 * spending.js — pure helpers behind the Expenses screen and the minimal
 * Dashboard: "how much leaves the account in a given week / month / year".
 *
 * Everything here is PENCE domain (like the rest of the engine) and computed
 * at read time — nothing is ever persisted. Occurrence expansion reuses the
 * exact walkers `buildPlan` uses (`billOutgoings` / `debtOutgoings`), so a
 * total shown here can never disagree with the pay-period timeline.
 *
 * Two ways of totalling, shown side by side in the UI:
 *  - ACTUAL:      sum of the real occurrences landing inside the selected
 *                 calendar period (a weekly bill counts 4 or 5 times in a
 *                 month depending on the calendar; an annual bill only in its
 *                 month). This answers "what leaves the account this month".
 *  - NORMALISED:  the long-run average per period (weekly ≈ ×52⁄12 per month
 *                 and so on), the same every period. This answers "what does
 *                 this cost me per month on average".
 */

import {
  billOutgoings,
  debtOutgoings,
  childcareOutgoings,
  creditCardMinPence,
  isWeekBased,
  FREQUENCY_DAYS,
  frequencyStepMonths,
  nextMonthlyOccurrenceOnOrAfter,
} from './plan.js';

export const PERIODS = ['week', 'month', 'year'];

const DAYS_PER_YEAR = 365.25;

/** Pad a number to two digits. */
const p2 = (n) => String(n).padStart(2, '0');

/**
 * Format a Date's LOCAL calendar day as 'yyyy-MM-dd'. The UI's "today" must
 * come from here, NOT `toISOString()` — that formats the UTC day, which in the
 * UK (BST) is still *yesterday* between midnight and 1am, and would disagree
 * with `periodWindow` (also local).
 */
export function localDayStr(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/**
 * Calendar window [startStr, endStr) containing `now` for a period.
 * Weeks are Monday-based (UK convention); months and years are calendar.
 *
 * @param {'week'|'month'|'year'} period
 * @param {Date} [now]
 * @returns {{ startStr: string, endStr: string }}
 */
export function periodWindow(period, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'week') {
    // Monday of the current week (getDay(): Sun=0 … Sat=6).
    const back = (now.getDay() + 6) % 7;
    const start = new Date(y, m, now.getDate() - back);
    const end = new Date(y, m, now.getDate() - back + 7);
    return { startStr: localDayStr(start), endStr: localDayStr(end) };
  }
  if (period === 'year') {
    return { startStr: `${y}-01-01`, endStr: `${y + 1}-01-01` };
  }
  // month (default)
  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 0 : m + 1;
  return { startStr: `${y}-${p2(m + 1)}-01`, endStr: `${nextY}-${p2(nextM + 1)}-01` };
}

/**
 * Every committed outgoing occurrence in [startStr, endStr): recurring
 * expenses expanded by frequency, one monthly payment per active debt
 * (card minimum / loan fixed payment), and one monthly deposit per computed
 * childcare commitment. Sorted by date.
 *
 * @param {{recurringBills?: Array, debts?: Array, childcareDeposits?: Array}}
 *   data - PENCE domain (i.e. the shape `gatherPlanData` returns).
 * @returns {Array<{date, label, amountPence, kind, isAdjusted, sourceId?, debtId?}>}
 */
export function spendingOccurrences(data, startStr, endStr) {
  const rows = [
    ...billOutgoings(data.recurringBills, startStr, endStr),
    ...debtOutgoings(data.debts, startStr, endStr),
    ...childcareOutgoings(data.childcareDeposits, startStr, endStr),
  ];
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

/** Sum of `spendingOccurrences` amounts in the window (pence). */
export function actualTotalPence(data, startStr, endStr) {
  return spendingOccurrences(data, startStr, endStr).reduce(
    (t, r) => t + (r.amountPence || 0),
    0,
  );
}

/**
 * Long-run cost of one recurring expense per YEAR (pence, unrounded).
 * Week-based frequencies use exact day steps (weekly = 365.25/7 ≈ 52.18
 * occurrences a year); month-based use 12/stepMonths.
 */
export function annualisedBillPence(bill) {
  if (bill.active === false) return 0;
  const amount = bill.amountPence || 0;
  if (isWeekBased(bill.frequency)) {
    return amount * (DAYS_PER_YEAR / FREQUENCY_DAYS[bill.frequency]);
  }
  return amount * (12 / frequencyStepMonths(bill.frequency));
}

/**
 * Long-run cost of one debt per YEAR (pence): 12 × the monthly payment —
 * card minimum (computed at `refDateStr`, promo-aware, via the same
 * `creditCardMinPence` the plan timeline uses) or loan fixed payment.
 * Debts with nothing to pay contribute 0.
 */
export function annualisedDebtPence(debt, refDateStr) {
  if (debt.debtType === 'loan') {
    return (debt.fixedMonthlyPaymentPence || 0) * 12;
  }
  if ((debt.balancePence || 0) <= 0) return 0;
  return creditCardMinPence(debt, refDateStr) * 12;
}

/** Scale an annual figure down to one period (pence, rounded). */
export function annualToPeriodPence(annualPence, period) {
  if (period === 'year') return Math.round(annualPence);
  if (period === 'week') return Math.round(annualPence * (7 / DAYS_PER_YEAR));
  return Math.round(annualPence / 12); // month
}

/**
 * Normalised (long-run average) total per period across all expenses, debts,
 * and monthly childcare deposits.
 * @param {{recurringBills?: Array, debts?: Array, childcareDeposits?: Array}}
 *   data - PENCE domain.
 */
export function normalisedTotalPence(data, period, refDateStr) {
  const annual =
    (data.recurringBills || []).reduce((t, b) => t + annualisedBillPence(b), 0) +
    (data.debts || []).reduce((t, d) => t + annualisedDebtPence(d, refDateStr), 0) +
    (data.childcareDeposits || []).reduce((t, dep) => t + (dep.amountPence || 0) * 12, 0);
  return annualToPeriodPence(annual, period);
}

/**
 * Total committed outgoings per day in [startStr, endStr) — the payment
 * calendar's shading input (dashboard plan §Z3).
 * @returns {Map<string, number>} 'yyyy-MM-dd' → pence (days with nothing due
 *   are absent).
 */
export function dailyTotalsPence(data, startStr, endStr) {
  const totals = new Map();
  for (const r of spendingOccurrences(data, startStr, endStr)) {
    totals.set(r.date, (totals.get(r.date) || 0) + (r.amountPence || 0));
  }
  return totals;
}

/**
 * Committed outgoings per calendar month for `months` months starting with
 * the month containing `fromStr`, grouped the way the stacked columns chart
 * wants them: recurring expenses / debt payments / childcare (dashboard plan
 * §Z3 — lumpy annual/quarterly months stop being surprises).
 *
 * @returns {Array<{month: string, billsPence: number, debtPence: number,
 *   childcarePence: number, totalPence: number}>} `month` is 'yyyy-MM'.
 */
export function monthlySeriesPence(data, fromStr, months = 12) {
  const out = [];
  let y = Number(fromStr.slice(0, 4));
  let m = Number(fromStr.slice(5, 7));
  for (let i = 0; i < months; i += 1) {
    const startStr = `${y}-${p2(m)}-01`;
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    const endStr = `${ny}-${p2(nm)}-01`;
    let billsPence = 0;
    let debtPence = 0;
    let childcarePence = 0;
    for (const r of spendingOccurrences(data, startStr, endStr)) {
      if (r.kind === 'bill') billsPence += r.amountPence || 0;
      else if (r.kind === 'childcare') childcarePence += r.amountPence || 0;
      else debtPence += r.amountPence || 0; // 'debt-min' + 'loan'
    }
    out.push({
      month: startStr.slice(0, 7),
      billsPence,
      debtPence,
      childcarePence,
      totalPence: billsPence + debtPence + childcarePence,
    });
    y = ny;
    m = nm;
  }
  return out;
}

/**
 * The next occurrence of ONE recurring expense on or after `fromStr`
 * (working-day adjusted), or null when it has ended / is inactive.
 * Reuses the plan walker over a 24-month window so even an annual expense
 * whose stored `nextDueDate` is long past is found.
 *
 * @returns {{date: string, isAdjusted: boolean, amountPence: number}|null}
 */
export function nextBillOccurrence(bill, fromStr) {
  const [y, m] = [Number(fromStr.slice(0, 4)), fromStr.slice(5, 7)];
  const endStr = `${y + 2}-${m}-01`;
  const [first] = billOutgoings([bill], fromStr, endStr);
  return first ? { date: first.date, isAdjusted: first.isAdjusted, amountPence: first.amountPence } : null;
}

/**
 * The next payment for ONE debt on or after `fromStr`: monthly on its
 * `paymentDayOfMonth`, working-day adjusted, amount = card min / loan fixed.
 * Null when there is nothing to pay.
 *
 * @returns {{date: string, isAdjusted: boolean, amountPence: number}|null}
 */
export function nextDebtPayment(debt, fromStr) {
  const isLoan = debt.debtType === 'loan';
  const amountProbe = isLoan ? debt.fixedMonthlyPaymentPence || 0 : debt.balancePence || 0;
  if (amountProbe <= 0) return null;
  const occ = nextMonthlyOccurrenceOnOrAfter(
    Number(debt.paymentDayOfMonth) || 1,
    true,
    fromStr,
  );
  if (!occ) return null;
  const amountPence = isLoan
    ? debt.fixedMonthlyPaymentPence || 0
    : creditCardMinPence(debt, occ.date);
  if (amountPence <= 0) return null;
  return { date: occ.date, isAdjusted: occ.isAdjusted, amountPence };
}

/**
 * The next monthly childcare deposit on or after `fromStr` for one computed
 * deposit entry ({ label, amountPence, paymentDayOfMonth, adjustToWorkingDay }).
 * @returns {{date: string, isAdjusted: boolean, amountPence: number}|null}
 */
export function nextChildcareDeposit(dep, fromStr) {
  if ((dep.amountPence || 0) <= 0) return null;
  const occ = nextMonthlyOccurrenceOnOrAfter(
    Number(dep.paymentDayOfMonth) || 1,
    dep.adjustToWorkingDay !== false,
    fromStr,
  );
  if (!occ) return null;
  return { date: occ.date, isAdjusted: occ.isAdjusted, amountPence: dep.amountPence };
}

/**
 * The next `count` upcoming payments from `fromStr` (dashboard list).
 * Expands 14 months ahead so annual expenses appear, then trims.
 */
export function upcomingPayments(data, fromStr, count = 8) {
  const [y, m] = [Number(fromStr.slice(0, 4)), Number(fromStr.slice(5, 7))];
  const endY = m > 10 ? y + 2 : y + 1;
  const endM = ((m + 1) % 12) + 1; // 14 months ahead, clamped into 1..12
  const endStr = `${endY}-${p2(endM)}-01`;
  return spendingOccurrences(data, fromStr, endStr).slice(0, count);
}
