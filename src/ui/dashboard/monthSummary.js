import { toPence } from '../../engine/currency.js';

/**
 * Summarise a month's transactions for the dashboard "This month" panel.
 *
 * ── Money-unit boundary ────────────────────────────────────────────────────
 * `transactionsRepo` returns money in POUNDS (pounds-at-the-edge). We convert
 * each row to integer PENCE with `toPence` so the totals are exact, and return
 * pence throughout (render via `<Money pence=… />`).
 *
 * @param {Array<{ kind:'income'|'spend', amountPence:number, categoryId:number }>} transactions
 *   rows from `transactionsRepo.forMonth` (amountPence carries a pounds value).
 * @param {Array<{ id:number, name:string }>} categories
 * @returns {{
 *   incomePence:number, spendingPence:number, netPence:number,
 *   byCategory: Array<{ categoryId:number, name:string, amountPence:number, pct:number }>
 * }}
 */
export function summariseMonth(transactions, categories = []) {
  const nameOf = (id) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';

  let incomePence = 0;
  let spendingPence = 0;
  const spendByCat = new Map();

  for (const t of transactions || []) {
    const pence = toPence(t.amountPence); // pounds → pence
    if (t.kind === 'income') {
      incomePence += pence;
    } else {
      spendingPence += pence;
      spendByCat.set(t.categoryId, (spendByCat.get(t.categoryId) || 0) + pence);
    }
  }

  const byCategory = Array.from(spendByCat.entries())
    .map(([categoryId, amountPence]) => ({
      categoryId,
      name: nameOf(categoryId),
      amountPence,
      pct: spendingPence > 0 ? (amountPence / spendingPence) * 100 : 0,
    }))
    .sort((a, b) => b.amountPence - a.amountPence);

  return {
    incomePence,
    spendingPence,
    netPence: incomePence - spendingPence,
    byCategory,
  };
}

export default summariseMonth;
