/**
 * reports.js — pure builders behind the dashboard's Reports zone (plan §Z7).
 *
 * The schedule CSV is the "do your own analysis in Numbers" escape hatch:
 * every computed occurrence for the next N months, one row each. Computed at
 * read time from the same walkers as every total — nothing persisted.
 */

import { addMonths, format, parseISO } from 'date-fns';
import { spendingOccurrences } from './spending.js';
import { DEBT_GROUP_LABEL, CHILDCARE_GROUP_LABEL } from './breakdown.js';

const GROUP_BY_KIND = {
  bill: 'expense',
  'debt-min': 'debt',
  loan: 'debt',
  childcare: 'childcare',
};

/** RFC-4180 field escaping: quote when the value needs it, double quotes inside. */
export function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Every committed occurrence in [fromStr, fromStr + months months), flattened
 * for export.
 *
 * @param {{recurringBills?: Array, debts?: Array, childcareDeposits?: Array}} data - pence domain.
 * @param {Array<{id, name}>} categories - id → name for bill rows.
 * @param {string} fromStr - ISO yyyy-MM-dd start (inclusive).
 * @param {number} [months=12]
 * @returns {Array<{date, label, category, group, amountPence}>} sorted by date.
 */
export function scheduleRows(data, categories, fromStr, months = 12) {
  const endStr = format(addMonths(parseISO(fromStr), months), 'yyyy-MM-dd');
  const categoryByBillId = new Map();
  const nameById = new Map((categories || []).map((c) => [c.id, c.name]));
  for (const b of data.recurringBills || []) {
    categoryByBillId.set(b.id, nameById.get(b.categoryId) ?? 'Uncategorised');
  }

  return spendingOccurrences(data, fromStr, endStr).map((r) => ({
    date: r.date,
    label: r.label,
    category:
      r.kind === 'bill'
        ? categoryByBillId.get(r.sourceId) ?? 'Uncategorised'
        : r.kind === 'childcare'
          ? CHILDCARE_GROUP_LABEL
          : DEBT_GROUP_LABEL,
    group: GROUP_BY_KIND[r.kind] ?? r.kind,
    amountPence: r.amountPence || 0,
  }));
}

/**
 * The schedule as a CSV string (header + one line per occurrence). Amounts in
 * integer pence AND decimal pounds — pence is the honest at-rest unit, pounds
 * is what a spreadsheet user wants to sum.
 */
export function scheduleCsv(data, categories, fromStr, months = 12) {
  const header = 'date,label,category,group,amount_pence,amount_gbp';
  const lines = scheduleRows(data, categories, fromStr, months).map((r) =>
    [
      r.date,
      csvEscape(r.label),
      csvEscape(r.category),
      r.group,
      r.amountPence,
      (r.amountPence / 100).toFixed(2),
    ].join(',')
  );
  return [header, ...lines].join('\n');
}
