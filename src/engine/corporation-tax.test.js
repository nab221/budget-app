import { describe, it, expect } from 'vitest';
import {
  CT_TABLES,
  financialYearForDate,
  fyStartYear,
  financialYearBounds,
  shiftFinancialYear,
  financialYearTable,
  ctPaymentDate,
  marginalRateAt,
  corporationTax,
  profitForNetDividends,
  setAsidePerPound,
} from './corporation-tax.js';

const T = CT_TABLES.FY2026;

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

describe('corporationTax', () => {
  it('matches HMRC worked figures', () => {
    expect(corporationTax(0, T).taxPence).toBe(0);
    expect(corporationTax(1_000_000, T).taxPence).toBe(190_000); // £10k → £1,900
    expect(corporationTax(5_000_000, T).taxPence).toBe(950_000); // £50k → £9,500
    expect(corporationTax(10_000_000, T).taxPence).toBe(2_275_000); // £100k → £22,750
    expect(corporationTax(15_000_000, T).taxPence).toBe(3_600_000); // £150k → £36,000
    expect(corporationTax(25_000_000, T).taxPence).toBe(6_250_000); // £250k → £62,500
    expect(corporationTax(30_000_000, T).taxPence).toBe(7_500_000); // £300k → £75,000
  });

  it('reports the band, the relief, and the rates', () => {
    const small = corporationTax(1_000_000, T);
    expect(small.band).toBe('small');
    expect(small.reliefPence).toBe(0);
    expect(small.marginalRate).toBe(0.19);
    expect(small.effectiveRate).toBeCloseTo(0.19, 10);

    const marginal = corporationTax(10_000_000, T);
    expect(marginal.band).toBe('marginal');
    expect(marginal.reliefPence).toBe(225_000); // 3/200 × £150,000
    expect(marginal.marginalRate).toBeCloseTo(0.265, 10);
    expect(marginal.effectiveRate).toBeCloseTo(0.2275, 10);

    const main = corporationTax(30_000_000, T);
    expect(main.band).toBe('main');
    expect(main.marginalRate).toBe(0.25);
    expect(main.effectiveRate).toBeCloseTo(0.25, 10);
  });

  it('treats exactly £50,000 as small-band profit whose NEXT pound is marginal', () => {
    const edge = corporationTax(5_000_000, T);
    expect(edge.band).toBe('small');
    expect(edge.marginalRate).toBeCloseTo(0.265, 10);
    expect(marginalRateAt(4_999_999, T)).toBe(0.19);
    expect(marginalRateAt(5_000_000, T)).toBeCloseTo(0.265, 10);
    expect(marginalRateAt(24_999_999, T)).toBeCloseTo(0.265, 10);
    expect(marginalRateAt(25_000_000, T)).toBe(0.25);
  });

  it('never returns negative tax and rounds junk to zero', () => {
    expect(corporationTax(-500, T).taxPence).toBe(0);
    expect(corporationTax(undefined, T).taxPence).toBe(0);
    expect(corporationTax(0, T).effectiveRate).toBe(0);
  });
});

describe('profitForNetDividends', () => {
  it('inverts the small band', () => {
    expect(profitForNetDividends(0, T)).toBe(0);
    expect(profitForNetDividends(810_000, T)).toBe(1_000_000); // £8,100 net ← £10,000
    expect(profitForNetDividends(4_050_000, T)).toBe(5_000_000); // £40,500 net ← £50,000
  });

  it('inverts the marginal band', () => {
    expect(profitForNetDividends(7_725_000, T)).toBe(10_000_000); // £77,250 net ← £100,000
    expect(profitForNetDividends(11_400_000, T)).toBe(15_000_000); // £114,000 net ← £150,000
    expect(profitForNetDividends(18_750_000, T)).toBe(25_000_000); // £187,500 net ← £250,000
  });

  it('inverts the main band', () => {
    expect(profitForNetDividends(22_500_000, T)).toBe(30_000_000); // £225,000 net ← £300,000
  });

  it('returns the SMALLEST profit that leaves at least the net, across a sweep', () => {
    const nets = [1, 99, 12_345, 810_001, 4_049_999, 4_050_001, 5_000_000, 7_725_001,
      18_749_999, 18_750_001, 40_000_000];
    for (const net of nets) {
      const p = profitForNetDividends(net, T);
      const netAt = (x) => x - corporationTax(x, T).taxPence;
      expect(netAt(p)).toBeGreaterThanOrEqual(net);
      expect(netAt(p - 1)).toBeLessThan(net);
    }
  });
});

describe('setAsidePerPound', () => {
  it('turns a profit rate into pence of CT per pound of dividend', () => {
    expect(setAsidePerPound(0.19)).toBeCloseTo(0.2346, 4);
    expect(setAsidePerPound(0.265)).toBeCloseTo(0.3605, 4);
    expect(setAsidePerPound(0.25)).toBeCloseTo(0.3333, 4);
  });
});
