/**
 * Database bootstrap: open the connection and run first-run seeding.
 * Called once from `main.jsx` on startup.
 */

import { db } from './schema.js';
import { seedDefaultCategories } from './seed.js';

let initPromise = null;

/**
 * Idempotent startup. Opens BudgetAppV4 and seeds defaults on first run.
 * Returns a shared promise so concurrent callers await the same work.
 */
export function initDb() {
  if (!initPromise) {
    initPromise = (async () => {
      if (!db.isOpen()) await db.open();
      await seedDefaultCategories();
      return db;
    })().catch((err) => {
      // Reset so a later retry can re-attempt after a transient failure.
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export default initDb;
