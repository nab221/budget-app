/**
 * pay-period.js — Phase 34 Pay-Period Affordability Engine helpers.
 *
 * Pure helper module. No DB access. No side effects.
 *
 * Provides:
 *   getPayPeriodBounds(incomeEvents, referenceDate)
 *   getBillsInPayPeriod(allRecurring, allOneOff, spendingBuckets, start, end, bankingCalendar)
 *   calculatePayPeriodSummary(openingBalance, bills, safetyBuffer = 20000)
 *
 * All monetary values are integer pence throughout (matching Dexie storage).
 * Income events arrive pre-adjusted from Phase 33 helpers (getUpcomingIncomeEvents).
 */

import { adjustedPaymentDate } from './banking-calendar.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a value to a YYYY-MM-DD string.
 * Accepts Date objects and YYYY-MM-DD strings.
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
 * Convert a YYYY-MM-DD string or Date to a UTC midnight Date object.
 * @param {string|Date} d
 * @returns {Date}
 */
function _toDate(d) {
  if (d instanceof Date) return d;
  return new Date(`${d}T00:00:00Z`);
}

/**
 * Compute the number of days in a period (inclusive of both endpoints).
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
function _periodDays(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / 86400000) + 1;
}

/**
 * Count days in the calendar month containing `date`.
 * @param {Date} date
 * @returns {number}
 */
