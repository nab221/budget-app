---
phase: 15-statement-history-modal
plan: 01
type: execute
wave: 1
depends_on: ["14-PLAN.md"]
files_modified: [src/ui/debts.js]
autonomous: true
requirements: [DEBT-UX-01, DEBT-UX-02, DEBT-UX-03]
must_haves:
  truths:
    - "Debt cards open a modal for statement history instead of an inline ledger"
    - "Statement history modal contains all previous table features (+ Log, Import PDF)"
    - "Legacy toggleLedger and ledger-container code is removed"
    - "PDF import correctly pre-fills fields in the history modal"
  artifacts:
    - path: "src/ui/debts.js"
      provides: "modal-based history view and consolidated statement form management"
---

# Phase 15: Statement History Modal - PLAN.md

<objective>
Migrate the Debt Statement History view from an inline expansion card to a modal-driven UX. This standardizes the debt tab with the rest of the application's new modal infrastructure.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Implement History Modal Scaffold</name>
  <files>src/ui/debts.js</files>
  <action>
    - Create `openHistoryModal(debtId)` method in `debtUI`.
    - Implement `_buildHistoryModalHTML(debt, stmts)` to generate the modal body (header, buttons, table).
    - Modify `renderStatements(debtId)` to target the modal's internal statement body instead of the old `#stmtBody-${debtId}`.
    - Wire `modalUI.show()` to display the history view.
  </action>
  <verify>Click a debt card and confirm the "Statement History" modal appears with the correct title and empty/loading table.</verify>
  <done>The history modal scaffold is functional.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate Statement Form Logic</name>
  <files>src/ui/debts.js</files>
  <action>
    - Update `toggleStmtForm(debtId, show)` to target the form container *within* the modal.
    - Update `renderStmtForm(debtId)` to ensure it renders into the modal-based container.
    - Ensure `handleSaveStatement()` and `cancelEditStmt()` work within the modal (refreshing the table in the modal).
    - Ensure `prefillStatementForm()` (used by PDF Import) correctly targets the inputs now inside the modal.
  </action>
  <verify>Click "+ Log Statement" inside the history modal. Confirm the form appears. Save a dummy statement and confirm the table in the modal refreshes.</verify>
  <done>Statement logging and editing are fully functional within the history modal.</done>
</task>

<task type="auto">
  <name>Task 3: Cleanup Legacy Inline Code</name>
  <files>src/ui/debts.js</files>
  <action>
    - Change `render()`'s card `onclick` from `toggleLedger(${debt.id})` to `debtUI.openHistoryModal(${debt.id})`.
    - Remove the `<!-- Inline Ledger Container -->` HTML generation block from `render()`.
    - Remove `window.toggleLedger` and `this.openLedgerId` from `debtUI`.
    - Remove the `if (this.openLedgerId)` check at the end of `render()`.
  </action>
  <verify>Confirm no `#ledger-container-*` elements exist in the DOM after render. Verify clicking a card opens the modal instead of expanding.</verify>
  <done>Legacy inline ledger code is removed and the UI is updated.</done>
</task>
</tasks>

---

## Verification Plan
1. **Modal Entry:** Confirm clicking any debt card opens the history modal.
2. **Data Consistency:** Confirm the history modal shows the correct statements for the selected debt.
3. **Form Integration:** Confirm adding, editing, and deleting statements within the modal works and refreshes the modal view.
4. **PDF Import:** Verify that selecting "Import PDF" and uploading a file correctly pre-fills the statement form inside the modal.
5. **UI Integrity:** Confirm that closing the modal correctly resets any statement form state (e.g., `editingStmtId`).
