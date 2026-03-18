---
phase: 32-debt-model-refactor-loans-mortgage
plan: 02
subsystem: debt-ui
tags: [dexie, schema-migration, amortisation, confirm-balance, tdd]
dependency_graph:
  requires: [32-01]
  provides: [schema-v20, debt-confirmBalance, amortisation-modal, confirm-balance-flow]
  affects: [src/db/schema.js, src/db/repository.js, src/ui/debts.js]
tech_stack:
  added: []
  patterns: [safeHTML-no-nesting, inline-error-span, threshold-warning-confirm]
key_files:
  created: []
  modified:
    - src/db/schema.js
    - src/db/repository.js
    - src/ui/debts.js
    - src/ui/debts.test.js
    - src/db/repository.test.js
decisions:
  - Schema v20 adds paymentDayOfMonth to debts store (default 1 via upgrade()); forward-compat with calculateAmortisationSchedule param
  - confirmBalance() in debtRepository accepts raw pence; validation delegated to UI caller for inline error display
  - _buildAmortisationModalHTML wraps calculateAmortisationSchedule in try/catch; renders error paragraph on failure (guard against zero-payment loans)
  - submitConfirmBalance validates > 0 then >= currentBalance checks in that order; 5% threshold uses Math.abs ratio; window.confirm wording includes computed percentage
  - AMORT-02 and AMORT-03 (mortgage/credit-card checks) were already passing before GREEN phase — existing type checks were already correct for those paths
metrics:
  duration: 45 minutes
  completed_date: "2026-03-15"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 5
requirements_completed: [DEBT-01, DEBT-03]
---

# Phase 32 Plan 02: Amortisation UI and Confirm Balance Flow Summary

Wired `calculateAmortisationSchedule()` into the debt UI — loan/mortgage cards now show a 6-row amortisation panel with a Confirm Current Balance flow (inline validation, 5% divergence warning, toast), while credit card cards are unchanged.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Schema v20 and confirmBalance() repository helper | 4d915c5 | Done |
| 2 | Amortisation modal panel and Confirm Balance flow | 0f21ade | Done |
| 3 | Human verification of amortisation UI | — | Approved by user |

## What Was Built

### Task 1: Schema v20 + confirmBalance()
- `db.version(20)` added to `src/db/schema.js` — adds `paymentDayOfMonth` to the debts store index string; upgrade callback sets default value of `1` on all existing records
- `debtRepository.confirmBalance(id, newBalancePence)` added to `src/db/repository.js` — reads existing debt, updates `currentBalance`, triggers sync, returns `{ previousBalance, newBalance }`
- 3 TDD tests (DEBT-CB-01, CB-02, CB-03) added to `src/db/repository.test.js`

### Task 2: Amortisation Modal + Confirm Balance Flow
- Import of `calculateAmortisationSchedule` added to `src/ui/debts.js`
- `export const CONFIRM_BALANCE_WARNING_THRESHOLD = 0.05` constant added
- `_buildAmortisationModalHTML(debt)` — calls `calculateAmortisationSchedule`, shows 6-row data table (Outstanding Balance, Monthly Payment, APR, Projected Payoff, Remaining Term, Total Interest Remaining) plus hidden confirm balance form with input and inline error span
- `_buildHistoryModalHTML(debt)` — branches at top: `personal-loan | mortgage | loan` → amortisation panel; `credit-card` (default) → unchanged statement flow
- `openConfirmBalanceForm(debtId)` — toggles hidden class on confirm form, clears error span
- `submitConfirmBalance(debtId)` — validates > 0, validates < currentBalance, checks 5% threshold with `window.confirm`, calls `debtRepository.confirmBalance()`, recalculates schedule for payoff date, shows toast, refreshes modal
- 8 TDD tests (AMORT-01 to 05, CB-VALID-01 to 03) added to `src/ui/debts.test.js`

## Test Results

- 453 Vitest tests pass (11 new tests added this plan)
- `npm run build` succeeds (no errors, only existing chunk size warning)

## Deviations from Plan

None — plan executed exactly as written. The only minor observation: AMORT-02 (mortgage modal does not contain Import PDF) and AMORT-03 (credit-card modal contains Log Statement) were already green before the GREEN implementation because the existing code already had `type === 'credit-card'` guards. AMORT-01 correctly failed (RED) because `personal-loan` was not yet excluded from the statement flow.

## Self-Check: PASSED

- src/db/schema.js: FOUND
- src/db/repository.js: FOUND
- src/ui/debts.js: FOUND
- 32-02-SUMMARY.md: FOUND
- commit 4d915c5: FOUND
- commit 0f21ade: FOUND
- 453 Vitest tests pass
- npm run build succeeds
