import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from './test-utils.js';
import { db, TABLE_NAMES } from './schema.js';
import { peopleRepo, pensionYearsRepo } from './repositories.js';

beforeEach(resetDb);

describe('peopleRepo pension fields', () => {
  it('defaults to no scheme and no anchor', async () => {
    const id = await peopleRepo.add({ name: 'A' });
    expect(await db.people.get(id)).toMatchObject({ pensionScheme: '', pensionAnchorPence: 0, pensionAnchorDate: '' });
  });

  it('stores the anchor as pence and reads it back as pounds', async () => {
    const id = await peopleRepo.add({ name: 'A', pensionScheme: 'nhs-2015', pensionAnchorPence: 7900.18, pensionAnchorDate: '2026-03-31' });
    expect((await db.people.get(id)).pensionAnchorPence).toBe(790018);
    expect(await peopleRepo.get(id)).toMatchObject({ pensionScheme: 'nhs-2015', pensionAnchorPence: 7900.18, pensionAnchorDate: '2026-03-31' });
  });

  it('rejects an unknown scheme or a non-ISO anchor date', async () => {
    await expect(peopleRepo.add({ name: 'A', pensionScheme: 'uss' })).rejects.toThrow(/pensionScheme/);
    await expect(peopleRepo.add({ name: 'A', pensionAnchorDate: '31/03/2026' })).rejects.toThrow(/pensionAnchorDate/);
  });
});

describe('pensionYearsRepo', () => {
  it('is in the backup table list', () => {
    expect(TABLE_NAMES).toContain('pensionYears');
  });

  it('round-trips pounds at the edge and keeps nulls as nulls', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    const id = await pensionYearsRepo.add({ personId: p, taxYear: '2025-26', piaPence: 21486, pensionableEarningsPence: null, note: 'TRS' });
    expect(await db.pensionYears.get(id)).toMatchObject({ piaPence: 2148600, pensionableEarningsPence: null, note: 'TRS' });
    expect(await pensionYearsRepo.get(id)).toMatchObject({ piaPence: 21486, pensionableEarningsPence: null });
  });

  it('defaults both figures to null (use the estimate / the timeline)', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    const id = await pensionYearsRepo.add({ personId: p, taxYear: '2025-26' });
    expect(await db.pensionYears.get(id)).toMatchObject({ piaPence: null, pensionableEarningsPence: null, note: '' });
  });

  it('validates the tax-year label and non-negative figures', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    await expect(pensionYearsRepo.add({ personId: p, taxYear: '2025/26' })).rejects.toThrow(/taxYear/);
    await expect(pensionYearsRepo.add({ personId: p, taxYear: '2025-26', piaPence: -1 })).rejects.toThrow(/piaPence/);
    await expect(pensionYearsRepo.add({ taxYear: '2025-26' })).rejects.toThrow(/personId/);
  });

  it('upserts one row per person-year and lists a person’s rows oldest first', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    await pensionYearsRepo.upsert(p, '2025-26', { piaPence: 21486 });
    await pensionYearsRepo.upsert(p, '2025-26', { piaPence: 21500, note: 'PSS' });
    await pensionYearsRepo.upsert(p, '2023-24', { piaPence: 15060 });
    const rows = await pensionYearsRepo.forPerson(p);
    expect(rows.map((r) => [r.taxYear, r.piaPence, r.note])).toEqual([
      ['2023-24', 15060, ''],
      ['2025-26', 21500, 'PSS'],
    ]);
  });

  it('deleting a person removes their pension years', async () => {
    const a = await peopleRepo.add({ name: 'A' });
    const b = await peopleRepo.add({ name: 'B' });
    await pensionYearsRepo.upsert(a, '2025-26', { piaPence: 1 });
    await pensionYearsRepo.upsert(b, '2025-26', { piaPence: 2 });
    await peopleRepo.delete(a);
    expect(await db.pensionYears.count()).toBe(1);
    expect((await db.pensionYears.toArray())[0].personId).toBe(b);
  });

  it('stores pensionEarnedPence as pence, reads it back as pounds, keeps null, rejects negatives', async () => {
    const p = await peopleRepo.add({ name: 'A' });
    const id = await pensionYearsRepo.add({ personId: p, taxYear: '2025-26', pensionEarnedPence: 1246.15 });
    expect(await db.pensionYears.get(id)).toMatchObject({ pensionEarnedPence: 124615, piaPence: null, pensionableEarningsPence: null });
    expect(await pensionYearsRepo.get(id)).toMatchObject({ pensionEarnedPence: 1246.15 });

    const bare = await pensionYearsRepo.add({ personId: p, taxYear: '2024-25' });
    expect((await db.pensionYears.get(bare)).pensionEarnedPence).toBe(null);

    await pensionYearsRepo.upsert(p, '2025-26', { pensionEarnedPence: null });
    expect((await db.pensionYears.get(id)).pensionEarnedPence).toBe(null);

    await expect(pensionYearsRepo.add({ personId: p, taxYear: '2023-24', pensionEarnedPence: -1 })).rejects.toThrow(/pensionEarnedPence/);
  });
});
