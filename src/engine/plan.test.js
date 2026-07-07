/**
 * plan.test.js — the pay-period assembly engine (Phase 3 priority suite).
 *
 * All monetary values are integer pence. `now` is always injected so the tests
 * are deterministic. Dates chosen around March 2026 (a month whose weekend/
 * bank-holiday layout is covered by banking-calendar's static fallback).
 */

import { describe, it, expect } from 'vitest';
import { buildPlan, advanceByFrequency, dateForMonthDayStr, daysInMonthYM } from './plan.js';
import { orderDebtsByStrategy } from './finance.js';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function source(over = {}) {
  return {
    id: 1,
    name: 'Salary',
    amountPence: 300000, // £3000
    payDateRule: 'nth-of-month',
    payDateDay: 25,
    active: true,
    ...over,
  };
}

function bill(over = {}) {
  return {
    id: 1,
    label: 'Netflix',
    amountPence: 1500,
    categoryId: 1,
    frequency: 'monthly',
    nextDueDate: '2026-03-05',
    adjustToWorkingDay: true,
    endDate: null,
    active: true,
    ...over,
  };
}

function card(over = {}) {
  return {
    id: 10,
    name: 'Visa',
    debtType: 'credit-card',
    balancePence: 200000, // £2000
    apr: 24,
    creditLimitPence: 500000,
    promoEndDate: null,
    postPromoApr: null,
    minPaymentOverridePence: null,
    paymentDayOfMonth: 15,
    ...over,
  };
}

function loan(over = {}) {
  return {
    id: 20,
    name: 'Car loan',
    debtType: 'loan',
    balancePence: 500000,
    interestRate: 6,
    fixedMonthlyPaymentPence: 25000,
    paymentDayOfMonth: 10,
    ...over,
  };
}

function baseSettings(over = {}) {
  return {
    currentBalancePence: 400000, // £4000
    safetyBufferPence: 20000, // £200
    everydaySpendPence: 0,
    payoffStrategy: 'avalanche',
    ...over,
  };
}

function build(over = {}, offset = 0) {
  return buildPlan(
    {
      now: new Date('2026-03-10T12:00:00Z'),
      incomeSources: [source()],
      recurringBills: [],
      debts: [],
      settings: baseSettings(),
      childcareDeposits: [],
      ...over,
    },
    offset,
  );
}

// ---------------------------------------------------------------------------
// Period boundaries
// ---------------------------------------------------------------------------

