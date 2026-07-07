import { describe, it, expect } from 'vitest';
import {
  TAX_YEAR_TABLES,
  taxYearForDate,
  taxYearBounds,
  shiftTaxYear,
  taxYearTable,
  buildPersonYearInput,
  computePersonTax,
} from './tax.js';

const T26 = TAX_YEAR_TABLES['2026-27'];
const T25 = TAX_YEAR_TABLES['2025-26'];

describe('tax-year calendar', () => {
  it('splits years at 6 April', () => {
    expect(taxYearForDate('2026-04-05')).toBe('2025-26');
    expect(taxYearForDate('2026-04-06')).toBe('2026-27');
    expect(taxYearForDate('2026-12-31')).toBe('2026-27');
    expect(taxYearForDate('2027-01-01')).toBe('2026-27');
    expect(taxYearForDate('2027-04-05')).toBe('2026-27');
  });

  it('computes inclusive bounds', () => {
    expect(taxYearBounds('2026-27')).toEqual({
      startDate: '2026-04-06',
      endDate: '2027-04-05',
    });
  });

  it('shifts labels, including across a century-ish boundary format', () => {
    expect(shiftTaxYear('2026-27', -1)).toBe('2025-26');
    expect(shiftTaxYear('2026-27', 1)).toBe('2027-28');
    expect(shiftTaxYear('2098-99', 1)).toBe('2099-00');
  });

  it('falls back to the nearest known rate table', () => {
    expect(taxYearTable('2026-27').tableYear).toBe('2026-27');
    expect(taxYearTable('2031-32').tableYear).toBe('2026-27');
    expect(taxYearTable('2020-21').tableYear).toBe('2025-26');
  });
});

describe('buildPersonYearInput', () => {
  const person = {
    annualSalaryPence: 6000000, // £60,000
    salarySacrificePence: 600000, // £6,000 car scheme
    pensionAnnualPence: 200000, // £2,000
    benefitsInKindPence: 100000, // £1,000
    otherIncomePence: 50000, // £500
  };

  it('sums dividends and applies signed salary adjustments after sacrifice', () => {
    const input = buildPersonYearInput(person, [
      { kind: 'dividend', amountPence: 1000000 },
      { kind: 'dividend', amountPence: 500000 },
      { kind: 'salary-adjustment', amountPence: 300000 }, // bonus
      { kind: 'salary-adjustment', amountPence: -100000 }, // unpaid leave
    ]);
    expect(input.salaryPence).toBe(6000000 - 600000 + 300000 - 100000);
    expect(input.dividendTotalPence).toBe(1500000);
    expect(input.adjustmentTotalPence).toBe(200000);
    expect(input.nonDividendPence).toBe(input.salaryPence + 100000 + 50000);
    expect(input.pensionPence).toBe(200000);
  });

  it('clamps a sacrifice larger than the salary to zero pay', () => {
    const input = buildPersonYearInput(
      { annualSalaryPence: 100000, salarySacrificePence: 500000 },
      []
    );
    expect(input.salaryPence).toBe(0);
    expect(input.nonDividendPence).toBe(0);
  });

  it('handles missing fields and no events', () => {
    const input = buildPersonYearInput({}, []);
    expect(input).toMatchObject({
      salaryPence: 0,
      nonDividendPence: 0,
      dividendPence: 0,
      pensionPence: 0,
    });
  });
});

