---
phase: 48-app-refresh-double-render-fix
plan: 01
subsystem: testing
tags: [vitest, jsdom, tdd, wave-0, perf, render-coordination]

# Dependency graph
requires:
  - phase: 47-desktop-nav-sticky-dead-code-removal
    provides: stable expenses.js baseline before PERF-01 fix
provides:
  - PERF-01 failing test contracts for toggleExpenseStatus render coordination
affects:
  - 48-02 (implementation plan that must turn these tests GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Register app:refresh listener explicitly in beforeEach to replicate init() behaviour in isolated tests
    - Store named listener reference in describe scope for safe removeEventListener in afterEach
    - Spy on window.dispatchEvent and filter by CustomEvent type to assert absence of specific event

key-files:
  created: []
  modified:
    - src/ui/expenses.test.js

key-decisions:
  - "Register app:refresh listener in beforeEach (not calling init()) to expose double-render — calling init() would cause real render DOM errors; addEventListener is sufficient to replicate the side-effect"
  - "Store appRefreshListener as named reference in describe scope so afterEach can remove it cleanly — arrow functions in removeEventListener are no-ops"
  - "Use 'recurrent' (not 'recurring') type string to exercise recurrentExpenseRepository.get code path in toggleExpenseStatus"

patterns-established:
  - "PERF TDD pattern: add app:refresh listener in beforeEach to test double-render scenarios without calling full init()"

requirements-completed: [PERF-01]

# Metrics
duration: 12min
completed: 2026-03-22
---

# Phase 48 Plan 01: PERF-01 Failing Tests Summary

**Three RED TDD tests asserting toggleExpenseStatus render-count contracts: render once, transactionUI once, no app:refresh dispatch**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-22T21:44:00Z
- **Completed:** 2026-03-22T21:56:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `afterEach` to the vitest import for clean teardown
- Created new describe block `toggleExpenseStatus — PERF-01 render coordination` with 3 failing tests
- Test 1 fails: `expensesUI.render` called 2x (once direct at line 270, once via app:refresh listener) — expects 1
- Test 2 fails: `window.transactionUI.render` called 0x (no explicit call exists yet) — expects 1
- Test 3 fails: `window.dispatchEvent` called with `app:refresh` at line 271 — expects 0 calls
- All 6 pre-existing tests remain GREEN

## Task Commits

1. **Task 1: Add failing PERF-01 render-count tests** - `3a5e81c` (test)

## Files Created/Modified
- `src/ui/expenses.test.js` - Added afterEach import, new describe block with 3 RED tests for PERF-01

## Decisions Made
- Registered the `app:refresh` event listener explicitly in `beforeEach` to simulate the `init()` side-effect — calling `init()` directly would attempt real renders and fail in jsdom; the listener-only approach is sufficient to surface the double-render
- Stored listener reference in `appRefreshListener` variable at describe scope to allow proper cleanup in `afterEach` (anonymous arrow functions cannot be removed)
- Used `'recurrent'` type string (matching the actual code check `type === 'recurrent'`) rather than `'recurring'` to ensure the full code path through `recurrentExpenseRepository.get` is exercised

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- First run attempt used `'recurring'` (typo) instead of `'recurrent'` — Test 1 still failed correctly but exercised the wrong (else) branch; corrected immediately before commit.
- First implementation of Test 1 passed because `app:refresh` listener was not registered in the test environment — added explicit listener registration in `beforeEach` to reproduce the broken state.

## Next Phase Readiness
- 3 failing tests define the exact contracts plan 02 must satisfy
- Test 1 will pass when `this.render()` is the only render call (dispatch removed)
- Test 2 will pass when `await window.transactionUI?.render()` is added after `this.render()`
- Test 3 will pass when `window.dispatchEvent(new CustomEvent('app:refresh'))` is removed from `toggleExpenseStatus`

---
*Phase: 48-app-refresh-double-render-fix*
*Completed: 2026-03-22*
