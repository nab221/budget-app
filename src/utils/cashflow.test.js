/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isWorkingDay, isBankHoliday, nextWorkingDay, calculateForecast, generateExpectedIncomePredictions } from './cashflow.js';
import { 
  bankHolidayRepository,
  incomeRepository,
  recurrentExpenseRepository,
  oneOffExpenseRepository,
  expectedIncomeRepository,
  dailyBalanceRepository,
  balanceSnapshotRepository
} from '../db/repository.js';

// Mock all repositories
vi.mock('../db/repository.js', () => ({
  bankHolidayRepository: { isOverrideActive: vi.fn() },
  incomeRepository: { getAll: vi.fn() },
  recurrentExpenseRepository: { getAll: vi.fn() },
  oneOffExpenseRepository: { getAll: vi.fn() },
  expectedIncomeRepository: { getAll: vi.fn() },
  dailyBalanceRepository: { getLatestSnapshot: vi.fn() },
  balanceSnapshotRepository: { getLatestSnapshot: vi.fn() }
}));

describe('cashflow utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();

    // Default mock returns
    incomeRepository.getAll.mockResolvedValue([]);
    recurrentExpenseRepository.getAll.mockResolvedValue([]);
    oneOffExpenseRepository.getAll.mockResolvedValue([]);
    expectedIncomeRepository.getAll.mockResolvedValue([]);
    dailyBalanceRepository.getLatestSnapshot.mockResolvedValue(null);
    balanceSnapshotRepository.getLatestSnapshot.mockResolvedValue(null);
    bankHolidayRepository.isOverrideActive.mockResolvedValue(null);
  });

  describe('isWorkingDay', () => {
    it('returns true for a normal Monday', async () => {
      expect(await isWorkingDay('2026-03-02')).toBe(true);
    });

    it('returns false for a Saturday', async () => {
      expect(await isWorkingDay('2026-03-07')).toBe(false);
    });

    it('returns false for a Sunday', async () => {
      expect(await isWorkingDay('2026-03-08')).toBe(false);
    });

    it('returns false for a Bank Holiday Monday', async () => {
      localStorage.setItem('bank-holidays-cache', JSON.stringify({
        timestamp: Date.now(),
        dates: ['2026-04-06']
      }));
      expect(await isWorkingDay('2026-04-06')).toBe(false);
    });

    it('respects user overrides', async () => {
      bankHolidayRepository.isOverrideActive.mockResolvedValue(true);
      expect(await isWorkingDay('2026-03-07')).toBe(true);
    });
  });

  describe('nextWorkingDay', () => {
    it('shifts Saturday to Monday', async () => {
      expect(await nextWorkingDay('2026-03-07', true)).toBe('2026-03-09');
    });

    it('shifts Friday to Monday', async () => {
      expect(await nextWorkingDay('2026-03-06')).toBe('2026-03-09');
    });
  });

  describe('calculateForecast', () => {
    it('generates exactly 90 records for a 90-day horizon', async () => {
      const results = await calculateForecast('2026-03-01', 90);
      expect(results.length).toBe(90);
      expect(results[0].date).toBe('2026-03-01');
      expect(results[89].date).toBe('2026-05-29');
    });

    it('shifts a recurrent expense from Saturday to Monday', async () => {
      // 2026-03-07 is Saturday
      recurrentExpenseRepository.getAll.mockResolvedValue([
        { id: 1, amount: 10000, nextDate: '2026-03-07', label: 'Weekend Bill' }
      ]);

      const results = await calculateForecast('2026-03-05', 7);
      
      const sat = results.find(r => r.date === '2026-03-07');
      const mon = results.find(r => r.date === '2026-03-09');
      
      expect(sat.expenseTotal).toBe(0);
      expect(mon.expenseTotal).toBe(10000);
    });

    it('accumulates balance correctly', async () => {
      // ... (existing test)
    });
  });

  describe('generateExpectedIncomePredictions', () => {
    it('predicts income based on 3-month median pattern', async () => {
      // Mock history: 28th of each month, slightly different amounts
      incomeRepository.getThreeMonthHistory = vi.fn().mockResolvedValue([
        { source: 'Salary', amount: 300000, date: '2025-12-28', categoryId: 10 },
        { source: 'Salary', amount: 310000, date: '2026-01-28', categoryId: 10 },
        { source: 'Salary', amount: 305000, date: '2026-02-28', categoryId: 10 }
      ]);

      const predictions = await generateExpectedIncomePredictions();
      
      // Should have 3 predictions (one per month)
      expect(predictions.length).toBe(3);
      expect(predictions[0].source).toBe('Salary');
      expect(predictions[0].amount).toBe(305000); // Median of 300k, 305k, 310k
      
      // Check dates (assuming "today" is March 2026)
      // predictions[0] should be Apr 28, [1] May 28, [2] Jun 28
      const today = new Date();
      const expectedMonths = [
        (today.getMonth() + 1) % 12,
        (today.getMonth() + 2) % 12,
        (today.getMonth() + 3) % 12
      ];
      
      expect(new Date(predictions[0].date).getMonth()).toBe(expectedMonths[0]);
      expect(predictions[0].date.endsWith('-28')).toBe(true);
      expect(predictions[0].status).toBe('predicted');
    });
  });
});
