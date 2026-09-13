import { describe, it, expect } from 'vitest';
import { sortRows, toggleSort, compareValues } from './sortRows.js';

const rows = [
  { name: 'Visa', balancePence: 100000, utilisation: 50 },
  { name: 'amex', balancePence: 5000, utilisation: null },
  { name: 'Car loan', balancePence: 500000, utilisation: null },
  { name: 'Barclaycard', balancePence: 20000, utilisation: 10 },
];

describe('sortRows', () => {
  it('sorts numbers ascending and descending', () => {
    expect(sortRows(rows, 'balancePence', 'asc').map((r) => r.name)).toEqual([
      'amex', 'Barclaycard', 'Visa', 'Car loan',
    ]);
    expect(sortRows(rows, 'balancePence', 'desc').map((r) => r.name)).toEqual([
      'Car loan', 'Visa', 'Barclaycard', 'amex',
    ]);
  });

  it('sorts text case-insensitively with localeCompare', () => {
    expect(sortRows(rows, 'name', 'asc').map((r) => r.name)).toEqual([
      'amex', 'Barclaycard', 'Car loan', 'Visa',
    ]);
  });

  it('puts empty values last in both directions', () => {
    expect(sortRows(rows, 'utilisation', 'asc').map((r) => r.name)).toEqual([
      'Barclaycard', 'Visa', 'amex', 'Car loan',
    ]);
    expect(sortRows(rows, 'utilisation', 'desc').map((r) => r.name)).toEqual([
      'Visa', 'Barclaycard', 'amex', 'Car loan',
    ]);
  });

  it('does not mutate the input', () => {
    const copy = [...rows];
    sortRows(rows, 'balancePence', 'desc');
    expect(rows).toEqual(copy);
  });

  it('treats an empty string as empty', () => {
    expect(compareValues('', 'x')).toBeGreaterThan(0);
    expect(compareValues(null, undefined)).toBe(0);
  });
});

describe('toggleSort', () => {
  it('starts a new column ascending and flips the same column', () => {
    expect(toggleSort({ key: 'ratePercent', dir: 'desc' }, 'balancePence')).toEqual({
      key: 'balancePence', dir: 'asc',
    });
    expect(toggleSort({ key: 'balancePence', dir: 'asc' }, 'balancePence')).toEqual({
      key: 'balancePence', dir: 'desc',
    });
    expect(toggleSort({ key: 'balancePence', dir: 'desc' }, 'balancePence')).toEqual({
      key: 'balancePence', dir: 'asc',
    });
  });
});
