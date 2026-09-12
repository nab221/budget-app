/**
 * companyData.js — thin adapter that gathers what the Company tab needs and
 * converts it from the repository POUNDS edge into the PENCE domain the pure
 * corporation-tax engine works in (the `mileageData.js` / `incomeData.js`
 * pattern: this is the ONLY place pounds→pence conversion happens for the
 * company screen).
 *
 * The dividend rows ARE the Income tab's `incomeEvents` (kind `dividend`):
 * both people draw from the same company, so the company year is simply
 * every dividend event from everyone, re-cut on the 1 April boundary.
 */

import { peopleRepo, incomeEventsRepo } from './repositories.js';
import { toPence } from '../engine/currency.js';
import {
  financialYearBounds,
  financialYearTable,
  ctPaymentDate,
  buildCompanyYear,
} from '../engine/corporation-tax.js';

/**
 * Read one company year's dividends from both people and return a
 * pence-domain snapshot: the ledger (newest first, named), the per-person
 * split, and the profit / CT / headroom figures those dividends imply.
 * Nothing here is ever persisted — computed at read time, per the hard rules.
 *
 * @param {string} fyLabel - e.g. "FY2026" (1 Apr 2026 – 31 Mar 2027).
 * @returns {Promise<object>} `tableYear` differs from `financialYear` when the
 *   rules fell back to the nearest known table.
 */
export async function gatherCompanyData(fyLabel) {
  const { startDate, endDate } = financialYearBounds(fyLabel);
  const { table, tableYear } = financialYearTable(fyLabel);

  const [peopleRaw, eventsRaw] = await Promise.all([
    peopleRepo.getAll(), // pounds at the edge — only id + name are needed here
    incomeEventsRepo.between(startDate, endDate), // pounds at the edge
  ]);

  const people = peopleRaw.map((p) => ({ id: p.id, name: p.name }));
  const dividendEvents = eventsRaw
    .filter((e) => e.kind === 'dividend')
    .map((e) => ({
      id: e.id,
      personId: e.personId,
      date: e.date,
      kind: e.kind,
      note: e.note ?? '',
      amountPence: toPence(e.amountPence), // pounds → pence
    }));

  return {
    financialYear: fyLabel,
    tableYear,
    startDate,
    endDate,
    table,
    paymentDate: ctPaymentDate(fyLabel),
    people,
    ...buildCompanyYear({ dividendEvents, people, table }), // events, perPerson, totals
  };
}

export default gatherCompanyData;
