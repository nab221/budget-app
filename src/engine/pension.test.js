import { describe, it, expect } from 'vitest';
import {
  SCHEMES,
  SEPTEMBER_CPI,
  cpiForYear,
  annualAllowanceForYear,
  anchorOpeningYear,
  estimatePia,
  rollForward,
  estimatePiaFromClosing,
  rollBackward,
  buildPensionYear,
} from './pension.js';
import { TAX_YEAR_TABLES } from './tax.js';

describe('tables', () => {
  it('seeds both career-average schemes', () => {
    expect(SCHEMES['nhs-2015']).toEqual({ label: 'NHS 2015', accrualDenominator: 54, realRevaluation: 0.015 });
    expect(SCHEMES['lgps-2014']).toEqual({ label: 'LGPS 2014', accrualDenominator: 49, realRevaluation: 0 });
  });

  it('seeds September CPI by the tax year it uprates', () => {
    expect(SEPTEMBER_CPI['2023-24']).toBe(0.101);
    expect(SEPTEMBER_CPI['2026-27']).toBe(0.038);
    expect(cpiForYear('2025-26')).toBe(0.017);
    expect(cpiForYear('2031-32')).toBe(null); // no fallback, ever
  });
});

describe('annualAllowanceForYear', () => {
  it('is £40,000 before 2023-24 and the tax table from then on, fromTable true for every known year', () => {
    expect(annualAllowanceForYear('2022-23')).toEqual({ allowancePence: 4_000_000, fromTable: true });
    expect(annualAllowanceForYear('2023-24')).toEqual({ allowancePence: 6_000_000, fromTable: true });
    expect(annualAllowanceForYear('2026-27')).toEqual({ allowancePence: 6_000_000, fromTable: true });
    expect(annualAllowanceForYear('2035-36')).toEqual({ allowancePence: 6_000_000, fromTable: false });
  });

  it('clamps years before the seeded range to the OLDEST table, not the newest', () => {
    const newest = '2099-00';
    TAX_YEAR_TABLES[newest] = { ...TAX_YEAR_TABLES['2026-27'], pensionAnnualAllowancePence: 9_999_900 };
    try {
      expect(annualAllowanceForYear('2023-24').allowancePence).toBe(6_000_000); // oldest table's figure
      expect(annualAllowanceForYear('2030-31')).toEqual({ allowancePence: 9_999_900, fromTable: false });
    } finally {
      delete TAX_YEAR_TABLES[newest];
    }
  });
});

describe('anchorOpeningYear', () => {
  it('a statement dated at the end of a tax year opens the next one', () => {
    expect(anchorOpeningYear('2026-03-31')).toBe('2026-27');
    expect(anchorOpeningYear('2026-04-05')).toBe('2026-27');
    expect(anchorOpeningYear('2026-04-06')).toBe('2027-28');
  });
});

