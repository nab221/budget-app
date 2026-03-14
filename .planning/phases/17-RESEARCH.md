# Phase 17: Dashboard Invariant Forecast KPIs and Layout Reflow - Research

**Researched:** 2026-03-08
**Domain:** Dashboard KPI invariance, forecast baseline unification, and dashboard layout reflow
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions
### Data Semantics
- Treat KPI cards as "today-forward snapshot" metrics, independent of dashboard timeline navigation.
- Reuse central forecast calculation path used by the detailed 45-day forecast to avoid drift between widgets.

### Layout Strategy
- Keep navigation-dependent visuals (rolling overview and timeline-driven chart state) above the section split.
- Place invariant widgets (heatmap and KPI cards) in a dedicated lower section.
- Use month navigation row as the explicit boundary: below heatmap, above KPI cards.

### Testing Focus
- Add/adjust tests to prove KPI invariance while navigating months and switching view modes.
- Add regression coverage for expected values (running/current, +30d, +90d) and DOM placement order.

### Claude's Discretion
- No additional discretion items were defined in `17-CONTEXT.md`.

### Deferred Ideas (OUT OF SCOPE)
- Add explicit card subtitles such as "As of today", "+30 days", and "+90 days" (defer unless needed for clarity after implementation).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-INV-01 | Running Balance card shows true current balance and does not change with navigation/view mode. | Current card logic in `src/ui/dashboard.js:230` is tied to `_selectedMonth`; recommendation replaces baseline with today-based daily snapshot path. |
| DASH-INV-02 | Next Month Forecast equals +30 day projection from current balance using same engine as detailed 45-day forecast. | Detailed table already uses `calculateForecast(today, 45)` in `src/ui/dashboard.js:461`; recommendation derives KPI from same snapshots at day index 29. |
| DASH-INV-03 | 3-Month Forecast equals +90 day projection from current balance using same engine as detailed 45-day forecast. | `calculateForecast` already supports variable horizons in `src/utils/cashflow.js:218`; recommendation computes 90-day and reads day index 89. |
| DASH-INV-04 | All 3 KPI cards are invariant to selected month and view mode. | Current KPI values depend on `_selectedMonth` and `calculateBalanceChain(_selectedMonth, 3)` (`src/ui/dashboard.js:201`), creating state drift; recommendation isolates invariant data path. |
| DASH-INV-05 | Heatmap and KPI cards grouped in invariant section below navigation-dependent chart content. | Current HTML places `summaryGrid` before heatmap (`index.html:82`, `index.html:92`); recommendation reorders sections. |
| DASH-INV-06 | Month navigation controls moved below heatmap and above KPI cards. | Current month picker is in top period row (`index.html:68`) and rendered by `renderMonthNavigator` (`src/ui/dashboard.js:52`); recommendation relocates container and preserves handlers. |
| DASH-INV-07 | Existing chart rendering, detailed forecast toggle, and card formatting continue to work. | Existing chart/toggle wiring in `src/ui/dashboard.js:116` and formatting logic in card builder (`src/ui/dashboard.js:284`) are preserved by scoped changes. |

## Executive Summary

The dashboard currently mixes navigation-dependent and navigation-invariant concerns. The three top KPI cards (Running Balance, Next Month Forecast, 3-Month Forecast) are built from a month-based chain using `_selectedMonth` (`src/ui/dashboard.js:201`), so values can change when users move month or switch to YTD/all-time. This conflicts with Phase 17 requirements that these cards always represent today-forward values and share the same baseline as the detailed 45-day forecast.

The detailed forecast table already uses the correct invariant baseline path: `calculateForecast(today, 45)` (`src/ui/dashboard.js:461`, `src/utils/cashflow.js:218`). The lowest-risk solution is to centralize KPI derivation on this same engine: Running Balance from day 0 closing balance, Next Month from day 30 closing balance, 3-Month from day 90 closing balance, all computed from today regardless of dashboard navigation state.

Layout also needs reflow. Current structure renders month navigation and summary cards above heatmap (`index.html:68`, `index.html:82`, `index.html:92`). To satisfy requirements and improve mental separation, keep rolling chart and time-filter controls above, then heatmap, then month navigator as divider, then invariant KPI cards.

**Primary recommendation:** Introduce one invariant KPI data function powered by `calculateForecast(today, 90)`, relocate `dashboardMonthPicker` below heatmap, and keep existing chart/toggle/card-render code paths intact.

## Current-State Implementation Map

