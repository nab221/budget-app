/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isWorkingDay, isBankHoliday, nextWorkingDay, calculateForecast, generateExpectedIncomePredictions, aggregateRollingOverview } from './cashflow.js';
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
      // Existing test placeholder
    });

    it('excludes finished or paid recurrent expenses and flags debt payments', async () => {
      recurrentExpenseRepository.getAll.mockResolvedValue([
        { id: 1, amount: 5000, nextDate: '2026-03-02', label: 'Finished', cycleTotal: 1, cycleCurrent: 1 },
        { id: 2, amount: 6000, nextDate: '2026-03-02', label: 'Paid', status: 'paid' },
        { id: 3, amount: 7000, nextDate: '2026-03-02', label: 'Debt Payment', isDebtPayment: true },
        { id: 4, amount: 8000, nextDate: '2026-03-02', label: 'Normal' }
      ]);

      const results = await calculateForecast('2026-03-02', 1);
      
      // Total should be 7000 (debt) + 8000 (normal) = 15000
      // 5000 (finished) and 6000 (paid) should be excluded
      expect(results[0].expenseTotal).toBe(15000);
      expect(results[0].hasDebtPayment).toBe(true);
      
      const resultsNextDay = await calculateForecast('2026-03-03', 1);
      expect(resultsNextDay[0].hasDebtPayment).toBe(false);
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
      expect(predictions[0].amount).toBe(3050); // Median of 300k, 305k, 310k (in pounds)
      
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

  describe('aggregateRollingOverview', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-02'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const dailyData = {
      labels: ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'],
      data: {
        balance: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900],
        income: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
        expenses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      },
      todayIndex: 1 // 2026-03-02
    };

    it('returns data unchanged for mode D', () => {
      const result = aggregateRollingOverview(dailyData, 'D');
      expect(result).toEqual(dailyData);
    });

    it('bins by week for mode W (Mixed Resolution)', () => {
      // 2026-03-01 is Sunday (Bin 1)
      // 2026-03-02 to 2026-03-08 (Mon to Sun - Bin 2)
      // 2026-03-09 to 2026-03-10 (Mon to Tue - Bin 3)
      
      const result = aggregateRollingOverview(dailyData, 'W');
      
      // Labels and balance should remain high-resolution (10 days)
      expect(result.labels.length).toBe(10);
      expect(result.data.balance.length).toBe(10);
      expect(result.data.balance).toEqual(dailyData.data.balance);
      
      // Income should be binned but distributed (10 objects)
      expect(result.data.income.length).toBe(10);
      
      // Bin 1: Sunday 1st. Total = 100. Not forecast because it's before or equal to today.
      expect(result.data.income[0]).toEqual({ y: 100, daily: 100, isForecast: false });
      
      // Bin 2: Mon 2nd to Sun 8th. Total = 700. 
      // Contains March 3rd-8th which are AFTER March 2nd. So isForecast: true.
      expect(result.data.income[1].isForecast).toBe(true);
      expect(result.data.income[1].y).toBe(700);

      // Bin 3: Mon 9th to Tue 10th. Total = 200
      expect(result.data.income[8].isForecast).toBe(true);
      expect(result.data.income[8].y).toBe(200);
      
      expect(result.todayIndex).toBe(1);
    });

    it('bins by month for mode M (Mixed Resolution)', () => {
      const result = aggregateRollingOverview(dailyData, 'M');
      // All 10 days are in March 2026.
      expect(result.labels.length).toBe(10);
      expect(result.data.income.length).toBe(10);
      
      // All items in March bin (Total = 1000)
      expect(result.data.income[0].y).toBe(1000);
      // It contains dates after March 2nd.
      expect(result.data.income[0].isForecast).toBe(true);
      
      expect(result.data.balance).toEqual(dailyData.data.balance);
      expect(result.todayIndex).toBe(1);
    });
  });
});
