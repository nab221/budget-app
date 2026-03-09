/**
 * Database backup utility
 *
 * Provides a single, shared implementation of the database restoration
 * transaction used by both local (src/ui/backup.js) and cloud
 * (src/ui/cloud-backup.js) restore flows.
 *
 * Centralising this logic here eliminates the parallel implementations that
 * existed in the two UI modules and ensures both flows behave identically.
 */

import { db } from './schema.js';

/**
 * Imports backup data into IndexedDB within a single read-write transaction.
 *
 * For each table present in the backup, the existing rows are cleared and the
 * backed-up rows are bulk-inserted. Tables absent from the backup are left
 * untouched (forward-compatible with schema additions).
 *
 * @param {{ [tableName: string]: object[] }} data - The `.data` property from a
 *   parsed backup object (already decrypted if the backup was encrypted).
 * @returns {Promise<void>} Resolves when all tables have been restored.
 * @throws {Error} 'Invalid backup data' if `data` is missing or not an object.
 * @throws {Error} Re-throws any Dexie transaction error.
 */
export async function importBackupData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup data');
  }

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      if (data[table.name]) {
        await table.clear();
        await table.bulkAdd(data[table.name]);
      }
    }

    // Backups can reintroduce legacy category groups even on newer schema versions.
    await db.categories.toCollection().modify(category => {
      if (category.group === 'fixed' || category.group === 'variable') {
        category.group = 'expenses';
      }
    });

    const incomeCount = await db.categories.where('group').equals('income').count();
    if (incomeCount === 0) {
      await db.categories.add({ name: 'Salary', group: 'income' });
    }
  });
}
