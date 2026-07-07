import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import {
  incomeSourcesRepo,
  recurringBillsRepo,
  categoriesRepo,
} from '../../db/repositories.js';
import { settings } from '../../db/settings.js';
import Dashboard from '../Dashboard.jsx';

beforeEach(resetDb);
afterEach(cleanup);

describe('BUG1 repro: dashboard mark paid confirm', () => {
  it('does not crash after confirming a pay-period mark-paid', async () => {
    await categoriesRepo.add({ name: 'Utilities', kind: 'spending' });
    await incomeSourcesRepo.add({
      name: 'Salary',
      amountPence: 3000,
      payDateRule: 'nth-of-month',
      payDateDay: 25,
      active: true,
    });
    await recurringBillsRepo.add({
      label: 'Broadband',
      amountPence: 45,
      categoryId: 1,
      frequency: 'monthly',
      nextDueDate: '2026-07-10',
      adjustToWorkingDay: true,
      active: true,
    });
    await settings.setCurrentBalancePounds(4000);
    await settings.setSafetyBufferPence(20000);

    render(<Dashboard />);
    await screen.findByText(/Broadband/);

    fireEvent.click(screen.getByRole('button', { name: /mark paid/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^confirm$/i }));

    // Regression: after confirm the panel must re-render (not stick on "Loading"
    // / go blank). The paid row appears and the projection recovers.
    await waitFor(() => {
      expect(screen.getByText(/Paid this period/i)).toBeTruthy();
    });
  });
});
