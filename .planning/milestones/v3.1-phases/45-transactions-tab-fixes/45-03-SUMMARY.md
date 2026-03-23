---
phase: 45-transactions-tab-fixes
plan: "03"
subsystem: transactions-ui
tags: [transactions, sort, filter, ux, amount-prefix]
dependency_graph:
  requires: [45-02]
  provides: [TRANS-05, TRANS-06, TRANS-07, TRANS-08]
  affects: [src/ui/transactions.js, index.html]
tech_stack:
  added: []
  patterns: [tdd-red-green, filterTransactions-unified]
key_files:
  created: []
  modified:
    - src/ui/transactions.js
    - index.html
    - src/ui/transactions.test.js
decisions:
  - "Used filterTransactions utility for unified search+category filtering — replaces manual .filter() chain and fixes broken category filter in a single change"
  - "Fixed self-contradicting TRANS-07 test fixture (set old placeholder then asserted new value) — updated fixture to reflect post-fix state, consistent with TRANS-03 fix in 45-02"
metrics:
  duration: "13 minutes"
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_changed: 3
---

# Phase 45 Plan 03: Display and UX Fixes (Sort, ± Prefix, Placeholder, Category Filter) Summary

**One-liner:** Four Transactions tab display fixes — sort order toggle, ± amount prefixes, correct search placeholder, and full non-system category filter wired through filterTransactions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Sort order toggle and ± amount prefixes | 2c1f01d | src/ui/transactions.js, index.html |
| 2 | Fix search placeholder and extend category filter | da9a673 | src/ui/transactions.js, index.html, transactions.test.js |

## What Was Built

### TRANS-05: Sort Order Toggle
- Added `sortOrder: 'desc'` property to `transactionUI` object
- Updated `_buildMergedRows` sort comparator: negates `cmp` when `sortOrder === 'asc'`
- Added `sortOrderBtn` wiring in `setupEventListeners` — toggles state, updates button text, calls `this.render()`
- Added `<button id="sortOrderBtn" class="ghost sm">↓ Newest First</button>` to Transactions tab toolbar in `index.html`

### TRANS-06: ± Amount Prefixes
- Income amount cells: `+${formatGBP(item.amount)}` — positive prefix
- Expense amount cells: `\u2212${formatGBP(item.amount)}` — proper minus sign (−, U+2212)
- `formatGBP` argument unchanged (still receives pence)

### TRANS-07: Search Placeholder
- Changed `placeholder="Search income..."` to `placeholder="Search transactions"` in `index.html` `#incSearch` input

### TRANS-08: Category Filter — All Non-System Groups
- `renderCategoryFilter` now uses `categories.filter(c => c.group !== 'system')` — shows both income and expenses categories (including debt-linked Credit Cards & Loans)
- `renderTransactions` now uses `filterTransactions(allMerged, this.searchQuery, this.selectedCategories, ['displayLabel'], catMap)` — single call replaces manual `.filter()` chain; fixes broken category filtering and unifies search logic

## Test Results

All 9 TRANS-XX tests GREEN in `src/ui/transactions.test.js`:
- TRANS-01 through TRANS-04: already GREEN from 45-02
- TRANS-05: sort order default + ascending sort behavior
- TRANS-06: + prefix on income cells, − prefix on expense cells
- TRANS-07: placeholder value
- TRANS-08: expense-group categories in filter dropdown

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed self-contradicting TRANS-07 test fixture**
- **Found during:** Task 2 verification
- **Issue:** Test fixture hardcoded `placeholder="Search income..."` in DOM setup then asserted value was `"Search transactions"` — test could never pass regardless of code changes. Same pattern as TRANS-03 fix in 45-02 (documented in STATE.md)
- **Fix:** Updated fixture to use `placeholder="Search transactions"` to reflect post-fix state — test now verifies the new placeholder value
- **Files modified:** src/ui/transactions.test.js
- **Commit:** da9a673

## Self-Check: PASSED

- src/ui/transactions.js: FOUND
- index.html: FOUND
- Commit 2c1f01d (Task 1): FOUND
- Commit da9a673 (Task 2): FOUND
