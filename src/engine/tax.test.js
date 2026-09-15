import { describe, it, expect } from 'vitest';
import {
  TAX_YEAR_TABLES,
  taxYearForDate,
  taxYearBounds,
  shiftTaxYear,
  taxYearTable,
  parseTaxCode,
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

describe('parseTaxCode', () => {
  it('reads numeric L/M/N/T codes as £10-per-point free pay', () => {
    expect(parseTaxCode('1257L')).toEqual({ code: '1257L', allowancePence: 1257000, flatRate: null });
    expect(parseTaxCode('1383M')).toEqual({ code: '1383M', allowancePence: 1383000, flatRate: null });
    expect(parseTaxCode('1131N').allowancePence).toBe(1131000);
    expect(parseTaxCode('500T').allowancePence).toBe(500000);
  });

  it('normalises case and spaces', () => {
    expect(parseTaxCode(' 1257l ')).toEqual({ code: '1257L', allowancePence: 1257000, flatRate: null });
  });

  it('reads K codes as a negative allowance (pay added)', () => {
    expect(parseTaxCode('K475')).toEqual({ code: 'K475', allowancePence: -475000, flatRate: null });
  });

  it('reads 0T as no allowance with normal bands', () => {
    expect(parseTaxCode('0T')).toEqual({ code: '0T', allowancePence: 0, flatRate: null });
  });

  it('reads the flat-rate codes', () => {
    expect(parseTaxCode('BR').flatRate).toBe('basic');
    expect(parseTaxCode('D0').flatRate).toBe('higher');
    expect(parseTaxCode('D1').flatRate).toBe('additional');
    expect(parseTaxCode('NT').flatRate).toBe('none');
  });

  it('accepts Scottish/Welsh prefixes (rUK bands still used)', () => {
    expect(parseTaxCode('S1257L').allowancePence).toBe(1257000);
    expect(parseTaxCode('C1257L').allowancePence).toBe(1257000);
  });

  it('ignores W1/M1/X emergency markers', () => {
    expect(parseTaxCode('1257L W1').allowancePence).toBe(1257000);
    expect(parseTaxCode('1257L M1')).toEqual({ code: '1257L', allowancePence: 1257000, flatRate: null });
    expect(parseTaxCode('1257LX').allowancePence).toBe(1257000);
    // The marker strip must not eat a real M-suffix code.
    expect(parseTaxCode('1257M').allowancePence).toBe(1257000);
  });

  it('returns null for blank or unrecognised codes', () => {
    expect(parseTaxCode('')).toBeNull();
    expect(parseTaxCode(null)).toBeNull();
    expect(parseTaxCode(undefined)).toBeNull();
    expect(parseTaxCode('ABC')).toBeNull();
    expect(parseTaxCode('12570')).toBeNull();
    expect(parseTaxCode('L1257')).toBeNull();
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

  it('routes other-income events into the non-dividend total, not the salary', () => {
    const input = buildPersonYearInput(person, [
      { kind: 'other-income', amountPence: 500000 }, // £5,000 consultancy fee
      { kind: 'dividend', amountPence: 1000000 },
    ]);
    expect(input.otherEventTotalPence).toBe(500000);
    expect(input.salaryPence).toBe(6000000 - 600000); // fee not in PAYE salary
    expect(input.nonDividendPence).toBe(input.salaryPence + 100000 + 50000 + 500000);
    expect(input.dividendPence).toBe(1000000); // and not a dividend either
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
      sippPaidTotalPence: 0,
      sippGrossPence: 0,
    });
  });

  it('grosses SIPP contributions up 25% into the pension figure (amendment (g))', () => {
    const input = buildPersonYearInput(person, [
      { kind: 'sipp-contribution', amountPence: 80000 }, // £800 paid
      { kind: 'sipp-contribution', amountPence: 40000 }, // £400 paid
    ]);
    expect(input.sippPaidTotalPence).toBe(120000);
    expect(input.sippGrossPence).toBe(150000); // £1,200 → £1,500 with relief
    // Annual field (£2,000, entered gross) + grossed-up SIPP.
    expect(input.pensionPence).toBe(200000 + 150000);
    // A SIPP payment is not income — the income stacks are untouched.
    expect(input.nonDividendPence).toBe(6000000 - 600000 + 100000 + 50000);
    expect(input.dividendPence).toBe(0);
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

  it('a gross consultancy fee splits PAYE vs Self Assessment correctly', () => {
    // £60,000 salary + £5,000 gross fee + £10,000 dividends.
    const r = computePersonTax(
      {
        nonDividendPence: 6500000,
        dividendPence: 1000000,
        pensionPence: 0,
        otherEventTotalPence: 500000,
      },
      T26
    );
    // Whole non-dividend stack: £7,540 basic + (£52,430 − £37,700) × 40%.
    expect(r.nonDividendTaxPence).toBe(1343200);
    // The fee is the top £5,000 slice of that stack — all in the 40% band.
    expect(r.otherIncomeTaxPence).toBe(200000);
    // PAYE only ever sees the salary — same £11,432 as the salary-only case.
    expect(r.payeTaxPence).toBe(1143200);
    expect(r.dividendTaxPence).toBe(339625);
    expect(r.selfAssessmentTaxPence).toBe(200000 + 339625);
    expect(r.totalTaxPence).toBe(1343200 + 339625);
  });

  it('a basic-rate fee is taxed at 20% via Self Assessment', () => {
    // £30,000 salary + £5,000 fee — both fully inside the basic band.
    const r = computePersonTax(
      { nonDividendPence: 3500000, dividendPence: 0, pensionPence: 0, otherEventTotalPence: 500000 },
      T26
    );
    expect(r.otherIncomeTaxPence).toBe(100000); // £5,000 × 20%
    expect(r.payeTaxPence).toBe(r.nonDividendTaxPence - 100000);
    expect(r.selfAssessmentTaxPence).toBe(100000);
  });

  it('without other income the split degenerates to the old figures', () => {
    const r = computePersonTax(
      { nonDividendPence: 6000000, dividendPence: 1000000, pensionPence: 0 },
      T26
    );
    expect(r.otherIncomeTaxPence).toBe(0);
    expect(r.payeTaxPence).toBe(r.nonDividendTaxPence);
    expect(r.selfAssessmentTaxPence).toBe(r.dividendTaxPence);
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

  it('relief-at-source pension: higher-rate relief comes back via Self Assessment', () => {
    // Salary £80,000 + dividends £20,000 + £10,000 gross SIPP (£8,000 paid).
    // The gross contribution extends the basic band £37,700 → £47,700, so
    // £10,000 of salary moves from 40% to 20%. PAYE at source is blind to the
    // SIPP (£19,432 as before); the £2,000 comes back through the return.
    const r = computePersonTax(
      { nonDividendPence: 8000000, dividendPence: 2000000, pensionPence: 1000000 },
      T26
    );
    expect(r.adjustedNetIncomePence).toBe(9000000);
    expect(r.nonDividendTaxPence).toBe(1743200); // £9,540 basic + £7,892 higher
    expect(r.payeTaxPence).toBe(1943200); // unchanged from the no-SIPP case
    expect(r.dividendTaxPence).toBe(697125); // £19,500 still all in the 40% band
    expect(r.pensionReliefPence).toBe(200000);
    expect(r.selfAssessmentTaxPence).toBe(697125 - 200000);
    expect(r.totalTaxPence).toBe(1743200 + 697125);
    expect(r.headroomToHigherRatePence).toBe(0);
    expect(r.overHigherRate).toBe(true);
  });

  it('relief-at-source pension: the extended band pulls dividends down to the ordinary rate', () => {
    // Salary £46,170 + dividends £20,000 + £10,000 gross SIPP. Non-dividend
    // taxable £33,600 is all basic rate either way; the band edge moving to
    // £47,700 puts £13,600 more of the dividends at 10.75% instead of 35.75%.
    const r = computePersonTax(
      { nonDividendPence: 4617000, dividendPence: 2000000, pensionPence: 1000000 },
      T26
    );
    expect(r.nonDividendTaxPence).toBe(672000);
    expect(r.payeTaxPence).toBe(672000);
    expect(r.pensionReliefPence).toBe(0);
    // £13,600 × 10.75% + £5,900 × 35.75% (was £3,600 × 10.75% + £15,900 × 35.75%).
    expect(r.dividendTaxPence).toBe(146200 + 210925);
    expect(r.selfAssessmentTaxPence).toBe(146200 + 210925);
    // The 40% line moves up by the gross contribution: £60,270 − £66,170 gross.
    expect(r.headroomToHigherRatePence).toBe(0);
    expect(r.overHigherRate).toBe(true);
  });

  it('relief-at-source pension: a basic-rate taxpayer gets nothing more back', () => {
    const r = computePersonTax(
      { nonDividendPence: 3000000, dividendPence: 0, pensionPence: 500000 },
      T26
    );
    expect(r.nonDividendTaxPence).toBe(348600);
    expect(r.payeTaxPence).toBe(348600);
    expect(r.pensionReliefPence).toBe(0);
    expect(r.selfAssessmentTaxPence).toBe(0);
    // £30,000 → £50,270 is £20,270; the £5,000 contribution pushes the line up.
    expect(r.headroomToHigherRatePence).toBe(2027000 + 500000);
  });

  it('relief-at-source pension over £100k: band extension + allowance restored = a refund', () => {
    // Salary £110,000 + £10,000 gross SIPP: ANI back to £100,000, so the full
    // £12,570 allowance returns (PAYE's tax code assumed £7,570) and the basic
    // band extends. Nothing else is owed, so Self Assessment is a £4,000 refund.
    const r = computePersonTax(
      { nonDividendPence: 11000000, dividendPence: 0, pensionPence: 1000000 },
      T26
    );
    expect(r.personalAllowancePence).toBe(1257000);
    expect(r.nonDividendTaxPence).toBe(2943200); // £9,540 + £49,730 × 40%
    expect(r.payeTaxPence).toBe(3343200); // as the £110,000 case without a pension
    expect(r.pensionReliefPence).toBe(400000);
    expect(r.selfAssessmentTaxPence).toBe(-400000);
    expect(r.totalTaxPence).toBe(2943200);
  });

  it('zero income is all zeros', () => {
    const r = computePersonTax({ nonDividendPence: 0, dividendPence: 0, pensionPence: 0 }, T26);
    expect(r.totalTaxPence).toBe(0);
    expect(r.headroomToHigherRatePence).toBe(5027000);
    expect(r.headroomTo100kPence).toBe(10000000);
  });
});
