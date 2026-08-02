import { describe, it, expect } from 'vitest';
import {
  AMAP_TABLES,
  VEHICLE_KINDS,
  amapTable,
  toTenths,
  fromTenths,
  priceMiles,
  buildMileageYear,
  computeRelief,
  claimRoute,
  P87_LIMIT_PENCE,
} from './mileage.js';

const TABLE = AMAP_TABLES['2026-27'];

/** Terse trip factory — id defaults to the index the caller passes. */
const trip = (id, date, miles, extra = {}) => ({
  id,
  date,
  miles,
  vehicle: 'car',
  purpose: `trip ${id}`,
  reimbursedPence: 0,
  ...extra,
});

describe('amapTable', () => {
  it('returns the exact table for a known year', () => {
    const { table, tableYear } = amapTable('2026-27');
    expect(tableYear).toBe('2026-27');
    expect(table.car.firstRatePence).toBe(45);
    expect(table.car.afterRatePence).toBe(25);
    expect(table.car.thresholdMiles).toBe(10000);
  });

  it('clamps a future year to the newest known table', () => {
    const { tableYear } = amapTable('2099-00');
    expect(tableYear).toBe('2026-27');
  });

  it('clamps a year older than the oldest table to the oldest', () => {
    const { tableYear } = amapTable('2001-02');
    expect(tableYear).toBe('2025-26');
  });

  it('gives motorcycles and bicycles flat rates with no threshold', () => {
    const { table } = amapTable('2026-27');
    expect(table.motorcycle).toEqual({
      thresholdMiles: null,
      firstRatePence: 24,
      afterRatePence: 24,
    });
    expect(table.bicycle).toEqual({ thresholdMiles: null, firstRatePence: 20, afterRatePence: 20 });
  });
});

describe('toTenths / fromTenths', () => {
  it('rounds miles to the nearest tenth', () => {
    expect(toTenths(12.44)).toBe(124);
    expect(toTenths(12.45)).toBe(125);
    expect(toTenths('8.7')).toBe(87);
  });

  it('treats junk and negatives as zero', () => {
    expect(toTenths(null)).toBe(0);
    expect(toTenths('abc')).toBe(0);
    expect(toTenths(-5)).toBe(0);
  });

  it('round-trips', () => {
    expect(fromTenths(toTenths(103.4))).toBe(103.4);
  });
});

describe('priceMiles', () => {
  const car = TABLE.car;

  it('prices everything at 45p well under the threshold', () => {
    // 100 miles × 45p = £45.00
    expect(priceMiles(car, 0, toTenths(100))).toEqual({
      pence: 4500,
      firstTenths: 1000,
      afterTenths: 0,
    });
  });

  it('prices everything at 25p once the threshold is already passed', () => {
    // 100 miles at 25p = £25.00
    expect(priceMiles(car, toTenths(10000), toTenths(100))).toEqual({
      pence: 2500,
      firstTenths: 0,
      afterTenths: 1000,
    });
  });

  it('splits a trip that straddles the 10,000-mile line', () => {
    // 9,990 already done; a 20-mile trip = 10 at 45p + 10 at 25p = £7.00
    const out = priceMiles(car, toTenths(9990), toTenths(20));
    expect(out.firstTenths).toBe(100);
    expect(out.afterTenths).toBe(100);
    expect(out.pence).toBe(450 + 250);
  });

  it('handles fractional miles exactly', () => {
    // 12.4 miles × 45p = 558p
    expect(priceMiles(car, 0, toTenths(12.4)).pence).toBe(558);
    // 0.5 of a mile × 45p = 22.5p → rounds to 23p (half away from zero)
    expect(priceMiles(car, 0, toTenths(0.5)).pence).toBe(23);
  });

  it('ignores the threshold for a flat-rate vehicle', () => {
    const out = priceMiles(TABLE.motorcycle, toTenths(50000), toTenths(100));
    expect(out.firstTenths).toBe(1000);
    expect(out.afterTenths).toBe(0);
    expect(out.pence).toBe(2400);
  });
});

