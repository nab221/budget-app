---
phase: 40-redesign-income-and-transactions-tab-structure
plan: "01"
subsystem: testing
tags: [vitest, tdd, transactions, heatmap, merged-view]

requires:
  - phase: 39.1-income-sources-tab
    provides: transactionUI module (src/ui/transactions.js) and income-sources wiring patterns

provides:
  - RED test scaffold (tests/transactions-merged.test.js) covering REQ-40-02, 40-03, 40-04
  - 14 tests (13 RED, 1 passing negative-contract) that will turn GREEN after Plan 02 implementation

affects:
  - 40-02 (implementation plan that must make these tests GREEN)

tech-stack:
  added: []
  patterns:
    - "Wave 0 RED scaffold: write tests against non-existent methods so they fail with 'is not a function' — correct RED state"
    - "Group A pattern: mirror current app.js routing logic verbatim in test, then assert intended post-impl contract — ensures RED before and GREEN after Plan 02"
    - "Group C pattern: mock renderSpendingHeatmap at module level, assert container IDs via mock.calls.map(call => call[0])"

key-files:
  created:
    - tests/transactions-merged.test.js
  modified: []

key-decisions:
  - "Group A tests mirror the CURRENT app.js 'income' routing logic verbatim so the test runs the existing code path but asserts the post-Plan-02 contract — giving reliable RED state now and reliable GREEN after implementation"
  - "Group B _buildMergedRows() pure helper contract: (incomeItems, recurrentItems, oneOffItems) => sorted merged array with _rowType, type, displayDate, displayLabel fields — Plan 02 must implement this exact signature"
  - "Group C tests pass empty container IDs in DOM (no incomeTabHeatmapContainer present) so current renderHeatmap() exits early without calling renderSpendingHeatmap — the 'not.toContain incomeTabHeatmapContainer' test legitimately passes in both RED and GREEN state as a negative constraint"
  - "vi.mock('../src/ui/heatmap.js') + vi.mock('../src/db/repository.js') pattern avoids Dexie DB init in tests — same pattern as income-sources.test.js"

patterns-established:
  - "RED scaffold pattern for Phase 40: test files import real module, mock all DB/render dependencies, assert intended post-implementation contracts"

requirements-completed:
  - 40-02
  - 40-03
  - 40-04

duration: 10min
completed: 2026-03-17
---

# Phase 40 Plan 01: Transactions Merged — Wave 0 RED Test Scaffold Summary

**14-test RED scaffold in tests/transactions-merged.test.js covering panelId routing (REQ-40-02), _buildMergedRows() pure helper contract (REQ-40-03), and dual heatmap container IDs (REQ-40-04) — 13 tests RED, full suite 39/40 test files passing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-17T22:06:14Z
- **Completed:** 2026-03-17T22:16:47Z
- **Tasks:** 1 (single TDD RED task)
- **Files modified:** 1

## Accomplishments

- Created `tests/transactions-merged.test.js` with 14 tests across 3 groups covering all Wave 0 requirements
- Confirmed 13 tests RED (correct pre-implementation state)
- Full suite: 39/40 test files pass, 696 pre-existing tests unaffected (no regressions)

## Task Commits

1. **Task 1: RED test scaffold** - `0f1344c` (test)

## Files Created/Modified

- `tests/transactions-merged.test.js` — Wave 0 RED scaffold: Group A (panelId routing), Group B (_buildMergedRows contract), Group C (dual heatmap containers)

## Decisions Made

- Group A tests mirror the current `app.js` `if (panelId === 'income')` logic verbatim then assert the intended post-Plan-02 contract — this gives reliable RED state before Plan 02 and reliable GREEN after
- Group B tests call `transactionUI._buildMergedRows()` which doesn't exist yet — fails with "is not a function" as intended
- Group C tests mock `renderSpendingHeatmap` and assert the two new container IDs — currently the method exits early (no DOM container found), so `renderSpendingHeatmap` is never called and the assertions fail
- The "does NOT call with old ID" test (C-3) legitimately passes in both RED and GREEN state — it is a negative constraint that holds regardless of implementation, so it does not interfere with RED state verification

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- `tests/transactions-merged.test.js` scaffold is in place — Plan 02 can run `npm test -- --run tests/transactions-merged.test.js` as its continuous verification gate
- Plan 02 must implement: `transactionUI._buildMergedRows()`, rename `app.js` panelId branch from `'income'` to `'transactions'`, update `renderHeatmap()` to call `renderSpendingHeatmap` with both `transactionsIncomeHeatmapContainer` and `transactionsSpendingHeatmapContainer`

---
*Phase: 40-redesign-income-and-transactions-tab-structure*
*Completed: 2026-03-17*

## Self-Check: PASSED

- tests/transactions-merged.test.js: FOUND
- 40-01-SUMMARY.md: FOUND
- Commit 0f1344c: FOUND
