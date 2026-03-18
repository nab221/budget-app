---
phase: 27-critical-bug-fixes
verified: 2026-03-14T23:00:00Z
status: human_needed
score: 14/14 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 13/13
  gaps_closed:
    - "Prior-year heatmap rendering removed from all 4 call sites (dashboard income, dashboard spending, expenses tab, income tab)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open the cloud sync modal 5+ times in succession (click the cloud icon, close, open, repeat). Then click Push to Cloud once."
    expected: "Push handler fires exactly once; browser devtools Network tab shows a single API call."
    why_human: "Cannot drive rapid modal open/close sequences and verify handler invocation count without a live browser with devtools."
  - test: "Open the app in a fresh browser profile with no IndexedDB data. Open DevTools console before loading."
    expected: "No errors logged; integrity check completes silently (no toast since no orphaned records exist on a clean database)."
    why_human: "Runtime startup behaviour requires a live browser environment."
  - test: "Navigate to a previous year on Dashboard, Expenses tab, and Income tab. Observe each heatmap container."
    expected: "Exactly one canvas per heatmap container; no 'Prior Year' label; no second canvas below any heatmap."
    why_human: "Canvas element count and label visibility require a live browser — grep confirms the rendering code is correct but cannot confirm actual DOM output."
---

# Phase 27: Critical Bug Fixes, Cloud-Sync Hardening & Data Integrity Verification Report

**Phase Goal:** Fix XSS in cloud-sync.js, fix modal button listener accumulation, add idempotency guards, fix heatmap year-boundary bug, fix mobile sync-dot layout, create data-integrity.js FK validator, wire integrity checks into startup/post-pull/post-import, add cleanup action buttons to warning toasts, remove prior-year heatmap rendering from all call sites.
**Verified:** 2026-03-14T23:00:00Z
**Status:** human_needed (all automated checks passed)
**Re-verification:** Yes — after plan 27-05 gap closure (previous score 13/13, now 14/14 with prior-year heatmap removal added)

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                     | Status     | Evidence                                                                                                                              |
|----|----------------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------------------------------------|
| 1  | cloud-sync.js does NOT contain unescaped session.user.email in innerHTML                                  | VERIFIED   | Lines 1178, 1262: `${escHtml(email)}` / `${escHtml(session.user.email)}` — local escHtml used                                       |
| 2  | Modal push/pull/sign-out buttons use .onclick = assignment, not addEventListener                           | VERIFIED   | Lines 1201, 1220, 1239: `pushBtnModal.onclick`, `pullBtnModal.onclick`, `signOutBtnModal.onclick`                                     |
| 3  | `_bindAuthListener()` checks `this._authListenerBound` before registering                                 | VERIFIED   | Lines 35, 1362, 1366, 1385: flag declared, checked, and set                                                                          |
| 4  | `_bindPreviewListener()` checks `this._previewListenerBound` before registering                           | VERIFIED   | Lines 1394, 1395: guard and set confirmed                                                                                             |
| 5  | `renderSpendingHeatmap()` in heatmap.js only renders data for the target year via filteredDailyData       | VERIFIED   | heatmap.js line 54: `filteredDailyData` pre-filter; used in scale, cell, and tooltip paths (lines 65, 153, 254, 278)                 |
| 6  | dashboard.js income heatmap block fetches one year and calls renderSpendingHeatmap once — no prior-year   | VERIFIED   | Lines 366-373: single try-block, single `getYearlyDailyIncome(year)`, single `renderSpendingHeatmap` call; no prevYear/hasPrevYearData |
| 7  | dashboard.js spending heatmap block fetches one year and calls renderSpendingHeatmap once — no prior-year | VERIFIED   | Lines 375-382: single try-block, single `getYearlyDailySpending(year)`, single `renderSpendingHeatmap` call; no prevYear/hasPrevYearData |
| 8  | expenses.js renderHeatmap() fetches one year and calls renderSpendingHeatmap once — no prior-year         | VERIFIED   | Line 784: single `renderSpendingHeatmap('expensesTabHeatmapContainer', year, currentYearData)`; no hasPrevYearData found             |
| 9  | transactions.js renderHeatmap() fetches one year and calls renderSpendingHeatmap once — no prior-year     | VERIFIED   | Line 307: single `renderSpendingHeatmap('incomeTabHeatmapContainer', year, currentYearData)`; no hasPrevYearData found               |
| 10 | syncStatusDot does not wrap to new line in mobile header                                                  | VERIFIED   | cloud-sync.js line 320: `flex-shrink:0` inline; css/main.css line 813: class rule confirmed                                          |
| 11 | `src/utils/data-integrity.js` exists and exports `validateDataIntegrity` + `cleanOrphanedRecords`         | VERIFIED   | File 138 lines; 2 `export async function` declarations confirmed                                                                     |
| 12 | `validateDataIntegrity()` runs on app startup (non-blocking) with cleanup toast action                    | VERIFIED   | app.js line 35 import; line 249 fire-and-forget `.then()`; lines 254-257 cleanup action button                                       |
| 13 | `validateDataIntegrity()` runs after cloud pull (non-blocking) with cleanup toast action                  | VERIFIED   | cloud-sync.js line 870: `.then()` in `_executePullSync()` success path; lines 876-878 cleanup action button                          |
| 14 | `validateDataIntegrity()` runs after file import (awaited) with cleanup toast action                      | VERIFIED   | backup.js line 18 import; line 286 `await validateDataIntegrity()`; lines 292-294 cleanup action button                              |

