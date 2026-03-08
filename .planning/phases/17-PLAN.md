---
phase: 17-dashboard-invariant-forecast-kpis-and-layout-reflow
plan: 01
type: execute
wave: 1
depends_on: ["16-03"]
files_modified:
  - src/ui/dashboard.js
  - src/ui/dashboard.invariant.test.js
  - tests/balance/balance-ui.test.js
  - index.html
autonomous: true
requirements:
  - DASH-INV-01
  - DASH-INV-02
  - DASH-INV-03
  - DASH-INV-04
  - DASH-INV-05
  - DASH-INV-06
  - DASH-INV-07
must_haves:
  truths:
    - "Running Balance is derived from today's snapshot baseline and does not change with month/view navigation"
    - "Next Month Forecast is the +30 day value from the same forecast baseline used by the detailed 45-day table"
    - "3-Month Forecast is the +90 day value from the same forecast baseline used by the detailed 45-day table"
    - "Heatmap remains above month navigation, and month navigation remains above KPI cards"
    - "Chart rendering, detailed forecast toggle, and KPI card formatting are unchanged after reflow"
  artifacts:
    - path: "src/ui/dashboard.js"
      provides: "Invariant KPI derivation and dashboard rendering wired to the invariant source"
    - path: "index.html"
      provides: "Reordered dashboard layout sections for invariant/variant separation"
    - path: "src/ui/dashboard.invariant.test.js"
      provides: "DOM/order and KPI invariance regression tests"
    - path: "tests/balance/balance-ui.test.js"
      provides: "Forecast baseline/index mapping regression tests for +30/+90 day semantics"
  key_links:
    - from: "src/ui/dashboard.js"
      to: "src/utils/cashflow.js"
      via: "calculateForecast(today, 90)"
      pattern: "calculateForecast\(today, 90\)"
    - from: "src/ui/dashboard.js"
      to: "index.html#dashboardMonthPicker"
      via: "renderMonthNavigator('dashboardMonthPicker')"
      pattern: "renderMonthNavigator\('dashboardMonthPicker'\)"
    - from: "index.html#spendingHeatmapSection"
      to: "index.html#summaryGrid"
      via: "dashboardMonthPicker between both sections"
      pattern: "spendingHeatmapSection -> dashboardMonthPicker -> summaryGrid"
---

# Phase 17: Dashboard Invariant Forecast KPIs and Layout Reflow - PLAN.md

<objective>
Make Running Balance, Next Month Forecast (+30d), and 3-Month Forecast (+90d) navigation-invariant by deriving all three from the same today-forward forecast baseline used by the detailed 45-day forecast path. Reflow dashboard layout so month navigation is positioned below Spending Heatmap and above the KPI cards while preserving existing chart rendering, detailed forecast toggle behavior, and card formatting.
</objective>

<tasks>
<task type="auto" tdd="true">
  <name>Task 1: Lock invariant KPI behavior to forecast baseline</name>
  <files>src/ui/dashboard.js, src/ui/dashboard.invariant.test.js, tests/balance/balance-ui.test.js</files>
  <behavior>
    - Running Balance remains unchanged when `_selectedMonth` changes.
    - Running Balance remains unchanged when `_selectedView` changes (`current`, `ytd`, `all`).
    - Next Month Forecast equals snapshot day index 29 (+30d) from the same baseline used by detailed forecast logic.
    - 3-Month Forecast equals snapshot day index 89 (+90d) from the same baseline used by detailed forecast logic.
  </behavior>
  <action>
    - Add/extend tests first to fail on current month/view-coupled behavior.
    - In `src/ui/dashboard.js`, introduce a single helper that resolves invariant KPI values from `calculateForecast(today, 90)`.
    - Replace KPI card value sources tied to `calculateBalanceChain(_selectedMonth, 3)` with the invariant helper output only for Running Balance, Next Month Forecast, and 3-Month Forecast.
    - Keep all non-KPI metrics, chart datasets, and category spending logic unchanged to minimize blast radius.
    - Preserve existing card classes/formatting path (`dashboard-card`, `forecast-card`, `sum-val`, centralized `adjustFontSize`).
  </action>
  <verify>
    <automated>npm test -- src/ui/dashboard.invariant.test.js tests/balance/balance-ui.test.js</automated>
  </verify>
  <done>
    KPI values are invariant to month/view navigation and are derived from the forecast baseline shared with detailed forecast semantics.
  </done>
</task>

