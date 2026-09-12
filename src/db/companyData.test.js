/**
 * Adapter test for the Company tab: write people and dividend events through
 * the REAL repositories (real Dexie over fake-indexeddb) and check the pounds
 * → pence edge, the company-year (1 Apr – 31 Mar) range read, and the CT
 * figures that come back.
 */
import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { peopleRepo, incomeEventsRepo } from './repositories.js';
import { gatherCompanyData, previewPersonalDraw } from './companyData.js';
import { computePersonTax, taxYearTable } from '../engine/tax.js';
import { gatherIncomeData } from './incomeData.js';

beforeEach(resetDb);

/** Add a dividend through the repo (pounds at the edge). */
const addDividend = (personId, date, pounds, note = '') =>
  incomeEventsRepo.add({ personId, date, kind: 'dividend', amountPence: pounds, note });

describe('gatherCompanyData', () => {
  it('returns an empty year with no people or dividends', async () => {
    const data = await gatherCompanyData('FY2026');
    expect(data.financialYear).toBe('FY2026');
    expect(data.tableYear).toBe('FY2026');
    expect(data.startDate).toBe('2026-04-01');
    expect(data.endDate).toBe('2027-03-31');
    expect(data.paymentDate).toBe('2028-01-01');
    expect(data.people).toEqual([]);
    expect(data.events).toEqual([]);
    expect(data.dividendPence).toBe(0);
    expect(data.ctPence).toBe(0);
  });

  it('pools both people, converts pounds to pence, and derives profit + CT', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    const b = await peopleRepo.add({ name: 'Wife' });
    await addDividend(a, '2026-05-01', 5400, 'Q1');
    await addDividend(b, '2026-06-01', 2700);

    const data = await gatherCompanyData('FY2026');
    expect(data.people).toEqual([
      { id: a, name: 'Anderson' },
      { id: b, name: 'Wife' },
    ]);
    expect(data.dividendPence).toBe(810_000);
    expect(data.profitPence).toBe(1_000_000);
    expect(data.ctPence).toBe(190_000);
    expect(data.events.map((e) => [e.personName, e.amountPence, e.note])).toEqual([
      ['Wife', 270_000, ''],
      ['Anderson', 540_000, 'Q1'],
    ]);
    expect(data.perPerson.map((p) => p.dividendPence)).toEqual([540_000, 270_000]);
  });

  it('only reads dividends inside the company year (1 Apr – 31 Mar)', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await addDividend(a, '2026-03-31', 1000); // last day of FY2025
    await addDividend(a, '2026-04-01', 10); // first day of FY2026
    await addDividend(a, '2027-03-31', 10); // last day of FY2026
    await addDividend(a, '2027-04-01', 1000); // first day of FY2027

    expect((await gatherCompanyData('FY2026')).dividendPence).toBe(2000);
    expect((await gatherCompanyData('FY2025')).dividendPence).toBe(100_000);
    expect((await gatherCompanyData('FY2027')).dividendPence).toBe(100_000);
  });

  it('ignores non-dividend income events', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await addDividend(a, '2026-05-01', 100);
    await incomeEventsRepo.add({ personId: a, date: '2026-05-02', kind: 'sipp-contribution', amountPence: 500 });
    await incomeEventsRepo.add({ personId: a, date: '2026-05-03', kind: 'other-income', amountPence: 500 });
    await incomeEventsRepo.add({ personId: a, date: '2026-05-04', kind: 'salary-adjustment', amountPence: -50 });

    const data = await gatherCompanyData('FY2026');
    expect(data.events).toHaveLength(1);
    expect(data.dividendPence).toBe(10_000);
  });

  it('flags a rate-table fallback for an unseeded year', async () => {
    const data = await gatherCompanyData('FY2020');
    expect(data.tableYear).toBe('FY2023');
  });
});

describe('previewPersonalDraw', () => {
  it('picks the PERSONAL tax year from the draw date and diffs the tax', async () => {
    // £30,000 salary keeps the draw inside the basic band with 40% headroom to spare.
    const a = await peopleRepo.add({ name: 'Anderson', annualSalaryPence: 30000 });
    await addDividend(a, '2026-05-01', 2000);

    const preview = await previewPersonalDraw({ personId: a, amountPence: 1_000_000, date: '2026-07-01' });
    expect(preview.taxYear).toBe('2026-27');
    expect(preview.name).toBe('Anderson');

    // Must equal a direct engine diff on the same year input.
    const income = await gatherIncomeData('2026-27');
    const person = income.people.find((p) => p.id === a);
    const { table } = taxYearTable('2026-27');
    const after = computePersonTax(
      { ...person.input, dividendPence: person.input.dividendPence + 1_000_000 },
      table
    );
    expect(preview.before.totalTaxPence).toBe(person.summary.totalTaxPence);
    expect(preview.after.totalTaxPence).toBe(after.totalTaxPence);
    expect(preview.extraTaxPence).toBe(after.totalTaxPence - person.summary.totalTaxPence);
    expect(preview.extraTaxPence).toBeGreaterThan(0);
    expect(preview.netInHandPence).toBe(1_000_000 - preview.extraTaxPence);
    expect(preview.after.headroomToHigherRatePence).toBeLessThan(
      preview.before.headroomToHigherRatePence
    );
  });

  it('uses the earlier tax year for a draw dated 1–5 April', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    const preview = await previewPersonalDraw({ personId: a, amountPence: 100, date: '2026-04-03' });
    expect(preview.taxYear).toBe('2025-26');
  });

  it('returns null for an unknown person', async () => {
    expect(await previewPersonalDraw({ personId: 999, amountPence: 100, date: '2026-07-01' })).toBe(null);
  });

  it('treats a junk amount as a draw of nothing, leaving the person unchanged', async () => {
    const a = await peopleRepo.add({ name: 'Anderson', annualSalaryPence: 30000 });
    await addDividend(a, '2026-05-01', 2000);
    const preview = await previewPersonalDraw({ personId: a, amountPence: 'abc', date: '2026-07-01' });
    expect(preview.extraTaxPence).toBe(0);
    expect(preview.netInHandPence).toBe(0);
    expect(preview.after.totalTaxPence).toBe(preview.before.totalTaxPence);
  });
});
