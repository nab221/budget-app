import { describe, it, expect } from 'vitest';
import {
  periodWindow,
  spendingOccurrences,
  actualTotalPence,
  annualisedBillPence,
  annualisedDebtPence,
  annualToPeriodPence,
  normalisedTotalPence,
  nextBillOccurrence,
  nextDebtPayment,
  nextChildcareDeposit,
  upcomingPaymentDays,
  localDayStr,
} from './spending.js';

// ── Fixtures (PENCE domain, like gatherPlanData output) ─────────────────────

const monthlyBill = {
  id: 1,
  label: 'Broadband',
  amountPence: 3000,
  frequency: 'monthly',
  nextDueDate: '2026-07-15',
  dueDayAnchor: 15,
  adjustToWorkingDay: false,
  active: true,
};

const weeklyBill = {
  id: 2,
  label: 'Groceries',
  amountPence: 8000,
  frequency: 'weekly',
  nextDueDate: '2026-07-03', // a Friday
  adjustToWorkingDay: false,
  active: true,
};

const annualBill = {
  id: 3,
  label: 'Car insurance',
  amountPence: 60000,
  frequency: 'annual',
  nextDueDate: '2026-11-10',
  dueDayAnchor: 10,
  adjustToWorkingDay: false,
  active: true,
};

const card = {
  id: 10,
  name: 'Visa',
  debtType: 'credit-card',
  balancePence: 100000,
  apr: 0,
  minPaymentOverridePence: 5000,
  paymentDayOfMonth: 20,
};

const loan = {
  id: 11,
  name: 'Car loan',
  debtType: 'loan',
  fixedMonthlyPaymentPence: 25000,
  balancePence: 500000,
  paymentDayOfMonth: 28,
};

const childcareDeposit = {
  label: 'Childcare — Ada',
  amountPence: 40000,
  paymentDayOfMonth: 1,
  adjustToWorkingDay: true,
};

// ── localDayStr ──────────────────────────────────────────────────────────────

