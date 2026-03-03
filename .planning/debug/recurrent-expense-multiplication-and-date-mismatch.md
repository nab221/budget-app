---
status: resolved
trigger: "Recurrent expense multiplication (100x) and date mismatch/duplication"
created: 2026-03-03T14:15:00Z
updated: 2026-03-03T15:35:00Z
---

## Symptoms

expected: 
- Recurrent expenses stored in correct currency amount.
- Single entry created for the 'Date' and then subsequent entries according to 'Next Due Date' and frequency.
actual: 
- Recurrent instances were 100x the correct amount.
- If 'Date' differed from 'Next Due Date', two entries were created on 'Next Due Date' (one correct, one 100x), while the 'Date' field was ignored.
errors: Data corruption (incorrect amounts and duplicated entries).
reproduction: Added a recurrent expense with 'Date' != 'Next Due Date'.
timeline: Started after v1.5 implementation of recurring transactions.

## Evidence

- Code inspection of `src/ui/expenses.js` and `src/db/repository.js` showed that `savedItem.amount` (already in pence) was passed to `generateInstances` and then to `bulkAdd`, which converted it again (100x).
- Overlap on `Next Due Date` occurred because `generateInstances` used the start `Date` as an anchor but the first instance calculated from it often coincided with the explicitly provided `Next Due Date`.

## Resolution

root_cause:
1. Double-conversion to pence: `bulkAdd` in `createBaseRepository` helper automatically calls `toPence`.
2. Anchor mismatch: `generateInstances` used `Date` instead of `Next Due Date` as the anchor for future instances, leading to overlaps and ignoring the initial `Date` record's scheduled `Next Due Date`.

fix:
1. Updated `src/ui/expenses.js` to convert `savedItem.amount` back to pounds using `fromPence` before calling `generateInstances`.
2. Updated `src/ui/expenses.js` to use `nextDate` as the `date` for the generator's base object, while preserving the original `date` as `parentDate`. This ensures generation starts from the first real payment and doesn't overlap with the anchor record.

verification:
Verified with `src/db/reproduction_issue_v2.test.js` using Vitest. All tests passed.

files_changed: 
- `src/ui/expenses.js`
