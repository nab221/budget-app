---
phase: 06-cloud-backup
verified: 2026-03-01T14:00:00Z
status: passed
score: 16/16 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 15/16
  gaps_closed:
    - "ROADMAP.md Success Criterion 2 updated to accurately describe GIS popup re-auth: 're-authentication opens a GIS popup when the cached token expires (GIS does not support headless silent refresh)'"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Cloud Backup cards visible in Settings tab"
    expected: "Two provider cards (Google Drive, OneDrive) visible side by side in the Settings tab. Each shows a Connect button when disconnected."
    why_human: "Visual layout cannot be verified programmatically. Confirmed by user during plan 03 checkpoint."
  - test: "Connected state persists across page reload"
    expected: "After connecting either provider, reloading the page and navigating to Settings still shows the connected card with the account email and last backup time."
    why_human: "Requires live localStorage read in a browser — cannot verify programmatically."
  - test: "Google Drive OAuth popup opens from Connect button"
    expected: "Clicking Connect on the Google Drive card opens the GIS popup (requires VITE_GOOGLE_CLIENT_ID set in .env)."
    why_human: "Requires real OAuth credentials and a browser interaction."
  - test: "OneDrive OAuth popup opens from Connect button"
    expected: "Clicking Connect on the OneDrive card opens the MSAL login popup (requires VITE_ONEDRIVE_CLIENT_ID set in .env)."
    why_human: "Requires real OAuth credentials and a browser interaction."
  - test: "Backup/Restore buttons disabled when offline"
    expected: "With devtools Network set to Offline, Backup Now and Restore buttons are disabled on connected cards."
    why_human: "Requires browser devtools offline simulation."
  - test: "Confirmation modal fires before Disconnect and Restore"
    expected: "Clicking Disconnect or Restore shows the templateUI modal with Cancel + confirm buttons before any destructive action."
    why_human: "Requires browser interaction to trigger the modal."
  - test: "Provider switch confirmation modal fires"
    expected: "If one provider is connected and the user clicks Connect on the other, a 'Switch Provider' modal appears before disconnecting the first provider."
    why_human: "Requires browser interaction with two provider states."
---

# Phase 6: Cloud Backup Verification Report

**Phase Goal:** Users can back up and restore their data via Google Drive or OneDrive, enabling cross-device access without a backend
**Verified:** 2026-03-01
**Status:** passed
**Re-verification:** Yes — after gap closure (previous score 15/16, one documentation gap)

---

## Re-verification Summary

Previous verification (15/16) had one remaining gap: ROADMAP.md Success Criterion 2 still read "re-authentication is handled silently when the token expires" — which is factually inaccurate for GIS (Google Identity Services requires a popup on token expiry, not a headless silent refresh).

**That gap is now CLOSED.** ROADMAP.md line 108 now reads:

> "re-authentication opens a GIS popup when the cached token expires (GIS does not support headless silent refresh)"

