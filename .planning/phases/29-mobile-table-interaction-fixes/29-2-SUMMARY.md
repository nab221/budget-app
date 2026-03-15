---
phase: 29-mobile-table-interaction-fixes
plan: "02"
subsystem: expenses-ui
tags: [mobile, table-layout, swipe, debt-navigation, accessibility]
dependency_graph:
  requires: [29-01]
  provides: [MOB-05, DEBT-04]
  affects: [src/ui/expenses.js, css/main.css, index.html]
tech_stack:
  added: []
  patterns: [badge-chip, status-icon, isDebtLinked guard, compact-date]
key_files:
  created: []
  modified:
    - src/ui/expenses.js
    - css/main.css
    - index.html
decisions:
  - "isDebtLinked() uses isDebtPayment || linkedDebtId fields (Phase 18 fields confirmed by grep; no sourceDebtId or debtId top-level fields exist)"
  - "Row swipe applies directly to <tr> element (established pattern from setupGestures/SwipeHandler) — not the nested inner-table variant from plan template"
  - "Debt-linked rows use row.onclick = ... (idempotent assignment) to prevent handler accumulation on re-render"
  - "Swipe right = Edit, swipe left = Delete — action divs carry onclick handlers for revealed tap targets"
  - "Reconciliation mode renders inline cleared checkbox in Amount cell (3-column layout retained)"
  - "date-compact and date-year CSS already added by Plan 29-01; not re-added"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-15"
  tasks: 4
  files_changed: 3
---

# Phase 29 Plan 02: Expenses Table Mobile Redesign Summary

3-column expenses table (Date | Expense | Amount) with badge-chip categories, accessible status icons, compact dates, and debt-linked row navigation to Debts tab.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Reduce expenses header to 3 columns; add isDebtLinked and renderStatusIcon helpers | d9ea663 |
| 2 | Redesign expense row template — badge chip, status icon, compact date | c57631c |
| 3 | Add debt-linked row navigation; update setupGestures to skip debt rows | 4bd42b4 |
| 4 | Add badge-chip and status-icon CSS utility classes (additive) | db86473 |

## What Was Built

- **index.html**: Expenses `<thead>` reduced from 6 columns (Date, Category, Expense, Amount, Status, Actions) to 3 columns (`col-date`, `col-expense`, `col-amount`)
- **expenses.js**: New module-level `isDebtLinked(expense)` function using `isDebtPayment || linkedDebtId` fields
- **expenses.js**: New module-level `renderStatusIcon(status)` returning `<span class="status-icon" aria-label="Paid|Pending|Cancelled">✓|○|✗</span>`
- **expenses.js**: Row template redesigned — category as `.badge-chip` inside Expense cell, status as `.status-icon` in Expense cell, date via `_formatDateCompact()`, `data-debt-linked` attribute on every row
- **expenses.js**: `_formatDateCompact()` method added to `expensesUI` object
- **expenses.js**: `setupGestures()` updated — debt-linked rows skip SwipeHandler and get `onclick` navigation to `[data-tab="debts"]`; non-debt rows retain full swipe-to-reveal Edit/Delete
- **css/main.css**: `.badge-chip` (pill shape, chip CSS vars) and `.status-icon` added; `.expense-row.debt-linked` background indicator added

## Verification Results

- `badge-chip` present in expenses.js row template (lines 765, 791)
- `aria-label` present on status icon (line 43)
- `data-tab="debts"` navigation present in setupGestures (lines 836-837)
- `badge-chip`, `status-icon`, `date-compact`, `date-year` all present in css/main.css
- 393/393 Vitest tests pass — zero new failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Adaptation] Row template adapted to match actual swipe architecture**
- **Found during:** Task 2
- **Issue:** Plan template used nested inner-table + `.swipe-content` div pattern, but the existing `setupGestures()` applies SwipeHandler directly to `<tr>` elements (established production pattern from Phase 29-01 and prior)
- **Fix:** Row template uses 3 inline `<td>` cells with swipe action divs inside `col-date` cell; swipe handlers on `<tr>` directly as before
- **Files modified:** src/ui/expenses.js

**2. [Rule 2 - Correctness] Added onclick handlers to swipe action divs**
- **Found during:** Task 2
- **Issue:** Plan template showed `<div class="swipe-action-right">Edit</div>` without onclick attributes — tapping the revealed button would not trigger the edit action
- **Fix:** Added `onclick="expensesUI.editExpense(...)"` and `onclick="deleteExpense(...)"` to the respective action divs
- **Files modified:** src/ui/expenses.js

**3. [Rule 1 - Adaptation] Reconciliation mode handled separately with 3-column layout**
- **Found during:** Task 2
- **Issue:** Original 6-column layout had a dedicated cleared checkbox column in reconciliation mode; the 3-column redesign needed to fold this into the Amount cell
- **Fix:** Reconciliation mode returns a separate row template variant with inline cleared checkbox in the Amount column
- **Files modified:** src/ui/expenses.js

## Self-Check: PASSED

- src/ui/expenses.js: FOUND
- css/main.css: FOUND
- index.html: FOUND
- commit d9ea663: FOUND
- commit c57631c: FOUND
- commit 4bd42b4: FOUND
- commit db86473: FOUND
