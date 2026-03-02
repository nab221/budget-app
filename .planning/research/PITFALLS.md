# Domain Pitfalls: File Sync & Persistent Storage

**Domain:** Browser File Persistence & Local-First Sync
**Researched:** 2024-05-24

## Critical Pitfalls

Mistakes that cause data loss or critical app failure.

### Pitfall 1: Cloud Sync Lock Contention (OneDrive/Dropbox)
**What goes wrong:** Cloud providers lock files while syncing, causing `createWritable()` or `write()` to fail with `NoModificationAllowedError`.
**Root cause:** OS-level exclusive file access during sync operations.
**Prevention:** Implement retry logic with exponential backoff (e.g., 5 retries over 5 seconds). Use `keepExistingData: true` to use swap files.
**Detection:** Catch `NoModificationAllowedError` explicitly.

### Pitfall 2: "Online-only" Placeholder Files
**What goes wrong:** User picks a file that isn't physically on the disk, causing `NotFoundError` or `NotAllowedError`.
**Prevention:** Detect the error and prompt the user to "Always keep on this device" or "Download" via File Explorer.

### Pitfall 3: Permission Revocation
**What goes wrong:** Browsers reset file permissions after closing all tabs of the origin. Stored handles in IndexedDB become unusable.
**Prevention:** Always `queryPermission` on page load. Provide a "Re-authorize" button in the UI. Requesting permission MUST be triggered by a user gesture.

## Moderate Pitfalls

### Pitfall 1: Atomic Write Interference
**What goes wrong:** `createWritable()` creates a temporary swap file (e.g., `filename.json.crswap`). Some sync providers may try to sync this temporary file, or it may be blocked by antivirus.
**Prevention:** Use `close()` only when sure, and handle errors during `close()` carefully as this is when the actual file swap happens.

### Pitfall 2: Storage Quota Pressure
**What goes wrong:** Browser clears IndexedDB if disk space is low (Storage Eviction).
**Prevention:** Use `navigator.storage.persist()` to request "persistent" storage status for the origin.

## Minor Pitfalls

### Pitfall 1: Handle Serialization Incompatibilities
**What goes wrong:** Trying to store handles in `localStorage`.
**Prevention:** Always use IndexedDB for handles as they are non-serializable to string format.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| File Integration | Permission Lifecycle | Early UI for "Reconnect" flow. |
| Sync Implementation | Sync Provider Locks | Retry logic in the `SyncManager`. |
| Error Handling | Silent Failures | Robust logging and toast notifications for file errors. |

## Sources

- [FSA-API Error Reference](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission#exceptions)
- [Microsoft OneDrive Troubleshooting - Sync Issues](https://support.microsoft.com/en-us/office/fix-onedrive-sync-problems-0899b115-05f7-4502-9c9d-3b748d8446c9)
