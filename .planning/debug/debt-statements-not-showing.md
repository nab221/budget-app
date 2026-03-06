---
status: investigating
trigger: "Investigate issue: debt-statements-not-showing"
created: 2024-05-24T10:00:00Z
updated: 2024-05-24T10:00:00Z
---

## Current Focus

hypothesis: Debt rendering logic or event listeners are broken in the Debts tab.
test: Examine `src/ui/debts.js` and related files to understand how statements are rendered and how the 'Log Statement' button is wired up.
expecting: Identify missing or broken code responsible for rendering statements and handling button clicks.
next_action: Read `src/ui/debts.js` to understand the current implementation.

## Symptoms

expected: Statements should render when a debt is selected, and 'Log Statement' should open the form.
actual: Statements are missing and the button does nothing.
errors: None in console.
reproduction: Go to Debts tab, select a credit card, click 'Log Statement'.
started: After v2.2 stabilization.

## Eliminated

## Evidence

- timestamp: 2024-05-24T10:15:00Z
  checked: `src/ui/debts.js` and `index.html`
  found: 
    1. The 'Log Statement' button in the inline ledger calls `debtUI.toggleStmtForm(true)`, which shows `stmtFormContainer`.
    2. However, `stmtFormContainer` is nested inside `statementSection` in `index.html`, which is hidden by default (`class="hidden card"`).
    3. No code in `src/ui/debts.js` removes the `hidden` class from `statementSection`.
    4. In `src/ui/debts.js`, `renderStatements` uses strict equality `s.debtId === debtId` for filtering. If there is a type mismatch (number vs string), no statements will be shown.
    5. `categoryRepository` is used in `src/ui/debts.js` but not imported.
  implication: 
    1. The 'Log Statement' form is never visible, making the button appear unresponsive.
    2. Statements might be missing due to type mismatch in the filter or because they are only rendered to an inline container while a global container exists in `index.html` that remains empty.
    3. `renderDebtForm` will crash due to missing import.

## Resolution

root_cause: `statementSection` visibility not handled, possible type mismatch in statement filtering, and missing import for `categoryRepository`.
fix: 
  1. Update `toggleStmtForm` to also toggle `statementSection` visibility.
  2. Ensure `debtId` is treated as a number in `renderStatements` filter.
  3. Add missing import for `categoryRepository`.
  4. Ensure `renderStatements` updates both inline and global statement bodies if they exist.
