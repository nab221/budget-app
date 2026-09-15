import { describe, it, expect } from 'vitest';
import {
  SCHEMES,
  SEPTEMBER_CPI,
  cpiForYear,
  annualAllowanceForYear,
  anchorOpeningYear,
  estimatePia,
} from './pension.js';

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
  it('is £40,000 before 2023-24 and the tax table from then on', () => {
    expect(annualAllowanceForYear('2022-23')).toEqual({ allowancePence: 4_000_000, fromTable: false });
    expect(annualAllowanceForYear('2023-24')).toEqual({ allowancePence: 6_000_000, fromTable: false });
    expect(annualAllowanceForYear('2026-27')).toEqual({ allowancePence: 6_000_000, fromTable: true });
    expect(annualAllowanceForYear('2035-36')).toEqual({ allowancePence: 6_000_000, fromTable: false });
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

  it('never goes negative and treats junk as zero', () => {
    const est = estimatePia({ scheme: 'lgps-2014', openingPence: 'x', cpi: 0.02, earningsPence: null });
    expect(est).toEqual({ closingPence: 0, upratedOpeningPence: 0, piaPence: 0 });
  });

  it('rejects an unknown scheme', () => {
    expect(() => estimatePia({ scheme: 'usс', openingPence: 0, cpi: 0, earningsPence: 0 })).toThrow(/scheme/);
  });
});
