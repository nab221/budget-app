---
phase: 37
plan: "01"
subsystem: cloud-sync-ui
tags: [cloud-sync, delta-preview, snapshot-diff, tdd]
dependency_graph:
  requires: []
  provides: [snapshot-diff-utility, delta-preview-modal]
  affects: [src/ui/cloud-sync.js, src/utils/snapshot-diff.js]
tech_stack:
  added: []
  patterns: [pure-helper-module, tdd-red-green, event-listener-cleanup-pattern]
key_files:
  created:
    - src/utils/snapshot-diff.js
    - tests/snapshot-diff.test.js
  modified:
    - src/ui/cloud-sync.js
    - src/ui/cloud-sync.test.js
decisions:
  - "_previewHandler stored on cloudSyncUI object so tests can removeEventListener; prevents stale-listener accumulation across test suites"
  - "formatDiffSummary / computeSnapshotDiff guarded with ?? [] / ?? {} to handle mocked environments returning undefined"
  - "First-sync label 'First sync — no local data to compare against' added so users understand why a full count summary is shown"
  - "Delta labels use plain English: 'N added', 'N removed', 'N changed' rather than +/-/~ symbols for clarity"
  - "Pre-existing dashboard.affordability.test.js ordering failure logged to deferred-items.md; not caused by Phase 37"
metrics:
  duration: "~23 minutes"
  completed: "2026-03-16"
  tasks_completed: 3
  files_modified: 4
  tests_added: 25
---

# Phase 37 Plan 01: Cloud Snapshot Delta Preview Summary

Delta-first cloud snapshot preview with first-sync full-summary fallback and "No changes" messaging using a pure read-only snapshot-diff utility.

## What Was Built

**src/utils/snapshot-diff.js** — Pure helper module with four exports:
- `canonicalizeRecordForDiff(record)` — deterministic JSON excluding id field for stable equality comparison
- `computeSnapshotDiff(currentStoreMap, incomingStoreMap)` — per-store added/deleted/updated counts, non-mutating
- `isFirstSyncFallback(currentStoreMap)` — returns true when all monitored stores are empty (first-ever sync)
- `formatDiffSummary(diffMap)` — filters zero-count stores, returns DiffLine array

**src/ui/cloud-sync.js** — Updated `_bindPreviewListener()`:
- Reads `db.tables` before modal assembly to build `currentStoreMap`
- Routes to delta mode (computeSnapshotDiff → formatDiffSummary → render) when baseline exists
- Falls back to existing full-summary counts path on first sync
- Renders "No changes since last snapshot" when all diffs are zero
- Stores handler reference as `_previewHandler` for deterministic removeEventListener cleanup
- All original confirm/cancel import semantics preserved unchanged

**Tests added:**
- 18 unit tests in `tests/snapshot-diff.test.js` — key-order stability, added/deleted/updated math, whole-store edge cases, mutation guard, first-sync detection, formatDiffSummary filtering
- 10 integration tests in `src/ui/cloud-sync.test.js` (Phase 37 describe block) — delta mode, first-sync fallback, no-change message, confirm/cancel semantics, copy/UX assertions
- Phase 25 existing test updated to await async handler before clicking confirm

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] stale event listener accumulation in test suite**
- **Found during:** Task 2 GREEN phase
- **Issue:** `_previewListenerBound = false` in test `beforeEach` re-attached a new listener but left the old one on `window`, causing double-firing with stale mock state
- **Fix:** Stored handler reference as `cloudSyncUI._previewHandler`; test `beforeEach` calls `window.removeEventListener` before rebinding
- **Files modified:** src/ui/cloud-sync.js, src/ui/cloud-sync.test.js
- **Commit:** 741d4d0

**2. [Rule 1 - Bug] formatDiffSummary returning undefined in Phase 25 test context**
- **Found during:** Task 2 GREEN phase
- **Issue:** Phase 25 `beforeEach` calls `vi.clearAllMocks()` which cleared snapshot-diff mock return values; delta path then called `.length` on `undefined`
- **Fix:** Added `?? []` / `?? {}` null-coalescing guards on `formatDiffSummary` and `computeSnapshotDiff` return values
- **Files modified:** src/ui/cloud-sync.js
- **Commit:** 741d4d0

## Out-of-Scope Discovery

**dashboard.affordability.test.js ordering failure** — "renders without throwing when no income events or snapshot exist" fails when the full test suite runs together but passes in isolation. Pre-existing cross-test environment pollution, not caused by Phase 37 changes. Logged to `.planning/phases/37-cloud-snapshot-delta-preview/deferred-items.md`. Candidate for Phase 39 polish.

## Verification Results

- `npm test -- tests/snapshot-diff.test.js --run` → 18/18 passed
- `npm test -- src/ui/cloud-sync.test.js --run` → 61/61 passed
- Full suite → 664/665 pass; 1 pre-existing failure in dashboard.affordability.test.js (out of scope)

## Self-Check: PASSED

- src/utils/snapshot-diff.js: FOUND
- tests/snapshot-diff.test.js: FOUND
- src/ui/cloud-sync.js: FOUND (modified)
- src/ui/cloud-sync.test.js: FOUND (modified)
- 37-01-SUMMARY.md: FOUND
- Commit 1bb0ec9 (feat: implement snapshot-diff): FOUND
- Commit 741d4d0 (feat: integrate delta preview): FOUND
- Commit acf2655 (feat: polish copy): FOUND
