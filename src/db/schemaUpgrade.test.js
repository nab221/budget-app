/**
 * Verifies the additive upgrades preserve live data: v1 → v2 (adds the
 * `debtId` index to transactions) and v2 → v3 (adds the `people` +
 * `incomeEvents` stores). Simulates pre-existing databases with throwaway
 * Dexie connections, then opens the real schema against the same database
 * name and confirms old rows survive and the new stores/indexes work.
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

describe('schema upgrades', () => {
  it('v1 → current: preserves existing rows and enables the new debtId index', async () => {
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

    // 2. Open the real schema against the same database → in-place upgrade.
    await db.open();
    expect(db.verno).toBe(3);

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

  it('v2 → v3: preserves rows and adds usable people/incomeEvents stores', async () => {
    // 1. Create and populate a v2 database (v1 chain + the v2 index change).
    const v2 = new Dexie(DB_NAME);
    v2.version(1).stores(V1_STORES);
    v2.version(2).stores({
      transactions: '++id, date, kind, categoryId, source, importHash, debtId',
    });
    await v2.open();
    expect(v2.verno).toBe(2);
    const debtId = await v2.debts.add({ name: 'Card', debtType: 'credit-card', balancePence: 50000 });
    v2.close();

    // 2. Open the real v3 schema → in-place upgrade.
    await db.open();
    expect(db.verno).toBe(3);
    const debt = await db.debts.get(debtId);
    expect(debt.name).toBe('Card');

    // 3. New stores exist, are empty, and the personId/date indexes work.
    expect(await db.people.count()).toBe(0);
    const personId = await db.people.add({ name: 'A', annualSalaryPence: 6000000 });
    await db.incomeEvents.add({
      personId,
      date: '2026-07-01',
      kind: 'dividend',
      amountPence: 100000,
    });
    const events = await db.incomeEvents.where('personId').equals(personId).toArray();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('dividend');
  });
});
