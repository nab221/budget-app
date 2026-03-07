---
phase: 21-data-layer-and-repository
plan: 01
subsystem: DB
tags: [schema, dexie]
requires: []
provides: [Database Schema v11]
affects: [src/db/schema.js]
tech-stack: [Dexie.js]
key-files: [src/db/schema.js]
decisions: [Schema v11 expansion for enhanced debt tracking]
metrics:
  duration: 10m
  completed_date: "2026-03-02T15:15:00.000Z"
---

# Phase 21 Plan 01: Update database schema Summary

Updated the database schema to version 11 to support enhanced debt tracking.

## Substantive Changes
- Defined schema version 11 with expanded `statements` and `recurrentExpenses` tables.
- Added migration logic to initialize new fields for existing records.

## Key Changes
- `statements`: Added `openingBalance`, `minimumPayment`, `paymentDueDate`, `actualPaymentAmount`, `actualPaymentDate`, and `linkedExpenseId`.
- `recurrentExpenses`: Added `isDebtPayment` and `linkedStatementId`.
- Indexing: Added `actualPaymentDate` and `linkedExpenseId` to `statements` store string. Added `isDebtPayment` and `linkedStatementId` to `recurrentExpenses` store string.

## Deviations
None - plan executed exactly as written.

## Self-Check: PASSED
- [x] `src/db/schema.js` defines version 11.
- [x] Upgrade logic initializes all new fields.
- [x] Commits made.
