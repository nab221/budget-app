---
phase: 33-income-spending-configuration
plan: 01
subsystem: income-configuration
tags: [income-sources, spending-buckets, banking-calendar, phase34-handoff, settings-ui, tdd]
dependency_graph:
  requires: [31-02]
  provides: [income-event-contract, incomeSources-store, spendingBuckets-store, income-spending-settings-ui]
  affects: [src/app.js, src/db/schema.js, src/db/repository.js, src/utils/income.js, src/ui/income-spending-settings.js]
tech_stack:
  added: [src/utils/income.js, src/ui/income-spending-settings.js, src/db/income-spending.test.js, tests/income.test.js, src/ui/income-spending-settings.test.js]
  patterns: [TDD-RED-GREEN, collection-based-event-contract, Dexie-v21-migration, banking-calendar-dependency]
key_files:
  created:
    - src/utils/income.js
    - src/ui/income-spending-settings.js
    - src/db/income-spending.test.js
    - tests/income.test.js
    - src/ui/income-spending-settings.test.js
  modified:
    - src/db/schema.js
    - src/db/repository.js
    - src/app.js
decisions:
  - "monthlyAmount stored as raw pence integer (not double-converted via toPence); incomeSourceRepository and spendingBucketRepository use empty penceFields array"
  - "All payDateRules apply next-working-day banking-calendar adjustment for adjustedDate; nth-of-month and last-day produce nominal dates that are then adjusted"
  - "getUpcomingIncomeEvents uses merge-sort cursor strategy across N active sources; limit=0 returns [] and undefined limit defaults to 10"
  - "supabase-sync.js generic db.tables.map path confirmed to cover incomeSources and spendingBuckets — no allowlist modification needed"
  - "Schema bumped to v21 (from v20); no upgrade() needed since new tables start empty with seeding handled in repository"
metrics:
  duration_seconds: 950
  completed_date: "2026-03-16"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 3
  new_tests: 73
---

# Phase 33 Plan 01: Income & Spending Configuration Summary

**One-liner:** Row-based income sources and spending buckets in Settings with banking-calendar-aware payday projection and a collection-based Phase 34 handoff contract.

## What Was Built

### Task 1: Phase 33 Stores and Repository (commit 3ea324c)

Added Dexie schema v21 with two new stores:
- `incomeSources` — unbounded row-based income source configuration with `payDateRule`, `payDateDay`, `isActive`, and `displayOrder`
- `spendingBuckets` — estimated-outgoing buckets with `monthlyAmount`, `icon`, and `displayOrder`

Repository additions in `src/db/repository.js`:
- `incomeSourceRepository` — CRUD, `getActive()`, `validateAndAdd()`, `validateAndUpdate()` with `payDateDay` validation enforced for `nth-of-month` rule (integer, range 1–28, null-rejected)
- `spendingBucketRepository` — CRUD, `getAll()` ordered by displayOrder, `seedDefaults()` seeds 7 default buckets once

`src/utils/supabase-sync.js` confirmed unchanged — the existing `db.tables.map(...)` generic path covers all stores automatically.

Anti-cap regression grep: no `primaryIncome`, `secondaryIncome`, `MAX_SOURCES`, or source count cap of 2 found anywhere.

**25 new TDD tests** — all passing.

### Task 2: Income Projection Helpers (commit 56c9dad)

Created `src/utils/income.js` as a pure synchronous helper module:
- `getNextIncomeEvent(source, fromDate)` — returns `{ sourceId, sourceName, amount, nominalDate, adjustedDate }` or `null` for inactive sources
- `getUpcomingIncomeEvents(sources, fromDate, limit)` — merges events across all active sources sorted by `adjustedDate` ascending using a merge-sort cursor strategy