This accurately describes the implemented behaviour. All 16 must-haves are verified. No regressions detected — line counts for the three implementation modules are stable (google-drive.js: 257 lines, onedrive.js: 228 lines, cloud-backup.js: 402 lines) and all exports are confirmed present.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GIS token client initialises with drive.appdata + openid + email scopes | VERIFIED | `google-drive.js` line 18: `GOOGLE_SCOPES = '...drive.appdata openid email'`; initTokenClient called with this scope |
| 2 | GIS access token held in module-scope memory (not localStorage) | VERIFIED | `_tokenData` at module scope (line 34); `disconnectGoogle()` sets `_tokenData = null`; no localStorage.setItem for the token |
| 3 | googleDriveUpload() PATCH-or-POST multipart to appDataFolder | VERIFIED | Lines 188-222: lists existing file, builds FormData with metadata+file blobs, PATCH if existingId else POST |
| 4 | googleDriveDownload() returns raw JSON string or throws NO_BACKUP_FOUND | VERIFIED | Lines 233-257: throws `new Error('NO_BACKUP_FOUND')` when no file found, returns `dlRes.text()` |
| 5 | MSAL singleton initialised once with initialize() awaited | VERIFIED | `getMsal()` lines 43-64: creates instance once, awaits `initialize()` on first call, guards with `_initialized` flag |
| 6 | oneDriveUpload() uses PUT /me/drive/root:/budget-backup.json:/content | VERIFIED | `onedrive.js` line 166: `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FILE_NAME}:/content` with `method: 'PUT'` |
| 7 | oneDriveDownload() returns raw JSON string or throws NO_BACKUP_FOUND for 404 | VERIFIED | Lines 193-210: `if (res.status === 404) throw new Error('NO_BACKUP_FOUND')`, returns `res.text()` |
| 8 | cloudBackupUI.init() reads localStorage to restore connected state on page load | VERIFIED | `init()` calls `initGoogleDrive()` and `this.render()`; `renderCard()` reads localStorage each call (lines 170-173) |
| 9 | render() produces two provider cards side by side | VERIFIED | Lines 150-161: iterates `providers` array with google + onedrive entries, injects into flex container |
| 10 | Connect button for Google calls withGoogleToken directly from click handler | VERIFIED | `connect()` line 242: `withGoogleToken(async (_token) => { this.render(); })` — called synchronously in click handler |
| 11 | Backup/Restore disabled when navigator.onLine is false | VERIFIED | `renderCard()` lines 183-184: `${offline ? ' disabled' : ''}` on Backup Now and Restore buttons; `backup()` and `restore()` both guard with `if (!navigator.onLine)` |
| 12 | Disconnect and Restore gated behind confirmation modal | VERIFIED | Both `disconnect()` and `restore()` use the `window._cloudConfirm` Promise pattern with `templateUI.showModal()` |
| 13 | cloudBackupContainer div in Settings panel | VERIFIED | `index.html` line 351: `<div id="cloudBackupContainer">` inside settings tab panel |
| 14 | GIS script loaded in index.html before closing body tag | VERIFIED | `index.html` line 380: `<script src="https://accounts.google.com/gsi/client" async defer></script>` |
| 15 | app.js imports cloudBackupUI and calls init() and render() | VERIFIED | `app.js` line 16: import; line 129: `await cloudBackupUI.init()`; line 96: `cloudBackupUI.render()` in settings tab handler |
| 16 | ROADMAP.md Success Criteria accurately describe implemented behaviour | VERIFIED | Criterion 1 (OneDrive MSAL PKCE) — correct. Criterion 2 now reads "re-authentication opens a GIS popup when the cached token expires (GIS does not support headless silent refresh)" — accurately describes GIS architectural constraint. Gap closed. |