describe('estimatePia', () => {
  it("reproduces the owner's 2025-26 NHS figures (£6,447.70 → £7,900.18, PIA ≈ £21,486)", () => {
    const est = estimatePia({
      scheme: 'nhs-2015',
      openingPence: 644_770,
      cpi: 0.017,
      earningsPence: 6_729_210, // £1,246.15 × 54
    });
    expect(est.closingPence).toBe(790_018);
    expect(est.upratedOpeningPence).toBe(655_731);
    expect(Math.abs(est.piaPence - 2_148_600)).toBeLessThan(100);
  });

  it('2026-27 on £70,000 ≈ £1,896 + 16/54 × earnings', () => {
    const est = estimatePia({ scheme: 'nhs-2015', openingPence: 790_018, cpi: 0.038, earningsPence: 7_000_000 });
    expect(est.piaPence).toBe(2_263_678);
    const collapsed = Math.round(16 * (0.015 * 790_018 + 7_000_000 / 54));
    expect(Math.abs(est.piaPence - collapsed)).toBeLessThan(100);
  });

  it('LGPS collapses to 16 × earnings ÷ 49 whatever the CPI', () => {
    const est = estimatePia({ scheme: 'lgps-2014', openingPence: 500_000, cpi: 0.031, earningsPence: 4_000_000 });
    expect(Math.abs(est.piaPence - Math.round((16 * 4_000_000) / 49))).toBeLessThan(100);
  });

  it('uses the statement pension earned as the accrual when given, ignoring earnings', () => {
    const est = estimatePia({ scheme: 'nhs-2015', openingPence: 644_770, cpi: 0.017, earningsPence: 0, earnedPence: 124_615 });
    expect(est.closingPence).toBe(790_018);
    expect(Math.abs(est.piaPence - 2_148_600)).toBeLessThan(100);
    const derived = estimatePia({ scheme: 'nhs-2015', openingPence: 644_770, cpi: 0.017, earningsPence: 6_729_210, earnedPence: null });
    expect(derived.closingPence).toBe(790_018); // null → earnings ÷ 54, as before
  });

  it('never goes negative and treats junk as zero', () => {
    const est = estimatePia({ scheme: 'lgps-2014', openingPence: 'x', cpi: 0.02, earningsPence: null });
    expect(est).toEqual({ closingPence: 0, upratedOpeningPence: 0, piaPence: 0 });
  });

  it('rejects an unknown scheme', () => {
    expect(() => estimatePia({ scheme: 'usс', openingPence: 0, cpi: 0, earningsPence: 0 })).toThrow(/scheme/);
  });
});

// The owner's TRS reconstruction: anchor 280,982 pence at 31 Mar 2022 (opens
// 2022-23), earnings = the TRS "earned" figure x 54.
const NHS_EARNINGS = {
  '2022-23': 3_826_278, // 708.57 x 54
  '2023-24': 4_787_100, // 886.50 x 54
  '2024-25': 5_853_222, // 1,083.93 x 54
  '2025-26': 6_729_210, // 1,246.15 x 54
  '2026-27': 7_000_000,
};

// The same years as the site shows them: "pension earned" = earnings ÷ 54.
const NHS_EARNED = {
  '2022-23': 70_857,
  '2023-24': 88_650,
  '2024-25': 108_393,
  '2025-26': 124_615,
};

describe('rollForward', () => {
  it('reproduces the TRS balances year by year, rounding once per year', () => {
    const r = rollForward({
      scheme: 'nhs-2015',
      anchorPence: 280_982,
      anchorOpeningYear: '2022-23',
      targetYear: '2026-27',
      earningsByYear: NHS_EARNINGS,
    });
    expect(r.chain.map((c) => [c.taxYear, c.closingPence])).toEqual([
      ['2022-23', 364_764],
      ['2023-24', 495_727],
      ['2024-25', 644_770],
      ['2025-26', 790_018],
    ]);
    expect(r.openingPence).toBe(790_018);
  });

  it('uses pension earned in place of earnings ÷ 54 for the years that have it', () => {
    const r = rollForward({
      scheme: 'nhs-2015',
      anchorPence: 280_982,
      anchorOpeningYear: '2022-23',
      targetYear: '2026-27',
      earningsByYear: {},
      earnedByYear: NHS_EARNED,
    });
    expect(r.chain.map((c) => [c.taxYear, c.closingPence])).toEqual([
      ['2022-23', 364_764],
      ['2023-24', 495_727],
      ['2024-25', 644_770],
      ['2025-26', 790_018],
    ]);
  });

  it('is the anchor itself for the anchor opening year', () => {
    const r = rollForward({ scheme: 'nhs-2015', anchorPence: 790_018, anchorOpeningYear: '2026-27', targetYear: '2026-27', earningsByYear: {} });
    expect(r).toEqual({ openingPence: 790_018, chain: [] });
  });

  it('returns null before the anchor, before 2022-23, or when a CPI in the chain is missing', () => {
    const base = { scheme: 'nhs-2015', anchorPence: 100, earningsByYear: {} };
    expect(rollForward({ ...base, anchorOpeningYear: '2026-27', targetYear: '2025-26' })).toBe(null);
    expect(rollForward({ ...base, anchorOpeningYear: '2021-22', targetYear: '2023-24' })).toBe(null);
    expect(rollForward({ ...base, anchorOpeningYear: '2026-27', targetYear: '2028-29' })).toBe(null); // no 2027-28 CPI
    expect(rollForward({ ...base, anchorOpeningYear: '2026-27', targetYear: '2027-28', cpiByYear: { '2026-27': 0.038 } }).openingPence).toBeGreaterThan(100);
  });
});

