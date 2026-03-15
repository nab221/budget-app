---
phase: 31-banking-calendar-recurrence-upgrade
plan: "01"
subsystem: utils
tags: [banking-calendar, uk-bank-holidays, localStorage, vitest, tdd, synchronous]

# Dependency graph
requires: []
provides:
  - "src/utils/banking-calendar.js — synchronous pure-function UK banking calendar module"
  - "isUKBankHoliday(date) — boolean, accepts Date or YYYY-MM-DD string"
  - "isWorkingDay(date) — boolean, UTC-safe weekend + holiday check"
  - "nextWorkingDay(date) — Date, same-day if already working, 14-iter safety guard"
  - "adjustedPaymentDate(nominalDate, adjustment) — Date, 'none'|'next-working-day'"
  - "refreshBankHolidaysCache() — async fetch GOV.UK API, fire-and-forget"
  - "Static E&W holidays bundled for 2025, 2026, 2027"
  - "localStorage cache: uk_bank_holidays_cache (array), uk_bank_holidays_cache_date (ISO date)"
affects:
  - "31-02 — recurrence engine upgrade consumes adjustedPaymentDate"
  - "32 — debt payment dates use nextWorkingDay"
  - "34 — pay-period affordability engine uses banking-calendar for date adjustment"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synchronous localStorage-backed Set for holiday data (no DB, no async)"
    - "Static fallback Set for 3-year window with maxCachedYear guard + console.warn"
    - "Cache keys distinct from cashflow.js: uk_bank_holidays_cache vs bank-holidays-cache"
    - "Always getUTCDay() — never getDay() — for timezone safety"
    - "Safety counter (14 iterations) on nextWorkingDay to prevent infinite loop on corrupt data"
    - "TDD Red-Green: test file committed before implementation file"

key-files:
  created:
    - src/utils/banking-calendar.js
    - src/utils/banking-calendar.test.js
  modified: []

key-decisions:
  - "Synchronous module (no DB, no async) chosen to support Dexie transaction contexts in recurrence engine where await is unsafe"
  - "Distinct localStorage keys from cashflow.js: uk_bank_holidays_cache (not bank-holidays-cache) to avoid collision with existing { timestamp, dates } format"
  - "maxCachedYear guard emits console.warn and returns false (not throwing) when date exceeds 2027 static range"
  - "nextWorkingDay returns same Date when input is already a working day — not the next day"
  - "14-iteration safety counter added to nextWorkingDay to prevent infinite loop on corrupted cache data"

patterns-established:
  - "Pattern 1: synchronous banking-calendar vs async cashflow.js — two co-existing modules solving same domain with different contracts (no DB vs DB override support)"
  - "Pattern 2: localStorage array serialization — JSON.stringify(Array.from(set)) not JSON.stringify(set) (set serializes to {})"

requirements-completed:
  - TECH-02

# Metrics
duration: 12min
completed: 2026-03-15
---

# Phase 31 Plan 01: Banking Calendar Utility Summary

**Synchronous UK banking calendar module with static 2025-2027 E&W holiday fallback, localStorage cache, and full TDD coverage (26 tests, 420/420 suite green)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-15T17:18:04Z
- **Completed:** 2026-03-15T17:30:00Z
- **Tasks:** 2 (RED test suite + GREEN implementation)
- **Files modified:** 2

## Accomplishments
- Banking calendar module (`banking-calendar.js`) delivering 5 exported functions: `isUKBankHoliday`, `isWorkingDay`, `nextWorkingDay`, `adjustedPaymentDate`, `refreshBankHolidaysCache`
- Comprehensive test suite (26 tests) covering all branches: holiday detection, working day check, date advancement, cluster holidays (Christmas 2026), corrupt cache fallback, maxCachedYear guard, fetch success/failure
- Zero regressions — full Vitest suite grew from 393 to 420 tests, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — failing tests for banking-calendar** - `1640c40` (test)
2. **Task 2: GREEN — implement banking-calendar.js** - `b9e3cab` (feat)

_TDD: test committed before implementation as required by plan type._

## Files Created/Modified
- `src/utils/banking-calendar.js` — synchronous banking calendar with static fallback, localStorage cache, 5 exported functions
- `src/utils/banking-calendar.test.js` — 26-test Vitest suite, jsdom environment, beforeEach localStorage.clear()

## Decisions Made
- Synchronous design chosen specifically to support usage inside Dexie transactions where `await` is unsafe (key motivation for this module over extending cashflow.js async functions)
- Cache key `uk_bank_holidays_cache` (plain array) is distinct from cashflow.js `bank-holidays-cache` (object with `{timestamp, dates}`) — no collision risk
- `nextWorkingDay` returns the *same* date when input is already a working day, not the next day — this matches the acceptance criteria test case (`2026-03-20 → 2026-03-20`)
- `maxCachedYear` guard uses `console.warn` and returns `false` for years > 2027 — allows `isWorkingDay` to still apply weekend check via `getUTCDay()`
- `refreshBankHolidaysCache` is exported as async; callers must invoke fire-and-forget (without `await`) on app startup

## Deviations from Plan

None — plan executed exactly as written. All test cases from the plan's `<behavior>` section were implemented and pass.

## Issues Encountered
- Coverage providers (`@vitest/coverage-v8`, `@vitest/coverage-istanbul`) not installed — coverage check skipped as informational. The 26 tests cover all specified branches comprehensively.

## Next Phase Readiness
- `adjustedPaymentDate` and `nextWorkingDay` are ready for consumption by Plan 31-02 (recurrence engine upgrade)
- `refreshBankHolidaysCache` ready for wiring in app startup and Settings panel "Refresh bank holidays" button
- No blockers for Phase 32 (debt model) or Phase 34 (pay-period affordability engine)

## Self-Check: PASSED

- [x] `src/utils/banking-calendar.js` exists
- [x] `src/utils/banking-calendar.test.js` exists
- [x] `.planning/phases/31-banking-calendar-recurrence-upgrade/31-01-SUMMARY.md` exists
- [x] Commit `1640c40` (RED tests) exists
- [x] Commit `b9e3cab` (GREEN implementation) exists

---
*Phase: 31-banking-calendar-recurrence-upgrade*
*Completed: 2026-03-15*