**Score: 16/16 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/google-drive.js` | GIS token lifecycle + Drive v3 appDataFolder file ops | VERIFIED | 257 lines. Exports: `isGoogleConnected`, `fetchGoogleUserEmail`, `initGoogleDrive`, `withGoogleToken`, `disconnectGoogle`, `googleDriveUpload`, `googleDriveDownload` (7 exports — all required functions present) |
| `src/utils/onedrive.js` | MSAL.js singleton + Graph API file operations | VERIFIED | 228 lines. Exports: `isOneDriveConnected`, `connectOneDrive`, `disconnectOneDrive`, `oneDriveUpload`, `oneDriveDownload`, `getOneDriveUserEmail` (all 6 required) |
| `src/ui/cloud-backup.js` | Provider cards UI + connect/disconnect/backup/restore orchestration | VERIFIED | 402 lines. Exports `cloudBackupUI` with `init`, `render`, `renderCard`, `connect`, `backup`, `restore`, `disconnect`. Assigns `window.cloudBackupUI` at module load and in `init()`. |
| `index.html` | GIS script tag + cloudBackupContainer div in settings panel | VERIFIED | Both present. Container at line 351; GIS script at line 380 with async/defer. |
| `src/app.js` | cloudBackupUI import and init call | VERIFIED | Import at line 16, `cloudBackupUI.init()` at startup line 129, `cloudBackupUI.render()` in settings tab handler line 96. |
| `vite.config.js` | Workbox globPatterns excludes external CDN | VERIFIED | `globPatterns: ['**/*.{js,css,html,ico,png,svg}']` — local assets only. GIS exclusion documented in comment lines 33-34. |
| `.planning/REQUIREMENTS.md` | CLOUD-01/CLOUD-02/CLOUD-03/CLOUD-04 describe implemented providers | VERIFIED | CLOUD-01: "Microsoft OneDrive account (MSAL.js PKCE)". CLOUD-02: "load their data file from OneDrive". CLOUD-03: Google Drive GIS + appDataFolder. CLOUD-04: localStorage persistence + disconnect. All four marked `[x]` complete. |
| `.planning/ROADMAP.md` | Phase 6 goal and success criteria describe Google Drive + OneDrive accurately | VERIFIED | Goal (line 103): "Google Drive or OneDrive". Criterion 1 (line 107): "OneDrive account (MSAL.js PKCE)". Criterion 2 (line 108): "re-authentication opens a GIS popup when the cached token expires (GIS does not support headless silent refresh)". All accurate. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/ui/cloud-backup.js` | `src/utils/google-drive.js` | `import { initGoogleDrive, withGoogleToken, ... }` | VERIFIED | Lines 16-19: imports all 5 required Google functions. All called in business logic. |
| `src/ui/cloud-backup.js` | `src/utils/onedrive.js` | `import { connectOneDrive, ... }` | VERIFIED | Lines 20-24: imports 5 OneDrive functions. All called in business logic. |
| `src/ui/cloud-backup.js` | `src/db/schema.js` | `import { db }` + `db.tables` pattern | VERIFIED | Line 14: `import { db } from '../db/schema.js'`. Lines 50-54: `db.tables.map(...)` and `db.table(name).toArray()`. Lines 67-73: `db.transaction('rw', db.tables, ...)`. |
| `index.html` | `src/ui/cloud-backup.js` | `cloudBackupUI.render()` writes into `#cloudBackupContainer` | VERIFIED | `#cloudBackupContainer` div at line 351; `render()` calls `document.getElementById('cloudBackupContainer')` (line 148). |
| `src/app.js` | `src/ui/cloud-backup.js` | `import cloudBackupUI` + `init()` call | VERIFIED | Import line 16, init line 129, render on tab activation line 96. |
| `src/utils/google-drive.js` | `googleapis.com/drive/v3` | `fetch()` with `Authorization: Bearer` | VERIFIED | Lines 190-193 (upload list), 206 (upload PATCH/POST), 235-238 (download list), 247-250 (download content) — all use Bearer header. |
| `src/utils/onedrive.js` | `graph.microsoft.com` | `fetch()` with MSAL-obtained access token | VERIFIED | Lines 165-175 (upload), 196-199 (download), 221-224 (user email) — all use `Authorization: Bearer ${token}`. |

---

## Requirements Coverage

| Requirement | Source Plans | Description in REQUIREMENTS.md | Implementation | Status |
|-------------|-------------|--------------------------------|----------------|--------|
| CLOUD-01 | 06-01, 06-02 | "User can connect a Microsoft OneDrive account (MSAL.js PKCE, no server required) and save their data file to OneDrive" | OneDrive MSAL PKCE connect + upload implemented in `src/utils/onedrive.js` | SATISFIED |
| CLOUD-02 | 06-01, 06-02 | "User can load their data file from OneDrive to restore or sync across devices" | OneDrive download + restore implemented in `onedrive.js` + `cloud-backup.js` | SATISFIED |
| CLOUD-03 | 06-01, 06-02, 06-03 | "User can connect a Google Drive account and save/load their data file (GIS token + Drive v3 appDataFolder)" | Google Drive GIS + Drive v3 appDataFolder implemented in `src/utils/google-drive.js` | SATISFIED |
| CLOUD-04 | 06-02, 06-03 | "Connected cloud account preference persists in localStorage; user can disconnect at any time" | `cloud_provider` + `cloud_account_email` keys set in both connect flows; `disconnectGoogle()` and `disconnectOneDrive()` both remove all three CLOUD_* keys | SATISFIED |

