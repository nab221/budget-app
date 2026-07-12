/**
 * Integration smoke test for the Income tab: seed people + income events
 * through the REAL repositories (real Dexie over fake-indexeddb) and render
 * the real Income component. Confirms the person card shows the computed tax
 * split, headroom meters, the over-£100k childcare warning, the salary
 * timeline, and the pay-month grid with payslip actuals.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  peopleRepo,
  incomeEventsRepo,
  salaryPeriodsRepo,
  payslipsRepo,
} from '../../db/repositories.js';
import { taxYearForDate, taxYearBounds } from '../../engine/tax.js';
import { monthsOfTaxYear } from '../../engine/salaryTimeline.js';
import Income from '../Income.jsx';

beforeEach(resetDb);
afterEach(cleanup);

// The component defaults to the tax year containing today, so seed events
// into that year regardless of when the suite runs.
const today = new Date().toISOString().slice(0, 10);
const todayMonth = today.slice(0, 7);
const currentTaxYear = taxYearForDate(today);
const { startDate } = taxYearBounds(currentTaxYear);

describe('Income tab (seeded)', () => {
  it('renders a person card with the tax split and headroom', async () => {
    const p = await peopleRepo.add({ name: 'Anderson', annualSalaryPence: 60000 }); // £60k
    await incomeEventsRepo.add({
      personId: p,
      date: startDate,
      kind: 'dividend',
      amountPence: 10000, // £10k
      note: 'Q1 draw',
    });

    render(<Income />);

    expect(await screen.findByText('Anderson')).toBeTruthy();
    // £60k salary + £10k dividends (2026-27 rates): PAYE £11,432,
    // dividend bill £3,396.25, total £14,828.25.
    expect(screen.getByText('£11,432.00')).toBeTruthy();
    expect(screen.getByText('£3,396.25')).toBeTruthy();
    expect(screen.getByText('£14,828.25')).toBeTruthy();
    // £30,000 of headroom to the £100k line (also a month-grid running total);
    // already over the 40% band.
    expect(screen.getAllByText(/£30,000\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Over the 40% band/)).toBeTruthy();
    // The dividend draw is listed with its note.
    expect(screen.getByText('Dividend draw')).toBeTruthy();
    expect(screen.getByText('Q1 draw')).toBeTruthy();
    expect(screen.getByText('Add dividend draw')).toBeTruthy();
  });

  it('a gross consultancy fee shows as other income owed via Self Assessment', async () => {
    const p = await peopleRepo.add({ name: 'Anderson', annualSalaryPence: 60000 });
    await incomeEventsRepo.add({
      personId: p,
      date: startDate,
      kind: 'other-income',
      amountPence: 5000, // £5,000 fee, paid gross
      note: 'Consultancy fee',
    });

    render(<Income />);

    expect(await screen.findByText('Anderson')).toBeTruthy();
    // £60k salary + £5k fee: total tax £13,432 — PAYE still £11,432, the
    // fee's £2,000 (40% marginal) owed via Self Assessment.
    expect(screen.getByText('£13,432.00')).toBeTruthy();
    expect(screen.getByText('£11,432.00')).toBeTruthy();
    expect(screen.getAllByText('£2,000.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Extra bill via Self Assessment')).toBeTruthy();
    // Listed in the facts row and the event list, with its note.
    expect(screen.getAllByText('Other income').length).toBeGreaterThan(1);
    expect(screen.getByText('Consultancy fee')).toBeTruthy();
    expect(screen.getByText('Add other income')).toBeTruthy();
  });

  it('shows the household childcare warning when someone crosses £100k', async () => {
    const p = await peopleRepo.add({ name: 'Wife', annualSalaryPence: 90000 });
    await incomeEventsRepo.add({
      personId: p,
      date: startDate,
      kind: 'dividend',
      amountPence: 20000, // £110k ANI in total
    });

    render(<Income />);

    expect(await screen.findByText(/Wife is over the £100,000/)).toBeTruthy();
    expect(
      screen.getByText(/lose Tax-Free Childcare and free hours/)
    ).toBeTruthy();
  });

  it('salary sacrifice reduces the taxed salary figure (legacy annual fallback)', async () => {
    await peopleRepo.add({
      name: 'Wife',
      annualSalaryPence: 50000,
      salarySacrificePence: 8000, // car scheme → £42k on the payslip
    });

    render(<Income />);

    expect(await screen.findByText('Wife')).toBeTruthy();
    // Taxable salary fact shows £42,000.
    expect(screen.getAllByText('£42,000.00').length).toBeGreaterThan(0);
    // With no salary periods the card offers to start the timeline.
    expect(screen.getByText(/Using the single annual salary/)).toBeTruthy();
    expect(screen.getByText('Add salary change')).toBeTruthy();
  });

  it('shows the 12-month grid, all projected without payslips', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    await salaryPeriodsRepo.add({
      personId: p,
      effectiveFrom: '1900-01-01',
      annualSalaryPence: 60000,
    });

    render(<Income />);

    expect(await screen.findByText('Anderson')).toBeTruthy();
    expect(screen.getByText('Pay months')).toBeTruthy();
    expect(screen.getAllByText('Projected')).toHaveLength(12);
    expect(screen.getByText('Salary timeline')).toBeTruthy();
  });

  it('entered payslips show as actuals and power the PAYE check', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    await salaryPeriodsRepo.add({
      personId: p,
      effectiveFrom: '1900-01-01',
      annualSalaryPence: 60000,
    });
    // Every month from April to today, so the cumulative PAYE check is complete.
    const entered = monthsOfTaxYear(currentTaxYear).filter((m) => m <= todayMonth);
    for (const month of entered) {
      await payslipsRepo.upsert(p, {
        month,
        grossPence: 5000,
        pensionPence: 0,
        taxPaidPence: 950,
      });
    }

    render(<Income />);

    expect(await screen.findByText('Anderson')).toBeTruthy();
    expect(screen.getAllByText('Payslip')).toHaveLength(entered.length);
    expect(screen.getAllByText('Projected')).toHaveLength(12 - entered.length);
    expect(screen.getByText(/PAYE check/)).toBeTruthy();
  });
});
