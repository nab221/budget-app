---
phase: 27-critical-bug-fixes
plan: 01
subsystem: cloud-sync-ui
tags: [security, xss, listener-deduplication, idempotency, cloud-sync]
dependency_graph:
  requires: []
  provides: [hardened-cloud-sync-ui]
  affects: [src/ui/cloud-sync.js]
tech_stack:
  added: []
  patterns: [local-escHtml-helper, onclick-assignment-over-addEventListener, bound-flag-guard]
key_files:
  created: []
  modified:
    - src/ui/cloud-sync.js
decisions:
  - "Use local escHtml const in _renderSignedIn() rather than moving the helper to module scope — mirrors existing pattern in _showSyncMenuModal()"
  - "Use .onclick = assignment on modal buttons — replaces addEventListener to prevent handler accumulation across modal re-opens"
  - "_previewListenerBound flag mirrors existing _authListenerBound pattern already in the file"
metrics:
  duration: "5 minutes"
  completed: "2026-03-14"
  tasks_completed: 3
  files_modified: 1
requirements: [SYNC-02]
---

# Phase 27 Plan 01: Cloud-Sync Security & Reliability Hardening Summary

XSS fix, modal button listener deduplication, and preview listener idempotency guard for cloud-sync.js.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix XSS — wrap session.user.email in escHtml() | f189384 | src/ui/cloud-sync.js |
| 2 | Fix listener accumulation — replace addEventListener with .onclick | dc27650 | src/ui/cloud-sync.js |
| 3 | Add _previewListenerBound guard to _bindPreviewListener() | c1c15dd | src/ui/cloud-sync.js |

## What Was Built

Three targeted security and reliability fixes to `src/ui/cloud-sync.js`:

1. **XSS Fix**: Added a local `escHtml` helper at the top of `_renderSignedIn()` and replaced the bare `${session.user.email}` interpolation in the `statusEl.innerHTML` template with `${escHtml(session.user.email)}`. Prevents XSS via crafted email addresses.

2. **Listener Deduplication**: Replaced `addEventListener('click', ...)` calls on `_cloudPushBtn`, `_cloudPullBtn`, and `_cloudSignOutBtn` in `_showSyncMenuModal()` with `.onclick =` assignments. Each modal open now overwrites the handler rather than stacking a new one.

3. **Preview Listener Guard**: Added `_previewListenerBound: false` to the `cloudSyncUI` object literal and a guard at the entry of `_bindPreviewListener()` that returns early if already bound and sets the flag before registering the `window.addEventListener`. Mirrors the existing `_authListenerBound` pattern.

## Verification Results

- 51/51 cloud-sync tests pass (installed missing jsdom dev dependency to enable test run)
- `grep -n 'session.user.email' src/ui/cloud-sync.js` → 1 result, wrapped in escHtml()
- No bare innerHTML interpolation of `session.user.email` found
- No `addEventListener('click'` on `_cloudPushBtn`, `_cloudPullBtn`, or `_cloudSignOutBtn`
- `_previewListenerBound` appears 3 times: declaration, guard check, setter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing dependency] Installed jsdom for test environment**
- **Found during:** Verification (running npx vitest run)
- **Issue:** `jsdom` package was missing from node_modules, causing vitest to fail with ERR_MODULE_NOT_FOUND before any tests ran
- **Fix:** `npm install --save-dev jsdom`
- **Files modified:** package.json, package-lock.json
- **Note:** Pre-existing infrastructure issue, not caused by plan changes

## Self-Check: PASSED

- src/ui/cloud-sync.js: FOUND and modified
- Commit f189384: FOUND (XSS fix)
- Commit dc27650: FOUND (listener fix)
- Commit c1c15dd: FOUND (preview guard)
- All 51 tests passing
