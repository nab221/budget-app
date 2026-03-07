---
phase: 08-income-expenses-refinement
plan: 01
subsystem: expenses-ui
tags: [dexie, schema-migration, ui-consolidation, recurrent, one-off]
dependency_graph:
  requires: []
  provides: [recurrentExpenses-table, oneOffExpenses-table, expensesUI, recurrentExpenseRepository, oneOffExpenseRepository]
  affects: [dashboard, pdf-import, templates, transactions]
tech_stack:
  added: []
  patterns: [sub-tab navigation, essential/non-essential grouping, cycle tracking, bulk payment action]
key_files:
  created:
    - src/ui/expenses.js
  modified:
    - src/db/schema.js
    - src/db/repository.js
    - index.html
    - src/app.js
    - src/ui/transactions.js
    - src/ui/dashboard.js
    - src/ui/pdf-import.js
    - src/ui/templates.js
decisions:
  - "recurrentExpenses.getByMonth returns all items (not filtered by nextDate) since they are standing commitments; caller filters as needed"
  - "fixedSpendRepository and variableSpendRepository kept as no-op stubs to avoid module-load errors from any remaining references"
  - "subscriptions table dropped in v5 schema; subscriptionUI removed from app.js init and tab handlers"
  - "Dashboard Subscriptions card removed; Fixed/Variable renamed to Recurrent/One-off"
  - "PDF import maps 'fixed' category group to recurrentExpenses (essential=true, monthly) and 'variable' to oneOffExpenses"
metrics:
  duration: "466 seconds (~8 min)"
  completed: "2026-03-01"
  tasks: 3
  files: 9
---

# Phase 8 Plan 1: Consolidated Expenses UI and Schema Migration Summary

**One-liner:** Dexie v5 schema replacing fixed/variable/subscriptions with recurrentExpenses and oneOffExpenses, backed by a unified Expenses tab with Essential/Non-essential grouping and cycle-tracking payment progress.

## What Was Built

### Task 1: Dexie Schema Version 5 & Repository Migration (commit 1691a70)

- Added `db.version(5)` to `src/db/schema.js` introducing:
  - `recurrentExpenses`: replaces fixedSpends and subscriptions — supports frequency, nextDate, isEssential, cycleTotal, cycleCurrent, endDate fields
  - `oneOffExpenses`: replaces variableSpends — simple date/category/note/amount record
- Deprecated `fixedSpends`, `variableSpends`, `subscriptions` tables by omitting them from v5 stores
- Created `recurrentExpenseRepository` with `getByMonth()` and `markAllAsPaid()` (uses Dexie transaction for bulk updates)
- Created `oneOffExpenseRepository` with `getByMonth()`
- Updated `categoryRepository.isCategoryInUse()` to check new tables
- Updated `getSpendingTrends()` and `getDashboardData()` to aggregate from new tables
- Updated `findDuplicates()` to search new tables
- Stubbed `fixedSpendRepository`/`variableSpendRepository` as no-ops to prevent import errors

### Task 2: Unified Expenses UI (commit 2ad9c5d)

- Created `src/ui/expenses.js` with `expensesUI` object:
  - Sub-tab navigation (Recurrent / One-off) with form/list panel toggling
  - Recurrent form: date, category, description, amount, frequency, nextDate, cycleTotal, endDate, isEssential checkbox
  - One-off form: date, category, note, amount
  - `renderRecurrent()`: groups items into Essential and Non-essential sections with group totals, sorted by nextDate
  - `renderOneOff()`: date-descending list
  - Global window handlers: `deleteRecurrentExpense`, `deleteOneOffExpense`, `toggleRecurrentStatus`
- Updated `index.html`: replaced Fixed/Variable/Subscriptions tabs with single "Expenses" tab containing sub-tabs and both forms
- Refactored `src/ui/transactions.js` to income-only (removed Fixed and Variable handlers)
- Updated `src/app.js`: replaced `subscriptionUI` import/init with `expensesUI`
- Fixed `pdf-import.js` and `templates.js` to use `recurrentExpenseRepository`/`oneOffExpenseRepository` (Rule 3 — blocking issue)

### Task 3: Recurrent Logic & Refinement (commit 0342e72)

- Payment progress badge: "Payment X of Y" shown when `cycleTotal > 0`, "Finished" when complete
- Cancelable badge: shown on non-essential items with an `endDate`
- `toggleRecurrentStatus`: increments `cycleCurrent` when marking a cycled item paid
- "Mark all as paid" button calls `recurrentExpenseRepository.markAllAsPaid()` which bulk-updates all pending items in a Dexie transaction
- Fixed `populateCategoryDropdowns()` to preserve user's current selection on refresh
- Updated dashboard: renamed "Fixed Expenses"/"Variable Expenses" cards to "Recurrent Expenses"/"One-off Expenses"; removed Subscriptions card

## Verification

- [x] Build passes (`npm run build`) with no errors
- [x] Expenses tab exists and replaces legacy Fixed/Variable/Subscriptions tabs
- [x] Recurrent and One-off sub-tabs toggle forms and lists correctly
- [x] Essential/Non-essential grouping with totals per group
- [x] Payment X of Y badge shown for cycle items
- [x] Finished badge shown when cycle complete
- [x] Cancelable badge shown for non-essential items with endDate
- [x] Mark all as paid bulk action implemented
- [x] Dashboard cards updated to reflect consolidated totals

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated pdf-import.js to use new repositories**
- Found during: Task 2
- Issue: `pdf-import.js` imported and called `fixedSpendRepository.add()` and `variableSpendRepository.add()` which are now no-op stubs — imported transactions would silently not be saved
- Fix: Updated import to use `recurrentExpenseRepository` and `oneOffExpenseRepository`; 'fixed' category group maps to recurrent (essential=true, monthly); 'variable' maps to one-off
- Files modified: `src/ui/pdf-import.js`
- Commit: 2ad9c5d

**2. [Rule 3 - Blocking] Updated templates.js to use recurrentExpenseRepository**
- Found during: Task 2
- Issue: `templates.js` imported and called `fixedSpendRepository.add()` for 'fixed' type templates — templates would silently fail to generate entries
- Fix: Updated import to `recurrentExpenseRepository.add()` with full recurrent fields
- Files modified: `src/ui/templates.js`
- Commit: 2ad9c5d

**3. [Rule 1 - Bug] Stubbed deprecated repository references**
- Found during: Task 2
- Issue: `fixedSpendRepository` and `variableSpendRepository` referenced `db.fixedSpends` and `db.variableSpends` which no longer exist after v5 upgrade — would throw at Dexie table access
- Fix: Replaced with no-op stub objects so any remaining code that imports but doesn't call them won't fail at module load
- Files modified: `src/db/repository.js`
- Commit: 2ad9c5d

**4. [Deviation] Dashboard card labels updated**
- Found during: Task 3
- Issue: Dashboard still showed "Fixed Expenses", "Variable Expenses", "Subscriptions" labels which no longer match the data model
- Fix: Renamed to "Recurrent Expenses", "One-off Expenses", removed Subscriptions card (always 0 after v5)
- Files modified: `src/ui/dashboard.js`
- Commit: 0342e72

## Self-Check: PASSED

- src/ui/expenses.js: FOUND
- src/db/schema.js: FOUND
- .planning/phases/08-income-expenses-refinement/08-01-SUMMARY.md: FOUND
- Commit 1691a70 (schema v5): FOUND
- Commit 2ad9c5d (expenses UI): FOUND
- Commit 0342e72 (recurrent logic): FOUND
