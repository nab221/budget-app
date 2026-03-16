/**
 * pay-period.test.js — Branch-focused tests for pay-period helper behaviour.
 *
 * Covers: window bounds, inclusion rules, deficit/buffer flags.
 *
 * All monetary values are integer pence to match Dexie storage conventions.
 */

import { describe, it, expect } from 'vitest';
import {
  getPayPeriodBounds,
  getBillsInPayPeriod,
  calculatePayPeriodSummary
} from './pay-period.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSource(id, name, amount = 200000, payDateRule = 'nth-of-month', payDateDay = 25) {
  return { id, name, monthlyAmount: amount, payDateRule, payDateDay, isActive: true };
}

function toDateStr(d) {
  if (typeof d === 'string') return d;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Test 1: getPayPeriodBounds — chooses the first income event on/after referenceDate
// ---------------------------------------------------------------------------

describe('getPayPeriodBounds', () => {
  it('returns bounds using earliest income event on or after referenceDate', () => {
    // referenceDate: 2026-03-10
    // Event on 2026-03-25 (adjusted)
    const incomeEvents = [
      { sourceId: 1, sourceName: 'Salary', amount: 200000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' }
    ];
    const result = getPayPeriodBounds(incomeEvents, '2026-03-10');

    expect(result).not.toBeNull();
    expect(result.nextIncomeEvent).not.toBeNull();
    expect(result.nextIncomeEvent.sourceId).toBe(1);
    expect(toDateStr(result.end)).toBe('2026-03-25');
    // start should be referenceDate (or null if no prior event, treated as referenceDate)
    expect(toDateStr(result.start)).toBe('2026-03-10');
  });

  it('uses adjustedDate not nominalDate when they differ', () => {
    const incomeEvents = [
      {
        sourceId: 2,
        sourceName: 'Freelance',
        amount: 50000,
        nominalDate: '2026-03-28',
        adjustedDate: '2026-03-30' // adjusted forward (e.g. bank holiday)
      }
    ];
    const result = getPayPeriodBounds(incomeEvents, '2026-03-10');
    expect(toDateStr(result.end)).toBe('2026-03-30');
  });

  it('selects the earliest event when multiple events exist', () => {
    const incomeEvents = [
      { sourceId: 1, sourceName: 'A', amount: 100000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' },
      { sourceId: 2, sourceName: 'B', amount: 80000, nominalDate: '2026-03-20', adjustedDate: '2026-03-20' },
      { sourceId: 3, sourceName: 'C', amount: 60000, nominalDate: '2026-03-31', adjustedDate: '2026-03-31' }
    ];
    const result = getPayPeriodBounds(incomeEvents, '2026-03-10');
    // Should pick 2026-03-20 as the earliest
    expect(toDateStr(result.end)).toBe('2026-03-20');
    expect(result.nextIncomeEvent.sourceId).toBe(2);
  });

  it('ignores events before referenceDate', () => {
    const incomeEvents = [
      { sourceId: 1, sourceName: 'Past', amount: 100000, nominalDate: '2026-03-05', adjustedDate: '2026-03-05' },
      { sourceId: 2, sourceName: 'Future', amount: 100000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' }
    ];
    const result = getPayPeriodBounds(incomeEvents, '2026-03-10');
    expect(toDateStr(result.end)).toBe('2026-03-25');
    expect(result.nextIncomeEvent.sourceId).toBe(2);
  });

  it('includes an event exactly on referenceDate (inclusive start boundary)', () => {
    const incomeEvents = [
      { sourceId: 1, sourceName: 'Today', amount: 200000, nominalDate: '2026-03-10', adjustedDate: '2026-03-10' }
    ];
    const result = getPayPeriodBounds(incomeEvents, '2026-03-10');
    // Event on referenceDate itself should still define the boundary
    expect(result).not.toBeNull();
    expect(result.nextIncomeEvent).not.toBeNull();
    expect(toDateStr(result.end)).toBe('2026-03-10');
  });

  // ---------------------------------------------------------------------------
  // Test 2: no income events → null/empty boundary
  // ---------------------------------------------------------------------------

  it('returns null when incomeEvents is empty', () => {
    const result = getPayPeriodBounds([], '2026-03-10');
    expect(result).toBeNull();
  });

  it('returns null when incomeEvents is null', () => {
    const result = getPayPeriodBounds(null, '2026-03-10');
    expect(result).toBeNull();
  });

  it('returns null when all events are before referenceDate', () => {
    const incomeEvents = [
      { sourceId: 1, sourceName: 'Past', amount: 100000, nominalDate: '2026-03-05', adjustedDate: '2026-03-05' }
    ];
    const result = getPayPeriodBounds(incomeEvents, '2026-03-10');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 3 & 4: getBillsInPayPeriod — inclusion and sort rules
// ---------------------------------------------------------------------------

describe('getBillsInPayPeriod', () => {
  const start = new Date('2026-03-10T00:00:00Z');
  const end = new Date('2026-03-25T00:00:00Z');

  // Test 3: recurrentExpenses by nextDate/date, oneOffExpenses by date, spendingBuckets prorated

  it('includes recurrentExpenses whose nextDate falls within inclusive bounds', () => {
    const recurring = [
      { id: 1, label: 'Mortgage', amount: 105000, nextDate: '2026-03-18', paymentAdjustment: 'none' },
      { id: 2, label: 'Outside', amount: 5000, nextDate: '2026-03-26' }  // after end
    ];
    const result = getBillsInPayPeriod(recurring, [], [], start, end, null);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Mortgage');
    expect(result[0].amount).toBe(105000);
  });

  it('includes recurrentExpenses using date field when nextDate is absent', () => {
    const recurring = [
      { id: 1, label: 'Council Tax', amount: 18000, date: '2026-03-15', paymentAdjustment: 'none' }
    ];
    const result = getBillsInPayPeriod(recurring, [], [], start, end, null);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Council Tax');
  });

  it('includes oneOffExpenses by date within inclusive bounds', () => {
    const oneOff = [
      { id: 10, note: 'Car service', amount: 20000, date: '2026-03-20' },
      { id: 11, note: 'Future event', amount: 1000, date: '2026-03-30' }
    ];
    const result = getBillsInPayPeriod([], oneOff, [], start, end, null);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Car service');
    expect(result[0].amount).toBe(20000);
  });

  it('prorate spending buckets across the period and includes each as a bill', () => {
    // Period is 15 days (10 Mar inclusive to 25 Mar inclusive = 16 days)
    const buckets = [
      { id: 100, name: 'Groceries', monthlyAmount: 30000 }  // £300/month
    ];
    const result = getBillsInPayPeriod([], [], buckets, start, end, null);
    expect(result.length).toBeGreaterThan(0);
    // Prorated amount should be proportional — not zero and not full monthly
    const bucketRow = result.find(r => r.name === 'Groceries');
    expect(bucketRow).toBeDefined();
    expect(bucketRow.amount).toBeGreaterThan(0);
    expect(bucketRow.amount).toBeLessThan(30000);
  });

  it('includes bills exactly on start date (inclusive lower bound)', () => {
    const recurring = [
      { id: 1, label: 'Start Bill', amount: 5000, nextDate: '2026-03-10', paymentAdjustment: 'none' }
    ];
    const result = getBillsInPayPeriod(recurring, [], [], start, end, null);
    expect(result).toHaveLength(1);
  });

  it('includes bills exactly on end date (inclusive upper bound)', () => {
    const recurring = [
      { id: 1, label: 'End Bill', amount: 5000, nextDate: '2026-03-25', paymentAdjustment: 'none' }
    ];
    const result = getBillsInPayPeriod(recurring, [], [], start, end, null);
    expect(result).toHaveLength(1);
  });

  // Test 4: adjusted rows and sort order

  it('marks rows as isAdjusted=true when next-working-day adjustment changes the date', () => {
    // 2026-03-14 is a Saturday — adjustment should move to 2026-03-16 (Mon)
    const recurring = [
      { id: 1, label: 'Weekend Bill', amount: 8000, nextDate: '2026-03-14', paymentAdjustment: 'next-working-day' }
    ];
    const result = getBillsInPayPeriod(recurring, [], [], start, end, null);
    expect(result).toHaveLength(1);
    const row = result[0];
    // Date is adjusted to a working day
    expect(row.isAdjusted).toBe(true);
  });

  it('marks rows as isAdjusted=false when date requires no adjustment', () => {
    const recurring = [
      { id: 1, label: 'Normal Bill', amount: 8000, nextDate: '2026-03-16', paymentAdjustment: 'none' }
    ];
    const result = getBillsInPayPeriod(recurring, [], [], start, end, null);
    expect(result).toHaveLength(1);
    expect(result[0].isAdjusted).toBe(false);
  });

  it('sorts all rows by date ascending', () => {
    const recurring = [
      { id: 1, label: 'Late Bill', amount: 5000, nextDate: '2026-03-24', paymentAdjustment: 'none' },
      { id: 2, label: 'Early Bill', amount: 3000, nextDate: '2026-03-12', paymentAdjustment: 'none' }
    ];
    const oneOff = [
      { id: 10, note: 'Mid Bill', amount: 1000, date: '2026-03-18' }
    ];
    const result = getBillsInPayPeriod(recurring, oneOff, [], start, end, null);
    expect(result.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < result.length; i++) {
      expect(toDateStr(result[i].date) >= toDateStr(result[i - 1].date)).toBe(true);
    }
  });

  it('excludes recurring bills with no date field', () => {
    const recurring = [
      { id: 1, label: 'No Date', amount: 5000 }  // no nextDate or date
    ];
    const result = getBillsInPayPeriod(recurring, [], [], start, end, null);
    expect(result).toHaveLength(0);
  });

  it('passes through debtId for loan/mortgage rows', () => {
    const recurring = [
      {
        id: 1,
        label: 'Mortgage Payment',
        amount: 120000,
        nextDate: '2026-03-18',
        paymentAdjustment: 'none',
        isDebtPayment: true,
        linkedDebtId: 42
      }
    ];
    const result = getBillsInPayPeriod(recurring, [], [], start, end, null);
    expect(result).toHaveLength(1);
    expect(result[0].debtId).toBe(42);
  });

  it('handles null/undefined buckets gracefully', () => {
    expect(() => getBillsInPayPeriod([], [], null, start, end, null)).not.toThrow();
    expect(() => getBillsInPayPeriod([], [], undefined, start, end, null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test 5 & 6: calculatePayPeriodSummary — running balance, flags
// ---------------------------------------------------------------------------

describe('calculatePayPeriodSummary', () => {
  // Test 5: returns running-balance rows, closingBalance, isDeficit, isBelowBuffer

  it('returns rows with runningBalance, correct closingBalance, and false flags for surplus', () => {
    const openingBalance = 100000; // £1000
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'Mortgage', amount: 50000, isAdjusted: false },
      { date: new Date('2026-03-20T00:00:00Z'), name: 'Council Tax', amount: 10000, isAdjusted: false }
    ];
    const result = calculatePayPeriodSummary(openingBalance, bills, 20000); // safetyBuffer £200

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].runningBalance).toBe(50000); // 100000 - 50000
    expect(result.rows[1].runningBalance).toBe(40000); // 50000 - 10000
    expect(result.closingBalance).toBe(40000);
    expect(result.isDeficit).toBe(false);
    expect(result.isBelowBuffer).toBe(false);
  });

  it('returns correct closingBalance for empty bill list', () => {
    const result = calculatePayPeriodSummary(50000, [], 20000);
    expect(result.closingBalance).toBe(50000);
    expect(result.rows).toHaveLength(0);
    expect(result.isDeficit).toBe(false);
    expect(result.isBelowBuffer).toBe(false);
  });

  it('preserves all bill fields in output rows', () => {
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'Bill A', amount: 5000, isAdjusted: true, debtId: 7 }
    ];
    const result = calculatePayPeriodSummary(50000, bills, 20000);
    expect(result.rows[0].name).toBe('Bill A');
    expect(result.rows[0].isAdjusted).toBe(true);
    expect(result.rows[0].debtId).toBe(7);
  });

  it('sets isDeficit=true when closingBalance is negative', () => {
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'Big Bill', amount: 150000, isAdjusted: false }
    ];
    const result = calculatePayPeriodSummary(100000, bills, 20000);
    expect(result.closingBalance).toBe(-50000);
    expect(result.isDeficit).toBe(true);
    expect(result.isBelowBuffer).toBe(false); // deficit takes precedence; isBelowBuffer is for non-deficit case
  });

  it('sets isDeficit=true when closingBalance is exactly zero', () => {
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'Exact Bill', amount: 100000, isAdjusted: false }
    ];
    const result = calculatePayPeriodSummary(100000, bills, 20000);
    expect(result.closingBalance).toBe(0);
    expect(result.isDeficit).toBe(true);
  });

  // Test 6: isBelowBuffer when closingBalance is between 0 and safetyBuffer

  it('sets isBelowBuffer=true when closingBalance >= 0 and < safetyBuffer', () => {
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'Bill', amount: 95000, isAdjusted: false }
    ];
    // openingBalance=100000, bills=95000 → closingBalance=5000 (£50), safetyBuffer=20000 (£200)
    const result = calculatePayPeriodSummary(100000, bills, 20000);
    expect(result.closingBalance).toBe(5000);
    expect(result.isBelowBuffer).toBe(true);
    expect(result.isDeficit).toBe(false);
  });

  it('sets isBelowBuffer=false when closingBalance equals safetyBuffer exactly', () => {
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'Bill', amount: 80000, isAdjusted: false }
    ];
    // opening=100000, bills=80000 → closing=20000 = safetyBuffer=20000
    const result = calculatePayPeriodSummary(100000, bills, 20000);
    expect(result.closingBalance).toBe(20000);
    expect(result.isBelowBuffer).toBe(false);
  });

  it('sets isBelowBuffer=false when closingBalance exceeds safetyBuffer', () => {
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'Bill', amount: 50000, isAdjusted: false }
    ];
    // closing = 50000 > safetyBuffer 20000
    const result = calculatePayPeriodSummary(100000, bills, 20000);
    expect(result.isBelowBuffer).toBe(false);
  });

  it('uses default safetyBuffer of 20000 when not provided', () => {
    // openingBalance=100000, bill=95000 → closing=5000 < 20000 default
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'Bill', amount: 95000, isAdjusted: false }
    ];
    const result = calculatePayPeriodSummary(100000, bills);
    expect(result.isBelowBuffer).toBe(true);
  });

  it('is deterministic — same inputs always produce same output', () => {
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'A', amount: 10000, isAdjusted: false },
      { date: new Date('2026-03-20T00:00:00Z'), name: 'B', amount: 5000, isAdjusted: false }
    ];
    const r1 = calculatePayPeriodSummary(80000, bills, 20000);
    const r2 = calculatePayPeriodSummary(80000, bills, 20000);
    expect(r1.closingBalance).toBe(r2.closingBalance);
    expect(r1.isDeficit).toBe(r2.isDeficit);
    expect(r1.isBelowBuffer).toBe(r2.isBelowBuffer);
  });

  it('handles a single bill at zero amount gracefully', () => {
    const bills = [
      { date: new Date('2026-03-15T00:00:00Z'), name: 'Zero Bill', amount: 0, isAdjusted: false }
    ];
    const result = calculatePayPeriodSummary(50000, bills, 20000);
    expect(result.closingBalance).toBe(50000);
    expect(result.isDeficit).toBe(false);
  });
});
