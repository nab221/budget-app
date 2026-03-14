# Phase 32 Context: Debt Model Refactor — Loans & Mortgage

## Objective
Introduce a `debtType` discriminator into the debt schema to distinguish credit cards from loans and mortgages. Remove statement-based management from loan/mortgage debt cards. Add a predictive amortisation model for loans and mortgages. Add a "Confirm Current Balance" action for ad-hoc balance updates after overpayments.

## Background

### Current Problem
All debt types (credit card, personal loan, mortgage) use the same UI model which assumes statement-based management. Loans and mortgages do not have monthly statements — they have a fixed schedule with predictable amortisation. The user wants:
- To see remaining balance, remaining term, and projected payoff date for loans/mortgages
- To confirm the actual balance after making an overpayment (outside the regular schedule)
- No PDF upload or statement import UI on loan/mortgage cards

### Debt Type Taxonomy
```
debtType: 'credit-card'    → existing statement flow (unchanged)
debtType: 'personal-loan'  → amortisation model, no statements
debtType: 'mortgage'       → amortisation model, no statements
```

### Amortisation Model
Given:
- `outstandingBalance` (pence)
- `annualInterestRate` (decimal, e.g. 0.049 for 4.9%)
- `monthlyPayment` (pence)
- `paymentDayOfMonth` (int, 1–28)
- `paymentAdjustment` ('none' | 'next-working-day')

Compute:
- Full amortisation schedule (month-by-month: payment, interest, principal, balance)
- `projectedPayoffDate` — the month/year when balance reaches zero
- `remainingTermMonths`
- `totalInterestRemaining`

This computation belongs in `src/utils/finance.js` as a pure function: `calculateAmortisationSchedule(params)`.

### "Confirm Current Balance" Flow
A button on loan/mortgage debt cards: "Update Current Balance". Opens a modal where the user enters the actual current balance (from their online banking). This sets a new anchor point for the amortisation model without altering the payment schedule.

## Schema Changes
```js
// debts table — add fields:
debtType: String      // 'credit-card' | 'personal-loan' | 'mortgage' (default: 'credit-card' for migration)
annualInterestRate: Number  // decimal APR (e.g. 0.049)
monthlyPayment: Number      // pence — scheduled monthly payment
paymentDayOfMonth: Number   // 1–28
paymentAdjustment: String   // 'none' | 'next-working-day'
confirmedBalance: Number    // pence — latest user-confirmed balance (overrides computed)
confirmedBalanceDate: String // ISO date of last confirmation
```

All existing debt records migrate with `debtType: 'credit-card'` as default.

## UI Changes — Debt Cards (src/ui/debts.js)

### Credit Card Card (debtType === 'credit-card')
- Unchanged — keep existing statement import, PDF upload, reconciliation flow

### Loan/Mortgage Card (debtType === 'personal-loan' | 'mortgage')
- **Remove:** "Import Statement" button, PDF upload input, statement table
- **Add:** Amortisation summary KPIs:
  - Current Balance
  - Monthly Payment
  - Projected Payoff Date
  - Total Interest Remaining
- **Add:** Remaining term progress bar (e.g. `[████░░░░] 42 months remaining`)
- **Add:** "Update Current Balance" button → balance confirmation modal
- **Add:** Expandable amortisation schedule table (first 12 months visible, "Show all" toggle)

## Files to Change
- `src/db/schema.js` — add new fields, bump Dexie version
- `src/db/repository.js` — migration defaults, new query methods
- `src/utils/finance.js` — `calculateAmortisationSchedule()` function
- `src/utils/finance.test.js` — tests for amortisation
- `src/ui/debts.js` — conditional rendering by `debtType`
- `src/ui/debts.test.js` — update tests for new schema fields
- `src/ui/payoff.js` — update payoff planner to use amortisation schedule for loans/mortgage

## Acceptance Criteria
- [ ] Adding a new debt with type "Personal Loan" or "Mortgage" shows the amortisation UI, not the statement UI
- [ ] Credit card debt cards are visually and functionally unchanged
- [ ] Existing debt records (migrated to `debtType: 'credit-card'`) continue to work
- [ ] `calculateAmortisationSchedule({ outstandingBalance: 1000000, annualInterestRate: 0.049, monthlyPayment: 50000 })` produces a correct schedule (verify first 3 months manually)
- [ ] "Update Current Balance" modal saves the new balance and updates the projected payoff date
- [ ] Amortisation chart shows remaining balance over time
- [ ] Payoff planner includes loan/mortgage projected payoff in the consolidated schedule
- [ ] All 354+ existing tests pass; new tests added for amortisation logic

## Technical Notes
- Dexie migration must be incremental — bump version by 1, add fields in `upgrade()` callback
- Monthly interest formula: `monthlyInterest = outstandingBalance × (annualInterestRate / 12)`
- Guard against runaway schedules: cap at 600 months (50 years) to prevent infinite loops
- `confirmedBalance` takes precedence over computed balance when present and date is recent (< 90 days)