describe('buildMileageYear', () => {
  it('returns empty totals for no trips', () => {
    const out = buildMileageYear({ trips: [], table: TABLE });
    expect(out.trips).toEqual([]);
    expect(out.byVehicle).toEqual([]);
    expect(out.totals).toMatchObject({
      tripCount: 0,
      miles: 0,
      allowancePence: 0,
      reimbursedPence: 0,
      shortfallPence: 0,
      excessPence: 0,
    });
  });

  it('accumulates miles across trips and prices them all at 45p under 10k', () => {
    const out = buildMileageYear({
      trips: [trip(1, '2026-04-10', 100), trip(2, '2026-05-10', 250.5)],
      table: TABLE,
    });
    expect(out.totals.miles).toBe(350.5);
    // 100 × 45p = 4500; 250.5 × 45p = 11272.5 → 11273 (rounded at the trip)
    expect(out.trips[0].allowancePence).toBe(4500);
    expect(out.trips[1].allowancePence).toBe(11273);
    expect(out.totals.allowancePence).toBe(15773);
    expect(out.byVehicle[0].milesToThreshold).toBe(9649.5);
    expect(out.byVehicle[0].overThreshold).toBe(false);
  });

  it('drops to 25p only after the cumulative 10,000-mile line', () => {
    const out = buildMileageYear({
      trips: [trip(1, '2026-04-10', 9990), trip(2, '2026-05-10', 20)],
      table: TABLE,
    });
    const [first, second] = out.trips;
    expect(first.allowancePence).toBe(999 * 450); // 9,990 × 45p
    expect(first.crossesThreshold).toBe(false);
    expect(second.crossesThreshold).toBe(true);
    expect(second.firstBandMiles).toBe(10);
    expect(second.afterBandMiles).toBe(10);
    expect(second.allowancePence).toBe(700);
    expect(out.byVehicle[0].firstBandMiles).toBe(10000);
    expect(out.byVehicle[0].afterBandMiles).toBe(10);
    expect(out.byVehicle[0].milesToThreshold).toBe(0);
    expect(out.byVehicle[0].overThreshold).toBe(true);
  });

  it('prices in date order regardless of the order trips are passed in', () => {
    const late = trip(1, '2027-01-05', 20); // added first, driven later
    const early = trip(2, '2026-04-10', 9990);
    const out = buildMileageYear({ trips: [late, early], table: TABLE });
    // The April trip must come first and soak up the 45p band.
    expect(out.trips.map((t) => t.id)).toEqual([2, 1]);
    expect(out.trips[1].crossesThreshold).toBe(true);
    expect(out.totals.allowancePence).toBe(999 * 450 + 700);
  });

  it('breaks a same-day tie by id so the order is stable', () => {
    const out = buildMileageYear({
      trips: [trip(7, '2026-06-01', 5), trip(3, '2026-06-01', 5)],
      table: TABLE,
    });
    expect(out.trips.map((t) => t.id)).toEqual([3, 7]);
  });

  it('keeps each vehicle kind on its own cumulative total', () => {
    const out = buildMileageYear({
      trips: [
        trip(1, '2026-04-10', 10000), // car, exactly to the line
        trip(2, '2026-04-11', 100, { vehicle: 'motorcycle' }),
        trip(3, '2026-04-12', 10, { vehicle: 'bicycle' }),
        trip(4, '2026-04-13', 100), // car, now all at 25p
      ],
      table: TABLE,
    });
    const byKind = Object.fromEntries(out.byVehicle.map((v) => [v.vehicle, v]));
    expect(byKind.car.allowancePence).toBe(10000 * 45 + 100 * 25);
    expect(byKind.motorcycle.allowancePence).toBe(100 * 24);
    expect(byKind.bicycle.allowancePence).toBe(10 * 20);
    // A flat-rate vehicle has no threshold to report.
    expect(byKind.motorcycle.milesToThreshold).toBeNull();
    expect(out.byVehicle.map((v) => v.vehicle)).toEqual(VEHICLE_KINDS);
  });

  it('nets employer reimbursement over the year into a shortfall', () => {
    // Employer pays 25p/mile on 1,000 miles: AMAP £450, paid £250 → claim £200.
    const out = buildMileageYear({
      trips: [trip(1, '2026-04-10', 1000, { reimbursedPence: 25000 })],
      table: TABLE,
    });
    expect(out.totals.allowancePence).toBe(45000);
    expect(out.totals.reimbursedPence).toBe(25000);
    expect(out.totals.shortfallPence).toBe(20000);
    expect(out.totals.excessPence).toBe(0);
  });

  it('reports an over-payment as taxable excess, not a negative claim', () => {
    // Employer pays 60p/mile on 100 miles: AMAP £45, paid £60 → £15 taxable.
    const out = buildMileageYear({
      trips: [trip(1, '2026-04-10', 100, { reimbursedPence: 6000 })],
      table: TABLE,
    });
    expect(out.totals.shortfallPence).toBe(0);
    expect(out.totals.excessPence).toBe(1500);
  });

  it('never lets an over-payment on one vehicle cancel a shortfall on another', () => {
    const out = buildMileageYear({
      trips: [
        trip(1, '2026-04-10', 100), // car: AMAP £45, unpaid → £45 shortfall
        trip(2, '2026-04-11', 100, { vehicle: 'bicycle', reimbursedPence: 5000 }),
        // bicycle: AMAP £20, paid £50 → £30 taxable excess
      ],
      table: TABLE,
    });
    expect(out.totals.shortfallPence).toBe(4500);
    expect(out.totals.excessPence).toBe(3000);
  });

  it('makes the trip values sum exactly to the headline total', () => {
    const trips = Array.from({ length: 37 }, (_, i) =>
      trip(i + 1, `2026-05-${String((i % 28) + 1).padStart(2, '0')}`, 13.3)
    );
    const out = buildMileageYear({ trips, table: TABLE });
    const summed = out.trips.reduce((acc, t) => acc + t.allowancePence, 0);
    expect(summed).toBe(out.totals.allowancePence);
  });

  it('treats an unknown vehicle as a car rather than dropping the trip', () => {
    const out = buildMileageYear({
      trips: [trip(1, '2026-04-10', 10, { vehicle: 'hovercraft' })],
      table: TABLE,
    });
    expect(out.trips[0].vehicle).toBe('car');
    expect(out.totals.allowancePence).toBe(450);
  });

  it('exposes the running position on each trip', () => {
    const out = buildMileageYear({
      trips: [trip(1, '2026-04-10', 100), trip(2, '2026-04-11', 50)],
      table: TABLE,
    });
    expect(out.trips[1].milesBefore).toBe(100);
    expect(out.trips[1].milesAfter).toBe(150);
  });

  it('does not mutate the trips passed in', () => {
    const input = [trip(1, '2026-04-10', 100)];
    const snapshot = JSON.parse(JSON.stringify(input));
    buildMileageYear({ trips: input, table: TABLE });
    expect(input).toEqual(snapshot);
  });
});

describe('computeRelief', () => {
  it('values a shortfall at the marginal rate', () => {
    expect(computeRelief(20000, 0.2)).toBe(4000);
    expect(computeRelief(20000, 0.4)).toBe(8000);
    expect(computeRelief(20000, 0.45)).toBe(9000);
  });

  it('rounds to the penny', () => {
    expect(computeRelief(333, 0.4)).toBe(133); // 133.2
  });

  it('is zero for no shortfall or no rate', () => {
    expect(computeRelief(0, 0.4)).toBe(0);
    expect(computeRelief(-500, 0.4)).toBe(0);
    expect(computeRelief(20000, 0)).toBe(0);
  });
});

describe('claimRoute', () => {
  it('uses a P87 up to the £2,500 limit', () => {
    expect(claimRoute(0)).toBe('p87');
    expect(claimRoute(P87_LIMIT_PENCE)).toBe('p87');
  });

  it('needs Self Assessment above it', () => {
    expect(claimRoute(P87_LIMIT_PENCE + 1)).toBe('self-assessment');
  });
});