describe('period boundaries', () => {
  it('current period spans the last payday to the next payday around now', () => {
    // Salary on 25th. now = 10 Mar → period is 25 Feb → 25 Mar.
    const plan = build();
    expect(plan.hasPeriod).toBe(true);
    expect(plan.periodStart).toBe('2026-02-25');
    expect(plan.periodEnd).toBe('2026-03-25');
  });

  it('offset navigation moves whole periods forward and back', () => {
    const prev = build({}, -1);
    expect(prev.periodStart).toBe('2026-01-26'); // 25 Jan 2026 is a Sunday → 26 Jan
    expect(prev.periodEnd).toBe('2026-02-25');

    const next = build({}, 1);
    expect(next.periodStart).toBe('2026-03-25');
    expect(next.periodEnd).toBe('2026-04-27'); // 25 Apr 2026 is a Saturday → 27 Apr
  });

  it('a period ends at the NEXT income of ANY source (multiple sources)', () => {
    // Salary on 25th + freelance on 10th. now = 3 Mar.
    // Boundaries near now: 25 Feb (salary), 10 Mar (freelance), 25 Mar (salary)...
    const freelance = source({ id: 2, name: 'Freelance', amountPence: 50000, payDateDay: 10 });
    const plan = buildPlan(
      {
        now: new Date('2026-03-03T12:00:00Z'),
        incomeSources: [source(), freelance],
        recurringBills: [],
        debts: [],
        settings: baseSettings(),
      },
      0,
    );
    // now = 3 Mar → current period runs 25 Feb → 10 Mar (the next income of ANY source).
    expect(plan.periodStart).toBe('2026-02-25');
    expect(plan.periodEnd).toBe('2026-03-10');
  });

  it('crosses a month boundary cleanly', () => {
    const plan = build({ now: new Date('2026-03-28T12:00:00Z') });
    // now after 25 Mar payday → period 25 Mar → next payday 27 Apr (25 Apr is Sat).
    expect(plan.periodStart).toBe('2026-03-25');
    expect(plan.periodEnd).toBe('2026-04-27');
  });

  it('flags needsIncome when there are no active income sources', () => {
    const plan = build({ incomeSources: [source({ active: false })] });
    expect(plan.needsIncome).toBe(true);
    expect(plan.hasPeriod).toBe(false);
    expect(plan.periodStart).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Outgoings assembly
// ---------------------------------------------------------------------------

describe('outgoings assembly', () => {
  it('includes recurring-bill instances that fall inside the period', () => {
    // Period 25 Feb → 25 Mar. Netflix nextDueDate 5 Mar monthly → 5 Mar in-window.
    const plan = build({ recurringBills: [bill({ nextDueDate: '2026-03-05', adjustToWorkingDay: false })] });
    const netflix = plan.outgoings.filter((o) => o.kind === 'bill');
    expect(netflix).toHaveLength(1);
    expect(netflix[0].date).toBe('2026-03-05');
    expect(netflix[0].amountPence).toBe(1500);
  });

  it('advances a bill whose stored nextDueDate is in the past into the period', () => {
    // nextDueDate 5 Jan monthly → occurrences 5 Feb, 5 Mar... 5 Mar lands in-window.
    const plan = build({ recurringBills: [bill({ nextDueDate: '2026-01-05', adjustToWorkingDay: false })] });
    const rows = plan.outgoings.filter((o) => o.kind === 'bill');
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-03-05');
  });

  it('does not generate quarterly occurrences outside their cycle', () => {
    // Quarterly from 5 Jan → 5 Jan, 5 Apr... nothing in 25 Feb–25 Mar.
    const plan = build({ recurringBills: [bill({ nextDueDate: '2026-01-05', frequency: 'quarterly' })] });
    expect(plan.outgoings.filter((o) => o.kind === 'bill')).toHaveLength(0);
  });

  it('working-day adjustment can pull a bill INTO the period', () => {
    // Period 25 Feb → 25 Mar. Bill nominal 22 Feb (Sun, before start) shifts to
    // 23 Feb (Mon) — still before start, excluded. Use 28 Feb (Sat) → 2 Mar (Mon).
    const plan = build({ recurringBills: [bill({ nextDueDate: '2026-02-28' })] });
    const rows = plan.outgoings.filter((o) => o.kind === 'bill');
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-03-02');
    expect(rows[0].isAdjusted).toBe(true);
  });

  it('excludes an occurrence on the exclusive period end (belongs to next period)', () => {
    // Period 25 Feb → 25 Mar (end exclusive). Annual bill (isolates a single
    // occurrence near the window). 24 Mar is in; 25 Mar lands on the exclusive
    // end and is excluded so it is not double-counted with the next period.
    const inPlan = build({
      recurringBills: [bill({ frequency: 'annual', nextDueDate: '2026-03-24', adjustToWorkingDay: false })],
    });
    expect(inPlan.outgoings.filter((o) => o.kind === 'bill')).toHaveLength(1);

    const outPlan = build({
      recurringBills: [bill({ frequency: 'annual', nextDueDate: '2026-03-25', adjustToWorkingDay: false })],
    });
    expect(outPlan.outgoings.filter((o) => o.kind === 'bill')).toHaveLength(0);
  });

  it('respects a bill end date', () => {
    const plan = build({
      recurringBills: [bill({ nextDueDate: '2026-03-05', endDate: '2026-02-01', adjustToWorkingDay: false })],
    });
    expect(plan.outgoings.filter((o) => o.kind === 'bill')).toHaveLength(0);
  });

  it('places a credit-card minimum payment on its working-day-adjusted payment day', () => {
    // Card payment day 15 → 15 Mar 2026 is a Sunday → 16 Mar (Mon).
    const plan = build({ debts: [card({ paymentDayOfMonth: 15 })] });
    const min = plan.outgoings.filter((o) => o.kind === 'debt-min');
    expect(min).toHaveLength(1);
    expect(min[0].date).toBe('2026-03-16');
    expect(min[0].isAdjusted).toBe(true);
    // £2000 @ 24% APR: max(1%+interest, 2.25%, £5) = £20 + £40 = £60 = 6000p.
    expect(min[0].amountPence).toBe(6000);
  });

  it('places a loan fixed payment on its payment day', () => {
    // Loan day 10 → 10 Mar 2026 is a Tuesday (working day, no shift).
    const plan = build({ debts: [loan({ paymentDayOfMonth: 10 })] });
    const rows = plan.outgoings.filter((o) => o.kind === 'loan');
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-03-10');
    expect(rows[0].amountPence).toBe(25000);
  });

  it('honours a credit-card minimum payment override', () => {
    const plan = build({ debts: [card({ minPaymentOverridePence: 9900 })] });
    const min = plan.outgoings.find((o) => o.kind === 'debt-min');
    expect(min.amountPence).toBe(9900);
  });

  it('uses the 0% promo rate for a promo card minimum', () => {
    // Promo active through the payment date → effective APR 0 → 2.25% rule.
    const plan = build({
      debts: [card({ apr: 24, promoEndDate: '2026-06-01', paymentDayOfMonth: 16 })],
    });
    const min = plan.outgoings.find((o) => o.kind === 'debt-min');
    // £2000 @ 0%: max(1%=2000p, 2.25%=4500p, £5) = 4500p.
    expect(min.amountPence).toBe(4500);
  });

  it('skips a fully-paid credit card', () => {
    const plan = build({ debts: [card({ balancePence: 0 })] });
    expect(plan.outgoings.filter((o) => o.kind === 'debt-min')).toHaveLength(0);
  });

  it('places childcare deposits from the stub input like debt payments', () => {
    const plan = build({
      childcareDeposits: [{ label: 'Nursery top-up', amountPence: 30000, paymentDayOfMonth: 10 }],
    });
    const cc = plan.outgoings.filter((o) => o.kind === 'childcare');
    expect(cc).toHaveLength(1);
    expect(cc[0].date).toBe('2026-03-10');
    expect(cc[0].amountPence).toBe(30000);
  });

  it('defaults to no childcare deposits', () => {
    const plan = build();
    expect(plan.outgoings.filter((o) => o.kind === 'childcare')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Everyday-spend proration
// ---------------------------------------------------------------------------

describe('everyday-spend proration', () => {
  it('prorates the monthly allowance by period length', () => {
    // Period 25 Feb → 25 Mar = 28 days. daysInMonth(Feb 2026) = 28 → full £600.
    const plan = build({ settings: baseSettings({ everydaySpendPence: 60000 }) });
    const allowance = plan.outgoings.find((o) => o.kind === 'allowance');
    expect(allowance).toBeDefined();
    expect(plan.periodDays).toBe(28);
    expect(allowance.amountPence).toBe(60000);
  });

  it('scales the allowance down for a shorter period', () => {
    // Two sources 25th + 10th, now 3 Mar → period 25 Feb → 10 Mar = 13 days.
    const freelance = source({ id: 2, name: 'Freelance', payDateDay: 10 });
    const plan = buildPlan(
      {
        now: new Date('2026-03-03T12:00:00Z'),
        incomeSources: [source(), freelance],
        recurringBills: [],
        debts: [],
        settings: baseSettings({ everydaySpendPence: 60000 }),
      },
      0,
    );
    expect(plan.periodDays).toBe(13);
    // 60000 * 13 / 28 = 27857.14 → 27857.
    const allowance = plan.outgoings.find((o) => o.kind === 'allowance');
    expect(allowance.amountPence).toBe(Math.round((60000 * 13) / 28));
  });

  it('omits the allowance row when the allowance is zero', () => {
    const plan = build({ settings: baseSettings({ everydaySpendPence: 0 }) });
    expect(plan.outgoings.find((o) => o.kind === 'allowance')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Running balance, warnings, safe extra
// ---------------------------------------------------------------------------

describe('running balance and projections', () => {
  it('computes a running projected balance and projected end balance', () => {
    const plan = build({
      settings: baseSettings({ currentBalancePence: 400000 }),
      recurringBills: [bill({ amountPence: 100000, nextDueDate: '2026-03-05', adjustToWorkingDay: false })],
      debts: [loan({ fixedMonthlyPaymentPence: 25000, paymentDayOfMonth: 10 })],
    });
    // 400000 - 100000 (bill 5 Mar) - 25000 (loan 10 Mar) = 275000.
    expect(plan.timeline[plan.timeline.length - 1].runningBalancePence).toBe(275000);
    expect(plan.projectedEndBalancePence).toBe(275000);
  });

  it('surfaces the boundary (next payday) income without adding it to the running balance', () => {
    // Every income event defines a boundary, so the projection ends right
    // before the next payday and never counts it. Salary 25th + freelance 20th;
    // now 21 Mar → the period runs 20 Mar → 25 Mar (freelance opened it, salary
    // closes it). The 25 Mar salary is reported as the boundary but NOT added.
    const freelance = source({ id: 2, name: 'Freelance', amountPence: 50000, payDateDay: 20 });
    const plan = buildPlan(
      {
        now: new Date('2026-03-21T12:00:00Z'),
        incomeSources: [source(), freelance],
        recurringBills: [],
        debts: [],
        settings: baseSettings({ currentBalancePence: 400000 }),
      },
      0,
    );
    expect(plan.periodStart).toBe('2026-03-20');
    expect(plan.periodEnd).toBe('2026-03-25');
    // No outgoings, no income counted → projected end equals the opening anchor.
    expect(plan.projectedEndBalancePence).toBe(400000);
    const boundary = plan.incomeEvents.find((e) => e.isBoundary);
    expect(boundary.label).toBe('Salary');
    expect(boundary.amountPence).toBe(300000);
    // The boundary income is not present as a counted timeline row.
    expect(plan.timeline.every((r) => r.direction === 'out')).toBe(true);
  });

  it('flags belowBufferDate and negativeDate', () => {
    const plan = build({
      settings: baseSettings({ currentBalancePence: 100000, safetyBufferPence: 50000 }),
      recurringBills: [
        bill({ id: 1, label: 'Rent', amountPence: 60000, nextDueDate: '2026-03-05', adjustToWorkingDay: false }),
        bill({ id: 2, label: 'Big', amountPence: 60000, nextDueDate: '2026-03-08', adjustToWorkingDay: false }),
      ],
    });
    // 100000 → after Rent (5 Mar) 40000 (< 50000 buffer) → after Big (8 Mar) -20000.
    expect(plan.belowBufferDate).toBe('2026-03-05');
    expect(plan.negativeDate).toBe('2026-03-08');
  });

  it('safeExtra is projectedEnd minus buffer, floored at zero', () => {
    const surplus = build({
      settings: baseSettings({ currentBalancePence: 100000, safetyBufferPence: 20000 }),
    });
    expect(surplus.safeExtraPence).toBe(80000);

    const deficit = build({
      settings: baseSettings({ currentBalancePence: 25000, safetyBufferPence: 20000 }),
      recurringBills: [bill({ amountPence: 30000, nextDueDate: '2026-03-05', adjustToWorkingDay: false })],
    });
    // 25000 - 30000 = -5000 → safeExtra floored at 0.
    expect(deficit.projectedEndBalancePence).toBe(-5000);
    expect(deficit.safeExtraPence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// needsBalance
// ---------------------------------------------------------------------------

describe('missing current balance', () => {
  it('returns a needsBalance flagged state instead of garbage numbers', () => {
    const plan = build({ settings: baseSettings({ currentBalancePence: null }) });
    expect(plan.needsBalance).toBe(true);
    expect(plan.openingBalancePence).toBeNull();
    expect(plan.projectedEndBalancePence).toBeNull();
    expect(plan.safeExtraPence).toBeNull();
    expect(plan.recommendation.needsBalance).toBe(true);
    // The period and outgoings are still computed (they don't need a balance).
    expect(plan.hasPeriod).toBe(true);
    expect(plan.periodStart).toBe('2026-02-25');
  });
});

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

describe('recommendation', () => {
  const cardA = card({ id: 1, name: 'Card A', balancePence: 100000, apr: 20, paymentDayOfMonth: 1 });
  const cardB = card({ id: 2, name: 'Card B', balancePence: 50000, apr: 30, paymentDayOfMonth: 1 });

  it('avalanche targets the highest-APR card', () => {
    const plan = build({
      debts: [cardA, cardB],
      settings: baseSettings({ payoffStrategy: 'avalanche', currentBalancePence: 500000 }),
    });
    expect(plan.recommendation.debtId).toBe(2); // Card B, 30% APR
    expect(plan.recommendation.hasSpare).toBe(true);
  });

  it('snowball targets the smallest-balance card', () => {
    const plan = build({
      debts: [cardA, cardB],
      settings: baseSettings({ payoffStrategy: 'snowball', currentBalancePence: 500000 }),
    });
    expect(plan.recommendation.debtId).toBe(2); // Card B, £500 smallest
  });

  it('a 0% promo card drops to the back under avalanche', () => {
    const promo = card({ id: 3, name: 'Promo', balancePence: 300000, apr: 40, promoEndDate: '2026-12-01', paymentDayOfMonth: 1 });
    const plan = build({
      debts: [cardA, promo],
      settings: baseSettings({ payoffStrategy: 'avalanche', currentBalancePence: 500000 }),
    });
    // Promo's effective APR is 0 during the promo → Card A (20%) wins.
    expect(plan.recommendation.debtId).toBe(1);
  });

  it('reports no target debt when there are no debts', () => {
    const plan = build({ debts: [], settings: baseSettings({ currentBalancePence: 500000 }) });
    expect(plan.recommendation.debtId).toBeNull();
    expect(plan.recommendation.hasDebts).toBe(false);
    expect(plan.recommendation.hasSpare).toBe(true);
  });

  it('falls back to the highest-rate loan when there are no cards', () => {
    const loanA = loan({ id: 5, name: 'Loan A', interestRate: 4, paymentDayOfMonth: 1 });
    const loanB = loan({ id: 6, name: 'Loan B', interestRate: 9, paymentDayOfMonth: 1 });
    const plan = build({
      debts: [loanA, loanB],
      settings: baseSettings({ currentBalancePence: 500000 }),
    });
    expect(plan.recommendation.debtId).toBe(6);
  });

  it('reports no spare when projected end is below the buffer', () => {
    const plan = build({
      debts: [cardA],
      settings: baseSettings({ currentBalancePence: 20000, safetyBufferPence: 20000 }),
    });
    expect(plan.recommendation.hasSpare).toBe(false);
    expect(plan.safeExtraPence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// orderDebtsByStrategy (finance helper reused by the recommendation)
// ---------------------------------------------------------------------------

describe('orderDebtsByStrategy', () => {
  const debts = [
    { id: 1, name: 'A', currentBalance: 100000, apr: 20 },
    { id: 2, name: 'B', currentBalance: 50000, apr: 30 },
    { id: 3, name: 'C', currentBalance: 200000, apr: 10 },
  ];

  it('orders avalanche by effective APR desc', () => {
    const ordered = orderDebtsByStrategy(debts, 'avalanche', '2026-03-10');
    expect(ordered.map((d) => d.id)).toEqual([2, 1, 3]);
  });

  it('orders snowball by balance asc', () => {
    const ordered = orderDebtsByStrategy(debts, 'snowball', '2026-03-10');
    expect(ordered.map((d) => d.id)).toEqual([2, 1, 3]);
  });

  it('treats a promo card as 0% effective APR', () => {
    const withPromo = [
      { id: 1, name: 'A', currentBalance: 100000, apr: 20 },
      { id: 2, name: 'B', currentBalance: 50000, apr: 40, promoEndDate: '2026-12-01' },
    ];
    const ordered = orderDebtsByStrategy(withPromo, 'avalanche', '2026-03-10');
    expect(ordered[0].id).toBe(1); // A's 20% beats B's promo 0%
  });
});

// ---------------------------------------------------------------------------
// H2 — timezone-independent date math (pure string helpers, no Date/UTC mixing)
// ---------------------------------------------------------------------------

describe('date helpers are timezone-independent (H2)', () => {
  it('daysInMonthYM counts days including leap Februaries', () => {
    expect(daysInMonthYM(2026, 1)).toBe(31);
    expect(daysInMonthYM(2026, 2)).toBe(28); // 2026 not leap
    expect(daysInMonthYM(2024, 2)).toBe(29); // leap
    expect(daysInMonthYM(2000, 2)).toBe(29); // divisible by 400
    expect(daysInMonthYM(1900, 2)).toBe(28); // divisible by 100 not 400
    expect(daysInMonthYM(2026, 6)).toBe(30);
  });

  it('dateForMonthDayStr builds the nominal date purely from strings', () => {
    // The exact case that broke under BST: July, day 15 must stay 2026-07-15,
    // day 1 must stay 2026-07-01 — the old setUTCDate path produced June dates.
    expect(dateForMonthDayStr('2026-07', 15)).toBe('2026-07-15');
    expect(dateForMonthDayStr('2026-07', 1)).toBe('2026-07-01');
    // Clamped to the real month length.
    expect(dateForMonthDayStr('2026-02', 31)).toBe('2026-02-28');
    expect(dateForMonthDayStr('2024-02', 31)).toBe('2024-02-29');
    expect(dateForMonthDayStr('2026-06', 31)).toBe('2026-06-30');
  });

  it('a childcare/debt occurrence lands on the requested day regardless of TZ', () => {
    // Salary 28th → period around July; a childcare deposit on day 15 must be
    // 15 Jul, not pulled a day/month back by a UTC/local mismatch (the H2 bug).
    const plan = buildPlan(
      {
        now: new Date('2026-07-10T12:00:00Z'),
        incomeSources: [source({ payDateDay: 28 })],
        recurringBills: [],
        debts: [],
        settings: baseSettings(),
        childcareDeposits: [
          { label: 'Nursery', amountPence: 30000, paymentDayOfMonth: 15, adjustToWorkingDay: false },
        ],
      },
      0,
    );
    const cc = plan.outgoings.find((o) => o.kind === 'childcare');
    expect(cc).toBeDefined();
    expect(cc.date).toBe('2026-07-15');
  });
});

// ---------------------------------------------------------------------------
// M1 — a confirmed (paid) bill must not re-enter the committed timeline
// ---------------------------------------------------------------------------

describe('paid bill does not re-enter the timeline (M1 / BUG-1)', () => {
  it('a bill whose nextDueDate advanced a full step past the period start drops out', () => {
    // Period 25 Feb → 25 Mar. Pre-confirm nextDueDate 5 Mar shows once (control).
    const before = build({
      recurringBills: [bill({ nextDueDate: '2026-03-05', adjustToWorkingDay: false })],
    });
    expect(before.outgoings.filter((o) => o.kind === 'bill')).toHaveLength(1);

    // confirmBillPayment advances nextDueDate to 5 Apr (one step past the 5 Mar
    // occurrence). The old unconditional step-back re-emitted the 5 Mar row.
    const after = build({
      recurringBills: [bill({ nextDueDate: '2026-04-05', adjustToWorkingDay: false })],
      settings: baseSettings({ currentBalancePence: 500000 }),
    });
    expect(after.outgoings.filter((o) => o.kind === 'bill')).toHaveLength(0);
    // Projected end equals the opening anchor (no phantom deduction).
    expect(after.projectedEndBalancePence).toBe(500000);
  });

  it('still shows an overdue UNPAID bill (nextDueDate before the window)', () => {
    const plan = build({
      recurringBills: [bill({ nextDueDate: '2026-01-05', adjustToWorkingDay: false })],
    });
    const rows = plan.outgoings.filter((o) => o.kind === 'bill');
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-03-05');
  });
});

// ---------------------------------------------------------------------------
// M3 — mid-period balance refresh excludes already-reflected outgoings
// ---------------------------------------------------------------------------

describe('balanceAsOf mid-period exclusion (M3)', () => {
  function planWithAsOf(asOf, offset = 0, extraBills = []) {
    return build(
      {
        settings: baseSettings({ currentBalancePence: 400000, balanceAsOf: asOf }),
        recurringBills: [
          bill({ id: 1, label: 'Before', amountPence: 100000, nextDueDate: '2026-03-05', adjustToWorkingDay: false }),
          bill({ id: 2, label: 'OnDate', amountPence: 20000, nextDueDate: '2026-03-10', adjustToWorkingDay: false }),
          bill({ id: 3, label: 'After', amountPence: 50000, nextDueDate: '2026-03-15', adjustToWorkingDay: false }),
          ...extraBills,
        ],
      },
      offset,
    );
  }

  it('excludes outgoings dated strictly before balanceAsOf from the projection', () => {
    const plan = planWithAsOf('2026-03-10');
    const before = plan.timeline.find((r) => r.label === 'Before');
    const onDate = plan.timeline.find((r) => r.label === 'OnDate');
    const after = plan.timeline.find((r) => r.label === 'After');

    expect(before.beforeBalance).toBe(true); // 5 Mar < 10 Mar → excluded/dimmed
    expect(onDate.beforeBalance).toBe(false); // exactly on the date → included
    expect(after.beforeBalance).toBe(false);

    // Only OnDate (20000) + After (50000) reduce the projection; Before is skipped.
    expect(plan.projectedEndBalancePence).toBe(400000 - 20000 - 50000);
    expect(plan.safeExtraPence).toBe(400000 - 20000 - 50000 - 20000);
  });

  it('leaves navigated (offset ≠ 0) periods counting everything', () => {
    // offset 1 → period 25 Mar → 27 Apr. A bill before balanceAsOf in THAT period
    // is still counted (the exclusion is only for the current period).
    const plan = build(
      {
        settings: baseSettings({ currentBalancePence: 400000, balanceAsOf: '2026-04-10' }),
        recurringBills: [
          bill({ id: 9, label: 'AprBill', amountPence: 30000, nextDueDate: '2026-04-05', adjustToWorkingDay: false }),
        ],
      },
      1,
    );
    const row = plan.timeline.find((r) => r.label === 'AprBill');
    expect(row.beforeBalance).toBe(false);
    expect(plan.projectedEndBalancePence).toBe(400000 - 30000);
  });
});

// ---------------------------------------------------------------------------
// M4 — month-end anchor prevents due-date drift
// ---------------------------------------------------------------------------

describe('advanceByFrequency month-end anchor (M4)', () => {
  it('restores the intended day after a February clamp (31st bill)', () => {
    expect(advanceByFrequency('2026-01-31', 'monthly', 1, 31)).toBe('2026-02-28');
    expect(advanceByFrequency('2026-02-28', 'monthly', 1, 31)).toBe('2026-03-31');
  });

  it('keeps a 30th quarterly bill on the 30th', () => {
    expect(advanceByFrequency('2026-01-30', 'quarterly', 1, 30)).toBe('2026-04-30');
  });

  it('handles a 29 Feb annual bill across leap years', () => {
    // 29 Feb 2024 (leap) +1yr → 28 Feb 2025 (clamped), anchor 29.
    expect(advanceByFrequency('2024-02-29', 'annual', 1, 29)).toBe('2025-02-28');
    // ...and back to 29 Feb when the target year is a leap year again.
    expect(advanceByFrequency('2027-02-28', 'annual', 1, 29)).toBe('2028-02-29');
  });

  it('without an anchor preserves the legacy addMonths clamp behaviour', () => {
    expect(advanceByFrequency('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(advanceByFrequency('2026-02-28', 'monthly', 1)).toBe('2026-03-28'); // drift, as before
  });

  it('walks plan occurrences on the anchored day, not the drifted one', () => {
    // Bill anchored on the 31st, current nextDueDate already clamped to 28 Feb.
    // The March occurrence must land on 31 Mar. now = 20 Mar (salary 25th) →
    // period 25 Feb → 25 Mar; use offset 1 (25 Mar → 27 Apr) to see 31 Mar.
    const plan = build(
      {
        recurringBills: [
          bill({ nextDueDate: '2026-02-28', dueDayAnchor: 31, adjustToWorkingDay: false }),
        ],
      },
      1,
    );
    const rows = plan.outgoings.filter((o) => o.kind === 'bill');
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-03-31');
  });
});
