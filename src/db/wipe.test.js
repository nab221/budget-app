import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema.js';
import { debtsRepo, incomeSourcesRepo } from './repositories.js';
import { settings } from './settings.js';
import { seedDefaultCategories, DEFAULT_CATEGORIES } from './seed.js';
import { wipeAllData } from './wipe.js';

beforeEach(resetDb);

describe('wipeAllData', () => {
  it('clears all data, resets settings, and re-seeds categories', async () => {
    await seedDefaultCategories();
    await debtsRepo.add({ name: 'Visa', debtType: 'credit-card', balancePence: 100 });
    await incomeSourcesRepo.add({ name: 'Salary', amountPence: 2000, payDateRule: 'last-day' });
    await settings.setSafetyBufferPounds(500);

    await wipeAllData();

    expect(await db.debts.count()).toBe(0);
    expect(await db.incomeSources.count()).toBe(0);
    // Settings table cleared → typed getter falls back to the documented default.
    expect(await settings.getSafetyBufferPence()).toBe(20000);
    // Categories restored to the default set.
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });
});
