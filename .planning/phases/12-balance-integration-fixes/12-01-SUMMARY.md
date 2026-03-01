# Phase 12 Summary: Balance Integration Fixes

## Files Modified
- `src/db/repository.js`: Added `add`, `update`, and `delete` overrides to `recurrentExpenseRepository` to trigger balance recalculation on mutations.
- `src/utils/finance.js`: Implemented `recurrentFallsInMonth` helper and updated `calculateBalanceChain` to use frequency-aware filtering for recurrent expenses in projections.
- `src/utils/finance.test.js`: Added unit tests for quarterly frequency filtering, finished-cycle exclusion, and repository override structural smoke tests.

## Key Decisions
- **Recalc Anchor**: Used `nextDate || date` as the anchor for triggering balance recalculation in `recurrentExpenseRepository`. This ensures that even if a next date hasn't been set yet, the recalculation starts from the record's creation date.
- **Frequency Filtering**: The `recurrentFallsInMonth` helper uses `date-fns` to advance from `nextDate` by the appropriate frequency (monthly, quarterly, annual) to determine if an item falls in a projected month.
- **Cycle Completion**: Items where `cycleCurrent >= cycleTotal` (for finite cycles) are now explicitly excluded from projections.

## Test Results
- **Before**: 93 tests passing (with Phase 12 smoke test failing).
- **After**: 96 tests passing.
- **New Tests**:
  - `counts a quarterly expense exactly once per quarter in projections` (Passed)
  - `excludes finished finite-cycle items from projections` (Passed)
  - `recurrentExpenseRepository — mutation overrides (smoke test)` (Passed)

## Verification
- Verified that `triggerBalanceRecalc` is called in `recurrentExpenseRepository.add/update/delete`.
- Verified that `recurrentFallsInMonth` is correctly integrated into the live DB path of `calculateBalanceChain`.
- Verified that the dependency injection path in `calculateBalanceChain` remains untouched, preserving unit test isolation.
