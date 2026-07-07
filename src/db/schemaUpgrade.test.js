/**
 * Verifies the additive v1 → v2 upgrade (adds the `debtId` index to
 * transactions) preserves live data. Simulates a pre-existing v1 database with
 * a throwaway Dexie connection, then opens the real v2 schema against the same
 * database name and confirms the old rows survive and the new index works.
 */
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema.js';

const DB_NAME = 'BudgetAppV4';

const V1_STORES = {
  settings: '&key',
  categories: '++id, name, kind',
  incomeSources: '++id, payDateRule',
  recurringBills: '++id, categoryId, nextDueDate',
  transactions: '++id, date, kind, categoryId, source, importHash',
  debts: '++id, debtType',
  children: '++id',
  categoryMappings: '++id, descriptionKey',
};

beforeEach(async () => {
  if (db.isOpen()) db.close();
  await Dexie.delete(DB_NAME);
});

describe('schema v1 → v2 upgrade', () => {
  it('preserves existing rows and enables the new debtId index', async () => {
    // 1. Create and populate a v1 database.
    const v1 = new Dexie(DB_NAME);
    v1.version(1).stores(V1_STORES);
    await v1.open();
    expect(v1.verno).toBe(1);

    const txId = await v1.transactions.add({
      date: '2026-05-01',
      kind: 'spend',
      amountPence: 1234,
      categoryId: 1,
      description: 'Old row',
      source: 'manual',
    });
    const catId = await v1.categories.add({ name: 'Groceries', kind: 'spending' });
    v1.close();

    // 2. Open the real v2 schema against the same database → in-place upgrade.
    await db.open();
    expect(db.verno).toBe(2);

    const tx = await db.transactions.get(txId);
    expect(tx).toBeTruthy();
    expect(tx.description).toBe('Old row');
    expect(tx.amountPence).toBe(1234);

    const cat = await db.categories.get(catId);
    expect(cat.name).toBe('Groceries');

    // 3. The new debtId index is usable; the migrated row (no debtId) is excluded.
    const debtPayments = await db.transactions.where('debtId').above(0).toArray();
    expect(debtPayments).toEqual([]);
  });
});
