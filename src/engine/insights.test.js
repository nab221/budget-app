import { describe, it, expect } from 'vitest';
import {
  buildInsights,
  monthlyInterestPence,
  effectiveApr,
  STALE_BALANCE_DAYS,
} from './insights.js';

const NOW = '2026-07-07';

// Fresh data that fires NO rules: recently-updated debt-free-ish household
// with a recent backup.
const quiet = (over = {}) => ({
  recurringBills: [],
  debts: [],
  childcareDeposits: [],
  payoffStrategy: 'avalanche',
  payoffExtraPence: 0,
  lastExportAt: '2026-07-01T10:00:00.000Z',
  ...over,
});

const card = (over = {}) => ({
  id: 1,
  name: 'Visa',
  debtType: 'credit-card',
  balancePence: 200000, // £2,000
  apr: 24,
  balanceAsOf: '2026-07-01',
  paymentDayOfMonth: 15,
  ...over,
});

describe('effectiveApr / monthlyInterestPence', () => {
  it('is 0 inside a promo window and the post-promo rate after it', () => {
    const d = card({ promoEndDate: '2026-09-01', postPromoApr: 29.9 });
    expect(effectiveApr(d, '2026-07-07')).toBe(0);
    expect(effectiveApr(d, '2026-09-01')).toBe(29.9);
  });

  it('estimates balance × APR ÷ 12 per debt and sums the total', () => {
    const { totalPence, byDebt } = monthlyInterestPence(
      [
        card(), // £2,000 at 24% → £40/month
        {
          id: 2,
          name: 'Loan',
          debtType: 'loan',
          balancePence: 600000,
          interestRate: 6,
        }, // £6,000 at 6% → £30/month
        card({ id: 3, balancePence: 0 }), // cleared — excluded
      ],
      NOW
    );
    expect(byDebt).toHaveLength(2);
    expect(byDebt[0].pence).toBe(4000);
    expect(byDebt[1].pence).toBe(3000);
    expect(totalPence).toBe(7000);
  });
});

describe('buildInsights — promo cliff (rule 1)', () => {
  it('is silent beyond 90 days and fires info/warn/danger as the cliff nears', () => {
    const at = (promoEndDate) =>
      buildInsights(
        quiet({ debts: [card({ promoEndDate, postPromoApr: 24.9 })] }),
        NOW
      ).filter((c) => c.id.startsWith('promo-cliff'));

    expect(at('2026-11-01')).toHaveLength(0); // 117 days out
    expect(at('2026-09-07')[0].severity).toBe('info'); // 62 days
    expect(at('2026-07-30')[0].severity).toBe('warn'); // 23 days
    expect(at('2026-07-10')[0].severity).toBe('danger'); // 3 days
  });

  it('quantifies the post-promo minimum payment in the body', () => {
    const [insight] = buildInsights(
      quiet({ debts: [card({ promoEndDate: '2026-07-20', postPromoApr: 24.9 })] }),
      NOW
    );
    expect(insight.title).toBe('0% on Visa ends in 13 days');
    // £2,000 at 24.9%: min = max(1% + interest, 2.25%, £5) = £61.50.
    expect(insight.body).toContain('At 24.9%');
    expect(insight.body).toContain('£61.50');
  });

  it('ignores promos already over and cards with no balance', () => {
    const cards = buildInsights(
      quiet({
        debts: [
          card({ promoEndDate: '2026-06-01' }),
          card({ id: 2, promoEndDate: '2026-07-20', balancePence: 0 }),
        ],
      }),
      NOW
    ).filter((c) => c.id.startsWith('promo-cliff'));
    expect(cards).toHaveLength(0);
  });
});

