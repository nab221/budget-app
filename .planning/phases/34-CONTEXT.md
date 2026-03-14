# Phase 34 Context: Pay-Period Affordability Engine

## Objective
Build the headline v3.0 feature: given the user's current account balance and all upcoming committed outgoings until the next payday, calculate and prominently display "how much extra can I pay toward my debts?". Surface this on the Dashboard as a persistent planning card.

## Background

### Core User Question
> "I've just checked my bank app. My balance is £1,847. My next payday is the 25th. How much can I safely put toward extra debt payments before then?"

### Pay Period Definition
A pay period runs from today (or the day after the last payday) to the next expected payday. The user has two income sources (Phase 33) on different dates. The relevant "next payday" is the next expected date from either income source, whichever comes first.

### Committed Outgoings in the Pay Period
All of the following that fall between today and the next payday:
1. **Fixed recurring expenses** — mortgage, loan payments, direct debits (from the recurrence engine, banking-calendar adjusted)
2. **Minimum credit card payments** — from debt records
3. **Spending bucket prorated amounts** — e.g. if 10 days remain to payday and groceries are £600/month, include £600 × (10/30) = £200
4. **Childcare top-ups** — from Phase 35 (deferred dependency: can use £0 placeholder if Phase 35 not complete)

### Safety Buffer
A user-configurable minimum balance to always maintain (e.g. £200 emergency buffer). The affordability calculation ensures the user never goes below this.

### Affordability Formula
```
availableForExtra = currentBalance
                  - sum(committed_outgoings_to_next_payday)
                  - safetyBuffer
```
If `availableForExtra < 0`, show "⚠️ You may be short before your next payday. Review your outgoings."

## New Module: src/utils/affordability.js

```js
/**
 * Calculate how much extra can be paid toward debts before the next payday.
 *
 * @param {object} params
 * @param {number} params.currentBalance - Current account balance in pence
 * @param {Date} params.currentDate - The date the balance was checked
 * @param {Date} params.nextPayDate - Next expected payday
 * @param {Array} params.upcomingExpenses - Array of {date, amount, name, type}
 * @param {Array} params.spendingBuckets - Array of {monthlyAmount, name}
 * @param {number} params.safetyBuffer - Minimum balance to maintain (pence)
 * @returns {AffordabilityResult}
 */
export function calculateAffordability(params)

// AffordabilityResult:
{
  availableForExtra: Number,       // pence — can be negative
  totalCommittedOutgoings: Number, // pence
  budgetedDiscretionary: Number,   // prorated spending buckets
  daysToNextPay: Number,
  warningLevel: 'ok' | 'tight' | 'negative',
  upcomingPayments: Array          // sorted by date, for timeline display
}
```

## Dashboard — Affordability Card

A new persistent card at the top of the Dashboard (above the rolling chart), always visible:

```
┌─────────────────────────────────────────┐
│ 💳 Budget Snapshot                       │
│ Current balance: [£____] [checked today] │
├─────────────────────────────────────────┤
│ Days to next payday: 10 days (25 Mar)    │
│ Committed outgoings: £847               │
│ Spending budget: £200                   │
│ Safety buffer: £200                     │
├─────────────────────────────────────────┤
│ ✅ Available for extra payments: £600    │
└─────────────────────────────────────────┘
```

- Current balance input: user types their balance; it is saved to `localStorage` with a "last updated" timestamp
- "Available for extra payments" is the headline number — large, prominent, colour-coded (green/amber/red)
- Link to Payoff Planner: "→ Allocate to debts" (navigates to Payoff tab)

## Upcoming Payments Timeline

Below the affordability card, a timeline/list sorted by date showing all payments in the current pay period:
```
25 Mar  Mortgage                    -£1,247  ✓ working-day adjusted
26 Mar  Groceries estimate          -£200    (bucket)
28 Mar  Council Tax                 -£145
30 Mar  Netflix                     -£18
...
```

## Files to Change
- `src/utils/affordability.js` — new module
- `src/utils/affordability.test.js` — new tests
- `src/ui/dashboard.js` — affordability card, balance input, timeline
- `src/db/repository.js` — `getCurrentBalance()`, `saveCurrentBalance(amount, date)` (localStorage wrapper methods)
- `src/utils/storage.js` — new constants `CURRENT_BALANCE_KEY`, `CURRENT_BALANCE_DATE_KEY`, `SAFETY_BUFFER_KEY`
- `index.html` — affordability card HTML in dashboard panel
- `css/main.css` — affordability card styles, timeline styles

## Acceptance Criteria
- [ ] User can enter their current balance in the affordability card on the Dashboard
- [ ] Balance is saved to localStorage and persists across page reloads
- [ ] Upcoming committed outgoings are fetched and summed correctly for the current pay period
- [ ] Spending bucket amounts are prorated to the remaining days in the pay period
- [ ] "Available for extra payments" is correctly calculated and displayed
- [ ] Warning shown (amber/red) when available amount is below £0 or safety buffer is stressed
- [ ] Timeline of upcoming payments is shown, sorted by date, banking-calendar adjusted
- [ ] "→ Allocate to debts" navigates to the Payoff Planner tab
- [ ] Safety buffer is user-configurable from the Settings tab
- [ ] All affordability logic is unit-tested with ≥ 90% coverage
- [ ] All existing 354+ tests pass

## Technical Notes
- `calculateAffordability()` must be a pure function — no DB calls, no side effects — fully testable in Vitest without DOM
- The balance input on the Dashboard must use privacy-blur when Privacy Mode is active
- Childcare top-ups (Phase 35): affordability.js should accept a `childcareTopUps` parameter; default to empty array if Phase 35 not yet complete — add them in Phase 35
