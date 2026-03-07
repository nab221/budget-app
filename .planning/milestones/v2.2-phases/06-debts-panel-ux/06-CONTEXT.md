# Phase 6: Debts Panel UX - Context

## Decisions
- **DEBT-05**: Clicking debt card body MUST open the statement history/ledger for that debt inline (expanding below the card or as an in-page section, NOT a modal).
- **DEBT-06**: Move the Edit (✏️) button to sit next to the Delete (🗑) button in the card header/actions row.
- **DEBT-07**: Group debts visually by type ("Credit Cards", "Loans & Mortgages") within the debts panel.
- Primary interaction for the card is now the history view, not the edit form.

## Claude's Discretion
- Visual design of the inline ledger (use existing "Manage Statements" logic as a base).
- Specific styling for grouping headers (Credit Cards, Loans & Mortgages).
- Transition/Animation for the expanding inline view.

## Deferred Ideas
- Payoff planner refactor (scheduled for Phase 7).
- Adding new debt types beyond those established in Phase 5.
