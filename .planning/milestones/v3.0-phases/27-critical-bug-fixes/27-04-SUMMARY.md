---
phase: 27-critical-bug-fixes
plan: "04"
subsystem: data-integrity
tags: [integrity, backup, cloud-sync, gap-closure, INTEGRITY-01]
dependency_graph:
  requires: ["27-03"]
  provides: ["INTEGRITY-01 complete — all 3 trigger points active + cleanup action"]
  affects: ["src/ui/backup.js", "src/app.js", "src/ui/cloud-sync.js"]
tech_stack:
  added: []
  patterns: ["fire-and-forget .then() integrity check with await inside try block for backup"]
key_files:
  created: []
  modified:
    - src/ui/backup.js
    - src/app.js
    - src/ui/cloud-sync.js
decisions:
  - "Used await validateDataIntegrity() inside executeImport() try block (not fire-and-forget) so the warning toast appears before the reload"
  - "window.location.reload() remains unconditional — import success and integrity issues are orthogonal concerns"
  - "cleanOrphanedRecords() called in onClick lambda; confirmation responsibility delegated to the click action (user-initiated)"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_modified: 3
---

# Phase 27 Plan 04: INTEGRITY-01 Gap Closure — Backup Wiring & Cleanup Action Summary

**One-liner:** Post-import integrity check wired into backup.js and 'Clean up' action button added to all three INTEGRITY-01 warning toasts.

## What Was Built

Closed two gaps identified in 27-VERIFICATION.md for INTEGRITY-01 acceptance criteria:

1. **backup.js post-import trigger** — `validateDataIntegrity()` now runs with `await` inside `executeImport()` after `importBackupData()` succeeds. If issues are found a warning toast appears with a 'Clean up' action button before the page reloads.

2. **Cleanup action in app.js startup toast** — The empty `[]` actions array in the startup warning toast was replaced with a 'Clean up' button that calls `cleanOrphanedRecords(issues)` and shows a success toast on completion.

3. **Cleanup action in cloud-sync.js post-pull toast** — The empty `[]` actions array in the post-pull warning toast was replaced with the same 'Clean up' button pattern.

## All Three INTEGRITY-01 Trigger Points

| Trigger | File | Status |
|---------|------|--------|
| App startup | src/app.js | Active (27-03) + cleanup action (27-04) |
| Post-pull sync | src/ui/cloud-sync.js | Active (27-03) + cleanup action (27-04) |
| Post-import | src/ui/backup.js | Active (27-04) |

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire validateDataIntegrity into backup.js executeImport() | 648b72f | src/ui/backup.js |
| 2 | Add cleanup action button to app.js and cloud-sync.js | dacc731 | src/app.js, src/ui/cloud-sync.js |

## Verification Results

- backup.js: import + `await validateDataIntegrity()` + `cleanOrphanedRecords` present
- app.js: `cleanOrphanedRecords` imported and wired in 'Clean up' onClick
- cloud-sync.js: `cleanOrphanedRecords` imported and wired in 'Clean up' onClick
- Empty `[]` actions arrays removed from both warning call sites (grep count: 0)
- Full vitest suite: 393/393 tests pass, 0 failures

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] src/ui/backup.js modified with validateDataIntegrity + cleanOrphanedRecords
- [x] src/app.js modified with cleanOrphanedRecords import and cleanup action
- [x] src/ui/cloud-sync.js modified with cleanOrphanedRecords import and cleanup action
- [x] Commit 648b72f exists
- [x] Commit dacc731 exists
- [x] 393 tests pass
