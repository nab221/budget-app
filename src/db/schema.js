import Dexie from 'dexie';

/**
 * BudgetAppV4 — Dexie (IndexedDB) database, schema version 1.
 *
 * Designed fresh per REFACTOR-SPEC §5. The old `BudgetConsoleDB` (23 migrations)
 * is left untouched.
 *
 * All money fields are integer **pence** at rest. All dates are ISO
 * `yyyy-MM-dd` strings. Pounds only ever exist at the API boundary (see
 * `repositories.js`).
 *
 * Store index strings follow spec §5 (`*` marks an indexed field). The primary
 * key of every table except `settings` is an auto-incrementing `id`; `settings`
 * is a `key`-keyed value store.
 *
 * ── Version history ────────────────────────────────────────────────────────
 * v1 — the fresh spec §5 schema.
 * v2 — additive only (owner testing feedback, 2026-07-07): a nullable `debtId`
 *      field on `transactions`, indexed so debt-payment confirmations can be
 *      looked up per pay period (derived debt-payment rows in Recurring Bills).
 *      No stores added/removed and no data reshaped, so Dexie upgrades live v1
 *      databases in place — existing rows (which simply have no `debtId`) are
 *      preserved untouched.
 * v3 — additive only (Income phase, spec amendment 2026-07-07 (b)): two new
 *      stores, `people` and `incomeEvents`, for the two-person tax-year
 *      tracker. Existing stores untouched, so live v1/v2 databases upgrade in
 *      place with no upgrade function.
 * v4 — additive only (dashboard plan §7, owner-approved 2026-07-08): a
 *      `balanceUpdates` store logging each debt balance update (manual, edit,
 *      or statement PDF) so the payoff chart can show actual-vs-plan. This is
 *      USER-ENTERED data — the record of balances the owner typed in — not a
 *      computed/projection row, so the "never persist computed rows" rule is
 *      untouched. New store only — no upgrade function.
 */

export const SCHEMA_VERSION = 4;

export const db = new Dexie('BudgetAppV4');

// v1 — original spec §5 schema. Declared so existing v1 databases have a defined
// prior version to upgrade FROM (Dexie requires the full version chain).
db.version(1).stores({
  settings: '&key',
  categories: '++id, name, kind',
  incomeSources: '++id, payDateRule',
  recurringBills: '++id, categoryId, nextDueDate',
  transactions: '++id, date, kind, categoryId, source, importHash',
  debts: '++id, debtType',
  children: '++id',
  categoryMappings: '++id, descriptionKey',
});

// v2 — additive: index `debtId` on transactions. Only the changed store needs
// restating; Dexie carries the rest forward. Purely additive index changes need
// no upgrade function — Dexie re-indexes existing rows automatically.
db.version(2).stores({
  transactions: '++id, date, kind, categoryId, source, importHash, debtId',
});

// v3 — additive: the Income phase's `people` + `incomeEvents` stores
// (spec amendment 2026-07-07 (b)). New stores only — no upgrade function.
db.version(3).stores({
  people: '++id',
  incomeEvents: '++id, personId, date, kind',
});

// v4 — additive: the `balanceUpdates` log (dashboard plan §7). New store only.
db.version(4).stores({
  balanceUpdates: '++id, debtId, date',
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
  'people',
  'incomeEvents',
  'balanceUpdates',
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
