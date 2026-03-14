# Phase 33 Context: Income & Spending Configuration

## Objective
Build persistent income source configuration (two sources with pay-date rules) and spending bucket setup (estimated monthly outgoings per category). These are the input data that the Phase 34 affordability engine will consume.

## Background

### Income Sources
The user has two income streams:
1. NHS/primary salary — arrives on a predictable date (e.g. last working day of the month)
2. Locum/secondary income — arrives on a different date each month (but roughly predictable)

The app needs to store:
- Name (free text)
- Expected net monthly amount (pence)
- Pay date rule: one of:
  - `'last-working-day'` — last Mon–Fri non-holiday of the month
  - `'first-working-day'` — first Mon–Fri non-holiday of the month
  - `'nth-of-month'` → `{ day: N }` — Nth calendar day, adjusted if weekend/holiday

Each income source computes its next expected pay date using the banking calendar utility from Phase 31.

### Spending Buckets
Spending buckets are monthly budget estimates — not transaction tracking. Examples:
- Groceries: £600/month
- Eating Out: £150/month
- Petrol/Transport: £120/month
- Entertainment: £80/month
- Clothing: £60/month
- Personal Care: £40/month
- Miscellaneous: £100/month

The user can add, edit, delete, and reorder buckets. The total is shown as "Estimated monthly discretionary spend".

## New Schema Stores

### `incomeSources` store
```js
{
  id: auto,
  name: String,           // e.g. "NHS Salary"
  expectedMonthlyAmount: Number,  // pence
  payDateRule: String,    // 'last-working-day' | 'first-working-day' | 'nth-of-month'
  payDateDay: Number,     // only used for 'nth-of-month'
  isActive: Boolean,      // soft-delete
  createdAt: String       // ISO
}
```

### `spendingBuckets` store
```js
{
  id: auto,
  name: String,           // e.g. "Groceries"
  monthlyAmount: Number,  // pence
  emoji: String,          // optional: '🛒', '🍽️', etc.
  sortOrder: Number,
  isActive: Boolean
}
```

## UI — Settings Panel Addition
Add a new "Budget Setup" section to the Settings tab with two sub-sections:

### Income Sources Section
- List of configured income sources with name, expected amount, and next expected pay date
- "Edit" and "Delete" buttons per source
- "+ Add Income Source" button → modal with name, amount, pay-date-rule picker
- Maximum 2 sources enforced (validation message if user tries to add more)

### Spending Buckets Section
- List of buckets with name, emoji, and monthly amount
- "Edit" and "Delete" per bucket
- "+ Add Bucket" button → modal
- Total discretionary budget shown at bottom: "Monthly budget: £1,150"
- Default buckets seeded on first run (same as `categoryRepository.seedDefaultCategories()` pattern)

## Files to Change
- `src/db/schema.js` — new `incomeSources` and `spendingBuckets` stores, version bump
- `src/db/repository.js` — CRUD methods for both new stores, `seedDefaultBuckets()`
- `src/ui/budget-setup.js` — new UI module (or add to `src/ui/settings` area within `app.js`)
- `index.html` — add "Budget Setup" section markup to settings tab-panel
- `src/app.js` — initialise and render `budgetSetupUI` when settings tab is active

## Acceptance Criteria
- [ ] User can add, edit, and delete income sources via a modal
- [ ] Pay date rule options are: "Last working day", "First working day", "Nth of month"
- [ ] Next expected pay date is displayed for each source (using banking calendar from Phase 31)
- [ ] Default spending buckets are seeded on first app load (if none exist)
- [ ] User can add, edit, delete spending buckets
- [ ] Total monthly discretionary budget is calculated and displayed
- [ ] Settings panel shows both sections in a clear layout
- [ ] Data persists across page reloads
- [ ] All existing tests pass; new unit tests for income source pay-date calculations

## Technical Notes
- `seedDefaultBuckets()` should be idempotent — only seed if the `spendingBuckets` store is empty
- Pay date preview uses `adjustedPaymentDate()` from `src/utils/banking-calendar.js` (Phase 31 prerequisite)
- If Phase 31 is not yet complete, stub the banking-calendar call with a pass-through for now
- The income sources stored here are for **planning purposes only** — they do not replace the existing `transactions.js` income entry system
