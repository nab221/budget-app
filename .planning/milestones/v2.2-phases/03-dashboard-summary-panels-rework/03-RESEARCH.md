# Phase 3: Dashboard Summary Panels Rework - Research

**Researched:** 2024-05-24
**Domain:** UI/UX, Dashboard, Financial Calculations
**Confidence:** HIGH

## Summary

This phase involves a significant overhaul of the dashboard's summary grid to simplify expense tracking and provide more actionable debt and cash flow insights. The primary changes include merging one-off and recurrent expenses into a single "EXPENSES" card, adding specific panels for Credit Card and Loan/Mortgage payments, and introducing "CURRENT BALANCE" and "NEXT NEGATIVE" alerts derived from the balance chain and daily forecast systems.

**Primary recommendation:** Use the existing `calculateBalanceChain` for monthly snapshots and `dailyBalanceRepository` for granular daily forecasts to drive the new balance and alert panels. Leverage the `type` field in the `debts` table to categorize payments.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^3.2.0 | Database | Existing persistence layer |
| date-fns | ^2.30.0 | Date Manipulation | Used throughout the app for period calculations |
| Chart.js | ^4.0.0 | Data Visualization | Used for the dashboard charts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| currency.js | N/A | Currency Formatting | Internal utility `src/utils/currency.js` |

## Architecture Patterns

### Recommended Project Structure
- `src/ui/dashboard.js`: Main entry point for rendering the dashboard. Will require updates to the `cards` array in `renderDashboard`.
- `src/utils/finance.js`: contains `calculateBalanceChain` which provides the "CURRENT BALANCE" data.
- `src/utils/cashflow.js`: contains `calculateForecast` which provides the "NEXT NEGATIVE" data.
- `src/db/repository.js`: handles data fetching for debts, income, and snapshots.

### Pattern: Card Filtering and Mapping
The `renderDashboard` function uses a `cards` array to define the summary grid. This pattern should be extended to dynamically include/exclude cards based on data (e.g., the "NEXT NEGATIVE" card).

### Anti-Patterns to Avoid
- **Hardcoding Debt Types**: Use the `type` field from the database rather than string matching names.
- **Redundant Calculations**: Fetch data once and pass it down to helper functions rather than re-querying the database in each panel.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency Formatting | `Number.toLocaleString` | `formatGBP` / `formatGBPShort` | Consistent styling and pence handling |
| Date Math | `new Date()` arithmetic | `date-fns` | Handles edge cases (e.g., end of month) correctly |
| Balance Chain | New logic | `calculateBalanceChain` | Already handles "Opening Balance" and carry-forward |

## Common Pitfalls

### Pitfall 1: Divide by Zero in Ratios
**What goes wrong:** If `income` is 0, calculating percentage of income results in `Infinity` or `NaN`.
**How to avoid:** Always guard with `income > 0 ? (payment / income) * 100 : 0`.

### Pitfall 2: Stale Forecast Data
**What goes wrong:** The "NEXT NEGATIVE" alert might show old data if the forecast hasn't been recalculated after a transaction change.
**How to avoid:** Ensure `triggerDailyForecastRecalc` is called on all relevant mutations (already implemented in `repository.js`).

### Pitfall 3: CC Extra Payment Allocation
**What goes wrong:** Adding `payoffExtra` to both "CREDIT CARD" and "LOAN" panels or misallocating it.
**How to avoid:** The requirements specify adding extra payments specifically to the "CREDIT CARD PAYMENTS" panel.

## Code Examples

### Calculating Debt Payment Totals
```javascript
const debts = await debtRepository.getAll();
const today = new Date();

let ccMinPayments = 0;
let loanMortgagePayments = 0;

for (const debt of debts) {
  const min = calcMinPayment(debt.currentBalance, debt.apr, 0, today, debt.promoEndDate);
  if (debt.type === 'credit_card') {
    ccMinPayments += min;
  } else if (debt.type === 'loan' || debt.type === 'mortgage') {
    loanMortgagePayments += min;
  }
}

const extraPence = (parseFloat(localStorage.getItem('payoffExtra')) || 0) * 100;
const totalCCPayments = ccMinPayments + extraPence;
const ccPercent = data.income > 0 ? Math.round((totalCCPayments / data.income) * 100) : 0;
```

### Finding Next Negative Balance
```javascript
const dailySnapshots = await dailyBalanceRepository.getAll();
const todayStr = new Date().toISOString().split('T')[0];
const threeMonthsFromNow = new Date();
threeMonthsFromNow.setDate(threeMonthsFromNow.getDate() + 90);
const horizonStr = threeMonthsFromNow.toISOString().split('T')[0];

const nextNegative = dailySnapshots
  .filter(s => s.date >= todayStr && s.date <= horizonStr)
  .sort((a, b) => a.date.localeCompare(b.date))
  .find(s => s.closingBalance < 0);

if (nextNegative) {
  // Show "NEXT NEGATIVE" panel with nextNegative.date and nextNegative.closingBalance
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One-off vs Recurrent panels | Single "EXPENSES" panel | Phase 3 | Simplified view of total spend |
| General Debt card | Specialized CC/Loan panels | Phase 3 | Better visibility into debt service costs |

## Open Questions

1. **"CURRENT BALANCE" precision**: Should it be the closing balance of the *current month* from the balance chain, or a real-time calculation based on the daily snapshots?
   - **Recommendation**: Use the current month's closing balance from `balanceSnapshotRepository` (populated by `calculateBalanceChain`) for consistency with existing UI, but label it clearly.
2. **Extra Payment Allocation**: If the user has a Loan but no Credit Cards, should the extra payment still be shown in a CC panel (at £0 + extra) or shifted?
   - **Recommendation**: Always show the CC panel if any debt exists or if extra payment is configured, to maintain grid layout stability.

## Sources

### Primary (HIGH confidence)
- `src/db/schema.js`: Verified `type` field in `debts` table.
- `src/ui/dashboard.js`: Reviewed existing card rendering logic.
- `src/utils/finance.js`: Reviewed `calculateBalanceChain` logic.
- `src/utils/cashflow.js`: Reviewed `calculateForecast` logic.

### Secondary (MEDIUM confidence)
- `src/ui/debts.js`: Verified supported debt types (`credit_card`, `loan`, `mortgage`, etc.).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Core libraries are stable.
- Architecture: HIGH - Fits well into existing dashboard patterns.
- Pitfalls: HIGH - Common edge cases (zero income, stale data) are well-understood.

**Research date:** 2024-05-24
**Valid until:** 2024-06-24
