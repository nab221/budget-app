import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { defaultExtraPence, buildStrategyComparison, toFinanceDebts } from './payoffModel.js';
import { settings } from '../../db/settings.js';

describe('defaultExtraPence', () => {
  it('defaults to the live safeExtra when nothing is persisted', () => {
    expect(defaultExtraPence(null, 5000)).toBe(5000);
    expect(defaultExtraPence(0, 5000)).toBe(5000);
  });

  it('uses the persisted extra once the owner has set one', () => {
    expect(defaultExtraPence(8000, 5000)).toBe(8000);
  });

  it('falls back to zero when neither is available', () => {
    expect(defaultExtraPence(null, null)).toBe(0);
    expect(defaultExtraPence(0, 0)).toBe(0);
  });
});

describe('buildStrategyComparison', () => {
  const debts = [
    { id: 1, name: 'A', currentBalance: 200000, apr: 25 },
    { id: 2, name: 'B', currentBalance: 100000, apr: 12 },
  ];

  it('measures interest saved against the minimums-only baseline', () => {
    const cmp = buildStrategyComparison(debts, 20000, '2026-03-01');
    const min = cmp.rows.find((r) => r.key === 'min');
    const avalanche = cmp.rows.find((r) => r.key === 'avalanche');
    expect(min.interestSavedPence).toBe(0);
    expect(avalanche.totalInterestPence).toBeLessThan(min.totalInterestPence);
    expect(avalanche.interestSavedPence).toBeGreaterThan(0);
    expect(avalanche.monthsToClear).toBeLessThan(min.monthsToClear);
  });
});

describe('toFinanceDebts', () => {
  it('splits cards and loans and drops cleared debts', () => {
    const { cards, loans } = toFinanceDebts([
      { id: 1, name: 'Card', debtType: 'credit-card', balancePence: 100000, apr: 20 },
      { id: 2, name: 'Loan', debtType: 'loan', balancePence: 500000, interestRate: 5, fixedMonthlyPaymentPence: 25000 },
      { id: 3, name: 'Paid', debtType: 'credit-card', balancePence: 0, apr: 20 },
    ]);
    expect(cards.map((c) => c.id)).toEqual([1]);
    expect(loans.map((l) => l.id)).toEqual([2]);
    expect(loans[0].earlyRepaymentAllowed).toBe(true);
  });
});

describe('null postPromoApr accrues interest at the card APR (H1)', () => {
  it('a plain card with postPromoApr null is simulated at its real APR, not 0%', () => {
    // Repro: £3,000 @ 24.9%, no promo, postPromoApr stored as null by the form.
    const { cards } = toFinanceDebts([
      {
        id: 1,
        name: 'Barclaycard',
        debtType: 'credit-card',
        balancePence: 300000,
        apr: 24.9,
        promoEndDate: null,
        postPromoApr: null,
      },
    ]);
    // The null must not survive into the finance shape (it would read as 0% APR).
    expect(cards[0].postPromoApr).toBeUndefined();

    const cmp = buildStrategyComparison(cards, 0, '2026-01-01');
    const min = cmp.rows.find((r) => r.key === 'min');
    // At 0% the £3k would clear in ~159 months with £0 interest — the bug. At
    // 24.9% it accrues thousands of pounds of interest over a far longer payoff.
    expect(cmp.baselineInterestPence).toBeGreaterThan(400000); // > £4,000 interest
    expect(min.monthsToClear).toBeGreaterThan(159);
  });
});

describe('payoff settings persistence', () => {
  beforeEach(resetDb);

  it('round-trips the chosen strategy', async () => {
    await settings.setPayoffStrategy('snowball');
    expect(await settings.getPayoffStrategy()).toBe('snowball');
  });

  it('round-trips the extra payment (pence)', async () => {
    await settings.setPayoffExtraPence(7500);
    expect(await settings.getPayoffExtraPence()).toBe(7500);
  });
});
