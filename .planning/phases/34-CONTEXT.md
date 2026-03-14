
# Phase 34 Context: Pay-Period Affordability View

## Objective
Build a pay-period affordability view in the Dashboard tab. Given the user's pay date and income, show which recurring bills fall within each pay period, the cumulative outgoings, and the remaining disposable income after each bill. Flag any pay period where outgoings exceed income.

## Background

### User Problem
The user is paid monthly (or fortnightly). They want to know: "After all my bills come out this month, how much will I have left?" The current dashboard shows totals for a calendar month but does not align with the actual pay period (e.g. paid on the 25th → pay period is 25th–24th of next month).

### Pay Period Definition
- **Monthly pay:** period starts on `payDay` of month M, ends on `payDay - 1` of month M+1
- **Fortnightly pay:** period starts on `payDay`, ends 13 days later; repeats every 14 days
- **Weekly pay:** period starts on `payDay`, ends 6 days later; repeats every 7 days

### Data Sources
- Pay date: from `income` store — the user's salary entry has a `dayOfMonth` or `nextPayDate` field
- Recurring bills: from `recurrentExpenses` store — monthly, fortnightly, or weekly recurring expenses with `dayOfMonth` / `dayOfWeek`
- One-off bills in period: from `oneOffExpenses` store — any expense with a date falling in the pay period
- Banking adjustment: use `adjustedPaymentDate()` from Phase 31 to get the actual debit date for each bill

### Pay Period View — Layout
```
[Pay Period: 25 Mar – 24 Apr 2026]  [← Prev] [Next →]

Opening balance:  £2,450.00  (this month's net salary)

Date    Bill                    Amount    Running balance
─────────────────────────────────────────────────────────
01 Apr  Mortgage (adjusted*)   £1,050.00  £1,400.00
03 Apr  Council Tax             £180.00   £1,220.00
05 Apr  Broadband               £35.00    £1,185.00
...
24 Apr  Gym membership          £45.00    £XXX.00
─────────────────────────────────────────────────────────
Closing balance:  £XXX.00
* Date adjusted for bank holiday
```

### Deficit Warning
If `closingBalance < 0`: show a red banner "⚠️ This pay period has a projected deficit of £{amount}"
If `closingBalance < safetyBuffer` (user-configurable, default £200): show amber banner "⚠️ Closing balance is below your safety buffer"

### Interest-Bearing Debt Payments in Pay Period View
For loan/mortgage debts (Phase 32), the monthly payment shown in the pay period view must split the display into:
- Principal component: shown as an expense line
- Interest component: shown as a separate indented line with label "↳ of which interest: £{amount}"

This uses the amortisation schedule from `calculateAmortisationSchedule()` to look up the interest component for the current month.

### Schema Impact
```js
// src/db/schema.js — settings store additions:
payDay: number | 'variable'  // fixed day 1–31, or 'variable' when entered manually each period
payFrequency: 'monthly' | 'fortnightly' | 'weekly'
safetyBuffer: number    // pence, default 20000 (= £200)
```

### Cloud Sync Registration
If a `settings` or `userPreferences` store holds the pay period configuration (`payDay`, `payFrequency`, `safetyBuffer`), this store must be registered in the cloud sync module so pay-period preferences sync across devices.

## New Module: src/utils/pay-period.js

```js
export function getPayPeriodBounds(payDay, payFrequency, referenceDate)
// → { start: Date, end: Date }

export function getBillsInPayPeriod(allRecurring, allOneOff, start, end, bankingCalendar)
// → Array<{ date: Date, name: string, amount: number, isAdjusted: boolean, debtId?: string }>
// sorted by date ascending

export function calculatePayPeriodSummary(openingBalance, bills, safetyBuffer = 20000)
// → { rows: Array<{ ...bill, runningBalance }>, closingBalance, isDeficit, isBelowBuffer }
```

## Files to Change
- `src/utils/pay-period.js` — new module
- `src/utils/pay-period.test.js` — new test file
- `src/db/schema.js` — add pay period settings fields, bump version
- `src/db/repository.js` — settings CRUD
- `src/ui/dashboard.js` — render pay period view section
- `src/ui/cloud-sync.js` — register settings/userPreferences store

## Acceptance Criteria
- [ ] Pay period view renders in Dashboard tab below existing summary cards
- [ ] Opening balance equals net salary for the period
- [ ] All recurring expenses with adjusted dates falling in the period appear in the table
- [ ] All one-off expenses with dates in the period appear in the table
- [ ] Running balance column updates correctly after each row
- [ ] Closing balance matches opening balance minus sum of all bills
- [ ] Deficit warning banner shown when closing balance < 0
- [ ] Safety buffer warning shown when closing balance < `safetyBuffer` but ≥ 0
- [ ] Interest split shown for loan/mortgage payments (principal + interest line)
- [ ] Navigation arrows correctly advance/retreat by one pay period
- [ ] Pay day and pay frequency are user-configurable in Settings
- [ ] Settings persist across sessions (saved to IndexedDB `settings` store)
- [ ] Pay period settings sync to cloud
- [ ] All 354+ existing Vitest tests pass
- [ ] New `pay-period.js` tests achieve ≥ 90% branch coverage

## Test Cases
```
// getPayPeriodBounds
- Monthly, payDay 25, reference date 10 Apr → period 25 Mar – 24 Apr
- Monthly, payDay 31, reference date Feb → must handle short months correctly
- Fortnightly, reference date mid-period → correct 14-day window
- Weekly, reference date → correct 7-day window

// getBillsInPayPeriod
- Recurring monthly bill on 1st, pay period 25 Mar–24 Apr → included (1 Apr falls in period)
- Recurring monthly bill on 25th, pay period 25 Mar–24 Apr → included (25 Mar) but not the next one (25 Apr is outside period)
- Bill adjusted to next working day → adjusted date checked against period bounds
- One-off expense on date within period → included

// calculatePayPeriodSummary
- Empty bills list → closingBalance = openingBalance
- Bills exceed income → isDeficit = true
- Bills reduce balance below `safetyBuffer` passed to `calculatePayPeriodSummary()` → `isBelowBuffer = true`
```

## Resources
- `src/utils/banking-calendar.js` — Phase 31 module (banking day adjustment)
- `src/utils/recurrence.js` — recurring expense date generation
- `src/utils/finance.js` — `calculateAmortisationSchedule()` (Phase 32)
- `src/ui/dashboard.js` — existing dashboard render logic
