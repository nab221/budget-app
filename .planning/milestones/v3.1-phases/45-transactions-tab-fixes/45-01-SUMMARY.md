---
phase: 45-transactions-tab-fixes
plan: 01
subsystem: testing
tags: [vitest, jsdom, tdd, transactions, wave-0]

# Dependency graph
requires:
  - phase: 44-income-tab-cards
    provides: income tab rendering and modal patterns used for test mock setup
provides:
  - "Failing test stubs for TRANS-01 through TRANS-08 in src/ui/transactions.test.js"
  - "Nyquist compliance — 8 requirements have named RED tests before implementation"
affects: [45-02, 45-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 TDD: write RED stubs before any implementation code (consistent with Phase 43/44 pattern)"
    - "jsdom test DOM must wrap <tbody> in <table> — bare <tbody> as direct body child is stripped by parser"

key-files:
  created:
    - src/ui/transactions.test.js
  modified: []

key-decisions:
  - "TRANS-05 covered by two it-blocks (sortOrder default + _buildMergedRows ascending) — both behaviors belong to same requirement"
  - "TRANS-03 stub builds DOM with old state (both buttons present) then asserts new state (no #toggleExpReconBtn) — test will GREEN when index.html is fixed"
  - "TRANS-07 stub builds DOM with stale placeholder then asserts new value — self-documenting contract, fails until index.html attribute is changed"
  - "setupTransactionsDOM wraps <tbody id=incBody> in <table> — jsdom strips bare tbody as invalid top-level HTML"

patterns-established:
  - "Pattern 1: DOM fixture for renderTransactions tests must use <table><tbody id=incBody></tbody></table> not bare <tbody>"
  - "Pattern 2: Wave 0 stubs use real mock data + real renderTransactions call to test output HTML — no placeholder assertions"

requirements-completed: []

# Metrics
duration: 36min
completed: 2026-03-21
---

# Phase 45 Plan 01: Transactions Test Scaffold Summary

**9 RED test stubs across 8 describe blocks covering TRANS-01 through TRANS-08, all failing with assertion errors, ready for Plans 02 and 03 to turn GREEN**

## Performance

- **Duration:** 36 min
- **Started:** 2026-03-21T22:32:35Z
- **Completed:** 2026-03-21T23:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `src/ui/transactions.test.js` with 9 failing `it` stubs covering all 8 TRANS requirements
- All 9 stubs fail with assertion errors — zero import/syntax errors
- Mock pattern follows `expenses.test.js`: mocks `./render.js`, `../db/repository.js`, `../utils/haptics.js`, `../utils/currency.js`, `../utils/filtering.js`, `./notifications.js`, `./heatmap.js`, `../utils/gestures.js`
- Discovered and fixed jsdom DOM parsing issue with bare `<tbody>` element (Rule 3 auto-fix during task)

## Task Commits

1. **Task 1: Write failing test stubs for TRANS-01 through TRANS-08** - `32e9068` (test)

## Files Created/Modified
- `src/ui/transactions.test.js` - 8 describe blocks, 9 failing test stubs for TRANS-01 through TRANS-08

## Decisions Made
- TRANS-05 has two `it` blocks: one for the `sortOrder` default property, one for `_buildMergedRows` ascending sort — both behaviors represent the same requirement and both must turn GREEN together
- TRANS-03 and TRANS-07 stubs build DOM with the current (pre-fix) state and assert the post-fix state — they serve as living documentation of what the HTML changes must deliver
- Kept `requirements-completed` empty because this is Wave 0 — requirements are TRANS-01 through TRANS-08 but none are GREEN yet; they will be completed in Plans 02 and 03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed jsdom stripping bare `<tbody>` element**
- **Found during:** Task 1 (write test stubs)
- **Issue:** `setupTransactionsDOM()` set `<tbody id="incBody">` as direct child of `<body>` — jsdom strips invalid top-level `<tbody>`, so `document.getElementById('incBody')` returned null after rendering, causing TypeError in TRANS-06 test
- **Fix:** Wrapped in `<table><tbody id="incBody"></tbody></table>` in the helper function
- **Files modified:** src/ui/transactions.test.js
- **Verification:** TRANS-06 test now fails with assertion error instead of TypeError
- **Committed in:** 32e9068 (task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix for correct test execution. No scope creep.

## Issues Encountered
- jsdom bare `<tbody>` parsing — resolved by wrapping in `<table>` (see deviation above)

## Next Phase Readiness
- All 8 TRANS requirement stubs are RED and committed
- Plans 02 and 03 can now implement fixes and turn stubs GREEN
- No blockers

---
*Phase: 45-transactions-tab-fixes*
*Completed: 2026-03-21*
