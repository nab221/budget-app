---
phase: 06-cloud-backup
plan: 01
subsystem: ui
tags: [google-drive, onedrive, oauth, gis, msal, graph-api, cloud-backup]

requires:
  - phase: 05-pdf-import
    provides: existing src/utils/ structure and patterns this module follows

provides:
  - "src/utils/google-drive.js: GIS token lifecycle and Drive v3 appDataFolder file operations"
  - "src/utils/onedrive.js: MSAL.js singleton and Graph API file operations"
  - "@azure/msal-browser installed as npm dependency"

affects:
  - "06-cloud-backup plan 02 (cloud-backup UI) — consumes both utility modules"

tech-stack:
  added:
    - "@azure/msal-browser v5.3.0 (PKCE Auth Code flow for OneDrive)"
    - "GIS script (accounts.google.com/gsi/client, CDN — loaded via index.html)"
  patterns:
    - "GIS token model: access token in module-scope memory only, never localStorage"
    - "MSAL singleton: created once, initialize() awaited exactly once per module lifetime"
    - "Shared localStorage keys: cloud_provider, cloud_account_email, cloud_last_backup"
    - "PATCH-or-POST multipart upload to Google Drive appDataFolder"
    - "PUT upsert to OneDrive /me/drive/root:/{file}:/content"
    - "Consistent error strings: NO_BACKUP_FOUND, NOT_CONNECTED for UI layer matching"

key-files:
  created:
    - "src/utils/google-drive.js"
    - "src/utils/onedrive.js"
  modified:
    - "package.json (added @azure/msal-browser)"
    - "package-lock.json"

key-decisions:
  - "GIS token held in module-scope _tokenData only (not localStorage) — access tokens are short-lived (~1h) and not safe to persist"
  - "drive.appdata scope chosen over drive or drive.file — non-sensitive, no OAuth verification required, app-specific hidden folder"
  - "MSAL authority set to login.microsoftonline.com/consumers for personal Microsoft accounts"
  - "Error strings standardised (NO_BACKUP_FOUND, NOT_CONNECTED) so cloud-backup.js can match without importing provider internals"
  - "withGoogleToken() uses _pendingCallback module var so token client can be created once but callback differs per invocation"

patterns-established:
  - "Pattern: withGoogleToken(callback) must be called directly from click handler — popup blocker constraint documented in JSDoc"
  - "Pattern: getMsal() internal helper ensures singleton init before all MSAL operations"
  - "Pattern: oneDriveUpload/download do not accept token param — they acquire via getOneDriveToken() internally (MSAL manages cache)"
  - "Pattern: googleDriveUpload/download accept explicit accessToken — caller (cloud-backup.js) controls when popup fires via withGoogleToken"

requirements-completed: [CLOUD-01, CLOUD-02, CLOUD-03]

duration: 4min
completed: 2026-03-01
---

# Phase 6 Plan 01: Cloud Provider Utility Modules Summary

**GIS token model + MSAL.js singleton modules exposing clean file-operation APIs for Google Drive appDataFolder and OneDrive Graph API, consumed by the cloud-backup UI in plan 02**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-01T06:26:46Z
- **Completed:** 2026-03-01T06:30:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `src/utils/google-drive.js` with GIS token client singleton, in-memory token storage, and Drive v3 appDataFolder multipart upload/download
- Created `src/utils/onedrive.js` with MSAL.js PKCE singleton, automatic silent token refresh with popup fallback, and Graph API PUT/GET file operations
- Installed `@azure/msal-browser` v5.3.0 as an npm dependency (CDN deprecated since MSAL v3)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Google Drive utility module** - `54ba5b2` (feat)
2. **Task 2: Create OneDrive utility module** - `677c377` (feat)

## Files Created/Modified

- `src/utils/google-drive.js` - GIS token client, withGoogleToken(), initGoogleDrive(), disconnectGoogle(), googleDriveUpload(), googleDriveDownload(), isGoogleConnected(), fetchGoogleUserEmail()
- `src/utils/onedrive.js` - MSAL singleton (getMsal()), connectOneDrive(), disconnectOneDrive(), oneDriveUpload(), oneDriveDownload(), getOneDriveUserEmail(), isOneDriveConnected()
- `package.json` - Added @azure/msal-browser dependency
- `package-lock.json` - Updated lockfile

## Decisions Made

- **GIS token in module memory only:** Access tokens are ~1 hour short-lived. Storing in localStorage would be misleading (token would be stale on next visit). Module-scope `_tokenData` with `expires_at` timestamp avoids stale token use.
- **drive.appdata scope:** Non-sensitive scope (no OAuth app verification required), creates a hidden app-specific folder invisible to the user, appropriate for a backup file.
- **`_pendingCallback` pattern for GIS:** GIS token client callback cannot be changed after `initTokenClient()`. Storing the pending callback in a module variable allows the single token client to route to different callers on each invocation.
- **Standardised error strings:** `NO_BACKUP_FOUND` and `NOT_CONNECTED` are consistent across both modules so `cloud-backup.js` can match them without needing to know which provider threw the error.
- **oneDriveUpload/download take no token param:** MSAL handles token acquisition internally via `acquireTokenSilent()` + popup fallback. This is different from the Google module (which requires explicit token param) because MSAL manages the entire auth lifecycle.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Two environment variables must be set before cloud backup will function:

```
VITE_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
VITE_ONEDRIVE_CLIENT_ID=<your-azure-app-client-id>
```

Additionally:
- Google Cloud Console: Register a project, add `drive.appdata openid email` scopes, add authorized JavaScript origin for the app URL, add `accounts.google.com/gsi/client` script tag to `index.html`
- Azure Portal: Register an app with SPA platform, add the app's redirect URI, grant `Files.ReadWrite` and `User.Read` delegated permissions for personal accounts (consumers endpoint)

## Next Phase Readiness

- Both utility modules are ready to be imported by `src/ui/cloud-backup.js` (plan 02)
- `cloud-backup.js` should call `initGoogleDrive()` on settings panel open, and `withGoogleToken(callback)` directly from button click handlers only
- `cloud-backup.js` can call `connectOneDrive()` and all other OneDrive functions directly (no token management needed)
- `index.html` needs the GIS script tag added before plan 02 implementation

---
*Phase: 06-cloud-backup*
*Completed: 2026-03-01*
