/**
 * Adapter test for the Pension tab: write people, salary periods, pension
 * years and SIPP events through the REAL repositories (real Dexie over
 * fake-indexeddb) and check the pounds → pence edge, the four-year SIPP
 * window, the earnings override, and the figures that come back.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from './test-utils.js';
import { db } from './schema.js';
import { peopleRepo, salaryPeriodsRepo, incomeEventsRepo, pensionYearsRepo } from './repositories.js';
import { gatherPensionData } from './pensionData.js';
import { gatherIncomeData } from './incomeData.js';

beforeEach(resetDb);

const sipp = (personId, date, pounds) =>
  incomeEventsRepo.add({ personId, date, kind: 'sipp-contribution', amountPence: pounds });

describe('gatherPensionData', () => {
  it('returns no people on an empty database', async () => {
    expect(await gatherPensionData('2026-27')).toEqual({ taxYear: '2026-27', people: [] });
  });

  it('builds the owner’s 2026-27 position from the anchor, entered years and timeline salary', async () => {
    const p = await peopleRepo.add({
      name: 'Anderson',
      pensionScheme: 'nhs-2015',
      pensionAnchorPence: 7900.18,
      pensionAnchorDate: '2026-03-31',
    });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 70000 });
    await pensionYearsRepo.upsert(p, '2023-24', { piaPence: 15060 });
    await pensionYearsRepo.upsert(p, '2024-25', { piaPence: 18533 });
    await pensionYearsRepo.upsert(p, '2025-26', { piaPence: 21486 });
    await sipp(p, '2026-06-15', 4000); // £5,000 gross

    const { people } = await gatherPensionData('2026-27');
    const me = people[0];
    expect(me).toMatchObject({ id: p, name: 'Anderson', scheme: 'nhs-2015' });
    expect(me.anchor).toEqual({ pence: 790018, date: '2026-03-31', openingYear: '2026-27' });
    expect(me.earningsByYear['2026-27']).toBe(7_000_000);
    expect(me.years.map((y) => y.piaSource)).toEqual(['entered', 'entered', 'entered', 'estimate']);
    expect(me.current.piaPence).toBe(2_263_678);
    expect(me.current.sippGrossPence).toBe(500_000);
    expect(me.carryForwardPence).toBe(12_492_100);
    expect(me.headroomGrossPence).toBe(6_000_000 + 12_492_100 - 2_263_678 - 500_000);
  });

  it('counts SIPP events in the tax year of their date across the window, plus the annual personal pension every year', async () => {
    const p = await peopleRepo.add({ name: 'A', pensionAnnualPence: 1200 }); // £1,200 gross, every year
    await sipp(p, '2023-04-05', 800); // 2022-23 — outside the window
    await sipp(p, '2023-04-06', 800); // 2023-24
    await sipp(p, '2026-04-05', 400); // 2025-26
    await sipp(p, '2027-04-05', 400); // 2026-27 (last day)
    await sipp(p, '2027-04-06', 999); // 2027-28 — outside

    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.years.map((y) => y.sippGrossPence)).toEqual([
      120_000 + 100_000,
      120_000,
      120_000 + 50_000,
      120_000 + 50_000,
    ]);
  });

  it('an earnings override replaces the timeline figure for that year only', async () => {
    const p = await peopleRepo.add({ name: 'A', pensionScheme: 'lgps-2014', pensionAnchorPence: 5000, pensionAnchorDate: '2025-03-31' });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 40000 });
    await pensionYearsRepo.upsert(p, '2025-26', { pensionableEarningsPence: 38000 });

    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.earningsByYear['2025-26']).toBe(3_800_000);
    expect(me.earningsByYear['2026-27']).toBe(4_000_000);
    const y25 = me.years.find((y) => y.taxYear === '2025-26');
    expect(y25.estimate.earningsSource).toBe('override');
    expect(y25.estimate.earningsPence).toBe(3_800_000);
    expect(me.current.estimate.earningsSource).toBe('timeline');
  });

  it('falls back to the legacy annual salary when a person has no salary periods', async () => {
    const p = await peopleRepo.add({ name: 'A', annualSalaryPence: 60000, pensionScheme: 'nhs-2015', pensionAnchorPence: 1000, pensionAnchorDate: '2026-03-31' });
    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.earningsByYear['2026-27']).toBe(6_000_000);
  });

  it('a person without a scheme (or without an anchor) has no estimate and is tracked on SIPP alone', async () => {
    const p = await peopleRepo.add({ name: 'Wife' });
    await sipp(p, '2026-06-01', 800);
    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.scheme).toBe(null);
    expect(me.anchor).toBe(null);
    expect(me.current).toMatchObject({ piaSource: 'none', sippGrossPence: 100_000, usedPence: 100_000 });
    expect(me.carryForwardPence).toBe(18_000_000);
  });

  it('grosses up SIPP once per year, summing net pence before rounding (matches tax.js)', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    await sipp(p, '2026-04-10', 10.01);
    await sipp(p, '2026-05-10', 10.01);

    const me = (await gatherPensionData('2026-27')).people[0];
    expect(me.current.sippGrossPence).toBe(2503);
    const income = await gatherIncomeData('2026-27');
    expect(income.people[0].input.sippGrossPence).toBe(2503);
  });

  it('a pre-v8 person row with no pension fields is tracked as SIPP-only', async () => {
    const id = await db.people.add({ name: 'Legacy', annualSalaryPence: 6_000_000 }); // raw row, no pension fields
    const me = (await gatherPensionData('2026-27')).people.find((p) => p.id === id);
    expect(me.scheme).toBe(null);
    expect(me.anchor).toBe(null);
    expect(me.current.piaSource).toBe('none');
    expect(me.earningsByYear['2026-27']).toBe(6_000_000);
  });
});

describe('gatherIncomeData exposes entry.pension', () => {
  it('carries the same person object and drops the retired allowance field', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    await sipp(p, '2026-06-15', 800);
    const income = await gatherIncomeData('2026-27');
    const pension = await gatherPensionData('2026-27');
    expect(income.people[0].pensionAllowance).toBeUndefined();
    expect(income.people[0].pension.current.usedPence).toBe(100_000);
    expect(income.people[0].pension.headroomGrossPence).toBe(pension.people[0].headroomGrossPence);
    expect(income.people[0].pension.id).toBe(p);
  });
});
