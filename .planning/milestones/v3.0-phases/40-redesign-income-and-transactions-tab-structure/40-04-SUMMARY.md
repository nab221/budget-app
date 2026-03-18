---
phase: 40-redesign-income-and-transactions-tab-structure
plan: "04"
subsystem: transactions-ui
tags: [gap-closure, swipe-crud, income-navigation, jsdom, tdd]
dependency_graph:
  requires: ["40-02"]
  provides: ["GAP-02-closure", "GAP-03-closure"]
  affects: ["src/ui/transactions.js", "tests/transactions-merged.test.js"]
tech_stack:
  added: []
  patterns: ["jsdom table structure for swipe row tests", "btn-edit presence as debt-row sentinel"]
key_files:
  modified:
    - path: src/ui/transactions.js
      role: Fixed _initSwipe() debt-row detection guard and income row onclick navigation
    - path: tests/transactions-merged.test.js
      role: Added Group D (4 tests) covering expense swipe CRUD and income tap navigation
decisions:
  - "Used !row.querySelector('.btn-edit') as debt-row sentinel (correct) vs old querySelector('[data-tab=debts]') (incorrect — data-tab is on onclick attr string, not a DOM child)"
  - "Tests wrapped rows in <table><tbody> because jsdom drops <tr> elements placed directly inside a <div>"
metrics:
  duration_seconds: 3356
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 2
---

# Phase 40 Plan 04: Expense Swipe CRUD and Income Row Tap Navigation Summary

Fixed two GAP items in the Transactions tab: expense swipe-to-edit/delete now correctly reaches `window.expensesUI?.editExpense` / `window.deleteExpense` (GAP-02), and tapping a closed income row now navigates to the Income tab via `[data-tab="income-sources"]` click (GAP-03).

## What Was Built

**Fix 1 — Debt row detection (GAP-02 prerequisite):**
The original guard `row.querySelector('[data-tab="debts"]')` was checking for a DOM child element with `data-tab="debts"`, but that attribute only appears as part of an `onclick` string — not as a real DOM attribute. This caused ALL expense rows to be treated as debt rows and return early, skipping swipe setup entirely.

Replaced with: `const isDebtRow = rowType === 'expense' && !row.querySelector('.btn-edit');` — debt-linked expense rows have no `.btn-edit` button rendered, so this correctly distinguishes them from normal expense rows.

**Fix 2 — Income row tap navigation (GAP-03):**
The existing income row `onclick` handler only closed the open swipe row. Updated handler now:
- If row is the `currentOpenRow` and click is not on an action div: close and return (no navigation)
- If row is NOT open and click is not on `.btn-edit`, `.btn-delete`, or checkbox: navigate to `[data-tab="income-sources"]`

**Group D tests (4 new tests):**
- D-1: swipe-right on non-debt expense row calls `window.expensesUI.editExpense(id, type)`
- D-2: swipe-left on non-debt expense row calls `window.deleteExpense(id, type)`
- D-3: tapping closed income row navigates to income-sources tab
- D-4: tapping open income row closes without navigating

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test HTML used bare `<tr>` inside `<div>` which jsdom drops**
- **Found during:** Task 2 test run (4 Group D tests failed)
- **Issue:** jsdom's HTML parser strips `<tr>` elements placed directly inside `<div>` containers — the test used `body.innerHTML = '<tr ...>'` where `body` is a `<div id="incBody">`. The `.swipe-row` class on the stripped `<tr>` was invisible to `querySelectorAll`, so no event listeners were attached and clicks went nowhere.
- **Fix:** Wrapped test rows in `<table><tbody>...</tbody></table>` and passed the `<tbody>` element to `_initSwipe()` rather than the outer `<div>`.
- **Files modified:** tests/transactions-merged.test.js
- **Commit:** 676af7e

## Verification Results

- Full test suite: 707 passed, 4 pre-existing failures (income-sources.test.js timeouts, dashboard.affordability.test.js timeout — unrelated to this plan)
- transactions-merged.test.js: 18/18 passed (Groups A, B, C, D all GREEN)
- Build: succeeded in 21.85s

## Self-Check

- [x] `src/ui/transactions.js` modified — confirmed
- [x] `tests/transactions-merged.test.js` modified — confirmed
- [x] Commit 574cb81 — Task 1 code fix
- [x] Commit 676af7e — Task 2 tests

## Self-Check: PASSED
