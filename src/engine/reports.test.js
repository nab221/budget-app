import { describe, it, expect } from 'vitest';
import { csvEscape, scheduleRows, scheduleCsv } from './reports.js';

const CATEGORIES = [{ id: 1, name: 'Utilities' }];

const data = {
  recurringBills: [
    {
      id: 10,
      label: 'Broadband, "fast" tier', // exercises CSV escaping
      amountPence: 3000,
      categoryId: 1,
      frequency: 'monthly',
      nextDueDate: '2026-07-15',
      dueDayAnchor: 15,
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
      paymentDayOfMonth: 20,
    },
  ],
  childcareDeposits: [{ label: 'Childcare — Ada', amountPence: 10000, paymentDayOfMonth: 1 }],
};

describe('csvEscape', () => {
  it('quotes only when needed and doubles inner quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape(null)).toBe('');
  });
});

describe('scheduleRows', () => {
  it('flattens 12 months of occurrences with category and group', () => {
    const rows = scheduleRows(data, CATEGORIES, '2026-07-07', 12);
    // Monthly bill + monthly debt + monthly childcare = 12 each (childcare's
    // 1 Jul 2026 is already past, but 1 Jul 2027 falls inside the window).
    expect(rows.filter((r) => r.group === 'expense')).toHaveLength(12);
    expect(rows.filter((r) => r.group === 'debt')).toHaveLength(12);
    expect(rows.filter((r) => r.group === 'childcare')).toHaveLength(12);

    const first = rows[0];
    expect(first).toEqual({
      date: '2026-07-15',
      label: 'Broadband, "fast" tier',
      category: 'Utilities',
      group: 'expense',
      amountPence: 3000,
    });
    expect(rows.find((r) => r.group === 'debt').category).toBe('Debt payments');
    // Sorted by date throughout.
    const dates = rows.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe('scheduleCsv', () => {
  it('emits a header and RFC-escaped lines with pence + pounds', () => {
    const csv = scheduleCsv(data, CATEGORIES, '2026-07-07', 1);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,label,category,group,amount_pence,amount_gbp');
    expect(lines[1]).toBe('2026-07-15,"Broadband, ""fast"" tier",Utilities,expense,3000,30.00');
    expect(lines[2]).toBe('2026-07-20,Visa (min payment),Debt payments,debt,5000,50.00');
    // Childcare's 1 Aug (Sat) shifts to Mon 3 Aug — inside the 1-month window.
    expect(lines[3]).toBe('2026-08-03,Childcare — Ada,Childcare,childcare,10000,100.00');
    expect(lines).toHaveLength(4);
  });
});