describe('computePersonTax — hand-worked HMRC examples (2026-27)', () => {
  it('salary £60,000 + dividends £10,000: PAYE £11,432, dividend bill £3,396.25', () => {
    const r = computePersonTax(
      { nonDividendPence: 6000000, dividendPence: 1000000, pensionPence: 0 },
      T26
    );
    expect(r.personalAllowancePence).toBe(1257000);
    expect(r.nonDividendTaxPence).toBe(1143200); // £7,540 basic + £3,892 higher
    // £500 allowance, £9,500 in the higher band at 35.75%.
    expect(r.dividendTaxPence).toBe(339625);
    expect(r.totalTaxPence).toBe(1143200 + 339625);
    expect(r.grossIncomePence).toBe(7000000);
    expect(r.adjustedNetIncomePence).toBe(7000000);
    expect(r.headroomToHigherRatePence).toBe(0);
    expect(r.overHigherRate).toBe(true);
    expect(r.headroomTo100kPence).toBe(3000000); // £30,000 more before £100k
    expect(r.over100k).toBe(false);
  });

  it('salary £30,000 + dividends £15,000: everything basic rate', () => {
    const r = computePersonTax(
      { nonDividendPence: 3000000, dividendPence: 1500000, pensionPence: 0 },
      T26
    );
    expect(r.nonDividendTaxPence).toBe(348600); // £17,430 × 20%
    expect(r.dividendTaxPence).toBe(155875); // £14,500 × 10.75%
    expect(r.headroomToHigherRatePence).toBe(527000); // £5,270 to the 40% band
    expect(r.overHigherRate).toBe(false);
  });

  it('same £30k/£15k case at 2025-26 dividend rates (8.75%)', () => {
    const r = computePersonTax(
      { nonDividendPence: 3000000, dividendPence: 1500000, pensionPence: 0 },
      T25
    );
    expect(r.dividendTaxPence).toBe(126875); // £14,500 × 8.75%
  });

  it('salary £110,000: personal allowance tapers to £7,570, tax £33,432', () => {
    const r = computePersonTax(
      { nonDividendPence: 11000000, dividendPence: 0, pensionPence: 0 },
      T26
    );
    expect(r.personalAllowancePence).toBe(757000);
    expect(r.nonDividendTaxPence).toBe(3343200);
    expect(r.over100k).toBe(true);
    expect(r.headroomTo100kPence).toBe(0);
  });

  it('pension contributions pull adjusted net income back under £100k', () => {
    const r = computePersonTax(
      { nonDividendPence: 9500000, dividendPence: 1000000, pensionPence: 600000 },
      T26
    );
    expect(r.adjustedNetIncomePence).toBe(9900000);
    expect(r.over100k).toBe(false);
    expect(r.headroomTo100kPence).toBe(100000); // £1,000 of headroom left
    expect(r.personalAllowancePence).toBe(1257000); // no taper
  });

  it('additional rate: salary £130,000 + dividends £20,000, allowance fully tapered', () => {
    const r = computePersonTax(
      { nonDividendPence: 13000000, dividendPence: 2000000, pensionPence: 0 },
      T26
    );
    expect(r.personalAllowancePence).toBe(0);
    expect(r.nonDividendTaxPence).toBe(4470300); // £44,703
    expect(r.dividendTaxPence).toBe(767325); // £19,500 × 39.35%
  });

  it('dividends within personal allowance + dividend allowance are tax-free', () => {
    const r = computePersonTax(
      { nonDividendPence: 0, dividendPence: 1307000, pensionPence: 0 },
      T26
    );
    expect(r.totalTaxPence).toBe(0);
  });

  it('the dividend allowance consumes band space at the band boundary', () => {
    // Non-dividend income exactly fills PA + basic band; dividends of £1,000:
    // first £500 at 0% (but in the higher band), remaining £500 at 35.75%.
    const r = computePersonTax(
      { nonDividendPence: 5027000, dividendPence: 100000, pensionPence: 0 },
      T26
    );
    expect(r.dividendTaxPence).toBe(Math.round(50000 * 0.3575));
  });

  it('zero income is all zeros', () => {
    const r = computePersonTax({ nonDividendPence: 0, dividendPence: 0, pensionPence: 0 }, T26);
    expect(r.totalTaxPence).toBe(0);
    expect(r.headroomToHigherRatePence).toBe(5027000);
    expect(r.headroomTo100kPence).toBe(10000000);
  });
});
