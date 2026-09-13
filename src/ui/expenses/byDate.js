/**
 * The Expenses tab's By-date view (design 2026-09-12 §4): every occurrence in
 * the selected period from the SAME engine walk that produces the "Going out"
 * total, grouped by day, with running totals and a split at today. Pure, PENCE.
 */
import { spendingOccurrences } from '../../engine/spending.js';
import { cardDomId } from './cardIds.js';

const KIND_LABEL = { 'debt-min': 'Card', loan: 'Loan', childcare: 'Childcare', bill: 'Bill' };

/** 'Card' / 'Loan' / 'Childcare' / 'Bill · <category>' for the kind column. */
export function describeKind(occ, categoryByBillId) {
  if (occ.kind === 'bill') {
    const category = categoryByBillId ? categoryByBillId.get(occ.sourceId) : null;
    return category ? `Bill · ${category}` : 'Bill';
  }
  return KIND_LABEL[occ.kind] ?? occ.kind;
}

/** The DOM id of the card this occurrence belongs to. */
export function occurrenceDomId(occ) {
  if (occ.kind === 'bill') return cardDomId('bill', occ.sourceId);
  if (occ.kind === 'childcare') return cardDomId('childcare', occ.label);
  return cardDomId('debt', occ.debtId);
}

/**
 * Days → months, in order. A month is "past" only when every day in it is.
 * @param {Array<{date: string, isPast: boolean, rows: Array, totalPence: number}>} days
 * @returns {Array<{month: string, days: Array, totalPence: number, isPast: boolean}>}
 */
export function rollUpMonths(days) {
  const months = [];
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.month === key) {
      last.days.push(day);
      last.totalPence += day.totalPence;
      last.isPast = last.isPast && day.isPast;
    } else {
      months.push({ month: key, days: [day], totalPence: day.totalPence, isPast: day.isPast });
    }
  }
  return months;
}

/**
 * @param {{recurringBills?: Array, debts?: Array, childcareDeposits?: Array}} data - PENCE domain
 * @param {string} startStr - period start (inclusive), 'yyyy-MM-dd'
 * @param {string} endStr - period end (exclusive)
 * @param {string} todayStr - local calendar day; occurrences ON today are still to go
 */
export function buildByDate(data, startStr, endStr, todayStr) {
  const days = [];
  let running = 0;
  let goneOutPence = 0;
  let stillToGoPence = 0;

  // `spendingOccurrences` is date-sorted, so same-date rows arrive together.
  for (const occ of spendingOccurrences(data, startStr, endStr)) {
    const amount = occ.amountPence || 0;
    running += amount;
    const isPast = occ.date < todayStr;
    if (isPast) goneOutPence += amount;
    else stillToGoPence += amount;

    const row = { ...occ, runningPence: running, domId: occurrenceDomId(occ) };
    const last = days[days.length - 1];
    if (last && last.date === occ.date) {
      last.rows.push(row);
      last.totalPence += amount;
    } else {
      days.push({ date: occ.date, isPast, rows: [row], totalPence: amount });
    }
  }

  return { days, months: rollUpMonths(days), goneOutPence, stillToGoPence, totalPence: running };
}
