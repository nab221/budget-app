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
import DebtsTable from './DebtsTable.jsx';
import ExpensesTable from './ExpensesTable.jsx';
import ByDateList from './ByDateList.jsx';
import { buildByDate } from './byDate.js';

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

    // Monthly approximation appears both per card and in the group subtotal:
    // Visa min £50 (card + Credit cards header), Car loan £250 (card + Loans header).
    expect(screen.getAllByText('£50.00').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('£250.00').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/\/ month/).length).toBeGreaterThanOrEqual(4);
  });

  it('opens the edit form in a modal dialog', async () => {
    await seed();
    render(<Expenses />);
    await screen.findByText('Visa');

    // No dialog until an Edit button is clicked.
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    // The debt form is inside, pre-filled with the debt's name.
    expect(screen.getByDisplayValue('Visa')).toBeTruthy();

    // Escape closes it.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
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

  it('switches to the Table view, hides card actions, and remembers the view', async () => {
    await seed();
    const first = render(<Expenses />);
    await screen.findByText('Visa');
    expect(screen.getAllByRole('button', { name: 'Update balance' }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(await screen.findByRole('heading', { name: 'Debts' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recurring expenses' })).toBeTruthy();
    // Debt totals: £1,000 + £5,000 balance; £50 + £250 payment.
    expect(screen.getByText('£6,000.00')).toBeTruthy();
    expect(screen.getByText('£300.00')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update balance' })).toBeNull();
    // The period strip is still there.
    expect(screen.getByText('Going out — July 2026')).toBeTruthy();

    first.unmount();
    render(<Expenses />);
    expect(await screen.findByRole('heading', { name: 'Debts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Table' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('jumps from a table row back to its highlighted card', async () => {
    await seed();
    render(<Expenses />);
    await screen.findByText('Visa');
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    await screen.findByRole('heading', { name: 'Debts' });

    fireEvent.click(screen.getByRole('button', { name: 'Car loan' }));
    // Back on Cards: the loan card is present, carries its id and the highlight.
    const name = await screen.findByText('Car loan');
    const card = name.closest('li');
    expect(card.id).toMatch(/^expense-card-debt-\d+$/);
    expect(card.className).toContain('is-highlight');
    expect(screen.getByRole('button', { name: 'Cards' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'Debts' })).toBeNull();
  });

  it('shows the month by date with gone-out and still-to-go totals', async () => {
    await seed();
    render(<Expenses />);
    await screen.findByText('Visa');
    fireEvent.click(screen.getByRole('button', { name: 'By date' }));

    // Today is Tue 7 Jul: nothing has gone out; all £330 is still to go.
    expect(await screen.findByText('Still to go')).toBeTruthy();
    expect(screen.getByText('Gone out so far').nextSibling.textContent).toBe('£0.00');
    expect(screen.getByText('Still to go').nextSibling.textContent).toBe('£330.00');
    expect(screen.getByText('Today — 7 Jul 2026')).toBeTruthy();
    expect(screen.getByText('Bill · Utilities')).toBeTruthy();

    // The Week period narrows the list to nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText(/Nothing goes out in this period/)).toBeTruthy();
  });

  it('does not blank the tab while a view switch refetches', async () => {
    await seed();
    render(<Expenses />);
    await screen.findByText('Visa');

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    // Synchronous: no "Loading…" flash, and the previous view's data is still there.
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByText('Visa')).toBeTruthy();
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

// Hand-built rows in the shape buildDebtRows / buildExpenseRows return (pence).
const debtRows = [
  { id: 1, domId: 'expense-card-debt-1', name: 'Visa', type: 'Card', balancePence: 100000, ratePercent: 24, promoActive: false, promoEndDate: null, postPromoApr: null, paymentPence: 3000, interestPence: 2000, utilisation: 50, creditLimitPence: 200000, payoffMonth: '2030-06', neverClears: false, nextDate: '2026-07-20', nextAdjusted: false },
  { id: 2, domId: 'expense-card-debt-2', name: 'Promo card', type: 'Card', balancePence: 50000, ratePercent: 0, promoActive: true, promoEndDate: '2026-12-31', postPromoApr: 29, paymentPence: 2500, interestPence: 0, utilisation: null, creditLimitPence: null, payoffMonth: '2028-03', neverClears: false, nextDate: '2026-08-05', nextAdjusted: false },
  { id: 3, domId: 'expense-card-debt-3', name: 'Car loan', type: 'Loan', balancePence: 500000, ratePercent: 6, promoActive: false, promoEndDate: null, postPromoApr: null, paymentPence: 25000, interestPence: 2500, utilisation: null, creditLimitPence: null, payoffMonth: null, neverClears: true, nextDate: '2026-08-01', nextAdjusted: true },
];
const expenseRows = [
  { id: 11, domId: 'expense-card-bill-11', kind: 'bill', name: 'Broadband', category: 'Utilities', amountPence: 3000, frequency: 'monthly', perMonthPence: 3000, perYearPence: 36000, nextDate: '2026-07-15', nextAdjusted: false, status: 'active' },
  { id: 12, domId: 'expense-card-bill-12', kind: 'bill', name: 'Gym', category: 'Uncategorised', amountPence: 4000, frequency: 'monthly', perMonthPence: 0, perYearPence: 0, nextDate: null, nextAdjusted: false, status: 'paused' },
  { id: 'childcare:Ada', domId: 'expense-card-childcare-Ada', kind: 'childcare', name: 'Childcare — Ada', category: 'Childcare', amountPence: 40000, frequency: 'monthly', perMonthPence: 40000, perYearPence: 480000, nextDate: '2026-08-03', nextAdjusted: true, status: 'active' },
];

const bodyNames = () =>
  Array.from(document.querySelectorAll('tbody tr td:first-child')).map((td) => td.textContent);

describe('DebtsTable', () => {
  it('renders rows sorted by rate descending with totals, badges and payoff', () => {
    render(<DebtsTable rows={debtRows} onJump={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Debts' })).toBeTruthy();
    expect(bodyNames()).toEqual(['Visa', 'Car loan', 'Promo card']);
    expect(screen.getByRole('columnheader', { name: /Rate/ }).getAttribute('aria-sort')).toBe('descending');
    // Totals: £6,500 balance, £305 payment, £45 interest.
    expect(screen.getByText('£6,500.00')).toBeTruthy();
    expect(screen.getByText('£305.00')).toBeTruthy();
    expect(screen.getByText('£45.00')).toBeTruthy();
    // Promo badge with the post-promo rate in its tooltip; never-clearing loan; shifted tag.
    expect(screen.getByText('0% until 31 Dec 2026').getAttribute('title')).toBe('Then 29%');
    expect(screen.getByText('Never')).toBeTruthy();
    expect(screen.getByText('Jun 2030')).toBeTruthy();
    expect(screen.getByText('shifted')).toBeTruthy();
    // Utilisation only where there is a limit.
    expect(screen.getByText('50%')).toBeTruthy();
    // Read-only: no card actions.
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update balance' })).toBeNull();
  });

  it('toggles a column ascending then descending and jumps on a name click', () => {
    const onJump = vi.fn();
    render(<DebtsTable rows={debtRows} onJump={onJump} />);
    const balance = screen.getByRole('button', { name: /Balance/ });
    fireEvent.click(balance);
    expect(bodyNames()).toEqual(['Promo card', 'Visa', 'Car loan']);
    expect(screen.getByRole('columnheader', { name: /Balance/ }).getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(balance);
    expect(bodyNames()).toEqual(['Car loan', 'Visa', 'Promo card']);
    expect(screen.getByRole('columnheader', { name: /Balance/ }).getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(screen.getByRole('button', { name: 'Car loan' }));
    expect(onJump).toHaveBeenCalledWith('expense-card-debt-3');
  });

  it('shows an empty state with no debts', () => {
    render(<DebtsTable rows={[]} onJump={() => {}} />);
    expect(screen.getByText(/No credit cards or loans yet/)).toBeTruthy();
  });
});

describe('ExpensesTable', () => {
  it('renders rows sorted by per-month descending with totals and status', () => {
    render(<ExpensesTable rows={expenseRows} onJump={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Recurring expenses' })).toBeTruthy();
    expect(bodyNames()).toEqual(['Childcare — Ada', 'Broadband', 'Gym']);
    // Totals exclude the paused row: £430 / month, £5,160 / year.
    expect(screen.getByText('£430.00')).toBeTruthy();
    expect(screen.getByText('£5,160.00')).toBeTruthy();
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Utilities')).toBeTruthy();
    expect(screen.getByText('Childcare')).toBeTruthy();
    expect(screen.getByText('shifted')).toBeTruthy();
    // Paused row is muted.
    expect(screen.getByRole('button', { name: 'Gym' }).closest('tr').className).toContain('is-inactive');
  });

  it('sorts by name and jumps on a name click', () => {
    const onJump = vi.fn();
    render(<ExpensesTable rows={expenseRows} onJump={onJump} />);
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
    expect(bodyNames()).toEqual(['Broadband', 'Childcare — Ada', 'Gym']);
    fireEvent.click(screen.getByRole('button', { name: 'Broadband' }));
    expect(onJump).toHaveBeenCalledWith('expense-card-bill-11');
  });
});

describe('ByDateList', () => {
  // Engine-shape pence data: bill 15th, Visa 20th, loan 28th each month.
  const data = {
    recurringBills: [
      { id: 11, label: 'Broadband', amountPence: 3000, frequency: 'monthly', nextDueDate: '2026-07-15', dueDayAnchor: 15, adjustToWorkingDay: false, active: true },
    ],
    debts: [
      { id: 1, name: 'Visa', debtType: 'credit-card', balancePence: 100000, apr: 0, minPaymentOverridePence: 5000, paymentDayOfMonth: 20 },
      { id: 3, name: 'Car loan', debtType: 'loan', balancePence: 500000, interestRate: 6, fixedMonthlyPaymentPence: 25000, paymentDayOfMonth: 28 },
    ],
    childcareDeposits: [],
  };
  const cats = new Map([[11, 'Utilities']]);
  const statValue = (label) => screen.getByText(label).nextSibling.textContent;

  it('lists a month by day with kinds, running totals, a today divider and the footer', () => {
    const byDate = buildByDate(data, '2026-07-01', '2026-08-01', '2026-07-21');
    const onJump = vi.fn();
    render(<ByDateList byDate={byDate} period="month" todayStr="2026-07-21" categoryByBillId={cats} onJump={onJump} />);

    expect(screen.getByText('15 Jul 2026')).toBeTruthy();
    expect(screen.getByText('Bill · Utilities')).toBeTruthy();
    expect(screen.getByText('Card')).toBeTruthy();
    expect(screen.getByText('Loan')).toBeTruthy();
    // Running totals: £30 → £80 → £330.
    expect(screen.getByText('£80.00', { selector: '.bydate__running' })).toBeTruthy();
    expect(screen.getAllByText('£330.00').length).toBeGreaterThanOrEqual(1);
    // Today divider sits between the 20th and the 28th.
    expect(screen.getByText('Today — 21 Jul 2026')).toBeTruthy();
    expect(statValue('Gone out so far')).toBe('£80.00');
    expect(statValue('Still to go')).toBe('£250.00');
    expect(statValue('Period total')).toBe('£330.00');
    // Past days are muted.
    expect(screen.getByText('15 Jul 2026').closest('.day-group').className).toContain('is-past');
    expect(screen.getByText('28 Jul 2026').closest('.day-group').className).not.toContain('is-past');

    fireEvent.click(screen.getByRole('button', { name: 'Broadband' }));
    expect(onJump).toHaveBeenCalledWith('expense-card-bill-11');
  });

  it('rolls the year up into months that expand on click', () => {
    const byDate = buildByDate(data, '2026-07-01', '2027-01-01', '2026-07-21');
    render(<ByDateList byDate={byDate} period="year" todayStr="2026-07-21" categoryByBillId={cats} onJump={() => {}} />);

    // Six month rows, collapsed: no day headings yet.
    expect(screen.getByRole('button', { name: /Jul 2026/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dec 2026/ })).toBeTruthy();
    expect(screen.queryByText('15 Jul 2026')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Aug 2026/ }));
    expect(screen.getByText('15 Aug 2026')).toBeTruthy(); // adjustToWorkingDay is false, so the 15th stays
  });

  it('shows an empty state when nothing is due', () => {
    const byDate = buildByDate({ recurringBills: [], debts: [], childcareDeposits: [] }, '2026-07-01', '2026-08-01', '2026-07-21');
    render(<ByDateList byDate={byDate} period="month" todayStr="2026-07-21" categoryByBillId={cats} onJump={() => {}} />);
    expect(screen.getByText(/Nothing goes out in this period/)).toBeTruthy();
  });

  it('shows a day total only when the day has more than one row', () => {
    // Move the Visa payment onto the 15th so it shares a day with the bill.
    const sameDayData = {
      ...data,
      debts: data.debts.map((d) => (d.name === 'Visa' ? { ...d, paymentDayOfMonth: 15 } : d)),
    };
    const byDate = buildByDate(sameDayData, '2026-07-01', '2026-08-01', '2026-07-21');
    render(<ByDateList byDate={byDate} period="month" todayStr="2026-07-21" categoryByBillId={cats} onJump={() => {}} />);

    const totals = document.querySelectorAll('.day-group__total');
    expect(totals.length).toBe(1);
    expect(totals[0].textContent).toBe('£80.00');
    // The loan's day (28th) has a single row, so no day total there.
    expect(screen.getByText('28 Jul 2026').closest('.day-group').querySelector('.day-group__total')).toBeNull();
  });

  it('renders the today divider after everything when the whole period is past', () => {
    const byDate = buildByDate(data, '2026-07-01', '2026-08-01', '2026-07-31');
    render(<ByDateList byDate={byDate} period="month" todayStr="2026-07-31" categoryByBillId={cats} onJump={() => {}} />);

    const divider = document.querySelector('.bydate__today');
    expect(divider.nextElementSibling.className).toContain('bydate__footer');
    expect(statValue('Still to go')).toBe('£0.00');
  });

  it('marks a year-view month is-past only when every day in it is, with the divider between', () => {
    const byDate = buildByDate(data, '2026-07-01', '2027-01-01', '2026-08-25');
    render(<ByDateList byDate={byDate} period="year" todayStr="2026-08-25" categoryByBillId={cats} onJump={() => {}} />);

    const julMonth = screen.getByRole('button', { name: /Jul 2026/ }).closest('.bydate__month');
    const augMonth = screen.getByRole('button', { name: /Aug 2026/ }).closest('.bydate__month');
    expect(julMonth.className).toContain('is-past');
    expect(augMonth.className).not.toContain('is-past');

    const divider = document.querySelector('.bydate__today');
    expect(divider.nextElementSibling).toBe(augMonth);
  });
});
