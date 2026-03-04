---
status: verifying
trigger: "Failed to delete/add: window.SyncManager.triggerAutoSave is not a function."
created: 2026-03-04T12:00:00Z
updated: 2026-03-04T12:30:00Z
---

## Current Focus

hypothesis: window.SyncManager is being overwritten by the browser's native SyncManager, which does not have triggerAutoSave.
test: Check src/utils/sync-manager.js and how it's attached to window.
expecting: Evidence of a naming collision or incomplete initialization.
next_action: Verify the fix by checking if repository operations now correctly trigger auto-save (via window.scheduleAutoSave).

## Symptoms

expected: Sync is triggered automatically when adding or deleting items.
actual: Error "window.SyncManager.triggerAutoSave is not a function" prevents the operation from completing or the sync from happening.
errors: window.SyncManager.triggerAutoSave is not a function
reproduction: 1. Open app. 2. Add or delete an income/expense. 3. Error appears.
started: Likely since SyncManager implementation or browser background sync API was introduced.

## Eliminated

## Evidence

- 2026-03-04T12:05:00Z: Found `triggerSync` in `src/db/repository.js` calls `window.SyncManager.triggerAutoSave()`.
- 2026-03-04T12:05:00Z: Confirmed `window.SyncManager` is a native browser constructor (Background Sync API) in modern browsers, which lacks `triggerAutoSave`.
- 2026-03-04T12:05:00Z: Found `src/utils/sync-manager.js` initializes `window.scheduleAutoSave`, not `window.SyncManager.triggerAutoSave`.

## Resolution

root_cause: Naming collision with browser native `SyncManager` API. `src/db/repository.js` was attempting to call a non-existent method on the native constructor instead of the app's sync trigger.
fix: Updated `src/db/repository.js` to call `window.scheduleAutoSave()` which is the correct global hook established by `SyncManager`.
verification: 
files_changed: [src/db/repository.js]
