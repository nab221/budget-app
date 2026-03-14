# Phase 35 Context: Childcare Top-Up Planner

## Objective
Extend the Childcare tab to answer "how much do I need to top up the Tax-Free Childcare account this period?" per child. Surface the required top-up as a committed outgoing in the pay-period affordability calculation. Make entitlement period information clearly visible.

## Background

### Tax-Free Childcare Accounts (UK)
- Government scheme: for every £8 deposited, the government adds £2 (up to £500 top-up per quarter, £1,000 for disabled children)
- The account is used to pay childcare providers (nursery, childminder, etc.)
- The user has two children, each with their own account
- The user needs to know: "I need to pay £650 to the nursery this month and £200 to the childminder. My account balance is £400. I need to top up £450 + include the gov top-up timing."

### Current Childcare Implementation
- `src/ui/childcare.js` and `src/utils/childcare.js` already implement:
  - Childcare account management (add/edit/delete accounts)
  - Per-account ledger (deposits in, spending out)
  - `calculateFundingGap()` and `getEntitlementPeriod()` utilities exist
  - Opening balance, entitlement start date, `isDisabled` flag are stored

### What's Missing
1. **Provider cost configuration**: the user cannot currently list recurring provider costs per account
2. **Top-up calculation**: no UI displays "you need to top up £X before the next payment"
3. **Entitlement period UI**: `getEntitlementPeriod()` is computed but not prominently displayed
4. **Dashboard integration**: childcare top-ups don't appear in the affordability engine

## New Schema Additions

### `childcareProviders` store (new)
```js
{
  id: auto,
  accountId: Number,       // FK to childcareAccounts
  name: String,            // e.g. "Bright Horizons Nursery"
  frequency: String,       // 'monthly' | 'termly' | 'weekly'
  amount: Number,          // pence per period
  nextDueDate: String,     // ISO date
  paymentAdjustment: String // 'none' | 'next-working-day'
}
```

## UI Changes — Childcare Tab (src/ui/childcare.js)

### Account Card Enhancements
Each account card now shows:
1. **Current balance** (from ledger)
2. **Entitlement period** — "Current term: Jan–Mar 2026 | Gov bonus earned: £400 / £500"
3. **Providers this period** — list of registered providers with amounts
4. **Required top-up KPI** — prominently displayed:
   ```
   📥 Top up needed: £350 by 1 Apr
   (Covers: Nursery £650 + Childminder £200 – Balance £400 – Expected gov bonus £100)
   ```
5. **"Manage Providers"** button → modal to add/edit/delete provider payments

### Top-Up Calculation Logic
```
required_topup = max(0,
    sum(provider_amounts_this_period)
    - current_account_balance
    - expected_gov_bonus_remaining_this_quarter
)
```
Where `expected_gov_bonus_remaining_this_quarter` = remaining government top-up available this quarter (£500 − already received this quarter, or £1000 for disabled child).

## Dashboard / Affordability Integration

When `calculateAffordability()` is called (Phase 34), childcare top-ups are passed as committed outgoings:
- Each child's required top-up is included as a fixed outgoing in the pay-period window
- Label: "Childcare top-up — [Child Name]"
- Date: the next provider payment due date

The `childcareRepository` must expose a method `getRequiredTopUps()` that returns per-account top-up amounts for the current period.

## Files to Change
- `src/db/schema.js` — new `childcareProviders` store, version bump
- `src/db/repository.js` — `childcareRepository` extensions: `getRequiredTopUps()`, provider CRUD
- `src/utils/childcare.js` — extend `calculateFundingGap()` to include provider costs
- `src/utils/childcare.test.js` — extend tests
- `src/ui/childcare.js` — account card enhancements, provider management modal
- `src/ui/dashboard.js` — pass childcare top-ups to affordability engine

## Acceptance Criteria
- [ ] User can add recurring provider costs to each childcare account
- [ ] "Required top-up" KPI is displayed on each account card
- [ ] Top-up calculation is correct: total provider spend minus account balance minus expected gov bonus
- [ ] Entitlement period (term dates, gov bonus status) is clearly visible on each account card
- [ ] Childcare top-ups appear in the Dashboard affordability card as committed outgoings
- [ ] Affordability engine correctly includes childcare top-ups in the window calculation
- [ ] For a disabled child account, the £1,000 cap is used instead of £500
- [ ] All existing childcare tests pass; new tests for provider cost calculations

## Technical Notes
- `getEntitlementPeriod()` in `src/utils/childcare.js` already calculates term dates — surface this in the UI
- The government bonus is added to the account quarterly; the app should show "earned this quarter" vs "cap" but not attempt to track the exact government payment (too complex; user confirms)
- Provider amounts may vary (termly fees split across months) — allow the user to set a simple `monthlyEquivalent` amount for simplicity
