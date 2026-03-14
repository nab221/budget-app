---
phase: 04-pwa-and-charts
plan: "03"
subsystem: ui
tags: [chart.js, pwa, localStorage, navigator.storage, okabe-ito, debt-projection]

requires:
  - phase: 04-01
    provides: Service worker registration, install prompt, PWA manifest
  - phase: 04-02
    provides: renderTrendsChart, OKABE_ITO palette, Chart.js registration pattern

provides:
  - renderDebtPayoffChart(canvasId, projectionData) in src/ui/charts.js
  - checkStoragePersistence() in src/ui/pwa-ux.js
  - checkExportReminder() in src/ui/pwa-ux.js
  - Red "Risk" badge on Net Worth card when storage persistence is denied
  - Export reminder banner when last backup > 7 days ago
  - "Ready for Offline" status in Settings tab

affects: [05-pdf-import, 06-cloud-backup]

tech-stack:
  added: []
  patterns:
    - "Debt balance-over-time series computed inline in payoff.js, not in finance.js, to keep display logic separate from pure finance math"
    - "LAST_EXPORT_KEY exported from pwa-ux.js and imported by backup.js to avoid magic string duplication"
    - "checkStoragePersistence() called in parallel with getDashboardData() via Promise.all for no extra latency"

key-files:
  created: []
  modified:
    - src/ui/charts.js
    - src/ui/payoff.js
    - src/ui/pwa-ux.js
    - src/ui/dashboard.js
    - src/ui/backup.js
    - src/app.js
    - index.html

key-decisions:
  - "Chart X-axis capped at 24 months by default (CHART_MONTHS=120 used for data, but only first 24 labels displayed) matching plan truth: initial view focused on next 24 months"
  - "Export reminder does NOT show on first load if no export exists — new users get a grace period to avoid being nagged immediately"
  - "Storage persistence check made conservative: if navigator.storage.persisted API is unavailable, returns false (show Risk badge) rather than optimistically assuming true"

patterns-established:
  - "Chart destroy-before-render pattern (via _chartInstances Map) applies to all new chart functions"
  - "DOM element guards (if (!el) return) in all pwa-ux.js show/hide helpers"

requirements-completed: [CHART-02, DATA-03, FOUND-03]

duration: 3min
completed: 2026-02-28
---

# Phase 04 Plan 03: PWA and Charts Summary

**Debt payoff timeline chart (24-month Avalanche view) and PWA data safety UX: export reminder banner, red "Risk" badge on Net Worth card, and "Ready for Offline" status in Settings.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T22:54:55Z
- **Completed:** 2026-02-28T22:57:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added `renderDebtPayoffChart()` to `charts.js` with Okabe-Ito extended debt palette — chart defaults to 24-month X-axis focus for mobile readability
- Added `computeBalanceSeries()` in `payoff.js` to simulate Avalanche balance-over-time per debt; chart updates reactively on Extra Payment input change
- Added `checkStoragePersistence()` and `checkExportReminder()` to `pwa-ux.js`; export timestamp tracked via `LAST_EXPORT_KEY` written by `backup.js` after each successful export
- Dashboard Net Worth card shows red "Risk" pill badge when `navigator.storage.persisted()` returns false
- "Ready for Offline" status text appears in Settings tab when service worker fires `onOfflineReady`
- Export reminder banner appears in header when last backup is older than 7 days

## Task Commits

1. **Task 1: Debt Payoff Timeline Chart** - `b2205fb` (feat)
2. **Task 2: Data Safety & Smart Reminders** - `d1dabfe` (feat)

## Files Created/Modified

- `src/ui/charts.js` - Added `renderDebtPayoffChart()` with extended Okabe-Ito palette for multiple debt lines; 24-month initial X-axis view
- `src/ui/payoff.js` - Added `computeBalanceSeries()` helper for per-debt balance projection; calls `renderDebtPayoffChart()` on each simulation update
- `src/ui/pwa-ux.js` - Added `checkStoragePersistence()`, `checkExportReminder()`, `LAST_EXPORT_KEY` constant, `_showExportReminder()`, `_hideExportReminder()`, `_showOfflineReadyStatus()`; wired `onOfflineReady` callback
- `src/ui/dashboard.js` - Imports `checkStoragePersistence()`, runs it in parallel with data fetch, conditionally adds "Risk" badge HTML to Net Worth label
- `src/ui/backup.js` - Imports `LAST_EXPORT_KEY`, writes `localStorage.setItem(LAST_EXPORT_KEY, Date.now())` after successful export download
- `src/app.js` - Imports `checkExportReminder`, calls it on startup
- `index.html` - Added `<canvas id="payoffChart">` in Payoff Planner panel; added `#export-reminder` banner; added `#offline-ready-status` element in Settings Install App section

## Decisions Made

- Chart X-axis defaults to 24 months (plan requirement: "initial view focused on next 24 months") — full 10-year balance series is computed internally but only 24 labels shown
- Export reminder grace period: if `LAST_EXPORT_KEY` is absent (never exported), reminder is hidden rather than shown — avoids nagging brand-new users immediately
- Storage persistence check is conservative: API absence treated as "not persisted" so the Risk badge appears, which is the safe fallback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 chart and PWA UX requirements are complete
- Export timestamp infrastructure (`LAST_EXPORT_KEY`) is in place and will persist across sessions
- Phase 5 (PDF Import) can proceed; no blockers from this plan

---
*Phase: 04-pwa-and-charts*
*Completed: 2026-02-28*
