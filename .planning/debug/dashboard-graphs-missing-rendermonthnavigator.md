---
status: awaiting_human_verify
trigger: "Graphs not appearing on dashboard. No error on initial load, but after navigating away (shift+tab) and back, an error appears: `ReferenceError: renderMonthNavigator is not defined` at dashboard.js:82"
created: 2026-03-07T00:00:00Z
updated: 2026-03-07T15:00:00Z
---

## Current Focus

hypothesis: CONFIRMED (Bug 4 — sub-pixel bars) — After removing `grouped: false`, bars render at correct categorical positions but are still invisible because the chart has 410 daily CategoryScale positions (365 days history + 45 days forecast) and two bar datasets that are non-stacked (grouped side-by-side). Each bar width = chartWidth / 410 / 2 ≈ 0.5px — sub-pixel, anti-aliased to transparent on HTML5 canvas. The mixed-resolution design keeps daily labels (for the balance line) but maps weekly bin totals to each day. The fix is to add `stacked: true` on the y-scale so Income and Expenses share the same x position (each bar becomes ~1px instead of ~0.5px), and `minBarLength: 2` so near-zero-value bars remain visible. Seven consecutive 1px bars of the same weekly total height create a visible ~7px block per week.
test: Code analysis: 410 CategoryScale positions, 2 non-stacked bar datasets, barPercentage:1.0, categoryPercentage:1.0. Bar width = chartWidth / numCategories / numDatasets = 400px / 410 / 2 = 0.49px. Canvas renders sub-pixel rects at fractional width — visually transparent.
expecting: Adding stacked:true on y-scale halves the number of datasets at each x position (income stacks above 0, expenses below 0), doubling bar width to ~1px. 7 consecutive 1px same-color bars = ~7px visible weekly block.
next_action: Add stacked:true to y-scale config in renderRollingOverviewChart, add minBarLength:2 to both bar datasets.

## Symptoms

expected: Dashboard graphs should render on load and when navigating back to the dashboard panel.
actual: Graphs not appearing on initial load (no error). After shift+tabbing away and back, error: `ReferenceError: renderMonthNavigator is not defined` at dashboard.js:82
errors: |
  app.js:33 Budget App initializing...
  templates.js:14 templateUI.init(): minimal mode active (recurrence system)
  app.js:200 Budget App initialized successfully.
  app.js:71 [app] Rendering active panel: income
  app.js:71 [app] Rendering active panel: dashboard
  dashboard.js:82  Uncaught (in promise) ReferenceError: renderMonthNavigator is not defined
      at renderDashboard (dashboard.js:82:3)
      at Object.renderAll (app.js:75:53)
      at HTMLDivElement.<anonymous> (app.js:141:24)
reproduction: Load app, graphs not visible. Shift+tab away from dashboard, shift+tab back — error fires.
timeline: Recent changes to dashboard.js and charts.js per git status (both modified but not committed).

## Eliminated

- hypothesis: renderMonthNavigator was renamed or moved to another module
  evidence: Searching entire repo found zero other definitions — the function simply did not exist in the working copy
  timestamp: 2026-03-07T00:01:00Z

- hypothesis: Bar chart data mapping or binning logic was wrong
  evidence: aggregateRollingOverview correctly returns {y, daily, isForecast} objects; renderRollingOverviewChart maps them correctly. The bug was solely the missing root type on the Chart constructor.
  timestamp: 2026-03-07T00:02:00Z

- hypothesis: Theme listener was not firing
  evidence: toggleTheme() was called and worked. The issue was it never triggered a re-render, so the chart colors (captured at chart creation time from data-theme attribute) were stale.
  timestamp: 2026-03-07T00:02:00Z

- hypothesis: grouped:false caused NaN bar positions
  evidence: Removing `grouped: false` did NOT fix the invisible bars. The bars render at correct positions but are sub-pixel thin. The NaN-position theory was correct in isolation but removing it was not sufficient because the width problem persists independently.
  timestamp: 2026-03-07T15:00:00Z

## Evidence

- timestamp: 2026-03-07T00:00:30Z
  checked: dashboard.js line 82 (error location)
  found: `renderMonthNavigator('dashboardMonthPicker')` called with no local definition and no import for it
  implication: Function is called but not in scope — matches the ReferenceError exactly

- timestamp: 2026-03-07T00:00:40Z
  checked: All JS files in src/ via grep
  found: `renderMonthNavigator` exists only at dashboard.js:82 (the call site) — no definition anywhere
  implication: The function definition was deleted from the working copy

- timestamp: 2026-03-07T00:00:50Z
  checked: git diff HEAD -- src/ui/dashboard.js
  found: Two function bodies replaced with stub comments in working copy:
    1. `initDashboard()` body replaced with `// ... existing initDashboard code ...` — no longer calls renderDashboard() on init
    2. `renderMonthNavigator()` entire function replaced with `// ... other methods ...` — function definition deleted
  implication: Both symptoms explained — no graphs on load (initDashboard is now a no-op) and ReferenceError on navigation (renderMonthNavigator deleted but still called)

