# Phase 6 Research: Cleanup & Polish

## Goal
Remove legacy Template-related code and ensure the new recurrence system is fully integrated and polished.

## 1. Code Cleanup
- **`src/ui/templates.js`**: Most of this file is now obsolete.
    - `manualTrigger`: Kept but updated to call `RecurrenceManager.checkAndGenerate()`.
    - `render()`: Obsolete.
    - `handleSaveTemplate()`: Obsolete.
- **`src/ui/expenses.js`**:
    - Remove imports from `templates.js` if no longer needed.
    - Verify that `templateUI.manualTrigger` is correctly routed.
- **`src/app.js`**:
    - Ensure `RecurrenceManager.checkAndGenerate()` is called on app boot.

## 2. UI Polish
- **Settings Tab**: Remove "Templates" section.
- **Dashboard**: Verify that "Recurrent" totals correctly include pending future instances if the month is switched.
- **Empty States**: Ensure empty states in Expenses tab look good.

## 3. Documentation
- Update `README.md` to explain how recurrence works now.
- Mention the "This vs All Future" choice.

## 4. Risks
- **Over-deletion**: Be careful not to remove utility methods in `templates.js` that might still be used (like modal helpers).
- **Boot Performance**: Ensure `checkAndGenerate` is efficient.
