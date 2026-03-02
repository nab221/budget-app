---
phase: 21-data-layer-and-repository
plan: 02
subsystem: Repository
tags: [statements, expenses, dexie-transaction]
requires: [21-01]
provides: [Atomic Statement/Expense creation, Payment recording]
affects: [src/db/repository.js]
tech-stack: [Dexie.js]
key-files: [src/db/repository.js]
decisions: [Link statements and expenses using linkedExpenseId/linkedStatementId fields]
metrics:
  duration: 15m
  completed_date: "2026-03-02T15:35:00.000Z"
---

# Phase 21 Plan 02: Implement statementRepository extensions Summary

Expanded `statementRepository` with high-level methods for managing debt statement lifecycles.

## Substantive Changes
- Implemented `addWithExpense(statementData, debtName)`:
    - Atomically creates a statement and a linked recurrent expense for the minimum payment.
    - Uses a Dexie transaction to ensure consistency.
    - Sets up bidirectional links: `statement.linkedExpenseId` and `expense.linkedStatementId`.
- Implemented `recordPayment(statementId, actualAmount, paymentDate)`:
    - Updates the statement with the actual payment details.
    - Automatically marks the linked expense as 'paid' and updates its amount/date.
- Added triggers for balance and daily forecast recalculations after mutations.

## Key Changes
- `statementRepository`: Now an object with custom methods instead of just a base repository.
- Linkage: Uses `isDebtPayment: true` flag on expenses to identify debt-related payments.
- Automation: Automatically finds the 'Credit Cards & Loans' category for linked expenses.

## Deviations
None - plan executed exactly as written.

## Self-Check: PASSED
- [x] `addWithExpense` implements atomic transaction.
- [x] `recordPayment` updates both entities.
- [x] Triggers are called.
- [x] Commits made.
