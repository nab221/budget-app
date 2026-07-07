/**
 * Danger-zone wipe (spec §4.7).
 *
 * Clears every table (including `settings`, which resets all preferences to
 * their documented defaults), then re-seeds the default categories so the app
 * returns to a clean first-run state. One `db:mutated` fires at the end.
 */

import { db, TABLE_NAMES } from './schema.js';
import { seedDefaultCategories } from './seed.js';
import { dispatchMutation } from './events.js';

export async function wipeAllData() {
  const tables = TABLE_NAMES.map((name) => db.table(name));
  await db.transaction('rw', tables, async () => {
    for (const name of TABLE_NAMES) {
      await db.table(name).clear();
    }
  });
  // Re-seed categories outside the wipe transaction (fresh count === 0 → seeds).
  await seedDefaultCategories();
  dispatchMutation();
}

export default wipeAllData;