**Score:** 14/14 truths verified

---

## Required Artifacts

| Artifact                             | Expected                                                                        | Status   | Details                                                                                               |
|--------------------------------------|---------------------------------------------------------------------------------|----------|-------------------------------------------------------------------------------------------------------|
| `src/ui/cloud-sync.js`               | XSS fix, .onclick assignment, idempotency guards, flex-shrink:0 sync dot        | VERIFIED | All four fixes confirmed in place                                                                     |
| `src/ui/heatmap.js`                  | Year-filtered rendering via filteredDailyData; allYearsData param optional      | VERIFIED | Lines 46, 54, 65: `allYearsData = null` default; `filteredDailyData` pre-filter confirmed            |
| `src/ui/dashboard.js`                | Single-year income + spending heatmap blocks; no prevYear/hasPrevYearData       | VERIFIED | Lines 366-382: two simplified try-blocks; grep confirms zero prior-year references                    |
| `src/ui/expenses.js`                 | renderHeatmap() single-year only; no hasPrevYearData or "Prior Year"            | VERIFIED | Line 784: single renderSpendingHeatmap call; grep confirms zero prior-year references                 |
| `src/ui/transactions.js`             | renderHeatmap() single-year only; no hasPrevYearData or "Prior Year"            | VERIFIED | Line 307: single renderSpendingHeatmap call; grep confirms zero prior-year references                 |
| `css/main.css`                       | flex-shrink:0 on .sync-status-indicator                                         | VERIFIED | Line 813: class rule confirmed                                                                        |
| `src/utils/data-integrity.js`        | FK validation engine, min 60 lines, both exports                                | VERIFIED | 138 lines, 2 exports, FK_RULES with 7 entries                                                         |
| `src/utils/data-integrity.test.js`   | Unit tests for all 7 FK paths, min 80 lines                                     | VERIFIED | 246 lines, 20 tests, vi.mock of db                                                                    |
| `src/app.js`                         | validateDataIntegrity import + fire-and-forget startup call with cleanup action  | VERIFIED | Line 35 import; line 249 `.then()` call; lines 254-257 cleanup action button                         |
| `src/ui/backup.js`                   | validateDataIntegrity import + await call in handleImport() + cleanup action     | VERIFIED | Line 18 import; line 286 `await validateDataIntegrity()`; lines 292-294 cleanup action button        |

---

## Key Link Verification

| From                     | To                            | Via                                                   | Status   | Details                                                                              |
|--------------------------|-------------------------------|-------------------------------------------------------|----------|--------------------------------------------------------------------------------------|
| `src/ui/cloud-sync.js`   | `_showSyncMenuModal`          | `.onclick =` on modal buttons                         | VERIFIED | Lines 1201, 1220, 1239: assignment pattern confirmed                                  |
| `src/ui/cloud-sync.js`   | `_bindAuthListener`           | `_authListenerBound` guard                            | VERIFIED | Lines 35, 1362, 1366, 1385: flag declared, reset, checked, and set                   |
| `src/ui/cloud-sync.js`   | `_bindPreviewListener`        | `_previewListenerBound` guard                         | VERIFIED | Lines 1394-1395: guard and set confirmed                                              |
| `src/ui/dashboard.js`    | `src/ui/heatmap.js`           | renderSpendingHeatmap called once per heatmap block   | VERIFIED | Lines 370, 379: two single calls; `incomeHeatmapContainer` + `spendingHeatmapContainer` |
| `src/ui/expenses.js`     | `src/ui/heatmap.js`           | renderSpendingHeatmap called once in renderHeatmap()  | VERIFIED | Line 784: single call with `expensesTabHeatmapContainer`                              |
| `src/ui/transactions.js` | `src/ui/heatmap.js`           | renderSpendingHeatmap called once in renderHeatmap()  | VERIFIED | Line 307: single call with `incomeTabHeatmapContainer`                                |
| `src/app.js`             | `src/utils/data-integrity.js` | fire-and-forget `.then()` after render                | VERIFIED | Line 249: `validateDataIntegrity().then(` — no `await` prefix                         |
| `src/ui/cloud-sync.js`   | `src/utils/data-integrity.js` | post-pull trigger in `_executePullSync`               | VERIFIED | Line 870: `validateDataIntegrity().then(`                                             |
| `src/ui/backup.js`       | `src/utils/data-integrity.js` | post-import trigger in `handleImport()`               | VERIFIED | Line 18 import; line 286: `await validateDataIntegrity()` on success path            |
| `notificationUI.warning` | `cleanOrphanedRecords()`      | action button `onClick` in all 3 call sites           | VERIFIED | app.js:256, cloud-sync.js:877, backup.js:293: all pass cleanup action                |

