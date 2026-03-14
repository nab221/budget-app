# Phase 5 Research: Edit/Delete Lifecycle

## Goal
Handle the user choice when editing or deleting a recurring transaction instance: "This occurrence only" or "All future occurrences".

## 1. Current State
- Deletion is handled via `deleteRecurrentExpense(id)` and `deleteOneOffExpense(id)` in `src/ui/expenses.js`.
- These currently use a simple `confirm()`.
- Updates are handled via `handleSaveExpense()` which updates the `editingId` record.

## 2. Requirements
- If `item.recurrenceId` is present:
    - **Delete**: Show modal with "Delete this only" and "Delete all future".
    - **Edit**: Show modal with "Update this only" and "Update all future".
- **"This only"**: Just update/delete the single record.
- **"All future"**:
    - **Delete**: `table.where('recurrenceId').equals(id).and(item => item.date >= targetDate).delete()`.
    - **Update**: Update the specific fields across all instances with `date >= targetDate`.

## 3. UI Implementation
- Need a reusable modal component. `templateUI` has a `showModal` method which we can repurpose or create a specialized `recurrenceModal`.
- File: `src/ui/expenses.js`.

## 4. Repository Support
- `recurrentExpenseRepository` and `oneOffExpenseRepository` need methods for bulk operations by `recurrenceId`.
- Example: `deleteSeries(recurrenceId, fromDate)`.
- Example: `updateSeries(recurrenceId, fromDate, updates)`.

## 5. Risk Assessment
- **Accidental Wipeout**: "Delete all future" is destructive. Ensure the date filter is strictly `>=`.
- **Sync/Consistency**: If we update "all future", should we also regenerate?
    - If frequency changes, we definitely need to handle the series differently (probably wipe future and regenerate).
    - If only amount/label changes, simple bulk update is fine.
- **Complexity**: Editing a middle instance vs the parent instance.
    - Our system uses `parentDate` as an anchor, so `generateInstances` is stable.
