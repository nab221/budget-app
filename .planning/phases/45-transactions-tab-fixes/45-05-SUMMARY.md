---
phase: 45-transactions-tab-fixes
plan: "05"
subsystem: transactions-ui
tags: [gap-closure, transactions, category-filter, debt-redirect]
dependency_graph:
  requires: [45-03, 45-04]
  provides: [TRANS-01, TRANS-02, TRANS-08]
  affects: [src/ui/transactions.js, src/ui/expenses.js]
tech_stack:
  added: []
  patterns: [app:refresh event bus, data-tab redirect buttons, month-scoped category filter]
key_files:
  created: []
  modified:
    - src/ui/transactions.js
    - src/ui/transactions.test.js
    - src/ui/expenses.js
decisions:
  - "Store selectedCategories as strings (checkbox.value) and use String(c.id) in includes() to avoid number/string type mismatch"
  - "renderCategoryFilter fetches transactions inline to compute active categories — avoids restructuring render() call chain"
  - "Debt rows use redirect button (same pattern as income rows) instead of row-level onclick"
metrics:
  duration: ~45 minutes (continuation from checkpoint)
  completed: 2026-03-22
  tasks_completed: 3 (plus 3 additional user-feedback fixes)
  files_modified: 3
---

# Phase 45 Plan 05: Gap Closure TRANS-01, TRANS-02, TRANS-08 Summary

Gap closure for three Transactions tab failures identified in phase 45 verification, plus three additional user-feedback corrections after initial checkpoint verification.

## What Was Built

**TRANS-01 — Expense row re-renders in-place after toggle:**
`toggleExpenseStatus` in `expenses.js` now dispatches `app:refresh` after `this.render()`. `transactionUI` already listens for that event at `init()` line 38, so no wiring changes were needed.

**TRANS-02 — Income and debt redirect buttons:**
Income rows show a single "↗ Income" redirect button (navigates to `[data-tab="income-sources"]`). Debt rows now show a matching "↗ Debt" redirect button (navigates to `[data-tab="debts"]`). Both replace action buttons (Mark Paid / Edit / Delete) that would have been misleading for these row types.

**TRANS-08a — Category filter checkboxes pre-checked on reopen:**
The `renderCategoryFilter` method now uses `this.selectedCategories.includes(String(c.id))` instead of `this.selectedCategories.includes(c.id)`. Since `checkbox.value` is always a string and `c.id` is a number, the old check never matched — reopening the dropdown always showed unchecked boxes.

**TRANS-08b — Category filter scoped to current month:**
`renderCategoryFilter` now fetches all three transaction repositories for the current month alongside categories. It builds a `Set` of category IDs used by actual transactions, then filters the dropdown to only those categories. System-group categories remain excluded. An empty-state message ("No categories this month") displays when no categorised transactions exist.

## Commits

| Hash | Description |
|------|-------------|
| 83460b9 | Task 1: dispatch app:refresh from toggleExpenseStatus (TRANS-01) |
| e845aff | Task 2: income redirect button and category filter methods (TRANS-02, TRANS-08) |
| 631ef35 | User-feedback fixes: debt redirect button, pre-checked state, month-scoped categories |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Category checkbox pre-checked state never matched due to type coercion**
- **Found during:** User verification of TRANS-08
- **Issue:** `selectedCategories.includes(c.id)` compared string values against number IDs — always returned false, so reopening the dropdown showed all checkboxes unchecked regardless of selections
- **Fix:** Changed to `selectedCategories.includes(String(c.id))` — consistent with how `handleCategoryChange` stores values via `checkbox.value`
- **Files modified:** src/ui/transactions.js
- **Commit:** 631ef35

**2. [Rule 2 - Missing functionality] Category filter showed all categories, not month-scoped**
- **Found during:** User verification of TRANS-08
- **Issue:** All non-system categories were always shown, including categories with no transactions in the selected month — created clutter
- **Fix:** `renderCategoryFilter` now fetches income, recurrent, and oneOff transactions for the current month, computes a Set of used categoryIds, and filters the dropdown list to those IDs only
- **Files modified:** src/ui/transactions.js, src/ui/transactions.test.js
- **Commit:** 631ef35

**3. [Rule 2 - Missing functionality] Debt rows had no redirect button (previous version behaviour)**
- **Found during:** User verification of TRANS-02
- **Issue:** Debt rows originally rendered nothing in the actions cell (`isDebt ? '' : ...`). The previous app version had a "Debt" redirect button that was lost during the Transactions tab merge
- **Fix:** Added `<button class="sm ghost" onclick="document.querySelector('[data-tab=\\'debts\\']').click()"` for debt rows, mirroring the income row redirect pattern
- **Files modified:** src/ui/transactions.js
- **Commit:** 631ef35

### Test Updates

The TRANS-08 test (`renders expense-group categories in category filter dropdown`) was updated to reflect the new month-scoped behaviour. The updated test provides mock transaction data with a "Credit Cards" category ID, then asserts:
- Credit Cards appears (has a transaction this month)
- System group is excluded
- Salary (no transaction this month) does not appear

## Verification

- `npx vitest run src/ui/transactions.test.js` — 9/9 passing
- Full suite: pre-existing timeouts in `dashboard.view-toggle.test.js`, `dashboard.affordability.test.js`, and 3 failures in `income-sources.test.js` / `finance.test.js` are unrelated to this plan

## Self-Check: PASSED

Files confirmed present:
- src/ui/transactions.js — modified
- src/ui/transactions.test.js — modified
- src/ui/expenses.js — modified (Task 1, commit 83460b9)

Commits confirmed:
- 83460b9 — exists
- e845aff — exists
- 631ef35 — exists
