import { describe, it, expect } from 'vitest';
import { calculateTopUp, getEntitlementPeriod, calculateFundingGap, monthlyEquivalentFromProvider, calculateRequiredTopUp } from './childcare';

describe('TFC Calculation Utilities', () => {

  // ---------------------------------------------------------------------------
  // calculateTopUp
  // ---------------------------------------------------------------------------
  describe('calculateTopUp', () => {
    it('calculates 25% bonus on a standard deposit (£80 → £20)', () => {
      // £80 in pence = 8000; 25% = 2000 pence = £20
      expect(calculateTopUp(8000, 50000)).toBe(2000);
    });

    it('calculates 25% bonus on a round £100 deposit', () => {
      // £100 → £25 top-up
      expect(calculateTopUp(10000, 50000)).toBe(2500);
    });

    it('caps top-up at remaining quarterly capacity', () => {
      // Deposit £100 (would give £25) but only £10 remaining cap
      expect(calculateTopUp(10000, 1000)).toBe(1000);
    });

    it('returns 0 when remaining cap is 0 (cap exhausted)', () => {
      expect(calculateTopUp(10000, 0)).toBe(0);
    });

    it('returns 0 when deposit amount is 0', () => {
      expect(calculateTopUp(0, 50000)).toBe(0);
    });

    it('returns 0 when deposit amount is negative', () => {
      expect(calculateTopUp(-5000, 50000)).toBe(0);
    });

    it('handles disabled child cap (£1,000/quarter) without incorrect capping', () => {
      // £2,000 deposit → £500 top-up, well within £1,000 disabled cap
      expect(calculateTopUp(200000, 100000)).toBe(50000);
    });

    it('caps correctly at the standard £500 quarterly limit', () => {
      // A large deposit where cap is exactly £500 (50000 pence)
      // £2,400 deposit → would be £600 top-up, but capped at £500
      expect(calculateTopUp(240000, 50000)).toBe(50000);
    });
  });

  // ---------------------------------------------------------------------------
  // getEntitlementPeriod
  // ---------------------------------------------------------------------------
  describe('getEntitlementPeriod', () => {
    it('returns the correct period for a date in the first cycle', () => {
      const start = '2025-01-01';
      const target = '2025-02-15';
      const { start: pStart, end: pEnd, periodIndex } = getEntitlementPeriod(start, target);

      expect(periodIndex).toBe(0);
      expect(pStart.getFullYear()).toBe(2025);
      expect(pStart.getMonth()).toBe(0); // January (0-indexed)
      expect(pEnd.getFullYear()).toBe(2025);
      expect(pEnd.getMonth()).toBe(3); // April (0-indexed)
    });

    it('returns the correct period for a date in the second cycle', () => {
      const start = '2025-01-01';
      const target = '2025-04-10';
      const { start: pStart, end: pEnd, periodIndex } = getEntitlementPeriod(start, target);

      expect(periodIndex).toBe(1);
      expect(pStart.getMonth()).toBe(3); // April
      expect(pEnd.getMonth()).toBe(6); // July
    });

    it('returns the correct period for a date exactly on the period boundary', () => {
      const start = '2025-01-01';
      const target = '2025-04-01'; // Exactly the start of period 2
      const { periodIndex } = getEntitlementPeriod(start, target);
      expect(periodIndex).toBe(1);
    });

    it('handles non-January entitlement start dates', () => {
      const start = '2025-03-15';
      const target = '2025-05-01'; // 1.5 months in → still period 0
      const { start: pStart, periodIndex } = getEntitlementPeriod(start, target);

      expect(periodIndex).toBe(0);
      expect(pStart.getMonth()).toBe(2); // March
    });

    it('handles a date one year after entitlement start', () => {
      const start = '2025-01-01';
      const target = '2026-01-01'; // 12 months = 4 full periods
      const { periodIndex } = getEntitlementPeriod(start, target);
      expect(periodIndex).toBe(4);
    });

    it('period end date is exclusive (3 months after period start)', () => {
      const start = '2025-01-01';
      const target = '2025-01-15';
      const { start: pStart, end: pEnd } = getEntitlementPeriod(start, target);

      // end should be April 1 (3 months after Jan 1)
      expect(pEnd.getFullYear()).toBe(2025);
      expect(pEnd.getMonth()).toBe(3); // April
      expect(pEnd.getDate()).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateFundingGap
  // ---------------------------------------------------------------------------
  describe('calculateFundingGap', () => {
    it('returns correct gap and suggested deposit when balance is below target', () => {
      // Target: £500 (50000p), Balance: £100 (10000p) → Gap: £400
      // Suggested deposit: £400 * 0.8 = £320 (user deposits £320, gov adds £80 = £400)
      const { gap, suggestedDeposit } = calculateFundingGap(50000, 10000);
      expect(gap).toBe(40000);
      expect(suggestedDeposit).toBe(32000);
    });

    it('returns 0 gap and 0 deposit when balance meets target', () => {
      const { gap, suggestedDeposit } = calculateFundingGap(50000, 50000);
      expect(gap).toBe(0);
      expect(suggestedDeposit).toBe(0);
    });

    it('returns 0 gap and 0 deposit when balance exceeds target', () => {
      const { gap, suggestedDeposit } = calculateFundingGap(50000, 80000);
      expect(gap).toBe(0);
      expect(suggestedDeposit).toBe(0);
    });

    it('handles a full gap (zero balance)', () => {
      // Target: £1,000 (100000p), Balance: £0 → Gap: £1,000
      // Suggested deposit: £800 (user deposits £800, gov adds £200 = £1,000)
      const { gap, suggestedDeposit } = calculateFundingGap(100000, 0);
      expect(gap).toBe(100000);
      expect(suggestedDeposit).toBe(80000);
    });

    it('verifies that deposit + top-up covers the gap exactly', () => {
      const targetSpend = 50000; // £500
      const balance = 10000; // £100
      const { gap, suggestedDeposit } = calculateFundingGap(targetSpend, balance);
      const topUp = calculateTopUp(suggestedDeposit, 50000); // ample cap
      // deposit + top-up should equal gap
      expect(suggestedDeposit + topUp).toBe(gap);
    });
  });

});

// ---------------------------------------------------------------------------
// Phase 35: monthlyEquivalentFromProvider
// ---------------------------------------------------------------------------
describe('monthlyEquivalentFromProvider', () => {
  it('returns monthly amount unchanged for monthly-frequency providers', () => {
    const provider = { monthlyEquivalentPence: 50000, frequency: 'monthly' };
    expect(monthlyEquivalentFromProvider(provider)).toBe(50000);
  });

  it('returns amount divided by 3 for termly-frequency providers', () => {
    // Termly cost of £1500 → monthly equivalent £500
    const provider = { termlyAmountPence: 150000, frequency: 'termly' };
    expect(monthlyEquivalentFromProvider(provider)).toBe(50000);
  });

  it('floors termly division to integer pence', () => {
    // £100 termly → 33.33... pence → floor to 33
    const provider = { termlyAmountPence: 100, frequency: 'termly' };
    expect(monthlyEquivalentFromProvider(provider)).toBe(33);
  });

  it('returns 0 for providers with no amount', () => {
    const provider = { frequency: 'monthly' };
    expect(monthlyEquivalentFromProvider(provider)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 35: calculateRequiredTopUp
// ---------------------------------------------------------------------------
describe('calculateRequiredTopUp', () => {
  it('computes max(0, total - balance - bonus) when total exceeds balance + bonus', () => {
    // providerTotal: £600 (60000p), balance: £200 (20000p), bonus: £50 (5000p)
    // required = 60000 - 20000 - 5000 = 35000
    expect(calculateRequiredTopUp(60000, 20000, 5000)).toBe(35000);
  });

  it('returns 0 when balance covers total', () => {
    // balance + bonus >= total → no top-up needed
    expect(calculateRequiredTopUp(50000, 50000, 0)).toBe(0);
  });

  it('returns 0 when balance + bonus exceeds total', () => {
    expect(calculateRequiredTopUp(50000, 40000, 20000)).toBe(0);
  });

  it('returns 0 when all inputs are zero', () => {
    expect(calculateRequiredTopUp(0, 0, 0)).toBe(0);
  });

  it('floors result at zero (never negative)', () => {
    // balance alone is far more than total
    expect(calculateRequiredTopUp(10000, 100000, 0)).toBe(0);
  });
});
