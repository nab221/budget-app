---
status: investigating
trigger: "The 'Rolling Financial Overview' banner on the Dashboard is fixed and does not respond to month navigation. Additionally, the layout order is suboptimal and inconsistent across tabs."
created: 2025-01-24T12:00:00Z
updated: 2025-01-24T12:00:00Z
---

## Current Focus

hypothesis: The Rolling Financial Overview chart is rendered outside the standard reactive update loop for the dashboard or its data fetching doesn't account for the selected month. Layout order is hardcoded in a way that places it incorrectly.
test: Examine `src/ui/dashboard.js` and `src/ui/render.js` to see how the dashboard is composed and how navigation triggers updates.
expecting: Find that the Rolling Chart is rendered once or uses a fixed period (e.g., current date) instead of the application state's selected month.
next_action: gather initial evidence by reading dashboard and rendering logic.

## Symptoms

expected: 'Rolling Financial Overview' at the top of the Dashboard, responding to month/view navigation. In other tabs (Income/Expenses), navigation elements should be placed above the month 'bubbles'.
actual: Rolling chart is between bubbles and other graphs, and it remains static when navigation is used. Navigation is inconsistent across tabs.
errors: Logic disconnect between navigation state and the Rolling Chart rendering.
reproduction: Change the selected month or view on the Dashboard and observe that the 'Rolling Financial Overview' chart does not update its period or markers.
started: Likely a regression from Phase 4 layout reordering.

## Eliminated

## Evidence

- timestamp: 2025-01-24T12:10:00Z
  checked: src/utils/cashflow.js and src/ui/dashboard.js
  found: `getDailyRollingData` is hardcoded to use `today` for its range (365 days back, 45 days forward) and does not accept any parameters. `src/ui/dashboard.js` calls it without parameters.
  implication: The Rolling Chart will always show the same window regardless of month navigation.

- timestamp: 2025-01-24T12:12:00Z
  checked: index.html
  found: `rollingOverviewChartContainer` is placed after `summaryGrid` (bubbles). On Income/Expenses tabs, the Month Picker is placed after the summary bubbles.
  implication: Layout order is inconsistent with user expectations ("Rolling chart at top", "Navigation above bubbles").

## Resolution

root_cause: `getDailyRollingData` lacks parameterization to support month navigation, and the HTML structure in `index.html` has suboptimal ordering for the requested UX.
fix:
verification:
files_changed: []
