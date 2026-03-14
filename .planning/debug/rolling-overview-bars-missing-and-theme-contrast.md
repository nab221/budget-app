---
status: investigating
trigger: "rolling-overview-bars-missing-and-theme-contrast"
created: 2025-01-24T16:00:00Z
updated: 2025-01-24T16:00:00Z
---

## Current Focus

hypothesis: Recent changes in Phase 7 to `aggregateRollingOverview` or `renderRollingOverviewChart` broke the bar rendering for weekly/monthly binning. Dark mode contrast issue is likely due to hardcoded color or missing CSS variable update.
test: Examine `src/ui/charts.js`, `src/utils/cashflow.js`, and theme-related files.
expecting: Identify where the bar data is lost or why the plugin fails to render them. Find the hardcoded black color for the balance line.
next_action: read_initial_files

## Symptoms

expected: Income and Expense bars should be visible when Weekly or Monthly binning is selected. Account Balance line should be visible and legible in both light and dark modes.
actual: Bars are not visible. Balance line is black and lacks contrast in dark mode.
errors: No console errors reported.
reproduction: Select Weekly or Monthly binning on the Dashboard Rolling Overview chart. Toggle dark mode to see contrast issue.
started: Started after Phase 7 changes.

## Eliminated

## Evidence

- timestamp: 2025-01-24T16:15:00Z
  checked: `src/ui/charts.js` and `src/utils/cashflow.js`
  found: 
    1. `renderRollingOverviewChart` has a bug in expenses mapping: `expenses.map(e => ({ ...e, y: -Math.abs(e.y) }))`. If `e` is a number (Daily mode), `e.y` is undefined, resulting in `y: NaN`.
    2. Bars in `renderRollingOverviewChart` use default grouping, which on a 365-day daily X-axis makes binned bars (Weekly/Monthly) extremely thin (0.5 day-width) with gaps between them, making them look missing or broken.
    3. `balanceColor` is hardcoded to `'#000000'`, causing contrast issues in dark mode.
  implication: Need to fix mapping logic, disable bar grouping, and use theme-aware color for balance line.

## Resolution

root_cause: Incorrect data mapping for daily expenses (NaN), default bar grouping causing ultra-thin bars with gaps on high-resolution X-axis, and hardcoded black color for balance line.
fix: 
    1. Update expenses mapping to handle both numbers and objects.
    2. Set `grouped: false` on bar datasets to allow them to occupy the full day width and overlap at the same X position.
    3. Use `getComputedStyle` or theme check to set `balanceColor` dynamically.
verification: 
files_changed: []