describe('estimatePiaFromClosing', () => {
  it('reverses the 2025-26 step: £7,900.18 closing, £1,246.15 earned → £6,447.70 opening, PIA ≈ £21,486', () => {
    const r = estimatePiaFromClosing({ scheme: 'nhs-2015', closingPence: 790_018, cpi: 0.017, earnedPence: 124_615 });
    expect(r.openingPence).toBe(644_770);
    expect(r.upratedOpeningPence).toBe(655_731);
    expect(Math.abs(r.piaPence - 2_148_600)).toBeLessThan(100);
  });

  it('clamps the opening at zero when earned exceeds closing', () => {
    const r = estimatePiaFromClosing({ scheme: 'lgps-2014', closingPence: 1_000, cpi: 0.02, earnedPence: 5_000 });
    expect(r.openingPence).toBe(0);
    expect(r.piaPence).toBe(16_000); // 16 × closing
  });

  it('rejects an unknown scheme', () => {
    expect(() => estimatePiaFromClosing({ scheme: 'uss', closingPence: 0, cpi: 0, earnedPence: 0 })).toThrow(/scheme/);
  });
});

describe('rollBackward', () => {
  const base = { scheme: 'nhs-2015', anchorPence: 790_018, anchorOpeningYear: '2026-27', earnedByYear: NHS_EARNED };

  it('rebuilds every year back to 2022-23 from the anchor, newest first', () => {
    const r = rollBackward({ ...base, targetYear: '2022-23' });
    expect(r.chain.map((c) => [c.taxYear, c.openingPence, c.closingPence])).toEqual([
      ['2025-26', 644_770, 790_018],
      ['2024-25', 495_727, 644_770],
      ['2023-24', 364_764, 495_727],
      ['2022-23', 280_982, 364_764],
    ]);
    expect(r.openingPence).toBe(280_982);
    expect(r.closingPence).toBe(364_764);
    const within = (pia, pounds) => expect(Math.abs(pia - pounds * 100)).toBeLessThan(100);
    within(r.chain[0].piaPence, 21486);
    within(r.chain[1].piaPence, 18533);
    within(r.chain[2].piaPence, 15060);
    within(r.chain[3].piaPence, 12012);
    expect(r.chain[0].earnedPence).toBe(124_615);
  });

  it('stops one year back when that is the target', () => {
    const r = rollBackward({ ...base, targetYear: '2025-26' });
    expect(r.chain).toHaveLength(1);
    expect(r.openingPence).toBe(644_770);
  });

  it('returns null before 2022-23, at or after the anchor year, on a missing pension-earned row, or a missing CPI', () => {
    expect(rollBackward({ ...base, targetYear: '2021-22' })).toBe(null);
    expect(rollBackward({ ...base, targetYear: '2026-27' })).toBe(null);
    expect(rollBackward({ ...base, targetYear: '2027-28' })).toBe(null);
    const { '2024-25': _gap, ...withGap } = NHS_EARNED;
    expect(rollBackward({ ...base, earnedByYear: withGap, targetYear: '2023-24' })).toBe(null);
    expect(rollBackward({ ...base, earnedByYear: withGap, targetYear: '2025-26' })).not.toBe(null);
    const { '2024-25': _cpi, ...cpiGap } = SEPTEMBER_CPI;
    expect(rollBackward({ ...base, cpiByYear: cpiGap, targetYear: '2023-24' })).toBe(null);
    expect(rollBackward({ ...base, scheme: 'uss', targetYear: '2025-26' })).toBe(null);
  });
});

