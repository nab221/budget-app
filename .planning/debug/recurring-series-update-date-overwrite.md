---
status: resolved
trigger: "Updating a recurring series (All Future) sets all future instances to the same date as the edited instance, instead of preserving their frequency-calculated dates."
created: 2026-03-03T13:50:00Z
updated: 2026-03-03T14:05:00Z
---

## Symptoms

expected: Future instances should retain their correct dates (monthly, weekly, etc.) when label, amount, or category are updated.
actual: All future instances' dates are overwritten with the date of the specific instance being edited.
errors: Data corruption (multiple identical entries on one date).
reproduction: 1. Create a recurring expense. 2. Edit an instance of that expense. 3. Change any field. 4. Choose "All Future" when prompted.
started: Post-v1.5 implementation (recurring transactions feature).

## Evidence

- Code inspection of `src/db/repository.js` showed that the `updateSeries` method (for both `recurrentExpenseRepository` and `oneOffExpenseRepository`) applied the entire `updates` object from the UI to all future instances in the series.
- The `updates` object contained the specific `date` and `nextDate` of the edited instance.

## Resolution

root_cause:
The `updateSeries` methods in the repositories were not excluding temporal fields from the bulk update, leading to the overwriting of individual instance dates within a recurring series.

fix:
Modified `recurrentExpenseRepository.updateSeries` and `oneOffExpenseRepository.updateSeries` in `src/db/repository.js` to strip `id`, `date`, `nextDate`, `predictedPaymentDate`, `parentDate`, and `recurrenceId` from the update payload before applying it to the series.

verification:
Verified with a reproduction test in Vitest, which confirmed that metadata updates (labels, amounts) are correctly synchronized across the series while preserving unique instance dates.

files_changed: 
- `src/db/repository.js`
