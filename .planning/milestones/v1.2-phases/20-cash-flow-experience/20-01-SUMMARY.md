# Phase 20-01 Summary: Cash Flow Experience

## Objective
Enhance the Dashboard with daily cash flow forecast visualizations, critical alerts, and a 7-day timeline.

## Changes
- **index.html**:
    - Added `cashflowForecastSection` for alerts and timeline.
    - Added `cashflowChartContainer` for the 90-day projection chart.
- **src/ui/charts.js**:
    - Implemented `renderCashFlowChart(canvasId, snapshots)`.
    - Renders a line chart of daily closing balances.
    - Highlights points below £0 in Vermilion.
    - Includes a prominent zero-line highlight for risk assessment.
- **src/ui/dashboard.js**:
    - Implemented `renderCashFlowForecast()`.
    - Critical Alert: Finds the first date where the balance is predicted to be negative and displays a warning card with the date and amount.
    - 7-Day Timeline: Displays a horizontal scrollable list of the next 7 days, showing daily closing balances, income, and expenses with color-coded risk indicators.
    - Integrated into the main `renderDashboard` workflow.
- **src/app.js**:
    - Maintained existing refresh patterns; dashboard updates now automatically include the daily forecast.

## Verification Results
- Dashboard now provides a comprehensive view of both monthly status and daily liquidity risk.
- Visual alerts correctly identify future "broke" dates.
- Timeline provides immediate visibility into the next week's cash movements.
