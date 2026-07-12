import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from './test-utils.js';
import { db } from './schema.js';
import {
  peopleRepo,
  incomeEventsRepo,
  salaryPeriodsRepo,
  payslipsRepo,
} from './repositories.js';
import { gatherIncomeData } from './incomeData.js';

beforeEach(resetDb);

describe('peopleRepo', () => {
  it('round-trips money fields pounds-at-edge / pence-at-rest', async () => {
    const id = await peopleRepo.add({
      name: 'Anderson',
      annualSalaryPence: 60000, // £60,000 at the pounds edge
      salarySacrificePence: 1200.5,
      pensionAnnualPence: 3000,
      benefitsInKindPence: 850.25,
      otherIncomePence: 100,
    });
    const raw = await db.people.get(id);
    expect(raw.annualSalaryPence).toBe(6000000); // pence at rest
    expect(raw.salarySacrificePence).toBe(120050);
    expect(raw.benefitsInKindPence).toBe(85025);

    const back = await peopleRepo.get(id);
    expect(back.annualSalaryPence).toBe(60000); // pounds again at the edge
    expect(back.salarySacrificePence).toBe(1200.5);
  });

  it('defaults every money field to 0', async () => {
    const id = await peopleRepo.add({ name: 'Wife' });
    const raw = await db.people.get(id);
    expect(raw.annualSalaryPence).toBe(0);
    expect(raw.salarySacrificePence).toBe(0);
    expect(raw.pensionAnnualPence).toBe(0);
    expect(raw.benefitsInKindPence).toBe(0);
    expect(raw.otherIncomePence).toBe(0);
  });

  it('deleting a person cascades to their income events only', async () => {
    const a = await peopleRepo.add({ name: 'A' });
    const b = await peopleRepo.add({ name: 'B' });
    await incomeEventsRepo.add({ personId: a, date: '2026-07-01', kind: 'dividend', amountPence: 100 });
    await incomeEventsRepo.add({ personId: b, date: '2026-07-01', kind: 'dividend', amountPence: 200 });

    await peopleRepo.delete(a);

    expect(await db.people.count()).toBe(1);
    const remaining = await db.incomeEvents.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].personId).toBe(b);
  });
});

describe('incomeEventsRepo', () => {
  it('rejects unknown kinds and malformed dates', async () => {
    await expect(
      incomeEventsRepo.add({ personId: 1, date: '2026-07-01', kind: 'bonus', amountPence: 1 })
    ).rejects.toThrow(/kind/);
    // 'other-income' is a valid kind (spec amendment (e)).
    await expect(
      incomeEventsRepo.add({ personId: 1, date: '2026-07-01', kind: 'other-income', amountPence: 1 })
    ).resolves.toBeDefined();
    await expect(
      incomeEventsRepo.add({ personId: 1, date: '01/07/2026', kind: 'dividend', amountPence: 1 })
    ).rejects.toThrow(/ISO/);
  });

  it('between() is inclusive of both tax-year bounds', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    for (const date of ['2026-04-05', '2026-04-06', '2026-12-25', '2027-04-05', '2027-04-06']) {
      await incomeEventsRepo.add({ personId: p, date, kind: 'dividend', amountPence: 10 });
    }
    const rows = await incomeEventsRepo.between('2026-04-06', '2027-04-05');
    expect(rows.map((r) => r.date).sort()).toEqual(['2026-04-06', '2026-12-25', '2027-04-05']);
  });
});

