---
phase: 34-pay-period-affordability-engine
plan: 01
subsystem: affordability-dashboard
tags: [pay-period, affordability, income-events, safety-buffer, dashboard, tdd, supabase-sync, schema-v22]
dependency_graph:
  requires: [33-01]
  provides: [pay-period-affordability-ui, userPreferences-store, pay-period-helpers, TECH-06-verification]
  affects: [src/db/schema.js, src/db/repository.js, src/utils/pay-period.js, src/ui/dashboard.js, src/utils/supabase-sync.test.js]
tech_stack:
  added: [src/utils/pay-period.js, src/utils/pay-period.test.js, src/ui/dashboard.affordability.test.js]
  patterns: [TDD-RED-GREEN, pure-helper-module, collection-based-bounds, pence-arithmetic, generic-db-tables-snapshot]
key_files:
  created:
    - src/utils/pay-period.js
    - src/utils/pay-period.test.js
    - src/ui/dashboard.affordability.test.js
  modified:
    - src/db/schema.js
    - src/db/repository.js
    - src/ui/dashboard.js
    - src/utils/supabase-sync.test.js
decisions:
  - "Schema bumped to v22 with userPreferences key-value table (&key primary key); safetyBuffer persisted as pence integer with default 20000 (£200)"
  - "getPayPeriodBounds defensively finds minimum adjustedDate across events regardless of input sort order, even though Phase 33 guarantees sorted output"
  - "Navigator state _payPeriodOffset is module-scoped in dashboard.js; forward navigation re-calls getUpcomingIncomeEvents with advancing cursor rather than slicing a pre-fetched list"
  - "calculateAmortisationSchedule wrapped in try/catch in dashboard: amortisation error shows full payment without interest split (non-breaking degradation)"
  - "TECH-06 satisfied via existing generic db.tables.map() path in supabase-sync.js; no allowlist changes needed; two targeted regression tests added to supabase-sync.test.js"
  - "saveBalanceSnapshot writes to existing dailyBalanceSnapshots path; no new balance snapshot table introduced"
  - "isDeficit defined as closingBalance <= 0 (zero balance is deficit); isBelowBuffer only set when closingBalance > 0 and < safetyBuffer"
metrics:
  duration_seconds: 1169
  completed_date: "2026-03-16"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 4
  new_tests: 44
---

# Phase 34 Plan 01: Pay-Period Affordability Engine Summary

**One-liner:** Pay-period affordability view in Dashboard with income-event-boundary navigation, running-balance timeline, deficit/buffer warnings, interest-split debt rows, and generic cloud-sync coverage via schema v22 userPreferences store.

## What Was Built

### Task 1: Affordability Persistence and Pay-Period Helper Module (commit d8accb1)

Added Dexie schema v22 with `userPreferences` key-value table (`&key, value`):
- Sole initial use: `safetyBuffer` preference (integer pence, default £200 = 20000 pence)
- Covered by existing generic `db.tables.map()` snapshot path — no allowlist changes needed

Repository additions in `src/db/repository.js`:
- `userPreferencesRepository` — generic `get(key, default)` / `set(key, value)` key-value CRUD
- `getSafetyBuffer()` — returns persisted value or 20000 default
- `setSafetyBuffer(amountPence)` — persists new value
- `getLatestDailySnapshot()` — returns most recent daily balance snapshot (opening balance for pay period)
- `saveBalanceSnapshot(date, balancePence)` — upserts into existing `dailyBalanceSnapshots` path

Pure helper module `src/utils/pay-period.js`:
- `getPayPeriodBounds(incomeEvents, referenceDate)` — finds earliest income event on/after referenceDate; returns `{ start, end, nextIncomeEvent }` or null
- `getBillsInPayPeriod(allRecurring, allOneOff, spendingBuckets, start, end, bankingCalendar)` — extracts recurring (nextDate/date), one-off (date), and prorated bucket rows within inclusive bounds; applies `next-working-day` adjustment; marks `isAdjusted`; passes through `debtId` for loan/mortgage rows; sorts by date ascending
- `calculatePayPeriodSummary(openingBalance, bills, safetyBuffer)` — pure running-balance computation; returns `{ rows, closingBalance, isDeficit, isBelowBuffer }`; `isDeficit` = closingBalance <= 0; `isBelowBuffer` = closingBalance > 0 && < safetyBuffer

**31 TDD tests** covering all 6 behavior points from the plan: bounds selection, no-income null return, inclusion/exclusion rules, adjustment marking, sort order, and deficit/buffer thresholds.

[Rule 1 - Bug] `getPayPeriodBounds` initially used `Array.find()` which returns the first matching element rather than the minimum. Fixed to iterate all events and pick the minimum adjustedDate. This ensures correct behavior even if the input array is not sorted (though Phase 33 guarantees sorted output).

### Task 2: Dashboard Pay-Period Affordability Section (commit 9bc5cde)

