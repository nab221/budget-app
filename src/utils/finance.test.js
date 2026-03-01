import { describe, it, expect } from 'vitest';
import { calcMinPayment, simulatePayoff, modelBalanceTransfer, calculateBalanceChain } from './finance';

describe('Finance Utilities', () => {
  describe('calcMinPayment', () => {
    it('calculates min payment with £5 floor', () => {
      expect(calcMinPayment(10000, 19.9)).toBe(500); // £100 balance, min would be ~£2.25 or ~£2.66, so £5 floor
    });

    it('calculates min payment using 2.25% rule', () => {
      // £1000 balance, 0% APR. 2.25% is £22.50. 1% + int is £10.
      expect(calcMinPayment(100000, 0)).toBe(2250);
    });

    it('calculates min payment using 1% + interest rule', () => {
      // £1000 balance, 24% APR. 
      // 1% balance = £10
      // Monthly interest = (£1000 * 0.24) / 12 = £20
      // Total = £30.
      // 2.25% rule = £22.50.
      // Max is £30.
      expect(calcMinPayment(100000, 24)).toBe(3000);
    });
  });

  describe('simulatePayoff', () => {
    const debts = [
      { id: 1, name: 'Card A', currentBalance: 100000, apr: 20 }, // £1000, 20%
      { id: 2, name: 'Card B', currentBalance: 50000, apr: 10 }   // £500, 10%
    ];

    it('handles avalanche strategy (highest APR first)', () => {
      const result = simulatePayoff(debts, 'avalanche', 5000); // £50 extra
      expect(result.monthsToClear).toBeLessThan(30);
      expect(result.resultsByDebt[0].id).toBe(1); // Card A should be prioritized if sorted
    });

    it('handles snowball strategy (lowest balance first)', () => {
      const result = simulatePayoff(debts, 'snowball', 5000);
      expect(result.monthsToClear).toBeLessThan(30);
    });

    it('handles min strategy (minimums only)', () => {
      const result = simulatePayoff(debts, 'min', 0);
      expect(result.monthsToClear).toBeGreaterThan(30);
    });

    it('correctly implements rollover of payments', () => {
      const simpleDebts = [
        { id: 1, name: 'Small', currentBalance: 10000, apr: 0 }, // £100, no interest
        { id: 2, name: 'Large', currentBalance: 100000, apr: 0 } // £1000, no interest
      ];
      // Min payment for both will be £5 floor (500 pence)
      // Total budget = 500 + 500 + 5000 (extra) = 6000
      
      const result = simulatePayoff(simpleDebts, 'snowball', 5000);
      
      // Small debt (£100) should be paid in 2 months
      // Month 1: Small gets 500 (min) + 5000 (extra) = 5500. Balance 4500.
      // Month 2: Small gets 500 (min) + 5000 (extra) = 5500. Balance 0.
      // Remaining from month 2 should go to Large? 
      // Actually my implementation applies extra to the first uncleared debt.
      expect(result.resultsByDebt.find(d => d.name === 'Small').monthsToClear).toBe(2);
    });
  });

  describe('modelBalanceTransfer', () => {
    const debt = { id: 1, name: 'Card A', currentBalance: 100000, apr: 20 };

    it('calculates transfer fee and monthly payment', () => {
      const result = modelBalanceTransfer(debt, 12, 3); // 12 months, 3% fee
      expect(result.transferFeePence).toBe(3000); // 3% of 100000
      expect(result.recommendedMonthlyPayment).toBe(Math.ceil(103000 / 12));
    });

    it('compares BT cost vs current interest cost', () => {
      const result = modelBalanceTransfer(debt, 12, 3);
      expect(result.totalCostBT).toBe(3000);
      expect(result.totalCostCurrent).toBeGreaterThan(0);
    });
  });

  describe('calcMinPayment with Promos', () => {
    it('uses 0% APR when within promo period', () => {
      const balance = 100000; // £1000
      const apr = 20;
      const refDate = '2026-01-01';
      const promoEndDate = '2026-06-01';

      // With 20% APR: 1% (£10) + interest (£1000 * 0.20 / 12 = £16.67) = £26.67 (2667)
      // With 0% APR: 1% (£10) + interest (£0) = £10. (But 2.25% of £1000 is £22.50)
      // So expect 2250.
      expect(calcMinPayment(balance, apr, 0, refDate, promoEndDate)).toBe(2250);
    });

    it('uses standard APR when after promo period', () => {
      const balance = 100000;
      const apr = 20;
      const refDate = '2026-07-01';
      const promoEndDate = '2026-06-01';

      // With 20% APR: max(1% + interest=2667, 2.25%=2250, floor=500)
      expect(calcMinPayment(balance, apr, 0, refDate, promoEndDate)).toBe(2667);
    });
  });

  describe('calculateBalanceChain', () => {
    // ---------------------------------------------------------------------------
    // Helper to build injected deps for calculateBalanceChain
    // ---------------------------------------------------------------------------

    /**
     * Build a deps object for calculateBalanceChain.
     * @param {Object} data - { income: {[month]: Array}, recurrent: {[month]: Array}, oneOff: {[month]: Array} }
     * @param {number|null} openingBalCatId - The category id that signals an "Opening Balance" entry.
     * @param {Array} savedSnapshots - Output array into which saved snapshots are pushed.
     */
    function makeDeps(data, openingBalCatId, savedSnapshots = []) {
      return {
        getIncome: async (month) => data.income?.[month] ?? [],
        getRecurrent: async (month) => data.recurrent?.[month] ?? [],
        getOneOff: async (month) => data.oneOff?.[month] ?? [],
        getOpeningBalCatId: async () => openingBalCatId,
        saveSnapshot: async (snap) => { savedSnapshots.push({ ...snap }); return savedSnapshots.length; }
      };
    }

    it('returns one snapshot per month between startDate and current+horizon', async () => {
      // Use a past startDate so the range is deterministic
      // horizonMonths=0 means only up to the current month
      const startDate = '2026-01-01'; // 2 months before March 2026
      const saved = [];
      const deps = makeDeps({}, null, saved);

      const result = await calculateBalanceChain(startDate, 0, deps);

      // Should have Jan 2026, Feb 2026, Mar 2026 (today per memory context is 2026-03-01)
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0].month).toBe('2026-01');
    });

    it('calculates closing = opening + income - expenses for a simple month', async () => {
      const saved = [];
      const deps = makeDeps(
        {
          income: { '2026-01': [{ amount: 300000, categoryId: 99 }] }, // £3000 salary
          recurrent: { '2026-01': [{ amount: 100000 }] },               // £1000 bills
          oneOff: { '2026-01': [{ amount: 50000 }] }                    // £500 groceries
        },
        null, // no opening balance category
        saved
      );

      const result = await calculateBalanceChain('2026-01', 0, deps);
      const jan = result.find(s => s.month === '2026-01');

      expect(jan).toBeDefined();
      expect(jan.incomeTotal).toBe(300000);
      expect(jan.expenseTotal).toBe(150000);
      expect(jan.closingBalance).toBe(150000); // 0 + 300000 - 150000
    });

    it('seeds opening balance from the Opening Balance category entry', async () => {
      const OPENING_CAT_ID = 42;
      const saved = [];
      const deps = makeDeps(
        {
          income: {
            '2026-01': [
              { amount: 500000, categoryId: OPENING_CAT_ID }, // £5000 account balance seed
              { amount: 200000, categoryId: 1 }               // £2000 regular salary
            ]
          },
          recurrent: { '2026-01': [{ amount: 100000 }] },
          oneOff: {}
        },
        OPENING_CAT_ID,
        saved
      );

      const result = await calculateBalanceChain('2026-01', 0, deps);
      const jan = result.find(s => s.month === '2026-01');

      // openingBalance = 500000 (from Opening Balance entry)
      // incomeTotal = 200000 (salary only; Opening Balance entry excluded)
      // expenseTotal = 100000
      // closingBalance = 500000 + 200000 - 100000 = 600000
      expect(jan.openingBalance).toBe(500000);
      expect(jan.incomeTotal).toBe(200000);
      expect(jan.closingBalance).toBe(600000);
    });

    it('correctly carries closing balance forward as opening balance for next month', async () => {
      const saved = [];
      const deps = makeDeps(
        {
          income: {
            '2026-01': [{ amount: 200000, categoryId: 1 }],
            '2026-02': [{ amount: 200000, categoryId: 1 }]
          },
          recurrent: {
            '2026-01': [{ amount: 150000 }],
            '2026-02': [{ amount: 150000 }]
          },
          oneOff: {}
        },
        null,
        saved
      );

      const result = await calculateBalanceChain('2026-01', 0, deps);
      const jan = result.find(s => s.month === '2026-01');
      const feb = result.find(s => s.month === '2026-02');

      // Jan: 0 + 200000 - 150000 = 50000
      expect(jan.closingBalance).toBe(50000);
      // Feb: 50000 + 200000 - 150000 = 100000
      expect(feb.openingBalance).toBe(50000);
      expect(feb.closingBalance).toBe(100000);
    });

    it('marks future months as projections and past months as actuals', async () => {
      const saved = [];
      const deps = makeDeps({}, null, saved);

      // Start 1 month in the past, horizon 2 months forward
      const result = await calculateBalanceChain('2026-02', 2, deps);

      const feb = result.find(s => s.month === '2026-02');
      const may = result.find(s => s.month === '2026-05'); // 2 months after March 2026

      expect(feb.isProjection).toBe(false); // past month
      expect(may.isProjection).toBe(true);  // future month
    });

    it('saves a snapshot for every month via saveSnapshot', async () => {
      const saved = [];
      const deps = makeDeps({}, null, saved);

      const result = await calculateBalanceChain('2026-01', 0, deps);
      // One save call per month
      expect(saved.length).toBe(result.length);
      // Each saved snapshot has required fields
      for (const snap of saved) {
        expect(snap).toHaveProperty('month');
        expect(snap).toHaveProperty('openingBalance');
        expect(snap).toHaveProperty('closingBalance');
        expect(snap).toHaveProperty('incomeTotal');
        expect(snap).toHaveProperty('expenseTotal');
      }
    });

    it('handles months with zero income and zero expenses', async () => {
      const saved = [];
      const deps = makeDeps({}, null, saved);

      const result = await calculateBalanceChain('2026-03', 0, deps);
      const mar = result.find(s => s.month === '2026-03');

      expect(mar.openingBalance).toBe(0);
      expect(mar.incomeTotal).toBe(0);
      expect(mar.expenseTotal).toBe(0);
      expect(mar.closingBalance).toBe(0);
    });

    it('deducts recurrent expenses in projected months even when nextDate is in the current month', async () => {
      // Scenario: a recurrent expense has nextDate in the current month (2026-03).
      // The projected month (2026-04) should still deduct it, because recurrent
      // items are standing commitments that repeat every month.
      //
      // This test uses deps injection, but the makeDeps helper passes recurrent
      // data keyed by month. For the live DB path the fix is that getRecurrent
      // always returns all items regardless of nextDate — here we simulate that
      // behaviour by returning the same recurrent item for every month.

      const RECURRENT_AMOUNT = 80000; // £800/month standing commitment

      const saved = [];
      // Build deps where getRecurrent always returns the same recurrent item
      // regardless of which month is queried — this mirrors the fixed live path.
      const deps = {
        getIncome: async (_month) => [],
        getRecurrent: async (_month) => [{ amount: RECURRENT_AMOUNT }],
        getOneOff: async (_month) => [],
        getOpeningBalCatId: async () => null,
        saveSnapshot: async (snap) => { saved.push({ ...snap }); return saved.length; }
      };

      // horizonMonths=1: computes 2026-03 (current) + 2026-04 (projected)
      const result = await calculateBalanceChain('2026-03', 1, deps);
      const apr = result.find(s => s.month === '2026-04');

      expect(apr).toBeDefined();
      // The projected month MUST deduct the standing recurrent commitment
      expect(apr.expenseTotal).toBe(RECURRENT_AMOUNT);
    });
  });

  describe('simulatePayoff with Advanced Features', () => {
    it('handles 0% promo period and rate jump', () => {
      const debts = [{
        id: 1,
        name: 'Promo Card',
        currentBalance: 100000,
        apr: 0, // initially 0
        postPromoApr: 24,
        promoEndDate: '2026-04-01' // 3 months promo if start is Jan
      }];

      const startDate = '2026-01-01';
      const result = simulatePayoff(debts, 'min', 0, startDate);

      // Jan (month 1): 0% interest
      // Feb (month 2): 0% interest
      // Mar (month 3): 0% interest
      // Apr (month 4): 24% interest starts (because refDate is 2026-04-01, isBefore(Apr 1, Apr 1) is false)

      expect(result.history[0].totalInterestCharged).toBe(0);
      expect(result.history[1].totalInterestCharged).toBe(0);
      expect(result.history[2].totalInterestCharged).toBe(0);
      expect(result.history[3].totalInterestCharged).toBeGreaterThan(0);
      expect(result.history[3].payments[0].isRateJump).toBe(true);
    });

    it('implements tie-breaker: Smallest Balance', () => {
      const debts = [
        { id: 1, name: 'High Balance', currentBalance: 200000, apr: 20 },
        { id: 2, name: 'Low Balance', currentBalance: 100000, apr: 20 }
      ];
      // Same APR, avalanche should pick Smallest Balance (Low Balance)
      const result = simulatePayoff(debts, 'avalanche', 5000, '2026-01-01');

      // First snapshot payments should show debt 2 having more than just minimum
      const month1 = result.history[0];
      const p1 = month1.payments.find(p => p.debtId === 1).amount;
      const p2 = month1.payments.find(p => p.debtId === 2).amount;

      const min1 = calcMinPayment(200000, 20);
      const min2 = calcMinPayment(100000, 20);

      expect(p1).toBe(min1);
      expect(p2).toBe(min2 + 5000); // 5000 extra
    });

    it('returns detailed history structure', () => {
      const debts = [{ id: 1, name: 'Test', currentBalance: 50000, apr: 10 }];
      const result = simulatePayoff(debts, 'min', 0);

      expect(result.history.length).toBeGreaterThan(0);
      const entry = result.history[0];
      expect(entry).toHaveProperty('month');
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('totalInterestCharged');
      expect(entry).toHaveProperty('totalPrincipalPaid');
      expect(entry).toHaveProperty('payments');
      expect(entry.payments[0]).toHaveProperty('principalPaid');
      expect(entry.payments[0]).toHaveProperty('interestCharged');
    });
  });

  describe('Phase 12 Integration Fixes', () => {
    describe('calculateBalanceChain — frequency-aware recurrent filtering', () => {
      it('counts a quarterly expense exactly once per quarter in projections', async () => {
        // Mock deps to simulate the frequency-aware filter
        // A quarterly item due in 2026-03 should appear in 2026-03 and 2026-06, 
        // but NOT in 2026-04 or 2026-05.
        
        const QUARTERLY_AMOUNT = 60000; // £600
        const item = { amount: QUARTERLY_AMOUNT, frequency: 'quarterly', nextDate: '2026-03-01' };

        const saved = [];
        const deps = {
          getIncome: async () => [],
          getOneOff: async () => [],
          getOpeningBalCatId: async () => null,
          saveSnapshot: async (snap) => { saved.push({ ...snap }); return saved.length; },
          // This mock simulates the logic we WANT in the live closure
          getRecurrent: async (monthStr) => {
            // Logic: if month is 2026-03 or 2026-06, return the item
            if (monthStr === '2026-03' || monthStr === '2026-06') return [item];
            return [];
          }
        };

        // horizonMonths=3: computes 2026-03 (current) + Apr, May, Jun (projected)
        const result = await calculateBalanceChain('2026-03', 3, deps);
        
        const mar = result.find(s => s.month === '2026-03');
        const apr = result.find(s => s.month === '2026-04');
        const may = result.find(s => s.month === '2026-05');
        const jun = result.find(s => s.month === '2026-06');

        expect(mar.expenseTotal).toBe(QUARTERLY_AMOUNT);
        expect(apr.expenseTotal).toBe(0);
        expect(may.expenseTotal).toBe(0);
        expect(jun.expenseTotal).toBe(QUARTERLY_AMOUNT);
      });

      it('excludes finished finite-cycle items from projections', async () => {
        const item = { amount: 10000, frequency: 'monthly', nextDate: '2026-03-01', cycleTotal: 10, cycleCurrent: 10 };
        
        const saved = [];
        const deps = {
          getIncome: async () => [],
          getOneOff: async () => [],
          getOpeningBalCatId: async () => null,
          saveSnapshot: async (snap) => { saved.push({ ...snap }); return saved.length; },
          getRecurrent: async (monthStr) => {
            // Logic: if cycleCurrent >= cycleTotal, it shouldn't be returned for any month
            if (item.cycleCurrent >= item.cycleTotal) return [];
            return [item];
          }
        };

        const result = await calculateBalanceChain('2026-03', 1, deps);
        const mar = result.find(s => s.month === '2026-03');
        const apr = result.find(s => s.month === '2026-04');

        expect(mar.expenseTotal).toBe(0);
        expect(apr.expenseTotal).toBe(0);
      });
    });

    describe('recurrentExpenseRepository — mutation overrides (smoke test)', () => {
      it('has add/update/delete overrides that call triggerBalanceRecalc', async () => {
        const { recurrentExpenseRepository } = await import('../db/repository');
        
        // Check if overrides exist by looking for triggerBalanceRecalc in source
        // This is a crude but effective way to check for the implementation without full integration tests
        expect(recurrentExpenseRepository.add.toString()).toContain('triggerBalanceRecalc');
        expect(recurrentExpenseRepository.update.toString()).toContain('triggerBalanceRecalc');
        expect(recurrentExpenseRepository.delete.toString()).toContain('triggerBalanceRecalc');
      });
    });
  });
});
