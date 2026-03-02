# Feature Landscape: File & Data Operations

**Domain:** Local Data Management
**Researched:** 2024-05-24

## Table Stakes

Features users expect in a local-first application.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Automatic Backup | Prevents data loss if IDB is cleared by browser. | Med | Requires persisting a FileHandle. |
| Persistent Handle | Avoids picking file on every page reload. | Med | Use IndexedDB to store the handle. |
| Sync Status | User needs to know if the file is in sync. | Low | Visual indicator of last write success. |

## Differentiators

Features that set the app apart in terms of UX.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cloud-Sync Warning | Notifies user if OneDrive/Dropbox has locked the file. | Med | Catch `NoModificationAllowedError`. |
| PWA Persistence | No permission prompt on every visit (Chrome 122+). | Low | Requires "Installed" PWA state. |
| Conflict Detection | Detects if the file was modified elsewhere. | High | Requires ETag or modification time check. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Direct Dropbox API | Requires server/OAuth management. | Use File System Access API on the Dropbox sync folder. |
| Proprietary Backup Format | Locks user in. | Stick to standard JSON. |

## Feature Dependencies

```
Handle Persistence → Automatic Backup → Conflict Detection
```

## MVP Recommendation

Prioritize:
1.  **Persistent Handle Persistence**: Store the FileSystemHandle in IndexedDB.
2.  **Explicit "Authorize" UI**: A simple button to request permissions if `queryPermission` returns `prompt`.
3.  **Basic Sync Error Handling**: Retry logic (1s delay) for `NoModificationAllowedError`.

## Sources

- [Google Chrome Developers - Persistent Permissions](https://developer.chrome.com/blog/persistent-permissions-for-file-system-access/)
- [Web.dev - Storage for the Web](https://web.dev/storage-for-the-web/)
