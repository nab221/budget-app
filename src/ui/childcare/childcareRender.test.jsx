/**
 * Integration smoke test for the Childcare tab: seed a child through the REAL
 * childrenRepo (real Dexie over fake-indexeddb) and render the real Childcare
 * component. Confirms the per-child card renders the provider cost and the
 * computed required deposit + top-up breakdown.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { childrenRepo } from '../../db/repositories.js';
import Childcare from '../Childcare.jsx';

beforeEach(resetDb);
afterEach(cleanup);

describe('Childcare tab (seeded)', () => {
  it('renders a child card with the computed required deposit and breakdown', async () => {
    // cost £500, balance £100 → gap £400 → deposit £320, gov adds £80.
    await childrenRepo.add({
      name: 'Ava',
      providerMonthlyCostPence: 500,
      tfcBalancePence: 100,
      tfcBalanceAsOf: new Date().toISOString().slice(0, 10),
      isDisabled: false,
      paymentDayOfMonth: 5,
    });

    render(<Childcare />);

    expect(await screen.findByText('Ava')).toBeTruthy();
    expect(screen.getByText('Required monthly deposit')).toBeTruthy();
    // £320.00 appears (deposit) and the breakdown mentions the £80.00 top-up.
    expect(screen.getAllByText('£320.00').length).toBeGreaterThan(0);
    expect(screen.getByText(/government adds/i)).toBeTruthy();
    expect(screen.getByText('£80.00')).toBeTruthy();
  });

  it('shows an empty state when there are no children', async () => {
    render(<Childcare />);
    expect(await screen.findByText(/No children yet/i)).toBeTruthy();
  });
});
