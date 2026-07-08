import { describe, it, expect } from 'vitest';
import { toFinanceDebts, debtFreeProjection } from './payoff.js';

// All fixtures are pence-domain (planData shape).
const card = (over = {}) => ({
  id: 1,
  name: 'Visa',
  debtType: 'credit-card',
  balancePence: 100000, // £1,000
  apr: 20,
  paymentDayOfMonth: 15,
  ...over,
});
const loan = (over = {}) => ({
  id: 2,
  name: 'Car loan',
  debtType: 'loan',
  balancePence: 500000, // £5,000
  interestRate: 6,
  fixedMonthlyPaymentPence: 25000, // £250
  paymentDayOfMonth: 28,
  ...over,
});

describe('toFinanceDebts', () => {
  it('splits cards and loans into the finance-module shapes', () => {
    const { cards, loans } = toFinanceDebts([card(), loan()]);
    expect(cards).toEqual([
      { id: 1, name: 'Visa', currentBalance: 100000, apr: 20, promoEndDate: null },
    ]);
    expect(loans).toEqual([
      {
        id: 2,
        name: 'Car loan',
        currentBalance: 500000,
        interestRate: 6,
        fixedMonthlyPayment: 25000,
        earlyRepaymentAllowed: true,
        earlyRepaymentFee: 0,
      },
    ]);
  });

  it('drops cleared debts and omits a blank postPromoApr (H1 fallback)', () => {
    const { cards } = toFinanceDebts([
      card({ balancePence: 0 }),
      card({ id: 3, postPromoApr: null }),
    ]);
    expect(cards).toHaveLength(1);
    expect('postPromoApr' in cards[0]).toBe(false);
  });
});

describe('debtFreeProjection', () => {
  it('returns hasDebts false when there is nothing to pay', () => {
    const p = debtFreeProjection([], 'avalanche', 0, '2026-07-01');
    expect(p).toEqual({
      hasDebts: false,
      monthsToClear: 0,
      clearMonth: null,
      neverClears: false,
      totalInterestPence: 0,
    });
  });

  it('a fixed-payment loan clears on schedule (£5,000 at 0%, £250/month = 20 months)', () => {
    const p = debtFreeProjection([loan({ interestRate: 0 })], 'avalanche', 0, '2026-07-01');
    expect(p.hasDebts).toBe(true);
    expect(p.monthsToClear).toBe(20);
    // Month 1 = Jul 2026, so month 20 = Feb 2028.
    expect(p.clearMonth).toBe('2028-02');
    expect(p.neverClears).toBe(false);
  });

  it('the debt-free month is the LATER of the card plan and the loan plan', () => {
    const p = debtFreeProjection([card(), loan({ interestRate: 0 })], 'avalanche', 0, '2026-07-01');
    // The card at minimums takes longer than 20 months; the loan finishes first.
    expect(p.monthsToClear).toBeGreaterThanOrEqual(20);
    expect(p.totalInterestPence).toBeGreaterThan(0);
  });

  it('extra payment shortens the card plan', () => {
    const slow = debtFreeProjection([card()], 'avalanche', 0, '2026-07-01');
    const fast = debtFreeProjection([card()], 'avalanche', 20000, '2026-07-01');
    expect(fast.monthsToClear).toBeLessThan(slow.monthsToClear);
    expect(fast.totalInterestPence).toBeLessThan(slow.totalInterestPence);
  });

  it('flags a loan whose payment never covers the interest as not clearing', () => {
    // £5,000 at 60%: monthly interest £250 = the whole payment; balance never falls.
    const p = debtFreeProjection(
      [loan({ interestRate: 60, fixedMonthlyPaymentPence: 25000 })],
      'avalanche',
      0,
      '2026-07-01'
    );
    expect(p.neverClears).toBe(true);
    expect(p.clearMonth).toBeNull();
  });
});
