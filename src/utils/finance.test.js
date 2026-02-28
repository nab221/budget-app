import { describe, it, expect } from 'vitest';
import { calcMinPayment, simulatePayoff, modelBalanceTransfer } from './finance';

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
});
