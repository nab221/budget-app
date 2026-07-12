/**
 * incomeData.js — thin adapter that gathers what the Income tab needs and
 * converts it from the repository POUNDS edge into the PENCE domain the pure
 * tax engine works in (the `planData.js` pattern: this is the ONLY place
 * pounds→pence conversion happens for the income tracker).
 */

import { peopleRepo, incomeEventsRepo, salaryPeriodsRepo, payslipsRepo } from './repositories.js';
import { toPence } from '../engine/currency.js';
import {
  taxYearBounds,
  taxYearTable,
  buildPersonYearInput,
  computePersonTax,
} from '../engine/tax.js';
import { monthsOfTaxYear, buildMonthlyPay, expectedPayeYtd } from '../engine/salaryTimeline.js';

/** Today's 'yyyy-MM' — the actual/planned boundary for payslips. */
const currentMonth = () => new Date().toISOString().slice(0, 7);

/**
 * Read every person + their salary periods, payslips, and income events for
 * one tax year and return a pence-domain snapshot: per person, the 12-month
 * pay grid (actual payslips over timeline projections), the year's events
 * (newest first), the computed tax summary, and the cumulative-basis PAYE
 * check. Nothing here is ever persisted — computed at read time, per the
 * hard rules.
 *
 * A person with no salary periods falls back to their legacy annual
 * salary/sacrifice fields (as one always-in-force virtual period) — this
 * covers pre-v5 backup restores, where the people table carries the annual
 * figures but `salaryPeriods` is empty.
 *
 * @param {string} taxYearLabel - e.g. "2026-27".
 * @returns {Promise<{ taxYear: string, tableYear: string, startDate: string,
 *   endDate: string, people: Array<object> }>} `tableYear` differs from
 *   `taxYear` when the rates fell back to the nearest known Budget year.
 */
export async function gatherIncomeData(taxYearLabel) {
  const { startDate, endDate } = taxYearBounds(taxYearLabel);
  const { table, tableYear } = taxYearTable(taxYearLabel);
  const months = monthsOfTaxYear(taxYearLabel);
  const todayMonth = currentMonth();

  const [peopleRaw, eventsRaw, periodsRaw, payslipsRaw] = await Promise.all([
    peopleRepo.getAll(), // pounds at the edge
    incomeEventsRepo.between(startDate, endDate), // pounds at the edge
    salaryPeriodsRepo.getAll(), // pounds at the edge
    payslipsRepo.betweenMonths(months[0], months[11]), // pounds at the edge
  ]);

  const people = peopleRaw.map((p) => {
    const personPence = {
      annualSalaryPence: toPence(p.annualSalaryPence), // pounds → pence
      salarySacrificePence: toPence(p.salarySacrificePence), // pounds → pence
      pensionAnnualPence: toPence(p.pensionAnnualPence), // pounds → pence
      benefitsInKindPence: toPence(p.benefitsInKindPence), // pounds → pence
      otherIncomePence: toPence(p.otherIncomePence), // pounds → pence
    };

    const periods = periodsRaw
      .filter((sp) => sp.personId === p.id)
      .map((sp) => ({
        id: sp.id,
        effectiveFrom: sp.effectiveFrom,
        note: sp.note,
        annualSalaryPence: toPence(sp.annualSalaryPence), // pounds → pence
        salarySacrificePence: toPence(sp.salarySacrificePence), // pounds → pence
        workplacePensionAnnualPence: toPence(sp.workplacePensionAnnualPence), // pounds → pence
      }));
    // Legacy fallback: no periods → the person's annual fields, always in force.
    const usingLegacySalary = periods.length === 0;
    const effectivePeriods = usingLegacySalary
      ? [
          {
            id: null,
            effectiveFrom: '1900-01-01',
            note: '',
            annualSalaryPence: personPence.annualSalaryPence,
            salarySacrificePence: personPence.salarySacrificePence,
            workplacePensionAnnualPence: 0,
          },
        ]
      : periods;

    const payslips = payslipsRaw
      .filter((s) => s.personId === p.id)
      .map((s) => ({
        id: s.id,
        month: s.month,
        note: s.note,
        grossPence: toPence(s.grossPence), // pounds → pence
        pensionPence: toPence(s.pensionPence), // pounds → pence
        taxPaidPence: toPence(s.taxPaidPence), // pounds → pence
      }));

    const events = eventsRaw
      .filter((e) => e.personId === p.id)
      .map((e) => ({
        id: e.id,
        personId: e.personId,
        date: e.date,
        kind: e.kind,
        note: e.note,
        amountPence: toPence(e.amountPence), // pounds → pence
      }))
      .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));

    const monthly = buildMonthlyPay({
      periods: effectivePeriods,
      payslips,
      taxYear: taxYearLabel,
      todayMonth,
    });
    const yearSalaryPence = monthly[monthly.length - 1].cumulativePence;
    const input = buildPersonYearInput(personPence, events, yearSalaryPence);
    return {
      id: p.id,
      name: p.name,
      person: p, // raw repo row (pounds) — what the edit form needs
      personPence,
      periods: effectivePeriods,
      usingLegacySalary,
      monthly,
      events,
      input,
      summary: computePersonTax(input, table),
      payeCheck: expectedPayeYtd(monthly, table),
    };
  });

  return { taxYear: taxYearLabel, tableYear, startDate, endDate, table, todayMonth, people };
}

export default gatherIncomeData;
