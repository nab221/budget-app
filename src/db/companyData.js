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
import { gatherIncomeData } from './incomeData.js';
import { taxYearForDate, computePersonTax } from '../engine/tax.js';

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

/**
 * The PERSONAL side of "if I draw £X": the drawing person's income-tax
 * position before and after, in the personal tax year (6 Apr – 5 Apr)
 * containing the draw date — which is not the company year. No dividend-tax
 * logic lives here: the person's existing year input from the Income engine
 * gets the draw added to its dividends and is recomputed.
 *
 * @param {object} args
 * @param {number} args.personId
 * @param {number} args.amountPence - integer pence of the proposed dividend.
 * @param {string} args.date - ISO yyyy-MM-dd the dividend would be dated.
 * @returns {Promise<null | { taxYear: string, tableYear: string, personId: number,
 *   name: string, before: object, after: object, extraTaxPence: number,
 *   netInHandPence: number }>} `extraTaxPence` is the change in the person's
 *   TOTAL tax, so it includes any personal-allowance taper the draw triggers.
 *   `null` when the person does not exist.
 */
export async function previewPersonalDraw({ personId, amountPence, date }) {
  const taxYear = taxYearForDate(date);
  const income = await gatherIncomeData(taxYear);
  const person = income.people.find((p) => p.id === personId);
  if (!person) return null;

  const extra = Math.max(0, Math.round(amountPence || 0));
  const before = person.summary;
  const after = computePersonTax(
    { ...person.input, dividendPence: person.input.dividendPence + extra },
    income.table
  );
  const extraTaxPence = after.totalTaxPence - before.totalTaxPence;

  return {
    taxYear,
    tableYear: income.tableYear,
    personId,
    name: person.name,
    before,
    after,
    extraTaxPence,
    netInHandPence: extra - extraTaxPence,
  };
}

export default gatherCompanyData;