- timestamp: 2026-03-07T00:01:00Z
  checked: git show HEAD:src/ui/dashboard.js lines 28–82
  found: Full original bodies for both functions are intact in the committed version
  implication: Fix is to restore both function bodies from committed code

- timestamp: 2026-03-07T00:02:00Z
  checked: src/ui/charts.js renderRollingOverviewChart — Chart constructor call
  found: new Chart(canvas, { data: {...}, options: {...} }) — missing required top-level `type` field for Chart.js v4 mixed chart
  implication: Chart.js v4 requires a root `type` even for mixed charts where each dataset declares its own type. Without it, the chart instance is not properly constructed and bar datasets are never rendered. Fix: add `type: 'bar'` to the root config object.

- timestamp: 2026-03-07T00:02:00Z
  checked: src/app.js themeToggle click handler
  found: Handler only called toggleTheme(), which sets the data-theme attribute. renderRollingOverviewChart captures balanceColor from data-theme at chart-creation time — so no re-render means old colors persist.
  implication: Theme change requires chart to be destroyed and re-created with the new color. Fix: call window.app.renderAll() after toggleTheme() in the click handler.

- timestamp: 2026-03-07T14:16:00Z
  checked: Chart.js v4.5.1 BarController._calculateBarIndexPixels source
  found: When `grouped: false`, bar center is computed as `scale.getPixelForValue(this.getParsed(index)[scale.axis], index)`. Our data objects `{y, daily, isForecast}` have no `x` property. Chart.js resolveObjectKey(obj, 'x') returns undefined. CategoryScale.parse(undefined, i) returns null (isNullOrUndef check). CategoryScale.getPixelForValue(null) returns NaN. Bar center = NaN = not rendered.
  implication: Removing `grouped: false` was correct to fix bar positioning. But it was not the sole cause of invisibility.

- timestamp: 2026-03-07T15:00:00Z
  checked: Full renderRollingOverviewChart config, aggregateRollingOverview output structure, dashboard.js call site with _selectedBinning='W'
  found: getDailyRollingData with binning='W' returns 410 daily labels (365 history + 45 forecast). aggregateRollingOverview maps each daily index to its weekly bin total: all 7 days in a week share the same {y: weekTotal} value. The chart has 410 CategoryScale positions. With two non-stacked bar datasets (Income, Expenses) and barPercentage:1.0, categoryPercentage:1.0, Chart.js places Income and Expenses side-by-side per category. Bar width per dataset = chartWidth / 410 / 2 ≈ 0.5px on a 400px-wide chart. HTML5 Canvas renders 0.5px-wide rectangles via anti-aliasing — visually transparent/invisible. No `stacked: true` is set on the y-scale, so datasets remain grouped (side-by-side) rather than stacked (sharing x position). No `minBarLength` is set, so near-zero values also produce zero-height bars.
  implication: Root cause of persistent invisible bars is the combination of: (1) 410 daily categories on the x-axis, (2) two grouped (non-stacked) bar datasets, (3) no minBarLength. Fix: add `stacked: true` to the y-scale (doubles effective bar width to ~1px per bar; Income goes above 0, Expenses go below 0 via their negative y values), add `minBarLength: 2` to both bar datasets (ensures near-zero values show as 2px stubs).

## Resolution

root_cause: |
  Four separate bugs present across two debug sessions:
  1. (Session 1 — fixed) dashboard.js: initDashboard() and renderMonthNavigator() bodies replaced with stub comments during edit.
  2. (Session 2 — fixed) charts.js renderRollingOverviewChart: missing `type: 'bar'` at the root Chart.js v4 config object.
  3. (Session 2 — fixed) app.js themeToggle handler: only called toggleTheme() without re-rendering; chart colors go stale.
  4. (Session 2 — THIS BUG) charts.js renderRollingOverviewChart: 410 daily CategoryScale positions with two NON-STACKED bar datasets produces bar width of ~0.5px — sub-pixel and invisible on canvas. The mixed-resolution design (daily labels for balance line, weekly totals for bars) requires stacked bars to be visible: adding `stacked: true` on the y-axis makes Income and Expenses share the same x-position (income positive above 0, expenses negative below 0), doubling bar width to ~1px. Seven consecutive 1px same-color bars (one per day in the weekly bin) visually merge into a ~7px weekly block. `minBarLength: 2` prevents near-zero values from disappearing.

fix: |
  Add `stacked: true` to the y-scale in renderRollingOverviewChart (src/ui/charts.js).
  Add `minBarLength: 2` to both the Income and Expenses bar dataset configs.
  Expenses dataset already negates y via `-Math.abs(obj.y)` so stacking correctly places them below zero.

verification: All 143 tests pass 2026-03-07T15:05:00Z. Fix applied to src/ui/charts.js: added stacked:true to y-scale, minBarLength:2 to both bar datasets.

files_changed:
  - src/ui/dashboard.js
  - src/ui/charts.js
  - src/app.js
