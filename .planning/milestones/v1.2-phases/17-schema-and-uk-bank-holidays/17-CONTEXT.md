# Phase 17: Schema & UK Bank Holidays Context

## Goal
Implement Schema v10 and UK Bank Holiday integration to support the Daily Cash Flow Engine.

## Requirements
- **SCHEMA-01.1**: Implement Schema v10 including `dailyBalanceSnapshots`, `expectedIncome`, and `bankHolidayOverrides`.
- **SCHEMA-01.2**: Implement robust migrations for Schema v10.
- **SCHEMA-01.3**: Add repositories for new tables in `src/db/repository.js`.
- **SCHEMA-01.4**: UK Bank Holiday handling via gov.uk API integration.
- **SCHEMA-01.5**: Offline caching for UK Bank Holiday data.

## Technical Details
- **dailyBalanceSnapshots**: `++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal`
- **expectedIncome**: `++id, date, source, amount, categoryId, status (predicted, confirmed)`
- **bankHolidayOverrides**: `++id, date, isOpen`
- **Update recurrentExpenses**: include `predictedPaymentDate` in schema stores.
- **Migration**: initialize existing `recurrentExpenses` with `predictedPaymentDate = nextDate`.
- **src/utils/cashflow.js**: `fetchHolidays()`, `isBankHoliday(date)`, `isWorkingDay(date)`, `nextWorkingDay(date)`.
- **gov.uk API**: `https://www.gov.uk/bank-holidays.json` (england-and-wales section).
- **Caching in localStorage**: `'bank-holidays-cache'` with timestamp.
- **New repositories**: `dailyBalanceRepository`, `expectedIncomeRepository`, `bankHolidayRepository`.

## Locked Decisions
- [Milestone v1.2]: UK-centric focus initially for bank holiday logic (gov.uk API).
- [Milestone v1.2]: Offline-first priority: UK Bank Holiday data must be cached for the engine to work offline.
- [Milestone v1.2]: Schema v10 is the required version.
