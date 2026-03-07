---
phase: 10-advanced-debt-and-payoff
plan: 01
subsystem: data-layer-simulation
tags: [dexie, simulation, finance, uk-credit-cards]
requires: []
provides: [schema-v8, enhanced-payoff-logic]
affects: [src/db/schema.js, src/utils/finance.js]
tech-stack: [dexie.js, vitest, date-fns]
key-files: [src/db/schema.js, src/utils/finance.js, src/utils/finance.test.js]
decisions:
  - "Smallest balance tie-breaker implemented for equal APR strategy"
  - "Rate jump detected when promo period expires between simulation months"
  - "Simulation history includes monthly principal vs interest breakdown"
metrics:
  duration: 15 min
  completed_date: "2026-03-01T14:18:00Z"
---

# Phase 10 Plan 01: Data Layer and Core Simulation Logic Summary

## One-liner
Updated the data layer to support promotional APRs and enhanced the simulation engine to provide detailed monthly payoff history.

## Implementation Detail
- **Schema v8:** Added `promoEndDate` (ISO string) and `postPromoApr` (number) to the `debts` table in `src/db/schema.js`.
- **Finance Logic:** 
    - `calcMinPayment` now supports a reference date and promo end date to determine if 0% APR should be used.
    - `simulatePayoff` refactored to handle "Rate Jumps" when promos expire.
    - Added a `history` array to `simulatePayoff` results, providing a month-by-month breakdown of interest charged, principal paid, and total remaining balance.
    - Implemented a tie-breaker for the Avalanche/Snowball strategies: if APRs are equal, the debt with the **smallest balance** is prioritized.
- **Verification:** 
    - Added comprehensive unit tests in `src/utils/finance.test.js` covering promo periods, rate jumps, and the new history structure.
    - All 14 tests in `src/utils/finance.test.js` are passing.

## Deviations from Plan
None - plan executed exactly as written. Task 1 was already partially implemented and committed in a previous session, but was verified and completed.

## Self-Check: PASSED
- [x] Schema v8 exists in `src/db/schema.js`.
- [x] `simulatePayoff` returns a `history` object.
- [x] Tests in `src/utils/finance.test.js` pass with 100% coverage for new features.
- [x] Commits made for each task.

## Commits
- `ce319ea`: feat(10-01): update schema to v8 for advanced debt tracking (previous session)
- `2da05de`: feat(10-01): refactor simulation engine for promos and history
- `a00e30a`: test(10-01): add advanced finance tests for promos and history
