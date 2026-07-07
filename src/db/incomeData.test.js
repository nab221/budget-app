import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from './test-utils.js';
import { db } from './schema.js';
import { peopleRepo, incomeEventsRepo } from './repositories.js';
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

  it('flags the rate-table fallback for future years', async () => {
    const data = await gatherIncomeData('2031-32');
    expect(data.taxYear).toBe('2031-32');
    expect(data.tableYear).toBe('2026-27');
    expect(data.startDate).toBe('2031-04-06');
    expect(data.endDate).toBe('2032-04-05');
  });
});
