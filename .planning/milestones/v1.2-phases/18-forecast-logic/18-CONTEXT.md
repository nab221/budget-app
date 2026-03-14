# Phase 18 - Forecast Logic: Context

## 1. User Decisions & Constraints

### 1.1 Decisions
- **Forecast Horizon**: 90 days (day-by-day iteration).
- **Core Formula**: `opening + income - expenses = closing`.
- **Opening Balance Retrieval**: Try the latest `dailyBalanceSnapshot` before today, or fallback to the latest `balanceSnapshot` (monthly) before today.
- **Adjusted Expense Date Logic**: Recurrent expenses falling on weekends or bank holidays move to the NEXT working day. One-off expenses remain on their original date (assumed to be manual entry on the exact date).
- **Triggers**: Recalculation should be triggered when income, recurrentExpenses, oneOffExpenses, or expectedIncome records are modified.
- **Performance**: Use bulk operations for database writes. Calculations should be done in-memory before bulk save.

### 1.2 Deferred Ideas
- Historical prediction for expected income (moved to Phase 19).
- Advanced visualisations/charts (moved to Phase 20).

## 2. Technical Research Summary

### 2.1 Standard Stack
- **Database**: Dexie.js (Schema v10).
- **Test Runner**: Vitest (used in Phase 17).
- **Date Handling**: Native `Date` objects with YYYY-MM-DD string format for storage/keys.

### 2.2 Architecture Patterns
- **Utility-first**: Forecast engine lives in `src/utils/cashflow.js`.
- **Repository Pattern**: All DB interactions through `src/db/repository.js`.
- **Trigger-based**: Background recalculation triggered by mutations.

### 2.3 Key Considerations
- **Bank Holiday Integration**: Must use `isWorkingDay` and `nextWorkingDay` from `src/utils/cashflow.js` (already implemented in Phase 17).
- **Recurrent Expense Status**: Only include `active` recurrent expenses in the forecast.
- **Expected Income**: Must include entries from `expectedIncome` table.
- **Opening Balance Edge Case**: If no snapshots exist, initial opening balance should be derived from the "Opening Balance" category record or be 0.