Extended `src/ui/dashboard.js`:
- Added imports: `incomeSourceRepository`, `spendingBucketRepository`, `recurrentExpenseRepository`, `oneOffExpenseRepository`, `getSafetyBuffer`, `setSafetyBuffer`, `getLatestDailySnapshot`, `saveBalanceSnapshot`, `getUpcomingIncomeEvents`, `getPayPeriodBounds`, `getBillsInPayPeriod`, `calculatePayPeriodSummary`, `calculateAmortisationSchedule`
- Added `_payPeriodOffset` module-scoped state variable for navigator
- Added `renderPayPeriodSection()` — full async render function called at the end of `renderDashboard()`:
  - Fetches active income sources, all recurring/one-off expenses, spending buckets, safety buffer, latest snapshot, debts
  - Calls `getUpcomingIncomeEvents` → `getPayPeriodBounds` for income-event-boundary window
  - Shows "no income sources" / "no events found" message when bounds = null
  - Renders period window label with Prev/Next navigator buttons
  - Shows opening balance row (sourced from latest dailyBalanceSnapshot)
  - Enriches loan/mortgage bill rows with amortisation split (`calculateAmortisationSchedule`)
  - Renders full timeline table with date, bill name, amount, running balance; isAdjusted asterisk footnote
  - Shows deficit (red) or below-buffer (amber) banner
  - Shows projected closing balance at next income boundary
  - Shows max extra payment = max(0, closingBalance - safetyBuffer)
- Added `openPayPeriodBalanceModal()` — balance + snapshot date + safety buffer entry modal; writes via `saveBalanceSnapshot` and `setSafetyBuffer`

**11 integration tests** in `src/ui/dashboard.affordability.test.js` covering:
- Section renders without throwing (no income sources, no snapshot)
- `payPeriodSection` container created in DOM
- "No income" message shown when bounds = null
- Timeline table shown when bounds and bills exist
- Deficit banner rendered when isDeficit
- Safety-buffer banner rendered when isBelowBuffer
- Max extra payment line shown
- Balance-entry button present
- Bounds always derived from income-event collection (Array), never singular payDay — regression test

### Task 3: Navigator Behavior and TECH-06 Verification (commit e4e18da)

Navigator behavior (prev/next by income-event boundaries):
- `_payPeriodOffset` drives navigation; 0 = current pay period; prev disables at offset=0
- Forward navigation re-calls `getUpcomingIncomeEvents` with an advancing cursor, advancing through income-event boundaries one step per click
- Backward navigation decrements offset (clamped to 0)
- Existing `_selectedMonth`/`_selectedView` dashboard state and month navigator remain completely unchanged

app.js wiring:
- No changes required — `renderPayPeriodSection()` is called from `renderDashboard()`, which is already in the `renderTasks` array for the dashboard panel

TECH-06 verification (supabase-sync.test.js additions):
- Added `describe('TECH-06: ...)` block with 2 tests using `vi.doMock` to simulate schema v22 `db.tables` array including `userPreferences`, `incomeSources`, and `spendingBuckets`
- Confirms `userPreferences` with `{ key: 'safetyBuffer', value: 20000 }` appears in the snapshot payload
- Confirms `incomeSources` and `spendingBuckets` (Phase 33) also covered by same path — regression guard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] getPayPeriodBounds used Array.find() instead of minimum-value search**
- **Found during:** Task 1 GREEN phase (test failure — "selects the earliest event when multiple events exist")
- **Issue:** `Array.find()` returns the first element satisfying the predicate (index order), not the minimum. Test had events in non-sorted order with earliest event at index 1. Real Phase 33 output is sorted, but defensive minimum search is correct.
- **Fix:** Changed `incomeEvents.find(ev => ev.adjustedDate >= refStr)` to an explicit loop picking minimum adjustedDate
- **Files modified:** `src/utils/pay-period.js`
- **Commit:** d8accb1

**2. [Rule 1 - Bug] Test timeout in full suite for "renders without throwing" test**
- **Found during:** Task 2 full-suite run — test passed in isolation (~3.5s) but timed out in full suite context (5s default)
- **Fix:** Added explicit 15000ms timeout to that specific test
- **Files modified:** `src/ui/dashboard.affordability.test.js`
- **Commit:** 9bc5cde

## Verification

All plan verification criteria confirmed:
- 31 pay-period helper tests pass: bounds, inclusion, deficit/buffer
- 11 dashboard affordability integration tests pass: section rendering, banners, collection-driven bounds
- 2 TECH-06 supabase-sync tests pass: userPreferences in snapshot, Phase 33 stores in snapshot
- Full test suite: 570 tests across 31 test files, all passing

Key regression guards:
- `getPayPeriodBounds` always called with an Array (income-event collection) — verified by `pay-period-bounds-are-always-derived` test
- Existing `_selectedMonth`/`_selectedView` behavior unbroken — verified by "does not break existing behavior" test
- `db.tables.map()` generic path covers `userPreferences` — verified by TECH-06 describe block

## Self-Check: PASSED

Files created:
- FOUND: src/utils/pay-period.js
- FOUND: src/utils/pay-period.test.js
- FOUND: src/ui/dashboard.affordability.test.js

Commits verified:
- d8accb1: feat(34-01): add affordability persistence and pay-period helper module with tests
- 9bc5cde: feat(34-01): render pay-period affordability section in Dashboard with timeline, warnings, and balance-entry modal
- e4e18da: feat(34-01): add pay-period navigator behavior and verify TECH-06 cloud sync coverage
