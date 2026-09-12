import { describe, it, expect } from 'vitest';
import {
  CT_TABLES,
  financialYearForDate,
  fyStartYear,
  financialYearBounds,
  shiftFinancialYear,
  financialYearTable,
  ctPaymentDate,
} from './corporation-tax.js';

describe('financial-year helpers (1 April – 31 March)', () => {
  it('puts 31 March in the earlier FY and 1 April in the later one', () => {
    expect(financialYearForDate('2026-03-31')).toBe('FY2025');
    expect(financialYearForDate('2026-04-01')).toBe('FY2026');
    expect(financialYearForDate('2027-03-31')).toBe('FY2026');
    expect(financialYearForDate('2026-12-25')).toBe('FY2026');
  });

  it('parses the start year and shifts labels', () => {
    expect(fyStartYear('FY2026')).toBe(2026);
    expect(shiftFinancialYear('FY2026', -1)).toBe('FY2025');
    expect(shiftFinancialYear('FY2026', 1)).toBe('FY2027');
    expect(() => fyStartYear('2026-27')).toThrow(/Bad financial-year label/);
  });

  it('gives inclusive bounds', () => {
    expect(financialYearBounds('FY2026')).toEqual({
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    });
  });

  it('dates CT payment 9 months and 1 day after year-end', () => {
    expect(ctPaymentDate('FY2026')).toBe('2028-01-01');
    expect(ctPaymentDate('FY2025')).toBe('2027-01-01');
  });

  it('seeds every FY from 2023 with the 19% / 25% / 3⁄200 rules', () => {
    for (const label of ['FY2023', 'FY2024', 'FY2025', 'FY2026']) {
      expect(CT_TABLES[label]).toEqual({
        smallRate: 0.19,
        mainRate: 0.25,
        lowerLimitPence: 5_000_000,
        upperLimitPence: 25_000_000,
        marginalReliefFraction: 3 / 200,
      });
    }
  });

  it('falls back to the nearest known table outside the seeded range', () => {
    expect(financialYearTable('FY2026')).toEqual({ table: CT_TABLES.FY2026, tableYear: 'FY2026' });
    expect(financialYearTable('FY2020').tableYear).toBe('FY2023');
    expect(financialYearTable('FY2031').tableYear).toBe('FY2026');
  });
});
