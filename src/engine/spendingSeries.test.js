import { describe, it, expect } from 'vitest';
import { dailyTotalsPence, monthlySeriesPence } from './spending.js';

// Pence-domain fixtures (planData shape). July 2026: 1st is a Wednesday.
const data = {
  recurringBills: [
    {
      id: 1,
      label: 'Broadband',
      amountPence: 3000,
      frequency: 'monthly',
      nextDueDate: '2026-07-15',
      dueDayAnchor: 15,
      adjustToWorkingDay: false,
      active: true,
    },
    {
      id: 2,
      label: 'Insurance',
      amountPence: 60000,
      frequency: 'annual',
      nextDueDate: '2026-09-10',
      dueDayAnchor: 10,
      adjustToWorkingDay: false,
      active: true,
    },
  ],
  debts: [
    {
      id: 1,
      name: 'Visa',
      debtType: 'credit-card',
      balancePence: 100000,
      apr: 0,
      minPaymentOverridePence: 5000,
      paymentDayOfMonth: 15, // same day as broadband — totals must merge
    },
  ],
  childcareDeposits: [
    { label: 'Childcare — Ada', amountPence: 10000, paymentDayOfMonth: 1 },
  ],
};

describe('dailyTotalsPence', () => {
  it('sums all occurrences landing on the same day', () => {
    const totals = dailyTotalsPence(data, '2026-07-01', '2026-08-01');
    // 15 Jul (Wed): broadband £30 + Visa min £50 = £80.
    expect(totals.get('2026-07-15')).toBe(8000);
    // 1 Jul (Wed, working day): childcare £100.
    expect(totals.get('2026-07-01')).toBe(10000);
    // Days with nothing due are absent.
    expect(totals.has('2026-07-02')).toBe(false);
  });
});

describe('monthlySeriesPence', () => {
  it('groups each month into bills / debt / childcare and finds lumpy months', () => {
    const series = monthlySeriesPence(data, '2026-07-07', 12);
    expect(series).toHaveLength(12);
    expect(series[0].month).toBe('2026-07');
    expect(series[11].month).toBe('2027-06');

    // A regular month: £30 bills + £50 debt + £100 childcare.
    expect(series[0]).toMatchObject({
      billsPence: 3000,
      debtPence: 5000,
      childcarePence: 10000,
      totalPence: 18000,
    });

    // September is lumpy: the £600 annual premium lands there — once a year.
    const september = series.find((m) => m.month === '2026-09');
    expect(september.billsPence).toBe(63000);
    const insuranceMonths = series.filter((m) => m.billsPence > 3000);
    expect(insuranceMonths).toHaveLength(1);
  });

  it('spans year boundaries with correct month labels', () => {
    const series = monthlySeriesPence(data, '2026-11-20', 4);
    expect(series.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });
});
