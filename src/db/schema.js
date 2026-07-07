import Dexie from 'dexie';

/**
 * BudgetAppV4 — Dexie (IndexedDB) database, schema version 1.
 *
 * Designed fresh per REFACTOR-SPEC §5. The old `BudgetConsoleDB` (23 migrations)
 * is left untouched; this is a clean, single-version schema with no migration
 * path and no derived/computed rows persisted.
 *
 * All money fields are integer **pence** at rest. All dates are ISO
 * `yyyy-MM-dd` strings. Pounds only ever exist at the API boundary (see
 * `repositories.js`).
 *
 * Store index strings follow spec §5 (`*` marks an indexed field). The primary
 * key of every table except `settings` is an auto-incrementing `id`; `settings`
 * is a `key`-keyed value store.
 */

export const SCHEMA_VERSION = 1;

export const db = new Dexie('BudgetAppV4');

db.version(SCHEMA_VERSION).stores({
  // key/value settings store — `key` is the (unique) primary key.
  settings: '&key',
  categories: '++id, name, kind',
  incomeSources: '++id, payDateRule',
  recurringBills: '++id, categoryId, nextDueDate',
  transactions: '++id, date, kind, categoryId, source, importHash',
  debts: '++id, debtType',
  children: '++id',
  categoryMappings: '++id, descriptionKey',
});

// The ordered list of table names — the single source of truth for backup /
// wipe operations so a new table never gets silently missed.
export const TABLE_NAMES = [
  'settings',
  'categories',
  'incomeSources',
  'recurringBills',
  'transactions',
  'debts',
  'children',
  'categoryMappings',
];

// Another tab upgraded the schema: close this connection and reload so the
// page picks up the new version (mirrors the old app's behaviour).
db.on('versionchange', () => {
  db.close();
  if (typeof window !== 'undefined' && window.location) {
    window.location.reload();
  }
});

// This connection is holding an upgrade back (another tab still open).
db.on('blocked', () => {
  // No `alert()` / DOM — just warn. The user closing the other tab unblocks it.
  console.warn(
    '[BudgetAppV4] A database upgrade is blocked. Close other tabs of this app to continue.'
  );
});

export default db;
