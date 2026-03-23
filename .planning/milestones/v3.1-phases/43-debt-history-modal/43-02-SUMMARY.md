---
phase: 43-debt-history-modal
plan: "02"
subsystem: debts-ui
tags: [debt-history, amortisation, tdd, loan, mortgage]
dependency_graph:
  requires: [DEBT-05-stubs]
  provides: [generateHistoricalSchedule, payment-history-list-html]
  affects: [src/ui/debts.js]
tech_stack:
  added: []
  patterns: [TDD green-phase, safeHTML template interpolation, synchronous modal rendering]
key_files:
  created: []
  modified:
    - src/ui/debts.js
decisions:
  - "Used formatGBP (already imported) rather than formatCurrency as the plan referenced — same function, already in scope"
  - "Build historyHTML as a plain string before interpolating into safeHTML template — avoids nested safeHTML calls while letting DOMPurify sanitize everything together"
  - "generateHistoricalSchedule returns null (not []) when paymentStartDate missing, so UI can distinguish 'not configured' from 'no past payments'"
metrics:
  duration: "~7 minutes"
  completed: "2026-03-20T20:56:32Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 43 Plan 02: generateHistoricalSchedule and Payment History List Summary

**One-liner:** Synchronous loan/mortgage history modal extended with a scrollable payment history list via generateHistoricalSchedule filtering amortisation schedule entries to dates <= today.

## What Was Done

Added `generateHistoricalSchedule(debt)` method to `debtUI` in `src/ui/debts.js` and extended `_buildAmortisationModalHTML` to render a full payment history section below the existing amortisation summary.

### generateHistoricalSchedule

Placed immediately before `_buildAmortisationModalHTML` (line ~1009). Logic:

1. Returns `null` if `debt.paymentStartDate` or `debt.fixedMonthlyPayment` is missing.
2. Uses `debt.originalPrincipal` as the starting balance when it exceeds `currentBalance` (original loan amount); falls back to `currentBalance`.
3. Calls `calculateAmortisationSchedule` (already imported) with the loan parameters.
4. Filters the returned schedule to entries where `paymentDate <= today` (ISO string comparison).
5. Returns the filtered array, or `null` on calculation error.

### _buildAmortisationModalHTML changes

At the top of the method, calls `this.generateHistoricalSchedule(debt)` to get historical entries. Builds `historyHTML` as a plain string with three branches:

- **null** (no start date): shows "No payment start date set." + "Set start date" button calling `debtUI.editDebt(id)`.
- **[] empty**: shows "No historical payments found."
- **entries**: renders `<ul id="loan-history-list-{id}" class="loan-history-list">` where each `<li>` contains:
  - Payment date formatted as "DD MMM YYYY" (using `toLocaleDateString('en-GB', ...)`)
  - Scheduled amount: `formatGBP(principalPence + interestPence)`
  - Empty `<span class="loan-payment-status" id="loan-pmt-status-{id}-{date}">` — Plan 03 will populate these

The `historyHTML` string is interpolated into the `safeHTML` template tag, allowing DOMPurify to sanitize the full combined output. Method remains synchronous throughout.

## Verification

Final `npx vitest run src/ui/debts.test.js`:
- DEBT-05a: GREEN — generateHistoricalSchedule filters to past entries only
- DEBT-05b: GREEN — returns null when paymentStartDate missing
- DEBT-06/07: RED (expected — Plan 03 scope)
- Pre-existing 59 tests: all GREEN
- Total: 61 passed, 4 failed (expected failures only)

## Deviations from Plan

None — plan executed exactly as written. Used `formatGBP` in place of the plan's `formatCurrency` reference since `formatGBP` is the existing import in debts.js and is equivalent.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | dcaf532 | feat(43-02): add generateHistoricalSchedule method to debtUI |
| Task 2 | 1c3aaee | feat(43-02): extend _buildAmortisationModalHTML with payment history list |

## Self-Check

Files exist:
- [x] src/ui/debts.js — modified
- [x] .planning/phases/43-debt-history-modal/43-02-SUMMARY.md — this file

Commits exist:
- [x] dcaf532 — Task 1
- [x] 1c3aaee — Task 2

## Self-Check: PASSED
