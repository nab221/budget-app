# Phase 07: Restore Cashflow Core — Stabilization Wave 1

## Goal
Restore accuracy and core features to the cashflow engine after the v2.2 overhaul.

## Waves

### Wave 1: 07-01-restore-utilities
**Goal**: Re-implement deleted utility functions in `src/utils/cashflow.js`.
- [ ] TECH-01: Restore `fetchHolidays`, `isWorkingDay`, and `nextWorkingDay`.
- [ ] TECH-02: Restore `calculateForecast` and `generateExpectedIncomePredictions`.
- [ ] TECH-03: Ensure all imports/dependencies are correctly wired.

### Wave 2: 07-02-fix-tests
**Goal**: Ensure the cashflow test suite passes.
- [ ] TEST-01: Run `npm test src/utils/cashflow.test.js`.
- [ ] TEST-02: Fix any mismatches between restored logic and existing tests.
- [ ] TEST-03: Verify all 140+ tests in `src/utils/cashflow.test.js` pass.

## Success Criteria
- [ ] `src/utils/cashflow.js` exports all required functions.
- [ ] `npm test src/utils/cashflow.test.js` reports 0 failures.
