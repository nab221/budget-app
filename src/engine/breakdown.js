/**
 * breakdown.js — pure "where does it go" aggregations (dashboard plan §Z4).
 *
 * Everything is PENCE domain, computed at read time from the schedule via the
 * same annualisation helpers the Expenses screen uses, so the dashboard's
 * category bars and cost table can never disagree with the period totals.
 */

import {
  annualisedBillPence,
  annualisedDebtPence,
  annualToPeriodPence,
} from './spending.js';

// Past this many categories the tail folds into "Other" (dataviz series cap).
export const MAX_BREAKDOWN_ROWS = 8;

export const DEBT_GROUP_LABEL = 'Debt payments';
export const CHILDCARE_GROUP_LABEL = 'Childcare';

/**
 * Normalised spend per category, sorted largest first, tail folded into
 * "Other". Bills group by their category name; debt payments and childcare
 * deposits are their own groups.
 *
 * @param {{recurringBills?: Array, debts?: Array, childcareDeposits?: Array}} data - pence domain.
 * @param {Array<{id, name}>} categories - repo categories (id → name lookup).
 * @param {string} refStr - ISO yyyy-MM-dd for promo-aware card minimums.
 * @returns {{ rows: Array<{name, annualPence, monthlyPence, shareOfTotal}>,
 *   totalAnnualPence: number }} shareOfTotal is 0..1.
 */
export function categoryBreakdown(data, categories, refStr) {
  const nameById = new Map((categories || []).map((c) => [c.id, c.name]));
  const annualByName = new Map();
  const add = (name, annual) => {
    if (annual <= 0) return;
    annualByName.set(name, (annualByName.get(name) || 0) + annual);
  };

  for (const b of data.recurringBills || []) {
    add(nameById.get(b.categoryId) ?? 'Uncategorised', annualisedBillPence(b));
  }
  for (const d of data.debts || []) {
    add(DEBT_GROUP_LABEL, annualisedDebtPence(d, refStr));
  }
  for (const dep of data.childcareDeposits || []) {
    add(CHILDCARE_GROUP_LABEL, (dep.amountPence || 0) * 12);
  }

  let rows = [...annualByName.entries()]
    .map(([name, annual]) => ({ name, annualPence: Math.round(annual) }))
    .sort((a, b) => b.annualPence - a.annualPence);

  if (rows.length > MAX_BREAKDOWN_ROWS) {
    const kept = rows.slice(0, MAX_BREAKDOWN_ROWS - 1);
    const folded = rows.slice(MAX_BREAKDOWN_ROWS - 1);
    kept.push({
      name: 'Other',
      annualPence: folded.reduce((t, r) => t + r.annualPence, 0),
    });
    rows = kept;
  }

  const totalAnnualPence = rows.reduce((t, r) => t + r.annualPence, 0);
  return {
    totalAnnualPence,
    rows: rows.map((r) => ({
      ...r,
      monthlyPence: annualToPeriodPence(r.annualPence, 'month'),
      shareOfTotal: totalAnnualPence > 0 ? r.annualPence / totalAnnualPence : 0,
    })),
  };
}

/**
 * The "cost of everything" table: one row per committed outgoing with its
 * per-occurrence amount and normalised monthly/annual cost. Inactive bills and
 * debts with nothing to pay are excluded. Sorted by annual cost descending
 * (the UI may re-sort).
 *
 * @param {{recurringBills?: Array, debts?: Array, childcareDeposits?: Array}} data - pence domain.
 * @param {Array<{id, name}>} categories
 * @param {string} refStr - ISO yyyy-MM-dd for promo-aware card minimums.
 * @returns {Array<{key, label, category, frequency, perOccurrencePence,
 *   monthlyPence, annualPence}>}
 */
export function costRows(data, categories, refStr) {
  const nameById = new Map((categories || []).map((c) => [c.id, c.name]));
  const rows = [];

  for (const b of data.recurringBills || []) {
    if (b.active === false) continue;
    const annual = Math.round(annualisedBillPence(b));
    if (annual <= 0) continue;
    rows.push({
      key: `bill-${b.id}`,
      label: b.label || 'Bill',
      category: nameById.get(b.categoryId) ?? 'Uncategorised',
      frequency: b.frequency,
      perOccurrencePence: b.amountPence || 0,
      monthlyPence: annualToPeriodPence(annual, 'month'),
      annualPence: annual,
    });
  }

  for (const d of data.debts || []) {
    const annual = Math.round(annualisedDebtPence(d, refStr));
    if (annual <= 0) continue;
    rows.push({
      key: `debt-${d.id}`,
      label:
        d.debtType === 'loan' ? `${d.name} (loan)` : `${d.name} (min payment)`,
      category: DEBT_GROUP_LABEL,
      frequency: 'monthly',
      perOccurrencePence: Math.round(annual / 12),
      monthlyPence: annualToPeriodPence(annual, 'month'),
      annualPence: annual,
    });
  }

  for (const dep of data.childcareDeposits || []) {
    const monthly = dep.amountPence || 0;
    if (monthly <= 0) continue;
    rows.push({
      key: `childcare-${dep.label}`,
      label: dep.label,
      category: CHILDCARE_GROUP_LABEL,
      frequency: 'monthly',
      perOccurrencePence: monthly,
      monthlyPence: monthly,
      annualPence: monthly * 12,
    });
  }

  rows.sort((a, b) => b.annualPence - a.annualPence);
  return rows;
}
