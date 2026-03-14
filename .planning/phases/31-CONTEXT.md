# Phase 31 Context: Banking Calendar Utility & Recurrence Upgrade

## Objective
Create a UK banking calendar utility (`src/utils/banking-calendar.js`) covering England & Wales public holidays. Extend the recurrence engine to support `paymentAdjustment: 'next-working-day'`. This is the foundational infrastructure for Phase 32 (debt payment dates) and Phase 34 (pay-period affordability calculation).

## Background

### Why Banking Calendar Matters
Many financial obligations fall due on a fixed day of the month (e.g. "1st of the month"). When the 1st falls on a Saturday, Sunday, or a UK bank holiday, the bank processes the payment on the next working day. The app must reflect this so the pay-period affordability view shows accurate dates.

### UK Bank Holidays — England & Wales
Source: GOV.UK API — `https://www.gov.uk/bank-holidays.json`
This API returns JSON with all bank holidays. For offline operation, a static copy of holidays for the current year +2 years should be bundled, with the API call used to refresh on app load.

### Working Day Definition
A working day is Monday–Friday that is not a UK public bank holiday (England & Wales list).

### Recurrence Engine Current State
`src/utils/recurrence.js` provides `RecurrenceManager` which generates expense occurrences from recurring patterns. Currently it does not adjust dates for banking days. The schema likely has a `dayOfMonth` field for monthly recurrences.

### Schema Impact
The `expenses` table (or recurring expense templates) in `src/db/schema.js` needs a new optional field:
```js
paymentAdjustment: 'none' | 'next-working-day'
```
This requires a Dexie version bump. Migration: default all existing records to `'none'` (no change in behaviour).

## New Module: src/utils/banking-calendar.js

```js
// Public API
export function isUKBankHoliday(date)        // → boolean
export function isWorkingDay(date)           // → boolean
export function nextWorkingDay(date)         // → Date (same day if already working day, else next Mon-Fri non-holiday)
export function adjustedPaymentDate(nominalDate, adjustment) // → Date
// adjustment: 'none' | 'next-working-day'

// Internal
const BANK_HOLIDAYS_CACHE_KEY = 'uk_bank_holidays_cache'
async function refreshBankHolidaysCache()   // fetches from GOV.UK API, stores in localStorage
function loadBankHolidays()                 // returns from cache or static fallback
```

### Static Fallback
Bundle a hardcoded list of England & Wales bank holidays for 2025, 2026, 2027. This covers the app's useful range without requiring network access.

## Files to Change
- `src/utils/banking-calendar.js` — new module
- `src/utils/banking-calendar.test.js` — new test file
- `src/utils/recurrence.js` — add `paymentAdjustment` support
- `src/utils/recurrence.test.js` — extend with banking-day adjustment tests
- `src/db/schema.js` — add `paymentAdjustment` field, bump Dexie version
- `src/db/repository.js` — migration for new field default

## Acceptance Criteria
- [ ] `nextWorkingDay(new Date('2026-01-01'))` returns 2026-01-02 (1 Jan is New Year's Day)
- [ ] `nextWorkingDay(new Date('2026-12-25'))` returns 2026-12-29 (Fri, since 28th is a bank hol substitute)
- [ ] `nextWorkingDay(new Date('2026-03-20'))` returns 2026-03-20 (Friday, already a working day)
- [ ] `nextWorkingDay(new Date('2026-03-21'))` returns 2026-03-23 (Saturday → Monday)
- [ ] Recurrence engine generates the adjusted date for a monthly expense with `paymentAdjustment: 'next-working-day'`
- [ ] Existing recurring expenses with no `paymentAdjustment` field are unaffected (default `'none'`)
- [ ] GOV.UK API cache refresh runs once on app startup and stores holidays to localStorage
- [ ] All existing 354+ Vitest tests still pass
- [ ] New tests achieve ≥ 90% branch coverage for both new modules

## Test Cases
```
// Edge cases to cover in tests:
- Date on Saturday → next Monday
- Date on Sunday → next Monday
- Date on Monday bank holiday → next Tuesday
- Date on Good Friday (variable year) → next Tuesday (after Easter Monday)
- Christmas Day on Thursday → Friday (26th is Boxing Day) → Monday 29th
- Normal weekday with no holiday → same day returned
```

## Resources
- GOV.UK Bank Holidays API: https://www.gov.uk/bank-holidays.json
- England & Wales list key in API: `england-and-wales`
- `src/utils/recurrence.js` — current recurrence engine source
- `src/db/schema.js` — current schema for version reference
