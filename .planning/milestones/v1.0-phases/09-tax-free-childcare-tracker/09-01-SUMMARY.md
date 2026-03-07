---
phase: 09-tax-free-childcare-tracker
plan: 01
subsystem: database
tags: [childcare, tfc, dexie, schema, repository, unit-tests]
dependency_graph:
  requires: [src/db/schema.js@v6, src/utils/currency.js, src/db/repository.js]
  provides: [src/db/schema.js@v7, src/utils/childcare.js, childcareRepository]
  affects: [src/db/repository.js, getDashboardData (net worth integration in plan 02)]
tech_stack:
  added: []
  patterns:
    - Dexie v7 migration — additive schema (new tables, no upgrade function needed)
    - Rolling 3-month entitlement period (not calendar quarters) based on user's entitlementStart
    - All monetary amounts in integer pence (toPence/formatGBP utilities)
    - Running balance recalculation on every mutation (full ledger re-scan for correctness)
    - Budget side-effect: addDeposit automatically creates oneOffExpense record
key_files:
  created:
    - src/utils/childcare.js
    - src/utils/childcare.test.js
  modified:
    - src/db/schema.js
    - src/db/repository.js
decisions:
  - "Running balances are recalculated by re-scanning the full sorted ledger after each mutation rather than using incremental updates — ensures correctness even if entries are added out of order"
  - "getRemainingCap uses getEntitlementPeriod from childcare.js to compute period boundaries consistently — single source of truth for 3-month window logic"
  - "addDeposit calls getRemainingCap within the same transaction flow but outside the Dexie transaction block to avoid re-entrancy — _recalculateBalances called after transaction commits"
  - "Amount normalisation heuristic in addDeposit/addSpend: if numeric value > 10000, treat as already-in-pence; otherwise call toPence() — consistent with the project's toPence utility"
metrics:
  duration: 246s
  completed_date: "2026-03-01"
  tasks_completed: 3
  files_changed: 4
---

# Phase 09 Plan 01: TFC Data Layer & Business Logic Summary

**One-liner:** Dexie v7 childcare schema with rolling-quarter top-up engine, 19 unit tests, and budget expense integration via childcareRepository.addDeposit.

## What Was Built

Three foundational deliverables for the Tax-Free Childcare tracker data layer:

1. **Dexie v7 Migration** (`src/db/schema.js`): Added `childcareAccounts` and `childcareLedger` tables. No data migration needed — pure schema addition. `childcareLedger` is indexed by `accountId` for efficient per-account queries.

2. **TFC Calculation Utilities** (`src/utils/childcare.js`):
   - `calculateTopUp(depositPence, remainingCapPence)` — 25% bonus, capped at remaining quarterly capacity
   - `getEntitlementPeriod(entitlementStart, targetDate)` — rolling 3-month windows from personal start date (NOT calendar quarters)
   - `calculateFundingGap(targetSpend, balance)` — gap + 80% suggested deposit (so gov tops up the remaining 20%)

3. **Childcare Repository** (`src/db/repository.js`): Full CRUD for accounts, ledger queries, `addDeposit` (creates deposit + top-up entries + oneOffExpense), `addSpend`, `getBalance`, and `_recalculateBalances`.

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Dexie v7 Schema Migration | 7d5f5e2 | src/db/schema.js |
| 2 | TFC Calculation Utilities | 5ea1485 | src/utils/childcare.js, src/utils/childcare.test.js |
| 3 | Childcare Repository & Budget Integration | 5cace12 | src/db/repository.js |

## Key Decisions Made

- **Rolling entitlement periods**: Used the user's personal `entitlementStart` date for 3-month period boundaries rather than Jan/Apr/Jul/Oct calendar quarters. This matches UK TFC rules where each person has their own quarterly cycle.
- **25% not 20%**: The gov bonus is `deposit * 0.25` — "£2 for every £8" means 25% of the parent's contribution (20% of the total). Tests explicitly document this to prevent future regression.
- **Running balance full re-scan**: After each mutation, `_recalculateBalances` re-sorts and re-scans all ledger entries. This is slightly less efficient than incremental updates but guarantees correctness if entries ever arrive out of order.
- **Transaction boundary**: `getRemainingCap` is called inside `addDeposit` but outside the Dexie `transaction()` block. The Dexie `and()` filter in `getRemainingCap` queries the live table; placing the balance recalculation outside the transaction avoids potential re-entrancy issues with Dexie's transaction scope.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- 19 unit tests pass (`npx vitest run src/utils/childcare.test.js`)
- Production build succeeds: `npx vite build` (186 modules, 0 errors)
- Tests cover: 25% bonus math, cap enforcement at £500 standard / £1,000 disabled, rolling period boundaries across year boundaries, funding gap with deposit+top-up closure proof

## Self-Check: PASSED

All created/modified files exist on disk. All task commits verified in git log:
- 7d5f5e2: Schema v7 migration
- 5ea1485: TFC utilities + 19 tests
- 5cace12: Childcare repository
