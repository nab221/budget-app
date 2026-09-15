/**
 * pensionData.js — thin adapter that gathers what the Pension tab needs and
 * converts it from the repository POUNDS edge into the PENCE domain the pure
 * pension engine works in (the `incomeData.js` pattern: the ONLY place
 * pounds→pence conversion happens for the allowance tracker).
 *
 * Nothing here is ever persisted — estimates, carry-forward and headroom are
 * computed at read time, per the hard rules.
 */

import { peopleRepo, salaryPeriodsRepo, incomeEventsRepo, pensionYearsRepo } from './repositories.js';
import { toPence } from '../engine/currency.js';
import { taxYearBounds, taxYearForDate, shiftTaxYear } from '../engine/tax.js';
import { projectedYearSalaryPence } from '../engine/salaryTimeline.js';
import {
  SCHEMES,
  RELIEF_AT_SOURCE_GROSS_UP,
  anchorOpeningYear,
  buildPensionYear,
  windowYears,
} from '../engine/pension.js';

/** Every tax-year label from `from` to `to` inclusive (from ≤ to). */
function labelsBetween(from, to) {
  const out = [];
  for (let y = from; y <= to; y = shiftTaxYear(y, 1)) out.push(y);
  return out;
}

/**
 * Read every person + their salary periods, pension-year rows and SIPP events
 * for the viewed tax year and the three before it, and return a pence-domain
 * snapshot: per person, the anchor, the entered rows, the pensionable
 * earnings per year (override, else the timeline's gross salary, else the
 * legacy annual salary), grossed-up SIPP per year, and `buildPensionYear`'s
 * result.
 *
 * @param {string} taxYearLabel - e.g. "2026-27".
 * @returns {Promise<{ taxYear: string, people: Array<object> }>}
 */
export async function gatherPensionData(taxYearLabel) {
  const labels = windowYears(taxYearLabel);
  const windowStart = taxYearBounds(labels[0]).startDate;
  const { endDate } = taxYearBounds(taxYearLabel);

  const [peopleRaw, periodsRaw, rowsRaw, eventsRaw] = await Promise.all([
    peopleRepo.getAll(), // pounds at the edge
    salaryPeriodsRepo.getAll(), // pounds at the edge
    pensionYearsRepo.getAll(), // pounds at the edge
    incomeEventsRepo.between(windowStart, endDate), // pounds at the edge
  ]);

  const people = peopleRaw.map((p) => {
    const scheme = SCHEMES[p.pensionScheme] ? p.pensionScheme : null;
    const anchorPence = toPence(p.pensionAnchorPence); // pounds → pence
    const anchor =
      scheme && p.pensionAnchorDate && anchorPence > 0
        ? { pence: anchorPence, date: p.pensionAnchorDate, openingYear: anchorOpeningYear(p.pensionAnchorDate) }
        : null;

    const periods = periodsRaw
      .filter((sp) => sp.personId === p.id)
      .map((sp) => ({ effectiveFrom: sp.effectiveFrom, annualSalaryPence: toPence(sp.annualSalaryPence) })); // pounds → pence
    // Legacy fallback: no periods → the person's annual salary, always in force.
    const effectivePeriods =
      periods.length > 0
        ? periods
        : [{ effectiveFrom: '1900-01-01', annualSalaryPence: toPence(p.annualSalaryPence) }]; // pounds → pence

    const rows = rowsRaw
      .filter((r) => r.personId === p.id)
      .map((r) => ({
        id: r.id,
        taxYear: r.taxYear,
        note: r.note || '',
        piaPence: r.piaPence == null ? null : toPence(r.piaPence), // pounds → pence
        pensionableEarningsPence:
          r.pensionableEarningsPence == null ? null : toPence(r.pensionableEarningsPence), // pounds → pence
      }));
    const rowByYear = new Map(rows.map((r) => [r.taxYear, r]));

    // Earnings for every year the roll-forward or the window can touch.
    const firstYear = anchor && anchor.openingYear < labels[0] ? anchor.openingYear : labels[0];
    const earningsByYear = {};
    for (const label of labelsBetween(firstYear, taxYearLabel)) {
      const override = rowByYear.get(label)?.pensionableEarningsPence;
      earningsByYear[label] =
        override != null ? override : projectedYearSalaryPence(effectivePeriods, label);
    }

    // Grossed-up personal contributions per window year: the annual
    // personal-pension field (entered gross) every year + SIPP events summed
    // net then grossed up ×1.25 ONCE per year — the Income engine's
    // `buildPersonYearInput` definition (sum net pence for the year, round
    // once), not per-event rounding.
    const annualPersonalPence = toPence(p.pensionAnnualPence); // pounds → pence
    const netByYear = {};
    for (const ev of eventsRaw) {
      if (ev.personId !== p.id || ev.kind !== 'sipp-contribution') continue;
      const label = taxYearForDate(ev.date);
      if (!labels.includes(label)) continue;
      netByYear[label] = (netByYear[label] || 0) + toPence(ev.amountPence); // pounds → pence
    }
    const sippGrossByYear = Object.fromEntries(
      labels.map((label) => [label, annualPersonalPence + Math.round((netByYear[label] || 0) * RELIEF_AT_SOURCE_GROSS_UP)]),
    );

    return {
      id: p.id,
      name: p.name,
      scheme,
      anchor,
      rows,
      earningsByYear,
      ...buildPensionYear({ taxYear: taxYearLabel, scheme, anchor, rows, earningsByYear, sippGrossByYear }),
    };
  });

  return { taxYear: taxYearLabel, people };
}

export default gatherPensionData;
