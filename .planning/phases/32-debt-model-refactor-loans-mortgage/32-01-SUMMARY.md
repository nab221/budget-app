---
phase: 32-debt-model-refactor-loans-mortgage
plan: "01"
subsystem: finance-utils
tags: [tdd, amortisation, loans, mortgage, pure-function]
dependency_graph:
  requires: []
  provides: [calculateAmortisationSchedule]
  affects: [src/utils/finance.js, src/utils/finance.test.js]
tech_stack:
  added: []
  patterns: [TDD red-green, integer-pence arithmetic, date-fns setDate/addMonths, adjustedPaymentDate delegation]
key_files:
  created: []
  modified:
    - src/utils/finance.js
    - src/utils/finance.test.js
decisions:
  - "Plan's month 2/3 worked example had rounding drift; corrected to match actual JavaScript Math.round() output (see Rule 1 deviation)"
  - "adjustedPaymentDate imported at top of finance.js (used only for next-working-day branch); no circular dependency introduced"
  - "setDate(addMonths(start, month), paymentDayOfMonth) produces correct nth-of-month dates via date-fns"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-15"
  tasks_completed: 3
  files_modified: 2
requirements:
  - DEBT-01
---

# Phase 32 Plan 01: calculateAmortisationSchedule — TDD Implementation Summary

**One-liner:** Month-by-month amortisation schedule engine with integer-pence arithmetic, paymentDayOfMonth control, next-working-day adjustment, and payoff-guard.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| RED | Write failing tests for calculateAmortisationSchedule | cfcc19c | src/utils/finance.test.js |
| GREEN | Implement calculateAmortisationSchedule | 0efb2e8 | src/utils/finance.js, src/utils/finance.test.js |

## What Was Built

`calculateAmortisationSchedule()` is a pure synchronous function exported from `src/utils/finance.js`. It accepts:

- `outstandingBalance` — integer pence
- `annualInterestRate` — decimal (e.g. 0.049 for 4.9%)
- `monthlyPayment` — integer pence
- `paymentDayOfMonth` — int 1-28, defaults to 1
- `paymentAdjustment` — `'none'` | `'next-working-day'`, defaults to `'none'`
- `startDate` — ISO date or Date, defaults to today

It returns:

```javascript
{
  schedule: [{ month, interestPence, principalPence, balancePence, paymentDate }],
  projectedPayoffDate,    // 'MMM yyyy'
  remainingTermMonths,    // === schedule.length
  totalInterestRemaining  // sum of all interestPence entries
}
```

### Algorithm

Per month:
1. `interestPence = Math.round(balance * annualInterestRate / 12)`
2. `actualPayment = Math.min(monthlyPayment, balance + interestPence)` — handles final underpayment
3. `principalPence = actualPayment - interestPence`
4. `balancePence = max(0, balance - principalPence)` — clamped to prevent negative

Payment date: `setDate(addMonths(startDate, month), paymentDayOfMonth)`, optionally adjusted via `adjustedPaymentDate()` for next-working-day logic.

### Guards

- **Payment-vs-interest guard:** throws `'Monthly payment does not cover interest — loan will never be repaid'` when `firstMonthInterest >= monthlyPayment`
- **maxMonths guard:** throws `'Loan term exceeds 50 years — check parameters'` if loop exceeds 600 iterations

## Test Coverage

14 new tests added. All 442 Vitest tests pass (428 pre-existing + 14 new).

Test cases:
- Month 1 exact pence values (worked example)
- Months 2 and 3 exact pence values
- Guard throw for payment <= interest
- Final balance clamped to 0
- `remainingTermMonths === schedule.length`
- `totalInterestRemaining === sum(interestPence)`
- `projectedPayoffDate` format matches `MMM yyyy`
- `paymentDayOfMonth` defaults to 1
- `paymentDayOfMonth=15` sets all dates to 15th
- `paymentAdjustment=none` matches default
- maxMonths guard throw
- Required fields on each schedule entry
- Return shape validation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected plan's worked example month 2/3 pence values**
- **Found during:** GREEN phase — tests failed with off-by-1 pence
- **Issue:** The PLAN.md worked example stated month 2 interest = 3,977p and month 3 = 3,870p. Actual `Math.round(974083 * 0.049 / 12)` = 3,978p and `Math.round(948061 * 0.049 / 12)` = 3,871p. The plan values had rounding drift from intermediate manual arithmetic.
- **Fix:** Updated test expected values to match correct JavaScript `Math.round()` computation. Implementation was correct; tests were corrected.
- **Files modified:** `src/utils/finance.test.js`
- **Commit:** 0efb2e8

## Self-Check

- [x] `src/utils/finance.js` — `calculateAmortisationSchedule` exported
- [x] `src/utils/finance.test.js` — 14 new tests present
- [x] Commit cfcc19c — RED tests
- [x] Commit 0efb2e8 — GREEN implementation + test corrections
- [x] 442 tests pass (verified from background task output)
