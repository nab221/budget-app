---
phase: 27-recurrence-utility
plan: 01
subsystem: logic
tags: [recurrence, date-fns, automation]
dependency-graph:
  requires: [26-01-PLAN]
  provides: [v1.5-LOGIC-01, v1.5-LOGIC-02, v1.5-LOGIC-03]
  affects: [src/utils/recurrence.js, src/utils/recurrence.test.js]
tech-stack:
  added: [date-fns]
  patterns: [Recurrence Projection, Repository Pattern, Mocking]
key-files:
  created: [src/utils/recurrence.js, src/utils/recurrence.test.js]
  modified: []
decisions:
  - Use `date-fns` for all date math to ensure consistent handling of month-ends and leap years.
  - Base all future projections on a `parentDate` to prevent cumulative drift in series (e.g., Jan 31 -> Feb 28 -> Mar 31 instead of Mar 28).
  - Implement a 2-month "horizon" check to automatically expand recurring series as they approach their end.
metrics:
  duration: 45m
  completed-date: 2026-03-03
---

# Phase 27 Plan 01: Core Recurrence Utility & Manager Summary

Implemented the core logic for automatic recurring transactions, including a pure function for projecting future instances and a manager for background expansion of active series.

## One-liner
Implemented and verified recurrence projection logic and automated series expansion using `date-fns` and Dexie transactions.

## Changes Made

### src/utils/recurrence.js
- Implemented `generateInstances(base, frequency, count)`:
    - Supports `weekly`, `biweekly`, `monthly`, `quarterly`, and `annually`.
    - Uses `parentDate` anchoring to prevent month-end drift.
    - Preserves all transaction metadata while stripping primary keys.
    - Generates or preserves `recurrenceId`.
- Implemented `RecurrenceManager.checkAndGenerate()`:
    - Scans `recurrentExpenses` and `oneOffExpenses`.
    - Identifies series with less than 2 months of future coverage.
    - Expands series by 12 instances within a Dexie transaction.

### src/utils/recurrence.test.js
- Created comprehensive test suite for `generateInstances` covering all frequencies.
- Implemented mocked database tests for `RecurrenceManager` to verify:
    - Detection of nearing-expiry series.
    - Idempotency for well-covered series.
    - Correct identification of the latest instance in a series.

## Deviations from Plan
- Added `isBefore` to `date-fns` imports to simplify date comparisons in the manager.
- Added a fallback for `crypto.randomUUID()` in environments where it might be unavailable (e.g., non-secure contexts or older test environments).

## Verification Results
- **Unit Tests**: 12/12 passed (`npm test src/utils/recurrence.test.js`).
- **Logic Check**: Verified that Jan 31 + 1 month correctly results in Feb 28, and Jan 31 + 2 months (from parent) results in Mar 31.
- **DB Integration**: Verified transaction-based bulk insertion for expansion.

## Self-Check: PASSED
- [x] `generateInstances` correctly calculates future dates for all frequencies.
- [x] Recurrence metadata is preserved and shared across instances.
- [x] `RecurrenceManager` identifies and expands series nearing the 2-month horizon.
- [x] Automated tests pass in Vitest.
