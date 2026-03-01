import { describe, it, expect } from 'vitest';
import { filterTransactions } from './filtering.js';

describe('filterTransactions', () => {
  const items = [
    { id: 1, source: 'Salary', categoryId: 10, amount: 1000 },
    { id: 2, source: 'Bonus', categoryId: 11, amount: 500 },
    { id: 3, label: 'Rent', categoryId: 20, amount: 800 },
    { id: 4, note: 'Groceries', categoryId: 21, amount: 50 }
  ];

  const catMap = {
    10: 'Income',
    11: 'Extra',
    20: 'Housing',
    21: 'Food'
  };

  it('should return all items if no query or categories', () => {
    expect(filterTransactions(items, '', [], [], {})).toEqual(items);
  });

  it('should filter by search query in specific fields', () => {
    expect(filterTransactions(items, 'Sal', [], ['source'], {})).toHaveLength(1);
    expect(filterTransactions(items, 'Rent', [], ['label'], {})).toHaveLength(1);
  });

  it('should filter by search query in category names', () => {
    expect(filterTransactions(items, 'Food', [], ['note'], catMap)).toHaveLength(1);
  });

  it('should filter by multiple categories', () => {
    expect(filterTransactions(items, '', [10, 11], [], {})).toHaveLength(2);
    expect(filterTransactions(items, '', [20], [], {})).toHaveLength(1);
  });

  it('should combine search and category filters', () => {
    expect(filterTransactions(items, 'Sal', [10], ['source'], {})).toHaveLength(1);
    expect(filterTransactions(items, 'Sal', [11], ['source'], {})).toHaveLength(0);
  });
});
