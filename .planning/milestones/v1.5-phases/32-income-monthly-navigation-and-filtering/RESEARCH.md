# Phase 32 RESEARCH: UI - Income Monthly Navigation & Filtering

## Goal
Research the current Income tab structure and how to integrate month navigation and filtering similar to the Expenses tab.

## Current State Analysis (`src/ui/transactions.js`)
- `transactionUI.currentMonth` defaults to the current YYYY-MM.
- `renderIncome(month)` uses `incomeRepository.getThreeMonthHistory(month)`, which returns a rolling history.
- Month grouping logic is in `renderIncome`.
- Search logic is in `renderIncome` and is rudimentary.

## Comparison with Expenses (`src/ui/expenses.js`)
- `expensesUI` stores independent months for its sub-tabs in `localStorage`.
- `expensesUI` uses `renderMonthPicker()` and `renderCategoryFilter()` to inject UI components.
- `expensesUI` uses the `filterTransactions` utility for consistent search and category filtering.

## Planned Changes
1. **Decouple from Rolling History**: Switch `incomeRepository.getThreeMonthHistory` to `incomeRepository.getByMonth`.
2. **Persistence**: Use `localStorage.setItem('transaction_month', ...)` to keep state across reloads.
3. **Month Navigation**: Reuse `renderMonthPicker` pattern from `expensesUI`.
4. **Category Filter**: Implement a category filter similar to `expensesUI`. This requires a container in `index.html` or injecting it after the search input.

## Integration Risks
- **DOM Placement**: Need to find the correct insertion point for the month picker. The Income tab is simpler, so putting it above the action bar is best.
- **Filtering Logic**: Ensure `filterTransactions` is correctly applied to income data (search fields should include `source`).