All four requirements SATISFIED. No orphaned requirements.

---

## Anti-Patterns Found

No code-level anti-patterns detected. Regression check confirms clean state:

- No TODO/FIXME/HACK/XXX comments in any of the three implementation modules
- No placeholder return values (`return null`, `return {}`, `return []`)
- No empty handlers or stubs
- No hardcoded OAuth credentials (both use `import.meta.env.VITE_*` with empty-string fallback)
- No GIS token written to localStorage (confirmed: only `cloud_provider`, `cloud_account_email`, `cloud_last_backup` keys written)
- No Dropbox code present (correct — provider was substituted)
- No auto-sync code (manual backup only, as designed)

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No anti-patterns found | — | — |

---

## Human Verification Required

### 1. Provider Cards Visible in Settings Tab

**Test:** Run `npm run dev`, navigate to the Settings tab (gear icon), scroll to the bottom.
**Expected:** Two cards side by side — "Google Drive" and "OneDrive" — each with a Connect button.
**Why human:** Visual layout cannot be verified programmatically. (User confirmed during plan 03 checkpoint.)

### 2. Connected State Persists Across Reload

**Test:** Connect either provider, reload the page, navigate to Settings.
**Expected:** Card still shows as connected with account email and "Last backup: Never" (or a timestamp).
**Why human:** Requires live localStorage read in a browser environment.

### 3. Google Drive OAuth Popup

**Test:** Set `VITE_GOOGLE_CLIENT_ID` in `.env`, click Connect on the Google Drive card.
**Expected:** GIS OAuth popup opens; after authentication the card updates to show connected state.
**Why human:** Requires real OAuth credentials and browser interaction.

### 4. OneDrive OAuth Popup

**Test:** Set `VITE_ONEDRIVE_CLIENT_ID` in `.env`, click Connect on the OneDrive card.
**Expected:** MSAL login popup opens; after authentication the card updates to show connected state.
**Why human:** Requires real OAuth credentials and browser interaction.

### 5. Offline Guard

**Test:** In browser devtools set Network to Offline, navigate to Settings with a connected provider.
**Expected:** Backup Now and Restore buttons are disabled. Clicking them shows "No internet connection" inline.
**Why human:** Requires devtools offline simulation.

### 6. Confirmation Modals

**Test:** With a provider connected, click Disconnect. Then click Restore.
**Expected:** A confirmation modal appears for each before any action is taken. Cancel aborts the action.
**Why human:** Requires browser interaction to trigger templateUI modals.

### 7. Provider Switch Confirmation

**Test:** Connect Google Drive, then click Connect on the OneDrive card.
**Expected:** "Switch Provider" modal appears asking to confirm disconnecting Google Drive before connecting OneDrive.
**Why human:** Requires two-step browser interaction.

---

## Summary

All 16 must-haves are now verified. The phase goal is fully achieved.

The implementation was complete and correct from the end of plan 03. Two prior documentation gaps were addressed across the two previous re-verifications:

1. REQUIREMENTS.md CLOUD-01 and CLOUD-02 were updated from the original Dropbox wording to correctly describe the OneDrive MSAL.js PKCE implementation (closed in previous run).
2. ROADMAP.md Success Criterion 2 was updated from "re-authentication is handled silently when the token expires" to "re-authentication opens a GIS popup when the cached token expires (GIS does not support headless silent refresh)" — closed in this run.

All four requirements (CLOUD-01 through CLOUD-04) are satisfied. All key links are wired. No anti-patterns remain in the implementation code.

---

*Verified: 2026-03-01*
*Verifier: Claude (gsd-verifier)*
*Re-verification: Yes — all gaps closed, status upgraded from gaps_found to passed*