<task type="auto">
  <name>Task 2: Reflow dashboard layout sections with stable IDs and handlers</name>
  <files>index.html, src/ui/dashboard.js, src/ui/dashboard.invariant.test.js</files>
  <action>
    - Move `#dashboardMonthPicker` out of the top period row containing `#viewSelect`.
    - Place `#dashboardMonthPicker` below `#spendingHeatmapSection` and directly above `#summaryGrid`.
    - Keep container IDs and classes unchanged so existing `renderMonthNavigator('dashboardMonthPicker')` continues to work without handler rewrites.
    - Add DOM order tests asserting `spendingHeatmapSection` precedes `dashboardMonthPicker`, and `dashboardMonthPicker` precedes `summaryGrid`.
    - Do not relocate or modify rolling chart container, forecast action/toggle container insertion path, or savings/spending chart blocks.
  </action>
  <verify>
    <automated>npm test -- src/ui/dashboard.invariant.test.js</automated>
  </verify>
  <done>
    Layout order satisfies invariant/variant separation and month navigation acts as visual divider without breaking existing rendering hooks.
  </done>
</task>

<task type="auto">
  <name>Task 3: Regression guard for chart, forecast toggle, and formatting continuity</name>
  <files>src/ui/dashboard.invariant.test.js, src/ui/dashboard.js</files>
  <action>
    - Add regression tests that verify rolling chart rendering call path still executes.
    - Add regression tests ensuring `toggleForecastTable()` still toggles container visibility and button label text.
    - Add regression tests that KPI cards still apply forecast formatting markers (e.g., `forecast-card` class) and existing value render path remains intact.
    - Keep implementation changes scoped to invariant KPI sourcing and DOM position only; avoid refactors outside these boundaries.
  </action>
  <verify>
    <automated>npm test -- src/ui/dashboard.invariant.test.js</automated>
  </verify>
  <done>
    DASH-INV-07 protections are automated and pass with no regression in chart/toggle/card-format behavior.
  </done>
</task>
</tasks>

---

## Verification Plan

1. KPI invariance checks
- Command: `npm test -- src/ui/dashboard.invariant.test.js tests/balance/balance-ui.test.js`
- Confirms month/view changes do not alter Running/30d/90d KPI values.

2. Forecast baseline alignment checks
- Command: `npm test -- tests/balance/balance-ui.test.js`
- Confirms +30d and +90d values are read from 90-day forecast snapshots using day indices 29 and 89.

3. Layout reflow and wiring checks
- Command: `npm test -- src/ui/dashboard.invariant.test.js`
- Confirms DOM order: heatmap -> month navigator -> KPI cards and month navigator controls still render in relocated container.

4. Regression checks for unchanged behavior
- Command: `npm test -- src/ui/dashboard.invariant.test.js`
- Confirms chart render path, detailed forecast toggle, and KPI card formatting hooks still work.

## Acceptance Mapping (DASH-INV-01..07)

- `DASH-INV-01`: Task 1 tests prove Running Balance matches today-forward baseline and is navigation-invariant.
- `DASH-INV-02`: Task 1 and baseline/index tests prove Next Month Forecast equals +30-day projection from shared baseline.
- `DASH-INV-03`: Task 1 and baseline/index tests prove 3-Month Forecast equals +90-day projection from shared baseline.
- `DASH-INV-04`: Task 1 invariance tests cover month and view mode transitions.
- `DASH-INV-05`: Task 2 DOM order tests ensure heatmap and KPI cards are in the invariant lower section.
- `DASH-INV-06`: Task 2 DOM order tests ensure month navigation sits below heatmap and above KPI cards.
- `DASH-INV-07`: Task 3 regression tests protect chart rendering, detailed forecast toggle, and card formatting continuity.

## Minimal-Risk Sequencing

1. Add/adjust failing tests for invariance and baseline mapping before implementation changes.
2. Implement KPI source swap in `src/ui/dashboard.js` without changing unrelated chart/data flows.
3. Reflow `index.html` section order while preserving element IDs and existing render hooks.
4. Run targeted tests after each task; run full `npm test` only after all tasks pass.

## Rollback Notes

- If KPI invariant refactor introduces regression:
  - Revert only KPI-source commit in `src/ui/dashboard.js` and keep new tests to diagnose drift.
  - Restore previous monthly-chain card sourcing temporarily behind a feature guard comment until fixed.

- If layout reflow breaks navigation/toggle behavior:
  - Revert only `index.html` layout move commit while retaining invariant KPI source changes.
  - Keep DOM-order tests pending (skip/xfail) until layout move is reattempted safely.

- If formatting/chart regressions appear:
  - Revert Task 3 implementation changes first (if any production code touched), preserve regression tests, and re-apply minimal fixes.
