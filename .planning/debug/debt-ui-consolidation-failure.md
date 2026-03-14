---
status: investigating
trigger: "debt-ui-consolidation-failure"
created: 2024-05-22T10:00:00Z
updated: 2024-05-22T10:00:00Z
---

## Current Focus

hypothesis: Debt UI components for statements are disconnected or redundant. Specifically, the global `statementSection` and `stmtFormContainer` in `index.html` are redundant and cause confusion. They should be integrated into each debt card's inline ledger.
test: Consolidate statement form and controls into each card's ledger.
expecting: Simplified UI where each card's "Statement History" includes its own form and controls (Log Statement, Import PDF).
next_action: modify src/ui/debts.js to support in-card statement forms and controls.

## Symptoms

expected: A single "Statement History" banner should appear per card with "Log Statement" and "Import PDF" buttons, plus the statement list.
actual: Multiple sections (banner, separate form, old global list) exist but are empty or disconnected.
errors: None.
reproduction: Go to Debts, click a credit card, click "+ Log Statement".
started: After the recent fix for debt statements.

## Eliminated

## Evidence

- 2024-05-22: Found that `index.html` has a global `statementSection` that is shown when `Log Statement` is clicked, even though each card has its own inline ledger.
- 2024-05-22: Found that `src/ui/debts.js` uses `this.openLedgerId` but doesn't have an equivalent `activeStmtDebtId` for managing which card's statement form is open.
- 2024-05-22: `Import PDF` is currently only in the global section.

## Resolution

root_cause:
fix:
verification:
files_changed: []