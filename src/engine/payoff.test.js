import { describe, it, expect } from 'vitest';
import {
  toFinanceDebts,
  debtFreeProjection,
  payoffBalanceSeries,
  actualDebtPoints,
} from './payoff.js';

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

describe('payoffBalanceSeries', () => {
  it('starts at current balances and both series fall to zero', () => {
    const series = payoffBalanceSeries([card(), loan({ interestRate: 0 })], 'avalanche', 0, '2026-07-01');
    expect(series[0]).toEqual({
      month: '2026-07',
      chosenPence: 600000,
      minimumsPence: 600000,
    });
    const last = series[series.length - 1];
    expect(last.chosenPence).toBe(0);
    expect(last.minimumsPence).toBe(0);
    // Balances never rise along either series (payments always cover interest here).
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i].chosenPence).toBeLessThanOrEqual(series[i - 1].chosenPence);
      expect(series[i].minimumsPence).toBeLessThanOrEqual(series[i - 1].minimumsPence);
    }
  });

  it('the extra-payment plan stays at or below the minimums-only line', () => {
    const series = payoffBalanceSeries([card()], 'avalanche', 20000, '2026-07-01');
    for (const m of series) {
      expect(m.chosenPence).toBeLessThanOrEqual(m.minimumsPence);
    }
    // …and reaches zero strictly earlier.
    const chosenZero = series.findIndex((m) => m.chosenPence === 0);
    const minZero = series.findIndex((m) => m.minimumsPence === 0);
    expect(chosenZero).toBeLessThan(minZero);
  });

  it('is empty with nothing to pay', () => {
    expect(payoffBalanceSeries([], 'avalanche', 0, '2026-07-01')).toEqual([]);
  });
});

describe('actualDebtPoints', () => {
  const debts = [{ id: 1 }, { id: 2 }];

  it('emits a point only once every debt has a logged balance', () => {
    const points = actualDebtPoints(
      [
        { id: 10, debtId: 1, date: '2026-07-01', balancePence: 100000 },
        // Debt 2 unknown until the 5th — no point on the 1st.
        { id: 11, debtId: 2, date: '2026-07-05', balancePence: 500000 },
        { id: 12, debtId: 1, date: '2026-08-01', balancePence: 90000 },
      ],
      debts
    );
    expect(points).toEqual([
      { date: '2026-07-05', totalPence: 600000 },
      { date: '2026-08-01', totalPence: 590000 }, // 90000 + latest-known 500000
    ]);
  });

  it('collapses same-day updates into one point and ignores deleted debts', () => {
    const points = actualDebtPoints(
      [
        { id: 1, debtId: 1, date: '2026-07-01', balancePence: 100000 },
        { id: 2, debtId: 2, date: '2026-07-01', balancePence: 500000 },
        { id: 3, debtId: 99, date: '2026-07-02', balancePence: 12345 }, // not a current debt
      ],
      debts
    );
    expect(points).toEqual([{ date: '2026-07-01', totalPence: 600000 }]);
  });

  it('is empty with no debts or no updates', () => {
    expect(actualDebtPoints([], debts)).toEqual([]);
    expect(actualDebtPoints([{ debtId: 1, date: '2026-07-01', balancePence: 1 }], [])).toEqual([]);
  });
});
