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
  companyTotals,
  buildCompanyYear,
  previewDraw,
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

describe('companyTotals', () => {
  it('reads as zeros with no dividends but still knows the next-pound rate', () => {
    const t = companyTotals(0, T);
    expect(t).toMatchObject({
      dividendPence: 0,
      profitPence: 0,
      ctPence: 0,
      effectiveRate: 0,
      band: 'small',
      marginalRate: 0.19,
      headroomProfitPence: 5_000_000,
      headroomDividendPence: 4_050_000,
    });
    expect(t.averageSetAsidePerPound).toBeCloseTo(0.2346, 4);
    expect(t.marginalSetAsidePerPound).toBeCloseTo(0.2346, 4);
  });

  it('derives profit, CT, and headroom from the dividends', () => {
    const t = companyTotals(810_000, T); // £8,100 drawn
    expect(t.profitPence).toBe(1_000_000);
    expect(t.ctPence).toBe(190_000);
    expect(t.headroomProfitPence).toBe(4_000_000);
    expect(t.headroomDividendPence).toBe(3_240_000); // £40,000 × 81%
    expect(t.averageSetAsidePerPound).toBeCloseTo(190_000 / 810_000, 10);
  });

  it('flips to the marginal band past £50,000 of profit', () => {
    const t = companyTotals(7_725_000, T); // £77,250 drawn ← £100,000 profit
    expect(t.band).toBe('marginal');
    expect(t.profitPence).toBe(10_000_000);
    expect(t.ctPence).toBe(2_275_000);
    expect(t.marginalRate).toBeCloseTo(0.265, 10);
    expect(t.marginalSetAsidePerPound).toBeCloseTo(0.3605, 4);
    expect(t.headroomProfitPence).toBe(0);
    expect(t.headroomDividendPence).toBe(0);
  });
});

describe('buildCompanyYear', () => {
  const people = [
    { id: 1, name: 'Anderson' },
    { id: 2, name: 'Wife' },
  ];
  const events = [
    { id: 10, personId: 1, date: '2026-05-01', kind: 'dividend', note: 'Q1', amountPence: 540_000 },
    { id: 11, personId: 2, date: '2026-05-01', kind: 'dividend', note: '', amountPence: 270_000 },
    { id: 12, personId: 1, date: '2026-08-01', kind: 'sipp-contribution', note: '', amountPence: 100_000 },
    { id: 13, personId: 2, date: '2026-04-15', kind: 'dividend', note: '', amountPence: 100 },
  ];

  it('pools both people, ignores other kinds, and orders newest first', () => {
    const year = buildCompanyYear({ dividendEvents: events, people, table: T });
    expect(year.events.map((e) => e.id)).toEqual([11, 10, 13]);
    expect(year.events[0].personName).toBe('Wife');
    expect(year.dividendPence).toBe(810_100);
    expect(year.profitPence).toBe(profitForNetDividends(810_100, T));
    expect(year.ctPence).toBe(corporationTax(year.profitPence, T).taxPence);
  });

  it('splits the total per person in people order, with shares', () => {
    const year = buildCompanyYear({ dividendEvents: events, people, table: T });
    expect(year.perPerson).toEqual([
      { personId: 1, name: 'Anderson', dividendPence: 540_000, share: 540_000 / 810_100 },
      { personId: 2, name: 'Wife', dividendPence: 270_100, share: 270_100 / 810_100 },
    ]);
  });

  it('keeps counting a dividend whose person is unknown', () => {
    const year = buildCompanyYear({
      dividendEvents: [{ id: 1, personId: 99, date: '2026-05-01', kind: 'dividend', amountPence: 100 }],
      people,
      table: T,
    });
    expect(year.dividendPence).toBe(100);
    expect(year.events[0].personName).toBe(null);
    expect(year.perPerson).toEqual([
      { personId: 1, name: 'Anderson', dividendPence: 0, share: 0 },
      { personId: 2, name: 'Wife', dividendPence: 0, share: 0 },
      { personId: 99, name: null, dividendPence: 100, share: 1 },
    ]);
  });

  it('is empty-safe', () => {
    const year = buildCompanyYear({ table: T });
    expect(year.events).toEqual([]);
    expect(year.perPerson).toEqual([]);
    expect(year.dividendPence).toBe(0);
  });
});

describe('previewDraw', () => {
  it('prices a draw that stays in the small band', () => {
    const p = previewDraw({ dividendPence: 810_000, extraDividendPence: 100_000, table: T });
    expect(p.before.profitPence).toBe(1_000_000);
    expect(p.after.dividendPence).toBe(910_000);
    expect(p.after.profitPence).toBe(1_123_457); // £11,234.57
    expect(p.after.ctPence).toBe(213_457);
    expect(p.extraCtPence).toBe(23_457); // £234.57
    expect(p.extraProfitPence).toBe(123_457);
    expect(p.rateOnExtraProfit).toBeCloseTo(0.19, 3);
    expect(p.setAsidePerPound).toBeCloseTo(0.2346, 3);
    expect(p.crossesLowerLimit).toBe(false);
    expect(p.crossesUpperLimit).toBe(false);
  });

  it('flags and blends a draw that crosses £50,000 of profit', () => {
    // £40,000 drawn (£49,382.72 profit) + £5,000 → past the lower limit.
    const p = previewDraw({ dividendPence: 4_000_000, extraDividendPence: 500_000, table: T });
    expect(p.before.band).toBe('small');
    expect(p.after.band).toBe('marginal');
    expect(p.crossesLowerLimit).toBe(true);
    expect(p.rateOnExtraProfit).toBeGreaterThan(0.19);
    expect(p.rateOnExtraProfit).toBeLessThan(0.265);
  });

  it('prices a main-band draw at 25%', () => {
    const p = previewDraw({ dividendPence: 22_500_000, extraDividendPence: 750_000, table: T });
    expect(p.extraProfitPence).toBe(1_000_000);
    expect(p.extraCtPence).toBe(250_000);
    expect(p.rateOnExtraProfit).toBeCloseTo(0.25, 10);
  });

  it('treats a zero or junk draw as no change', () => {
    const p = previewDraw({ dividendPence: 810_000, extraDividendPence: null, table: T });
    expect(p.extraDividendPence).toBe(0);
    expect(p.extraCtPence).toBe(0);
    expect(p.after).toEqual(p.before);
    expect(p.rateOnExtraProfit).toBe(0.19);
  });
});
