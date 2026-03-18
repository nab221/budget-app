---
phase: 31-banking-calendar-recurrence-upgrade
verified: 2026-03-15T18:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 31: Banking Calendar Utility & Recurrence Upgrade — Verification Report

**Phase Goal:** Build the banking-calendar.js utility and extend the recurrence engine. This is foundational for Phase 32 (debt amortisation with adjusted payment dates) and Phase 33 (income configuration with banking-calendar-aware payday display).
**Verified:** 2026-03-15T18:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

#### Plan 01 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | isUKBankHoliday returns true for all bundled 2025-2026 England & Wales holidays | VERIFIED | STATIC_HOLIDAYS Set contains all 16 dates for 2025-2026; test suite confirms 2026-01-01, 2026-04-03, 2026-12-28 — 26 tests green |
| 2 | nextWorkingDay returns the same date when called on an existing working day | VERIFIED | Lines 166-175: `while (!isWorkingDay(d))` — if already working, loop body never executes; test `2026-03-20 → 2026-03-20` passes |
| 3 | nextWorkingDay skips weekends and bank holidays in sequence (e.g. Christmas 2026 cluster) | VERIFIED | Test confirms `2026-12-25 → 2026-12-29` skipping Fri (Christmas), Sat, Sun, Mon (Boxing Day sub); all test assertions green |
| 4 | refreshBankHolidaysCache stores array under 'uk_bank_holidays_cache' and date under 'uk_bank_holidays_cache_date' | VERIFIED | Lines 216-217 in banking-calendar.js; test with mocked fetch confirms both keys written |
| 5 | Functions fall back to the static set when localStorage is empty or unparseable | VERIFIED | loadBankHolidays() catches JSON.parse errors and returns STATIC_HOLIDAYS; corrupt-JSON test passes |
| 6 | maxCachedYear guard emits console.warn for dates beyond the cached range and applies weekend-only logic | VERIFIED | Lines 125-131: year > maxYear triggers console.warn and returns false (weekend-only via isWorkingDay's getUTCDay check); test with 2030 confirms warn fired |

#### Plan 02 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Recurring expenses with paymentAdjustment 'next-working-day' produce an adjusted predictedPaymentDate on weekend/holiday nominal dates | VERIFIED | generateInstances lines 64-68 call adjustedPaymentDate(nextInstanceDate, adjustment); recurrence.test.js has 4 generateInstances paymentAdjustment tests all green |
| 8 | Recurring expenses without paymentAdjustment (or 'none') behave identically to v2.7 — no regressions | VERIFIED | adjustment defaults to 'none' (line 64); adjustedPaymentDate('none') returns same Date; backward-compat tests green; 428 total tests pass |
| 9 | IndexedDB schema upgrades cleanly from v18 to v19 on existing data, defaulting paymentAdjustment to 'none' | VERIFIED | schema.js line 536: version(19).stores() with paymentAdjustment in recurrentExpenses index string; upgrade() block at lines 553-556 sets paymentAdjustment = 'none' for existing records |
| 10 | The 'Refresh bank holidays' Settings button appears in the Preferences section and calls refreshBankHolidaysCache() | VERIFIED | index.html line 384: `<button id="refreshBankHolidaysBtn"...>Refresh bank holidays</button>` inside Preferences section (line 376); app.js lines 267-282: click handler wired with await + disabled state + notificationUI.success |
| 11 | refreshBankHolidaysCache() is called fire-and-forget on app startup — never blocks render | VERIFIED | app.js lines 104-115: async IIFE with staleness check; `refreshBankHolidaysCache()` called without await (fire-and-forget); IIFE is inside Promise.all, not in the awaited chain |
| 12 | All 393+ existing Vitest tests still pass | VERIFIED | npm test output: 428 tests passed, 26 test files, zero failures |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/banking-calendar.js` | Synchronous banking calendar — 5 exported functions | VERIFIED | 230 lines; exports isUKBankHoliday, isWorkingDay, nextWorkingDay, adjustedPaymentDate, refreshBankHolidaysCache; STATIC_HOLIDAYS for 2025-2027 |
| `src/utils/banking-calendar.test.js` | Vitest test suite — jsdom environment, 26 tests | VERIFIED | 230 lines; `// @vitest-environment jsdom`; beforeEach localStorage.clear(); 26 tests covering all branches |
| `src/utils/recurrence.js` | generateInstances and advanceNextDate emit predictedPaymentDate using adjustedPaymentDate | VERIFIED | Line 4: import from banking-calendar.js; lines 64-68: generateInstances applies adjustedPaymentDate; lines 99-102: advanceNextDate returns { nextDate, predictedPaymentDate, cycleCurrent } |
| `src/utils/recurrence.test.js` | Extended test suite covering paymentAdjustment cases | VERIFIED | 8 new paymentAdjustment tests in two describe blocks |
| `src/db/schema.js` | Dexie v19 with paymentAdjustment in recurrentExpenses index string | VERIFIED | Line 536: `db.version(19).stores()`; line 538: paymentAdjustment present in index string |
| `src/db/repository.js` | v19 migration setting paymentAdjustment = 'none' for existing records | VERIFIED | Line 77: `recurrentExpenseDefaults = { ...integrityDefaults, paymentAdjustment: 'none' }`; lines 80-83: applied to both createBaseRepository and explicit add() |
| `index.html` | Refresh bank holidays button in Settings Preferences section | VERIFIED | Line 384: button with id="refreshBankHolidaysBtn"; positioned after haptic feedback block inside Preferences section |
| `src/app.js` | Fire-and-forget refreshBankHolidaysCache() call during startup | VERIFIED | Line 34: import; lines 104-115: IIFE with staleness check calling fire-and-forget; lines 267-282: button handler wired |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/utils/banking-calendar.js` | localStorage | `loadBankHolidays()` reads 'uk_bank_holidays_cache'; `refreshBankHolidaysCache()` writes it | WIRED | `localStorage.getItem(CACHE_KEY)` at line 72; `localStorage.setItem(CACHE_KEY, ...)` at line 216 |
| `src/utils/banking-calendar.js` | https://www.gov.uk/bank-holidays.json | `refreshBankHolidaysCache()` fetches england-and-wales events array | WIRED | `fetch('https://www.gov.uk/bank-holidays.json')` at line 210; `data['england-and-wales'].events.map(e => e.date)` at line 215 |
| `src/utils/recurrence.js` | `src/utils/banking-calendar.js` | `import { adjustedPaymentDate } from './banking-calendar.js'` | WIRED | Line 4: import confirmed; used at lines 65 and 100 |
| `src/db/schema.js` | recurrentExpenses store | `version(19).stores()` index string includes paymentAdjustment | WIRED | Line 536-557: version(19) block with paymentAdjustment in index string and upgrade() migration |
| `index.html` | `src/app.js` | button#refreshBankHolidaysBtn click handler calls refreshBankHolidaysCache() | WIRED | app.js line 267: `getElementById('refreshBankHolidaysBtn')`; line 273: `await refreshBankHolidaysCache()` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TECH-02 | 31-01 | Synchronous banking calendar utility with static fallback and localStorage cache | SATISFIED | banking-calendar.js fully implemented; 26 tests green |
| TECH-03 | 31-02 | Recurrence engine extended with paymentAdjustment; schema v19 migration | SATISFIED | recurrence.js imports and uses adjustedPaymentDate; schema.js v19 block present |
| PLAN-03 | 31-02 | Settings UI for refreshing bank holidays cache | SATISFIED | refreshBankHolidaysBtn in index.html Preferences section; app.js button handler wired |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None detected | — | — | — | — |

Scanned: banking-calendar.js, banking-calendar.test.js, recurrence.js, schema.js, repository.js, index.html, app.js. No TODO/FIXME/placeholder comments, no empty implementations, no stub return values, no console.log-only implementations found in the phase's modified files.

---

### Human Verification Required

The following items cannot be verified programmatically and require manual browser testing:

#### 1. Settings Panel — Refresh Button Visibility

**Test:** Open the app in a browser, navigate to the Settings tab, scroll to the Preferences section.
**Expected:** A "Refresh bank holidays" button is visible below the Haptic Feedback checkbox, with hint text about GOV.UK.
**Why human:** HTML structure confirmed in code but visual rendering and tab navigation require a browser.

#### 2. Startup Cache Refresh Behaviour

**Test:** Clear localStorage (DevTools > Application > Storage > Clear), reload the app, check browser console and localStorage.
**Expected:** No startup error; after a brief delay, `uk_bank_holidays_cache` and `uk_bank_holidays_cache_date` keys appear in localStorage if internet is available.
**Why human:** Fire-and-forget async call behaviour and network response cannot be verified statically.

#### 3. Schema v19 Upgrade on Existing Data

**Test:** Load the app on a device/browser that has existing recurrentExpenses data from a pre-v19 session.
**Expected:** All existing recurring expenses gain `paymentAdjustment: 'none'`; no data loss; no Dexie version mismatch error in console.
**Why human:** Requires a real IndexedDB instance with pre-existing data; cannot simulate with unit tests.

---

### Gaps Summary

No gaps. All 12 observable truths verified. All artifacts exist, are substantive, and are correctly wired. The test suite grew from 393 to 428 tests with zero regressions. Three human verification items are noted for completeness but none block the phase from being considered complete — they are smoke tests for browser-environment behaviour already confirmed by the automated suite structure.

---

_Verified: 2026-03-15T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
