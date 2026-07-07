/**
 * Integration smoke test: seed sample data through the REAL repositories, then
 * render the real Dashboard and Payoff screens end-to-end (real plan engine +
 * real Dexie over fake-indexeddb). Confirms the Phase 3 screens mount and show
 * the headline pieces without runtime errors — the jsdom stand-in for the
 * dev-server smoke check (no Playwright available in this environment).
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import {
  incomeSourcesRepo,
  recurringBillsRepo,
  debtsRepo,
  categoriesRepo,
} from '../../db/repositories.js';
import { settings } from '../../db/settings.js';
import Dashboard from '../Dashboard.jsx';
import Payoff from '../Payoff.jsx';

// Real timers (testing-library's async waits need them). The seeded income
// rule + monthly recurrences produce a populated current period on any date.
beforeEach(resetDb);
afterEach(cleanup);

async function seed() {
  // Money fields are POUNDS at the repository edge.
  await categoriesRepo.add({ name: 'Utilities', kind: 'spending' });
  await incomeSourcesRepo.add({
    name: 'Salary',
    amountPence: 3000, // £3000
    payDateRule: 'nth-of-month',
    payDateDay: 25,
    active: true,
  });
  await recurringBillsRepo.add({
    label: 'Broadband',
    amountPence: 45, // £45
    categoryId: 1,
    frequency: 'monthly',
    nextDueDate: '2026-07-10',
    adjustToWorkingDay: true,
    active: true,
  });
  await debtsRepo.add({
    debtType: 'credit-card',
    name: 'Barclaycard',
    balancePence: 2000, // £2000
    apr: 24,
    creditLimitPence: 5000,
    paymentDayOfMonth: 15,
  });
  await settings.setCurrentBalancePounds(4000); // £4000
  await settings.setBalanceAsOf('2026-07-06');
  await settings.setSafetyBufferPence(20000); // £200
}

describe('Dashboard render (seeded)', () => {
  it('renders the balance, pay period and recommendation', async () => {
    await seed();
    render(<Dashboard />);

    // Balance strip shows the seeded anchor (also echoed as the opening row).
    expect(await screen.findByText('Current balance')).toBeTruthy();
    expect((await screen.findAllByText('£4,000.00')).length).toBeGreaterThan(0);

    // Pay-period panel + recommendation centrepiece render.
    await waitFor(() => {
      expect(screen.getByText(/Pay period/i)).toBeTruthy();
    });
    // With a healthy balance there is spare money to direct at the card.
    expect(await screen.findByText(/Safe to pay extra/i)).toBeTruthy();
    // Barclaycard shows in both the timeline row and the recommendation detail.
    expect(screen.getAllByText(/Barclaycard/).length).toBeGreaterThan(0);
    // The seeded bill appears in the timeline.
    expect(screen.getByText(/Broadband/)).toBeTruthy();
  });
});

describe('Payoff render (seeded)', () => {
  it('renders the strategy comparison and schedule', async () => {
    await seed();
    render(<Payoff />);

    expect(await screen.findByText(/strategy comparison/i)).toBeTruthy();
    expect(screen.getByText('Avalanche (highest APR first)')).toBeTruthy();
    expect(screen.getByText('Minimums only')).toBeTruthy();
    expect(screen.getByText(/Month-by-month schedule/i)).toBeTruthy();
    expect(screen.getByText(/Balance-transfer modeler/i)).toBeTruthy();
  });

  it('shows the empty state when there are no debts', async () => {
    // Only income seeded, no debts.
    await incomeSourcesRepo.add({
      name: 'Salary',
      amountPence: 3000,
      payDateRule: 'nth-of-month',
      payDateDay: 25,
      active: true,
    });
    await settings.setCurrentBalancePounds(4000);
    render(<Payoff />);
    expect(await screen.findByText(/nothing to plan/i)).toBeTruthy();
  });
});
