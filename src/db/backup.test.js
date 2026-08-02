import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, SCHEMA_VERSION } from './schema.js';
import { exportBackup, importBackup, APP_NAME } from './backup.js';
import { seedDefaultCategories } from './seed.js';
import { incomeSourcesRepo, debtsRepo, transactionsRepo } from './repositories.js';
import { settings } from './settings.js';

beforeEach(resetDb);

async function populate() {
  await seedDefaultCategories();
  await incomeSourcesRepo.add({ name: 'Salary', amountPence: 2500, payDateRule: 'last-working-day' });
  await debtsRepo.add({ name: 'Visa', debtType: 'credit-card', balancePence: 1200.5, creditLimitPence: 5000 });
  await transactionsRepo.add({ date: '2026-07-03', kind: 'spend', amountPence: 42.99, categoryId: 3 });
  await settings.setSafetyBufferPounds(250);
}

describe('export', () => {
  it('produces the spec §5 envelope with raw pence rows and records lastExportAt', async () => {
    await populate();
    const env = await exportBackup();
    expect(env.app).toBe(APP_NAME);
    expect(env.format).toBe(1);
    expect(env.schemaVersion).toBe(SCHEMA_VERSION);
    expect(typeof env.exportedAt).toBe('string');
    expect(env.data.categories).toHaveLength(10);
    // raw pence, not pounds
    expect(env.data.incomeSources[0].amountPence).toBe(250000);
    expect(env.data.debts[0].balancePence).toBe(120050);
    // lastExportAt updated
    expect(await settings.getLastExportAt()).toBe(env.exportedAt);
  });
});

describe('round-trip', () => {
  it('export → wipe → import preserves rows exactly', async () => {
    await populate();
    const env = await exportBackup();
    const snapshot = JSON.parse(JSON.stringify(env.data));

    // Wipe everything.
    for (const name of ['categories', 'incomeSources', 'debts', 'transactions', 'settings']) {
      await db.table(name).clear();
    }
    expect(await db.categories.count()).toBe(0);

    await importBackup(env);

    expect(await db.categories.toArray()).toEqual(snapshot.categories);
    expect(await db.incomeSources.toArray()).toEqual(snapshot.incomeSources);
    expect(await db.debts.toArray()).toEqual(snapshot.debts);
    expect(await db.transactions.toArray()).toEqual(snapshot.transactions);
  });

  it('dispatches db:mutated on import', async () => {
    await populate();
    const env = await exportBackup();
    let fired = 0;
    const handler = () => { fired += 1; };
    window.addEventListener('db:mutated', handler);
    await importBackup(env);
    window.removeEventListener('db:mutated', handler);
    expect(fired).toBeGreaterThanOrEqual(1);
  });
});

describe('refusal of newer backups', () => {
  it('refuses format newer than the app', async () => {
    await expect(
      importBackup({ app: APP_NAME, format: 2, schemaVersion: 1, data: {} })
    ).rejects.toThrow(/format 2 is newer/);
  });

  it('refuses schemaVersion newer than the app', async () => {
    await expect(
      importBackup({ app: APP_NAME, format: 1, schemaVersion: 99, data: {} })
    ).rejects.toThrow(/schemaVersion 99 is newer/);
  });

  it('refuses a non-budget-app envelope', async () => {
    await expect(
      importBackup({ app: 'something-else', format: 1, schemaVersion: 1, data: {} })
    ).rejects.toThrow(/not a budget-app backup/);
  });
});
