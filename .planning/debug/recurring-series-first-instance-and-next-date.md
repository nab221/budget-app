---
status: resolved
trigger: "Next Due Date is confusing; First instance of recurring series doesn't show recurrence modal on edit/delete."
created: 2026-03-03T16:15:00Z
updated: 2026-03-03T16:35:00Z
---

## Symptoms

expected: 
- "Next Due Date" field removed; first payment always on selected "Date".
- All instances in a recurring series, including the first one, trigger the recurrence modal ("This vs All Future") on edit/delete.
actual: 
- "Next Due Date" was present and confusing.
- The first instance (anchor record) did not trigger the recurrence modal because it lacked a `recurrenceId` at creation time.
reproduction: 
- 1. Create a recurring expense.
- 2. Attempt to edit/delete the first record. Observe the lack of a recurrence prompt.
started: Post-v1.5 implementation.

## Evidence

- Code inspection of `src/ui/expenses.js` showed that `recurrenceId` was only generated inside `generateInstances`, which is called *after* the initial `add()` for the anchor record.
- The `deleteRecurrentExpense` and `handleSaveExpense` (edit mode) functions check for `item.recurrenceId` to decide whether to show the modal.

## Resolution

root_cause:
The first instance of a series was saved to the DB before a `recurrenceId` was generated, making it an "orphaned" record that didn't know it was part of a series until future instances were generated.

fix:
1. Removed "Next Due Date" from `renderForm` and `handleSaveExpense` in `src/ui/expenses.js`.
2. Added `generateUUID` helper to `expensesUI`.
3. Updated `handleSaveExpense` to generate a `recurrenceId` and set `parentDate` for the anchor record *before* calling `add()`.
4. Ensured `nextDate` defaults to the selected `date`.

verification:
Created and ran `src/ui/first_instance_recurrence.test.js` using Vitest, which confirmed that both Recurrent and One-off recurring series now correctly include a `recurrenceId` in their first instance.

files_changed: 
- `src/ui/expenses.js`
