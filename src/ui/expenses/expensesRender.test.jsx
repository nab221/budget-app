/**
 * Render tests for the Expenses screen and the minimal Dashboard: cards per
 * debt/expense grouped by category, next-payment dates, and the period totals
 * (actual occurrences + normalised average) — all computed, nothing confirmed.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));
import { debtsRepo, recurringBillsRepo, categoriesRepo } from '../../db/repositories.js';
import Expenses from '../Expenses.jsx';
import Dashboard from '../Dashboard.jsx';

beforeEach(async () => {
  await resetDb();
  vi.useFakeTimers({ now: new Date(2026, 6, 7, 12), toFake: ['Date'] }); // Tue 7 Jul 2026
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// Repo edge speaks POUNDS.
async function seed() {
  const catId = await categoriesRepo.add({ name: 'Utilities', kind: 'spending' });
  await recurringBillsRepo.add({
    label: 'Broadband',
    amountPence: 30, // £30
    categoryId: catId,
    frequency: 'monthly',
    nextDueDate: '2026-07-15',
    dueDayAnchor: 15,
    adjustToWorkingDay: false,
    active: true,
  });
  await debtsRepo.add({
    name: 'Visa',
    debtType: 'credit-card',
    balancePence: 1000, // £1,000
    apr: 0,
    minPaymentOverridePence: 50, // £50
    paymentDayOfMonth: 20,
  });
  await debtsRepo.add({
    name: 'Car loan',
    debtType: 'loan',
    balancePence: 5000,
    interestRate: 6,
    fixedMonthlyPaymentPence: 250, // £250
    paymentDayOfMonth: 28,
  });
}

describe('Expenses screen', () => {
  it('shows debt and expense cards with next payment dates, grouped by category', async () => {
    await seed();
    render(<Expenses />);

    // Debt cards with computed next payments (20 Jul 2026 is a Monday, 28 Jul a Tuesday).
    await screen.findByText('Visa');
    expect(screen.getByText('Car loan')).toBeTruthy();
    expect(screen.getByText('20 Jul 2026')).toBeTruthy();
    expect(screen.getByText('28 Jul 2026')).toBeTruthy();

    // Expense card under its category group, with its next occurrence.
    expect(screen.getByRole('heading', { name: 'Utilities' })).toBeTruthy();
    expect(screen.getByText('Broadband')).toBeTruthy();
    expect(screen.getByText(/15 Jul 2026/)).toBeTruthy();
  });

  it('totals the month (card min + loan payment + bills) and switches periods', async () => {
    await seed();
    render(<Expenses />);
    await screen.findByText('Visa');

    // July 2026: £50 (Visa min) + £250 (loan) + £30 (broadband) = £330.
    expect(screen.getByText('Going out — July 2026')).toBeTruthy();
    expect(screen.getAllByText('£330.00').length).toBeGreaterThan(0);

    // Week of Mon 6 Jul: nothing lands (15th/20th/28th are later) → £0.00 actual.
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText(/Going out — Week of 6 Jul 2026/)).toBeTruthy();
    expect(screen.getByText('£0.00')).toBeTruthy();

    // Year 2026: bills walk from their nextDueDate (Jul–Dec = 6 × £30 = £180)
    // and debts pay monthly all year (12 × £300 = £3,600) → £3,780.
    fireEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(screen.getByText('Going out — 2026')).toBeTruthy();
    expect(screen.getByText('£3,780.00')).toBeTruthy();
  });

  it('paused expenses drop out of the totals', async () => {
    await seed();
    render(<Expenses />);
    await screen.findByText('Broadband');

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    // £330 − £30 broadband = £300 (both the actual and the average show it).
    await screen.findAllByText('£300.00');
    expect(screen.getByText('Paused — not counted in totals')).toBeTruthy();
  });
});

describe('Minimal dashboard', () => {
  it('shows period tiles and the next payments list', async () => {
    await seed();
    render(<Dashboard />);

    await screen.findByText('This month');
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('This year')).toBeTruthy();
    expect(screen.getAllByText('£330.00').length).toBeGreaterThan(0);

    // Upcoming list, soonest first: Broadband 15th, Visa 20th, loan 28th.
    expect(screen.getByText('Next payments')).toBeTruthy();
    const dates = screen.getAllByText(/Jul 2026/).map((el) => el.textContent);
    expect(dates.join(' ')).toContain('15 Jul 2026');
  });

  it('shows an empty state when nothing is set up', async () => {
    render(<Dashboard />);
    await screen.findByText('Nothing set up yet');
  });
});
