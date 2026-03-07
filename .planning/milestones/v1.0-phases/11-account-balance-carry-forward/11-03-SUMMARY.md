---
phase: 11-account-balance-carry-forward
plan: "03"
subsystem: balance-carry-forward
tags: [bug-fix, finance, repository, tdd]
dependency_graph:
  requires: [11-02-SUMMARY.md]
  provides: [correct-recurrent-projection, auto-refresh-on-mutation]
  affects: [src/utils/finance.js, src/db/repository.js, src/utils/finance.test.js]
tech_stack:
  added: []
  patterns:
    - "recurrentExpenses.toArray() for all-months standing commitments"
    - "window.dispatchEvent(new CustomEvent('app:refresh')) after DB recalc"
key_files:
  modified:
    - src/utils/finance.js
    - src/db/repository.js
    - src/utils/finance.test.js
decisions:
  - "[11-03] Balance Start Date input keeps type=month (keep-month decision): zero code change, consistent with YYYY-MM schema, label 'Start Month' already matches"
  - "[11-03] Live getRecurrent closure uses .toArray() — mirrors recurrentExpenseRepository.getByMonth; recurrent items are standing commitments that apply every month"
  - "[11-03] app:refresh dispatched inside try block after calculateBalanceChain resolves — only fires on successful recalculation"
metrics:
  duration: "231s"
  completed: "2026-03-01"
  tasks: 3
  files_changed: 3
---

# Phase 11 Plan 03: Gap Closure — Recurrent Projection Fix and Auto-Refresh Summary

**One-liner:** Fixed recurrent expense projection bug (`.toArray()` replaces `startsWith(monthStr)`) and wired `app:refresh` dispatch after balance recalculation.

## What Was Built

Three UAT gaps in the Phase 11 balance carry-forward feature were closed:

**Gap 1 — Balance Start Date Input (Task 1, decision):** User chose `keep-month`. The `input#balanceStartDate` remains `type="month"` (YYYY-MM picker). No code changes were made. The label "Start Month" already matches and the schema stores YYYY-MM strings.

**Gap 2 — Recurrent Projection Fix (Task 2):** The live `getRecurrent` closure in `calculateBalanceChain` used `.where('nextDate').startsWith(monthStr)` which returned an empty array for every projected future month (since `nextDate` only stores the next single occurrence). Fixed by replacing with `.toArray()` so all standing recurrent commitments are deducted in every projected month — consistent with `recurrentExpenseRepository.getByMonth` behavior.

**Gap 3 — Auto-Refresh Dispatch (Task 3):** `triggerBalanceRecalc` recalculated IndexedDB snapshots but never notified the UI. Added `window.dispatchEvent(new CustomEvent('app:refresh'))` inside the `try` block after `calculateBalanceChain` resolves. The `app:refresh` listener in `src/app.js` calls `refreshDashboard()`, so the dashboard balance card and chart now update immediately when income or expense records are mutated.

## Tasks Completed

| Task | Type | Name | Commit | Files |
|------|------|------|--------|-------|
| 1 | checkpoint:decision | Decide Balance Start Date Input Type | — (no code change) | — |
| 2 | auto (tdd) | Fix Recurrent Expense Deduction in Projected Months | 6924f7b | src/utils/finance.js, src/utils/finance.test.js |
| 3 | auto | Dispatch app:refresh After Balance Recalculation | b9e5257 | src/db/repository.js |

## Verification

- Test suite: 93 tests pass (7 test files), 0 failures
- New test: "deducts recurrent expenses in projected months even when nextDate is in the current month" — passes
- Build: `npm run build` completes successfully in 25.61s
- Manual UAT gaps 2 and 3 (recurrent projection, auto-refresh) require browser re-test

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

All committed files verified below.