---

## Requirements Coverage

| Requirement  | Source Plan      | Description                                                                                         | Status    | Evidence                                                                                                                     |
|--------------|------------------|-----------------------------------------------------------------------------------------------------|-----------|------------------------------------------------------------------------------------------------------------------------------|
| SYNC-02      | 27-01            | Init guard and listener leak fix — XSS, listener accumulation, missing init guard                   | SATISFIED | escHtml on email at lines 1178 + 1262; .onclick assignment at lines 1201/1220/1239; `_previewListenerBound` guard confirmed  |
| NAV-01       | 27-02            | Tabs always visible                                                                                  | SATISFIED | css/main.css: `.nav-container` is `position: fixed; bottom: 0` at <=768px                                                   |
| NAV-03       | 27-02 + 27-05    | Heatmap year boundary fix — year filter in heatmap.js PLUS prior-year removal from all 4 call sites | SATISFIED | heatmap.js `filteredDailyData` pre-filter confirmed; all 4 call sites show zero prior-year references by grep               |
| MOB-06       | 27-02            | Header layout fix — save dot on same line                                                            | SATISFIED | `flex-shrink:0` in inline style (cloud-sync.js:320) and CSS class (main.css:813)                                             |
| INTEGRITY-01 | 27-03 + 27-04    | FK validator on startup, after cloud pull, after file import; warning toast with cleanup action      | SATISFIED | All 3 trigger points wired; cleanup action button present in all 3 warning toasts; cleanOrphanedRecords called               |

---

## Anti-Patterns Found

No TODO/FIXME/placeholder comments, no stub return patterns, no empty implementations found in any Phase 27 modified files (cloud-sync.js, heatmap.js, dashboard.js, expenses.js, transactions.js, main.css, data-integrity.js, data-integrity.test.js, app.js, backup.js).

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

### 3. Single Heatmap Canvas Per Year on All Tabs

**Test:** Navigate to a previous year (e.g. 2024) on Dashboard tab, Expenses tab, and Income tab. Inspect each heatmap container visually.
**Expected:** Exactly one canvas per heatmap container; no "Prior Year" label below any heatmap; no second canvas stacked below the first.
**Why human:** Canvas element count and label visibility require a live browser — grep confirms the rendering code is correct but cannot confirm actual DOM output.

---

## Re-verification Summary

Plan 27-05 (prior-year heatmap removal) was executed after the previous VERIFICATION.md was written. This re-verification adds 4 new truths (#6-#9, one per heatmap call site) and 3 new artifact entries for dashboard.js, expenses.js, and transactions.js.

**Plan 27-05 — Prior-Year Heatmap Removal (NEW, VERIFIED):**
All 4 heatmap call sites now fetch a single year and call `renderSpendingHeatmap` once per container. Grep confirms zero occurrences of `prevYear`, `hasPrevYearData`, or "Prior Year" string in dashboard.js, expenses.js, and transactions.js. The `allYearsData` parameter remains in heatmap.js as an optional default-null parameter — it is simply never passed by any call site, so heatmap.js always uses `filteredDailyData` for scale calculations.

**NAV-03 now fully satisfied at both levels:**
- Level 1 (heatmap.js, plan 27-02): year-boundary filter via `filteredDailyData` ensures no cross-year data bleeds within a single canvas render
- Level 2 (call sites, plan 27-05): prior-year fetch and second canvas rendering removed entirely from all 4 consumers

**Regression check on all 13 previously-verified truths:** All confirmed intact. No regressions introduced.

---

_Verified: 2026-03-14T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
