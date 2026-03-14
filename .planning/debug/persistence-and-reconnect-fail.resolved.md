---
status: investigating
trigger: "Investigate and fix persistence and file-sync reconnection issues."
created: 2024-05-22T14:41:00Z
updated: 2024-05-22T14:41:00Z
---

## Current Focus

hypothesis: Storage persistence is requested repeatedly and SyncManager lacks a way to re-grant file permission easily.
test: Examine storage.js, sync-manager.js and file-sync.js UI.
expecting: Find redundant calls to persistence and missing UI for re-granting permission.
next_action: Examine storage.js for repeated persistence logging.

## Symptoms

expected: 
- Storage persistence is requested once or handled silently.
- App detects saved file handle and allows easy re-granting of permission via a "Reconnect" button.
- Mutations are automatically saved to the file once permission is granted.

actual: 
- `Storage persisted: false` spam in console.
- "⚠ Reconnect Needed" status shown with no way to act on it easily.
- Mutations are lost on refresh because auto-save fails due to lack of permission.

errors: "⚠ Reconnect Needed" status in UI.

reproduction: 
1. Connect a file for sync.
2. Refresh page.
3. Try to add/delete an entry.
4. UI shows "⚠ Reconnect Needed".
5. No button to re-grant permission.

started: Noticed after recent sync-manager changes.

## Eliminated

## Evidence

- timestamp: 2024-05-22T14:48:00Z
  checked: src/utils/storage.js and src/ui/file-sync.js
  found: `refreshPersistenceWarning` calls `ensurePersistence` on every toolbar update. `ensurePersistence` calls `navigator.storage.persist()` if not already persisted. This causes spam if persistence is denied or not possible.
  implication: `refreshPersistenceWarning` should use `checkPersistence` to avoid redundant permission requests.

- timestamp: 2024-05-22T14:49:00Z
  checked: src/utils/sync-manager.js
  found: `SyncManager` detects missing permission but doesn't provide a way to request it. It only sets status to "error" with "⚠ Reconnect Needed".
  implication: `SyncManager` needs a `requestPermission` or `reconnect` method.

- timestamp: 2024-05-22T14:50:00Z
  checked: src/ui/file-sync.js
  found: `updateFileSyncToolbar` renders the status but doesn't provide an action for the "Reconnect Needed" state.
  implication: UI needs a "Reconnect" button when permission is missing.

## Resolution

root_cause: 
1. `refreshPersistenceWarning` was calling `ensurePersistence` which calls `navigator.storage.persist()` on every toolbar update. If persistence was denied, it logged "false" every time.
2. `SyncManager` detected missing file permission but had no method to request it without re-opening the file.
3. Users were forced to re-open the file to "reconnect", which triggered a LOAD from the file, overwriting local unsaved changes (like deletions that happened while disconnected).

fix: 
1. Changed `refreshPersistenceWarning` to only check persistence using `navigator.storage.persisted()`, avoiding redundant requests and console spam.
2. Added `requestPermission()` to `SyncManager`.
3. Added a "Reconnect" button to the toolbar when permission is missing. This button triggers `requestPermission()` and then SAVES the local state to the file, ensuring local changes are preserved.
4. Added an "Enable Persistence" button to the warning banner to allow users to request persistence on demand.

verification: 
- Console spam from `storage.js` is stopped.
- "Reconnect" button appears when permission is needed (after refresh).
- Clicking "Reconnect" grants permission and saves successfully (observed by status changing to "✓ Saved").
- Persistence warning banner now has a working "Enable Persistence" button.

files_changed: [index.html, src/ui/file-sync.js, src/utils/sync-manager.js]
