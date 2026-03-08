# Phase 15 Research: Statement History Modal

## Current State Analysis

### Entry Points
- `src/ui/debts.js`: `render()` displays debt cards with "Click to view history" hint.
- `window.toggleLedger(id)`: Triggered on debt card click. Toggles `#ledger-container-${id}` (inline).
- `src/ui/debts.js`: `renderStatements(debtId)`: Renders the table in `#stmtBody-${debtId}`.

### Current Inline Ledger Layout (`#ledger-container-${id}`)
- Contains header: "Statement History: {debt.name}"
- Buttons: "+ Log Statement", "📄 Import PDF" (for CC).
- `#stmtFormContainer-${debtId}`: Hidden card for the statement form.
- Table with headers: Date, Opening, Closing, Int, Fees, Min Due, Due Date, Paid, Paid On, Actions (Edit/Delete).

### Current Form Logic
- `toggleStmtForm(debtId, show)`: Toggles the `#stmtFormContainer-${debtId}`.
- `renderStmtForm(debtId)`: Renders the form within that container.
- `handleSaveStatement()`: Saves statement, triggers haptic, refreshes current ledger view.

## Goal: Modal-Driven UX

1.  **Replace Inline Ledger with Modal**: When "View History" (or card) is clicked, open a modal using `modalUI.show()`.
2.  **Modal Content**: The modal should contain the statement history table and action buttons (+ Log, Import PDF).
3.  **Statement Form Strategy**:
    - **Option A (Nested Modal)**: Opening the "Log/Edit Statement" form opens *another* modal (or replaces the content of the current one).
    - **Option B (In-Modal Form)**: The form appears at the top of the history modal content (similar to how it's currently an inline card in the ledger).
    - **Recommendation**: **Option B (In-Modal Form)** for efficiency, or **Option C (Replacing Content)** if the form is large.
    - Given `modalUI`'s current structure, it might be easier to replace the modal content or just have the form inside the modal body.
    - However, standardizing on **Option A** (Log Statement is its own modal) would be most consistent with the rest of the app's new modal-driven approach.

4.  **Consistency**: Use the same table styles (`.tbl.sm`) and card styles within the modal.

## UX Decisions

- **Modal Title**: "Statement History: [Debt Name]"
- **Action Buttons**: Place "+ Log Statement" and "📄 Import PDF" in the modal header or footer (footer for primary actions).
- **Edit/Delete Actions**: Keep them as buttons in the table rows.

## Technical Plan Draft

1.  **Modify `debtUI`**:
    - Remove `toggleLedger()`.
    - Create `openHistoryModal(debtId)`.
    - Create `_buildHistoryModalHTML(debtId, stmts)`.
    - Update `renderStatements()` to target the modal body instead of the inline container.
2.  **Modify `render()`**:
    - Change `onclick="toggleLedger(${debt.id})"` to `onclick="debtUI.openHistoryModal(${debt.id})"`.
    - Remove the `<!-- Inline Ledger Container -->` block from the `render()` loop.
3.  **Handle Forms**:
    - `toggleStmtForm()` should now target a container *inside* the history modal or open a separate modal.
    - If a separate modal is used, `modalUI` needs to handle stacking or simple replacement.

## Dependency Check
- `modalUI` in `src/ui/render.js` should be robust enough.
- `statementRepository` and `debtRepository` provide the data.

## Potential Pitfalls
- **PDF Import**: `prefillStatementForm` currently expects `activeStmtDebtId` and targets `#stmtDateInput-${debtId}` etc. in the DOM. This needs to remain consistent or be updated if the modal structure changes.
- **Scroll Lock**: `modalUI` handles scroll lock, but if we open a modal from a modal (or replace content), we need to ensure the state remains correct.
