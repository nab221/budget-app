# Phase 4 Research: UI - Form Updates

## Goal
Update the transaction forms in the Expenses tab to support the new recurrence system. This includes adding "Recurring" checkboxes and "Frequency" dropdowns to both Recurrent and One-off forms, and updating the save logic to trigger batch generation.

## 1. Current Form Implementation
- **File**: `src/ui/expenses.js`
- **Method**: `renderForm()`
- **Structure**:
    - `recurrent`: Already has a `Frequency` dropdown but no explicit `Recurring` toggle (it's assumed). It has `nextDate`, `cycleTotal`, and `endDate`.
    - `oneOff`: Has `date`, `categoryId`, `note`, and `amount`. No recurrence fields.

### Observations
- For `recurrentExpenses`, the `isRecurring` field should probably be `true` by default but now explicit in the UI.
- For `oneOffExpenses`, they can now *become* recurring, which is a new capability.
- If a user marks a "One-off" as recurring, should it stay in the `oneOffExpenses` table or move to `recurrentExpenses`?
    - **Decision from REQUIREMENTS.md**: Both tables now support `isRecurring` and `frequency`. So they stay in their respective tables.

## 2. UI Updates Needed

### Recurrent Form (`recurrentExpenses`)
- Add `isRecurring` checkbox (defaulted to `true`).
- Frequency dropdown (exists, but ensure it matches the new enum: `weekly`, `biweekly`, `monthly`, `quarterly`, `annually`).
- Visual refinement to align with the new standard.

### One-off Form (`oneOffExpenses`)
- Add `isRecurring` checkbox (defaulted to `false`).
- Add `frequency` dropdown (hidden/disabled unless `isRecurring` is checked).
- Default frequency: `monthly`.

### Table Rows
- Add visual 🔁 (or similar icon) to rows where `isRecurring === true`.
- In `recurrentExpenses`, most will be recurring.
- In `oneOffExpenses`, this will help identify generated future instances.

## 3. Implementation Plan for `handleSaveExpense()`

### Logic for New Recurring Item
1. Save the initial record.
2. If `isRecurring` is checked:
    - Generate 12 instances using `generateInstances(savedItem, frequency, 12)`.
    - Use `repository.bulkAdd()` or multiple `repository.add()` to save these instances.
    - Ensure `triggerBalanceRecalc` is fired for the entire range.

### Logic for Updates
- If `isRecurring` is toggled ON for an existing item:
    - Treat as a new series? Or just start generating from this date forward?
    - Phase 5 covers the "This vs All Future" choice, so for Phase 4, we might just handle the simple toggle.

## 4. Recurrence Utility Integration
- **File**: `src/utils/recurrence.js`
- **Function**: `generateInstances(base, frequency, count)`
- **Fields to ensure**: `recurrenceId`, `parentDate`, `isRecurring`.

## 5. Risk Assessment
- **Duplicate Generation**: Ensure we don't accidentally double-generate if a user saves multiple times.
- **Table Bloat**: 12 months * N items is fine for Dexie, but we should be mindful of performance in `render()`.
- **Validation**: Ensure `frequency` is valid before calling `generateInstances`.