describe('buildPensionYear', () => {
  const anchor = { pence: 280_982, date: '2022-03-31', openingYear: '2022-23' };

  it('estimates every year in the window from the anchor and matches the TRS PIAs within 1', () => {
    const y = buildPensionYear({ taxYear: '2025-26', scheme: 'nhs-2015', anchor, rows: [], earningsByYear: NHS_EARNINGS, sippGrossByYear: {} });
    expect(y.years.map((r) => r.taxYear)).toEqual(['2022-23', '2023-24', '2024-25', '2025-26']);
    expect(y.years.map((r) => r.piaSource)).toEqual(['estimate', 'estimate', 'estimate', 'estimate']);
    const within = (pia, pounds) => expect(Math.abs(pia - pounds * 100)).toBeLessThan(100);
    within(y.years[0].piaPence, 12_012);
    within(y.years[1].piaPence, 15_060);
    within(y.years[2].piaPence, 18_533);
    within(y.years[3].piaPence, 21_486);
    expect(y.years[0].allowancePence).toBe(4_000_000);
    expect(y.years[1].allowancePence).toBe(6_000_000);
    expect(y.cpiMissing).toEqual([]);
  });

  it('an entered figure beats the estimate, and the estimate stays for reference', () => {
    const rows = [{ taxYear: '2025-26', piaPence: 2_148_600, pensionableEarningsPence: null, note: '' }];
    const y = buildPensionYear({ taxYear: '2025-26', scheme: 'nhs-2015', anchor, rows, earningsByYear: NHS_EARNINGS, sippGrossByYear: {} });
    expect(y.current.piaSource).toBe('entered');
    expect(y.current.piaPence).toBe(2_148_600);
    expect(y.current.estimate.piaPence).toBeGreaterThan(0);
    expect(y.current.estimate.earningsSource).toBe('timeline');
  });

  it('reproduces the owner position 2026-27: 124921 pence carry-forward, headroom gross and net', () => {
    const rows = [
      { taxYear: '2023-24', piaPence: 1_506_000, pensionableEarningsPence: null, note: '' },
      { taxYear: '2024-25', piaPence: 1_853_300, pensionableEarningsPence: null, note: '' },
      { taxYear: '2025-26', piaPence: 2_148_600, pensionableEarningsPence: null, note: '' },
    ];
    const y = buildPensionYear({
      taxYear: '2026-27',
      scheme: 'nhs-2015',
      anchor: { pence: 790_018, date: '2026-03-31', openingYear: '2026-27' },
      rows,
      earningsByYear: { '2026-27': 7_000_000 },
      sippGrossByYear: { '2026-27': 500_000 },
    });
    expect(y.years.slice(0, 3).map((r) => r.unusedPence)).toEqual([4_494_000, 4_146_700, 3_851_400]);
    expect(y.carryForwardPence).toBe(12_492_100);
    expect(y.current.piaPence).toBe(2_263_678);
    expect(y.current.sippGrossPence).toBe(500_000);
    expect(y.current.usedPence).toBe(2_763_678);
    expect(y.totalAvailablePence).toBe(6_000_000 + 12_492_100);
    expect(y.headroomGrossPence).toBe(6_000_000 + 12_492_100 - 2_763_678);
    expect(y.headroomNetPence).toBe(Math.round(y.headroomGrossPence / 1.25));
    expect(y.over).toBe(false);
    expect(y.chargeablePence).toBe(0);
  });

  it('an excess eats carry-forward oldest first and reports what is left', () => {
    const rows = [
      { taxYear: '2023-24', piaPence: 5_000_000, pensionableEarningsPence: null, note: '' }, // 10k unused
      { taxYear: '2024-25', piaPence: 4_000_000, pensionableEarningsPence: null, note: '' }, // 20k unused
      { taxYear: '2025-26', piaPence: 6_500_000, pensionableEarningsPence: null, note: '' }, // over -> 0
      { taxYear: '2026-27', piaPence: 7_500_000, pensionableEarningsPence: null, note: '' }, // 15k over
    ];
    const y = buildPensionYear({ taxYear: '2026-27', scheme: 'nhs-2015', anchor: null, rows, earningsByYear: {}, sippGrossByYear: {} });
    expect(y.years.map((r) => r.carriedPence)).toEqual([1_000_000, 500_000, 0, 0]);
    expect(y.carryForwardPence).toBe(1_500_000);
    expect(y.headroomGrossPence).toBe(1_500_000);
    expect(y.over).toBe(false);
    const worse = buildPensionYear({ ...{ taxYear: '2026-27', scheme: 'nhs-2015', anchor: null, earningsByYear: {}, sippGrossByYear: {} }, rows: [...rows.slice(0, 3), { taxYear: '2026-27', piaPence: 10_000_000, pensionableEarningsPence: null, note: '' }] });
    expect(worse.over).toBe(true);
    expect(worse.chargeablePence).toBe(4_000_000 - 3_000_000);
    expect(worse.headroomGrossPence).toBe(0);
  });

  it('a scheme member year with no entered figure and no estimate contributes nothing', () => {
    const y = buildPensionYear({ taxYear: '2026-27', scheme: 'nhs-2015', anchor: { pence: 790_018, date: '2026-03-31', openingYear: '2026-27' }, rows: [], earningsByYear: { '2026-27': 7_000_000 }, sippGrossByYear: {} });
    expect(y.years.slice(0, 3).map((r) => r.piaSource)).toEqual(['none', 'none', 'none']);
    expect(y.years.slice(0, 3).map((r) => r.unusedPence)).toEqual([0, 0, 0]);
    expect(y.carryForwardPence).toBe(0);
    expect(y.current.piaSource).toBe('estimate');
  });

  it('a person with no scheme is tracked on SIPP alone, with full carry-forward', () => {
    const y = buildPensionYear({ taxYear: '2026-27', scheme: null, anchor: null, rows: [], earningsByYear: {}, sippGrossByYear: { '2025-26': 1_000_000, '2026-27': 250_000 } });
    expect(y.years.map((r) => r.piaSource)).toEqual(['none', 'none', 'none', 'none']);
    expect(y.years.map((r) => r.unusedPence)).toEqual([6_000_000, 6_000_000, 5_000_000, 5_750_000]);
    expect(y.carryForwardPence).toBe(17_000_000);
    expect(y.headroomGrossPence).toBe(17_000_000 + 5_750_000);
  });

  it('lists the years whose estimate was switched off by a missing CPI', () => {
    const y = buildPensionYear({ taxYear: '2028-29', scheme: 'nhs-2015', anchor: { pence: 790_018, date: '2026-03-31', openingYear: '2026-27' }, rows: [], earningsByYear: {}, sippGrossByYear: {} });
    expect(y.years.map((r) => r.piaSource)).toEqual(['none', 'estimate', 'none', 'none']);
    expect(y.cpiMissing).toEqual(['2027-28', '2028-29']);
  });

  it('an anchor before 2022-23 produces no estimate anywhere, and is not a CPI gap', () => {
    const y = buildPensionYear({
      taxYear: '2026-27',
      scheme: 'nhs-2015',
      anchor: { pence: 100_000, date: '2021-03-31', openingYear: '2021-22' },
      rows: [],
      earningsByYear: {},
      sippGrossByYear: {},
    });
    expect(y.years.map((r) => r.piaSource)).toEqual(['none', 'none', 'none', 'none']);
    expect(y.cpiMissing).toEqual([]);
  });
});
