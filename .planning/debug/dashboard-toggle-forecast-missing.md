---
status: investigating
trigger: "Investigate issue: dashboard-toggle-forecast-missing. Clicking the 'Show detailed 90-days forecast' button results in a ReferenceError: toggleForecastTable is not defined."
created: 2024-05-22T12:00:00Z
updated: 2024-05-22T12:00:00Z
---

## Current Focus

hypothesis: toggleForecastTable function is missing from dashboard.js or its scope.
test: Check src/ui/dashboard.js and related files for toggleForecastTable definition.
expecting: Either missing or renamed function.
next_action: Examine src/ui/dashboard.js around line 115.

## Symptoms

expected: The forecast table should toggle visibility.
actual: ReferenceError: toggleForecastTable is not defined.
errors: Uncaught ReferenceError: toggleForecastTable is not defined at toggleBtn.onclick (dashboard.js:115:35)
reproduction: Click "📋 Show Detailed 90-Day Forecast" on the Dashboard.
started: Just started after the v2.2 stabilization implementation.

## Eliminated

## Evidence

- timestamp: 2024-05-22T12:05:00Z
  checked: src/ui/dashboard.js
  found: renderDashboard calls toggleForecastTable and renderForecastTable, but these functions are not defined in the file or imported.
  implication: This is the direct cause of the ReferenceError. They were likely accidentally removed during a recent refactor.

## Resolution

root_cause: The functions toggleForecastTable and renderForecastTable are missing from src/ui/dashboard.js, but are still being called by the UI logic.
fix: Re-implement toggleForecastTable and renderForecastTable in src/ui/dashboard.js.
verification:
files_changed: [src/ui/dashboard.js]
