---
status: investigating
trigger: "Investigate issue: import-backup-fail"
created: 2026-02-03T11:26:00Z
updated: 2026-02-03T11:26:00Z
---

## Current Focus

hypothesis: `templateUI` is missing the `showModal` method, causing a `TypeError` in `promptImportConfirmation`, which is caught and displayed as "Invalid backup file format."
test: Verify `templateUI` definition in `src/ui/templates.js`.
expecting: `showModal` is indeed missing.
next_action: Add `showModal` to `templateUI` and also handle legacy backup formats in `executeImport`.

## Evidence

- 2026-02-03T11:28:00Z: Grep for "Invalid backup file format" points to `handleImport` in `src/ui/backup.js`.
- 2026-02-03T11:29:00Z: `handleImport` calls `promptImportConfirmation`, which calls `templateUI.showModal`.
- 2026-02-03T11:30:00Z: Grep for `showModal` definition returns no results in the codebase.
- 2026-02-03T11:31:00Z: `src/ui/templates.js` defines `templateUI` but it only has `closeModal`, not `showModal`.
- 2026-02-03T11:32:00Z: Any call to `templateUI.showModal` will throw a `TypeError`. In `handleImport`, this is caught and alerts "Invalid backup file format.", which matches the symptom exactly.


expected: The app should parse the JSON, prompt for confirmation, and then import the data (replacing the empty fresh state).
actual: "Invalid backup file format" alert appears immediately after file selection.
errors: alert('Invalid backup file format.')
reproduction: 
1. Open the app (modular/Vite version).
2. Click "Import" in the header (or Settings).
3. Select a version 1.0 .json backup file.
4. Error appears immediately.
started: Started when trying to migrate data to a new computer.

## Eliminated


## Evidence


## Resolution

root_cause: 
fix: 
verification: 
files_changed: []
