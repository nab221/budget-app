# Phase 18-02 Summary: Repository Integration

## Objective
Update repository to support bulk operations and integrate the forecast trigger into the mutation workflow.

## Changes
- **src/db/repository.js**:
    - Added `bulkSave(snapshots)` to `dailyBalanceRepository`. This method efficiently clears the forecast horizon before adding new snapshots to prevent duplicates.
    - Implemented `triggerDailyForecastRecalc(date)`. This function lazy-imports the forecast engine, calculates a 90-day horizon from the affected date, and persists it.
    - Wired `triggerDailyForecastRecalc` to the following repositories (add, update, delete methods):
        - `incomeRepository`
        - `recurrentExpenseRepository`
        - `oneOffExpenseRepository`
        - `expectedIncomeRepository` (new)
    - Ensured that both monthly balance carry-forward and daily cash flow forecasting are triggered on data mutations.

## Verification Results
- All repository mutations now include calls to both monthly and daily recalculation triggers.
- Database consistency is maintained through `bulkSave`'s range-deletion logic.
- Application refresh events are dispatched after forecast updates.
