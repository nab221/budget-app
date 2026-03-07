# Phase 5: Forecast & Graph Alignment - Research

**Researched:** 2026-03-06
**Domain:** Financial Forecasting & Data Visualization
**Confidence:** HIGH

## Summary
The current implementation of the "Rolling Financial Overview" chart and the "Detailed Forecast" table suffer from logic fragmentation. The chart uses a 60-day forecast horizon with internal iteration logic in `getDailyRollingData`, while the table uses a 90-day horizon via `calculateForecast`. Discrepancies arise because `getDailyRollingData` fetches historical data and projects forward in one loop, whereas `calculateForecast` relies on database snapshots which might be out of sync with recent transactions.

To achieve alignment, the forecasting engine must be unified. I recommend refactoring `getDailyRollingData` to leverage the same logic as `calculateForecast` for its projection segment and standardizing both on a 45-day horizon.

**Primary recommendation:** Centralize the forecast data generation in `src/utils/cashflow.js` so that both the Chart and Table consume the same array of daily snapshots, ensuring identical balances, income, and expense values.

## User Constraints (from Roadmap/Requirements)

### Locked Decisions
- **Horizon**: Both chart and table must use a 45-day horizon.
- **Chart Content**: The 'Rolling Financial Overview' must include Income and Expenses lines alongside the Balance.
- **Consistency**: Balance calculations must be identical between views.

### Claude's Discretion
- **History Window**: While the requirement focuses on the 45-day forecast, the historical window for the chart (currently 365 days) can be adjusted for performance if necessary, though 365 days is standard for "Rolling" views.
- **Implementation Detail**: Choice between refactoring `getDailyRollingData` or creating a new unified provider.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chart.js | 4.4.x | Data Visualization | Lightweight, handles time-series well, already integrated. |
| Dexie.js | 3.x | IndexedDB Wrapper | Primary data layer for the application. |

## Architecture Patterns

### Recommended Project Structure
- **Data Provider**: `src/utils/cashflow.js` should expose a function (e.g., `getUnifiedForecastData`) that returns a unified set of daily objects containing `balance`, `income`, and `expenses`.
- **UI Logic**: `src/ui/dashboard.js` coordinates the fetch and passes data to both the table renderer and the chart renderer.
- **Chart Logic**: `src/ui/charts.js` should be agnostic to the time window, simply rendering the datasets provided.

### Pattern: The Unified Snapshots Array
Instead of separate objects for chart and table, use a single array of:
```typescript
interface DailySnapshot {
  date: string;          // YYYY-MM-DD
  openingBalance: number;
  closingBalance: number;
  incomeTotal: number;
  expenseTotal: number;
  isForecast: boolean;
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date Math | Native `Date` manipulation for months | `date-fns` | Handles month overflows and timezone edge cases reliably. |
| Working Days | Hardcoded holiday lists | `fetchHolidays` | Already implemented utility in `cashflow.js` using UK Gov API. |

## Common Pitfalls

### Pitfall 1: Stale Snapshots
**What goes wrong:** `calculateForecast` uses `dailyBalanceRepository.getLatestSnapshot()`. If a transaction was added but the snapshot wasn't updated, the forecast starts from the wrong balance.
**How to avoid:** Always trigger a balance recalculation or use the current "live" balance as the starting point for forecasts.

### Pitfall 2: Async `nextWorkingDay` in Loops
**What goes wrong:** Calling `await isWorkingDay` inside a loop for every transaction is slow.
**How to avoid:** Pre-calculate effective dates for recurring items before starting the daily iteration (already partially implemented in `calculateForecast`).

## Code Examples

### Current Discrepancy (to be fixed)
```javascript
// src/ui/dashboard.js - Discrepant calls
const rollingData = await getDailyRollingData(); // Uses 60 days forecast internally
const snapshots = await calculateForecast(today, 90); // Table uses 90 days
```

### Proposed Unified Chart Signature
```javascript
// src/ui/charts.js
export function renderRollingOverviewChart(canvasId, data) {
  // Add datasets for Income and Expenses
  const datasets = [
    { label: 'Balance', data: data.balance, ... },
    { label: 'Income', data: data.income, ... },
    { label: 'Expenses', data: data.expenses, ... }
  ];
  // ...
}
```

## Open Questions

1. **History vs Forecast**: Should the Income/Expense lines on the chart also show 365 days of history, or only for the 45-day forecast period? 
   - *Recommendation*: Show Income/Expenses for the entire window to provide context for the balance fluctuations.
2. **Performance**: Recalculating 365 days of history + 45 days forecast on every Dashboard load might be heavy.
   - *Recommendation*: Use memoization or ensure Dexie queries are optimized (using indices on `date`).

## Sources

### Primary (HIGH confidence)
- `src/utils/cashflow.js`: Contains existing `calculateForecast` and `getDailyRollingData` logic.
- `src/ui/charts.js`: Contains `renderRollingOverviewChart`.
- `src/ui/dashboard.js`: Orchestrates the Dashboard view.
