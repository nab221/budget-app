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
    update: async (id, changes) => {
      const idx = rows.findIndex(r => r.id === id);
      if (idx !== -1) rows[idx] = { ...rows[idx], ...changes };
      return 1;
    },
    delete: async (id) => {
      rows = rows.filter(r => r.id !== id);
    },
    bulkDelete: async (ids) => {
      rows = rows.filter(r => !ids.includes(r.id));
    },
    where,
    count: async () => rows.length
  };
}

// Mock the schema module before importing the repository
vi.mock('./schema.js', () => {
  const balanceSnapshots = createMockTable();
  const categories = createMockTable();
  const income = createMockTable();
  const recurrentExpenses = createMockTable();
  const oneOffExpenses = createMockTable();
  const childcareAccounts = createMockTable();
  const childcareLedger = createMockTable();
  const debts = createMockTable();
  const assets = createMockTable();

  return {
    db: {
      balanceSnapshots,
      categories,
      income,
      recurrentExpenses,
      oneOffExpenses,
      childcareAccounts,
      childcareLedger,
      debts,
      assets,
      transaction: async (mode, tables, fn) => fn()
    }
  };
});

// After mock is declared, import the repository (Vitest hoists vi.mock calls)
const { balanceSnapshotRepository, categoryRepository } = await import('./repository.js');
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
// categoryRepository.ensureOpeningBalanceCategory tests
// ---------------------------------------------------------------------------

describe('categoryRepository.ensureOpeningBalanceCategory', () => {
  beforeEach(() => {
    clearTable(db.categories);
  });

  it('creates the Opening Balance category when it does not exist', async () => {
    const id = await categoryRepository.ensureOpeningBalanceCategory();
    expect(typeof id).toBe('number');

    const rows = await db.categories.toArray();
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Opening Balance');
    expect(rows[0].group).toBe('system');
  });

  it('returns the existing id without creating a duplicate', async () => {
    // Seed one manually
    const firstId = await db.categories.add({ name: 'Opening Balance', group: 'system' });

    const secondId = await categoryRepository.ensureOpeningBalanceCategory();
    expect(secondId).toBe(firstId);

    const rows = await db.categories.toArray();
    expect(rows.length).toBe(1); // no duplicate
  });

  it('is idempotent when called multiple times', async () => {
    const id1 = await categoryRepository.ensureOpeningBalanceCategory();
    const id2 = await categoryRepository.ensureOpeningBalanceCategory();
    const id3 = await categoryRepository.ensureOpeningBalanceCategory();

    expect(id1).toBe(id2);
    expect(id2).toBe(id3);

    const rows = await db.categories.toArray();
    expect(rows.length).toBe(1);
  });
});