describe('gatherIncomeData', () => {
  it('assembles per-person pence inputs and tax summaries for the year', async () => {
    const p = await peopleRepo.add({
      name: 'Anderson',
      annualSalaryPence: 60000, // £60k (pounds edge)
    });
    await incomeEventsRepo.add({ personId: p, date: '2026-06-01', kind: 'dividend', amountPence: 4000 });
    await incomeEventsRepo.add({ personId: p, date: '2026-08-01', kind: 'dividend', amountPence: 6000 });
    // Outside the 2026-27 tax year — must be ignored.
    await incomeEventsRepo.add({ personId: p, date: '2026-04-01', kind: 'dividend', amountPence: 9999 });

    const data = await gatherIncomeData('2026-27');
    expect(data.tableYear).toBe('2026-27');
    expect(data.people).toHaveLength(1);

    const person = data.people[0];
    expect(person.events).toHaveLength(2);
    expect(person.events[0].date).toBe('2026-08-01'); // newest first
    expect(person.input.nonDividendPence).toBe(6000000);
    expect(person.input.dividendPence).toBe(1000000);
    // £60k salary + £10k dividends, 2026-27: PAYE £11,432, dividends £3,396.25.
    expect(person.summary.nonDividendTaxPence).toBe(1143200);
    expect(person.summary.dividendTaxPence).toBe(339625);
  });

  it('other-income events flow through to the Self Assessment split', async () => {
    const p = await peopleRepo.add({ name: 'Anderson', annualSalaryPence: 60000 });
    await incomeEventsRepo.add({
      personId: p,
      date: '2026-06-15',
      kind: 'other-income',
      amountPence: 5000, // £5,000 consultancy fee (pounds edge)
    });

    const data = await gatherIncomeData('2026-27');
    const person = data.people[0];
    expect(person.input.otherEventTotalPence).toBe(500000);
    expect(person.input.nonDividendPence).toBe(6500000);
    // The fee's £2,000 of 40% tax is Self Assessment, not PAYE.
    expect(person.summary.payeTaxPence).toBe(1143200);
    expect(person.summary.otherIncomeTaxPence).toBe(200000);
    expect(person.summary.selfAssessmentTaxPence).toBe(200000);
  });

  it('flags the rate-table fallback for future years', async () => {
    const data = await gatherIncomeData('2031-32');
    expect(data.taxYear).toBe('2031-32');
    expect(data.tableYear).toBe('2026-27');
    expect(data.startDate).toBe('2031-04-06');
    expect(data.endDate).toBe('2032-04-05');
  });

  it('a person with no salary periods falls back to their annual fields', async () => {
    // Pre-v5 shape (e.g. a restored old backup): annual figures, no periods.
    await peopleRepo.add({ name: 'Wife', annualSalaryPence: 50000, salarySacrificePence: 8000 });

    const data = await gatherIncomeData('2026-27');
    const person = data.people[0];
    expect(person.usingLegacySalary).toBe(true);
    expect(person.monthly).toHaveLength(12);
    expect(person.monthly.every((r) => r.source === 'projected')).toBe(true);
    expect(person.input.salaryPence).toBe(4200000); // £50k − £8k sacrifice
  });

  it('salary periods drive the projection; a mid-year change is pro-rated', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 60000 });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '2026-09-01', annualSalaryPence: 48000 }); // LTFT

    const data = await gatherIncomeData('2026-27');
    const person = data.people[0];
    expect(person.usingLegacySalary).toBe(false);
    // 5 months at £5,000 + 7 months at £4,000 = £53,000.
    expect(person.input.salaryPence).toBe(5300000);
    expect(person.monthly[4].taxablePence).toBe(500000); // Aug
    expect(person.monthly[5].taxablePence).toBe(400000); // Sep
  });

  it('an entered payslip overrides its month and feeds the PAYE check', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 60000 });
    // April actual: £5,200 gross, £200 pension, £900 tax deducted.
    await payslipsRepo.upsert(p, { month: '2026-04', grossPence: 5200, pensionPence: 200, taxPaidPence: 900 });

    // Fixed "today" mid-tax-year makes the actual/planned boundary deterministic.
    const data = await gatherIncomeData('2026-27', '2026-04-30');
    const person = data.people[0];
    const april = person.monthly[0];
    expect(april.taxablePence).toBe(500000); // gross − pension
    expect(april.source).toBe('actual');
    // 11 projected months at £5,000 + the £5,000 actual = £60,000.
    expect(person.input.salaryPence).toBe(6000000);
    expect(person.payeCheck).toMatchObject({ months: 1, paidPence: 90000, complete: true });
  });

  it('a payslip after the injected today is planned, not actual', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 60000 });
    await payslipsRepo.upsert(p, { month: '2026-11', grossPence: 9000, taxPaidPence: 0 }); // pencilled bonus

    const data = await gatherIncomeData('2026-27', '2026-04-30');
    const person = data.people[0];
    expect(person.monthly[7].source).toBe('planned'); // Nov
    expect(person.payeCheck).toBeNull(); // no actual payslips yet
  });

  it('payrolled BIK flows from periods and payslips into taxable pay', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    // £60k salary sacrificing £7,200 for a car with a £1,881/yr payrolled BIK
    // → projected months (60000 − 7200 + 1881) / 12 = £4,556.75.
    await salaryPeriodsRepo.add({
      personId: p,
      effectiveFrom: '1900-01-01',
      annualSalaryPence: 60000,
      salarySacrificePence: 7200,
      bikAnnualPence: 1881,
    });
    // April actual — the owner's real payslip: taxable = gross − pension + BIK.
    await payslipsRepo.upsert(p, {
      month: '2026-04',
      grossPence: 5607.69,
      pensionPence: 600.02,
      bikPence: 156.75,
      taxPaidPence: 1018.06,
    });

    const data = await gatherIncomeData('2026-27', '2026-04-30');
    const person = data.people[0];
    expect(person.monthly[0].taxablePence).toBe(516442); // £5,164.42
    expect(person.monthly[1].taxablePence).toBe(455675); // projected May
    // The PAYE check's YTD taxable includes the BIK, so the tax deducted on
    // it no longer reads as an overpayment.
    expect(person.payeCheck.taxableYtdPence).toBe(516442);
  });

  it('payslipsRepo.upsert keeps one payslip per person-month', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    await payslipsRepo.upsert(p, { month: '2026-04', grossPence: 5000 });
    await payslipsRepo.upsert(p, { month: '2026-04', grossPence: 5500 });
    const rows = await db.payslips.where('personId').equals(p).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].grossPence).toBe(550000); // pence at rest, latest value
  });
});
