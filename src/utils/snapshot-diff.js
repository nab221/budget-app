/**
 * src/utils/snapshot-diff.js
 *
 * Phase 37 — Cloud Snapshot Delta Preview
 *
 * Pure, read-only helpers for computing per-store delta counts between a
 * current local store map and an incoming cloud snapshot store map.
 *
 * All functions are side-effect free: they never write to IndexedDB, never
 * mutate the input objects, and never dispatch events.
 *
 * Exports:
 *   computeSnapshotDiff(currentStoreMap, incomingStoreMap) → diffMap
 *   isFirstSyncFallback(currentStoreMap) → boolean
 *   formatDiffSummary(diffMap) → DiffLine[]
 *   canonicalizeRecordForDiff(record) → string
 */

// ---------------------------------------------------------------------------
// canonicalizeRecordForDiff
// ---------------------------------------------------------------------------

/**
 * Produces a deterministic JSON string representing the semantic content of a
 * record, excluding its `id` field.  Used for equality comparison so that
 * two records that differ only in key insertion order are treated as equal.
 *
 * @param {object} record - A plain JS object representing one DB row.
 * @returns {string} Stable, id-free JSON string.
 */
export function canonicalizeRecordForDiff(record) {
  const withoutId = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== 'id')
  );
  const sortedKeys = Object.keys(withoutId).sort();
  const sorted = {};
  for (const key of sortedKeys) {
    sorted[key] = withoutId[key];
  }
  return JSON.stringify(sorted);
}

// ---------------------------------------------------------------------------
// computeSnapshotDiff
// ---------------------------------------------------------------------------

/**
 * Computes per-store added / deleted / updated counts by comparing the current
 * local state against the incoming cloud snapshot.
 *
 * Rules:
 *  - A record id present only in `incoming` → added
 *  - A record id present only in `current` → deleted
 *  - A record id present in both but with different canonical content → updated
 *  - Stores present only on one side are treated as all-added or all-deleted
 *
 * The function is non-mutating: neither `currentStoreMap` nor
 * `incomingStoreMap` are modified.
 *
 * @param {Record<string, object[]>} currentStoreMap
 *   Map of store name → array of current local records (with `id` fields).
 * @param {Record<string, object[]>} incomingStoreMap
 *   Map of store name → array of incoming cloud records (with `id` fields).
 * @returns {Record<string, {added: number, deleted: number, updated: number}>}
 */
export function computeSnapshotDiff(currentStoreMap, incomingStoreMap) {
  const allStoreNames = new Set([
    ...Object.keys(currentStoreMap),
    ...Object.keys(incomingStoreMap),
  ]);

  const result = {};

  for (const storeName of allStoreNames) {
    const currentRows = currentStoreMap[storeName] ?? [];
    const incomingRows = incomingStoreMap[storeName] ?? [];

    // Build lookup maps: id → canonical string
    const currentMap = new Map();
    for (const row of currentRows) {
      currentMap.set(row.id, canonicalizeRecordForDiff(row));
    }

    const incomingMap = new Map();
    for (const row of incomingRows) {
      incomingMap.set(row.id, canonicalizeRecordForDiff(row));
    }

    let added = 0;
    let deleted = 0;
    let updated = 0;

    // Records in incoming
    for (const [id, incomingCanon] of incomingMap) {
      if (!currentMap.has(id)) {
        added++;
      } else if (currentMap.get(id) !== incomingCanon) {
        updated++;
      }
    }

    // Records only in current (deleted)
    for (const id of currentMap.keys()) {
      if (!incomingMap.has(id)) {
        deleted++;
      }
    }

    result[storeName] = { added, deleted, updated };
  }

  return result;
}

// ---------------------------------------------------------------------------
// isFirstSyncFallback
// ---------------------------------------------------------------------------

/**
 * Returns true when the current local store map contains no rows in any store,
 * indicating that this is the first time the user is syncing from the cloud.
 * In that case, the preview modal should fall back to the existing full-summary
 * count rendering rather than showing a delta.
 *
 * @param {Record<string, object[]>} currentStoreMap
 * @returns {boolean}
 */
export function isFirstSyncFallback(currentStoreMap) {
  for (const rows of Object.values(currentStoreMap)) {
    if (rows.length > 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// formatDiffSummary
// ---------------------------------------------------------------------------

/**
 * @typedef {object} DiffLine
 * @property {string} store    - Store name.
 * @property {number} added    - Count of added records.
 * @property {number} deleted  - Count of deleted records.
 * @property {number} updated  - Count of updated records.
 */

/**
 * Converts the raw diffMap produced by computeSnapshotDiff into a flat array
 * of DiffLine objects, one per store that has at least one non-zero counter.
 * Stores with all-zero counters are omitted.
 *
 * @param {Record<string, {added: number, deleted: number, updated: number}>} diffMap
 * @returns {DiffLine[]}
 */
export function formatDiffSummary(diffMap) {
  const lines = [];
  for (const [store, { added, deleted, updated }] of Object.entries(diffMap)) {
    if (added === 0 && deleted === 0 && updated === 0) continue;
    lines.push({ store, added, deleted, updated });
  }
  return lines;
}