### Dashboard summary cards (Running Balance, Next Month Forecast, 3-Month Forecast)
- `src/ui/dashboard.js:95` `renderDashboard()` orchestrates all dashboard rendering.
- `src/ui/dashboard.js:201` computes `monthlyChain = await calculateBalanceChain(_selectedMonth, 3)`.
- `src/ui/dashboard.js:203` `nextMonthSnap` selected from `monthlyChain` using `_selectedMonth` comparison.
- `src/ui/dashboard.js:230` card definition for `Running Balance`.
- `src/ui/dashboard.js:237` card definition for `Next Month Forecast`.
- `src/ui/dashboard.js:244` card definition for `3-Month Forecast`.
- `src/ui/dashboard.js:284` card formatting and class application (`forecast-card`, warning styles, value formatting hooks).

### Month navigation UI
- `src/ui/dashboard.js:52` `renderMonthNavigator(containerId)` creates prev/select/next controls and mutates `_selectedMonth`.
- `src/ui/dashboard.js:100` `renderDashboard()` invokes `renderMonthNavigator('dashboardMonthPicker')` each render.
- `index.html:68` current `#dashboardMonthPicker` placement is in top period selector row beside `#viewSelect`.

### Spending heatmap placement
- `index.html:92` heatmap container `#spendingHeatmapContainer` inside `#spendingHeatmapSection`, currently below `#summaryGrid`.
- `src/ui/dashboard.js:361` heatmap render block.
- `src/ui/dashboard.js:376` `renderSpendingHeatmap('spendingHeatmapContainer', year, currentYearData, ...)`.

### Detailed 45-day forecast engine
- `src/ui/dashboard.js:452` `renderForecastTable()` loads detailed table.
- `src/ui/dashboard.js:461` calls `calculateForecast(today, 45)`.
- `src/utils/cashflow.js:218` `calculateForecast(startDate, horizonDays = 45)` core daily forecast engine.
- `src/utils/cashflow.test.js:184` verifies `calculateForecast` aligns with `getDailyRollingData` balances for 45 days.

## Gap Analysis vs DASH-INV-01..07

| Req | Current State | Gap | Priority |
|-----|---------------|-----|----------|
| DASH-INV-01 | Running Balance uses snapshot fallback plus month-chain context in `renderDashboard` (`src/ui/dashboard.js:190`, `src/ui/dashboard.js:201`). | Can drift with `_selectedMonth`; not strictly invariant/today-forward. | High |
| DASH-INV-02 | Next Month Forecast uses `calculateBalanceChain(_selectedMonth, 3)` monthly snap (`src/ui/dashboard.js:201`). | Not tied to detailed 45-day engine; monthly semantics, not +30 day daily horizon. | High |
| DASH-INV-03 | 3-Month Forecast uses last element of monthly chain (`src/ui/dashboard.js:204`). | Not +90 day daily projection and not engine-aligned with detailed forecast. | High |
| DASH-INV-04 | KPI values are computed inside navigation-aware render flow with `_selectedMonth` and `_selectedView`. | KPI cards change with month/view navigation; violates invariance requirement. | High |
| DASH-INV-05 | `#summaryGrid` appears before heatmap in DOM (`index.html:82` then `index.html:92`). | Invariant section ordering is reversed from requirement. | Medium |
| DASH-INV-06 | `#dashboardMonthPicker` is in top control row (`index.html:68`). | Navigation controls not acting as divider between variable/invariant sections. | Medium |
| DASH-INV-07 | Chart and toggle are stable (`src/ui/dashboard.js:116`, `src/ui/dashboard.js:433`), formatting is centralized in card renderer. | Risk of regression during DOM reflow and KPI sourcing changes; requires explicit regression tests. | Medium |

## Recommended Architecture and Minimal-Risk Implementation Steps

### Target approach
Use a single invariant KPI snapshot source built on `calculateForecast(today, 90)` and keep all navigation-dependent data paths (`getDashboardData`, rolling chart month/view behavior) unchanged.

### Step plan
1. Add invariant KPI resolver in `src/ui/dashboard.js`.
- New helper (example name: `getInvariantForecastKpis`) should call `calculateForecast(today, 90)` once.
- Derive:
  - `runningBalance` = `snapshots[0].closingBalance`.
  - `nextMonthForecast` = `snapshots[29].closingBalance` (30-day horizon).
  - `threeMonthForecast` = `snapshots[89].closingBalance` (90-day horizon).
- Keep null-safe fallback behavior if snapshot length is short.

2. Replace monthly-chain KPI wiring only.
- Remove KPI dependence on `calculateBalanceChain(_selectedMonth, 3)` in `renderDashboard`.
- Keep `calculateBalanceChain` usage elsewhere untouched.
- Preserve card metadata and formatting path (`isForecast`, `forecast-card`, warning/risk badges).

3. Reflow dashboard section order in `index.html`.
- Move `#dashboardMonthPicker` out of top period row (keep `#viewSelect` there).
- Place `#dashboardMonthPicker` after `#spendingHeatmapSection` and before `#summaryGrid`.
- Keep element IDs unchanged to avoid JS handler churn.

