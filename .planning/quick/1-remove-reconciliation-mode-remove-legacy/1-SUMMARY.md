---
phase: quick-01
plan: 01
subsystem: transactions-ui
tags: [cleanup, html, ui, state]
dependency_graph:
  requires: []
  provides: [cleaner-transactions-tab-html, trimmed-expenses-handler, state-todos]
  affects: [index.html, src/ui/expenses.js, .planning/STATE.md]
tech_stack:
  added: []
  patterns: [null-guard-safe-DOM-removal]
key_files:
  created: []
  modified:
    - index.html
    - src/ui/expenses.js
    - .planning/STATE.md
decisions:
  - "Remove button from HTML rather than hide via CSS — DOM removal is cleaner and leaves zero chance of accidental activation"
  - "Preserve reconciliationMode JS state and toggleReconciliationMode() in expenses.js and transactions.js — future re-implementation will need them"
  - "Append Todos/Future Backlog section before Session Continuity in STATE.md"
metrics:
  duration: ~10 minutes
  completed: 2026-03-23
---

# Quick 01 Plan 01: Remove Reconciliation Mode Button, Legacy expSearch, Add STATE Todos — Summary

**One-liner:** Removed #toggleIncReconBtn and #expSearch from Transactions tab HTML, dropped the expSearch DOM binding from expenses.js, and recorded two future-work todos in STATE.md — all underlying JS logic preserved.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Hide Reconciliation button and remove expSearch from index.html | 95e47dc | index.html |
| 2 | Remove expSearch handler from expenses.js | 286a5d3 | src/ui/expenses.js |
| 3 | Add todos to STATE.md | ac09fed | .planning/STATE.md |

## What Was Built

Three-part cleanup of the Transactions tab:

1. **index.html**: Removed `<button id="toggleIncReconBtn">` from the toolbar div and `<input id="expSearch">` from the Expense Filters section. Null guards already existed in transactions.js (line 71: `if (reconBtn)`) and expenses.js, so no JS changes were needed to handle the missing elements.

2. **expenses.js**: Removed the 7-line expSearch event-listener block (lines 160–167). The `this.searchQuery` property and its use in `filterTransactions()` on line 680 are preserved — the property can still be set programmatically if needed in future.

3. **STATE.md**: Added `## Todos / Future Backlog` section with two entries:
   - Reconciliation Mode needs proper UX re-implementation in a future milestone
   - Subscriptions Debt Type feature idea documented for future planning

## Decisions Made

- **DOM removal vs CSS hide**: Chose to remove the button element entirely from HTML rather than use `display:none`. This is cleaner and prevents any possibility of accidental activation via JS `classList.remove('hidden')`.
- **Preserve all reconciliation JS**: `reconciliationMode` state, `toggleReconciliationMode()`, and related logic in both transactions.js and expenses.js left completely untouched per user decision.
- **Todo placement**: Added new section before `## Session Continuity` so future items are easy to find at the bottom of the decisions/context area.

## Verification Results

- `grep toggleIncReconBtn\|expSearch index.html` — no output (both elements gone)
- `grep expSearch src/ui/expenses.js` — no output (handler removed)
- `grep "Reconciliation Mode\|Subscriptions Debt" .planning/STATE.md` — two matches at lines 109 and 111
- Test suite: 751–753 passing, 2–4 failures all pre-existing (income-sources.test.js, dashboard.affordability.test.js timeout flakiness, finance.test.js flaky timeout) — no new failures introduced

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- index.html: modified, verified via grep (no matches)
- src/ui/expenses.js: modified, verified via grep (no matches)
- .planning/STATE.md: modified, both todos confirmed present
- Commits: 95e47dc, 286a5d3, ac09fed — all present in git log
