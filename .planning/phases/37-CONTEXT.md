# Phase 37 Context: Cloud Snapshot Delta Preview

## Objective
Change the cloud snapshot preview modal from showing a full summary of all stored items to showing only what has changed since the last cloud push. This makes the preview more useful and actionable, especially for users who sync regularly.

## Background

### Current Behaviour
When the user clicks "Cloud Push" or opens the sync preview, `_bindPreviewListener()` in `cloud-sync.js` fires a `budget:import-cloud-preview` event. The modal then lists all items in the current local snapshot: number of income records, expenses, debt records, etc. For regular users who sync often, this is unhelpful — everything is listed every time.

### Desired Behaviour
Show only what has changed since the last cloud snapshot was pushed:
- "+2 expenses added"
- "1 income record modified"
- "Mortgage balance updated"
- "3 categories unchanged" (omit — don't show unchanged items)

If no previous cloud snapshot exists (first push), fall back to the full item summary with a note: "First sync — showing full snapshot."

### How to Detect Changes

The Supabase cloud snapshot is a JSON blob stored at a fixed path per user. It contains a `snapshotTimestamp` and a full data dump.

**Approach:**
1. When preparing a push preview, load the **last successfully pushed snapshot** from localStorage (cached locally after the last push)
2. Compare the new local snapshot against the cached previous snapshot
3. For each entity type, count: added, modified (by comparing IDs + timestamps or hash), deleted
4. Display only non-zero delta counts

### Caching the Previous Snapshot
After a successful cloud push, cache the snapshot in localStorage under a key like `last_pushed_snapshot`. On subsequent previews, load from this cache for comparison.

This is entirely client-side — no extra Supabase reads needed for the preview.

## Implementation Plan

### `src/utils/snapshot-diff.js` (new utility)
```js
/**
 * Compare two budget snapshots and return a delta summary.
 * @param {object} previous - Previously pushed snapshot (or null)
 * @param {object} current - Current local snapshot
 * @returns {SnapshotDelta}
 */
export function diffSnapshots(previous, current)

// SnapshotDelta:
{
  isFirstSync: Boolean,
  changes: [
    { entity: 'expenses', added: 2, modified: 1, deleted: 0 },
    { entity: 'income', added: 0, modified: 0, deleted: 1 },
    ...
  ],
  hasChanges: Boolean,
  totalChanges: Number
}
```

### `src/ui/cloud-sync.js` — Preview Update
- After computing the snapshot for push, call `diffSnapshots(lastPushedSnapshot, currentSnapshot)`
- Render the delta view in the modal
- On successful push: `localStorage.setItem(LAST_PUSHED_SNAPSHOT_KEY, JSON.stringify(currentSnapshot))`

### Modal Display
```
Changes since last sync (2026-03-12 23:14):
  ✚ 2 expenses added
  ✎ 1 income modified
  ─ No debt changes

[Push to Cloud]  [Cancel]
```
Or if first sync:
```
First sync — your full budget will be saved to the cloud:
  📋 12 expenses | 4 income | 3 debts | 2 categories

[Push to Cloud]  [Cancel]
```

## Files to Change
- `src/utils/snapshot-diff.js` — new module
- `src/utils/snapshot-diff.test.js` — new tests
- `src/ui/cloud-sync.js` — update preview render logic, cache last pushed snapshot
- `src/utils/storage.js` — add `LAST_PUSHED_SNAPSHOT_KEY` constant

## Acceptance Criteria
- [ ] Cloud push preview shows delta (what changed) not full item count
- [ ] If nothing changed since last push, modal shows "No changes since last sync"
- [ ] On first push (no previous snapshot), modal shows full item summary
- [ ] After a successful push, the local snapshot cache is updated
- [ ] Delta accurately counts added, modified, and deleted records per entity type
- [ ] All existing cloud-sync tests pass; new unit tests for `diffSnapshots()`

## Technical Notes
- "Modified" detection: compare by `updatedAt` timestamp if available, or fall back to a simple JSON hash comparison of the record
- Entity types to diff: income, expenses, debts, categories, assets, childcare accounts
- The cached `lastPushedSnapshot` can become large — consider storing only IDs + timestamps rather than full records for the cache, to save localStorage space
