import { describe, it, expect } from 'vitest';
import {
  categoryBreakdown,
  costRows,
  MAX_BREAKDOWN_ROWS,
  DEBT_GROUP_LABEL,
  CHILDCARE_GROUP_LABEL,
} from './breakdown.js';

const NOW = '2026-07-07';
const CATEGORIES = [
  { id: 1, name: 'Utilities' },
  { id: 2, name: 'Groceries' },
];

const bill = (over = {}) => ({
  id: 10,
  label: 'Broadband',
  amountPence: 3000, // £30/month
  categoryId: 1,
  frequency: 'monthly',
  nextDueDate: '2026-07-15',
  active: true,
  ...over,
});

const data = (over = {}) => ({
  recurringBills: [],
  debts: [],
  childcareDeposits: [],
  ...over,
});

describe('categoryBreakdown', () => {
  it('groups bills by category with debts and childcare as their own groups', () => {
    const { rows, totalAnnualPence } = categoryBreakdown(
      data({
        recurringBills: [
          bill(), // Utilities £360/yr
          bill({ id: 11, label: 'Water', amountPence: 2000 }), // Utilities +£240/yr
          bill({ id: 12, label: 'Food', amountPence: 40000, categoryId: 2 }), // Groceries £4,800/yr
        ],
        debts: [
          {
            id: 1,
            name: 'Car loan',
            debtType: 'loan',
            balancePence: 500000,
            fixedMonthlyPaymentPence: 25000,
          }, // £3,000/yr
        ],
        childcareDeposits: [{ label: 'Childcare — Ada', amountPence: 10000 }], // £1,200/yr
      }),
      CATEGORIES,
      NOW
    );

    expect(rows.map((r) => r.name)).toEqual([
      'Groceries',
      DEBT_GROUP_LABEL,
      CHILDCARE_GROUP_LABEL,
      'Utilities',
    ]);
    expect(rows[0].annualPence).toBe(480000);
    expect(rows[0].monthlyPence).toBe(40000);
    expect(totalAnnualPence).toBe(480000 + 300000 + 120000 + 60000);
    const shares = rows.reduce((t, r) => t + r.shareOfTotal, 0);
    expect(shares).toBeCloseTo(1, 6);
  });

  it('maps unknown categories to Uncategorised and skips paused bills', () => {
    const { rows } = categoryBreakdown(
      data({
        recurringBills: [
          bill({ categoryId: 999 }),
          bill({ id: 11, active: false, amountPence: 99999 }),
        ],
      }),
      CATEGORIES,
      NOW
    );
    expect(rows).toEqual([
      expect.objectContaining({ name: 'Uncategorised', annualPence: 36000 }),
    ]);
  });

  it(`folds the tail into "Other" past ${MAX_BREAKDOWN_ROWS} rows`, () => {
    const cats = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Cat ${i + 1}` }));
    const bills = cats.map((c, i) =>
      bill({ id: 100 + i, categoryId: c.id, amountPence: 1000 * (i + 1) })
    );
    const { rows } = categoryBreakdown(data({ recurringBills: bills }), cats, NOW);
    expect(rows).toHaveLength(MAX_BREAKDOWN_ROWS);
    const other = rows[rows.length - 1];
    expect(other.name).toBe('Other');
    // The five smallest (1+2+3+4+5 = £150/month) folded together = £1,800/yr.
    expect(other.annualPence).toBe(180000);
  });
});

describe('costRows', () => {
  it('lists every commitment with per-occurrence, monthly, and annual costs', () => {
    const rows = costRows(
      data({
        recurringBills: [
          bill({ frequency: 'weekly', amountPence: 5000 }), // £5k×52.18 ≈ £260.9k/yr… (£50 weekly)
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
        childcareDeposits: [{ label: 'Childcare — Ada', amountPence: 10000 }],
      }),
      CATEGORIES,
      NOW
    );

    // Sorted by annual cost, largest first: weekly £50 ≈ £2,608/yr, childcare £1,200, Visa £600.
    expect(rows.map((r) => r.label)).toEqual([
      'Broadband',
      'Childcare — Ada',
      'Visa (min payment)',
    ]);
    const weekly = rows[0];
    expect(weekly.frequency).toBe('weekly');
    expect(weekly.perOccurrencePence).toBe(5000);
    // £50 × 365.25/7 ≈ £2,608.93 a year; ÷12 ≈ £217.41/month.
    expect(weekly.annualPence).toBe(260893);
    expect(weekly.monthlyPence).toBe(21741);

    const visa = rows[2];
    expect(visa.category).toBe(DEBT_GROUP_LABEL);
    expect(visa.monthlyPence).toBe(5000);
    expect(visa.annualPence).toBe(60000);
  });

  it('excludes paused bills, cleared cards, and zero deposits', () => {
    const rows = costRows(
      data({
        recurringBills: [bill({ active: false })],
        debts: [
          {
            id: 1,
            name: 'Cleared',
            debtType: 'credit-card',
            balancePence: 0,
            apr: 20,
          },
        ],
        childcareDeposits: [{ label: 'Zero', amountPence: 0 }],
      }),
      CATEGORIES,
      NOW
    );
    expect(rows).toEqual([]);
  });
});
