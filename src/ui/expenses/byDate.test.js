import { describe, it, expect } from 'vitest';
import { buildByDate, rollUpMonths, describeKind, occurrenceDomId } from './byDate.js';

// Engine-shape (PENCE) data. July 2026: bill on Wed 15th, Visa min on Mon 20th,
// loan on Tue 28th — none shift.
const data = {
  recurringBills: [
    { id: 11, label: 'Broadband', amountPence: 3000, frequency: 'monthly', nextDueDate: '2026-07-15', dueDayAnchor: 15, adjustToWorkingDay: false, active: true },
  ],
  debts: [
    { id: 1, name: 'Visa', debtType: 'credit-card', balancePence: 100000, apr: 0, minPaymentOverridePence: 5000, paymentDayOfMonth: 20 },
    { id: 3, name: 'Car loan', debtType: 'loan', balancePence: 500000, interestRate: 6, fixedMonthlyPaymentPence: 25000, paymentDayOfMonth: 28 },
  ],
  childcareDeposits: [],
};
const JULY = ['2026-07-01', '2026-08-01'];

describe('buildByDate', () => {
  it('groups occurrences by day with running totals', () => {
    const r = buildByDate(data, ...JULY, '2026-07-07');
    expect(r.days.map((d) => d.date)).toEqual(['2026-07-15', '2026-07-20', '2026-07-28']);
    expect(r.days.map((d) => d.rows[0].runningPence)).toEqual([3000, 8000, 33000]);
    expect(r.days.map((d) => d.totalPence)).toEqual([3000, 5000, 25000]);
    expect(r.totalPence).toBe(33000);
    expect(r.days[0].rows[0].domId).toBe('expense-card-bill-11');
    expect(r.days[1].rows[0].domId).toBe('expense-card-debt-1');
  });

  it('splits gone-out and still-to-go at today', () => {
    const r = buildByDate(data, ...JULY, '2026-07-21');
    expect(r.goneOutPence).toBe(8000);
    expect(r.stillToGoPence).toBe(25000);
    expect(r.days.map((d) => d.isPast)).toEqual([true, true, false]);
  });

  it('counts an occurrence dated today as still to go', () => {
    const r = buildByDate(data, ...JULY, '2026-07-20');
    expect(r.goneOutPence).toBe(3000);
    expect(r.stillToGoPence).toBe(30000);
    expect(r.days[1].isPast).toBe(false);
  });

  it('merges two payments on one day into one group', () => {
    const sameDay = { ...data, debts: [{ ...data.debts[0], paymentDayOfMonth: 15 }] };
    const r = buildByDate(sameDay, ...JULY, '2026-07-07');
    expect(r.days[0].rows).toHaveLength(2);
    expect(r.days[0].totalPence).toBe(8000);
    expect(r.days[0].rows[1].runningPence).toBe(8000);
  });

  it('returns empty structures when nothing is due', () => {
    const r = buildByDate({ recurringBills: [], debts: [], childcareDeposits: [] }, ...JULY, '2026-07-07');
    expect(r).toEqual({ days: [], months: [], goneOutPence: 0, stillToGoPence: 0, totalPence: 0 });
  });
});

describe('rollUpMonths', () => {
  it('rolls days into months with totals, a month being past only when all its days are', () => {
    const r = buildByDate(data, '2026-07-01', '2026-10-01', '2026-08-25');
    expect(r.months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(r.months.map((m) => m.totalPence)).toEqual([33000, 33000, 33000]);
    expect(r.months.map((m) => m.isPast)).toEqual([true, false, false]);
    expect(r.months[1].days).toHaveLength(3);
    expect(rollUpMonths([])).toEqual([]);
  });
});

describe('describeKind / occurrenceDomId', () => {
  const cats = new Map([[11, 'Utilities']]);
  it('labels each kind, bills with their category', () => {
    expect(describeKind({ kind: 'debt-min' }, cats)).toBe('Card');
    expect(describeKind({ kind: 'loan' }, cats)).toBe('Loan');
    expect(describeKind({ kind: 'childcare' }, cats)).toBe('Childcare');
    expect(describeKind({ kind: 'bill', sourceId: 11 }, cats)).toBe('Bill · Utilities');
    expect(describeKind({ kind: 'bill', sourceId: 99 }, cats)).toBe('Bill');
    expect(describeKind({ kind: 'bill', sourceId: 11 }, undefined)).toBe('Bill');
  });
  it('maps an occurrence to its card id', () => {
    expect(occurrenceDomId({ kind: 'bill', sourceId: 11 })).toBe('expense-card-bill-11');
    expect(occurrenceDomId({ kind: 'loan', debtId: 3 })).toBe('expense-card-debt-3');
    expect(occurrenceDomId({ kind: 'childcare', label: 'Childcare — Ada' })).toBe('expense-card-childcare-Childcare___Ada');
  });
});
