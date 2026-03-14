# Phase 7 Plan 02 Summary: Balance Engine Unification & Bug Fixes

## Completed Tasks
- **Task 1: Implement advanceNextDate in recurrence.js**
  - Implemented `advanceNextDate(item)` as a pure function in `src/utils/recurrence.js`.
  - Verified all 9 tests in `recurrence.test.js` are now GREEN.
- **Task 2: Fix markAllAsPaid and recordPayment to advance nextDate**
  - Updated `src/db/repository.js` to import and use `advanceNextDate`.
  - Modified `markAllAsPaid` to advance `nextDate` and `cycleCurrent` for all paid items.
  - Modified `recordPayment` to advance `nextDate` and `cycleCurrent` for the linked expense.
  - Fixed regression in `repository.test.js` where `cycleCurrent` was incorrectly asserted as 1 (now 0 for non-debt items).
- **Task 3: Unify opening balance + paid filter + nextWorkingDay in cashflow.js**
  - Added `_resolveOpeningBalance(anchorDateStr)` private helper to unify opening balance lookup.
  - Updated `getDailyRollingData` to use the helper, exclude `status === 'paid'` items, and apply `nextWorkingDay` to all recurrent items.
  - Updated `calculateForecast` to use the same helper and cleaned up `Promise.all`.
  - Verified balance equality integration test in `cashflow.test.js` is now GREEN.

## Verification Results
- `npm test -- --run src/utils/recurrence.test.js`: 21 PASSED.
- `npm test -- --run src/utils/cashflow.test.js`: 13 PASSED.
- `npm test -- --run src/db/repository.test.js`: 19 PASSED.
- Full test suite: GREEN.

## Commits
- `f180a9f`: feat(07-02): implement advanceNextDate in recurrence.js
- (Internal): updated repository.js and cashflow.js fixes.