describe('buildInsights — heavy week ahead (rule 2)', () => {
  const monthly = (id, label, amountPence, day) => ({
    id,
    label,
    amountPence,
    frequency: 'monthly',
    nextDueDate: `2026-07-${String(day).padStart(2, '0')}`,
    dueDayAnchor: day,
    adjustToWorkingDay: false,
    active: true,
  });

  it('stays silent when every month looks the same (regular clustering)', () => {
    // Everything on the 1st: every month-start week is equally heavy.
    const cards = buildInsights(
      quiet({ recurringBills: [monthly(1, 'Rent', 120000, 1), monthly(2, 'Energy', 20000, 1)] }),
      NOW
    );
    expect(cards.find((c) => c.id === 'heavy-week')).toBeUndefined();
  });

  it('fires when one week towers over every other week ahead', () => {
    // Rent on the 3rd every month; the £800 annual premium lands on 3 Aug
    // (a Monday) — that week carries £2,000 vs £1,200 in ordinary rent weeks.
    const cards = buildInsights(
      quiet({
        recurringBills: [
          monthly(1, 'Rent', 120000, 3),
          {
            id: 2,
            label: 'Car insurance',
            amountPence: 80000, // £800 annual premium
            frequency: 'annual',
            nextDueDate: '2026-08-03',
            dueDayAnchor: 3,
            adjustToWorkingDay: false,
            active: true,
          },
        ],
      }),
      NOW
    );
    const heavy = cards.find((c) => c.id === 'heavy-week');
    expect(heavy).toBeTruthy();
    expect(heavy.severity).toBe('info');
    expect(heavy.title).toBe('Week of 3 Aug is your heaviest coming up');
    expect(heavy.body).toContain('£2,000.00'); // £1,200 rent + £800 premium
  });
});

describe('buildInsights — subscription creep (rule 4)', () => {
  const sub = (id, amountPence) => ({
    id,
    label: `Sub ${id}`,
    amountPence,
    frequency: 'monthly',
    nextDueDate: '2026-07-15',
    active: true,
  });

  it('needs at least 3 small expenses, then totals them per year', () => {
    const two = buildInsights(quiet({ recurringBills: [sub(1, 999), sub(2, 1200)] }), NOW);
    expect(two.find((c) => c.id === 'subscription-creep')).toBeUndefined();

    const three = buildInsights(
      quiet({ recurringBills: [sub(1, 999), sub(2, 1200), sub(3, 500)] }),
      NOW
    );
    const creep = three.find((c) => c.id === 'subscription-creep');
    // (£9.99 + £12 + £5) × 12 = £323.88 a year.
    expect(creep.body).toContain('£323.88');
    expect(creep.severity).toBe('info');
  });

  it('does not count paused bills or bills at/over £15', () => {
    const cards = buildInsights(
      quiet({
        recurringBills: [
          sub(1, 999),
          { ...sub(2, 1200), active: false },
          sub(3, 1500), // exactly £15 — not "small"
        ],
      }),
      NOW
    );
    expect(cards.find((c) => c.id === 'subscription-creep')).toBeUndefined();
  });
});

describe('buildInsights — strategy check (rule 5)', () => {
  const twoCards = [
    card({ id: 1, name: 'High APR', balancePence: 300000, apr: 34.9 }),
    card({ id: 2, name: 'Low APR small', balancePence: 50000, apr: 9.9 }),
  ];

  it('fires when snowball is chosen but avalanche is meaningfully cheaper', () => {
    const cards = buildInsights(
      quiet({ debts: twoCards, payoffStrategy: 'snowball', payoffExtraPence: 10000 }),
      NOW
    );
    const check = cards.find((c) => c.id === 'strategy-check');
    expect(check).toBeTruthy();
    expect(check.severity).toBe('warn');
    expect(check.title).toContain('Avalanche');
    expect(check.tab).toBe('payoff');
  });

  it('stays silent when the chosen strategy is already the cheapest', () => {
    const cards = buildInsights(
      quiet({ debts: twoCards, payoffStrategy: 'avalanche', payoffExtraPence: 10000 }),
      NOW
    );
    expect(cards.find((c) => c.id === 'strategy-check')).toBeUndefined();
  });

  it('stays silent with a single card (strategies are identical)', () => {
    const cards = buildInsights(quiet({ debts: [card()], payoffStrategy: 'snowball' }), NOW);
    expect(cards.find((c) => c.id === 'strategy-check')).toBeUndefined();
  });
});

describe('buildInsights — stale balances (rule 6)', () => {
  it(`flags balances older than ${STALE_BALANCE_DAYS} days or never set`, () => {
    const cards = buildInsights(
      quiet({
        debts: [
          card({ balanceAsOf: '2026-04-01' }), // 97 days — stale
          card({ id: 2, name: 'Amex', balanceAsOf: null }), // never — stale
          card({ id: 3, name: 'Fresh', balanceAsOf: '2026-07-01' }),
        ],
      }),
      NOW
    );
    const stale = cards.find((c) => c.id === 'stale-balances');
    expect(stale.title).toBe('2 debt balances need updating');
    expect(stale.body).toContain('Visa');
    expect(stale.body).toContain('Amex');
    expect(stale.body).not.toContain('Fresh');
  });

  it('uses the singular form for one stale debt', () => {
    const cards = buildInsights(quiet({ debts: [card({ balanceAsOf: '2026-01-01' })] }), NOW);
    expect(cards.find((c) => c.id === 'stale-balances').title).toBe(
      "Visa's balance needs updating"
    );
  });
});

