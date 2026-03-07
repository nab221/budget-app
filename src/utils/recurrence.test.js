import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseISO, format, addMonths } from 'date-fns';
import { generateInstances, RecurrenceManager, advanceNextDate } from './recurrence.js';
import { db } from '../db/schema.js';

// Helper to create a mock Dexie table
function createMockTable() {
  const table = {
    where: vi.fn(),
    equals: vi.fn(),
    toArray: vi.fn(),
    bulkAdd: vi.fn(),
  };
  table.where.mockReturnValue(table);
  table.equals.mockReturnValue(table);
  return table;
}

// Mock the DB
vi.mock('../db/schema.js', () => {
  const recurrentExpenses = {
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    toArray: vi.fn(),
    bulkAdd: vi.fn(),
  };
  recurrentExpenses.where.mockReturnValue(recurrentExpenses);
  recurrentExpenses.equals.mockReturnValue(recurrentExpenses);

  const oneOffExpenses = {
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    toArray: vi.fn(),
    bulkAdd: vi.fn(),
  };
  oneOffExpenses.where.mockReturnValue(oneOffExpenses);
  oneOffExpenses.equals.mockReturnValue(oneOffExpenses);

  return {
    db: {
      recurrentExpenses,
      oneOffExpenses,
      transaction: vi.fn((mode, tables, callback) => callback()),
    },
  };
});

describe('generateInstances', () => {
  const baseTransaction = {
    id: 123,
    amount: 100,
    category: 'Food',
    date: '2023-01-31',
    isRecurring: true,
    recurrenceId: 'abc-123'
  };

  it('should return exactly count items', () => {
    const result = generateInstances(baseTransaction, 'monthly', 3);
    expect(result).toHaveLength(3);
  });

  it('should remove id from base object and preserve other fields', () => {
    const result = generateInstances(baseTransaction, 'monthly', 1);
    expect(result[0].id).toBeUndefined();
    expect(result[0].amount).toBe(100);
    expect(result[0].category).toBe('Food');
    expect(result[0].isRecurring).toBe(true);
    expect(result[0].recurrenceId).toBe('abc-123');
  });

  it('should generate a recurrenceId if one is missing', () => {
    const baseWithoutId = { amount: 50, date: '2023-01-01' };
    const result = generateInstances(baseWithoutId, 'weekly', 1);
    expect(result[0].recurrenceId).toBeDefined();
    expect(typeof result[0].recurrenceId).toBe('string');
  });

  it('should correctly project weekly dates', () => {
    const result = generateInstances(baseTransaction, 'weekly', 2);
    expect(result[0].date).toBe('2023-02-07');
    expect(result[1].date).toBe('2023-02-14');
  });

  it('should correctly project biweekly dates', () => {
    const result = generateInstances(baseTransaction, 'biweekly', 2);
    expect(result[0].date).toBe('2023-02-14');
    expect(result[1].date).toBe('2023-02-28');
  });

  it('should correctly project monthly dates and handle month-end drift', () => {
    // Jan 31 -> Feb 28 -> Mar 31
    const result = generateInstances(baseTransaction, 'monthly', 2);
    expect(result[0].date).toBe('2023-02-28');
    expect(result[1].date).toBe('2023-03-31');
  });

  it('should correctly project quarterly dates', () => {
    // Jan 31 -> Apr 30 -> Jul 31
    const result = generateInstances(baseTransaction, 'quarterly', 2);
    expect(result[0].date).toBe('2023-04-30');
    expect(result[1].date).toBe('2023-07-31');
  });

  it('should correctly project annual dates', () => {
    const result = generateInstances(baseTransaction, 'annually', 2);
    expect(result[0].date).toBe('2024-01-31');
    expect(result[1].date).toBe('2025-01-31');
  });

  it('should update nextDate and predictedPaymentDate if present', () => {
    const baseWithExtraDates = {
      ...baseTransaction,
      nextDate: '2023-01-31',
      predictedPaymentDate: '2023-01-31'
    };
    const result = generateInstances(baseWithExtraDates, 'monthly', 1);
    expect(result[0].date).toBe('2023-02-28');
    expect(result[0].nextDate).toBe('2023-02-28');
    expect(result[0].predictedPaymentDate).toBe('2023-02-28');
  });
});