describe('localDayStr', () => {
  it('formats the LOCAL calendar day (not the UTC day)', () => {
    // 00:30 local on 8 Jul — the UTC day may still be 7 Jul in BST, but the
    // user's "today" is the 8th.
    expect(localDayStr(new Date(2026, 6, 8, 0, 30))).toBe('2026-07-08');
    expect(localDayStr(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

// ── periodWindow ─────────────────────────────────────────────────────────────

describe('periodWindow', () => {
  it('month is the containing calendar month', () => {
    expect(periodWindow('month', new Date(2026, 6, 7))).toEqual({
      startStr: '2026-07-01',
      endStr: '2026-08-01',
    });
  });

  it('month rolls the year over in December', () => {
    expect(periodWindow('month', new Date(2026, 11, 25))).toEqual({
      startStr: '2026-12-01',
      endStr: '2027-01-01',
    });
  });

  it('week starts on Monday', () => {
    // 2026-07-07 is a Tuesday → week is Mon 06 Jul to Mon 13 Jul (exclusive).
    expect(periodWindow('week', new Date(2026, 6, 7))).toEqual({
      startStr: '2026-07-06',
      endStr: '2026-07-13',
    });
    // A Sunday belongs to the week that started the previous Monday.
    expect(periodWindow('week', new Date(2026, 6, 12))).toEqual({
      startStr: '2026-07-06',
      endStr: '2026-07-13',
    });
    // A Monday starts its own week.
    expect(periodWindow('week', new Date(2026, 6, 6)).startStr).toBe('2026-07-06');
  });

  it('year is the calendar year', () => {
    expect(periodWindow('year', new Date(2026, 0, 1))).toEqual({
      startStr: '2026-01-01',
      endStr: '2027-01-01',
    });
  });
});

// ── occurrence totals (ACTUAL) ───────────────────────────────────────────────

describe('spendingOccurrences / actualTotalPence', () => {
  it('counts a weekly bill as many times as it lands in the month', () => {
    const data = { recurringBills: [weeklyBill], debts: [] };
    // July 2026: Fridays 3, 10, 17, 24, 31 → five occurrences.
    const rows = spendingOccurrences(data, '2026-07-01', '2026-08-01');
    expect(rows.map((r) => r.date)).toEqual([
      '2026-07-03',
      '2026-07-10',
      '2026-07-17',
      '2026-07-24',
      '2026-07-31',
    ]);
    expect(actualTotalPence(data, '2026-07-01', '2026-08-01')).toBe(5 * 8000);
    // August 2026 only has four Fridays in the cycle: 7, 14, 21, 28.
    expect(actualTotalPence(data, '2026-08-01', '2026-09-01')).toBe(4 * 8000);
  });

  it('annual bill lands only in its month', () => {
    const data = { recurringBills: [annualBill], debts: [] };
    expect(actualTotalPence(data, '2026-07-01', '2026-08-01')).toBe(0);
    expect(actualTotalPence(data, '2026-11-01', '2026-12-01')).toBe(60000);
    expect(actualTotalPence(data, '2026-01-01', '2027-01-01')).toBe(60000);
  });

  it('debts contribute one payment per month (card min + loan fixed)', () => {
    const data = { recurringBills: [], debts: [card, loan] };
    expect(actualTotalPence(data, '2026-07-01', '2026-08-01')).toBe(5000 + 25000);
  });

  it('mixes bills and debts sorted by date', () => {
    const data = { recurringBills: [monthlyBill], debts: [card] };
    const rows = spendingOccurrences(data, '2026-07-01', '2026-08-01');
    expect(rows.map((r) => r.label)).toEqual(['Broadband', 'Visa (min payment)']);
  });

  it('includes monthly childcare deposits', () => {
    const data = { recurringBills: [], debts: [], childcareDeposits: [childcareDeposit] };
    // 1 Aug 2026 is a Saturday → working-day shift to Monday 3 Aug.
    const rows = spendingOccurrences(data, '2026-08-01', '2026-09-01');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: '2026-08-03', amountPence: 40000, isAdjusted: true });
    expect(actualTotalPence(data, '2026-08-01', '2026-09-01')).toBe(40000);
  });

  it('skips inactive bills and cleared cards', () => {
    const data = {
      recurringBills: [{ ...monthlyBill, active: false }],
      debts: [{ ...card, balancePence: 0 }],
    };
    expect(actualTotalPence(data, '2026-07-01', '2026-08-01')).toBe(0);
  });
});

// ── normalised averages ──────────────────────────────────────────────────────

describe('normalised totals', () => {
  it('annualises by frequency', () => {
    expect(annualisedBillPence(monthlyBill)).toBe(36000);
    expect(annualisedBillPence(annualBill)).toBe(60000);
    // weekly: 365.25 / 7 ≈ 52.18 occurrences a year.
    expect(annualisedBillPence(weeklyBill)).toBeCloseTo(8000 * (365.25 / 7), 6);
    expect(annualisedBillPence({ ...monthlyBill, active: false })).toBe(0);
  });

  it('annualises debts as 12 × the monthly payment', () => {
    expect(annualisedDebtPence(card, '2026-07-01')).toBe(60000);
    expect(annualisedDebtPence(loan, '2026-07-01')).toBe(300000);
    expect(annualisedDebtPence({ ...card, balancePence: 0 }, '2026-07-01')).toBe(0);
  });

  it('scales annual figures to the selected period', () => {
    expect(annualToPeriodPence(36000, 'year')).toBe(36000);
    expect(annualToPeriodPence(36000, 'month')).toBe(3000);
    expect(annualToPeriodPence(36525, 'week')).toBe(700);
  });

  it('totals everything for a period', () => {
    const data = { recurringBills: [monthlyBill], debts: [loan] };
    // (30_00 + 250_00) per month.
    expect(normalisedTotalPence(data, 'month', '2026-07-01')).toBe(28000);
    expect(normalisedTotalPence(data, 'year', '2026-07-01')).toBe(336000);
  });

  it('counts childcare deposits as monthly commitments', () => {
    const data = { recurringBills: [], debts: [], childcareDeposits: [childcareDeposit] };
    expect(normalisedTotalPence(data, 'month', '2026-07-01')).toBe(40000);
    expect(normalisedTotalPence(data, 'year', '2026-07-01')).toBe(480000);
  });
});

// ── next occurrences ─────────────────────────────────────────────────────────

describe('nextBillOccurrence', () => {
  it('returns the next occurrence on or after the from date', () => {
    expect(nextBillOccurrence(monthlyBill, '2026-07-07')).toMatchObject({
      date: '2026-07-15',
      amountPence: 3000,
    });
  });

  it('walks a stale nextDueDate forward (no confirmations any more)', () => {
    const stale = { ...monthlyBill, nextDueDate: '2026-03-15' };
    expect(nextBillOccurrence(stale, '2026-07-07')?.date).toBe('2026-07-15');
  });

  it('finds an annual bill months ahead', () => {
    expect(nextBillOccurrence(annualBill, '2026-12-01')?.date).toBe('2027-11-10');
  });

  it('returns null after the end date and for inactive bills', () => {
    const ended = { ...monthlyBill, endDate: '2026-06-30' };
    expect(nextBillOccurrence(ended, '2026-07-07')).toBeNull();
    expect(nextBillOccurrence({ ...monthlyBill, active: false }, '2026-07-07')).toBeNull();
  });

  it('working-day adjusts when the bill opts in', () => {
    // 2026-08-15 is a Saturday → shifts to Monday 17th.
    const wd = { ...monthlyBill, nextDueDate: '2026-08-15', adjustToWorkingDay: true };
    expect(nextBillOccurrence(wd, '2026-08-01')).toMatchObject({
      date: '2026-08-17',
      isAdjusted: true,
    });
  });
});

describe('nextDebtPayment', () => {
  it('cards pay their min on the payment day', () => {
    expect(nextDebtPayment(card, '2026-07-07')).toMatchObject({
      date: '2026-07-20',
      amountPence: 5000,
    });
  });

  it('loans pay the fixed amount', () => {
    expect(nextDebtPayment(loan, '2026-07-07')).toMatchObject({ amountPence: 25000 });
  });

  it('nothing to pay → null', () => {
    expect(nextDebtPayment({ ...card, balancePence: 0 }, '2026-07-07')).toBeNull();
    expect(nextDebtPayment({ ...loan, fixedMonthlyPaymentPence: 0 }, '2026-07-07')).toBeNull();
  });
});

describe('nextChildcareDeposit', () => {
  it('lands on the working-day-adjusted monthly date', () => {
    // 1 Aug 2026 is a Saturday → Monday 3 Aug.
    expect(nextChildcareDeposit(childcareDeposit, '2026-07-15')).toMatchObject({
      date: '2026-08-03',
      isAdjusted: true,
      amountPence: 40000,
    });
  });

  it('nothing to deposit → null', () => {
    expect(nextChildcareDeposit({ ...childcareDeposit, amountPence: 0 }, '2026-07-15')).toBeNull();
  });
});

describe('upcomingPaymentDays', () => {
  // Four expenses all falling on 20 Jul — the case an occurrence-count cap
  // used to slice through.
  const busyDayBills = ['Water', 'Phone', 'Gym', 'Insurance'].map((label, i) => ({
    id: 100 + i,
    label,
    amountPence: 1000 * (i + 1),
    frequency: 'monthly',
    nextDueDate: '2026-07-20',
    dueDayAnchor: 20,
    adjustToWorkingDay: false,
    active: true,
  }));

  it('groups occurrences by date, in date order', () => {
    const data = { recurringBills: [monthlyBill, weeklyBill], debts: [card] };
    const days = upcomingPaymentDays(data, '2026-07-07', 4);
    expect(days.map((d) => d.date)).toEqual([
      '2026-07-10',
      '2026-07-15',
      '2026-07-17',
      '2026-07-20',
    ]);
    expect(days[0].rows.map((r) => r.label)).toEqual(['Groceries']);
  });

  it('never cuts a day mid-way: the last day carries all of its payments', () => {
    const data = { recurringBills: [monthlyBill, ...busyDayBills] };
    const days = upcomingPaymentDays(data, '2026-07-07', 2);
    expect(days.map((d) => d.date)).toEqual(['2026-07-15', '2026-07-20']);
    // The 20th arrives whole — all four rows, so a summed day total is right.
    expect(days[1].rows.map((r) => r.label)).toEqual(['Water', 'Phone', 'Gym', 'Insurance']);
    expect(days[1].rows.reduce((t, r) => t + r.amountPence, 0)).toBe(10000);
  });

  it('bounds the number of days, not the number of payments', () => {
    const data = { recurringBills: [monthlyBill, ...busyDayBills] };
    const days = upcomingPaymentDays(data, '2026-07-07', 2);
    expect(days).toHaveLength(2);
    expect(days.reduce((t, d) => t + d.rows.length, 0)).toBe(5);
  });

  it('skips empty stretches — a far-out annual bill still gets its day', () => {
    const data = { recurringBills: [annualBill], debts: [] };
    const days = upcomingPaymentDays(data, '2026-07-07', 5);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: '2026-11-10' });
    expect(days[0].rows).toHaveLength(1);
  });
});
