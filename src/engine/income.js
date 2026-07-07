/**
 * income.js — Phase 33 income projection helpers.
 *
 * Pure helper module. No DB access. No side effects.
 *
 * Depends on Phase 31 banking-calendar.js for payday adjustment logic.
 * Never hand-rolls its own bank-holiday or weekend logic.
 *
 * Phase 34 handoff contract:
 *   getNextIncomeEvent(source, fromDate)
 *   -> { sourceId, sourceName, amount, nominalDate, adjustedDate } | null
 *
 *   getUpcomingIncomeEvents(sources, fromDate, limit)
 *   -> Array<{ sourceId, sourceName, amount, nominalDate, adjustedDate }>
 *      sorted by adjustedDate ascending across all active sources
 */

import { adjustedPaymentDate, nextWorkingDay } from './banking-calendar.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Date object or YYYY-MM-DD string to a YYYY-MM-DD string using UTC.
 * @param {Date|string} d
 * @returns {string} YYYY-MM-DD
 */
function _toDateStr(d) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const date = typeof d === 'string' ? new Date(`${d}T00:00:00Z`) : d;
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Return the last day of the month for a given YYYY and MM (1-indexed).
 * Uses UTC Date arithmetic.
 * @param {number} year
 * @param {number} month - 1-indexed (January = 1)
 * @returns {number} day number (28–31)
 */
function _lastDayOfMonth(year, month) {
  // Day 0 of next month = last day of this month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Derive the nominal payday date string for a given source and reference month.
 * Does NOT apply banking-calendar adjustment — callers do that separately.
 *
 * @param {{ payDateRule: string, payDateDay: number|null }} source
 * @param {number} year
 * @param {number} month - 1-indexed
 * @returns {string} YYYY-MM-DD nominal date
 */
function _nominalDateForMonth(source, year, month) {
  const { payDateRule, payDateDay } = source;

  if (payDateRule === 'nth-of-month') {
    const day = String(payDateDay).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `${year}-${mm}-${day}`;
  }

  if (payDateRule === 'last-day' || payDateRule === 'last-working-day') {
    const last = _lastDayOfMonth(year, month);
    const day = String(last).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `${year}-${mm}-${day}`;
  }

  throw new Error(`Unknown payDateRule: "${payDateRule}"`);
}

/**
 * Determine the adjustment strategy for a given source.
 * All rules apply next-working-day adjustment so that adjustedDate is never
 * on a weekend or UK bank holiday.
 *
 * For last-working-day, the nominalDate is already the last calendar day of
 * the month, and banking-calendar adjustment moves it to the prior working day
 * (the actual last working day).
 *
 * @param {{ payDateRule: string }} _source - unused but kept for future extension
 * @returns {'next-working-day'}
 */
function _adjustmentFor(_source) {
  return 'next-working-day';
}

// ---------------------------------------------------------------------------
// Public API — Phase 34 handoff contract
// ---------------------------------------------------------------------------

/**
 * Returns the next projected income event for a single source on or after fromDate.
 * "Next" means the first nominal payday strictly after fromDate.
 *
 * Returns null if the source is inactive.
 *
 * @param {{ id: number, name: string, monthlyAmount: number, payDateRule: string,
 *           payDateDay: number|null, isActive: boolean }} source
 * @param {string} fromDate - YYYY-MM-DD (exclusive lower bound)
 * @returns {{ sourceId: number, sourceName: string, amount: number,
 *             nominalDate: string, adjustedDate: string } | null}
 */
export function getNextIncomeEvent(source, fromDate) {
  if (!source.isActive) return null;

  const from = _toDateStr(fromDate);
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);

  // Try current month first, then advance
  let year = fromYear;
  let month = fromMonth;

  // Safety guard: at most 25 months ahead (well beyond any edge case)
  const MAX_ITERATIONS = 25;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const nominal = _nominalDateForMonth(source, year, month);

    // Only take a date strictly after fromDate
    if (nominal > from) {
      const adjustment = _adjustmentFor(source);
      const adjustedDateObj = adjustedPaymentDate(nominal, adjustment);
      const adjustedStr = _toDateStr(adjustedDateObj);

      return {
        sourceId: source.id,
        sourceName: source.name,
        amount: source.monthlyAmount,
        nominalDate: nominal,
        adjustedDate: adjustedStr
      };
    }

    // Advance to next month
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  // Should never reach here under normal usage
  return null;
}

/**
 * Returns up to `limit` upcoming income events across all active sources,
 * sorted by adjustedDate ascending.
 *
 * Inactive sources are excluded. An empty active-source collection returns [].
 *
 * This is the Phase 34 handoff function. It returns a collection of events
 * across all active sources — never a singular payDay value.
 *
 * @param {Array<Object>} sources - Array of income source records
 * @param {string} fromDate - YYYY-MM-DD (exclusive lower bound)
 * @param {number} [limit=10] - Maximum number of events to return
 * @returns {Array<{ sourceId: number, sourceName: string, amount: number,
 *                   nominalDate: string, adjustedDate: string }>}
 */
export function getUpcomingIncomeEvents(sources, fromDate, limit = 10) {
  const activeSources = (sources || []).filter(s => s.isActive);

  if (activeSources.length === 0 || limit <= 0) return [];

  const events = [];
  let cursor = fromDate;

  // We collect events in a merge-sort style: repeatedly pick the next soonest
  // event across all active sources. Advance the per-source state as we go.
  //
  // Strategy: maintain a "next event" per source, pull the minimum, advance
  // that source's cursor, and repeat until we have `limit` events.

  // Initialise per-source cursors
  const cursors = activeSources.map(s => ({
    source: s,
    cursor: fromDate,
    next: getNextIncomeEvent(s, fromDate)
  }));

  for (let i = 0; i < limit; i++) {
    // Find the source with the smallest adjustedDate
    let minIdx = -1;
    let minDate = null;

    for (let j = 0; j < cursors.length; j++) {
      const ev = cursors[j].next;
      if (!ev) continue;
      if (minDate === null || ev.adjustedDate < minDate) {
        minDate = ev.adjustedDate;
        minIdx = j;
      }
    }

    if (minIdx === -1) break; // No more events available

    const chosen = cursors[minIdx];
    events.push(chosen.next);

    // Advance this source's cursor past the event we just picked (use nominalDate as new lower bound)
    chosen.cursor = chosen.next.nominalDate;
    chosen.next = getNextIncomeEvent(chosen.source, chosen.cursor);
  }

  return events;
}
