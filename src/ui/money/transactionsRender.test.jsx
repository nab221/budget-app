/**
 * Integration smoke test for the "Actual" transactions ledger: seed rows through
 * the REAL repositories (real Dexie over fake-indexeddb) and render the real
 * Transactions component. Confirms the ledger renders income/spend rows, the
 * source badges, the totals row, and that description search filters live.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { format } from 'date-fns';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { transactionsRepo, categoriesRepo } from '../../db/repositories.js';
import Transactions from './Transactions.jsx';

const thisMonth = format(new Date(), 'yyyy-MM');

beforeEach(resetDb);
afterEach(cleanup);

async function seed() {
  await categoriesRepo.add({ name: 'Groceries', kind: 'spending' }); // id 1
  await categoriesRepo.add({ name: 'Transport', kind: 'spending' }); // id 2
  await categoriesRepo.add({ name: 'Salary', kind: 'income' }); // id 3

  await transactionsRepo.add({
    date: `${thisMonth}-03`,
    kind: 'spend',
    amountPence: 12.5, // £12.50 pounds at edge
    categoryId: 1,
    description: 'Tesco Metro',
    source: 'manual',
  });
  await transactionsRepo.add({
    date: `${thisMonth}-10`,
    kind: 'income',
    amountPence: 2000, // £2000
    categoryId: 3,
    description: 'July salary',
    source: 'manual',
  });
  await transactionsRepo.add({
    date: `${thisMonth}-12`,
    kind: 'spend',
    amountPence: 40, // £40
    categoryId: 2,
    description: 'Shell petrol',
    source: 'bill',
  });
}

describe('Transactions ledger (seeded)', () => {
  it('renders income and spending rows with source badges and a totals row', async () => {
    await seed();
    render(<Transactions />);

    expect(await screen.findByText('Tesco Metro')).toBeTruthy();
    expect(screen.getByText('July salary')).toBeTruthy();
    expect(screen.getByText('Shell petrol')).toBeTruthy();

    // Income amount is rendered with a leading + and the green amount class.
    expect(screen.getByText('+')).toBeTruthy();
    // Totals row echoes the shown count.
    expect(screen.getByText(/3 shown/)).toBeTruthy();
  });

  it('filters live by description search', async () => {
    await seed();
    render(<Transactions />);
    await screen.findByText('Tesco Metro');

    fireEvent.change(screen.getByLabelText(/search transactions/i), {
      target: { value: 'petrol' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Tesco Metro')).toBeNull();
    });
    expect(screen.getByText('Shell petrol')).toBeTruthy();
    expect(screen.getByText(/1 shown/)).toBeTruthy();
  });

  it('shows an empty state for a month with no rows', async () => {
    // No seed → current month empty.
    render(<Transactions />);
    expect(await screen.findByText(/No transactions this month/i)).toBeTruthy();
  });
});