function _daysInMonth(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-indexed
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive pay-period bounds from a pre-sorted income event collection.
 *
 * Picks the earliest income event whose adjustedDate is on or after referenceDate.
 * The pay period runs from referenceDate (as start) to the chosen event's adjustedDate (as end).
 *
 * Returns null when the event collection is empty or no event falls on/after referenceDate.
 *
 * @param {Array<{ sourceId, sourceName, amount, nominalDate, adjustedDate }>|null} incomeEvents
 *   Pre-sorted by adjustedDate ascending (output of getUpcomingIncomeEvents).
 * @param {string} referenceDate - YYYY-MM-DD current opening-balance snapshot date
 * @returns {{ start: Date, end: Date, nextIncomeEvent: object } | null}
 */
export function getPayPeriodBounds(incomeEvents, referenceDate) {
  if (!incomeEvents || incomeEvents.length === 0) return null;

  const refStr = _toDateStr(referenceDate);

  // Find the earliest event whose adjustedDate >= referenceDate.
  // Input may come pre-sorted from getUpcomingIncomeEvents, but we defensively
  // pick the minimum to handle any ordering.
  let nextEvent = null;
  for (const ev of incomeEvents) {
    if (ev.adjustedDate >= refStr) {
      if (!nextEvent || ev.adjustedDate < nextEvent.adjustedDate) {
        nextEvent = ev;
      }
    }
  }
  if (!nextEvent) return null;

  return {
    start: _toDate(refStr),
    end: _toDate(nextEvent.adjustedDate),
    nextIncomeEvent: nextEvent
  };
}

/**
 * Extract and normalise all bills within an inclusive date window.
 *
 * Sources:
 * - allRecurring: recurrentExpenses rows — date field is nextDate (with fallback to date)
 * - allOneOff: oneOffExpenses rows — date field is date
 * - spendingBuckets: prorated bucket rows — one aggregate row per bucket, dated to the end of period
 *
 * Banking-calendar adjustment is applied when paymentAdjustment === 'next-working-day'.
 * Rows outside inclusive bounds after adjustment are excluded.
 *
 * @param {Array} allRecurring - recurrentExpenses records
 * @param {Array} allOneOff - oneOffExpenses records
 * @param {Array|null} spendingBuckets - spendingBuckets records
 * @param {Date} start - inclusive window start
 * @param {Date} end - inclusive window end
 * @param {*} _bankingCalendar - reserved for future override injection (not currently used)
 * @returns {Array<{
 *   date: Date,
 *   name: string,
 *   amount: number,
 *   isAdjusted: boolean,
 *   debtId?: number,
 *   debtBreakdown?: { interestAmount: number, principalAmount: number }
 * }>}
 */
export function getBillsInPayPeriod(allRecurring, allOneOff, spendingBuckets, start, end, _bankingCalendar) {
  const startStr = _toDateStr(start);
  const endStr = _toDateStr(end);
  const bills = [];

  // --- Recurring expenses ---
  for (const item of (allRecurring || [])) {
    const rawDateStr = item.nextDate || item.date;
    if (!rawDateStr) continue;

    const adjustment = item.paymentAdjustment || 'none';
    let effectiveDateObj;
    let isAdjusted = false;

    if (adjustment === 'next-working-day') {
      const adjusted = adjustedPaymentDate(rawDateStr, 'next-working-day');
      const adjustedStr = _toDateStr(adjusted);
      effectiveDateObj = _toDate(adjustedStr);
      isAdjusted = adjustedStr !== rawDateStr;
    } else {
      effectiveDateObj = _toDate(rawDateStr);
      isAdjusted = false;
    }

    const effectiveDateStr = _toDateStr(effectiveDateObj);
    if (effectiveDateStr < startStr || effectiveDateStr > endStr) continue;

    const bill = {
      date: effectiveDateObj,
      name: item.label || item.note || 'Expense',
      amount: item.amount || 0,
      isAdjusted
    };

    if (item.linkedDebtId != null) bill.debtId = item.linkedDebtId;
    if (item.isDebtPayment) bill.isDebtPayment = true;
    if (item.debtType) bill.debtType = item.debtType;

    bills.push(bill);
  }

  // --- One-off expenses ---
  for (const item of (allOneOff || [])) {
    const rawDateStr = item.date;
    if (!rawDateStr) continue;

    const effectiveDateStr = rawDateStr;
    if (effectiveDateStr < startStr || effectiveDateStr > endStr) continue;

    bills.push({
      date: _toDate(rawDateStr),
      name: item.note || item.label || 'One-off',
      amount: item.amount || 0,
      isAdjusted: false
    });
  }

  // --- Spending buckets (prorated) ---
  const periodDays = _periodDays(start, end);

  for (const bucket of (spendingBuckets || [])) {
    const monthlyAmount = bucket.monthlyAmount || 0;
    if (monthlyAmount <= 0) continue;

    // Prorate: (monthlyAmount / daysInMonth(start)) * periodDays
    const daysInMonth = _daysInMonth(start);
    const proratedAmount = Math.round((monthlyAmount / daysInMonth) * periodDays);

    bills.push({
      date: _toDate(endStr), // attribute prorated amount to end of period
      name: bucket.name || 'Spending Bucket',
      amount: proratedAmount,
      isAdjusted: false,
      isBucket: true
    });
  }

  // Sort all bills by date ascending, then by name for deterministic tie-breaking
  bills.sort((a, b) => {
    const da = _toDateStr(a.date);
    const db = _toDateStr(b.date);
    if (da < db) return -1;
    if (da > db) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  return bills;
}

/**
 * Calculate the pay-period affordability summary.
 *
 * Computes a running-balance row for each bill then returns:
 * - rows: bills enriched with runningBalance
 * - closingBalance: final running balance after all bills
 * - isDeficit: closingBalance <= 0 (zero balance means no buffer left → deficit)
 * - isBelowBuffer: closingBalance > 0 && closingBalance < safetyBuffer
 *
 * This function is pure — no DB calls. Pass bills=[] when bounds are null (no income).
 *
 * @param {number} openingBalance - integer pence
 * @param {Array<{ date: Date, name: string, amount: number, isAdjusted: boolean }>} bills
 * @param {number} [safetyBuffer=20000] - integer pence, default £200
 * @returns {{
 *   rows: Array<{ ...bill, runningBalance: number }>,
 *   closingBalance: number,
 *   isDeficit: boolean,
 *   isBelowBuffer: boolean
 * }}
 */
export function calculatePayPeriodSummary(openingBalance, bills, safetyBuffer = 20000) {
  let running = openingBalance;
  const rows = (bills || []).map(bill => {
    running = running - (bill.amount || 0);
    return { ...bill, runningBalance: running };
  });

  const closingBalance = running;
  const isDeficit = closingBalance <= 0;
  const isBelowBuffer = !isDeficit && closingBalance < safetyBuffer;

  return { rows, closingBalance, isDeficit, isBelowBuffer };
}
