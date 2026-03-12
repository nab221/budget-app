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
import { findBestMatch } from '../utils/string-similarity.js';

/**
 * Similarity threshold for category name deduplication (0-1).
 * Matches above this threshold will be considered the same category.
 */
const CATEGORY_MATCH_THRESHOLD = 0.9;

/**
 * Tables that contain a `categoryId` field and need remapping during merge imports.
 */
const TABLES_WITH_CATEGORY_ID = ['income', 'recurrentExpenses', 'oneOffExpenses', 'expectedIncome', 'recurringTemplates'];

/**
 * Imports backup data into IndexedDB with validation and flexible merge/overwrite modes.
 *
 * **Validation**:
 * - Checks `data.schema_version` (reject if newer than current db version).
 * - Checks for at least one table presence.
 *
 * **Overwrite mode**: Clears all tables (or only those present in backup) before importing.
 *
 * **Merge mode**: Imports data while preserving local records:
 * - Category deduplication: Incoming categories are matched by name to local ones.
 *   If a match is found, the incoming ID is mapped to the local ID in all linked records.
 * - Other tables use bulkPut (file data wins on ID collision).
 *
 * **Settings**: If `restoreSettings: true`, localStorage is also restored.
 *
 * @param {{ [tableName: string]: object[] }} data - The `.data` property from a
 *   parsed backup object (already decrypted if encrypted).
 * @param {{ mode: 'overwrite' | 'merge', restoreSettings: boolean }} options
 *   - `mode`: 'overwrite' (clear then import) or 'merge' (preserve local data, deduplicate categories)
 *   - `restoreSettings`: If true, restore localStorage settings from the backup envelope.
 * @returns {Promise<void>} Resolves when all tables have been restored.
 * @throws {Error} 'Invalid backup data' if `data` is missing or not an object.
 * @throws {Error} 'Schema version mismatch' if backup is from a newer app version.
 * @throws {Error} 'No data tables found in backup' if no tables are present.
 * @throws {Error} Re-throws any Dexie transaction error.
 */
export async function importBackupData(data, options = {}) {
  const { mode = 'overwrite', restoreSettings = true } = options;

  // 1. Validate input
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup data');
  }

  // 2. Schema version guard
  const backupSchemaVersion = data.schema_version || 1; // Default to v1 for older backups
  if (backupSchemaVersion > db.verno) {
    throw new Error(
      `Schema version mismatch: backup is from a newer version (v${backupSchemaVersion}) than current app (v${db.verno}). ` +
      'Please update the app to import this backup.'
    );
  }

  // 3. Check for backup format version (basic validation)
  if (data.version === undefined) {
    // Assume v1 for old backups that don't have a version field
    data.version = 1;
  }

  // 4. Ensure at least one table is present in the backup
  const hasAnyTable = db.tables.some(table => data[table.name]);
  if (!hasAnyTable) {
    throw new Error('No data tables found in backup');
  }

  // 5. Perform import transaction
  await db.transaction('rw', db.tables, async () => {
    // Build category ID mapping for merge mode (matched by name or fuzzy match)
    let categoryIdMap = {}; // incoming ID -> local ID
    if (mode === 'merge' && data.categories) {
      const localCategories = await db.categories.toArray();

      for (const incomingCategory of data.categories) {
        if (!incomingCategory.name) continue;
        const incomingNameLower = incomingCategory.name.toLowerCase();
        const incomingGroup = incomingCategory.group ?? incomingCategory.type ?? null;

        const filteredLocalCategories = incomingGroup
          ? localCategories.filter(localCategory => (localCategory.group ?? localCategory.type) === incomingGroup)
          : localCategories;

        const filteredLocalNames = filteredLocalCategories.map(localCategory => localCategory.name);
        const filteredLocalNameMap = new Map(
          filteredLocalCategories.map(localCategory => [localCategory.name.toLowerCase(), localCategory.id])
        );

        // 1. Case-insensitive exact match
        if (filteredLocalNameMap.has(incomingNameLower)) {
          categoryIdMap[incomingCategory.id] = filteredLocalNameMap.get(incomingNameLower);
          continue;
        }

        // 2. Fuzzy match for minor typos/pluralization
        const { target, rating } = findBestMatch(incomingCategory.name, filteredLocalNames);
        if (target && rating >= CATEGORY_MATCH_THRESHOLD) {
          categoryIdMap[incomingCategory.id] = filteredLocalNameMap.get(target.toLowerCase());
        }
      }
    }

    // Import each table
    for (const table of db.tables) {
      if (!data[table.name]) continue;

      // Clear table in overwrite mode
      if (mode === 'overwrite') {
        await table.clear();
      }

      // For merge mode with categories, skip direct import (we handle manually below)
      if (mode === 'merge' && table.name === 'categories') {
        // Only add categories that don't already exist (by name or fuzzy match in map)
        for (const incomingCategory of data.categories) {
          if (!categoryIdMap[incomingCategory.id]) {
            try {
              // Omit the backup id so Dexie generates a new local auto-increment id,
              // then record the mapping so downstream records get the correct local id.
              const { id: _omitId, ...newCategoryData } = incomingCategory;
              const newId = await db.categories.add(newCategoryData);
              categoryIdMap[incomingCategory.id] = newId;
            } catch (e) {
              if (e.failures) {
                console.warn(`[importBackupData] categories: ${e.failures.length} record(s) skipped (likely duplicate)`, e.failures);
              } else {
                throw e;
              }
            }
          }
        }
        continue;
      }

      // For categoryMappings in merge mode, also skip (handle manually below)
      if (mode === 'merge' && table.name === 'categoryMappings') {
        // Import categoryMappings, remapping categoryIds to local ones
        const mappingsWithRemappedIds = (data.categoryMappings || []).map(mapping => ({
          ...mapping,
          categoryId: categoryIdMap[mapping.categoryId] ?? mapping.categoryId
        }));
        for (const mapping of mappingsWithRemappedIds) {
          try {
            await db.categoryMappings.put(mapping);
          } catch (e) {
            if (e.failures) {
              console.warn(`[importBackupData] categoryMappings: record skipped`, e);
            } else {
              throw e;
            }
          }
        }
        continue;
      }

      // Standard bulkPut for all other tables
      try {
        // In merge mode, remap categoryId references if applicable
        let recordsToImport = data[table.name];
        if (mode === 'merge' && Object.keys(categoryIdMap).length > 0 && table.name !== 'categories' && table.name !== 'categoryMappings') {
          // Tables with categoryId field: remap to local IDs
          if (TABLES_WITH_CATEGORY_ID.includes(table.name)) {
            recordsToImport = recordsToImport.map(record => ({
              ...record,
              categoryId: categoryIdMap[record.categoryId] ?? record.categoryId
            }));
          }
        }

        await table.bulkPut(recordsToImport);
      } catch (e) {
        if (e.failures) {
          console.error(`[importBackupData] ${table.name}: ${e.failures.length} record(s) failed to import`, e.failures);
        } else {
          throw e;
        }
      }
    }

    // Post-import cleanup: normalize category groups and ensure required categories exist
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

  // Restore localStorage settings if requested and available in backup
  if (restoreSettings && data.settings && typeof data.settings === 'object') {
    for (const [key, value] of Object.entries(data.settings)) {
      localStorage.setItem(key, value);
    }
  }
}
