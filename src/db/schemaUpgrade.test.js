/**
 * Verifies the additive upgrades preserve live data: v1 → v2 (adds the
 * `debtId` index to transactions), v2 → v3 (adds the `people` +
 * `incomeEvents` stores), v3 → v4 (adds the `balanceUpdates` store),
 * v4 → v5 (salary periods + payslips, with a migration) and v5 → v6 (adds
 * the `mileageTrips` store). Simulates pre-existing databases with throwaway
 * Dexie connections, then opens the real schema against the same database
 * name and confirms old rows survive and the new stores/indexes work.
 *
 * Every "after the upgrade" assertion reads SCHEMA_VERSION rather than a
 * literal, so the next additive bump does not have to touch these tests.
 */
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, SCHEMA_VERSION } from './schema.js';

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
    expect(db.verno).toBe(SCHEMA_VERSION);

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

    // 2. Open the real schema → in-place upgrade.
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
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

  it('v3 → v4: preserves rows and adds a usable balanceUpdates store', async () => {
    // 1. Create and populate a v3 database (v1 chain + v2 index + v3 stores).
    const v3 = new Dexie(DB_NAME);
    v3.version(1).stores(V1_STORES);
    v3.version(2).stores({
      transactions: '++id, date, kind, categoryId, source, importHash, debtId',
    });
    v3.version(3).stores({
      people: '++id',
      incomeEvents: '++id, personId, date, kind',
    });
    await v3.open();
    expect(v3.verno).toBe(3);
    const debtId = await v3.debts.add({ name: 'Card', debtType: 'credit-card', balancePence: 50000 });
    const personId = await v3.people.add({ name: 'A', annualSalaryPence: 6000000 });
    v3.close();

    // 2. Open the real v4 schema → in-place upgrade.
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.debts.get(debtId)).name).toBe('Card');
    expect((await db.people.get(personId)).name).toBe('A');

    // 3. The new store exists, is empty, and its debtId/date indexes work.
    expect(await db.balanceUpdates.count()).toBe(0);
    await db.balanceUpdates.add({ debtId, date: '2026-07-08', balancePence: 48000, source: 'update' });
    const rows = await db.balanceUpdates.where('debtId').equals(debtId).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].balancePence).toBe(48000);
  });

  it('v4 → v5: migrates each person’s annual salary into an initial salary period', async () => {
    // 1. Create and populate a v4 database (full prior chain).
    const v4 = new Dexie(DB_NAME);
    v4.version(1).stores(V1_STORES);
    v4.version(2).stores({
      transactions: '++id, date, kind, categoryId, source, importHash, debtId',
    });
    v4.version(3).stores({
      people: '++id',
      incomeEvents: '++id, personId, date, kind',
    });
    v4.version(4).stores({
      balanceUpdates: '++id, debtId, date',
    });
    await v4.open();
    expect(v4.verno).toBe(4);
    const earner = await v4.people.add({
      name: 'A',
      annualSalaryPence: 6000000,
      salarySacrificePence: 120000,
    });
    const noSalary = await v4.people.add({ name: 'B', annualSalaryPence: 0 });
    v4.close();

    // 2. Open the real v5 schema → in-place upgrade runs the migration.
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);

    // 3. The earner got an always-in-force period carrying salary + sacrifice;
    //    the zero-salary person got nothing.
    const periods = await db.salaryPeriods.where('personId').equals(earner).toArray();
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      effectiveFrom: '1900-01-01',
      annualSalaryPence: 6000000,
      salarySacrificePence: 120000,
      workplacePensionAnnualPence: 0,
    });
    expect(await db.salaryPeriods.where('personId').equals(noSalary).count()).toBe(0);

    // 4. The payslips store exists and enforces one payslip per person-month.
    await db.payslips.add({ personId: earner, month: '2026-04', grossPence: 500000 });
    await expect(
      db.payslips.add({ personId: earner, month: '2026-04', grossPence: 1 })
    ).rejects.toThrow();
    expect(await db.payslips.where('personId').equals(earner).count()).toBe(1);
  });

  it('v5 → v6: preserves rows and adds a usable mileageTrips store', async () => {
    // 1. Create and populate a v5 database (full prior chain).
    const v5 = new Dexie(DB_NAME);
    v5.version(1).stores(V1_STORES);
    v5.version(2).stores({
      transactions: '++id, date, kind, categoryId, source, importHash, debtId',
    });
    v5.version(3).stores({
      people: '++id',
      incomeEvents: '++id, personId, date, kind',
    });
    v5.version(4).stores({
      balanceUpdates: '++id, debtId, date',
    });
    v5.version(5).stores({
      salaryPeriods: '++id, personId, effectiveFrom',
      payslips: '++id, personId, month, &[personId+month]',
    });
    await v5.open();
    expect(v5.verno).toBe(5);
    const debtId = await v5.debts.add({ name: 'Card', debtType: 'credit-card', balancePence: 50000 });
    const personId = await v5.people.add({ name: 'A', annualSalaryPence: 6000000 });
    await v5.payslips.add({ personId, month: '2026-04', grossPence: 500000 });
    v5.close();

    // 2. Open the real v6 schema → in-place upgrade, no upgrade function.
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect((await db.debts.get(debtId)).name).toBe('Card');
    expect((await db.people.get(personId)).name).toBe('A');
    expect(await db.payslips.where('personId').equals(personId).count()).toBe(1);

    // 3. The new store exists, is empty, and its date/vehicle indexes work.
    expect(await db.mileageTrips.count()).toBe(0);
    await db.mileageTrips.add({
      date: '2026-05-01',
      vehicle: 'car',
      miles: 42.5,
      purpose: 'Client visit',
      reimbursedPence: 0,
    });
    const inYear = await db.mileageTrips
      .where('date')
      .between('2026-04-06', '2027-04-05', true, true)
      .toArray();
    expect(inYear).toHaveLength(1);
    expect(inYear[0].miles).toBe(42.5);
  });

  it('v6 → v7: keeps existing trips claimable as one unnamed employment', async () => {
    // 1. Create and populate a v6 database (full prior chain).
    const v6 = new Dexie(DB_NAME);
    v6.version(1).stores(V1_STORES);
    v6.version(2).stores({
      transactions: '++id, date, kind, categoryId, source, importHash, debtId',
    });
    v6.version(3).stores({
      people: '++id',
      incomeEvents: '++id, personId, date, kind',
    });
    v6.version(4).stores({ balanceUpdates: '++id, debtId, date' });
    v6.version(5).stores({
      salaryPeriods: '++id, personId, effectiveFrom',
      payslips: '++id, personId, month, &[personId+month]',
    });
    v6.version(6).stores({ mileageTrips: '++id, date, vehicle' });
    await v6.open();
    expect(v6.verno).toBe(6);
    const tripId = await v6.mileageTrips.add({
      date: '2026-05-01',
      vehicle: 'car',
      miles: 120,
      purpose: 'Client visit',
      reimbursedPence: 0,
    });
    v6.close();

    // 2. Open the real v7 schema → in-place upgrade, no upgrade function.
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);

    // 3. The pre-v7 trip survives with no employerId — which the engine reads
    //    as one unnamed employment, exactly how it behaved before.
    const trip = await db.mileageTrips.get(tripId);
    expect(trip.miles).toBe(120);
    expect(trip.employerId).toBeUndefined();

    // 4. The new store works, and the employerId index queries cleanly.
    expect(await db.employers.count()).toBe(0);
    const employerId = await db.employers.add({ name: 'Acme', ratePencePerMile: 25 });
    await db.mileageTrips.update(tripId, { employerId });
    const forEmployer = await db.mileageTrips.where('employerId').equals(employerId).toArray();
    expect(forEmployer).toHaveLength(1);
    expect(forEmployer[0].id).toBe(tripId);
  });
});
