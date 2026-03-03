# Milestone v1.6 Requirements: Budget Forecasting & Cash Flow Refinement

## Goal
Improve the accuracy of daily balance projections by integrating more data points and refining the forecasting logic. Introduce granular budget targets to provide better spending feedback.

## 1. Forecasting Enhancements

### Income Integration
- Ensure all types of income (Salary, Gifts, Dividends) are correctly projected in the 90-day cash flow chart.
- Handle recurring income with the same logic as recurring expenses.

### Expected vs Actual
- Implement a way to track "Expected" income for the month (e.g. expected bonus) vs what has actually been received.
- Use expected income as a baseline for future months' cash flow if specific records are missing.

## 2. Budget Targets Refinement

### Granular Categories
- Support targets for individual categories (e.g., "Groceries: £400") instead of just "Variable Spends".
- Update the "Budget Progress" UI to show individual progress bars for these granular targets.

### Rolling Budgets (Optional/Stretch)
- Allow "Carry Over" of unspent variable budget from one month to the next.

## 3. UI/UX Polish

### Dashboard Visualization
- Improve the 12-month spending trends chart to distinguish between fixed and variable spends clearly.
- Add a "Burn Rate" indicator (average daily spend) to the summary grid.

## 4. Success Criteria
- [ ] 90-day forecast includes all recurring income series.
- [ ] Dashboard shows progress bars for at least 3 specific category targets.
- [ ] Forecast accuracy remains within 5% of manual spreadsheets for simple scenarios.