describe('RecurrenceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expand series that are nearing expiration', async () => {
    const today = new Date();
    const nearlyExpiredDate = format(addMonths(today, 1), 'yyyy-MM-dd');
    
    const mockData = [
      { 
        id: 1, 
        date: nearlyExpiredDate, 
        isRecurring: 1, 
        recurrenceId: 'rid-1', 
        frequency: 'monthly',
        label: 'Near Expiry' 
      }
    ];

    db.recurrentExpenses.toArray.mockResolvedValue(mockData);
    db.oneOffExpenses.toArray.mockResolvedValue([]);

    const results = await RecurrenceManager.checkAndGenerate();

    expect(results.recurrentExpenses).toBe(12);
    expect(db.recurrentExpenses.bulkAdd).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ recurrenceId: 'rid-1', isRecurring: true })
    ]));
  });

  it('should ignore series that have enough future instances', async () => {
    const today = new Date();
    const farFutureDate = format(addMonths(today, 6), 'yyyy-MM-dd');
    
    const mockData = [
      { 
        id: 1, 
        date: farFutureDate, 
        isRecurring: 1, 
        recurrenceId: 'rid-1', 
        frequency: 'monthly',
        label: 'Far Future' 
      }
    ];

    db.recurrentExpenses.toArray.mockResolvedValue(mockData);
    db.oneOffExpenses.toArray.mockResolvedValue([]);

    const results = await RecurrenceManager.checkAndGenerate();

    expect(results.recurrentExpenses).toBe(0);
    expect(db.recurrentExpenses.bulkAdd).not.toHaveBeenCalled();
  });

  it('should correctly handle multiple instances of the same series and pick the latest one', async () => {
    const today = new Date();
    const lastMonth = format(addMonths(today, -1), 'yyyy-MM-dd');
    const nextMonth = format(addMonths(today, 1), 'yyyy-MM-dd');
    
    const mockData = [
      { id: 1, date: lastMonth, isRecurring: 1, recurrenceId: 'rid-1', frequency: 'monthly' },
      { id: 2, date: nextMonth, isRecurring: 1, recurrenceId: 'rid-1', frequency: 'monthly' }
    ];

    db.recurrentExpenses.toArray.mockResolvedValue(mockData);
    db.oneOffExpenses.toArray.mockResolvedValue([]);

    const results = await RecurrenceManager.checkAndGenerate();

    // It should generate instances starting FROM the nextMonth one (which is 1 month away, so < 2 months)
    expect(results.recurrentExpenses).toBe(12);
    const addedInstances = db.recurrentExpenses.bulkAdd.mock.calls[0][0];
    expect(addedInstances[0].date).toBe(format(addMonths(parseISO(nextMonth), 1), 'yyyy-MM-dd'));
  });
});

describe('advanceNextDate', () => {
  it('weekly item → nextDate advances by 7 days', () => {
    const item = { nextDate: '2026-01-01', frequency: 'weekly' };
    const result = advanceNextDate(item);
    expect(result.nextDate).toBe('2026-01-08');
  });

  it('biweekly item → nextDate advances by 14 days', () => {
    const item = { nextDate: '2026-01-01', frequency: 'biweekly' };
    const result = advanceNextDate(item);
    expect(result.nextDate).toBe('2026-01-15');
  });

  it('monthly item → nextDate advances by 1 month (same day)', () => {
    const item = { nextDate: '2026-01-01', frequency: 'monthly' };
    const result = advanceNextDate(item);
    expect(result.nextDate).toBe('2026-02-01');
  });

  it('quarterly item → nextDate advances by 3 months', () => {
    const item = { nextDate: '2026-01-01', frequency: 'quarterly' };
    const result = advanceNextDate(item);
    expect(result.nextDate).toBe('2026-04-01');
  });

  it('annually item → nextDate advances by 1 year', () => {
    const item = { nextDate: '2026-01-01', frequency: 'annually' };
    const result = advanceNextDate(item);
    expect(result.nextDate).toBe('2027-01-01');
  });

  it('unknown/default frequency → advances by 1 month (mirrors generateInstances default)', () => {
    const item = { nextDate: '2026-01-01', frequency: 'unknown' };
    const result = advanceNextDate(item);
    expect(result.nextDate).toBe('2026-02-01');
  });

  it('isDebtPayment=true, cycleTotal=6, cycleCurrent=2 → returned date is correct AND cycleCurrent returned as 3 (incremented)', () => {
    const item = { 
      nextDate: '2026-01-01', 
      frequency: 'monthly', 
      isDebtPayment: true, 
      cycleTotal: 6, 
      cycleCurrent: 2 
    };
    const result = advanceNextDate(item);
    expect(result.nextDate).toBe('2026-02-01');
    expect(result.cycleCurrent).toBe(3);
  });

  it('isDebtPayment=false (regular subscription), cycleTotal=6, cycleCurrent=2 → cycleCurrent unchanged (still 2), only date advances', () => {
    const item = { 
      nextDate: '2026-01-01', 
      frequency: 'monthly', 
      isDebtPayment: false, 
      cycleTotal: 6, 
      cycleCurrent: 2 
    };
    const result = advanceNextDate(item);
    expect(result.nextDate).toBe('2026-02-01');
    expect(result.cycleCurrent).toBe(2);
  });

  it('isDebtPayment=true but cycleTotal=0 → cycleCurrent unchanged (no defined cycle endpoint)', () => {
    const item = { 
      nextDate: '2026-01-01', 
      frequency: 'monthly', 
      isDebtPayment: true, 
      cycleTotal: 0, 
      cycleCurrent: 2 
    };
    const result = advanceNextDate(item);
    expect(result.nextDate).toBe('2026-02-01');
    expect(result.cycleCurrent).toBe(2);
  });
});
