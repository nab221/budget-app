---
phase: 07-milestone-v1.0-polish-and-tech-debt
plan: 01
subsystem: ui-rendering, db-utilities, cloud-backup
tags: [tech-debt, refactor, xss-hardening, dead-code-removal, constant-consolidation, db-unification]
requirements-completed: [FOUND-04, CLOUD-04, DATA-01, DATA-02, PWA-01, PWA-02, PWA-04, CHART-01, CHART-02, CLOUD-01, CLOUD-02, CLOUD-03]
dependency_graph:
  requires: []
  provides:
    - src/db/backup.js (importBackupData shared utility)
    - src/utils/storage.js (CLOUD_LAST_BACKUP_KEY central constant)
  affects:
    - src/ui/dashboard.js (XSS-safe card rendering)
    - src/db/schema.js (schema version documentation)
    - src/utils/onedrive.js (dead code removed, constant imported)
    - src/utils/google-drive.js (constant imported from storage)
    - src/ui/cloud-backup.js (constant + restore logic unified)
    - src/ui/backup.js (restore logic unified)
tech_stack:
  added: []
  patterns:
    - Safe DOM construction via createElement/textContent instead of innerHTML for dynamic card content
    - Centralized shared constant in storage.js imported by all consumers
    - Shared db transaction utility in src/db/ layer consumed by UI modules
key_files:
  created:
    - src/db/backup.js
  modified:
    - src/ui/dashboard.js
    - src/db/schema.js
    - src/utils/onedrive.js
    - src/utils/storage.js
    - src/utils/google-drive.js
    - src/ui/cloud-backup.js
    - src/ui/backup.js
decisions:
  - "importBackupData placed in src/db/backup.js (not a UI util) to reflect that it operates purely on the database layer; both UI modules import from db/"
  - "collectData() in cloud-backup.js retains db import separately — it reads data for export, not restore; keeping concerns separate"
  - "handleReset() in backup.js retains inline db.transaction — it is a destructive clear-only operation, not a restore, so the shared importBackupData utility does not apply"
metrics:
  duration_seconds: 201
  completed_date: "2026-03-01"
  tasks_completed: 3
  files_modified: 7
  files_created: 1
---

# Phase 7 Plan 1: Tech Debt Cleanup Summary

**One-liner:** XSS-safe DOM card rendering, CLOUD_LAST_BACKUP_KEY consolidated to storage.js, getOneDriveUserEmail dead code removed, and importBackupData unified from cloud-backup + local backup into src/db/backup.js.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Harden UI Rendering & Schema Documentation | 3bbc421 | src/ui/dashboard.js, src/db/schema.js |
| 2 | Dead Code Removal & Constant Consolidation | c498a29 | src/utils/storage.js, src/utils/google-drive.js, src/utils/onedrive.js, src/ui/cloud-backup.js |
| 3 | Unify Restore Logic | 06c6379 | src/db/backup.js (new), src/ui/backup.js, src/ui/cloud-backup.js |

---

## What Was Built

### Task 1: Harden UI Rendering & Schema Documentation

Replaced the `container.innerHTML = cards.map(...).join('')` pattern in `renderDashboard` with a `createElement`/`textContent` loop. The Net Worth "Risk" badge is now implemented as a `badge` property on the card object and rendered with safe DOM methods — no string interpolation of dynamic content into HTML. The `labelIsHtml: true` flag is removed.

Added a documentation comment in `schema.js` between the `db.version(2)` and `db.version(4)` definitions explaining that version 3 was intentionally skipped during development, and that Dexie handles this gap safely.

### Task 2: Dead Code Removal & Constant Consolidation

- `getOneDriveUserEmail` (exported by `onedrive.js` but never imported anywhere) was deleted.
- `CLOUD_LAST_BACKUP_KEY = 'cloud_last_backup'` was moved to `src/utils/storage.js` as the single source of truth and exported.
- `google-drive.js`, `onedrive.js`, and `cloud-backup.js` now import `CLOUD_LAST_BACKUP_KEY` from `storage.js` — the string literal `'cloud_last_backup'` appears only once in the codebase.

### Task 3: Unify Restore Logic

Created `src/db/backup.js` with `exportAsync function importBackupData(data)` — a shared Dexie transaction that clears and bulk-inserts each table present in the backup data. Both `src/ui/backup.js` (local JSON restore) and `src/ui/cloud-backup.js` (cloud restore) now call this shared function instead of duplicating the transaction logic.

---

## Verification Results

- `grep -r "getOneDriveUserEmail" src/` — no results (dead code eliminated)
- `grep "CLOUD_LAST_BACKUP_KEY" src/utils/storage.js` — single export confirmed
- `grep "cloud_last_backup" src/` — only appears in storage.js definition
- `grep "labelIsHtml\|innerHTML.*card" src/ui/dashboard.js` — no results
- `grep "export.*importBackupData" src/db/backup.js` — export confirmed
- `grep "version(3)" src/db/schema.js` — documentation comment present at line 72

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

One minor clarification applied: `cloud-backup.js` retains its `import { db }` for the `collectData()` function (which reads all tables to produce the backup JSON). This was expected — removing `db` would have broken the backup export path. The plan's intent was to remove the `importData()` inline transaction duplication, which was done.

---

## Self-Check

Checking created files and commits exist:

| Item | Result |
|------|--------|
| src/db/backup.js | FOUND |
| src/ui/dashboard.js | FOUND |
| src/utils/storage.js | FOUND |
| Commit 3bbc421 | FOUND |
| Commit c498a29 | FOUND |
| Commit 06c6379 | FOUND |

## Self-Check: PASSED
