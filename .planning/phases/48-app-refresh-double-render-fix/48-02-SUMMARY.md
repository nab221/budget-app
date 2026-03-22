---
phase: 48-app-refresh-double-render-fix
plan: 02
subsystem: ui
tags: [expenses, render-coordination, perf, vitest, tdd]

# Dependency graph
requires:
  - phase: 48-app-refresh-double-render-fix
    provides: PERF-01 failing test contracts from plan 01

provides:
  - PERF-01 fix: toggleExpenseStatus no longer dispatches app:refresh — calls window.transactionUI?.render() directly
  - PERF-01 fix: showDebtPaymentConfirmation no longer dispatches app:refresh — calls window.debtUI?.render() directly

affects:
  - Human verification (Task 3 checkpoint — browser confirmation of Transactions tab behaviour)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Replace global app:refresh dispatch with targeted window.*.render() optional-chaining calls to avoid double-render
    - Use optional chaining (?.) on window globals for safe calls when UI modules not yet initialised (e.g., in unit tests)

key-files:
  created: []
  modified:
    - src/ui/expenses.js

key-decisions:
  - "Use window.transactionUI?.render() (not an import) to avoid circular import risk documented in 48-RESEARCH.md"
  - "Use window.debtUI?.render() analogous to transactionUI pattern — both globals registered during app init with optional chaining for safety"
  - "Remove comment '// Broadcast refresh for Debts tab' along with the dispatch line — the comment described the old behaviour and no longer applies"

patterns-established:
  - "Targeted render pattern: call window.targetUI?.render() instead of dispatching app:refresh when coordinating cross-module UI updates"

requirements-completed: [PERF-01]

# Metrics
duration: 25min
completed: 2026-03-22
---

# Phase 48 Plan 02: PERF-01 Fix Summary

**Removed two redundant app:refresh dispatches from expenses.js — replaced with targeted window.transactionUI?.render() and window.debtUI?.render() calls, eliminating double-render on expense status toggle**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-22T21:47:30Z
- **Completed:** 2026-03-22T22:12:00Z
- **Tasks:** 3 of 3
- **Files modified:** 1

## Accomplishments
- Replaced `window.dispatchEvent(new CustomEvent('app:refresh'))` in `toggleExpenseStatus` with `await window.transactionUI?.render()` — fixes double-render when marking an expense paid from the Transactions tab
- Replaced `window.dispatchEvent(new CustomEvent('app:refresh'))` in `showDebtPaymentConfirmation` confirmBtn.onclick with `await window.debtUI?.render()` — fixes double-render after debt payment confirmation
- All 3 PERF-01 TDD tests turned GREEN (were RED after plan 01)
- Full suite: 753 tests pass, 0 failures

## Task Commits

1. **Task 1: Fix toggleExpenseStatus primary dispatch** - `5003dce` (feat)
2. **Task 2: Fix secondary dispatch in debt payment confirmation handler** - `d7d5046` (fix)
3. **Task 3: Human browser verification** — approved (Transactions tab "Mark Paid" updates immediately; Expenses tab reflects same status change; debt payment modal closes cleanly)

## Files Created/Modified
- `src/ui/expenses.js` — Two `window.dispatchEvent(new CustomEvent('app:refresh'))` lines replaced with explicit `window.*.render()` calls

## Decisions Made
- Used `window.transactionUI?.render()` and `window.debtUI?.render()` via window globals (not imports) — consistent with research finding that circular imports exist between expenses.js and these modules
- Optional chaining `?.` is correct: handles the case where the UI module is not yet initialised (including during Vitest tests that don't call full `init()`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — both dispatch lines were exactly where the plan specified (lines 271 and 1060). Both edits applied cleanly. Test suite confirmed all 3 PERF-01 contracts satisfied.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PERF-01 fully resolved and human-verified — app:refresh double-render eliminated at both call sites in expenses.js
- All 3 PERF-01 tests GREEN; full suite 753 tests, 0 failures
- Phase 48 complete — no further plans in this phase

---
*Phase: 48-app-refresh-double-render-fix*
*Completed: 2026-03-22*
