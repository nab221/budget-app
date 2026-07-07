import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema.js';
import { seedDefaultCategories } from './seed.js';

beforeEach(resetDb);

describe('seeding', () => {
  it('seeds 10 default categories (2 income, 8 spending)', async () => {
    const ran = await seedDefaultCategories();
    expect(ran).toBe(true);
    const all = await db.categories.toArray();
    expect(all).toHaveLength(10);
    expect(all.filter((c) => c.kind === 'income')).toHaveLength(2);
    expect(all.filter((c) => c.kind === 'spending')).toHaveLength(8);
  });

  it('is idempotent — running twice leaves exactly 10', async () => {
    expect(await seedDefaultCategories()).toBe(true);
    expect(await seedDefaultCategories()).toBe(false);
    expect(await db.categories.count()).toBe(10);
  });
});
