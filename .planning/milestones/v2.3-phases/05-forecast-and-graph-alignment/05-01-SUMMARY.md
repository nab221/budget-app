---
phase: 05-forecast-and-graph-alignment
plan: 01
subsystem: analytics
tags: [forecast, charts, data-layer]
requires: [DASH-03, FORC-01]
tech_stack: [Chart.js, JavaScript]
key_files: [src/utils/cashflow.js, src/ui/charts.js]
metrics:
  duration: "45m"
  date: "2026-03-06"
  tasks: 2
  files: 2
---

# Phase 05 Plan 01: Forecast & Graph Alignment Summary

## Substantive One-liner
Unified the forecasting calculation engine and enhanced the Rolling Overview chart with multi-line support for balance, income, and expenses.

## Outcomes
- **Unified Logic:** Refactored `getDailyRollingData` to use the same logic as `calculateForecast`, ensuring consistency between the table and chart views.
- **Enhanced Data Structure:** `getDailyRollingData` now returns enriched data including historical and forecast income/expense aggregates.
- **Multi-line Chart:** The Rolling Overview chart now displays three distinct lines (Balance, Income, Expenses) with a toggleable legend and comprehensive tooltips.
- **Fixed Horizon:** Standardized the forecast horizon to 45 days across all components.

## Key Decisions
- **Shared Loop:** Extracted a shared core logic in `src/utils/cashflow.js` to handle both historical aggregation and future projections, preventing logic drift.
- **Color Scheme:** Used `OKABE_ITO` accessible colors for the new chart datasets to maintain visual clarity and accessibility.

## Deviations from Plan
None - plan executed exactly as written.

## Self-Check: PASSED
- [x] `getDailyRollingData` returns balance, income, and expense arrays.
- [x] `calculateForecast` defaults to 45 days.
- [x] Chart displays three distinct lines.
- [x] Commits 6aedac2 and f16f090 exist.
