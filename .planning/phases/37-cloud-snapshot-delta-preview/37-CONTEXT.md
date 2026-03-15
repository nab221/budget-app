# Phase 37 Context: Cloud Snapshot Delta Preview

## Scope Correction
An earlier draft of this file described Budget vs Actual Reporting — that work belongs in a future milestone. Phase 37 in the v3.0 roadmap is the Cloud Snapshot Delta Preview as defined below.

## Objective
Change the cloud snapshot preview modal to show a delta (what has changed since the last preview) rather than a full summary of all stored data.

## Background

### Current State
`src/ui/cloud-sync.js` stores the timestamp of the last previewed snapshot in `localStorage` under `CLOUD_LAST_PREVIEWED_SNAPSHOT_KEY`. The `_bindPreviewListener()` method (line 1403) constructs a full summary of all store record-counts and displays it in a modal. It does not highlight what is new, updated, or deleted compared to the previous cloud state — every preview looks the same regardless of whether one record changed or the entire dataset was replaced.

### Delta Logic
On cloud pull, before applying the incoming payload to IndexedDB:
1. Read the current IndexedDB state for every monitored store
2. Compare it against the incoming payload (keyed by record `id`)
3. Compute per-store: `added`, `deleted`, `updated` counts
4. If no previous local snapshot exists (first sync), fall back to the existing full-summary view
5. Display concise human-readable delta lines in the modal:
   - "+ 2 expenses added"
   - "1 income record deleted"
   - "credit card balance updated"

### New Module: `src/utils/snapshot-diff.js`
```js
export function computeSnapshotDiff(currentStoreMap, incomingStoreMap)
// → Map<storeName, { added: number, deleted: number, updated: number }>

export function formatDiffSummary(diffMap)
// → string[]  — human-readable lines, one per store with changes
```

## Files to Change
- `src/utils/snapshot-diff.js` — new pure-utility module
- `tests/snapshot-diff.test.js` — new test file
- `src/ui/cloud-sync.js` — update `_bindPreviewListener()` to use delta display

## Acceptance Criteria
- [ ] Preview modal shows delta items (added / deleted / updated counts per store) not full record counts
- [ ] Delta is computed correctly for all monitored stores
- [ ] "No changes since last snapshot" shown when diffMap has zero changes across all stores
- [ ] Falls back to full-summary display if no previous local snapshot exists
- [ ] `snapshot-diff.test.js` achieves ≥ 80% line coverage
- [ ] All existing Vitest tests pass

## Technical Notes
- Record identity: use the `id` field for matching; all Dexie stores use auto-increment `++id`
- Updated detection: compare JSON-serialised representation of each matched record; normalise field order before comparison to avoid false positives
- Do not write any data to IndexedDB during diff computation — it is a read-only comparison step
- Handle stores present in the incoming payload but absent in current DB (new stores from a schema upgrade on another device) — treat all records in those stores as `added`
