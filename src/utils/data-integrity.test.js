import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing the module under test.
// We use vi.hoisted to create stable table mocks that survive vi.clearAllMocks().
const { mockTables, mockTransaction } = vi.hoisted(() => {
  const makeTableMock = () => ({
    toArray: vi.fn().mockResolvedValue([]),
    bulkGet: vi.fn().mockResolvedValue([]),
    bulkDelete: vi.fn().mockResolvedValue(undefined),
  });

  const tables = {
    statements: makeTableMock(),
    debts: makeTableMock(),
    childcareLedger: makeTableMock(),
    childcareAccounts: makeTableMock(),
    recurrentExpenses: makeTableMock(),
    categories: makeTableMock(),
    oneOffExpenses: makeTableMock(),
    income: makeTableMock(),
    categoryMappings: makeTableMock(),
  };

  const transaction = vi.fn().mockImplementation(async (_mode, _tables, fn) => fn());

  return { mockTables: tables, mockTransaction: transaction };
});

vi.mock('../db/schema.js', () => {
  return {
    db: {
      table: (name) => mockTables[name],
      transaction: mockTransaction,
    },
  };
});

import { validateDataIntegrity, cleanOrphanedRecords } from './data-integrity.js';
import { db } from '../db/schema.js';

/**
 * Reset all table mocks to empty defaults before each test so tests start clean.
 */
function resetAllTableMocks() {
  for (const table of Object.values(mockTables)) {
    table.toArray.mockReset();
    table.toArray.mockResolvedValue([]);
    table.bulkGet.mockReset();
    table.bulkGet.mockResolvedValue([]);
    table.bulkDelete.mockReset();
    table.bulkDelete.mockResolvedValue(undefined);
  }
  mockTransaction.mockReset();
  mockTransaction.mockImplementation(async (_mode, _tables, fn) => fn());
}

