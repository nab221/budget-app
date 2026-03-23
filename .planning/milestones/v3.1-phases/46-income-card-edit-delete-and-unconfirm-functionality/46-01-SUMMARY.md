---
phase: 46-income-card-edit-delete-and-unconfirm-functionality
plan: 01
subsystem: testing
tags: [vitest, income, tdd, jsdom]

# Dependency graph
requires:
  - phase: 44-income-tab-cards
    provides: income-sources.js with _renderSourceCards, openIncomeModal, _renderIncomeEntryStatuses, _registerGlobalHandlers
provides:
  - Failing test stubs for INCOME-06, INCOME-07, INCOME-08, INCOME-09 that define contracts for Plan 02
affects:
  - 46-02-PLAN.md (must satisfy these RED tests)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Wave 0 TDD — write failing stubs before implementation, define contracts first

key-files:
  created: []
  modified:
    - src/ui/income-sources.test.js

key-decisions:
  - "Extend incomeRepository mock at vi.mock level (not just beforeEach) so update+delete are available to all new test blocks"
  - "INCOME-06 failure mode: inline onclick stopPropagation on Edit/Delete buttons blocks container delegation handler — test proves the bug exists"
  - "INCOME-07 failure mode: _renderIncomeEntryStatuses writes generic Confirm button for unmatched entries, not amount+date badge — test proves rich status not rendered"
  - "INCOME-08/09 failure mode: saveEditedIncomeEntry and unconfirmIncomeEntry do not exist on window yet — TypeError is an expected RED state"

patterns-established:
  - "Append new describe blocks below existing INCOME-0N blocks — never rewrite the file"
  - "Use Promise.resolve() to flush microtasks after click() in jsdom delegation tests"

requirements-completed:
  - INCOME-06
  - INCOME-07
  - INCOME-08

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 46 Plan 01: Income Card Edit/Delete/Unconfirm — TDD Wave 0 Summary

**Four RED test stubs (INCOME-06/07/08/09) added to income-sources.test.js with incomeRepository mock extended with update() and delete() — contracts defined for Plan 02 to satisfy**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T09:50:51Z
- **Completed:** 2026-03-22T09:53:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Extended incomeRepository mock with `update: vi.fn()` and `delete: vi.fn()` at the vi.mock factory level
- Added INCOME-06 (2 tests): card Edit/Delete button delegation — proves stopPropagation blocks handler
- Added INCOME-07 (1 test): confirmed entry status span shows formatted amount and date — proves rich status not yet rendered
- Added INCOME-08 (1 test): `window.saveEditedIncomeEntry` calls `incomeRepository.update()` — proves handler not yet registered
- Added INCOME-09 (2 tests): `window.unconfirmIncomeEntry` calls confirm then `incomeRepository.delete()`, skips delete on cancel — proves handler not yet registered
- All 7 original INCOME-01..05 tests remain GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend mock and add INCOME-06/07/08/09 failing stubs** - `5856b18` (test)

## Files Created/Modified
- `src/ui/income-sources.test.js` - Extended incomeRepository mock; appended 4 new describe blocks for INCOME-06/07/08/09

## Decisions Made
- Extend mock at `vi.mock` factory level (not in `beforeEach`) — ensures `update` and `delete` are present when the module is first imported at top-level `await import()`
- INCOME-09 added alongside INCOME-08 even though the plan header says 06/07/08 — the plan body explicitly includes INCOME-09 stubs; both sets of contracts needed together

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RED test stubs committed; Plan 02 can now implement the features to turn INCOME-06..09 GREEN
- The six failing tests define the exact APIs Plan 02 must build:
  1. Remove `stopPropagation` from card Edit/Delete buttons OR switch to data-attribute delegation only
  2. `_renderIncomeEntryStatuses` must render amount+date in confirmed span
  3. Register `window.saveEditedIncomeEntry(sourceId, nominalDate, entryId)` in `_registerGlobalHandlers`
  4. Register `window.unconfirmIncomeEntry(sourceId, nominalDate, entryId)` in `_registerGlobalHandlers`

---
*Phase: 46-income-card-edit-delete-and-unconfirm-functionality*
*Completed: 2026-03-22*
