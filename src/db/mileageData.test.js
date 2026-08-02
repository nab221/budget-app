/**
 * Adapter test for the mileage tracker: write trips through the REAL
 * mileageTripsRepo (real Dexie over fake-indexeddb) and check the pounds →
 * pence edge, the tax-year range read, and the claim figures that come back.
 */
import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { mileageTripsRepo, employersRepo } from './repositories.js';
import { settings } from './settings.js';
import { gatherMileageData } from './mileageData.js';

beforeEach(resetDb);

/** Add a trip through the repo (pounds at the edge). */
const addTrip = (date, miles, extra = {}) =>
  mileageTripsRepo.add({ date, miles, vehicle: 'car', purpose: 'Client visit', ...extra });

describe('gatherMileageData', () => {
  it('returns an empty year with no trips', async () => {
    const data = await gatherMileageData('2026-27', '2026-08-02');
    expect(data.trips).toEqual([]);
    expect(data.totals.allowancePence).toBe(0);
    expect(data.reliefPence).toBe(0);
    expect(data.startDate).toBe('2026-04-06');
    expect(data.endDate).toBe('2027-04-05');
    expect(data.inProgress).toBe(true);
  });

  it('prices trips at 45p and values the claim at the marginal rate', async () => {
    await addTrip('2026-05-01', 100);
    await addTrip('2026-06-01', 40);

    const data = await gatherMileageData('2026-27', '2026-08-02');
    expect(data.totals.miles).toBe(140);
    expect(data.totals.allowancePence).toBe(6300); // 140 × 45p
    expect(data.totals.shortfallPence).toBe(6300); // nothing reimbursed
    // Default marginal rate is 40%.
    expect(data.marginalRate).toBe(0.4);
    expect(data.reliefPence).toBe(2520);
  });

  it('converts the pounds-at-edge reimbursement to pence', async () => {
    // £25.00 paid on a 100-mile trip worth £45.00 → £20.00 to claim.
    await addTrip('2026-05-01', 100, { reimbursedPence: 25 });

    const data = await gatherMileageData('2026-27', '2026-08-02');
    expect(data.totals.reimbursedPence).toBe(2500);
    expect(data.totals.shortfallPence).toBe(2000);
    expect(data.reliefPence).toBe(800);
  });

  it('only reads trips inside the tax year', async () => {
    await addTrip('2026-04-05', 100); // last day of 2025-26
    await addTrip('2026-04-06', 10); // first day of 2026-27
    await addTrip('2027-04-05', 10); // last day of 2026-27
    await addTrip('2027-04-06', 100); // first day of 2027-28

    const data = await gatherMileageData('2026-27', '2026-08-02');
    expect(data.totals.miles).toBe(20);
    const prior = await gatherMileageData('2025-26', '2026-08-02');
    expect(prior.totals.miles).toBe(100);
  });

  it('gives each tax year its own 10,000-mile allowance', async () => {
    await addTrip('2026-05-01', 10000);
    await addTrip('2027-05-01', 100); // next tax year

    const thisYear = await gatherMileageData('2026-27', '2026-08-02');
    expect(thisYear.byGroup[0].milesToThreshold).toBe(0);

    const nextYear = await gatherMileageData('2027-28', '2026-08-02');
    // Fresh allowance: 100 miles at the full 45p.
    expect(nextYear.totals.allowancePence).toBe(4500);
    expect(nextYear.byGroup[0].milesToThreshold).toBe(9900);
    expect(nextYear.inProgress).toBe(false);
  });

  it('honours a changed marginal rate', async () => {
    await addTrip('2026-05-01', 100);
    await settings.setMileageMarginalRate(0.2);

    const data = await gatherMileageData('2026-27', '2026-08-02');
    expect(data.reliefPence).toBe(900); // £45 × 20%
  });

  it('surfaces the employer rate for the trip form to pre-fill from', async () => {
    await settings.setMileageEmployerRatePence(25);
    const data = await gatherMileageData('2026-27', '2026-08-02');
    expect(data.employerRatePence).toBe(25);
  });

  it('flags a claim over £2,500 as needing Self Assessment', async () => {
    await addTrip('2026-05-01', 6000); // £2,700 at 45p

    const data = await gatherMileageData('2026-27', '2026-08-02');
    expect(data.totals.shortfallPence).toBe(270000);
    expect(data.route).toBe('self-assessment');
  });

  it('falls back to the newest rate table for a year with no published rates', async () => {
    await addTrip('2030-05-01', 100);

    const data = await gatherMileageData('2030-31', '2026-08-02');
    // The banner in Mileage.jsx keys off tableYear !== taxYear.
    expect(data.taxYear).toBe('2030-31');
    expect(data.tableYear).toBe('2026-27');
    expect(data.totals.allowancePence).toBe(4500); // priced at the 2026-27 45p
  });

  it('gives each employer its own 10,000-mile allowance', async () => {
    const acme = await employersRepo.add({ name: 'Acme', ratePencePerMile: 25 });
    const beta = await employersRepo.add({ name: 'Beta', ratePencePerMile: 0 });
    await addTrip('2026-05-01', 10000, { employerId: acme });
    await addTrip('2026-05-02', 100, { employerId: beta });

    const data = await gatherMileageData('2026-27', '2026-08-02');
    const byName = Object.fromEntries(data.byGroup.map((g) => [g.employerName, g]));
    expect(byName.Acme.milesToThreshold).toBe(0);
    // Beta starts fresh, so its 100 miles are all at 45p.
    expect(byName.Beta.allowancePence).toBe(4500);
    expect(byName.Beta.milesToThreshold).toBe(9900);
    expect(data.totals.employerCount).toBe(2);
  });

  it('exposes employers in name order with their pence-per-mile rate', async () => {
    await employersRepo.add({ name: 'Zenith', ratePencePerMile: 20 });
    await employersRepo.add({ name: 'Acme', ratePencePerMile: 25 });

    const data = await gatherMileageData('2026-27', '2026-08-02');
    expect(data.employers.map((e) => e.name)).toEqual(['Acme', 'Zenith']);
    // A rate is pence PER MILE, so it is stored raw — not pounds at the edge.
    expect(data.employers[0].ratePencePerMile).toBe(25);
  });
});

