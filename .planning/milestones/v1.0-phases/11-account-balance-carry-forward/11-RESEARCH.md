# Phase 11: Account Balance Carry-Forward - Research

**Researched:** 2026-03-01
**Domain:** Financial Ledger Logic, IndexedDB Snapshots, Forecasting
**Confidence:** HIGH

## Summary
Implementation of a running balance requires a robust "Carry-Forward" engine that calculates monthly Opening and Closing balances. To ensure performance, we will use a Snapshot pattern where each month's closing state is stored, preventing the need to crawl the entire transaction history from the Hard Start Date (default Jan 1st 2026) on every load. Forecasting will extend 3 months into the future by combining actual confirmed transactions with "Projected" data from Recurrent Templates and Variable Category Targets.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Hard Start Date**: January 1st of the current year (configurable in settings).
- **Opening Balance**: A special "Opening Balance" transaction (Income) used to align with bank statements on the start date.
- **Carry-Forward**: Continuous chain where $Closing = Opening + Income - Expenses$.
- **Forecast Depth**: 3 months.
- **Visuals**: Future balances must be visually distinct.
- **Risk Indicators**: Low point warning (lowest dip in month) and Negative Balance Alert (Red card).
- **Technical**: Monthly Snapshots in DB for performance.

### Claude's Discretion
- Exact implementation of the background recalculation trigger.
- Mini-chart visualization library/setup (Chart.js recommended).

### Deferred Ideas (OUT OF SCOPE)
- Integration with Assets ledger for "Total Liquidity".
- Automated "Correction" transactions.

## Standard Stack

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^3.2.0 | IndexedDB Wrapper | Existing project DB engine. |
| date-fns | ^2.30.0 | Date Manipulation | Used in `finance.js` for payoff simulations. |
| Chart.js | ^4.0.0 | Visualizations | Used in `charts.js` for trends. |

## Architecture Patterns

### Recommended DB Schema Update
Add a `balanceSnapshots` table to `src/db/schema.js`:
```javascript
// Version 9 (Projected)
db.version(9).stores({
  // ... existing ...
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal'
});
```

### Carry-Forward Logic
The core engine in `src/utils/finance.js` should iterate through months from the Hard Start Date to the forecast end (Today + 3 months).

```javascript
/**
 * pseudo-logic for carry-forward chain
 */
export async function calculateBalanceChain(startDate, horizonMonths = 3) {
    let currentBalance = await getOpeningBalanceFor(startDate);
    const months = generateMonthList(startDate, addMonths(now(), horizonMonths));
    
    for (const month of months) {
        const actuals = await getActualsForMonth(month);
        const projections = (isFuture(month)) ? await getProjectionsForMonth(month) : { income: 0, expenses: 0 };
        
        const closing = currentBalance + (actuals.income + projections.income) - (actuals.expenses + projections.expenses);
        // Save/Update Snapshot
        await updateSnapshot(month, currentBalance, closing);
        currentBalance = closing;
    }
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic | Custom `new Date()` math | `date-fns` | Handles month-end boundaries and leaps correctly. |
| Mini-charts | SVG from scratch | Chart.js (Sparkline mode) | Consistent with existing trends chart. |

## Common Pitfalls

### Pitfall 1: O(N) Recalculation
**What goes wrong:** Re-calculating 5 years of history every time a transaction is edited.
**Prevention:** Use the `balanceSnapshots`. When a transaction is edited, only invalidate and recalculate snapshots *after* that transaction's month.

### Pitfall 2: Double-Counting Forecasts
**What goes wrong:** Adding a "Rent" template to the forecast when the user has already manually added the "Rent" transaction for next month.
**Prevention:** Logic must check if a transaction with the same Category + approximate Date exists before adding a Template/Target as a projection.

## Code Examples

### 3-Month Horizon Generation
```javascript
import { addMonths, startOfMonth, format } from 'date-fns';

const horizon = [];
let start = startOfMonth(new Date());
for (let i = 0; i < 4; i++) { // Current + 3 future
    horizon.push(format(addMonths(start, i), 'yyyy-MM'));
}
```

## Validation Architecture (Nyquist)
- **Framework:** Vitest (existing).
- **REQ-BAL-01**: Opening balance transaction creates correct starting point.
- **REQ-BAL-02**: Closing balance correctly becomes next month's opening.
- **REQ-FOR-01**: Future projection includes Recurrent Templates.
