---
phase: 27-critical-bug-fixes
verified: 2026-03-14T22:30:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 11/13
  gaps_closed:
    - "validateDataIntegrity() runs after file import (called from backup.js handleImport())"
    - "Warning toast offers to clean up (delete) orphaned records after user confirmation"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open the cloud sync modal 5+ times in succession (click the cloud icon, close, open, repeat). Then click Push to Cloud once."
    expected: "Push handler fires exactly once; browser devtools Network tab shows a single API call."
    why_human: "Cannot drive rapid modal open/close sequences and verify handler invocation count without a live browser with devtools."
  - test: "Open the app in a fresh browser profile with no IndexedDB data. Open DevTools console before loading."
    expected: "No errors logged; integrity check completes silently (no toast since no orphaned records exist on a clean database)."
    why_human: "Runtime startup behaviour requires a live browser environment."
---

# Phase 27: Critical Bug Fixes, Cloud-Sync Hardening & Data Integrity Verification Report

**Phase Goal:** Fix XSS in cloud-sync.js, fix modal button listener accumulation, add idempotency guards, fix heatmap year-boundary bug, fix mobile sync-dot layout, create data-integrity.js FK validator, wire integrity checks into startup/post-pull/post-import, add cleanup action buttons to warning toasts.
**Verified:** 2026-03-14T22:30:00Z
**Status:** human_needed (all automated checks passed)
**Re-verification:** Yes — after gap closure (previous score 11/13, now 13/13)

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                     | Status     | Evidence                                                                                          |
|----|------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------|
| 1  | cloud-sync.js does NOT contain unescaped session.user.email in innerHTML                 | VERIFIED   | Lines 1178, 1262: `${escHtml(email)}` / `${escHtml(session.user.email)}` — local escHtml used   |
| 2  | Modal push/pull/sign-out buttons use .onclick = assignment, not addEventListener          | VERIFIED   | Lines 1201, 1220, 1239: `pushBtnModal.onclick`, `pullBtnModal.onclick`, `signOutBtnModal.onclick` |
| 3  | `_bindAuthListener()` checks `this._authListenerBound` before registering                | VERIFIED   | Lines 35, 1362, 1366, 1385: flag declared, checked, and set                                      |
| 4  | `_bindPreviewListener()` checks `this._previewListenerBound` before registering          | VERIFIED   | Lines 36, 1394, 1395: guard and set confirmed                                                     |
| 5  | `renderSpendingHeatmap()` only renders data for the target year                          | VERIFIED   | heatmap.js line 54: `filteredDailyData` pre-filter; used in scale, cell, and tooltip render paths |
| 6  | syncStatusDot does not wrap to new line in mobile header                                 | VERIFIED   | cloud-sync.js line 320: `flex-shrink:0` inline; css/main.css line 813: class rule confirmed       |
| 7  | `src/utils/data-integrity.js` exists and exports `validateDataIntegrity` + `cleanOrphanedRecords` | VERIFIED | File 138 lines; lines 91 and 115: two `export async function` declarations              |
| 8  | FK_RULES covers all 7 required relationships                                             | VERIFIED   | 7 entries: statements to debts, childcareLedger to childcareAccounts, recurrentExpenses to statements, recurrentExpenses to categories, oneOffExpenses to categories, income to categories, categoryMappings to categories |
| 9  | `validateDataIntegrity()` runs on app startup (non-blocking)                             | VERIFIED   | app.js line 35: import; line 249: fire-and-forget `.then()` — no `await`                         |
| 10 | `validateDataIntegrity()` runs after cloud pull (non-blocking)                           | VERIFIED   | cloud-sync.js line 870: `.then()` inside `_executePullSync()` success path                        |
| 11 | Warning toast with cleanup action shown when integrity issues found (startup + post-pull) | VERIFIED  | app.js lines 251-258 and cloud-sync.js lines 872-880: `notificationUI.warning(...)` with `[{ label: 'Clean up', onClick: ... }]` |
| 12 | `validateDataIntegrity()` runs after file import (called from `handleImport()`)          | VERIFIED   | backup.js line 18: import; line 286: `await validateDataIntegrity()` on success path             |
| 13 | Warning toast offers to clean up orphaned records after user confirmation (file import)  | VERIFIED   | backup.js lines 288-297: `notificationUI.warning(...)` with `[{ label: 'Clean up', onClick: () => cleanOrphanedRecords(importIssues)... }]` |

**Score:** 13/13 truths verified

---

## Required Artifacts

| Artifact                             | Expected                                                                       | Status   | Details                                                                                              |
|--------------------------------------|--------------------------------------------------------------------------------|----------|------------------------------------------------------------------------------------------------------|
| `src/ui/cloud-sync.js`               | XSS fix, .onclick assignment, idempotency guards                               | VERIFIED | All three Plan 01 fixes confirmed in place                                                           |
| `src/ui/heatmap.js`                  | Year-filtered rendering via filteredDailyData                                  | VERIFIED | 5 occurrences of filteredDailyData (declaration + scale + cell + 2 tooltips)                         |
| `css/main.css`                       | flex-shrink:0 on .sync-status-indicator                                        | VERIFIED | Line 813: class rule confirmed                                                                       |
| `src/utils/data-integrity.js`        | FK validation engine, min 60 lines, both exports                               | VERIFIED | 138 lines, 2 exports, FK_RULES with 7 entries                                                        |
| `src/utils/data-integrity.test.js`   | Unit tests for all 7 FK paths, min 80 lines                                    | VERIFIED | 246 lines, 20 tests, vi.mock of db                                                                   |
| `src/app.js`                         | validateDataIntegrity import + fire-and-forget startup call with cleanup action | VERIFIED | Line 35 import; line 249 `.then()` call; lines 254-257 cleanup action button                        |
| `src/ui/cloud-sync.js` (post-pull)   | validateDataIntegrity call + cleanup action in post-pull path                  | VERIFIED | Line 870 fire-and-forget; lines 876-878 cleanup action button                                        |
| `src/ui/backup.js`                   | validateDataIntegrity import + call in handleImport() + cleanup action         | VERIFIED | Line 18 import; line 286 `await validateDataIntegrity()`; lines 292-294 cleanup action button       |

