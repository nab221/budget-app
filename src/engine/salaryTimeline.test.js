import { describe, it, expect } from 'vitest';
import {
  monthsOfTaxYear,
  projectedMonthPence,
  buildMonthlyPay,
  expectedPayeYtd,
} from './salaryTimeline.js';
import { TAX_YEAR_TABLES, buildPersonYearInput } from './tax.js';

const TABLE = TAX_YEAR_TABLES['2026-27'];

// £60,000/yr, nothing sacrificed → £5,000/month taxable.
const FLAT_60K = [{ effectiveFrom: '1900-01-01', annualSalaryPence: 6000000 }];

describe('monthsOfTaxYear', () => {
  it('returns the 12 calendar months April → March', () => {
    const months = monthsOfTaxYear('2026-27');
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-04');
    expect(months[8]).toBe('2026-12');
    expect(months[9]).toBe('2027-01');
    expect(months[11]).toBe('2027-03');
  });
});

describe('projectedMonthPence', () => {
  it('is annual/12 for a single full-year rate', () => {
    expect(projectedMonthPence(FLAT_60K, '2026-07')).toBe(500000);
  });

  it('subtracts sacrifice and workplace pension from the rate', () => {
    const periods = [
      {
        effectiveFrom: '1900-01-01',
        annualSalaryPence: 6000000,
        salarySacrificePence: 600000, // £6k car scheme
        workplacePensionAnnualPence: 600000, // £6k net-pay pension
      },
    ];
    // (60000 − 6000 − 6000) / 12 = £4,000.
    expect(projectedMonthPence(periods, '2026-07')).toBe(400000);
  });

  it('uses the rate in force before the month for later changes', () => {
    const periods = [
      { effectiveFrom: '1900-01-01', annualSalaryPence: 6000000 },
      { effectiveFrom: '2026-09-01', annualSalaryPence: 7200000 },
    ];
    expect(projectedMonthPence(periods, '2026-08')).toBe(500000);
    expect(projectedMonthPence(periods, '2026-09')).toBe(600000);
  });

  it('pro-rates a mid-month change by day', () => {
    const periods = [
      { effectiveFrom: '1900-01-01', annualSalaryPence: 6000000 }, // £5,000/mo
      { effectiveFrom: '2026-06-16', annualSalaryPence: 7200000 }, // £6,000/mo
    ];
    // June has 30 days: 15 days at £5,000 + 15 days at £6,000 → £5,500.
    expect(projectedMonthPence(periods, '2026-06')).toBe(550000);
  });

  it('handles a change effective mid-month with no prior period (new job)', () => {
    const periods = [{ effectiveFrom: '2026-06-16', annualSalaryPence: 7200000 }];
    // 15 of June's 30 days at £6,000/mo → £3,000; May is £0.
    expect(projectedMonthPence(periods, '2026-06')).toBe(300000);
    expect(projectedMonthPence(periods, '2026-05')).toBe(0);
  });

  it('adds a payrolled BIK to the rate', () => {
    const periods = [
      {
        effectiveFrom: '1900-01-01',
        annualSalaryPence: 6000000,
        salarySacrificePence: 600000, // £6k car scheme…
        bikAnnualPence: 180000, // …creating an £1,800/yr payrolled benefit
      },
    ];
    // (60000 − 6000 + 1800) / 12 = £4,650.
    expect(projectedMonthPence(periods, '2026-07')).toBe(465000);
  });

  it('taxes the BIK even when the cash part clamps to zero', () => {
    const periods = [
      {
        effectiveFrom: '1900-01-01',
        annualSalaryPence: 100000,
        salarySacrificePence: 900000,
        bikAnnualPence: 120000,
      },
    ];
    // Cash clamps to £0; the £1,200/yr benefit is still taxable.
    expect(projectedMonthPence(periods, '2026-07')).toBe(10000);
  });

  it('clamps a sacrifice larger than pay to zero, not negative', () => {
    const periods = [
      { effectiveFrom: '1900-01-01', annualSalaryPence: 100000, salarySacrificePence: 900000 },
    ];
    expect(projectedMonthPence(periods, '2026-07')).toBe(0);
  });

  it('returns 0 with no periods at all', () => {
    expect(projectedMonthPence([], '2026-07')).toBe(0);
  });
});

