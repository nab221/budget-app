import { describe, it, expect } from 'vitest';
import { summariseMonth } from './monthSummary.js';
import { isBalanceStale, balanceAgeDays } from './balanceStatus.js';

describe('summariseMonth', () => {
  const categories = [
    { id: 1, name: 'Groceries' },
    { id: 2, name: 'Salary', kind: 'income' },
    { id: 3, name: 'Transport' },
  ];

  it('totals income, spending and net (pounds → pence)', () => {
    const txns = [
      { kind: 'income', amountPence: 2000, categoryId: 2 }, // £2000
      { kind: 'spend', amountPence: 300.5, categoryId: 1 }, // £300.50
      { kind: 'spend', amountPence: 99.5, categoryId: 3 }, // £99.50
    ];
    const s = summariseMonth(txns, categories);
    expect(s.incomePence).toBe(200000);
    expect(s.spendingPence).toBe(40000);
    expect(s.netPence).toBe(160000);
  });

  it('groups spending by category, sorted desc, with percentages', () => {
    const txns = [
      { kind: 'spend', amountPence: 300, categoryId: 1 },
      { kind: 'spend', amountPence: 100, categoryId: 3 },
      { kind: 'spend', amountPence: 100, categoryId: 1 },
    ];
    const s = summariseMonth(txns, categories);
    expect(s.byCategory[0].name).toBe('Groceries');
    expect(s.byCategory[0].amountPence).toBe(40000);
    expect(Math.round(s.byCategory[0].pct)).toBe(80);
    expect(s.byCategory[1].name).toBe('Transport');
    expect(Math.round(s.byCategory[1].pct)).toBe(20);
  });

  it('handles an empty month', () => {
    const s = summariseMonth([], categories);
    expect(s.incomePence).toBe(0);
    expect(s.spendingPence).toBe(0);
    expect(s.byCategory).toHaveLength(0);
  });
});

describe('balance staleness', () => {
  const now = new Date('2026-07-07T12:00:00Z');

  it('is not stale within 7 days', () => {
    expect(isBalanceStale('2026-07-03', now)).toBe(false);
    expect(balanceAgeDays('2026-07-03', now)).toBe(4);
  });

  it('is stale beyond 7 days', () => {
    expect(isBalanceStale('2026-06-25', now)).toBe(true);
    expect(balanceAgeDays('2026-06-25', now)).toBe(12);
  });

  it('returns null age for a missing balance date', () => {
    expect(balanceAgeDays(null, now)).toBeNull();
    expect(isBalanceStale(null, now)).toBe(false);
  });
});
