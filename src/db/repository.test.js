/**
 * repository.test.js
 *
 * Unit tests for the balanceSnapshotRepository and the ensureOpeningBalanceCategory
 * seeding logic added in Phase 11.
 *
 * Because Dexie requires IndexedDB (unavailable in Node/Vitest), the `db` module is
 * mocked so that each repository method is exercised against in-memory data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the global scheduleAutoSave
// ---------------------------------------------------------------------------
const scheduleAutoSaveMock = vi.fn();
// Use globalThis for Vitest compatibility
globalThis.window = globalThis.window || {};
globalThis.window.scheduleAutoSave = scheduleAutoSaveMock;

// Stub localStorage for tests (not available in Node/Vitest environment)
if (typeof globalThis.localStorage === 'undefined') {
  const localStorageStore = {};
  globalThis.localStorage = {
    getItem: (key) => localStorageStore[key] ?? null,
    setItem: (key, value) => { localStorageStore[key] = String(value); },
    removeItem: (key) => { delete localStorageStore[key]; },
    clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
  };
}

// ---------------------------------------------------------------------------
// Mock the Dexie db so tests run without IndexedDB
// ---------------------------------------------------------------------------

// We build a lightweight in-memory "table" factory that mirrors the Dexie API
// surface used by balanceSnapshotRepository and categoryRepository.
function createMockTable(initialRows = []) {
  let rows = [...initialRows];
  let nextId = rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1;

  const where = (field) => ({
    equals: (value) => ({
      first: async () => rows.find(r => r[field] === value),
      count: async () => rows.filter(r => r[field] === value).length,
      toArray: async () => rows.filter(r => r[field] === value),
      delete: async () => {
        rows = rows.filter(r => r[field] !== value);
      }
    }),
    startsWith: (value) => {
      const matched = () => rows.filter(r => r[field] && r[field].startsWith(value));
      return {
        toArray: async () => matched(),
        filter: (fn) => ({
          toArray: async () => matched().filter(fn)
        })
      };
    },
    below: (value) => ({
      reverse: () => ({
        first: async () => [...rows].filter(r => r[field] < value).sort((a, b) => b[field].localeCompare(a[field]))[0]
      })
    }),
    between: (start, end, inclStart, inclEnd) => ({
      toArray: async () => rows.filter(r => {
        const v = r[field];
        const isAfterStart = inclStart ? v >= start : v > start;
        const isBeforeEnd = inclEnd ? v <= end : v < end;
        return isAfterStart && isBeforeEnd;
      })
    })
  });

  return {
    _rows: () => rows,
    toArray: async () => [...rows],
    get: async (id) => rows.find(r => r.id === id),
    add: async (item) => {
      const id = nextId++;
      rows.push({ id, ...item });
      return id;
    },
    bulkAdd: async (items) => {
      items.forEach(item => {
        const id = nextId++;
        rows.push({ id, ...item });
      });
      return items.length;
    },
    clear: async () => {
      rows.splice(0, rows.length);
      return 0;
    },
    update: async (id, changes) => {
      const idx = rows.findIndex(r => r.id === id);
      if (idx !== -1) rows[idx] = { ...rows[idx], ...changes };
      return 1;
    },
    delete: async (id) => {
      const idx = rows.findIndex(r => r.id === id);
      if (idx !== -1) rows.splice(idx, 1);
    },
    bulkDelete: async (ids) => {
      rows = rows.filter(r => !ids.includes(r.id));
    },
    where,
    count: async () => rows.length,
    orderBy: (field) => ({
      reverse: () => ({
        first: async () => {
          if (rows.length === 0) return undefined;
          return [...rows].sort((a, b) => b[field].localeCompare(a[field]))[0];
        },
        last: async () => {
          if (rows.length === 0) return undefined;
          return [...rows].sort((a, b) => b[field].localeCompare(a[field]))[rows.length - 1];
        }
      }),
      last: async () => {
        if (rows.length === 0) return undefined;
        return [...rows].sort((a, b) => a[field].localeCompare(b[field]))[rows.length - 1];
      },
      first: async () => {
        if (rows.length === 0) return undefined;
        return [...rows].sort((a, b) => a[field].localeCompare(b[field]))[0];
      }
    })
  };
}

// Mock the schema module before importing the repository
vi.mock('./schema.js', () => {
  const balanceSnapshots = createMockTable();
  const dailyBalanceSnapshots = createMockTable();
  const categories = createMockTable();
  const income = createMockTable();
  const recurrentExpenses = createMockTable();
  const oneOffExpenses = createMockTable();
  const childcareAccounts = createMockTable();
  const childcareLedger = createMockTable();
  const debts = createMockTable();
  const assets = createMockTable();
  const statements = createMockTable();
  const expectedIncome = createMockTable();
  const netWorthSnapshots = createMockTable();
  const bankHolidayOverrides = createMockTable();

  return {
    db: {
      balanceSnapshots,
      dailyBalanceSnapshots,
      categories,
      income,
      recurrentExpenses,
      oneOffExpenses,
      childcareAccounts,
      childcareLedger,
      debts,
      assets,
      statements,
      expectedIncome,
      netWorthSnapshots,
      bankHolidayOverrides,
      transaction: async (...args) => {
        const fn = args[args.length - 1];
        if (typeof fn === 'function') return fn();
      }
    }
  };
});

// After mock is declared, import the repository (Vitest hoists vi.mock calls)
const {
  balanceSnapshotRepository,
  categoryRepository,
  debtRepository,
  recurrentExpenseRepository,
  statementRepository,
  getYearlyDailySpending,
  getYearlyDailyIncome,
  getDashboardData
} = await import('./repository.js');
const { db } = await import('./schema.js');

// ---------------------------------------------------------------------------
// Helpers to reset mock tables between tests
// ---------------------------------------------------------------------------
function clearTable(table) {
  // Drain the rows array by deleting all entries
  const rows = table._rows();
  rows.splice(0, rows.length);
}

// ---------------------------------------------------------------------------
// balanceSnapshotRepository tests
// ---------------------------------------------------------------------------

describe('balanceSnapshotRepository', () => {
  beforeEach(() => {
    clearTable(db.balanceSnapshots);
  });

  describe('getByMonth', () => {
    it('returns undefined when no snapshot exists for the month', async () => {
      const result = await balanceSnapshotRepository.getByMonth('2026-01');
      expect(result).toBeUndefined();
    });

    it('returns the snapshot for the requested month', async () => {
      await db.balanceSnapshots.add({
        month: '2026-01',
        openingBalance: 100000,
        closingBalance: 150000,
        incomeTotal: 200000,
        expenseTotal: 50000
      });

      const result = await balanceSnapshotRepository.getByMonth('2026-01');
      expect(result).toBeDefined();
      expect(result.month).toBe('2026-01');
      expect(result.openingBalance).toBe(100000);
    });

    it('does not return a snapshot for a different month', async () => {
      await db.balanceSnapshots.add({
        month: '2026-02',
        openingBalance: 50000,
        closingBalance: 80000,
        incomeTotal: 100000,
        expenseTotal: 70000
      });

      const result = await balanceSnapshotRepository.getByMonth('2026-01');
      expect(result).toBeUndefined();
    });
  });

  describe('save', () => {
    it('inserts a new snapshot when none exists for the month', async () => {
      const snapshot = {
        month: '2026-01',
        openingBalance: 0,
        closingBalance: 50000,
        incomeTotal: 100000,
        expenseTotal: 50000
      };

      const id = await balanceSnapshotRepository.save(snapshot);
      expect(typeof id).toBe('number');

      const saved = await balanceSnapshotRepository.getByMonth('2026-01');
      expect(saved).toBeDefined();
      expect(saved.closingBalance).toBe(50000);
    });

    it('updates an existing snapshot for the same month (upsert)', async () => {
      const snapshot = {
        month: '2026-01',
        openingBalance: 0,
        closingBalance: 50000,
        incomeTotal: 100000,
        expenseTotal: 50000
      };

      await balanceSnapshotRepository.save(snapshot);

      // Save again with updated values
      const updated = { ...snapshot, closingBalance: 75000 };
      await balanceSnapshotRepository.save(updated);

      const rows = await db.balanceSnapshots.toArray();
      expect(rows.length).toBe(1); // still one row, not two
      expect(rows[0].closingBalance).toBe(75000);
    });
  });

  describe('deleteFrom', () => {
    it('deletes snapshots from a given month onwards (inclusive)', async () => {
      await db.balanceSnapshots.add({ month: '2025-11', openingBalance: 0, closingBalance: 10000, incomeTotal: 10000, expenseTotal: 0 });
      await db.balanceSnapshots.add({ month: '2025-12', openingBalance: 10000, closingBalance: 20000, incomeTotal: 20000, expenseTotal: 10000 });
      await db.balanceSnapshots.add({ month: '2026-01', openingBalance: 20000, closingBalance: 30000, incomeTotal: 30000, expenseTotal: 20000 });
      await db.balanceSnapshots.add({ month: '2026-02', openingBalance: 30000, closingBalance: 40000, incomeTotal: 40000, expenseTotal: 30000 });

      await balanceSnapshotRepository.deleteFrom('2026-01');

      const remaining = await db.balanceSnapshots.toArray();
      expect(remaining.length).toBe(2);
      expect(remaining.map(r => r.month).sort()).toEqual(['2025-11', '2025-12']);
    });

    it('does nothing when no snapshots exist from that month', async () => {
      await db.balanceSnapshots.add({ month: '2025-11', openingBalance: 0, closingBalance: 10000, incomeTotal: 10000, expenseTotal: 0 });

      await balanceSnapshotRepository.deleteFrom('2026-01');

      const remaining = await db.balanceSnapshots.toArray();
      expect(remaining.length).toBe(1);
    });

    it('deletes all snapshots when fromMonthStr is the earliest month', async () => {
      await db.balanceSnapshots.add({ month: '2025-11', openingBalance: 0, closingBalance: 10000, incomeTotal: 10000, expenseTotal: 0 });
      await db.balanceSnapshots.add({ month: '2026-01', openingBalance: 10000, closingBalance: 20000, incomeTotal: 20000, expenseTotal: 10000 });

      await balanceSnapshotRepository.deleteFrom('2025-11');

      const remaining = await db.balanceSnapshots.toArray();
      expect(remaining.length).toBe(0);
    });
  });

  describe('getLatestSnapshot', () => {
    it('returns undefined when no snapshots exist', async () => {
      const result = await balanceSnapshotRepository.getLatestSnapshot();
      expect(result).toBeUndefined();
    });

    it('returns the most recent snapshot by month string', async () => {
      await db.balanceSnapshots.add({ month: '2025-11', openingBalance: 0, closingBalance: 10000, incomeTotal: 10000, expenseTotal: 0 });
      await db.balanceSnapshots.add({ month: '2026-02', openingBalance: 40000, closingBalance: 50000, incomeTotal: 50000, expenseTotal: 40000 });
      await db.balanceSnapshots.add({ month: '2026-01', openingBalance: 20000, closingBalance: 30000, incomeTotal: 30000, expenseTotal: 20000 });

      const latest = await balanceSnapshotRepository.getLatestSnapshot();
      expect(latest).toBeDefined();
      expect(latest.month).toBe('2026-02');
    });

    it('returns the only snapshot when just one exists', async () => {
      await db.balanceSnapshots.add({ month: '2026-01', openingBalance: 0, closingBalance: 50000, incomeTotal: 100000, expenseTotal: 50000 });

      const latest = await balanceSnapshotRepository.getLatestSnapshot();
      expect(latest.month).toBe('2026-01');
    });
  });
});

// ---------------------------------------------------------------------------
// statementRepository tests
// ---------------------------------------------------------------------------

describe('statementRepository', () => {
  beforeEach(() => {
    clearTable(db.statements);
    clearTable(db.recurrentExpenses);
    clearTable(db.categories);
  });

  describe('addWithExpense', () => {
    it('creates a statement and a linked recurrent expense', async () => {
      // 1. Setup category (matching repository's search name)
      const categoryId = await db.categories.add({ name: 'Credit Cards & Loans', group: 'expenses' });

      // 2. Add statement
      const statementData = {
        debtId: 1,
        date: '2026-01-15',
        amount: 500,
        minimumPayment: 25,
        paymentDueDate: '2026-02-05'
      };

      const statementId = await statementRepository.addWithExpense(statementData, 'Visa');

      // 3. Verify statement
      const statement = await db.statements.get(statementId);
      expect(statement).toBeDefined();
      expect(statement.amount).toBe(50000); // 500 * 100
      expect(statement.minimumPayment).toBe(2500); // 25 * 100
      expect(statement.linkedExpenseId).toBeDefined();

      // 4. Verify expense
      const expenseId = statement.linkedExpenseId;
      const expense = await db.recurrentExpenses.get(expenseId);
      expect(expense).toBeDefined();
      expect(expense.label).toBe('Payment: Visa');
      expect(expense.amount).toBe(2500);
      expect(expense.nextDate).toBe('2026-02-05');
      expect(expense.categoryId).toBe(categoryId);
      expect(expense.status).toBe('pending');
      expect(expense.isDebtPayment).toBe(true);
      expect(expense.linkedStatementId).toBe(statementId);
      expect(expense.isRecurring).toBe(false);
    });

    it('falls back to statement date if paymentDueDate is missing', async () => {
      await db.categories.add({ name: 'Credit Cards & Loans', group: 'expenses' });

      const statementId = await statementRepository.addWithExpense({
        debtId: 1,
        date: '2026-01-15',
        amount: 500,
        minimumPayment: 25
      }, 'Visa');

      const statement = await db.statements.get(statementId);
      const expense = await db.recurrentExpenses.get(statement.linkedExpenseId);
      expect(expense.nextDate).toBe('2026-01-15');
    });

    it('creates expense with null categoryId if category not found', async () => {
      // NO category seeded
      const statementId = await statementRepository.addWithExpense({
        debtId: 1,
        date: '2026-01-15',
        amount: 500,
        minimumPayment: 25
      }, 'Visa');

      const statement = await db.statements.get(statementId);
      const expense = await db.recurrentExpenses.get(statement.linkedExpenseId);
      expect(expense.categoryId).toBeNull();
    });
  });

  describe('recordPayment', () => {
    it('updates both statement and linked expense', async () => {
      // 1. Setup
      await db.categories.add({ name: 'Credit Cards & Loans', group: 'expenses' });
      const statementId = await statementRepository.addWithExpense({
        debtId: 1,
        date: '2026-01-15',
        amount: 500,
        minimumPayment: 25,
        paymentDueDate: '2026-02-05'
      }, 'Visa');

      const statementBefore = await db.statements.get(statementId);
      const expenseId = statementBefore.linkedExpenseId;

      // 2. Record payment
      await statementRepository.recordPayment(statementId, 30, '2026-02-01');

      // 3. Verify statement updates
      const statementAfter = await db.statements.get(statementId);
      expect(statementAfter.actualPaymentAmount).toBe(3000);
      expect(statementAfter.actualPaymentDate).toBe('2026-02-01');

      // 4. Verify expense updates
      const expenseAfter = await db.recurrentExpenses.get(expenseId);
      expect(expenseAfter.status).toBe('paid');
      expect(expenseAfter.amount).toBe(3000);
      expect(expenseAfter.date).toBe('2026-02-01');
      // nextDate must NOT be advanced — item stays in its original month
      expect(expenseAfter.nextDate).toBe('2026-02-05');
    });

    it('throws error if statement not found', async () => {
      await expect(statementRepository.recordPayment(999, 10, '2026-01-01'))
        .rejects.toThrow('Statement not found');
    });
  });
});

describe('recurrentExpenseRepository.markAllAsPaid', () => {
  beforeEach(() => {
    clearTable(db.recurrentExpenses);
    clearTable(db.categories);
    clearTable(db.statements);
  });

  it('marks all pending items for the current month as paid without changing nextDate', async () => {
    const monthStr = new Date().toISOString().slice(0, 7);
    const nextDate = `${monthStr}-10`;

    await db.recurrentExpenses.add({ status: 'pending', amount: 1000, nextDate, cycleTotal: 0 });
    await db.recurrentExpenses.add({ status: 'pending', amount: 2000, nextDate, cycleTotal: 0 });

    await recurrentExpenseRepository.markAllAsPaid();

    const all = await db.recurrentExpenses.toArray();
    for (const item of all) {
      expect(item.status).toBe('paid');
      expect(item.nextDate).toBe(nextDate); // must NOT advance
    }
  });

  it('does not affect items that are already paid', async () => {
    const monthStr = new Date().toISOString().slice(0, 7);
    const nextDate = `${monthStr}-05`;

    await db.recurrentExpenses.add({ status: 'paid', amount: 500, nextDate, cycleTotal: 0 });

    await recurrentExpenseRepository.markAllAsPaid();

    const all = await db.recurrentExpenses.toArray();
    expect(all[0].status).toBe('paid'); // still paid, untouched
  });

  it('increments cycleCurrent only when cycleTotal > 0', async () => {
    const monthStr = new Date().toISOString().slice(0, 7);
    const nextDate = `${monthStr}-15`;

    await db.recurrentExpenses.add({ status: 'pending', amount: 800, nextDate, cycleTotal: 12, cycleCurrent: 3 });
    await db.recurrentExpenses.add({ status: 'pending', amount: 900, nextDate, cycleTotal: 0, cycleCurrent: 0 });

    await recurrentExpenseRepository.markAllAsPaid();

    const all = await db.recurrentExpenses.toArray();
    const withCycle = all.find(i => i.cycleTotal === 12);
    const withoutCycle = all.find(i => i.cycleTotal === 0);

    expect(withCycle.cycleCurrent).toBe(4); // incremented
    expect(withoutCycle.cycleCurrent).toBe(0); // unchanged
  });
});

describe('getYearlyDailySpending', () => {
  beforeEach(() => {
    clearTable(db.oneOffExpenses);
    clearTable(db.recurrentExpenses);
    clearTable(db.categories);
  });

  it('maps paid recurrent spend to actual paid date, not nextDate', async () => {
    const groceriesId = await db.categories.add({ name: 'Groceries' });

    await db.recurrentExpenses.add({
      status: 'paid',
      amount: 2500,
      date: '2026-01-10',
      nextDate: '2026-01-15',
      categoryId: groceriesId
    });

    const result = await getYearlyDailySpending(2026);

    expect(result['2026-01-10']?.total).toBe(2500);
    expect(result['2026-01-10']?.topCategory).toBe('Groceries');
    expect(result['2026-01-15']).toBeUndefined();
  });

  it('excludes paid recurrent entries outside the target year', async () => {
    const groceriesId = await db.categories.add({ name: 'Groceries' });

    await db.recurrentExpenses.add({
      status: 'paid',
      amount: 4000,
      date: '2025-12-31',
      nextDate: '2026-01-02',
      categoryId: groceriesId
    });

    const result = await getYearlyDailySpending(2026);
    expect(result['2025-12-31']).toBeUndefined();
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('aggregates one-off and recurrent amounts on the same day', async () => {
    const transportId = await db.categories.add({ name: 'Transport' });

    await db.oneOffExpenses.add({
      date: '2026-02-03',
      amount: 1200,
      categoryId: transportId
    });

    await db.recurrentExpenses.add({
      status: 'paid',
      date: '2026-02-03',
      nextDate: '2026-02-10',
      amount: 800,
      categoryId: transportId
    });

    const result = await getYearlyDailySpending(2026);

    expect(result['2026-02-03']?.total).toBe(2000);
    expect(result['2026-02-03']?.topCategory).toBe('Transport');
  });
});

describe('getYearlyDailyIncome', () => {
  beforeEach(() => {
    clearTable(db.income);
    clearTable(db.categories);
  });

  it('aggregates income totals by day', async () => {
    const salaryId = await db.categories.add({ name: 'Salary' });

    await db.income.add({ date: '2026-03-01', amount: 100000, source: 'Employer A', categoryId: salaryId });
    await db.income.add({ date: '2026-03-01', amount: 5000, source: 'Bonus', categoryId: salaryId });

    const result = await getYearlyDailyIncome(2026);
    expect(result['2026-03-01']?.total).toBe(105000);
  });

  it('uses source as top category label when available', async () => {
    const salaryId = await db.categories.add({ name: 'Salary' });

    await db.income.add({ date: '2026-02-14', amount: 20000, source: 'Freelance', categoryId: salaryId });
    await db.income.add({ date: '2026-02-14', amount: 10000, source: 'Gift', categoryId: salaryId });

    const result = await getYearlyDailyIncome(2026);
    expect(result['2026-02-14']?.topCategory).toBe('Freelance');
  });

  it('filters out income entries outside the target year', async () => {
    const salaryId = await db.categories.add({ name: 'Salary' });

    await db.income.add({ date: '2025-12-31', amount: 9999, source: 'Old Year', categoryId: salaryId });

    const result = await getYearlyDailyIncome(2026);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// triggerSync tests
// ---------------------------------------------------------------------------

describe('triggerSync', () => {
  beforeEach(() => {
    scheduleAutoSaveMock.mockClear();
    clearTable(db.categories);
    clearTable(db.statements);
    clearTable(db.recurrentExpenses);
    clearTable(db.balanceSnapshots);
  });

  it('is called when adding a category', async () => {
    await categoryRepository.add({ group: 'expenses', name: 'Test Sync' });
    expect(scheduleAutoSaveMock).toHaveBeenCalled();
  });

  it('is called when adding a statement with expense', async () => {
    await statementRepository.addWithExpense({
      debtId: 1, date: '2026-01-01', amount: 100, minimumPayment: 10
    }, 'Test Debt');
    expect(scheduleAutoSaveMock).toHaveBeenCalled();
  });

  it('is called when saving a balance snapshot', async () => {
    await balanceSnapshotRepository.save({
      month: '2026-01', openingBalance: 0, closingBalance: 100, incomeTotal: 100, expenseTotal: 0
    });
    expect(scheduleAutoSaveMock).toHaveBeenCalled();
  });
});

describe('categoryRepository compatibility and grouping', () => {
  beforeEach(() => {
    clearTable(db.categories);
    clearTable(db.income);
    clearTable(db.recurrentExpenses);
    clearTable(db.oneOffExpenses);
  });

  it('adds and deletes categories via compatibility wrappers', async () => {
    const id = await categoryRepository.addCategory('income', 'Freelance');
    const created = await db.categories.get(id);
    expect(created.name).toBe('Freelance');
    expect(created.group).toBe('income');

    await categoryRepository.deleteCategory(id);
    const deleted = await db.categories.get(id);
    expect(deleted).toBeUndefined();
  });

  it('reports category usage across income and expense tables', async () => {
    const usedId = await db.categories.add({ name: 'Salary', group: 'income' });
    const freeId = await db.categories.add({ name: 'Unused', group: 'expenses' });
    await db.income.add({ date: '2026-01-01', source: 'Employer', amount: 50000, categoryId: usedId });

    await expect(categoryRepository.isCategoryInUse(usedId)).resolves.toBe(true);
    await expect(categoryRepository.isCategoryInUse(freeId)).resolves.toBe(false);
  });

  it('seeds income and expense defaults for an empty database', async () => {
    const seeded = await categoryRepository.seedDefaultCategories();
    const categories = await db.categories.toArray();

    expect(seeded).toBe(true);
    expect(categories.some(c => c.group === 'income' && c.name === 'Salary')).toBe(true);
    expect(categories.some(c => c.group === 'expenses')).toBe(true);
    expect(categories.some(c => c.group === 'system' && c.name === 'Opening Balance')).toBe(true);
  });

  it('normalizes legacy fixed/variable groups to expenses and ensures income exists', async () => {
    await db.categories.bulkAdd([
      { name: 'Legacy Fixed', group: 'fixed' },
      { name: 'Legacy Variable', group: 'variable' },
      { name: 'Opening Balance', group: 'system' }
    ]);

    await categoryRepository.normalizeLegacyGroups();
    const categories = await db.categories.toArray();

    const legacy = categories.filter(c => c.name === 'Legacy Fixed' || c.name === 'Legacy Variable');
    expect(legacy.every(c => c.group === 'expenses')).toBe(true);
    expect(categories.some(c => c.group === 'income' && c.name === 'Salary')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getDashboardData tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// debtRepository.generateLoanPayments tests
// ---------------------------------------------------------------------------

describe('debtRepository.generateLoanPayments', () => {
  beforeEach(() => {
    clearTable(db.debts);
    clearTable(db.recurrentExpenses);
    clearTable(db.categories);
  });

  it('uses paymentStartDate when provided (phase-18 regression)', async () => {
    const debtId = await db.debts.add({
      name: 'Test Loan',
      debtType: 'loan',
      fixedMonthlyPayment: 20000,
      paymentStartDate: '2026-06-01',
    });

    await debtRepository.generateLoanPayments(debtId, {
      name: 'Test Loan',
      debtType: 'loan',
      fixedMonthlyPayment: 20000,
      paymentStartDate: '2026-06-01',
    });

    const expenses = await db.recurrentExpenses
      .where('linkedDebtId').equals(debtId).toArray();

    expect(expenses.length).toBe(12);
    const dates = expenses.map(e => e.nextDate).sort();
    expect(dates[0]).toBe('2026-06-01');
  });

  it('falls back to today when paymentStartDate is not set', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const debtId = await db.debts.add({
      name: 'Fallback Loan',
      debtType: 'loan',
      fixedMonthlyPayment: 10000,
    });

    await debtRepository.generateLoanPayments(debtId, {
      name: 'Fallback Loan',
      debtType: 'loan',
      fixedMonthlyPayment: 10000,
    });

    const expenses = await db.recurrentExpenses
      .where('linkedDebtId').equals(debtId).toArray();

    expect(expenses.length).toBe(12);
    const dates = expenses.map(e => e.nextDate).sort();
    expect(dates[0]).toBe(today);
  });

  it('regenerates loan payments when paymentStartDate changes on edit (phase-18 regression)', async () => {
    // Use debtRepository.add (passes pounds; internally converts to pence)
    // so that initial payments are generated and fixedMonthlyPayment is
    // stored correctly in pence.
    const debtId = await debtRepository.add({
      name: 'Test Loan',
      debtType: 'loan',
      fixedMonthlyPayment: 200,  // £200 → stored as 20000 pence
      paymentStartDate: '2026-06-01',
    });

    // Verify initial payments start June
    let expenses = await db.recurrentExpenses
      .where('linkedDebtId').equals(debtId).toArray();
    expect(expenses.map(e => e.nextDate).sort()[0]).toBe('2026-06-01');

    // Simulate the UI edit: pass pound values (same as form input) so that
    // toPence(200) = 20000 matches the stored value — only paymentStartDate
    // changes. Without the fix, this should NOT trigger regeneration.
    await debtRepository.update(debtId, {
      name: 'Test Loan',
      debtType: 'loan',
      fixedMonthlyPayment: 200,  // same £200 → toPence → 20000 (unchanged)
      paymentStartDate: '2026-09-01',
    });

    // Verify payments were regenerated with new start date
    expenses = await db.recurrentExpenses
      .where('linkedDebtId').equals(debtId).toArray();
    expect(expenses.length).toBe(12);
    expect(expenses.map(e => e.nextDate).sort()[0]).toBe('2026-09-01');
  });
});

describe('getDashboardData', () => {
  beforeEach(async () => {
    await db.debts.clear();
    await db.assets.clear();
    await db.income.clear();
    await db.recurrentExpenses.clear();
    await db.oneOffExpenses.clear();
    await db.childcareAccounts.clear();
    await db.childcareLedger.clear();
    await db.categories.clear();
    await db.balanceSnapshots.clear();
  });

  it('uses debtType field for ccPayments and loanPayments (phase-18 regression)', async () => {
    await db.debts.bulkAdd([
      { debtType: 'credit-card', currentBalance: 100000, apr: 20, creditLimit: 200000 },
      { debtType: 'loan', fixedMonthlyPayment: 20000 },
      { debtType: 'mortgage', fixedMonthlyPayment: 138900 },
    ]);

    const data = await getDashboardData('month');
    expect(data.ccPayments).toBeGreaterThan(0);
    expect(data.loanPayments).toBe(20000 + 138900);
  });
});
