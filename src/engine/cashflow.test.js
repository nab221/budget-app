import { describe, it, expect } from 'vitest';
import {
  calculateForecast,
  generateExpectedIncomePredictions,
  calculateMedian,
} from './cashflow.js';

describe('cashflow utilities (parked analytics engine)', () => {
  describe('calculateMedian', () => {
    it('returns the middle value for odd-length arrays', () => {
      expect(calculateMedian([300000, 310000, 305000])).toBe(305000);
    });

    it('averages the two middle values for even-length arrays', () => {
      expect(calculateMedian([10, 20, 30, 40])).toBe(25);
    });

    it('returns 0 for an empty array', () => {
      expect(calculateMedian([])).toBe(0);
    });
  });

  describe('calculateForecast', () => {
    it('generates exactly 90 records for a 90-day horizon', () => {
      const results = calculateForecast('2026-03-01', 90);
      expect(results.length).toBe(90);
      expect(results[0].date).toBe('2026-03-01');
      expect(results[89].date).toBe('2026-05-29');
    });

    it('shifts a recurrent expense from Saturday to the next working Monday', () => {
      // 2026-03-07 is a Saturday
      const results = calculateForecast('2026-03-05', 7, {
        recurrentExpenses: [
          { id: 1, amount: 10000, nextDate: '2026-03-07', label: 'Weekend Bill' },
        ],
      });

      const sat = results.find((r) => r.date === '2026-03-07');
      const mon = results.find((r) => r.date === '2026-03-09');
      expect(sat.expenseTotal).toBe(0);
      expect(mon.expenseTotal).toBe(10000);
    });

    it('excludes finished/paid recurrent expenses and flags debt payments', () => {
      const results = calculateForecast('2026-03-02', 1, {
        recurrentExpenses: [
          { id: 1, amount: 5000, nextDate: '2026-03-02', label: 'Finished', cycleTotal: 1, cycleCurrent: 1 },
          { id: 2, amount: 6000, nextDate: '2026-03-02', label: 'Paid', status: 'paid' },
          { id: 3, amount: 7000, nextDate: '2026-03-02', label: 'Debt Payment', isDebtPayment: true },
          { id: 4, amount: 8000, nextDate: '2026-03-02', label: 'Normal' },
        ],
      });

      // 7000 (debt) + 8000 (normal); 5000 (finished) and 6000 (paid) excluded
      expect(results[0].expenseTotal).toBe(15000);
      expect(results[0].hasDebtPayment).toBe(true);

      const nextDay = calculateForecast('2026-03-03', 1, {
        recurrentExpenses: [
          { id: 3, amount: 7000, nextDate: '2026-03-02', label: 'Debt Payment', isDebtPayment: true },
        ],
      });
      expect(nextDay[0].hasDebtPayment).toBe(false);
    });

    it('accumulates the balance from the injected opening balance', () => {
      const results = calculateForecast('2026-03-02', 3, {
        openingBalancePence: 50000,
        income: [{ date: '2026-03-03', amount: 20000 }],
        oneOffExpenses: [{ date: '2026-03-04', amount: 5000 }],
      });
      expect(results[0].openingBalance).toBe(50000);
      expect(results[0].closingBalance).toBe(50000);
      expect(results[1].closingBalance).toBe(70000); // + income
      expect(results[2].closingBalance).toBe(65000); // - expense
    });
  });

  describe('generateExpectedIncomePredictions', () => {
    it('predicts income based on the 3-month median pattern', () => {
      const now = new Date('2026-03-15T00:00:00Z');
      const incomeHistory = [
        { source: 'Salary', amount: 300000, date: '2025-12-28', categoryId: 10 },
        { source: 'Salary', amount: 310000, date: '2026-01-28', categoryId: 10 },
        { source: 'Salary', amount: 305000, date: '2026-02-28', categoryId: 10 },
      ];

      const predictions = generateExpectedIncomePredictions(incomeHistory, now);

      // One prediction per month for the next 3 months
      expect(predictions.length).toBe(3);
      expect(predictions[0].source).toBe('Salary');
      expect(predictions[0].amount).toBe(3050); // median 305000 pence -> £3050
      expect(predictions[0].status).toBe('predicted');

      // With "now" = March 2026: Apr/May/Jun on the 28th
      expect(predictions[0].date).toBe('2026-04-28');
      expect(predictions[1].date).toBe('2026-05-28');
      expect(predictions[2].date).toBe('2026-06-28');
    });

    it('returns [] when there is no recent income history', () => {
      const now = new Date('2026-03-15T00:00:00Z');
      const stale = [{ source: 'Salary', amount: 300000, date: '2024-01-01', categoryId: 10 }];
      expect(generateExpectedIncomePredictions(stale, now)).toEqual([]);
      expect(generateExpectedIncomePredictions([], now)).toEqual([]);
    });
  });
});
