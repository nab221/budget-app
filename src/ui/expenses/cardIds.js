/**
 * Stable DOM id for one card on the Expenses tab, so the Table and By-date
 * views can jump back to it (design 2026-09-12 §2). Any character that is not
 * safe in an id is replaced, so a childcare label with spaces or dashes works.
 *
 * @param {'debt'|'bill'|'childcare'} kind
 * @param {string|number} key - debt id, bill id, or the childcare deposit label
 */
export function cardDomId(kind, key) {
  return `expense-card-${kind}-${String(key).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
