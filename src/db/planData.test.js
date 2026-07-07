import { describe, it, expect } from 'vitest';
import { childcareDepositsFromChildren } from './planData.js';

/**
 * `childcareDepositsFromChildren` takes children as the repo returns them
 * (POUNDS at the edge) and produces the pence-domain `childcareDeposits` entries
 * the plan engine consumes: one per child with a required deposit > 0.
 */
describe('childcareDepositsFromChildren', () => {
  it('emits one entry per child needing a deposit, in pence, with kind wiring', () => {
    const children = [
      // cost £500, balance £100 → gap £400 → deposit £320 (32000p)
      {
        id: 1,
        name: 'Ava',
        providerMonthlyCostPence: 500,
        tfcBalancePence: 100,
        isDisabled: false,
        paymentDayOfMonth: 5,
      },
    ];
    const deposits = childcareDepositsFromChildren(children);
    expect(deposits).toEqual([
      {
        label: 'Childcare — Ava',
        amountPence: 32000,
        paymentDayOfMonth: 5,
        adjustToWorkingDay: true,
      },
    ]);
  });

  it('skips children whose balance already covers the cost (deposit 0)', () => {
    const children = [
      { id: 1, name: 'Ben', providerMonthlyCostPence: 400, tfcBalancePence: 500 },
    ];
    expect(childcareDepositsFromChildren(children)).toEqual([]);
  });

  it('defaults and clamps the payment day to 1–28', () => {
    const children = [
      { id: 1, name: 'NoDay', providerMonthlyCostPence: 500, tfcBalancePence: 0 },
      { id: 2, name: 'Big', providerMonthlyCostPence: 500, tfcBalancePence: 0, paymentDayOfMonth: 31 },
    ];
    const deposits = childcareDepositsFromChildren(children);
    expect(deposits[0].paymentDayOfMonth).toBe(1);
    expect(deposits[1].paymentDayOfMonth).toBe(28);
  });

  it('returns [] for no children', () => {
    expect(childcareDepositsFromChildren([])).toEqual([]);
    expect(childcareDepositsFromChildren(undefined)).toEqual([]);
  });
});
