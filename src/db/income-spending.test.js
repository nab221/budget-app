/**
 * income-spending.test.js
 *
 * Phase 33: Tests for incomeSourceRepository and spendingBucketRepository.
 * Uses in-memory Dexie mock to avoid IndexedDB dependency in Vitest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Environment stubs (Node/Vitest compatibility)
// ---------------------------------------------------------------------------
globalThis.window = globalThis.window || {};
const dispatchEventMock = vi.fn();
globalThis.window.dispatchEvent = dispatchEventMock;

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail ?? null;
    }
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

// ---------------------------------------------------------------------------
// Lightweight in-memory table factory (mirrors repository.test.js pattern)
// ---------------------------------------------------------------------------
function createMockTable(initialRows = []) {
  let rows = [...initialRows];
  let nextId = rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1;

  const where = (field) => ({
    equals: (value) => ({
      first: async () => rows.find(r => r[field] === value),
      count: async () => rows.filter(r => r[field] === value).length,
      toArray: async () => rows.filter(r => r[field] === value),
      delete: async () => { rows = rows.filter(r => r[field] !== value); }
    }),
    startsWith: (value) => ({
      toArray: async () => rows.filter(r => r[field] && String(r[field]).startsWith(value)),
      filter: (fn) => ({
        toArray: async () => rows.filter(r => r[field] && String(r[field]).startsWith(value)).filter(fn)
      })
    }),
    between: (start, end, inclStart, inclEnd) => ({
      toArray: async () => rows.filter(r => {
        const v = r[field];
        const afterStart = inclStart ? v >= start : v > start;
        const beforeEnd = inclEnd ? v <= end : v < end;
        return afterStart && beforeEnd;
      })
    })
  });

  return {
    _rows: () => rows,
    _reset: (initial = []) => {
      rows = [...initial];
      nextId = rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1;
    },
    toArray: async () => [...rows],
    get: async (id) => rows.find(r => r.id === id),
    add: async (item) => { const id = nextId++; rows.push({ id, ...item }); return id; },
    bulkAdd: async (items) => { items.forEach(item => { const id = nextId++; rows.push({ id, ...item }); }); return items.length; },
    update: async (id, changes) => { const idx = rows.findIndex(r => r.id === id); if (idx !== -1) rows[idx] = { ...rows[idx], ...changes }; return 1; },
    delete: async (id) => { const idx = rows.findIndex(r => r.id === id); if (idx !== -1) rows.splice(idx, 1); },
    bulkDelete: async (ids) => { rows = rows.filter(r => !ids.includes(r.id)); },
    count: async () => rows.length,
    where,
    orderBy: (field) => ({
      toArray: async () => [...rows].sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0)),
      last: async () => {
        if (!rows.length) return undefined;
        return [...rows].sort((a, b) => (a[field] < b[field] ? -1 : 1))[rows.length - 1];
      }
    })
  };
}

// ---------------------------------------------------------------------------
// Mock Dexie schema module
// ---------------------------------------------------------------------------
const mockIncomeSources = createMockTable();
const mockSpendingBuckets = createMockTable();

vi.mock('./schema.js', () => ({
  db: {
    incomeSources: mockIncomeSources,
    spendingBuckets: mockSpendingBuckets,
    balanceSnapshots: createMockTable(),
    dailyBalanceSnapshots: createMockTable(),
    categories: createMockTable(),
    income: createMockTable(),
    recurrentExpenses: createMockTable(),
    oneOffExpenses: createMockTable(),
    childcareAccounts: createMockTable(),
    childcareLedger: createMockTable(),
    debts: createMockTable(),
    assets: createMockTable(),
    statements: createMockTable(),
    expectedIncome: createMockTable(),
    netWorthSnapshots: createMockTable(),
    bankHolidayOverrides: createMockTable(),
    transaction: async (...args) => {
      const fn = args[args.length - 1];
      if (typeof fn === 'function') return fn();
    },
    tables: []
  }
}));

const {
  incomeSourceRepository,
  spendingBucketRepository
} = await import('./repository.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetTables() {
  mockIncomeSources._reset();
  mockSpendingBuckets._reset();
}

// ---------------------------------------------------------------------------
// incomeSourceRepository
// ---------------------------------------------------------------------------
describe('incomeSourceRepository', () => {
  beforeEach(resetTables);

  describe('add', () => {
    it('adds an income source and returns a numeric id', async () => {
      const id = await incomeSourceRepository.add({
        name: 'Primary Salary',
        monthlyAmount: 350000,
        payDateRule: 'nth-of-month',
        payDateDay: 25,
        isActive: true,
        displayOrder: 0
      });
      expect(typeof id).toBe('number');
    });

    it('stores multiple sources without cap', async () => {
      for (let i = 1; i <= 4; i++) {
        await incomeSourceRepository.add({
          name: `Source ${i}`,
          monthlyAmount: i * 10000,
          payDateRule: 'nth-of-month',
          payDateDay: i,
          isActive: true,
          displayOrder: i - 1
        });
      }
      const all = await incomeSourceRepository.getAll();
      expect(all.length).toBe(4);
    });
  });

  describe('getAll', () => {
    it('returns empty array when no sources exist', async () => {
      const all = await incomeSourceRepository.getAll();
      expect(all).toEqual([]);
    });

    it('returns all stored sources', async () => {
      await incomeSourceRepository.add({ name: 'A', monthlyAmount: 100, payDateRule: 'last-day', payDateDay: null, isActive: true, displayOrder: 0 });
      await incomeSourceRepository.add({ name: 'B', monthlyAmount: 200, payDateRule: 'last-working-day', payDateDay: null, isActive: false, displayOrder: 1 });
      const all = await incomeSourceRepository.getAll();
      expect(all.length).toBe(2);
    });
  });

  describe('getActive', () => {
    it('returns only active sources', async () => {
      await incomeSourceRepository.add({ name: 'Active', monthlyAmount: 100, payDateRule: 'last-day', payDateDay: null, isActive: true, displayOrder: 0 });
      await incomeSourceRepository.add({ name: 'Inactive', monthlyAmount: 200, payDateRule: 'last-day', payDateDay: null, isActive: false, displayOrder: 1 });
      const active = await incomeSourceRepository.getActive();
      expect(active.length).toBe(1);
      expect(active[0].name).toBe('Active');
    });

    it('returns empty array when no active sources exist', async () => {
      const active = await incomeSourceRepository.getActive();
      expect(active).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates an income source by id', async () => {
      const id = await incomeSourceRepository.add({ name: 'Old', monthlyAmount: 100, payDateRule: 'last-day', payDateDay: null, isActive: true, displayOrder: 0 });
      await incomeSourceRepository.update(id, { name: 'New', monthlyAmount: 200 });
      const updated = await incomeSourceRepository.get(id);
      expect(updated.name).toBe('New');
      expect(updated.monthlyAmount).toBe(200);
    });
  });

  describe('delete', () => {
    it('removes an income source by id', async () => {
      const id = await incomeSourceRepository.add({ name: 'ToDelete', monthlyAmount: 100, payDateRule: 'last-day', payDateDay: null, isActive: true, displayOrder: 0 });
      await incomeSourceRepository.delete(id);
      const all = await incomeSourceRepository.getAll();
      expect(all.length).toBe(0);
    });
  });

  describe('validatePayDateDay', () => {
    it('throws when payDateRule is nth-of-month and payDateDay is missing', async () => {
      await expect(
        incomeSourceRepository.validateAndAdd({
          name: 'Salary',
          monthlyAmount: 100000,
          payDateRule: 'nth-of-month',
          payDateDay: null,
          isActive: true,
          displayOrder: 0
        })
      ).rejects.toThrow();
    });

    it('throws when payDateRule is nth-of-month and payDateDay is not an integer', async () => {
      await expect(
        incomeSourceRepository.validateAndAdd({
          name: 'Salary',
          monthlyAmount: 100000,
          payDateRule: 'nth-of-month',
          payDateDay: 'twenty',
          isActive: true,
          displayOrder: 0
        })
      ).rejects.toThrow();
    });

    it('throws when payDateRule is nth-of-month and payDateDay is out of range (0)', async () => {
      await expect(
        incomeSourceRepository.validateAndAdd({
          name: 'Salary',
          monthlyAmount: 100000,
          payDateRule: 'nth-of-month',
          payDateDay: 0,
          isActive: true,
          displayOrder: 0
        })
      ).rejects.toThrow();
    });

    it('throws when payDateRule is nth-of-month and payDateDay is out of range (29)', async () => {
      await expect(
        incomeSourceRepository.validateAndAdd({
          name: 'Salary',
          monthlyAmount: 100000,
          payDateRule: 'nth-of-month',
          payDateDay: 29,
          isActive: true,
          displayOrder: 0
        })
      ).rejects.toThrow();
    });

    it('does NOT throw for last-day rule even without payDateDay', async () => {
      await expect(
        incomeSourceRepository.validateAndAdd({
          name: 'Salary',
          monthlyAmount: 100000,
          payDateRule: 'last-day',
          payDateDay: null,
          isActive: true,
          displayOrder: 0
        })
      ).resolves.toBeDefined();
    });

    it('does NOT throw for last-working-day rule without payDateDay', async () => {
      await expect(
        incomeSourceRepository.validateAndAdd({
          name: 'Salary',
          monthlyAmount: 100000,
          payDateRule: 'last-working-day',
          payDateDay: null,
          isActive: true,
          displayOrder: 0
        })
      ).resolves.toBeDefined();
    });

    it('accepts nth-of-month with valid payDateDay=1', async () => {
      await expect(
        incomeSourceRepository.validateAndAdd({
          name: 'Salary',
          monthlyAmount: 100000,
          payDateRule: 'nth-of-month',
          payDateDay: 1,
          isActive: true,
          displayOrder: 0
        })
      ).resolves.toBeDefined();
    });

    it('accepts nth-of-month with valid payDateDay=28', async () => {
      await expect(
        incomeSourceRepository.validateAndAdd({
          name: 'Salary',
          monthlyAmount: 100000,
          payDateRule: 'nth-of-month',
          payDateDay: 28,
          isActive: true,
          displayOrder: 0
        })
      ).resolves.toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// spendingBucketRepository
// ---------------------------------------------------------------------------
describe('spendingBucketRepository', () => {
  beforeEach(resetTables);

  describe('seedDefaults', () => {
    it('seeds default buckets when store is empty', async () => {
      await spendingBucketRepository.seedDefaults();
      const all = await spendingBucketRepository.getAll();
      expect(all.length).toBeGreaterThan(0);
      const names = all.map(b => b.name);
      expect(names).toContain('Groceries');
      expect(names).toContain('Misc');
    });

    it('does NOT seed again when buckets already exist', async () => {
      await spendingBucketRepository.seedDefaults();
      const countAfterFirst = (await spendingBucketRepository.getAll()).length;
      await spendingBucketRepository.seedDefaults();
      const countAfterSecond = (await spendingBucketRepository.getAll()).length;
      expect(countAfterSecond).toBe(countAfterFirst);
    });
  });

  describe('add', () => {
    it('adds a spending bucket and returns a numeric id', async () => {
      const id = await spendingBucketRepository.add({
        name: 'Groceries',
        monthlyAmount: 30000,
        icon: null,
        displayOrder: 0
      });
      expect(typeof id).toBe('number');
    });
  });

  describe('getAll', () => {
    it('returns empty array when no buckets exist', async () => {
      const all = await spendingBucketRepository.getAll();
      expect(all).toEqual([]);
    });

    it('returns all stored buckets', async () => {
      await spendingBucketRepository.add({ name: 'Groceries', monthlyAmount: 30000, icon: null, displayOrder: 0 });
      await spendingBucketRepository.add({ name: 'Transport', monthlyAmount: 10000, icon: null, displayOrder: 1 });
      const all = await spendingBucketRepository.getAll();
      expect(all.length).toBe(2);
    });
  });

  describe('update', () => {
    it('updates a bucket by id', async () => {
      const id = await spendingBucketRepository.add({ name: 'Old', monthlyAmount: 10000, icon: null, displayOrder: 0 });
      await spendingBucketRepository.update(id, { name: 'New', monthlyAmount: 20000 });
      const updated = await spendingBucketRepository.get(id);
      expect(updated.name).toBe('New');
      expect(updated.monthlyAmount).toBe(20000);
    });
  });

  describe('delete', () => {
    it('removes a bucket by id', async () => {
      const id = await spendingBucketRepository.add({ name: 'ToDelete', monthlyAmount: 10000, icon: null, displayOrder: 0 });
      await spendingBucketRepository.delete(id);
      const all = await spendingBucketRepository.getAll();
      expect(all.length).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Anti-cap regression guard (runtime check on exported names)
// ---------------------------------------------------------------------------
describe('anti-cap regression guard', () => {
  it('exports incomeSourceRepository (not primaryIncome/secondaryIncome)', async () => {
    const repo = await import('./repository.js');
    expect(repo.incomeSourceRepository).toBeDefined();
    expect(repo.primaryIncomeRepository).toBeUndefined();
    expect(repo.secondaryIncomeRepository).toBeUndefined();
  });

  it('exports spendingBucketRepository', async () => {
    const repo = await import('./repository.js');
    expect(repo.spendingBucketRepository).toBeDefined();
  });
});
