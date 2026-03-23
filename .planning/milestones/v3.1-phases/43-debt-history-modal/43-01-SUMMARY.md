---
phase: 43-debt-history-modal
plan: "01"
subsystem: debts-tests
tags: [tdd, debt-history, test-stubs, vitest]
dependency_graph:
  requires: []
  provides: [DEBT-05-stubs, DEBT-06-stubs, DEBT-07-stubs]
  affects: [src/ui/debts.test.js]
tech_stack:
  added: []
  patterns: [TDD red-phase stubs, vi.fn mock extension]
key_files:
  created: []
  modified:
    - src/ui/debts.test.js
decisions:
  - "Used real assertions in stubs (not placeholder expect(true).toBe(false)) so Plan 02 executor has exact contracts to satisfy"
  - "Extended recurrentExpenseRepository mock with getAll and add methods at the vi.mock level, not just in beforeEach, to ensure module-level mock resolution"
  - "DEBT-06c asserts add is not called when update is used — prevents silent duplication regression"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-20T20:46:12Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 43 Plan 01: TDD Red Phase — Debt History Test Stubs Summary

**One-liner:** Failing test stubs for generateHistoricalSchedule, getConfirmedPaymentMap, and confirmLoanPayment with real assertions defining the implementation contracts.

## What Was Done

Added 6 failing test cases to `src/ui/debts.test.js` covering the three functions Phase 43 will implement. Extended the `recurrentExpenseRepository` mock in the module-level `vi.mock` block to include `getAll` (returning a loan payment fixture) and `add` methods.

### Test Cases Added

| Test ID | Describe Block | Description |
|---------|---------------|-------------|
| DEBT-05a | DEBT-05: generateHistoricalSchedule | Returns only schedule entries with paymentDate <= today |
| DEBT-05b | DEBT-05: generateHistoricalSchedule | Returns null when paymentStartDate is missing |
| DEBT-06a | DEBT-06: getConfirmedPaymentMap | Returns Map keyed by paymentDate for the given debtId |
| DEBT-06b | DEBT-06 / DEBT-07: confirmLoanPayment | Creates new recurrentExpense when no existing record for date |
| DEBT-06c | DEBT-06 / DEBT-07: confirmLoanPayment | Updates existing record when one already exists for that debt+date |
| DEBT-07a | DEBT-06 / DEBT-07: confirmLoanPayment | Uses user-supplied amountPounds, not any scheduled amount |

### Mock Changes

Extended `recurrentExpenseRepository` in `vi.mock('../db/repository.js', ...)`:

```javascript
recurrentExpenseRepository: {
  getAll: vi.fn().mockResolvedValue([
    { id: 99, linkedDebtId: 1, isDebtPayment: true, status: 'paid',
      date: '2024-01-15', nextDate: '2024-01-15', amount: 500 }
  ]),
  add: vi.fn().mockResolvedValue(100),
  update: vi.fn().mockResolvedValue(undefined),
},
```

## Verification

Final `npx vitest run src/ui/debts.test.js` result:
- 6 new tests FAILING (RED) — `debtUI.generateHistoricalSchedule is not a function`, `debtUI.getConfirmedPaymentMap is not a function`, `debtUI.confirmLoanPayment is not a function`
- 59 pre-existing tests PASSING

## Deviations from Plan

None — plan executed exactly as written. The plan noted "5 new test cases" but the action block specified 6 distinct `it()` calls (2 + 4); all 6 were added as specified.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 542133b | test(43-01): add DEBT-05 failing test stubs and extend recurrentExpenseRepository mock |
| Task 2 | 884626e | test(43-01): add DEBT-06 and DEBT-07 failing test stubs |

## Self-Check

Files exist:
- [x] src/ui/debts.test.js — modified
- [x] .planning/phases/43-debt-history-modal/43-01-SUMMARY.md — this file

Commits exist:
- [x] 542133b — Task 1
- [x] 884626e — Task 2

## Self-Check: PASSED