Supported `payDateRule` values:
- `nth-of-month` — nominal date is `YYYY-MM-{payDateDay}`, then banking-calendar adjusted
- `last-day` — nominal date is last calendar day of month, then banking-calendar adjusted
- `last-working-day` — nominal date is last calendar day of month, `nextWorkingDay` adjustment moves to the prior working day

All rules apply `next-working-day` banking-calendar adjustment. The Phase 31 `adjustedPaymentDate` / `nextWorkingDay` functions are the sole source of payday adjustment logic.

**28 new TDD tests** covering rule variants, 3+ source ordering, bank-holiday adjustment, empty state, and Phase 34 handoff shape. No `payDay` property in any event object.

### Task 3: Settings UI (commit c874561)

Created `src/ui/income-spending-settings.js`:
- `incomeSpendingSettings.render()` — renders row-based Income Sources and Spending Buckets tables with projected payday display
- `incomeSpendingSettings.init()` — seeds default spending buckets on app init
- Each income source row shows next nominal payday and banking-calendar-adjusted payday (strikethrough nominal when different)
- Add/Edit/Delete with inline forms; `payDateDay` field shown/hidden by rule selection
- No cap, warning, or disabled button for 3rd or later income source

Wired into `src/app.js`:
- `incomeSpendingSettings.render()` added to settings panel `renderAll` tasks
- `incomeSpendingSettings.init()` added to parallel init block

**20 new tests** covering render, form interactions, empty states, 3+ sources without cap, and CONTAINER_ID contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] monthlyAmount double-conversion via toPence**
- **Found during:** Task 1 GREEN phase
- **Issue:** `createBaseRepository` with `['monthlyAmount']` in penceFields caused amounts to be multiplied by 100 twice (e.g. 20000 stored as 2000000)
- **Fix:** Removed `monthlyAmount` from penceFields on both repositories. Values are stored as raw pence integers matching the schema contract.
- **Files modified:** `src/db/repository.js`
- **Commit:** 3ea324c

**2. [Rule 1 - Bug] nth-of-month adjustedDate not applying banking-calendar adjustment**
- **Found during:** Task 2 GREEN phase (test failure)
- **Issue:** `_adjustmentFor()` returned `'none'` for `nth-of-month` and `last-day` rules, leaving `adjustedDate` equal to `nominalDate` even on bank holidays/weekends
- **Fix:** Updated `_adjustmentFor()` to return `'next-working-day'` for all rules. All income sources now produce a banking-calendar-adjusted payday regardless of rule type.
- **Files modified:** `src/utils/income.js`
- **Commit:** 56c9dad

**3. [Rule 3 - Blocking] Test file used wrong relative path for income.js import**
- **Found during:** Task 2 RED verification
- **Issue:** Test used `../../src/utils/income.js` from `tests/income.test.js` — one `../` too many
- **Fix:** Corrected import paths to `../src/utils/banking-calendar.js` and `../src/utils/income.js`
- **Files modified:** `tests/income.test.js`
- **Commit:** 56c9dad

## Verification

All plan verification criteria confirmed:
- `incomeSources` supports 0, 1, 2, 3+ rows — no cap branch exists
- `getUpcomingIncomeEvents()` returns sorted collection across all active sources
- `payDateDay` validation fails only for invalid `nth-of-month` rules
- Spending buckets seed once (idempotent), remain editable
- No Phase 33 artifact introduces a singular `payDay` property
- 126 db/test suite tests passing; 169 ui test suite tests passing

## Self-Check: PASSED

Files created:
- FOUND: src/utils/income.js
- FOUND: src/ui/income-spending-settings.js
- FOUND: src/db/income-spending.test.js
- FOUND: tests/income.test.js
- FOUND: src/ui/income-spending-settings.test.js

Commits verified:
- 3ea324c: feat(33-01): add incomeSources and spendingBuckets stores and repository
- 56c9dad: feat(33-01): implement getNextIncomeEvent and getUpcomingIncomeEvents helpers
- c874561: feat(33-01): wire Settings UI for income sources and spending buckets
