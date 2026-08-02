/**
 * mileageData.js — thin adapter that gathers what the Mileage tab needs and
 * converts it from the repository POUNDS edge into the PENCE domain the pure
 * AMAP engine works in (the `incomeData.js` / `planData.js` pattern: this is
 * the ONLY place pounds→pence conversion happens for the mileage tracker).
 */

import { mileageTripsRepo, employersRepo } from './repositories.js';
import { settings } from './settings.js';
import { toPence } from '../engine/currency.js';
import { taxYearBounds } from '../engine/tax.js';
import { amapTable, buildMileageYear, computeRelief, claimRoute } from '../engine/mileage.js';

/** Today as an ISO 'yyyy-MM-dd' — overridable so tests are deterministic. */
const isoToday = () => new Date().toISOString().slice(0, 10);

/**
 * Read one tax year's business trips and return a pence-domain snapshot: the
 * claim-ordered trips with their band split and value, the per-vehicle year
 * totals netted against what the employer paid, and what the resulting claim
 * is worth at the stored marginal rate. Nothing here is ever persisted —
 * computed at read time, per the hard rules.
 *
 * @param {string} taxYearLabel - e.g. "2026-27".
 * @param {string} [today] - ISO 'yyyy-MM-dd' override of "today"; defaults to
 *   the system clock. Used only to mark whether the year is still running.
 * @returns {Promise<object>} `tableYear` differs from `taxYear` when the rates
 *   fell back to the nearest known table.
 */
export async function gatherMileageData(taxYearLabel, today = isoToday()) {
  const { startDate, endDate } = taxYearBounds(taxYearLabel);
  const { table, tableYear } = amapTable(taxYearLabel);

  const [tripsRaw, employers, marginalRate, employerRatePence] = await Promise.all([
    mileageTripsRepo.between(startDate, endDate), // pounds at the edge
    employersRepo.getAll(), // name order; `ratePencePerMile` is raw pence/mile
    settings.getMileageMarginalRate(),
    settings.getMileageEmployerRatePence(),
  ]);

  const trips = tripsRaw.map((t) => ({
    id: t.id,
    date: t.date,
    vehicle: t.vehicle,
    miles: t.miles,
    employerId: t.employerId ?? null,
    purpose: t.purpose,
    reimbursedPence: toPence(t.reimbursedPence), // pounds → pence
  }));

  const year = buildMileageYear({ trips, employers, table });
  const reliefPence = computeRelief(year.totals.shortfallPence, marginalRate);

  return {
    taxYear: taxYearLabel,
    tableYear,
    startDate,
    endDate,
    table,
    inProgress: today >= startDate && today <= endDate,
    employers,
    marginalRate,
    // The fallback pence-per-mile for a trip with no employer; each employer
    // carries its own rate.
    employerRatePence,
    reliefPence,
    route: claimRoute(year.totals.shortfallPence),
    ...year, // trips, byGroup, totals
  };
}

export default gatherMileageData;
