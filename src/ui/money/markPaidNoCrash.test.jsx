import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { format } from 'date-fns';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { recurringBillsRepo, categoriesRepo } from '../../db/repositories.js';
import RecurringBills from './RecurringBills.jsx';

const thisMonth = format(new Date(), 'yyyy-MM');

beforeEach(resetDb);
afterEach(cleanup);

describe('BUG1 repro: mark paid confirm', () => {
  it('does not crash after confirming mark-paid', async () => {
    await categoriesRepo.add({ name: 'Utilities', kind: 'spending' }); // id 1
    await recurringBillsRepo.add({
      label: 'Netflix',
      amountPence: 12.5,
      categoryId: 1,
      frequency: 'monthly',
      nextDueDate: `${thisMonth}-15`,
      adjustToWorkingDay: true,
      active: true,
    });

    render(<RecurringBills />);
    await screen.findByText('Netflix');

    fireEvent.click(screen.getByRole('button', { name: /mark paid/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^confirm$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Marked "Netflix" paid/i)).toBeTruthy();
    });
  });
});
