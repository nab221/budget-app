# Phase 15 Context: Statement History Modal

## Overview
Phase 15 completes the v2.5 Debt Tab UX Overhaul by migrating the "Statement History" view from an inline, potentially cluttered, expansion container to a focused modal dialog. This brings consistency with the rest of the application's entry management (Expenses, Income, Assets) which were moved to modals in Phase 14.

## Decisions

### Modal Layout & Interaction
- **Trigger**: Clicking a Debt Card in the main list will open the "Statement History" modal.
- **Title**: The modal title will clearly identify the debt: "Statement History: [Debt Name]".
- **Table Density**: The statement history table will continue to use the `.tbl.sm` class for high density.
- **Action Placement**:
  - The "Add Statement" and "Import PDF" buttons will be prominently placed above the history table within the modal.
  - Footer buttons will include a "Close" action for clear dismissal.

### Statement Form Management
- **In-Modal Form**: The "Log Monthly Statement" form will appear *within* the history modal body (as a hidden card that toggles visible), rather than opening a secondary modal. This keeps the history context visible during entry.
- **Update Mode**: Editing an existing statement will also happen within the history modal, replacing the "Log" form or appearing in its place.
- **Backdrop Dismissal**: Clicking the modal backdrop will close the history modal (and any active statement form within it).

### State Management
- **`activeStmtDebtId`**: This state will continue to track which debt's history is being viewed/edited.
- **`openLedgerId`**: This property in `debtUI` is no longer needed (since it was used for the inline view) and will be removed.
- **`openHistoryModal(id)`**: New primary entry point for viewing statements.

### UX Continuity
- **Success Feedback**: Saving a statement will briefly highlight the new/updated row in the table before closing the form (if applicable) or refreshing the view.
- **Haptic Feedback**: Retain success/error haptic triggers during statement operations.

## Success Criteria
1. Clicking a Debt card opens a modal (not an inline container).
2. The modal contains the statement history table and "+ Log Statement" / "Import PDF" buttons.
3. The legacy `#ledger-container-${id}` elements and related `toggleLedger()` logic are removed from the codebase.
4. "Log Statement" and "Edit Statement" work correctly within the modal context.
5. The PDF Import pre-filling logic functions correctly within the modal.
