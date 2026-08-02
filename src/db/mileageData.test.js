/**
 * Adapter test for the mileage tracker: write trips through the REAL
 * mileageTripsRepo (real Dexie over fake-indexeddb) and check the pounds →
 * pence edge, the tax-year range read, and the claim figures that come back.
 */
import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { mileageTripsRepo } from './repositories.js';
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
    expect(thisYear.byVehicle[0].milesToThreshold).toBe(0);

    const nextYear = await gatherMileageData('2027-28', '2026-08-02');
    // Fresh allowance: 100 miles at the full 45p.
    expect(nextYear.totals.allowancePence).toBe(4500);
    expect(nextYear.byVehicle[0].milesToThreshold).toBe(9900);
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

  it('defaults an unspecified vehicle and reimbursement', async () => {
    const id = await mileageTripsRepo.add({ date: '2026-05-01', miles: 10 });
    const row = await mileageTripsRepo.get(id);
    expect(row.vehicle).toBe('car');
    expect(row.reimbursedPence).toBe(0);
    expect(row.purpose).toBe('');
  });

  it('reads a date range oldest first', async () => {
    await addTrip('2026-06-01', 10);
    await addTrip('2026-05-01', 10);
    const rows = await mileageTripsRepo.between('2026-04-06', '2027-04-05');
    expect(rows.map((r) => r.date)).toEqual(['2026-05-01', '2026-06-01']);
  });
});
