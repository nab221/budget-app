import { describe, it, expect } from 'vitest';
import { filterTransactions, computeTotals, sortTransactions } from './transactionFilters.js';

// Rows as returned by transactionsRepo: money is POUNDS at the edge.
const rows = [
  { id: 1, date: '2026-07-03', kind: 'spend', amountPence: 12.5, categoryId: 1, description: 'Tesco Metro' },
  { id: 2, date: '2026-07-10', kind: 'income', amountPence: 2000, categoryId: 9, description: 'Salary' },
  { id: 3, date: '2026-07-10', kind: 'spend', amountPence: 40, categoryId: 2, description: 'Shell petrol' },
  { id: 4, date: '2026-07-15', kind: 'spend', amountPence: 7.25, categoryId: 1, description: 'TESCO express' },
];

describe('filterTransactions', () => {
  it('matches description substrings case-insensitively', () => {
    const out = filterTransactions(rows, { search: 'tesco' });
    expect(out.map((r) => r.id).sort()).toEqual([1, 4]);
  });

  it('filters by category', () => {
    const out = filterTransactions(rows, { categoryId: 1 });
    expect(out.map((r) => r.id).sort()).toEqual([1, 4]);
  });

  it('accepts string category ids (from a <select> value)', () => {
    const out = filterTransactions(rows, { categoryId: '2' });
    expect(out.map((r) => r.id)).toEqual([3]);
  });

  it('combines search and category (AND)', () => {
    const out = filterTransactions(rows, { search: 'petrol', categoryId: 2 });
    expect(out.map((r) => r.id)).toEqual([3]);
    expect(filterTransactions(rows, { search: 'petrol', categoryId: 1 })).toHaveLength(0);
  });

  it('returns everything for the "all" sentinel / empty search', () => {
    expect(filterTransactions(rows, { categoryId: 'all', search: '' })).toHaveLength(4);
    expect(filterTransactions(rows, {})).toHaveLength(4);
  });
});

describe('computeTotals', () => {
  it('sums income and spend in exact pence and nets them', () => {
    const t = computeTotals(rows);
    expect(t.incomePence).toBe(200000); // £2000
    expect(t.spendPence).toBe(1250 + 4000 + 725); // £59.75
    expect(t.netPence).toBe(200000 - (1250 + 4000 + 725));
    expect(t.count).toBe(4);
  });

  it('reflects the filtered subset it is handed', () => {
    const t = computeTotals(filterTransactions(rows, { categoryId: 1 }));
    expect(t.spendPence).toBe(1250 + 725);
    expect(t.incomePence).toBe(0);
    expect(t.netPence).toBe(-(1250 + 725));
  });

  it('handles an empty set', () => {
    expect(computeTotals([])).toEqual({ incomePence: 0, spendPence: 0, netPence: 0, count: 0 });
  });
});

describe('sortTransactions', () => {
  it('orders newest date first, id descending on ties, without mutating input', () => {
    const input = [...rows];
    const out = sortTransactions(rows);
    expect(out.map((r) => r.id)).toEqual([4, 3, 2, 1]);
    expect(rows).toEqual(input); // pure
  });
});
