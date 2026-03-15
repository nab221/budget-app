# Phase 37 Research: Cloud Snapshot Delta Preview

Researched: 2026-03-15
Requirement focus: NAV-04

## Key findings

1. Current preview modal behavior is full-summary only and is event-driven from pull flow.
- `pullSnapshot()` in `src/utils/supabase-sync.js` fetches latest snapshot, parses payload, computes per-table counts, and dispatches `budget:import-cloud-preview` with `{ updated_at, schema_version, counts, tableData }`.
- `_bindPreviewListener()` in `src/ui/cloud-sync.js` listens for that event and renders modal text from `counts` only (`"{n} {store}"`), then confirms import via `importBackupData(tableData)`.
- Hook point for delta mode is inside `_bindPreviewListener()` after event detail is available and before modal body is built.

2. Pull execution lifecycle already gives the right seam for read-only diff.
- `_executePullSync()` in `src/ui/cloud-sync.js` calls `pullSnapshot()` and does not import data itself.
- Import happens only after user clicks `confirmCloudImportBtn` in preview listener.
- This is ideal for a pre-import diff: read current local DB snapshot, compare to incoming `tableData`, show delta in modal, then keep existing confirm/cancel behavior.

3. Current local/cloud snapshot state persistence is split between IndexedDB and localStorage timestamps.
- IndexedDB current state is the only local data baseline for diff (all stores via Dexie `db.tables`).
- `budget_cloud_last_sync` is written on successful push (`pushSnapshot()`) and also set to parsed cloud `updated_at` when cloud preview import is confirmed.
- `budget_cloud_last_previewed_snapshot` is written when preview modal is cancel/confirm clicked.
- There is no dedicated persisted "previous local snapshot object" in localStorage; local baseline must be read from IndexedDB at preview time.

4. First-sync fallback can be determined reliably from current local DB baseline, not only timestamps.
- Recommended fallback condition: local baseline has zero rows across monitored stores used for diff.
- Timestamp keys are useful hints for UX gating, but are not sufficient to prove local baseline existence (keys can be missing or stale while DB has data, and vice versa).
- Therefore: build local store map first; if all monitored stores are empty, use existing full-summary modal text.

5. Data identity assumptions for diff are stable enough for id-keyed matching.
- `src/db/schema.js` defines all active stores with `++id` primary keys through current schema versions.
- Cloud payload is produced from `db.tables.map(t => t.toArray())`; records should include their persisted `id` values.
- Many stores also include non-id fields that can change often (`updated_at`-like timestamps are not evident globally, but domain fields such as balances, status, dates, recurrence metadata, linkage fields, and flags vary frequently). Updated detection should compare normalized record content excluding `id`.

6. Existing tests provide direct seam for behavior-level verification.
- `src/ui/cloud-sync.test.js` already dispatches `budget:import-cloud-preview` and asserts modal/confirm behavior.
- A new pure utility test file can validate added/deleted/updated math independent of DOM.

## Assumptions to carry into planning

1. Delta preview compares local IndexedDB current state vs incoming cloud `tableData` from latest snapshot (not cloud-vs-cloud history).
2. Store identity for matching is `record.id`; records without valid `id` are treated as non-matchable and should be counted as `added` (incoming) or `deleted` (current) rather than forcing brittle heuristics.
3. Updated detection is based on canonical JSON compare of record objects with `id` removed and object keys sorted recursively.
4. First-sync fallback means no usable local baseline for comparison: zero rows across monitored stores.
5. Only stores present in either map are diffed; store missing locally but present in incoming counts as all `added`, and vice versa as all `deleted`.
6. Diff computation is read-only and must not mutate IndexedDB or payload objects.

## Anti-patterns to avoid

1. Doing diff after `importBackupData()`; this would compare post-import state and lose useful preview signal.
2. Using only localStorage timestamps to infer baseline existence.
3. Matching records by array index or deep-equality without id-keying.
4. Comparing raw `JSON.stringify(obj)` without deterministic key ordering.
5. Mutating source records during normalization (causes hidden side effects in UI/tests).
6. Embedding diff algorithm inline in `cloud-sync.js`; keep it in a pure utility for unit tests.

## Proposed snapshot-diff.js API (finalized)

File: `src/utils/snapshot-diff.js`

```js
/**
 * @typedef {Record<string, Array<Record<string, any>>>} SnapshotStoreMap
 * @typedef {{ added: number, deleted: number, updated: number }} StoreDiff
 * @typedef {Record<string, StoreDiff>} SnapshotDiffMap
 */

/**
 * Compute per-store delta between current local snapshot and incoming cloud snapshot.
 * Matching key: `id`.
 * Updated rule: canonical deep compare with `id` excluded.
 */
export function computeSnapshotDiff(currentStoreMap, incomingStoreMap)
// => SnapshotDiffMap

/**
 * True when there is no meaningful local baseline for delta mode.
 * Default behavior: true when all monitored stores are empty.
 */
export function isFirstSyncFallback(currentStoreMap)
// => boolean

/**
 * Convert diff map into concise user-facing lines, only for stores with changes.
 * Examples: "+ 2 income added", "1 oneOffExpenses deleted", "3 debts updated".
 */
export function formatDiffSummary(diffMap)
// => string[]

/**
 * Optional helper used internally and exported for tests.
 * Produces a deterministic string for compare (sorted keys recursively).
 */
export function canonicalizeRecordForDiff(record)
// => string
```

Behavior contract:
- `computeSnapshotDiff()` includes every store that exists in either snapshot map.
- For each store:
  - `added`: ids in incoming not in current
  - `deleted`: ids in current not in incoming
  - `updated`: same id in both, canonicalized content differs
- `formatDiffSummary()` omits zero-change stores; caller shows "No changes since last snapshot" when returned list is empty.

## Files to change with rationale

1. `src/utils/snapshot-diff.js` (new)
- Holds pure diff logic and normalization helpers.
- Keeps UI module focused on orchestration and modal rendering.

2. `src/ui/cloud-sync.js`
- In `_bindPreviewListener()`, build `currentStoreMap` from IndexedDB just before modal body assembly.
- If `isFirstSyncFallback(currentStoreMap)` is true, keep current full-summary count display.
- Else render delta lines from `formatDiffSummary(computeSnapshotDiff(...))`.
- Keep existing confirm/cancel import flow and timestamp writes unchanged.

3. `tests/snapshot-diff.test.js` (new)
- Unit tests for pure utility:
  - added/deleted/updated counts
  - unchanged records
  - store missing on one side
  - first-sync fallback detection
  - canonicalization stability (field-order changes not counted as update)

4. `src/ui/cloud-sync.test.js`
- Add behavior tests around preview rendering:
  - delta lines shown when local baseline exists
  - "No changes since last snapshot" shown when diff is empty
  - full-summary fallback still shown when local baseline is empty

## Test strategy with concrete commands

Target framework: Vitest (jsdom)

1. Fast utility loop during implementation
- `npm test -- tests/snapshot-diff.test.js --run`

2. UI preview behavior checks
- `npm test -- src/ui/cloud-sync.test.js --run`

3. Sync contract sanity (event payload remains compatible)
- `npm test -- src/utils/supabase-sync.test.js --run`

4. Full regression before phase completion
- `npm test -- --run`

Suggested minimum test matrix for new utility:
- local empty + incoming non-empty => first-sync fallback true (UI should use full-summary path)
- local and incoming equal => all zero diff, summary empty
- incoming has new id => added increments
- incoming missing prior id => deleted increments
- same id with changed content => updated increments
- same semantic object with different key order => not updated
