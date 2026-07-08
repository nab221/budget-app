/**
 * Render tests for Dashboard v2 (specs/DASHBOARD-PLAN.md): the KPI strip,
 * insight cards, category breakdown, and cost-of-everything table — all
 * computed live from the schedule, nothing persisted.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  debtsRepo,
  recurringBillsRepo,
  categoriesRepo,
} from '../../db/repositories.js';
import { setSetting } from '../../db/settings.js';
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
  await setSetting('lastExportAt', '2026-07-01T10:00:00.000Z'); // fresh backup — no nudge
  const catId = await categoriesRepo.add({ name: 'Utilities', kind: 'spending' });
  await recurringBillsRepo.add({
    label: 'Broadband',
    amountPence: 30, // £30/month
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
    apr: 20,
    minPaymentOverridePence: 50, // £50
    paymentDayOfMonth: 20,
    balanceAsOf: '2026-07-01',
  });
}

describe('Dashboard v2', () => {
  it('shows the KPI strip: period totals, total debt, interest, debt-free date', async () => {
    await seed();
    render(<Dashboard />);

    await screen.findByText('This month');
    expect(screen.getByText('Total debt')).toBeTruthy();
    expect(screen.getByText('£1,000.00')).toBeTruthy();
    // £1,000 at 20% ÷ 12 ≈ £16.67/month interest.
    expect(screen.getByText('Interest / month')).toBeTruthy();
    expect(screen.getByText('£16.67')).toBeTruthy();
    // £50/month against £1,000 at 20% clears in under 3 years.
    expect(screen.getByText('Debt-free')).toBeTruthy();
    expect(screen.getByText(/months on avalanche/)).toBeTruthy();
  });

  it('shows the category breakdown with a monthly ↔ yearly toggle', async () => {
    await seed();
    render(<Dashboard />);
    await screen.findByText('Where it goes');

    // Monthly view: Broadband £30 under Utilities, Visa £50 under Debt payments.
    // (Both names also appear in the cost table's category column.)
    expect(screen.getAllByText('Utilities').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Debt payments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£30.00').length).toBeGreaterThan(0);

    // Yearly view: £360 and £600.
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }));
    expect(screen.getAllByText('£360.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£600.00').length).toBeGreaterThan(0);
  });

  it('lists every commitment in the cost table, sorted by yearly cost', async () => {
    await seed();
    render(<Dashboard />);
    await screen.findByText('What everything costs');

    const table = screen.getByRole('table');
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    // Visa £600/yr before Broadband £360/yr.
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Visa (min payment)');
    expect(rows[1]).toContain('Broadband');

    // Sorting by label re-orders.
    fireEvent.click(screen.getByRole('button', { name: 'What' }));
    const relabelled = [...table.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(relabelled[0]).toContain('Broadband');
  });

  it('surfaces a promo-cliff insight with a deep link to Payoff', async () => {
    await seed();
    await debtsRepo.add({
      name: 'Barclaycard',
      debtType: 'credit-card',
      balancePence: 2000, // £2,000
      apr: 0,
      promoEndDate: '2026-07-30', // 23 days out → warn
      postPromoApr: 24.9,
      paymentDayOfMonth: 5,
      balanceAsOf: '2026-07-01',
    });
    const onNavigate = vi.fn();
    render(<Dashboard onNavigate={onNavigate} />);

    await screen.findByText('0% on Barclaycard ends in 23 days');
    expect(screen.getByText(/At 24.9% its minimum payment becomes/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open Payoff planner' }));
    expect(onNavigate).toHaveBeenCalledWith('payoff');
  });

  it('renders no insight section when there is nothing to say', async () => {
    await seed();
    render(<Dashboard />);
    await screen.findByText('This month');
    expect(document.querySelector('.insight')).toBeNull();
  });

  it('keeps the empty state when nothing is set up', async () => {
    render(<Dashboard />);
    await screen.findByText('Nothing set up yet');
  });
});
