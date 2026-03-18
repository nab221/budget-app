/**
 * Legacy v2 import pipeline
 *
 * Provides a safe, validated import path for budget files produced by the v2
 * application (schema versions ≤ 4), which used different table names
 * (fixedSpends, variableSpends, subscriptions) before the v5 consolidation.
 *
 * Exports:
 *   parseLegacyBackup   — convenience: detect + validate, return { valid, data, reasons }
 *   detectLegacyShape   — returns true when payload contains v2-only table keys
 *   validateLegacyData  — returns { valid, reasons } explaining all incompatibilities
 *   mapLegacyToCurrent  — transforms v2 data object into current-schema-compatible shape
 *   importLegacyData    — conflict-safe import with skip-by-default policy; returns summary
 *   runLegacyImport     — orchestration: validate → map → import into real DB via Dexie
 *
 * Conflict policy: default is 'skip' — existing records with matching id are never
 * overwritten unless `conflictPolicy: 'overwrite'` is explicitly passed to importLegacyData.
 */

// ---------------------------------------------------------------------------
// Shape detection
// ---------------------------------------------------------------------------

/**
 * Returns true if the payload looks like a v2 export (has at least one legacy
 * table key that was removed in schema v5).
 *
 * @param {*} payload - Parsed JSON object from a backup file.
 * @returns {boolean}
 */
