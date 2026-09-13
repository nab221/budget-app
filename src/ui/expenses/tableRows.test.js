import { describe, it, expect } from 'vitest';
import { cardDomId } from './cardIds.js';
import { buildDebtRows, buildExpenseRows, debtTotals, expenseTotals } from './tableRows.js';

const FROM = '2026-07-07'; // Tue

// Engine-shape (PENCE) fixtures — what mapDebtsToPence / mapBillsToPence return.
const visa = {
  id: 1, name: 'Visa', debtType: 'credit-card', balancePence: 100000, apr: 24,
  creditLimitPence: 200000, promoEndDate: null, postPromoApr: null,
  minPaymentOverridePence: null, paymentDayOfMonth: 20,
};
const promoCard = {
  id: 2, name: 'Promo card', debtType: 'credit-card', balancePence: 50000, apr: 22,
  creditLimitPence: null, promoEndDate: '2026-12-31', postPromoApr: 29,
  minPaymentOverridePence: 2500, paymentDayOfMonth: 5,
};
const loan = {
  id: 3, name: 'Car loan', debtType: 'loan', balancePence: 500000, interestRate: 6,
  fixedMonthlyPaymentPence: 25000, paymentDayOfMonth: 28,
};
const cleared = {
  id: 4, name: 'Old card', debtType: 'credit-card', balancePence: 0, apr: 30,
  creditLimitPence: 100000, promoEndDate: null, postPromoApr: null,
  minPaymentOverridePence: null, paymentDayOfMonth: 1,
};
const hopeless = {
  id: 5, name: 'Stuck loan', debtType: 'loan', balancePence: 500000, interestRate: 12,
  fixedMonthlyPaymentPence: 1000, paymentDayOfMonth: 1,
};

describe('cardDomId', () => {
  it('is stable and safe for any key', () => {
    expect(cardDomId('debt', 7)).toBe('expense-card-debt-7');
    expect(cardDomId('childcare', 'Childcare — Ada')).toBe('expense-card-childcare-Childcare___Ada');
  });
});