describe('validateDataIntegrity', () => {

  beforeEach(() => {
    resetAllTableMocks();
  });

  // ─── statements.debtId → debts.id ────────────────────────────────────────────

  it('reports no issues when all statements have a matching debt', async () => {
    mockTables.statements.toArray.mockResolvedValue([{ id: 1, debtId: 10 }]);
    mockTables.debts.bulkGet.mockResolvedValue([{ id: 10 }]); // parent found
    const result = await validateDataIntegrity();
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('reports an issue when a statement references a missing debt', async () => {
    mockTables.statements.toArray.mockResolvedValue([{ id: 1, debtId: 99 }]);
    mockTables.debts.bulkGet.mockResolvedValue([undefined]); // parent missing
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'statements' && i.field === 'debtId');
    expect(issue).toBeDefined();
    expect(issue.recordId).toBe(1);
    expect(issue.missingId).toBe(99);
    expect(issue.referencedStore).toBe('debts');
  });

  // ─── childcareLedger.accountId → childcareAccounts.id ────────────────────────

  it('reports no issues when all ledger entries have a matching account', async () => {
    mockTables.childcareLedger.toArray.mockResolvedValue([{ id: 2, accountId: 5 }]);
    mockTables.childcareAccounts.bulkGet.mockResolvedValue([{ id: 5 }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'childcareLedger')).toHaveLength(0);
  });

  it('reports an issue when a ledger entry references a missing account', async () => {
    mockTables.childcareLedger.toArray.mockResolvedValue([{ id: 2, accountId: 999 }]);
    mockTables.childcareAccounts.bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'childcareLedger');
    expect(issue).toBeDefined();
    expect(issue.missingId).toBe(999);
  });

  // ─── recurrentExpenses.linkedStatementId → statements.id (nullable) ──────────

  it('skips recurrentExpenses with null linkedStatementId (nullable FK)', async () => {
    mockTables.recurrentExpenses.toArray.mockResolvedValue([{ id: 3, linkedStatementId: null, categoryId: null }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'recurrentExpenses' && i.field === 'linkedStatementId')).toHaveLength(0);
  });

  it('reports an issue when recurrentExpenses.linkedStatementId is non-null and missing', async () => {
    mockTables.recurrentExpenses.toArray.mockResolvedValue([{ id: 3, linkedStatementId: 77, categoryId: null }]);
    mockTables.statements.bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'recurrentExpenses' && i.field === 'linkedStatementId');
    expect(issue).toBeDefined();
    expect(issue.missingId).toBe(77);
  });

  it('reports no issues when recurrentExpenses.linkedStatementId has a matching statement', async () => {
    mockTables.recurrentExpenses.toArray.mockResolvedValue([{ id: 3, linkedStatementId: 77, categoryId: null }]);
    mockTables.statements.bulkGet.mockResolvedValue([{ id: 77 }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'recurrentExpenses' && i.field === 'linkedStatementId')).toHaveLength(0);
  });

  // ─── recurrentExpenses.categoryId → categories.id (nullable) ─────────────────

  it('reports an issue when recurrentExpenses.categoryId references a missing category', async () => {
    mockTables.recurrentExpenses.toArray.mockResolvedValue([{ id: 4, linkedStatementId: null, categoryId: 50 }]);
    mockTables.categories.bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'recurrentExpenses' && i.field === 'categoryId');
    expect(issue).toBeDefined();
    expect(issue.missingId).toBe(50);
  });

  it('reports no issues when recurrentExpenses.categoryId has a matching category', async () => {
    mockTables.recurrentExpenses.toArray.mockResolvedValue([{ id: 4, linkedStatementId: null, categoryId: 50 }]);
    mockTables.categories.bulkGet.mockResolvedValue([{ id: 50 }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'recurrentExpenses' && i.field === 'categoryId')).toHaveLength(0);
  });

  // ─── oneOffExpenses.categoryId → categories.id (nullable) ────────────────────

  it('reports no issues when oneOffExpenses.categoryId is null', async () => {
    mockTables.oneOffExpenses.toArray.mockResolvedValue([{ id: 5, categoryId: null }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'oneOffExpenses')).toHaveLength(0);
  });

  it('reports an issue when oneOffExpenses.categoryId references a missing category', async () => {
    mockTables.oneOffExpenses.toArray.mockResolvedValue([{ id: 5, categoryId: 88 }]);
    mockTables.categories.bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'oneOffExpenses' && i.field === 'categoryId');
    expect(issue).toBeDefined();
  });

  it('reports no issues when oneOffExpenses.categoryId has a matching category', async () => {
    mockTables.oneOffExpenses.toArray.mockResolvedValue([{ id: 5, categoryId: 88 }]);
    mockTables.categories.bulkGet.mockResolvedValue([{ id: 88 }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'oneOffExpenses' && i.field === 'categoryId')).toHaveLength(0);
  });

  // ─── income.categoryId → categories.id (nullable) ────────────────────────────

  it('reports an issue when income.categoryId references a missing category', async () => {
    mockTables.income.toArray.mockResolvedValue([{ id: 6, categoryId: 42 }]);
    mockTables.categories.bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'income' && i.field === 'categoryId');
    expect(issue).toBeDefined();
    expect(issue.recordId).toBe(6);
  });

  it('reports no issues when income.categoryId has a matching category', async () => {
    mockTables.income.toArray.mockResolvedValue([{ id: 6, categoryId: 42 }]);
    mockTables.categories.bulkGet.mockResolvedValue([{ id: 42 }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'income' && i.field === 'categoryId')).toHaveLength(0);
  });

  // ─── categoryMappings.categoryId → categories.id (non-nullable) ──────────────

  it('reports an issue when categoryMappings.categoryId references a missing category', async () => {
    mockTables.categoryMappings.toArray.mockResolvedValue([{ id: 7, categoryId: 33 }]);
    mockTables.categories.bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'categoryMappings' && i.field === 'categoryId');
    expect(issue).toBeDefined();
    expect(issue.missingId).toBe(33);
    expect(issue.referencedStore).toBe('categories');
  });

  it('reports no issues when categoryMappings.categoryId has a matching category', async () => {
    mockTables.categoryMappings.toArray.mockResolvedValue([{ id: 7, categoryId: 33 }]);
    mockTables.categories.bulkGet.mockResolvedValue([{ id: 33 }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'categoryMappings' && i.field === 'categoryId')).toHaveLength(0);
  });

  it('returns valid:true when all tables are empty', async () => {
    // Default mock returns empty arrays — all checks pass
    const result = await validateDataIntegrity();
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

});

describe('cleanOrphanedRecords', () => {

  beforeEach(() => {
    resetAllTableMocks();
  });

  it('calls bulkDelete with deduplicated IDs grouped by store', async () => {
    const issues = [
      { store: 'statements',     recordId: 1, field: 'debtId',      referencedStore: 'debts',       missingId: 99 },
      { store: 'statements',     recordId: 2, field: 'debtId',      referencedStore: 'debts',       missingId: 98 },
      { store: 'oneOffExpenses', recordId: 5, field: 'categoryId',  referencedStore: 'categories',  missingId: 77 },
      { store: 'income',         recordId: 6, field: 'categoryId',  referencedStore: 'categories',  missingId: 42 },
      { store: 'income',         recordId: 6, field: 'categoryId',  referencedStore: 'categories',  missingId: 42 },
    ];

    await cleanOrphanedRecords(issues);

    expect(mockTables.statements.bulkDelete).toHaveBeenCalledWith([1, 2]);
    expect(mockTables.oneOffExpenses.bulkDelete).toHaveBeenCalledWith([5]);
    expect(mockTables.income.bulkDelete).toHaveBeenCalledWith([6]);
  });

  it('does nothing when issues array is empty', async () => {
    await cleanOrphanedRecords([]);
    // No transaction should have been made
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('does nothing when issues is null', async () => {
    await cleanOrphanedRecords(null);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

});