export function detectLegacyShape(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const d = payload.data;
  if (!d || typeof d !== 'object') return false;

  const legacyKeys = ['fixedSpends', 'variableSpends', 'subscriptions'];
  return legacyKeys.some(key => Array.isArray(d[key]));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates that a payload is a recognisable legacy (v2) backup.
 * Returns { valid: boolean, reasons: string[] }.
 *
 * @param {*} payload
 * @returns {{ valid: boolean, reasons: string[] }}
 */
export function validateLegacyData(payload) {
  const reasons = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, reasons: ['Payload is null or not an object.'] };
  }

  if (!payload.data || typeof payload.data !== 'object') {
    reasons.push('Payload is missing a valid "data" property.');
  }

  if (reasons.length === 0 && !detectLegacyShape(payload)) {
    reasons.push(
      'Payload is not a legacy v2 backup: none of fixedSpends, variableSpends, ' +
      'or subscriptions tables are present. Use the standard import for v3+ backups.'
    );
  }

  return { valid: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// APR normalisation helper
// ---------------------------------------------------------------------------

/**
 * Converts a debt APR value to a number.
 * Handles string formats like "4.9%", "19.9 %", or already-numeric values.
 *
 * @param {string|number|null|undefined} apr
 * @returns {number}
 */
function normaliseApr(apr) {
  if (apr === null || apr === undefined) return 0;
  if (typeof apr === 'number') return apr;
  const cleaned = String(apr).replace(/%/g, '').trim();
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Transforms a v2 data object (from a legacy backup) into the current-schema
 * compatible shape used by schema v5+.
 *
 * Key transformations:
 *   - fixedSpends  → recurrentExpenses (add defaults: frequency, isEssential, status)
 *   - variableSpends → oneOffExpenses
 *   - subscriptions → recurrentExpenses (merged, frequency preserved)
 *   - debts.apr: string percentage "4.9%" → number 4.9
 *   - Legacy table keys are removed from the output.
 *
 * @param {{ fixedSpends?: object[], variableSpends?: object[], subscriptions?: object[], debts?: object[], [key: string]: any }} legacyData
 * @returns {object} Current-schema-compatible data object
 */
export function mapLegacyToCurrent(legacyData) {
  const result = {};

  // ── Pass-through tables (unchanged shape) ────────────────────────────────
  const passthroughTables = ['income', 'categories', 'assets', 'statements', 'targets', 'netWorthSnapshots', 'categoryMappings', 'recurringTemplates'];
  for (const key of passthroughTables) {
    if (Array.isArray(legacyData[key])) {
      result[key] = legacyData[key];
    }
  }

  // ── recurrentExpenses: merge fixedSpends + subscriptions ────────────────
  const recurrent = [];

  if (Array.isArray(legacyData.fixedSpends)) {
    for (const item of legacyData.fixedSpends) {
      recurrent.push({
        ...item,
        label: item.label ?? item.name ?? '',
        status: item.status ?? 'pending',
        frequency: item.frequency ?? 'monthly',
        isEssential: item.isEssential ?? false,
        cycleTotal: item.cycleTotal ?? null,
        cycleCurrent: item.cycleCurrent ?? null,
        endDate: item.endDate ?? null,
      });
    }
  }

  if (Array.isArray(legacyData.subscriptions)) {
    for (const item of legacyData.subscriptions) {
      recurrent.push({
        ...item,
        label: item.label ?? item.name ?? '',
        status: item.status ?? 'pending',
        frequency: item.frequency ?? 'monthly',
        isEssential: item.isEssential ?? false,
        cycleTotal: item.cycleTotal ?? null,
        cycleCurrent: item.cycleCurrent ?? null,
        endDate: item.endDate ?? null,
      });
    }
  }

  if (recurrent.length > 0) {
    result.recurrentExpenses = recurrent;
  }

  // ── oneOffExpenses: from variableSpends ──────────────────────────────────
  if (Array.isArray(legacyData.variableSpends)) {
    result.oneOffExpenses = legacyData.variableSpends.map(item => ({
      ...item,
      note: item.note ?? item.name ?? '',
    }));
  }

  // ── debts: normalise APR ─────────────────────────────────────────────────
  if (Array.isArray(legacyData.debts)) {
    result.debts = legacyData.debts.map(debt => ({
      ...debt,
      apr: normaliseApr(debt.apr),
    }));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Conflict-safe import (in-memory, no Dexie dependency)
// ---------------------------------------------------------------------------

/**
 * Imports mapped legacy data into a simulated store, applying conflict resolution.
 *
 * This function is the pure logic layer — it does NOT touch Dexie directly so
 * that it can be used in tests without a real IndexedDB. For real DB writes,
 * use `runLegacyImport`.
 *
 * Default conflict policy: 'skip' — existing records (matched by `id`) are
 * never overwritten. Pass `conflictPolicy: 'overwrite'` to change this.
 *
 * @param {object} mappedData - Output of mapLegacyToCurrent
 * @param {{ existingData?: object, conflictPolicy?: 'skip'|'overwrite' }} options
 * @returns {Promise<{ imported: number, skipped: number, conflicts: number }>}
 */
export async function importLegacyData(mappedData, options = {}) {
  const { existingData = {}, conflictPolicy = 'skip' } = options;

  let imported = 0;
  let skipped = 0;
  let conflicts = 0;

  for (const [tableName, records] of Object.entries(mappedData)) {
    if (!Array.isArray(records)) continue;

    const existing = existingData[tableName] ?? [];
    const existingIds = new Set(existing.map(r => r.id).filter(id => id != null));

    for (const record of records) {
      if (record.id != null && existingIds.has(record.id)) {
        conflicts++;
        if (conflictPolicy === 'skip') {
          skipped++;
        } else {
          // overwrite: count as imported
          imported++;
        }
      } else {
        imported++;
      }
    }
  }

  return { imported, skipped, conflicts };
}

// ---------------------------------------------------------------------------
// Full orchestration (validates → maps → writes to Dexie)
// ---------------------------------------------------------------------------

/**
 * Full import pipeline entry point.
 *
 * 1. Validate that `payload` is a recognisable legacy v2 backup — throws with
 *    clear incompatibility reasons before any write if not.
 * 2. Map v2 data to current schema.
 * 3. Write to the real Dexie DB with the given conflict policy (default: skip).
 *
 * @param {*} payload - Parsed JSON backup file.
 * @param {{ db?: import('dexie').Dexie, conflictPolicy?: 'skip'|'overwrite' }} options
 * @returns {Promise<{ imported: number, skipped: number, conflicts: number }>}
 * @throws {Error} If payload is not a valid legacy backup (before any writes).
 */
export async function runLegacyImport(payload, options = {}) {
  // --- Step 1: validate before any write --------------------------------
  const validation = validateLegacyData(payload);
  if (!validation.valid) {
    throw new Error(
      `Payload is not a legacy v2 backup (not a legacy / incompatible / unrecognised): ${validation.reasons.join('; ')}`
    );
  }

  // --- Step 2: map to current schema ------------------------------------
  const mappedData = mapLegacyToCurrent(payload.data);

  // --- Step 3: write to Dexie (if db provided) or return summary -------
  const { db, conflictPolicy = 'skip' } = options;

  if (!db) {
    // No DB provided — return dry-run summary (useful in tests)
    return { imported: 0, skipped: 0, conflicts: 0, dryRun: true, mappedData };
  }

  let imported = 0;
  let skipped = 0;
  let conflicts = 0;

  // Read existing IDs per table for conflict detection
  const existingData = {};
  for (const tableName of Object.keys(mappedData)) {
    try {
      existingData[tableName] = await db.table(tableName).toArray();
    } catch {
      existingData[tableName] = [];
    }
  }

  const summary = await importLegacyData(mappedData, { existingData, conflictPolicy });
  imported = summary.imported;
  skipped = summary.skipped;
  conflicts = summary.conflicts;

  // Perform actual writes for non-conflicting records (or all if overwrite)
  for (const [tableName, records] of Object.entries(mappedData)) {
    if (!Array.isArray(records)) continue;

    try {
      const existing = existingData[tableName] ?? [];
      const existingIds = new Set(existing.map(r => r.id).filter(id => id != null));

      const toWrite = conflictPolicy === 'overwrite'
        ? records
        : records.filter(r => r.id == null || !existingIds.has(r.id));

      if (toWrite.length > 0) {
        if (conflictPolicy === 'overwrite') {
          await db.table(tableName).bulkPut(toWrite);
        } else {
          await db.table(tableName).bulkAdd(toWrite);
        }
      }
    } catch (err) {
      console.warn(`[legacy-import] ${tableName}: write error`, err);
      // Continue with next table rather than failing the entire import
    }
  }

  return { imported, skipped, conflicts };
}

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Parses a legacy backup payload.
 * Returns { valid: true, data: mappedData } or { valid: false, reasons: string[] }.
 *
 * @param {*} payload
 * @returns {{ valid: boolean, data?: object, reasons?: string[] }}
 */
export function parseLegacyBackup(payload) {
  const validation = validateLegacyData(payload);
  if (!validation.valid) {
    return { valid: false, reasons: validation.reasons };
  }
  return { valid: true, data: mapLegacyToCurrent(payload.data) };
}
