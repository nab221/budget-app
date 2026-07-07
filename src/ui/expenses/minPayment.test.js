import { describe, it, expect } from 'vitest';
import { resolveMinPayment, debtMonthlyPence } from './minPayment.js';
import { toPence } from '../../engine/currency.js';

describe('resolveMinPayment', () => {
  it('computes the min payment in pence from a pounds balance', () => {
    // Repo gives pounds; engine works in pence. £1000 balance, 20% APR.
    const { pence, isOverride } = resolveMinPayment({ balancePence: 1000, apr: 20 });
    expect(isOverride).toBe(false);
    // 1% (1000p) + monthly interest (~1667p) = 2667p, above the 2.25% and £5 floors.
    expect(pence).toBe(2667);
  });

  it('picks the override over the computed figure', () => {
    const { pence, isOverride } = resolveMinPayment({
      balancePence: 1000, // would compute a non-2500 figure
      apr: 20,
      minPaymentOverridePence: 25, // pounds off the repo
    });
    expect(isOverride).toBe(true);
    expect(pence).toBe(toPence(25)); // 2500
  });

  it('returns 0 pence for a cleared balance', () => {
    const { pence } = resolveMinPayment({ balancePence: 0, apr: 20 });
    expect(pence).toBe(0);
  });
});

describe('debtMonthlyPence', () => {
  it('uses the computed minimum payment for a credit card', () => {
    const debt = { debtType: 'credit-card', balancePence: 1000, apr: 20 };
    expect(debtMonthlyPence(debt)).toBe(resolveMinPayment(debt).pence);
    expect(debtMonthlyPence(debt)).toBe(2667);
  });

  it('honours a credit-card min-payment override', () => {
    const debt = {
      debtType: 'credit-card',
      balancePence: 1000,
      apr: 20,
      minPaymentOverridePence: 25, // pounds off the repo
    };
    expect(debtMonthlyPence(debt)).toBe(toPence(25)); // 2500
  });

  it('uses the fixed monthly payment (pounds → pence) for a loan', () => {
    const debt = { debtType: 'loan', fixedMonthlyPaymentPence: 150 }; // £150 off the repo
    expect(debtMonthlyPence(debt)).toBe(toPence(150)); // 15000
  });

  it('returns 0 pence for a loan with no fixed payment set', () => {
    expect(debtMonthlyPence({ debtType: 'loan' })).toBe(0);
  });
});