describe('buildDebtRows', () => {
  const rows = buildDebtRows({ debts: [visa, promoCard, loan, cleared, hopeless], strategy: 'avalanche', extraPence: 0, fromStr: FROM });
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

  it('builds a card row: effective rate, min payment, interest, utilisation, next date', () => {
    const r = byName.Visa;
    expect(r.type).toBe('Card');
    expect(r.domId).toBe('expense-card-debt-1');
    expect(r.ratePercent).toBe(24);
    expect(r.promoActive).toBe(false);
    // UK min: max(1% + interest, 2.25%, £5) = max(1000 + 2000, 2250, 500) = £30.
    expect(r.paymentPence).toBe(3000);
    expect(r.interestPence).toBe(2000); // 100000 × 24% ÷ 12
    expect(r.utilisation).toBe(50);
    expect(r.creditLimitPence).toBe(200000);
    expect(r.payoffMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(r.neverClears).toBe(false);
    expect(r.nextDate).toBe('2026-07-20');
    expect(r.nextAdjusted).toBe(false);
  });

  it('shows 0% with the post-promo rate while a promo is active, and honours the override', () => {
    const r = byName['Promo card'];
    expect(r.ratePercent).toBe(0);
    expect(r.promoActive).toBe(true);
    expect(r.promoEndDate).toBe('2026-12-31');
    expect(r.postPromoApr).toBe(29);
    expect(r.interestPence).toBe(0);
    expect(r.paymentPence).toBe(2500);
    expect(r.utilisation).toBeNull(); // no limit
    expect(r.creditLimitPence).toBeNull();
  });

  it('builds a loan row with no utilisation and the fixed payment', () => {
    const r = byName['Car loan'];
    expect(r.type).toBe('Loan');
    expect(r.ratePercent).toBe(6);
    expect(r.paymentPence).toBe(25000);
    expect(r.interestPence).toBe(2500); // 500000 × 6% ÷ 12
    expect(r.utilisation).toBeNull();
    expect(r.payoffMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(r.nextDate).toBe('2026-07-28');
  });

  it('gives a zero-balance debt nothing to pay and no payoff month', () => {
    const r = byName['Old card'];
    expect(r.paymentPence).toBe(0);
    expect(r.interestPence).toBe(0);
    expect(r.utilisation).toBe(0);
    expect(r.payoffMonth).toBeNull();
    expect(r.neverClears).toBe(false);
    expect(r.nextDate).toBeNull();
  });

  it('flags a loan whose payment never covers the interest as never clearing', () => {
    const r = byName['Stuck loan'];
    expect(r.payoffMonth).toBeNull();
    expect(r.neverClears).toBe(true);
  });

  it('dates the payoff month from fromStr (a loan cleared in month 1 clears this month)', () => {
    const tiny = { ...loan, id: 9, name: 'Tiny', balancePence: 1000 };
    const [r] = buildDebtRows({ debts: [tiny], strategy: 'avalanche', extraPence: 0, fromStr: FROM });
    expect(r.payoffMonth).toBe('2026-07');
  });

  it('clamps utilisation to 100', () => {
    const over = { ...visa, id: 10, balancePence: 250000 };
    const [r] = buildDebtRows({ debts: [over], strategy: 'avalanche', extraPence: 0, fromStr: FROM });
    expect(r.utilisation).toBe(100);
  });

  it('totals balance, payment and interest', () => {
    expect(debtTotals(rows)).toEqual({
      balancePence: 100000 + 50000 + 500000 + 0 + 500000,
      paymentPence: 3000 + 2500 + 25000 + 0 + 1000,
      interestPence: 2000 + 0 + 2500 + 0 + 5000,
    });
  });
});

describe('buildExpenseRows', () => {
  const categories = [{ id: 1, name: 'Utilities', kind: 'spending' }];
  const broadband = {
    id: 11, label: 'Broadband', amountPence: 3000, categoryId: 1, frequency: 'monthly',
    nextDueDate: '2026-07-15', dueDayAnchor: 15, adjustToWorkingDay: false, active: true,
  };
  const gym = { ...broadband, id: 12, label: 'Gym', amountPence: 4000, categoryId: 99, active: false };
  const old = { ...broadband, id: 13, label: 'Old sub', nextDueDate: '2026-01-10', dueDayAnchor: 10, endDate: '2026-03-01' };
  const weekly = { ...broadband, id: 14, label: 'Milk', amountPence: 500, frequency: 'weekly', nextDueDate: '2026-07-09' };
  const deposit = { label: 'Childcare — Ada', amountPence: 40000, paymentDayOfMonth: 1, adjustToWorkingDay: true };

  const rows = buildExpenseRows({ bills: [broadband, gym, old, weekly], childcareDeposits: [deposit], categories, fromStr: FROM });
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

  it('builds an active monthly bill row', () => {
    const r = byName.Broadband;
    expect(r).toMatchObject({
      kind: 'bill', domId: 'expense-card-bill-11', category: 'Utilities', amountPence: 3000,
      frequency: 'monthly', perMonthPence: 3000, perYearPence: 36000,
      nextDate: '2026-07-15', nextAdjusted: false, status: 'active',
    });
  });

  it('marks a paused bill and zeroes its per-period figures', () => {
    const r = byName.Gym;
    expect(r.status).toBe('paused');
    expect(r.category).toBe('Uncategorised');
    expect(r.amountPence).toBe(4000); // the amount is still shown
    expect(r.perMonthPence).toBe(0);
    expect(r.perYearPence).toBe(0);
    expect(r.nextDate).toBeNull();
  });

  it('marks an ended bill and zeroes its per-period figures', () => {
    const r = byName['Old sub'];
    expect(r.status).toBe('ended');
    expect(r.perYearPence).toBe(0);
    expect(r.nextDate).toBeNull();
  });

  it('annualises a weekly bill with exact day steps (52.18 a year)', () => {
    const r = byName.Milk;
    expect(r.perYearPence).toBe(Math.round(500 * (365.25 / 7)));
    expect(r.perMonthPence).toBe(Math.round((500 * (365.25 / 7)) / 12));
    expect(r.nextDate).toBe('2026-07-09');
  });

  it('adds a childcare deposit as a monthly row under the Childcare category', () => {
    const r = byName['Childcare — Ada'];
    expect(r).toMatchObject({
      kind: 'childcare', domId: cardDomId('childcare', 'Childcare — Ada'), category: 'Childcare',
      amountPence: 40000, frequency: 'monthly', perMonthPence: 40000, perYearPence: 480000, status: 'active',
    });
    expect(r.nextDate).toBe('2026-08-03'); // 1 Aug 2026 is a Saturday → Mon 3 Aug
    expect(r.nextAdjusted).toBe(true);
  });

  it('totals only active rows', () => {
    expect(expenseTotals(rows)).toEqual({
      perMonthPence: 3000 + Math.round((500 * (365.25 / 7)) / 12) + 40000,
      perYearPence: 36000 + Math.round(500 * (365.25 / 7)) + 480000,
    });
  });
});