---

## Key Link Verification

| From                     | To                            | Via                                      | Status   | Details                                                                     |
|--------------------------|-------------------------------|------------------------------------------|----------|-----------------------------------------------------------------------------|
| `src/ui/cloud-sync.js`   | `_showSyncMenuModal`          | `.onclick =` on modal buttons            | VERIFIED | Lines 1201, 1220, 1239: assignment pattern confirmed                         |
| `src/ui/cloud-sync.js`   | `_bindPreviewListener`        | `_previewListenerBound` guard            | VERIFIED | Lines 1394-1395: guard and set confirmed                                     |
| `src/ui/dashboard.js`    | `src/ui/heatmap.js`           | `renderSpendingHeatmap()` with year data | VERIFIED | dashboard.js passes year-scoped data; heatmap.js pre-filters additionally    |
| `src/app.js`             | `src/utils/data-integrity.js` | fire-and-forget `.then()` after render   | VERIFIED | Line 249: `validateDataIntegrity().then(` — no `await` prefix                |
| `src/ui/cloud-sync.js`   | `src/utils/data-integrity.js` | post-pull trigger in `_executePullSync`  | VERIFIED | Line 870: `validateDataIntegrity().then(`                                    |
| `src/ui/backup.js`       | `src/utils/data-integrity.js` | post-import trigger in `handleImport()`  | VERIFIED | Line 18: import; line 286: `await validateDataIntegrity()` on success path  |
| `notificationUI.warning` | `cleanOrphanedRecords()`      | action button `onClick` in all 3 sites   | VERIFIED | app.js:256, cloud-sync.js:877, backup.js:293: all pass cleanup action       |

---

## Requirements Coverage

| Requirement  | Source Plan  | Description                                                                                  | Status    | Evidence                                                                                                          |
|--------------|--------------|----------------------------------------------------------------------------------------------|-----------|-------------------------------------------------------------------------------------------------------------------|
| SYNC-02      | 27-01        | Init guard & listener leak fix (XSS, listener accumulation, missing init guard)             | SATISFIED | escHtml on email, .onclick assignment on modal buttons, `_previewListenerBound` guard confirmed                    |
| NAV-01       | 27-02        | Tabs always visible                                                                           | SATISFIED | css/main.css: `.nav-container` is `position: fixed; bottom: 0` at <=768px                                        |
| NAV-03       | 27-02        | Heatmap year boundary fix                                                                     | SATISFIED | heatmap.js `filteredDailyData` pre-filter confirmed at lines 54, 65, 153, 254, 278                                |
| MOB-06       | 27-02        | Header layout fix — save dot on same line                                                     | SATISFIED | `flex-shrink:0` in inline style (cloud-sync.js:320) and CSS class (main.css:813)                                  |
| INTEGRITY-01 | 27-03/27-04  | FK validator run on startup, after cloud pull, after file import; warning toast with cleanup  | SATISFIED | All 3 trigger points wired; cleanup action button present in all 3 warning toasts; cleanOrphanedRecords called    |

---

## Anti-Patterns Found

No TODO/FIXME/placeholder comments, no stub return patterns, no empty implementations found in any Phase 27 modified files. Previously flagged `actions: []` gaps are resolved.

---

## Human Verification Required

### 1. Listener Accumulation Fix

**Test:** Open the cloud sync modal 5+ times in succession (click the cloud icon, close, open, repeat). Then click "Push to Cloud" once.
**Expected:** Push handler fires exactly once; browser devtools Network tab shows a single API call.
**Why human:** Cannot drive rapid modal open/close sequences and verify handler invocation count without a live browser with devtools.

### 2. No Console Errors on App Load

**Test:** Open the app in a fresh browser profile with no IndexedDB data. Open DevTools console before loading.
**Expected:** No errors logged; integrity check completes silently (no toast since no orphaned records exist on a clean database).
**Why human:** Runtime startup behaviour requires a live browser environment.

---

## Re-verification Summary

Both previously-failing gaps are now closed.

**Gap 1 — File Import Wiring (CLOSED):**
`backup.js` now imports `validateDataIntegrity` and `cleanOrphanedRecords` at line 18. Inside `handleImport()` at line 286, the success path `await`s `validateDataIntegrity()` and calls `notificationUI.warning(...)` with a populated cleanup action array when `valid === false`. This satisfies the ROADMAP and INTEGRITY-01 requirement for the third trigger point.

**Gap 2 — Cleanup Offer (CLOSED):**
All three `notificationUI.warning()` call sites (`app.js`, `cloud-sync.js`, `backup.js`) now pass a non-empty `actions` array containing `{ label: 'Clean up', onClick: () => cleanOrphanedRecords(...).then(...) }`. The ROADMAP acceptance criterion "offer to clean up (delete) orphaned records after user confirmation" is satisfied.

**Regression check:** All 11 previously-verified items were spot-checked and remain intact. No regressions introduced.

---

_Verified: 2026-03-14T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
