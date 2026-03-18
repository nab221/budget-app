# Phase 34 Context: Pay-Period Affordability View

## Objective
Build a pay-period affordability view in the Dashboard tab. Given the user's current balance, upcoming committed outgoings, estimated spending buckets, and the configured income-source events produced by Phase 33, show how much they can safely pay extra toward debts before the next income event.

## Background

### User Problem
The user may have multiple income sources arriving on different schedules. They want to know: "Before the next configured income arrives, how much will I have left after my bills and planned spending?" The current dashboard shows calendar-month totals and does not align with the merged income-event timeline from Phase 33.

### Pay Period Definition
- Phase 33 provides a merged, date-sorted collection of upcoming income events across all active income sources
- The default affordability window starts at the current balance snapshot date and ends at the next upcoming adjusted income event
- Navigator movement is based on consecutive income-event boundaries from that collection, not a single global `payDay` or salary record

### Data Sources
- Income events: derived from the `incomeSources` store via Phase 33 helpers (`getNextIncomeEvent()`, `getUpcomingIncomeEvents()`)
- Recurring bills: from `recurrentExpenses` store — monthly, fortnightly, or weekly recurring expenses with `dayOfMonth` / `dayOfWeek`
- One-off bills in period: from `oneOffExpenses` store — any expense with a date falling in the affordability window
- Spending buckets: from `spendingBuckets` store — prorated into the window as estimated committed outgoings
- Current balance snapshot: from Phase 34 balance entry flow (PLAN-01)
- Banking adjustment: use `adjustedPaymentDate()` from Phase 31 for bill timing; income event dates arrive pre-adjusted from Phase 33

### Pay Period View — Layout
```
[Window: 15 Mar – 25 Mar 2026]  [← Prev] [Next →]
Next income: NHS Salary  £2,450.00

Opening balance:  £1,120.00  (current balance snapshot)

Date    Bill                    Amount    Running balance
─────────────────────────────────────────────────────────
18 Mar  Mortgage (adjusted*)   £1,050.00  £70.00
20 Mar  Council Tax             £180.00   -£110.00
22 Mar  Groceries (prorated)    £95.00    -£205.00
...
25 Mar  Next income boundary    £0.00     £XXX.00
─────────────────────────────────────────────────────────
Projected balance at next income:  £XXX.00
* Date adjusted for bank holiday
```

### Deficit Warning
If `closingBalance < 0`: show a red banner "⚠️ This pay period has a projected deficit of £{amount}"
If `closingBalance >= 0 && closingBalance < safetyBuffer` (user-configurable, default £200): show amber banner "⚠️ Closing balance is below your safety buffer"

### Interest-Bearing Debt Payments in Pay Period View
For loan/mortgage debts (Phase 32), the monthly payment shown in the pay period view must split the display into:
- Principal component: shown as an expense line
- Interest component: shown as a separate indented line with label "↳ of which interest: £{amount}"

This uses the amortisation schedule from `calculateAmortisationSchedule()` to look up the interest component for the current month.

### Schema Impact
```js
// src/db/schema.js — affordability settings additions:
safetyBuffer: number    // pence, default 20000 (= £200)
```

Phase 34 should not introduce a separate `payDay` or `payFrequency` setting as the source of truth. Income timing comes from Phase 33 `incomeSources` configuration.

### Cloud Sync Registration
If a `settings`, `userPreferences`, or balance-snapshot store holds the affordability configuration (`safetyBuffer`, latest balance snapshot), that store must be registered in `src/utils/supabase-sync.js` so affordability preferences sync across devices via the generic snapshot flow (`registerSnapshotStore`, `exportSnapshot`, `importSnapshot`) over `db.tables`.

## New Module: src/utils/pay-period.js

```js
export function getPayPeriodBounds(incomeEvents, referenceDate)
// → { start: Date, end: Date, nextIncomeEvent: object | null }

export function getBillsInPayPeriod(allRecurring, allOneOff, spendingBuckets, start, end, bankingCalendar)
// → Array<{ date: Date, name: string, amount: number, isAdjusted: boolean, debtId?: string }>
// sorted by date ascending

export function calculatePayPeriodSummary(openingBalance, bills, safetyBuffer = 20000)
// → { rows: Array<{ ...bill, runningBalance }>, closingBalance, isDeficit, isBelowBuffer }
```

## Files to Change
- `src/utils/pay-period.js` — affordability-window helpers over Phase 33 income events
- `src/utils/pay-period.test.js` — new test file
- `src/db/schema.js` — add affordability settings fields if not already present, bump version
- `src/db/repository.js` — settings / balance snapshot CRUD as needed
- `src/ui/dashboard.js` — render pay period view section
- `src/utils/supabase-sync.js` — register settings / balance snapshot store if required

## Acceptance Criteria
- [ ] Pay period view renders in Dashboard tab below existing summary cards
- [ ] The next pay-period boundary is derived from configured income-source events, not a singular salary or `payDay` setting
- [ ] Opening balance equals the current balance snapshot entered by the user
- [ ] All recurring expenses with adjusted dates falling in the period appear in the table
- [ ] All one-off expenses with dates in the period appear in the table
- [ ] Prorated spending buckets appear in the period summary
- [ ] Running balance column updates correctly after each row
- [ ] Closing balance matches opening balance minus sum of all bills
- [ ] Deficit warning banner shown when closing balance < 0
- [ ] Safety buffer warning shown when closing balance < `safetyBuffer` but ≥ 0
- [ ] Interest split shown for loan/mortgage payments (principal + interest line)
- [ ] Navigation arrows correctly advance/retreat by one pay period boundary
- [ ] Settings persist across sessions (saved to IndexedDB where applicable)
- [ ] Pay period settings sync to cloud
- [ ] All existing Vitest tests pass
- [ ] New `pay-period.js` tests achieve ≥ 90% branch coverage

## Test Cases
```
// getPayPeriodBounds
- Two monthly sources (25th and last working day), reference date 10 Apr → next boundary is the earliest adjusted upcoming income event
- Three active sources in the same month → returned boundary uses the earliest adjusted date after sorting
- No active sources → returns null boundary and downstream logic handles empty state

// getBillsInPayPeriod
- Recurring monthly bill on 1st, window ending at next income event on 25 Mar → included when it falls within bounds
- Bill adjusted to next working day → adjusted date checked against period bounds
- One-off expense on date within period → included
- Spending buckets prorated into the same window → included in sorted output

// calculatePayPeriodSummary
- Empty bills list → closingBalance = openingBalance
- Bills exceed opening balance → isDeficit = true
- Bills reduce balance below `safetyBuffer` passed to `calculatePayPeriodSummary()` → `isBelowBuffer = true`
```

## Resources
- `src/utils/banking-calendar.js` — Phase 31 module (banking day adjustment)
- `src/utils/recurrence.js` — recurring expense date generation
- `src/utils/finance.js` — `calculateAmortisationSchedule()` (Phase 32)
- `src/utils/income.js` — Phase 33 upcoming income-event helpers
- `src/ui/dashboard.js` — existing dashboard render logic
