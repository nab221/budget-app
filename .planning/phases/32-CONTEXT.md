
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

### Amortisation Calculation Detail (Simple Monthly Interest)
This uses simple monthly interest — no daily compounding.

**Formula per month:**
1. `monthlyInterest = outstandingBalance × (annualInterestRate / 12)`
2. `principalReduction = monthlyPayment - monthlyInterest`
3. `newBalance = outstandingBalance - principalReduction`

**Worked example (months 1–3):**
- Starting balance: £10,000.00, APR: 4.9%, Monthly payment: £300.00
- Month 1: interest = £10,000 × 0.049/12 = £40.83, principal = £259.17, balance = £9,740.83
- Month 2: interest = £9,740.83 × 0.049/12 = £39.77, principal = £260.23, balance = £9,480.60
- Month 3: interest = £9,480.60 × 0.049/12 = £38.70, principal = £261.30, balance = £9,219.30
- Continue until balance ≤ 0

**Guard:** If `monthlyPayment ≤ monthlyInterest` (payment doesn't cover interest), the function must throw `Error('Monthly payment does not cover interest — loan will never be repaid')` rather than looping infinitely.

### Confirm Current Balance Flow
After an overpayment, the user confirms the actual outstanding balance:
1. User taps "Confirm Current Balance" on a loan/mortgage debt card
2. Modal opens: "Enter your current outstanding balance" with a currency input
3. User submits → the debt record's `outstandingBalance` is updated in IndexedDB
4. The amortisation schedule is recalculated immediately
5. The updated `projectedPayoffDate` and `remainingTermMonths` are displayed
6. A toast: "Balance updated. New payoff date: [Month Year]"

**Confirm flow validation:**
- New balance must be > 0 and < previous balance (cannot increase balance via this flow)
- If new balance ≥ previous balance: show inline error "New balance must be less than current balance"
- If new balance ≤ 0: show inline error "Balance must be greater than zero"

### Cloud Sync Registration
The `debts` store changes in this phase (new `debtType`, `annualInterestRate`, `monthlyPayment` fields). The cloud sync module (`src/ui/cloud-sync.js`) maintains a list of stores to sync. Ensure `debts` remains registered and the new fields are included in the sync payload.

## Schema Changes (Dexie)
```js
// src/db/schema.js — add to debts store:
debtType: 'credit-card' | 'personal-loan' | 'mortgage'  // new, default 'credit-card'
annualInterestRate: number  // decimal (e.g. 0.049), required for loan/mortgage
monthlyPayment: number      // pence, required for loan/mortgage
// paymentDayOfMonth and paymentAdjustment already added in Phase 31
```
Dexie version bump required. Migration: set `debtType = 'credit-card'` for all existing records.

## Files to Change
- `src/db/schema.js` — add `debtType`, `annualInterestRate`, `monthlyPayment` fields, bump version
- `src/db/repository.js` — migration, new CRUD helpers for loan/mortgage fields
- `src/utils/finance.js` — add `calculateAmortisationSchedule(params)` pure function
- `src/utils/finance.test.js` — add amortisation tests
- `src/ui/debts.js` — conditional UI rendering based on `debtType`
- `src/ui/debts.test.js` — extend tests
- `src/ui/cloud-sync.js` — ensure `debts` store registered with new fields

## Acceptance Criteria
- [ ] Credit card debt cards render identically to before (no regression)
- [ ] Loan/mortgage debt cards show: outstanding balance, monthly payment, APR, projected payoff date, remaining months, total interest remaining
- [ ] No PDF upload or statement import controls on loan/mortgage cards
- [ ] `calculateAmortisationSchedule()` produces correct schedule for the worked example above (verified in unit tests)
- [ ] Guard: function throws if monthly payment ≤ monthly interest
- [ ] "Confirm Current Balance" modal updates `outstandingBalance` and recalculates schedule
- [ ] Balance validation: new balance must be > 0 and < previous balance (inline errors shown otherwise)
- [ ] Toast confirms new payoff date after balance update
- [ ] `debts` store changes are reflected in cloud sync payload
- [ ] All 354+ existing Vitest tests pass
- [ ] New amortisation tests achieve ≥ 95% branch coverage

## Test Cases (Finance Utils)
```
// calculateAmortisationSchedule
- Standard loan: verify month 1–3 figures against worked example above
- Loan paid off exactly on final payment (no negative balance)
- Guard: payment ≤ interest → throws
- Overpayment scenario: confirm balance update + schedule recalc

// debtType migration
- Existing record with no debtType → defaults to 'credit-card'
- New loan record → correct fields persisted and retrieved
```

## Resources
- `src/utils/finance.js` — existing finance utility functions
- `src/db/schema.js` — current schema
- `src/ui/debts.js` — existing debt UI rendering logic
