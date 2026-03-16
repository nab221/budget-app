/**
 * affordability.js
 *
 * Phase 35 (CHILD-02): Childcare top-up integration contract for the
 * pay-period affordability pipeline.
 *
 * This module provides a thin, explicit integration seam between the
 * childcare domain (top-up outputs) and the affordability domain
 * (committed-outgoing line items).
 *
 * Scope: narrowly restricted to CHILD-02 contract functions.
 * No CSV, reporting, import/export, or navigation redesign features.
 */

/**
 * Normalizes childcare top-up contract rows into committed-outgoing line items
 * suitable for the pay-period affordability pipeline.
 *
 * Filters out accounts where no top-up is required (requiredTopUpPence === 0).
 *
 * @param {Array<{ accountId: number, childName: string, requiredTopUpPence: number, description: string }>} topUps
 * @returns {Array<{ date: string, description: string, amount: number }>}
 */
export function normalizeChildcareTopUps(topUps) {
  if (!topUps || topUps.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  return topUps
    .filter(t => t.requiredTopUpPence > 0)
    .map(t => ({
      date: today,
      description: t.description || `Childcare top-up: ${t.childName}`,
      amount: t.requiredTopUpPence
    }));
}

/**
 * Merges normalised childcare top-up items into the base committed-outgoing
 * rows used by the affordability pipeline.
 *
 * Does NOT mutate baseRows. Returns a new array with childcare items appended.
 * Each childcare item is mapped to a row shape compatible with the timeline table:
 * { date, name, amount, runningBalance: 0 }
 *
 * @param {Array<Object>} baseRows - Existing committed-outgoing rows from getBillsInPayPeriod.
 * @param {Array<{ date: string, description: string, amount: number }>|null|undefined} childcareItems
 * @returns {Array<Object>} merged rows (new array, baseRows not mutated)
 */
export function includeChildcareTopUpsInCommittedOutgoings(baseRows, childcareItems) {
  if (!childcareItems || childcareItems.length === 0) return [...baseRows];
  const mapped = childcareItems.map(item => ({
    date: item.date,
    name: item.description,
    amount: item.amount,
    runningBalance: 0,
    isChildcareTopUp: true
  }));
  return [...baseRows, ...mapped];
}