describe('buildMonthlyPay', () => {
  it('marks entered months actual (past) or planned (future), others projected', () => {
    const rows = buildMonthlyPay({
      periods: FLAT_60K,
      payslips: [
        { month: '2026-04', grossPence: 520000, pensionPence: 20000, taxPaidPence: 70000 },
        { month: '2026-12', grossPence: 900000, pensionPence: 0 }, // planned bonus month
      ],
      taxYear: '2026-27',
      todayMonth: '2026-07',
    });

    expect(rows[0]).toMatchObject({ month: '2026-04', source: 'actual', taxablePence: 500000 });
    expect(rows[1]).toMatchObject({ month: '2026-05', source: 'projected', taxablePence: 500000 });
    expect(rows[8]).toMatchObject({ month: '2026-12', source: 'planned', taxablePence: 900000 });
    expect(rows[11].source).toBe('projected');
  });

  it('adds a payslip BIK to the month: taxable = gross − pension + BIK', () => {
    // The owner's real payslip: gross £5,607.69, pension £600.02, BIK £156.75
    // → taxable £5,164.42 (not the £5,007.67 gross − pension gives alone).
    const rows = buildMonthlyPay({
      periods: FLAT_60K,
      payslips: [
        {
          month: '2026-04',
          grossPence: 560769,
          pensionPence: 60002,
          bikPence: 15675,
          taxPaidPence: 101806,
        },
      ],
      taxYear: '2026-27',
      todayMonth: '2026-07',
    });
    expect(rows[0].taxablePence).toBe(516442);
  });

  it('accumulates the running total and sums to the year salary', () => {
    const rows = buildMonthlyPay({
      periods: FLAT_60K,
      payslips: [],
      taxYear: '2026-27',
      todayMonth: '2026-07',
    });
    expect(rows[0].cumulativePence).toBe(500000);
    expect(rows[11].cumulativePence).toBe(6000000);
  });

  it('a raise from September changes only the later projections', () => {
    const rows = buildMonthlyPay({
      periods: [
        { effectiveFrom: '1900-01-01', annualSalaryPence: 6000000 },
        { effectiveFrom: '2026-09-01', annualSalaryPence: 7200000 },
      ],
      payslips: [],
      taxYear: '2026-27',
      todayMonth: '2026-07',
    });
    expect(rows[4].taxablePence).toBe(500000); // Aug
    expect(rows[5].taxablePence).toBe(600000); // Sep
    // 5 months at £5k + 7 at £6k = £67k.
    expect(rows[11].cumulativePence).toBe(6700000);
  });

  it('feeds buildPersonYearInput as the salary override', () => {
    const rows = buildMonthlyPay({
      periods: FLAT_60K,
      payslips: [],
      taxYear: '2026-27',
      todayMonth: '2026-07',
    });
    const input = buildPersonYearInput({}, [], rows[11].cumulativePence);
    expect(input.salaryPence).toBe(6000000);
    expect(input.nonDividendPence).toBe(6000000);
  });
});

describe('expectedPayeYtd', () => {
  const slip = (month, gross, tax) => ({
    month,
    grossPence: gross,
    pensionPence: 0,
    taxPaidPence: tax,
  });

  it('returns null with no actual payslips', () => {
    const rows = buildMonthlyPay({
      periods: FLAT_60K,
      payslips: [],
      taxYear: '2026-27',
      todayMonth: '2026-07',
    });
    expect(expectedPayeYtd(rows, TABLE)).toBeNull();
  });

  it('computes cumulative-basis PAYE for the entered months', () => {
    // 3 months of £5,000 gross. YTD taxable £15,000; allowance 3/12 × £12,570
    // = £3,142.50; basic edge 3/12 × £37,700 = £9,425. Taxable £11,857.50 →
    // £9,425 at 20% + £2,432.50 at 40% = £1,885 + £973 = £2,858.
    const rows = buildMonthlyPay({
      periods: FLAT_60K,
      payslips: [
        slip('2026-04', 500000, 95000),
        slip('2026-05', 500000, 95000),
        slip('2026-06', 500000, 95000),
      ],
      taxYear: '2026-27',
      todayMonth: '2026-07',
    });
    const check = expectedPayeYtd(rows, TABLE);
    expect(check.months).toBe(3);
    expect(check.taxableYtdPence).toBe(1500000);
    expect(check.expectedPence).toBe(285800);
    expect(check.paidPence).toBe(285000);
    expect(check.diffPence).toBe(-800);
    expect(check.complete).toBe(true);
  });

  it('flags an incomplete run when a month is missing before the latest payslip', () => {
    const rows = buildMonthlyPay({
      periods: FLAT_60K,
      payslips: [slip('2026-04', 500000, 95000), slip('2026-06', 500000, 95000)],
      taxYear: '2026-27',
      todayMonth: '2026-07',
    });
    expect(expectedPayeYtd(rows, TABLE).complete).toBe(false);
  });

  it('ignores planned future payslips', () => {
    const rows = buildMonthlyPay({
      periods: FLAT_60K,
      payslips: [slip('2026-04', 500000, 95000), slip('2026-12', 900000, 0)],
      taxYear: '2026-27',
      todayMonth: '2026-07',
    });
    const check = expectedPayeYtd(rows, TABLE);
    expect(check.months).toBe(1);
    expect(check.taxableYtdPence).toBe(500000);
    expect(check.complete).toBe(true);
  });
});
