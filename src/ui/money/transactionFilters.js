import { toPence } from '../../engine/currency.js';

/**
 * Pure helpers for the transactions ledger (spec §4.2 "Actual"). Kept separate
 * from the React component so the search / category-filter / totals logic is
 * unit-testable without a DOM.
 *
 * ── Money-unit boundary ────────────────────────────────────────────────────
 * `transactionsRepo` rows carry money in POUNDS (`amountPence` field, pounds at
 * the edge). `computeTotals` converts each row to integer PENCE with `toPence`
 * so sums are exact, and returns pence (render via `<Money pence=… />`).
 */

/**
 * Filter transactions by a case-insensitive description substring and an
 * optional category. `categoryId` of `'all'` (or null/undefined) matches every
 * category; otherwise it is compared loosely (string vs number safe).
 *
 * @param {Array} txns
 * @param {{ search?: string, categoryId?: string|number }} [criteria]
 * @returns {Array}
 */
export function filterTransactions(txns, criteria = {}) {
  const { search = '', categoryId = 'all' } = criteria;
  const q = String(search).trim().toLowerCase();
  const wantAll = categoryId === 'all' || categoryId == null || categoryId === '';

  return (txns || []).filter((t) => {
    if (!wantAll && String(t.categoryId) !== String(categoryId)) return false;
    if (q && !String(t.description || '').toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * Income / spend / net totals (integer pence) for a set of ledger rows.
 *
 * @param {Array<{ kind:'income'|'spend', amountPence:number }>} txns - pounds at edge.
 * @returns {{ incomePence:number, spendPence:number, netPence:number, count:number }}
 */
export function computeTotals(txns) {
  let incomePence = 0;
  let spendPence = 0;
  for (const t of txns || []) {
    const pence = toPence(t.amountPence); // pounds → pence
    if (t.kind === 'income') incomePence += pence;
    else spendPence += pence;
  }
  return {
    incomePence,
    spendPence,
    netPence: incomePence - spendPence,
    count: (txns || []).length,
  };
}

/** Sort ledger rows newest-first, tie-broken by id descending (stable-ish). */
export function sortTransactions(txns) {
  return [...(txns || [])].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.id || 0) - (a.id || 0);
  });
}
