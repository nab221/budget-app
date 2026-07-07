/**
 * Integration tests for the Recurring Bills list additions (2026-07-07):
 *  - derived, read-only debt-payment rows (FEATURE A)
 *  - bulk mark-paid across real bills + derived debt rows (FEATURE B)
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { format } from 'date-fns';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import {
  recurringBillsRepo,
  categoriesRepo,
  debtsRepo,
  transactionsRepo,
} from '../../db/repositories.js';
import RecurringBills from './RecurringBills.jsx';

const thisMonth = format(new Date(), 'yyyy-MM');

beforeEach(resetDb);
afterEach(cleanup);

async function seedCategories() {
  await categoriesRepo.add({ name: 'Utilities', kind: 'spending' }); // id 1
  await categoriesRepo.add({ name: 'Debt Payment', kind: 'spending' }); // id 2
}

describe('derived debt-payment rows (FEATURE A)', () => {
  it('renders a read-only debt row with a from Debts badge and no edit/delete', async () => {
    await seedCategories();
    await debtsRepo.add({
      name: 'Visa',
      debtType: 'credit-card',
      balancePence: 2000,
      apr: 24,
      paymentDayOfMonth: 15,
    });

    render(<RecurringBills />);

    const cell = await screen.findByText(/Visa — minimum payment/);
    const row = cell.closest('tr');
    expect(within(row).getByText('from Debts')).toBeTruthy();
    // Read-only: no Edit/Delete/Active toggle on a derived row, only Mark paid.
    expect(within(row).queryByRole('button', { name: /^Edit$/ })).toBeNull();
    expect(within(row).queryByRole('button', { name: /^Delete$/ })).toBeNull();
    expect(within(row).getByRole('button', { name: /mark paid/i })).toBeTruthy();
  });

  it('mark paid on a debt row creates a debt-linked transaction and drops the row', async () => {
    await seedCategories();
    await debtsRepo.add({
      name: 'Visa',
      debtType: 'credit-card',
      balancePence: 2000,
      apr: 24,
      paymentDayOfMonth: 15,
    });

    render(<RecurringBills />);
    const cell = await screen.findByText(/Visa — minimum payment/);
    const row = cell.closest('tr');

    fireEvent.click(within(row).getByRole('button', { name: /mark paid/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^confirm$/i }));

    await waitFor(async () => {
      const occ = await transactionsRepo.debtPaymentOccurrences();
      expect(occ).toHaveLength(1);
    });

    const occ = await transactionsRepo.debtPaymentOccurrences();
    expect(occ[0].debtId).toBeGreaterThan(0);
    // Balance untouched.
    const debts = await debtsRepo.getAll();
    expect(debts[0].balancePence).toBe(2000);
    // The paid occurrence drops: the derived row advances to a later date, so
    // the just-paid date no longer appears in the table. (Scope to the table —
    // the info banner echoes the row label too.)
    const paidDate = occ[0].date;
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).queryByText(paidDate)).toBeNull();
    });
    // The debt row is still present (advanced, not removed).
    const table = screen.getByRole('table');
    expect(within(table).getByText(/Visa — minimum payment/)).toBeTruthy();
  });
});

describe('bulk mark-paid (FEATURE B)', () => {
  it('confirms every selected row (bills + debt) in one action, creating a txn each', async () => {
    await seedCategories();
    await recurringBillsRepo.add({
      label: 'Netflix',
      amountPence: 10,
      categoryId: 1,
      frequency: 'monthly',
      nextDueDate: `${thisMonth}-05`,
      adjustToWorkingDay: true,
      active: true,
    });
    await recurringBillsRepo.add({
      label: 'Spotify',
      amountPence: 12,
      categoryId: 1,
      frequency: 'monthly',
      nextDueDate: `${thisMonth}-08`,
      adjustToWorkingDay: true,
      active: true,
    });
    await debtsRepo.add({
      name: 'Visa',
      debtType: 'credit-card',
      balancePence: 2000,
      apr: 24,
      paymentDayOfMonth: 15,
    });

    render(<RecurringBills />);
    await screen.findByText('Netflix');
    await screen.findByText(/Visa — minimum payment/);

    // Select all three rows.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach((cb) => fireEvent.click(cb));

    fireEvent.click(screen.getByRole('button', { name: /mark selected paid \(3\)/i }));
    // Single summarising ConfirmDialog.
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /mark paid/i }));

    await waitFor(async () => {
      const all = await transactionsRepo.getAll();
      expect(all).toHaveLength(3);
    });

    const all = await transactionsRepo.getAll();
    expect(all.filter((t) => t.billId != null)).toHaveLength(2);
    expect(all.filter((t) => t.debtId != null)).toHaveLength(1);
  });
});