describe('employersRepo', () => {
  it('requires a name and a whole, non-negative pence-per-mile rate', async () => {
    await expect(employersRepo.add({ name: '  ' })).rejects.toThrow(/name is required/);
    await expect(employersRepo.add({ name: 'A', ratePencePerMile: -1 })).rejects.toThrow(
      /pence per mile/
    );
    await expect(employersRepo.add({ name: 'A', ratePencePerMile: 12.5 })).rejects.toThrow(
      /pence per mile/
    );
  });

  it('unassigns its trips on delete rather than deleting them', async () => {
    const acme = await employersRepo.add({ name: 'Acme', ratePencePerMile: 25 });
    const other = await employersRepo.add({ name: 'Beta', ratePencePerMile: 0 });
    await addTrip('2026-05-01', 100, { employerId: acme });
    await addTrip('2026-05-02', 50, { employerId: other });

    await employersRepo.delete(acme);

    const data = await gatherMileageData('2026-27', '2026-08-02');
    expect(data.employers.map((e) => e.name)).toEqual(['Beta']);
    // Both journeys survive; the orphaned one claims as its own employment.
    expect(data.totals.miles).toBe(150);
    const orphan = data.trips.find((t) => t.miles === 100);
    expect(orphan.employerId).toBeNull();
    expect(data.byGroup.find((g) => g.employerId === null).allowancePence).toBe(4500);
  });
});

describe('mileageTripsRepo', () => {
  it('rejects a bad vehicle, bad date, and non-positive miles', async () => {
    await expect(addTrip('2026-05-01', 10, { vehicle: 'hovercraft' })).rejects.toThrow(/vehicle/);
    await expect(addTrip('01/05/2026', 10)).rejects.toThrow(/ISO/);
    await expect(addTrip('2026-05-01', 0)).rejects.toThrow(/positive/);
    await expect(addTrip('2026-05-01', -5)).rejects.toThrow(/positive/);
  });

  it('rejects a negative reimbursement', async () => {
    await expect(addTrip('2026-05-01', 10, { reimbursedPence: -1 })).rejects.toThrow(/negative/);
  });

  it('defaults an unspecified vehicle, reimbursement, and employer', async () => {
    const id = await mileageTripsRepo.add({ date: '2026-05-01', miles: 10 });
    const row = await mileageTripsRepo.get(id);
    expect(row.vehicle).toBe('car');
    expect(row.reimbursedPence).toBe(0);
    expect(row.purpose).toBe('');
    expect(row.employerId).toBeNull();
  });

  it('requires a date and miles on add, but allows a partial update', async () => {
    // An undefined date drops out of the index every tax-year read uses.
    await expect(mileageTripsRepo.add({ miles: 10 })).rejects.toThrow(/date is required/);
    await expect(mileageTripsRepo.add({ date: '2026-05-01' })).rejects.toThrow(/miles is required/);

    const id = await addTrip('2026-05-01', 10);
    await mileageTripsRepo.update(id, { purpose: 'Renamed' });
    expect((await mileageTripsRepo.get(id)).date).toBe('2026-05-01');
  });

  it('rejects a non-integer employerId but accepts null', async () => {
    await expect(addTrip('2026-05-01', 10, { employerId: 'acme' })).rejects.toThrow(/employerId/);
    const id = await addTrip('2026-05-01', 10, { employerId: null });
    expect((await mileageTripsRepo.get(id)).employerId).toBeNull();
  });

  it('reads a date range oldest first', async () => {
    await addTrip('2026-06-01', 10);
    await addTrip('2026-05-01', 10);
    const rows = await mileageTripsRepo.between('2026-04-06', '2027-04-05');
    expect(rows.map((r) => r.date)).toEqual(['2026-05-01', '2026-06-01']);
  });
});
