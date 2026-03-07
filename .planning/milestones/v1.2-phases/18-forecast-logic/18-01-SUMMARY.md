# Phase 18-01 Summary: Forecast Engine TDD

## Objective
Implement the core 90-day day-by-day iteration engine with weekend and holiday adjustment logic using TDD.

## Changes
- **src/utils/cashflow.js**:
    - Implemented `calculateForecast(startDate, horizonDays)`.
    - Integrated logic to fetch all relevant data (income, expenses, snapshots).
    - Added day-by-day iteration that calculates opening/closing balances.
    - Implemented recurrent expense adjustment: shifts expenses to the next working day before including them in the daily total.
    - Used UTC-safe date handling to prevent timezone-related off-by-one errors.
- **src/utils/cashflow.test.js**:
    - Added unit tests for `calculateForecast`.
    - Verified 90-day generation.
    - Verified recurrent expense shifting (Saturday to Monday).
    - Verified balance accumulation across multiple days.

## Verification Results
- All 10 unit tests in `src/utils/cashflow.test.js` passed successfully.
- Core forecast engine is robust and handles weekends/holidays as required.
