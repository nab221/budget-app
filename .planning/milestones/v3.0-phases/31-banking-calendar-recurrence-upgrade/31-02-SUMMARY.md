---
phase: 31-banking-calendar-recurrence-upgrade
plan: "02"
subsystem: recurrence-engine
tags:
  - recurrence
  - banking-calendar
  - dexie
  - schema-migration
  - settings-ui
dependency_graph:
  requires:
    - 31-01 (banking-calendar.js with adjustedPaymentDate)
  provides:
    - paymentAdjustment field in recurrentExpenses (v19 schema)
    - predictedPaymentDate adjusted to next-working-day in recurrence engine
    - Refresh bank holidays Settings button
    - Fire-and-forget startup cache refresh
  affects:
    - 32-debt-model-refactor (downstream predictedPaymentDate consumer)
    - 33-income-spending-configuration (downstream)
    - 34-pay-period-affordability-engine (downstream)
tech_stack:
  added: []
  patterns:
    - TDD red-green for recurrence.js paymentAdjustment logic
    - Dexie version() + upgrade() migration pattern
    - Fire-and-forget async IIFE in Promise.all startup chain
    - Repository defaults pattern (recurrentExpenseDefaults)
key_files:
  created: []
  modified:
    - src/utils/recurrence.js
    - src/utils/recurrence.test.js
    - src/db/schema.js
    - src/db/repository.js
    - index.html
    - src/app.js
decisions:
  - advanceNextDate always returns predictedPaymentDate alongside nextDate — callers that previously ignored the field are unaffected (extra property is safe)
  - recurrentExpenseDefaults object used so both the spread and the explicit add() apply the same default, avoiding duplication
  - Button handler wraps refreshBankHolidaysCache in try/finally so button always re-enables even if fetch throws
  - Startup IIFE checks cache staleness (>365 days) before calling refreshBankHolidaysCache — avoids fetching on every startup
metrics:
  duration_seconds: 817
  completed_date: "2026-03-15"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 6
  tests_added: 8
  tests_total: 428
---

# Phase 31 Plan 02: Recurrence Engine + Schema v19 + Settings Wire Summary

Wire adjustedPaymentDate from banking-calendar.js into recurrence.js, bump Dexie to v19 with paymentAdjustment migration, and add "Refresh bank holidays" Settings button with fire-and-forget startup refresh.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend recurrence.js to apply paymentAdjustment (TDD) | 9d26498 | recurrence.js, recurrence.test.js |
| 2 | Schema v19 migration + repository default | 2534a7d | schema.js, repository.js |
| 3 | Settings button + app.js startup wire | fe1d481 | index.html, app.js |

## What Was Built

**recurrence.js** now imports `adjustedPaymentDate` from `banking-calendar.js`. Both `generateInstances` and `advanceNextDate` apply the adjustment:

- `generateInstances`: `instance.date` stays as the nominal scheduling anchor; `instance.predictedPaymentDate` is the banking-adjusted date (or same if `paymentAdjustment` is `'none'` / undefined).
- `advanceNextDate`: returns `{ nextDate, predictedPaymentDate, cycleCurrent }` — the new `predictedPaymentDate` key is additive; existing callers ignoring it are unaffected.

**schema.js v19**: `paymentAdjustment` added to the `recurrentExpenses` index string. The `upgrade()` block sets it to `'none'` for all existing records, ensuring zero data loss on upgrade.

**repository.js**: `recurrentExpenseDefaults` object (`{ isCleared: false, isReconciled: false, paymentAdjustment: 'none' }`) applied to `createBaseRepository` and the explicit `add()` override, so any new record always has the field.

**index.html**: `#refreshBankHolidaysBtn` button added in the Preferences section of Settings with hint text.

**app.js**: Imports `refreshBankHolidaysCache`. Startup IIFE checks `uk_bank_holidays_cache_date` and calls `refreshBankHolidaysCache()` fire-and-forget if stale. Button handler awaits `refreshBankHolidaysCache()` with disabled state and `notificationUI.success` feedback.

## TDD Evidence

RED: 8 tests failing (paymentAdjustment tests against unmodified recurrence.js)
GREEN: All 29 recurrence tests + 428 total tests passing after implementation
No REFACTOR phase needed — implementation was clean on first pass.

## Verification

```
npm test → 428 tests pass (26 test files)
```

Exceeds the plan's 393+ minimum. Includes 26 banking-calendar tests (Plan 01) + 8 new recurrence paymentAdjustment tests.

## Deviations from Plan

**1. [Rule 2 - Enhancement] Button handler wrapped in try/finally**
- Found during: Task 3
- Issue: Plan's button handler code had no error handling — if `refreshBankHolidaysCache()` throws, button would stay disabled forever
- Fix: Added try/catch/finally so `disabled = false` and text reset always runs
- Files modified: src/app.js
- Commit: fe1d481

**2. [Rule 2 - Enhancement] recurrentExpenseDefaults centralised**
- Found during: Task 2
- Issue: Plan suggested checking `data.paymentAdjustment ?? 'none'` inline — this would miss the spread-based `createBaseRepository` path used by internal callers
- Fix: Created `recurrentExpenseDefaults` object used in both `createBaseRepository` call and explicit `add()` override
- Files modified: src/db/repository.js
- Commit: 2534a7d

## Self-Check: PASSED

- [x] src/utils/recurrence.js — modified (import + generateInstances + advanceNextDate)
- [x] src/utils/recurrence.test.js — modified (8 new paymentAdjustment tests)
- [x] src/db/schema.js — modified (version(19) block present)
- [x] src/db/repository.js — modified (recurrentExpenseDefaults)
- [x] index.html — modified (refreshBankHolidaysBtn in Preferences)
- [x] src/app.js — modified (import + startup IIFE + button handler)
- [x] Commits: 9d26498, 2534a7d, fe1d481 — all present in git log
