---
phase: 40-redesign-income-and-transactions-tab-structure
plan: "06"
subsystem: navigation, ui/expenses, ui/transactions
tags: [gap-closure, tab-cleanup, navigation, expenses, transactions]
dependency_graph:
  requires: [40-04, 40-05]
  provides: [GAP-01-closed, unified-transactions-panel]
  affects: [index.html, src/app.js]
tech_stack:
  added: []
  patterns: [co-render, DOM-guard-early-return, move-controls]
key_files:
  created: []
  modified:
    - index.html
    - src/app.js
decisions:
  - "Expenses tab button removed from nav; Expenses panel removed from DOM entirely"
  - "addExpenseBtn, toggleExpReconBtn, markAllPaidBtn, triggerRecurrenceBtn moved into Transactions panel toolbar"
  - "expSearch, expCategoryFilterContainer, expReconHeader moved as second filter row in Transactions panel"
  - "expensesSummary div added to Transactions panel for expenses.js summary rendering"
  - "expensesUI.render() silently no-ops when #expenseBody absent (existing DOM guard at line 663)"
  - "expensesUI.render() co-called in transactions renderAll() branch to keep event-listeners current"
  - "toggleExpReconBtn included (was in Expenses panel toolbar, not explicitly listed in plan — Rule 2 completeness)"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-03-18"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  tests_before: 715
  tests_after: 715
---

# Phase 40 Plan 06: Remove Expenses Tab — Unified Transactions Panel Summary

GAP-01 closure: Expenses tab and panel removed from nav and DOM; all expense management buttons (Add Expense, Reconciliation Mode, Mark All Paid, Trigger Recurrence) and filters (expSearch, category filter) moved into the Transactions panel toolbar.

## What Was Built

The Expenses tab was a navigation duplicate after Plan 40-04 unified the Transactions tab with merged IN/OUT rows. This plan removes it entirely:

1. **index.html** — Expenses tab button deleted from `#mainTabs`; the full `data-panel="expenses"` block removed. All expense CRUD controls relocated into the Transactions panel: action buttons added to the left toolbar group, search/filter controls added as a second filter row, `#expensesSummary` and `#expReconHeader` retained in-panel.

2. **src/app.js** — `if (panelId === 'expenses')` branch removed from `renderAll()`. The `if (panelId === 'transactions')` block now co-renders `transactionUI.render()` and `expensesUI.render()`. Since `expensesUI.render()` guards on `#expenseBody` (line 663 of expenses.js), it silently returns early—event listeners wired in `init()` still resolve the moved DOM elements correctly.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Move expense toolbar controls to Transactions panel, remove Expenses tab and panel | 372cb6e | index.html |
| 2 | Update app.js routing — remove expenses branch, add to transactions render | b6278e2 | src/app.js |

## Verification Results

1. `npm test -- --run` — 715/715 passed (40 test files)
2. `npm run build` — Vite build succeeded
3. `grep 'data-tab="expenses"' index.html` — no results (PASS)
4. `grep 'data-panel="expenses"' index.html` — no results (PASS)
5. `grep "panelId === 'expenses'" src/app.js` — no results (PASS)
6. `grep "panelId === 'transactions'" src/app.js` — shows expensesUI.render() inside block (PASS)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Control] Included toggleExpReconBtn in moved controls**
- **Found during:** Task 1
- **Issue:** The Expenses panel had a `#toggleExpReconBtn` button that wires reconciliation mode in expenses.js. The plan's move list omitted it explicitly but its removal from the DOM would break expense reconciliation.
- **Fix:** Added `#toggleExpReconBtn` to the Transactions panel toolbar alongside the other moved expense action buttons, labelled "Expense Recon" to distinguish from the income reconciliation button.
- **Files modified:** index.html
- **Commit:** 372cb6e

## Self-Check: PASSED

- `index.html` modified — confirmed present and no `data-panel="expenses"` or `data-tab="expenses"` remaining
- `src/app.js` modified — confirmed `panelId === 'expenses'` branch removed, `panelId === 'transactions'` co-renders expensesUI
- Task commits 372cb6e and b6278e2 exist in git log
- 715 tests pass; build succeeds
