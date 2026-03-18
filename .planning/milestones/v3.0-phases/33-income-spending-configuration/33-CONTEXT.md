# Phase 33 Context: Income Sources & Spending Buckets Configuration

## Objective
Add Settings configuration for an arbitrary number of income sources plus configurable spending buckets. Phase 33 owns persistence, validation, ordering, and banking-calendar-aware projected payday display. It does not implement the affordability dashboard or childcare features.

## Background

### Scope Correction
Earlier planning accidentally limited income sources to two and attached childcare-provider work to this phase. Both assumptions are incorrect. Phase 33 must support a row-based 0..N list of income sources and keep childcare provider modelling in Phase 35.

### Income Source Model
```js
// New store: incomeSources
{
  id: auto,
  name: string,
  monthlyAmount: number,      // pence
  payDateRule: 'nth-of-month' | 'last-day' | 'last-working-day',
  payDateDay: number | null,  // required for nth-of-month, range 1-28
  isActive: boolean,
  displayOrder: number
}
```

Validation rules:
- `name` is required
- `monthlyAmount` must be a positive integer amount in pence
- `payDateRule` must match one of the documented enum values
- When `payDateRule === 'nth-of-month'`, `payDateDay` is required, must be an integer, and must be in the range 1–28
- No artificial maximum number of income source rows is allowed; 3+ sources must behave the same as the first two

Each source shows its next nominal payday and its banking-calendar-adjusted payday using the Phase 31 date-adjustment utilities.

### Spending Bucket Model
```js
// New store: spendingBuckets
{
  id: auto,
  name: string,
  monthlyAmount: number,   // pence
  icon: string | null,
  displayOrder: number
}
```

Default buckets seeded on first install:
- Groceries
- Eating Out
- Petrol/Transport
- Entertainment
- Clothing
- Personal Care
- Misc

Buckets are estimated outgoings for Phase 34. They are not transaction-level tracking entities.

### Phase Boundary
- Phase 33 depends on Phase 31 for banking-calendar-aware payday display and helper logic
- Phase 33 outputs configuration plus projected income-event helpers for Phase 34
- Phase 33 does not add pay-period navigation, current-balance entry, affordability calculations, childcare providers, or TFC reporting

## Phase 34 Handoff
Phase 33 must expose collection-based helpers over all active income sources:

```js
getNextIncomeEvent(source, fromDate)
// -> { sourceId, sourceName, amount, nominalDate, adjustedDate }

getUpcomingIncomeEvents(sources, fromDate, limit)
// -> Array<{ sourceId, sourceName, amount, nominalDate, adjustedDate }>
// sorted by adjustedDate ascending
```

Phase 34 consumes the merged income-event collection rather than a single global `payDay` setting.

## Files to Change
- `src/db/schema.js` — add `incomeSources` and `spendingBuckets`, bump version from the real current schema baseline
- `src/db/repository.js` — CRUD helpers, default bucket seeding, ordering support
- `src/ui/settings.js` — row-based income source section and spending bucket section
- `src/utils/income.js` — nominal/adjusted payday derivation and upcoming-income-event helpers
- `src/utils/supabase-sync.js` — ensure new stores participate in backup/restore or verify the existing generic sync path covers them
- `tests/income.test.js` — payday helper coverage and multi-source event ordering

## Acceptance Criteria
- [ ] Income sources are managed in Settings as a row-based list with no artificial maximum
- [ ] `payDateDay` validation rejects missing, non-integer, or out-of-range values when rule is `nth-of-month`
- [ ] Each income source displays its next banking-calendar-adjusted payday
- [ ] Spending buckets seed defaults on first install and can be added, edited, and deleted
- [ ] Phase 34 handoff helpers return correctly sorted upcoming income events across all active sources
- [ ] `incomeSources` and `spendingBuckets` data survive backup/restore
- [ ] Schema migration runs without errors from the current pre-Phase-33 database version
- [ ] All existing Vitest tests continue to pass
- [ ] New income-source tests achieve at least 80% coverage for helper logic

## Technical Notes
- Do not persist derived payday dates in IndexedDB; store rules only and compute projections on demand
- Keep income source configuration separate from posted income transaction history
- Empty income source state is valid; Phase 34 must handle "no upcoming income event" gracefully
- `displayOrder` is for presentation only; calculation logic must sort by adjusted event date
