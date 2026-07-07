/**
 * Integration smoke test for the Income tab: seed people + income events
 * through the REAL repositories (real Dexie over fake-indexeddb) and render
 * the real Income component. Confirms the person card shows the computed tax
 * split, headroom meters, and the over-£100k childcare warning.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { peopleRepo, incomeEventsRepo } from '../../db/repositories.js';
import { taxYearForDate, taxYearBounds } from '../../engine/tax.js';
import Income from '../Income.jsx';

beforeEach(resetDb);
afterEach(cleanup);

// The component defaults to the tax year containing today, so seed events
// into that year regardless of when the suite runs.
const today = new Date().toISOString().slice(0, 10);
const { startDate } = taxYearBounds(taxYearForDate(today));

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
    // £30,000 of headroom to the £100k line; already over the 40% band.
    expect(screen.getByText(/£30,000\.00/)).toBeTruthy();
    expect(screen.getByText(/Over the 40% band/)).toBeTruthy();
    // The dividend draw is listed with its note.
    expect(screen.getByText('Dividend draw')).toBeTruthy();
    expect(screen.getByText('Q1 draw')).toBeTruthy();
    expect(screen.getByText('Add dividend draw')).toBeTruthy();
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

  it('salary sacrifice reduces the taxed salary figure', async () => {
    await peopleRepo.add({
      name: 'Wife',
      annualSalaryPence: 50000,
      salarySacrificePence: 8000, // car scheme → £42k on the payslip
    });

    render(<Income />);

    expect(await screen.findByText('Wife')).toBeTruthy();
    // Salary (after sacrifice) fact shows £42,000.
    expect(screen.getAllByText('£42,000.00').length).toBeGreaterThan(0);
  });

  it('shows an empty state when there are no people', async () => {
    render(<Income />);
    expect(await screen.findByText(/No people yet/i)).toBeTruthy();
  });
});
