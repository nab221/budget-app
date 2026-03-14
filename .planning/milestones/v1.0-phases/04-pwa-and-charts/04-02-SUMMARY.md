---
phase: 04-pwa-and-charts
plan: 02
subsystem: ui
tags: [chart.js, okabe-ito, stacked-area, spending-trends, accessibility]

# Dependency graph
requires:
  - phase: 03-dashboard-payoff-planner-and-budget-targets
    provides: getDashboardData, dashboard UI shell, repository pattern

provides:
  - Chart.js v4 integrated and tree-shaken (line/area components only)
  - getSpendingTrends(targetMonth) aggregating 12 months of income/fixed/variable data
  - renderTrendsChart(canvasId, data) stacked area chart with Okabe-Ito palette
  - Responsive chart container in dashboard with mobile CSS

affects: [05-pdf-import, 06-cloud-backup]

# Tech tracking
tech-stack:
  added: [chart.js@4]
  patterns: [tree-shaken Chart.js registration, pence-based chart data, Okabe-Ito palette for accessibility]

key-files:
  created:
    - src/ui/charts.js
  modified:
    - src/db/repository.js
    - src/ui/dashboard.js
    - index.html
    - css/main.css

key-decisions:
  - "Register only Chart.js components needed (CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend) to keep bundle small"
  - "Use Okabe-Ito palette: Income=#0072B2 (Blue), Fixed=#D55E00 (Orange), Variable=#F0E442 (Yellow)"
  - "getSpendingTrends returns amounts in pence consistent with all other repository functions"
  - "Destroy and recreate chart instance on re-render to avoid Chart.js canvas-already-in-use errors"

patterns-established:
  - "Pattern: Chart instances stored in module-scoped Map, destroyed before re-render"
  - "Pattern: formatPence() helper in charts.js for tooltip currency formatting"

requirements-completed: [CHART-01]

# Metrics
duration: 15min
completed: 2026-02-28
---

# Phase 04 Plan 02: Spending Trends Chart Summary

**Chart.js stacked area chart on dashboard showing 12-month income/fixed/variable trends with Okabe-Ito color-blind safe palette and floating GBP tooltips**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-28T21:15:00Z
- **Completed:** 2026-02-28T21:30:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Installed and registered chart.js v4 with only required components (tree-shaken)
- Implemented getSpendingTrends() aggregating last 12 months from any reference month
- Built renderTrendsChart() as a stacked area chart with Okabe-Ito color-blind safe palette
- Added responsive chart container to dashboard with mobile-optimized max-height CSS
- Chart tooltips show exact GBP amounts (converted from pence) on hover/tap

## Task Commits

Each task was committed atomically:

1. **Task 1: Chart.js Integration & Data Aggregation** - `f344593` (feat)
2. **Task 2: Dashboard Chart UI** - `03f3326` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `src/ui/charts.js` - New: Chart.js instance factory with Okabe-Ito palette, renderTrendsChart(), _chartInstances map
- `src/db/repository.js` - Added getSpendingTrends(targetMonth) aggregating 12 months of data
- `src/ui/dashboard.js` - Updated to import and call renderTrendsChart in render cycle
- `index.html` - Added chart-container div with canvas#trendsChart above summary grid
- `css/main.css` - Added .chart-container and .chart-title styles with mobile responsive rules
- `src/ui/targets.js` - Auto-fix: removed invalid £ symbol import
- `src/ui/templates.js` - Auto-fix: aliased formatGBP as formatCurrency to fix broken import

## Decisions Made

- Aliased `formatGBP as formatCurrency` in templates.js rather than renaming all usages — preserves intent, minimal diff
- Used `interaction: { mode: 'index' }` on chart for multi-dataset tooltip on a single hover line

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed invalid pound-sign (£) named import from targets.js**
- **Found during:** Task 2 (build verification)
- **Issue:** `import { toPence, fromPence, £ }` — `£` is not exported from currency.js and caused a Vite parse error
- **Fix:** Removed the spurious `£` from the import list
- **Files modified:** `src/ui/targets.js`
- **Verification:** Build passes with no parse errors
- **Committed in:** `03f3326` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed non-existent formatCurrency import in templates.js**
- **Found during:** Task 2 (build verification)
- **Issue:** `import { formatCurrency }` — function does not exist in currency.js; correct function is `formatGBP`
- **Fix:** Changed to `import { formatGBP as formatCurrency }` — alias preserves all existing usages
- **Files modified:** `src/ui/templates.js`
- **Verification:** Build passes, template amount display logic intact
- **Committed in:** `03f3326` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - pre-existing import bugs)
**Impact on plan:** Both auto-fixes required to get production build passing. No scope creep — fixes were in pre-existing code, not introduced by this plan.

## Issues Encountered

Build was failing before my changes due to two pre-existing invalid imports in `targets.js` and `templates.js`. Both were straightforward to fix — wrong symbol and missing function alias respectively.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Chart.js is integrated and the renderTrendsChart API is stable; future plans can add new chart types to charts.js
- getSpendingTrends() is ready for any feature that needs 12-month spending history
- Production build passes at 331 KB (111 KB gzip) including Chart.js

---
*Phase: 04-pwa-and-charts*
*Completed: 2026-02-28*
