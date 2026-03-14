---
phase: 11-account-balance-carry-forward
plan: 01
subsystem: database
tags: [dexie, indexeddb, balance-carry-forward, snapshots, finance-engine]

# Dependency graph
requires:
  - phase: 10-advanced-debt-and-payoff
    provides: schema v8 with promoEndDate/postPromoApr on debts
  - phase: 09-tax-free-childcare-tracker
    provides: childcareAccounts/childcareLedger tables, repository patterns
  - phase: 08-income-expenses-refinement
    provides: incomeRepository, oneOffExpenseRepository, recurrentExpenseRepository
provides:
  - "Dexie schema v9 with balanceSnapshots table indexed by month"
  - "Opening Balance system category seeding (idempotent, survives upgrades)"
  - "balanceSnapshotRepository with getByMonth, save (upsert), deleteFrom, getLatestSnapshot"
  - "calculateBalanceChain engine: monthly carry-forward with Opening Balance seed support"
  - "Mutation hooks on incomeRepository and oneOffExpenseRepository triggering background recalculation"
  - "triggerBalanceRecalc helper: invalidates stale snapshots and re-runs chain"
affects:
  - phase 11 plan 02 (UI display of balance chain)
  - dashboard balance card

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy dynamic import in triggerBalanceRecalc to avoid circular dependency at module init"
    - "Fire-and-forget async trigger with .catch(() => {}) for non-blocking mutations"
    - "Dependency injection pattern in calculateBalanceChain for testable DB-dependent code"
    - "In-memory Dexie table mock factory for repository unit tests in Vitest (no IndexedDB needed)"

key-files:
  created:
    - src/db/repository.test.js
  modified:
    - src/db/schema.js
    - src/db/repository.js
    - src/utils/finance.js
    - src/utils/finance.test.js

key-decisions:
  - "balanceSnapshots indexed by month string (YYYY-MM) — simple string comparison enables deleteFrom range deletion"
  - "Opening Balance category stored with group=system to distinguish from user-created categories"
  - "calculateBalanceChain accepts deps injection for unit tests; uses lazy dynamic import for live DB path"
  - "triggerBalanceRecalc uses dynamic import to break circular dependency (repository imports finance, finance imports repository)"
  - "Only incomeRepository and oneOffExpenseRepository trigger recalc; recurrentExpenses are date-agnostic standing commitments so mutations there trigger on nextDate changes (deferred to UI layer)"
  - "isProjection flag set on months beyond current calendar month for UI differentiation"

patterns-established:
  - "Dep-injection pattern: pass { getIncome, getRecurrent, getOneOff, getOpeningBalCatId, saveSnapshot } to calculateBalanceChain for testing"
  - "Mock table factory in test files: createMockTable(initialRows) returns { toArray, add, update, delete, bulkDelete, where, count, _rows }"

requirements-completed: [BAL-01, BAL-02, BAL-03]

# Metrics
duration: 6min
completed: 2026-03-01
---

# Phase 11 Plan 01: Seed Category, Schema, Repository & Calculation Engine Summary

**Dexie v9 balanceSnapshots table, Opening Balance category seed, snapshot repository, and calculateBalanceChain carry-forward engine with background recalculation triggers**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-01T16:20:08Z
- **Completed:** 2026-03-01T16:26:16Z
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments

- Added `balanceSnapshots` table to Dexie schema v9 with month index for fast month-keyed lookup
- Implemented `balanceSnapshotRepository` (getByMonth, save/upsert, deleteFrom, getLatestSnapshot) with 14 unit tests
- Implemented `calculateBalanceChain(startDate, horizonMonths, deps)` in `finance.js` with correct carry-forward arithmetic, Opening Balance seed support, and isProjection flag; 7 unit tests
- Wired `incomeRepository` and `oneOffExpenseRepository` mutation methods (add/update/delete) to fire-and-forget `triggerBalanceRecalc` calls; total test suite grew from 57 to 78 tests, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Seed Category, Schema & Repository** - `0e74f66` (feat)
2. **Task 2: Carry-Forward Calculation Engine** - `b0280a8` (feat)
3. **Task 3: Integration & Recalculation Triggers** - `75e708b` (feat)

**Plan metadata:** _(final docs commit follows)_

## Files Created/Modified

- `src/db/schema.js` - Added Dexie v9 with `balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal'`
- `src/db/repository.js` - Added `ensureOpeningBalanceCategory`, `balanceSnapshotRepository`, `triggerBalanceRecalc`, and mutation hooks on income/oneOff repos
- `src/db/repository.test.js` - 14 unit tests for balanceSnapshotRepository and ensureOpeningBalanceCategory using in-memory mock Dexie tables
- `src/utils/finance.js` - Added `calculateBalanceChain` with dep injection, loop, arithmetic, isProjection flag, and lazy DB imports
- `src/utils/finance.test.js` - 7 new tests for calculateBalanceChain (arithmetic, carry-forward, Opening Balance seed, projections, zero-data)

## Decisions Made

- `balanceSnapshots` uses month string index (YYYY-MM) rather than a numeric timestamp — avoids timezone complications and allows simple string comparison in `deleteFrom`
- "Opening Balance" category uses `group: 'system'` to clearly separate it from user categories
- `calculateBalanceChain` uses dependency injection for the test path and lazy `import()` for the live DB path to avoid circular module dependency (repository.js would import finance.js and vice versa)
- `triggerBalanceRecalc` resolves the same circular dependency by using a dynamic `import('./repository.js')` inside the async function body — safe because module is fully loaded before any mutation calls
- Only `incomeRepository` and `oneOffExpenseRepository` get mutation hooks in this plan; `recurrentExpenseRepository` is left for plan 02 (recurrent items use `nextDate`, not `date`, requiring different recalc logic)
- `isProjection: true` flag set on months beyond the current calendar month so the UI can render them differently (dashed lines, different styling)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The circular dependency between `repository.js` and `finance.js` was anticipated and resolved cleanly using dynamic imports.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Data layer is complete: schema, repository, calculation engine, and recalculation triggers all in place
- Plan 02 can build the UI balance card and forward-projection display on top of this foundation
- The `calculateBalanceChain` function is ready to be called on app startup or tab open to ensure snapshots are current

## Self-Check: PASSED

- src/db/schema.js: FOUND
- src/db/repository.js: FOUND
- src/db/repository.test.js: FOUND
- src/utils/finance.js: FOUND
- src/utils/finance.test.js: FOUND
- 11-01-SUMMARY.md: FOUND
- Commit 0e74f66: FOUND
- Commit b0280a8: FOUND
- Commit 75e708b: FOUND

---
*Phase: 11-account-balance-carry-forward*
*Completed: 2026-03-01*
