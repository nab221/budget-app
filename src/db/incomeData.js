/**
 * incomeData.js — thin adapter that gathers what the Income tab needs and
 * converts it from the repository POUNDS edge into the PENCE domain the pure
 * tax engine works in (the `planData.js` pattern: this is the ONLY place
 * pounds→pence conversion happens for the income tracker).
 */

import { peopleRepo, incomeEventsRepo } from './repositories.js';
import { toPence } from '../engine/currency.js';
import {
  taxYearBounds,
  taxYearTable,
  buildPersonYearInput,
  computePersonTax,
} from '../engine/tax.js';

/**
 * Read every person + their income events for one tax year and return a
 * pence-domain snapshot: per person, the year's events (newest first) and the
 * computed tax summary. Nothing here is ever persisted — computed at read
 * time, per the hard rules.
 *
 * @param {string} taxYearLabel - e.g. "2026-27".
 * @returns {Promise<{ taxYear: string, tableYear: string, startDate: string,
 *   endDate: string, people: Array<object> }>} `tableYear` differs from
 *   `taxYear` when the rates fell back to the nearest known Budget year.
 */
export async function gatherIncomeData(taxYearLabel) {
  const { startDate, endDate } = taxYearBounds(taxYearLabel);
  const { table, tableYear } = taxYearTable(taxYearLabel);

  const [peopleRaw, eventsRaw] = await Promise.all([
    peopleRepo.getAll(), // pounds at the edge
    incomeEventsRepo.between(startDate, endDate), // pounds at the edge
  ]);

  const people = peopleRaw.map((p) => {
    const personPence = {
      annualSalaryPence: toPence(p.annualSalaryPence), // pounds → pence
      salarySacrificePence: toPence(p.salarySacrificePence), // pounds → pence
      pensionAnnualPence: toPence(p.pensionAnnualPence), // pounds → pence
      benefitsInKindPence: toPence(p.benefitsInKindPence), // pounds → pence
      otherIncomePence: toPence(p.otherIncomePence), // pounds → pence
    };
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

    const input = buildPersonYearInput(personPence, events);
    return {
      id: p.id,
      name: p.name,
      person: p, // raw repo row (pounds) — what the edit form needs
      personPence,
      events,
      input,
      summary: computePersonTax(input, table),
    };
  });

  return { taxYear: taxYearLabel, tableYear, startDate, endDate, table, people };
}

export default gatherIncomeData;