describe('buildInsights — backup nudge (rule 7)', () => {
  it('fires when there has never been an export', () => {
    const cards = buildInsights(quiet({ lastExportAt: null }), NOW);
    expect(cards.find((c) => c.id === 'backup-nudge').title).toBe('No backup exported yet');
  });

  it('fires with the age when the last export is over 14 days old', () => {
    const cards = buildInsights(quiet({ lastExportAt: '2026-06-01T10:00:00.000Z' }), NOW);
    const nudge = cards.find((c) => c.id === 'backup-nudge');
    expect(nudge.title).toMatch(/^Your last backup is 3[56] days old$/);
  });

  it('is silent when a recent export exists', () => {
    const cards = buildInsights(quiet(), NOW);
    expect(cards.find((c) => c.id === 'backup-nudge')).toBeUndefined();
  });
});

describe('buildInsights — ordering', () => {
  it('sorts danger before warn before info', () => {
    const cards = buildInsights(
      quiet({
        lastExportAt: null, // info
        debts: [
          card({ balanceAsOf: '2026-01-01' }), // warn (stale)
          card({ id: 2, name: 'Promo', promoEndDate: '2026-07-09', postPromoApr: 29 }), // danger (2 days)
        ],
      }),
      NOW
    );
    const severities = cards.map((c) => c.severity);
    expect(severities).toEqual([...severities].sort((a, b) => {
      const rank = { danger: 0, warn: 1, info: 2 };
      return rank[a] - rank[b];
    }));
    expect(severities[0]).toBe('danger');
  });
});

describe('buildInsights — tax thresholds (rule 3)', () => {
  const person = (name, summary) => ({ name, summary });
  const safeSummary = {
    over100k: false,
    headroomTo100kPence: 4000000, // £40,000 clear
    overHigherRate: false,
    headroomToHigherRatePence: 2000000, // £20,000 clear
  };

  it('stays silent with comfortable headroom (or no people at all)', () => {
    expect(
      buildInsights(quiet({ people: [person('Anderson', safeSummary)] }), NOW).filter((c) =>
        c.id.startsWith('tax-')
      )
    ).toEqual([]);
    expect(buildInsights(quiet(), NOW).filter((c) => c.id.startsWith('tax-'))).toEqual([]);
  });

  it('warns within £10k of the £100k line and quantifies the headroom', () => {
    const cards = buildInsights(
      quiet({
        people: [person('Anderson', { ...safeSummary, headroomTo100kPence: 420000 })],
      }),
      NOW
    );
    const card = cards.find((c) => c.id === 'tax-100k-Anderson');
    expect(card.severity).toBe('warn');
    expect(card.body).toContain('£4,200.00');
    expect(card.tab).toBe('income');
  });

  it('turns danger once the £100k line is crossed', () => {
    const cards = buildInsights(
      quiet({
        people: [person('Anderson', { ...safeSummary, over100k: true, headroomTo100kPence: 0 })],
      }),
      NOW
    );
    const card = cards.find((c) => c.id === 'tax-100k-Anderson');
    expect(card.severity).toBe('danger');
    expect(card.body).toContain('Tax-Free Childcare');
  });

  it('mentions 40%-band proximity as info, silently once crossed', () => {
    const near = buildInsights(
      quiet({
        people: [person('Wife', { ...safeSummary, headroomToHigherRatePence: 300000 })],
      }),
      NOW
    );
    expect(near.find((c) => c.id === 'tax-40pc-Wife').severity).toBe('info');

    const over = buildInsights(
      quiet({
        people: [
          person('Wife', { ...safeSummary, overHigherRate: true, headroomToHigherRatePence: 0 }),
        ],
      }),
      NOW
    );
    expect(over.find((c) => c.id === 'tax-40pc-Wife')).toBeUndefined();
  });
});
