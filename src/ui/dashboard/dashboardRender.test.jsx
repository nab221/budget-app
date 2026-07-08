/**
 * Render tests for Dashboard v2 (specs/DASHBOARD-PLAN.md): the KPI strip,
 * insight cards, category breakdown, and cost-of-everything table — all
 * computed live from the schedule, nothing persisted.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import {
  debtsRepo,
  recurringBillsRepo,
  categoriesRepo,
  peopleRepo,
  incomeEventsRepo,
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
    expect(screen.getAllByText('£1,000.00').length).toBeGreaterThan(0);
    // £1,000 at 20% ÷ 12 ≈ £16.67/month interest (label also heads the
    // debt-facts table column).
    expect(screen.getAllByText('Interest / month').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£16.67').length).toBeGreaterThan(0);
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

    const panel = screen.getByText('What everything costs').closest('.panel');
    const table = within(panel).getByRole('table');
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    // Visa £600/yr before Broadband £360/yr.
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Visa (min payment)');
    expect(rows[1]).toContain('Broadband');

    // Sorting by label re-orders.
    fireEvent.click(within(panel).getByRole('button', { name: 'What' }));
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

  it('payment calendar shades due days, navigates months, and lists a selected day', async () => {
    await seed();
    render(<Dashboard />);
    await screen.findByText('Payment calendar');

    // July 2026: Broadband on the 15th (£30) and Visa on the 20th (£50).
    const day15 = screen.getByRole('button', { name: '15 Jul 2026 — £30.00 due' });
    expect(screen.getByRole('button', { name: '20 Jul 2026 — £50.00 due' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2 Jul 2026 — nothing due' })).toBeTruthy();

    // Selecting a day lists its payments.
    fireEvent.click(day15);
    const detail = document.querySelector('.calendar__detail');
    expect(detail.textContent).toContain('Broadband');
    expect(detail.textContent).toContain('£30.00');

    // Month navigation recomputes: August 2026 has its own occurrences
    // (Broadband doesn't shift — seeded with adjustToWorkingDay: false).
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await screen.findByText('August 2026');
    expect(screen.getByRole('button', { name: '15 Aug 2026 — £30.00 due' })).toBeTruthy();
  });

  it('next-12-months panel offers the figures as a table', async () => {
    await seed();
    render(<Dashboard />);
    await screen.findByText('Next 12 months');

    const panel = screen.getByText('Next 12 months').closest('.panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'View as table' }));
    const table = within(panel).getByRole('table');
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(12);
    // Every month: £30 bills + £50 debt = £80 total.
    expect(rows[0].textContent).toContain('Jul 2026');
    expect(rows[0].textContent).toContain('£80.00');
    expect(screen.getByText(/Heaviest month/)).toBeTruthy();
  });

  it('debt facts show utilisation, promo countdown, and per-debt interest', async () => {
    await seed();
    await debtsRepo.add({
      name: 'Amex',
      debtType: 'credit-card',
      balancePence: 500, // £500
      apr: 30,
      creditLimitPence: 2000, // £2,000 limit → 25% used
      promoEndDate: '2026-09-30',
      postPromoApr: 30,
      paymentDayOfMonth: 10,
      balanceAsOf: '2026-07-01',
    });
    render(<Dashboard />);
    await screen.findByText('Debt facts');

    expect(screen.getByText('25% used')).toBeTruthy();
    expect(screen.getByText(/0% ends 30 Sep 2026 \(85 days\)/)).toBeTruthy();
    // Visa £1,000 at 20% → £16.67/month; Amex in promo → £0.00.
    const facts = screen.getByText('Debt facts').closest('.panel');
    expect(facts.textContent).toContain('£16.67');
  });

  it('payoff projection offers plan-vs-minimums as a table with the debt-free month', async () => {
    await seed();
    render(<Dashboard />);
    await screen.findByText('Payoff projection');

    const panel = screen.getByText('Payoff projection').closest('.panel');
    expect(within(panel).getByText(/Debt-free/)).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'View as table' }));
    const table = within(panel).getByRole('table');
    expect(table.textContent).toContain('Your plan');
    expect(table.textContent).toContain('Minimums only');
    // Month 0 at the current £1,000 balance in both columns.
    expect([...table.querySelectorAll('tbody tr')][0].textContent).toContain('£1,000.00');
  });

  it('income & tax strip mirrors the current tax year per person', async () => {
    await seed();
    const personId = await peopleRepo.add({ name: 'Anderson', annualSalaryPence: 90000 }); // £90,000
    await incomeEventsRepo.add({
      personId,
      date: '2026-07-01',
      kind: 'dividend',
      amountPence: 8000, // £8,000 → ANI £98,000, inside the £10k warning band
    });
    render(<Dashboard />);
    await screen.findByText(/Income & tax — 2026-27/);

    expect(screen.getByText('Anderson')).toBeTruthy();
    expect(screen.getByText(/Childcare line \(£100,000\)/)).toBeTruthy();
    // The proximity insight fires too (≈ £2,000 headroom).
    expect(screen.getByText('Anderson is close to the £100,000 line')).toBeTruthy();
  });

  it('print opens the Monthly Money Report with the whole story in tables', async () => {
    await seed();
    window.print = vi.fn();
    render(<Dashboard />);
    await screen.findByText('Reports');

    expect(document.querySelector('.money-report')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Print Monthly Money Report' }));

    const report = document.querySelector('.money-report');
    expect(report).toBeTruthy();
    expect(report.textContent).toContain('Monthly Money Report — July 2026');
    expect(report.textContent).toContain('Where it goes');
    expect(report.textContent).toContain('What everything costs');
    expect(report.textContent).toContain('Broadband');
    expect(report.textContent).toContain('Debt-free');
    await vi.waitFor(() => expect(window.print).toHaveBeenCalled());
    expect(document.body.classList.contains('printing-report')).toBe(true);
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
