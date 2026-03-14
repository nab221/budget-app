---
phase: 27-critical-bug-fixes
plan: 05
subsystem: ui
tags: [heatmap, dashboard, expenses, transactions, year-navigation]

# Dependency graph
requires:
  - phase: 27-02
    provides: heatmap rendering foundation (renderSpendingHeatmap, allYearsData pattern)
provides:
  - Single-year heatmap rendering across all 4 call sites (dashboard income, dashboard spending, expenses tab, income tab)
  - Removal of prior-year canvas and "Prior Year" label from all heatmap containers
affects: [heatmap.js consumers, year navigation UX]

# Tech tracking
tech-stack:
  added: []
  patterns: [renderSpendingHeatmap called once per container per render cycle with no allYearsData option]

key-files:
  created: []
  modified:
    - src/ui/dashboard.js
    - src/ui/expenses.js
    - src/ui/transactions.js

key-decisions:
  - "Removed prior-year fetch entirely — no Promise.all, no prevYear, no hasPrevYearData, no allData merge at any call site"
  - "heatmap.js left untouched; fix is purely at the 4 call sites that were passing allYearsData"

patterns-established:
  - "Heatmap call site pattern: fetch single year data → call renderSpendingHeatmap once with (containerId, year, data)"

requirements-completed: [NAV-03]

# Metrics
duration: ~15min
completed: 2026-03-14
---

# Phase 27 Plan 05: Prior-Year Heatmap Removal Summary

**Surgical removal of redundant prior-year heatmap rendering from all 4 call sites — dashboard income, dashboard spending, expenses tab, and income tab — leaving a single canvas per selected year with no "Prior Year" label.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-14T22:29Z
- **Completed:** 2026-03-14T22:44Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 3

## Accomplishments

- Removed prior-year income heatmap block from dashboard.js (Promise.all, prevYear, hasPrevYearData, allData, conditional "Prior Year" canvas)
- Removed prior-year spending heatmap block from dashboard.js with the same pattern
- Removed prior-year heatmap rendering from expenses.js `renderHeatmap()` and transactions.js `renderHeatmap()`
- User visually confirmed: all tabs (Dashboard income, Dashboard spending, Expenses, Income) show exactly one canvas for the selected year

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove prior-year income and spending heatmaps from dashboard.js** - `6bcae94` (fix)
2. **Task 2: Remove prior-year heatmap from expenses.js and transactions.js** - `dd3945f` (fix)
3. **Task 3: Visual verification — single heatmap per year across all tabs** - approved by user (no code commit)

## Files Created/Modified

- `src/ui/dashboard.js` - Simplified income and spending heatmap try-blocks to single year fetch + single renderSpendingHeatmap call
- `src/ui/expenses.js` - Simplified `renderHeatmap()` to single year fetch + single renderSpendingHeatmap call
- `src/ui/transactions.js` - Simplified `renderHeatmap()` to single year fetch + single renderSpendingHeatmap call

## Decisions Made

- Removed prior-year fetch entirely at all call sites; heatmap.js was not modified — the fix is purely in the 4 consumers that were passing `allYearsData`
- No fallback or partial removal — all prior-year logic (prevYear, prevYearData, hasPrevYearData, allData merge, conditional block) removed from each site

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- NAV-03 satisfied: heatmap rendering is now single-year at all 4 call sites
- Phase 27 gap-closure plans (27-04, 27-05) are both complete; Phase 27 is fully done
- Phase 28 (Mobile Navigation Overhaul) is ready to start

---
*Phase: 27-critical-bug-fixes*
*Completed: 2026-03-14*
