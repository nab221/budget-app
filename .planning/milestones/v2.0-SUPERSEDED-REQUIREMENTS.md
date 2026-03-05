# Milestone v2.0 Requirements: UI Overhaul & Debt Logic Separation

## Goal
Major UI simplification and logic refactoring to clean up legacy patterns, merge redundant visualizations, and formalize debt types. Focus on user-centric workflows (ledger views) and accurate account balance management.

## 1. UI Infrastructure & Cleanup

### Header & Banners
- **UI-01**: Persistence banner (`#persistence-warning`) MUST ONLY show if `ensurePersistence()` is false AND no active file-sync handle exists.
- **UI-02**: Rename DB reset button to "🗑 Clear All Data". Add confirmation dialog explaining IndexedDB wipe.
- **UI-03**: If file-sync is active, "Clear All Data" must warn that the file will NOT be updated after clearing.
- **UI-04**: Rename file-sync disconnect button to "🔗 Disconnect File" (ghost/secondary style). Add confirmation: "Stop auto-saving to this file? Your data stays in the browser."
- **UI-05**: Header hint text: "Auto-saving to [filename]" if file-sync active; else "All data stored locally. Export regularly for backups."

### Tab & Feature Removal
- **UI-06**: Remove "Cash Flow" tab from `index.html` and clean up associated JS modules.
- **UI-07**: Remove "Import Bank Statement" from the Income tab.

## 2. Dashboard Simplification

### Visualizations
- **DASH-01**: Merge "12-Month Spending Trends" and "90-Day Cash Flow Projection" into a single "Rolling Financial Overview" chart.
- **DASH-02**: Unified chart window: Rolling 12-month window (9 months history + current month + 2 months forecast).
- **DASH-03**: Unified chart series: "Income" (green) and "Expenses" (orange/red).
- **DASH-04**: Unified chart visual state: Historical months are solid; forecast months are dashed/semi-transparent.
- **DASH-05**: Current month shows actuals-so-far with projected remainder.
- **DASH-06**: Remove "Cash Flow Forecast" daily cards section (`#cashflowForecastSection`).
- **DASH-07**: Remove "Budget Progress" and "Net Worth History" grid at the bottom of the dashboard.

### Summary Panels
- **DASH-08**: Simplify summary grid: Remove "ONE-OFF EXPENSES" panel. Keep INCOME, EXPENSES, NET POSITION.
- **DASH-09**: Add "CREDIT CARD PAYMENTS" panel showing £ value and % of income.
- **DASH-10**: Add "LOAN & MORTGAGE PAYMENTS" panel showing £ value and % of income.
- **DASH-11**: Add "CURRENT BALANCE" panel showing the running account balance as of today.
- **DASH-12**: Add "NEXT NEGATIVE" alert panel (visible only if a future projected expense pushes balance below zero).

## 3. Expense & Income Simplification

### Expense List
- **EXP-01**: Remove recurrent/one-off sub-tabs; all expenses display in a single unified list.
- **EXP-02**: Treat `oneOffExpenses` as recurrent with 1 occurrence for UI logic. Query both tables and sort by date.
- **EXP-03**: Remove "Variable" vs "Fixed" legend distinction from charts and UI.

### Balance Management
- **BAL-01**: Add "💰 Set Current Balance" button to both Income and Expenses tabs.
- **BAL-02**: Calculate difference between entered balance and running balance; create "Balance Adjustment" income/expense transaction as offset.
- **BAL-03**: Ensure dashboard "CURRENT BALANCE" panel reads correctly from the balance chain.

## 4. Debt & Payoff Refactor

### Schema & Types
- **DEBT-01**: Schema Migration (v13): Add `debtType` (`credit-card`, `loan`, `mortgage`) to `debts` table.
- **DEBT-02**: Map existing debts to types during migration (default to `credit-card`).
- **DEBT-03**: Add Loan/Mortgage fields: principal, term (months), fixed payment, interest rate, early repayment fee, early repayment allowed.

### Logic & UX
- **DEBT-04**: Loan/Mortgage scheduled payments must appear in the expenses list with distinct icons (🏠/💰).
- **DEBT-05**: Clicking debt card body opens statement history/ledger inline.
- **DEBT-06**: Move Edit button next to Delete in the card header.
- **DEBT-07**: Group debts visually by type ("Credit Cards", "Loans & Mortgages").

### Payoff Planner
- **DEBT-08**: Split payoff planner into "Credit Card Payoff" and "Loan/Mortgage Payoff" sections.
- **DEBT-09**: Credit Card section maintains existing avalanche/snowball/extra-payment logic.
- **DEBT-10**: Loan/Mortgage section implements fixed payment logic, principal reduction, and early fee handling.

## 5. Childcare UX
- **CHILD-01**: Clicking childcare card opens ledger view for that account.
- **CHILD-02**: Add "Edit" button to ledger view or card header.
- **CHILD-03**: Add "Opening Balance (£)" field to childcare account; ledger starts from this value.

## Success Criteria
- [ ] Persistence banner only shows when truly needed (no file-sync AND no storage persistence)
- [ ] Reset/Disconnect buttons are clearly labelled and non-confusing
- [ ] Single unified rolling chart on dashboard (9 past + current + 2 forecast months)
- [ ] Summary grid includes CC and Loan/Mortgage payment panels with % of income
- [ ] Current Balance panel and Next Negative alert functional on dashboard
- [ ] Expenses tab has single unified list (no sub-tabs)
- [ ] Debts schema v13 supports separate types and appropriate logic
- [ ] Loan/mortgage payments appear in expenses with distinct icons
- [ ] Clicking a debt/childcare card opens history/ledger inline
- [ ] Payoff planner separated by debt type
- [ ] "Set Current Balance" feature works with offset transactions
- [ ] All existing tests pass; new logic has test coverage
- [ ] File sync and auto-save continue to work throughout all changes

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 1 | Pending |
| UI-04 | Phase 1 | Pending |
| UI-05 | Phase 1 | Pending |
| UI-06 | Phase 9 | Pending |
| UI-07 | Phase 9 | Pending |
| DASH-01 | Phase 2 | Pending |
| DASH-02 | Phase 2 | Pending |
| DASH-03 | Phase 2 | Pending |
| DASH-04 | Phase 2 | Pending |
| DASH-05 | Phase 2 | Pending |
| DASH-06 | Phase 2 | Pending |
| DASH-07 | Phase 2 | Pending |
| DASH-08 | Phase 3 | Pending |
| DASH-09 | Phase 3 | Pending |
| DASH-10 | Phase 3 | Pending |
| DASH-11 | Phase 3 | Pending |
| DASH-12 | Phase 3 | Pending |
| EXP-01 | Phase 4 | Pending |
| EXP-02 | Phase 4 | Pending |
| EXP-03 | Phase 4 | Pending |
| BAL-01 | Phase 10 | Pending |
| BAL-02 | Phase 10 | Pending |
| BAL-03 | Phase 10 | Pending |
| DEBT-01 | Phase 5 | Pending |
| DEBT-02 | Phase 5 | Pending |
| DEBT-03 | Phase 5 | Pending |
| DEBT-04 | Phase 5 | Pending |
| DEBT-05 | Phase 6 | Pending |
| DEBT-06 | Phase 6 | Pending |
| DEBT-07 | Phase 6 | Pending |
| DEBT-08 | Phase 7 | Pending |
| DEBT-09 | Phase 7 | Pending |
| DEBT-10 | Phase 7 | Pending |
| CHILD-01 | Phase 8 | Pending |
| CHILD-02 | Phase 8 | Pending |
| CHILD-03 | Phase 8 | Pending |