4. Keep detailed forecast toggle and chart wiring unchanged.
- Do not alter `#rollingOverviewChartContainer`, `#dashboardForecastActions`, `toggleForecastTable()` behavior.
- Ensure `renderMonthNavigator('dashboardMonthPicker')` still executes after DOM move.

5. Add explicit regression tests before/with refactor.
- Add dashboard behavior tests that lock invariance and layout order.

## Testing Strategy

### Test framework and commands
- Framework: Vitest (`package.json:10`).
- Quick run: `npm test -- src/utils/cashflow.test.js tests/balance/balance-ui.test.js`.
- Full run: `npm test`.

### Unit targets
1. `src/utils/cashflow.test.js` (extend)
- Add test: 90-day horizon returns 90 snapshots and deterministic day-30/day-90 picks.
- Add test: KPI extraction helper (if moved to utility) maps indices 0/29/89 correctly.

2. `tests/balance/balance-ui.test.js` (extend or split)
- Add invariance test: changing month/view inputs does not change Running/30d/90d values when underlying data unchanged.
- Add regression test: values are sourced from daily forecast, not monthly chain assumptions.

### UI behavior targets (jsdom-level)
1. New file: `src/ui/dashboard.invariant.test.js`
- Verify DOM order: `#spendingHeatmapSection` precedes `#dashboardMonthPicker`, which precedes `#summaryGrid`.
- Verify month nav still renders controls (`.prev-month`, `.month-select`, `.next-month`) in relocated container.
- Verify detailed forecast toggle (`#toggleForecastTableBtn`) still mounts and toggles table visibility.

2. Existing rendering behaviors to protect
- Card class and formatting hooks (`forecast-card`, `sum-val`) remain unchanged (`src/ui/dashboard.js:284`).
- Rolling chart render still called once with current rolling data.

## Risks and Pitfalls with Mitigation

1. Off-by-one horizon bug (30/90 day indexing).
- Risk: using wrong snapshot index (30 instead of 29, 90 instead of 89).
- Mitigation: codify index constants and add direct index assertion tests.

2. Hidden coupling to `_selectedMonth`.
- Risk: helper accidentally still consumes navigation state.
- Mitigation: helper takes no month/view args and always computes from `today`.

3. DOM move breaks selector assumptions.
- Risk: CSS spacing or mobile layout regressions after moving `#dashboardMonthPicker`.
- Mitigation: keep same ID/class, adjust only container location, add jsdom order assertion and quick manual mobile check.

4. Forecast toggle regressions due to container adjacency assumptions.
- Risk: insertion logic around `rollingOverviewChartContainer` disturbed by unrelated layout edits.
- Mitigation: avoid editing forecast-toggle insertion code path; add targeted toggle behavior test.

5. Performance regression from duplicate forecast calls.
- Risk: `calculateForecast` called multiple times per render for cards and table.
- Mitigation: cache forecast snapshots within a single `renderDashboard` invocation and reuse for KPI derivation.

## Code Examples

### Invariant KPI derivation pattern
```javascript
// src/ui/dashboard.js
async function getInvariantForecastKpis() {
  const { calculateForecast } = await import('../utils/cashflow.js');
  const today = new Date().toISOString().split('T')[0];
  const snapshots = await calculateForecast(today, 90);

  return {
    runningBalance: snapshots[0]?.closingBalance ?? 0,
    nextMonthForecast: snapshots[29]?.closingBalance ?? null,
    threeMonthForecast: snapshots[89]?.closingBalance ?? null
  };
}
```

### Layout order invariant assertion (test)
```javascript
// src/ui/dashboard.invariant.test.js
const heatmap = document.getElementById('spendingHeatmapSection');
const nav = document.getElementById('dashboardMonthPicker');
const kpis = document.getElementById('summaryGrid');

expect(Boolean(heatmap.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
expect(Boolean(nav.compareDocumentPosition(kpis) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
```

## Sources

### Primary (HIGH confidence)
- Repository source code inspection:
  - `index.html:68`
  - `index.html:82`
  - `index.html:92`
  - `src/ui/dashboard.js:52`
  - `src/ui/dashboard.js:95`
  - `src/ui/dashboard.js:201`
  - `src/ui/dashboard.js:230`
  - `src/ui/dashboard.js:361`
  - `src/ui/dashboard.js:452`
  - `src/utils/cashflow.js:218`
  - `src/utils/cashflow.test.js:184`
  - `tests/balance/balance-ui.test.js:1`
  - `.planning/phases/17-CONTEXT.md:1`

## Metadata

**Confidence breakdown:**
- Current-state implementation map: HIGH (direct file/function inspection).
- Gap analysis: HIGH (direct comparison to `17-CONTEXT.md` requirements).
- Recommended implementation steps: HIGH (minimal-scope refactor on existing paths).

**Research date:** 2026-03-08
**Valid until:** 2026-04-07
