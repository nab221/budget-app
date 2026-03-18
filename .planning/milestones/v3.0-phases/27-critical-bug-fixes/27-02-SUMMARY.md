---
phase: 27
plan: 02
subsystem: ui
tags: [heatmap, mobile, css, bug-fix]
dependency_graph:
  requires: []
  provides: [heatmap-year-filter, sync-dot-mobile-fix]
  affects: [src/ui/heatmap.js, src/ui/cloud-sync.js, css/main.css]
tech_stack:
  added: []
  patterns: [pre-filter-before-scale, flex-shrink-inline-style]
key_files:
  created: []
  modified:
    - src/ui/heatmap.js
    - src/ui/cloud-sync.js
    - css/main.css
decisions:
  - "Call sites in dashboard.js already pass year-scoped dailyData (from getYearlyDailyIncome/getYearlyDailySpending), so no call-site filter was added to dashboard.js; pre-filter in heatmap.js is sufficient"
  - "Added both inline style flex-shrink:0 and a CSS class rule for belt-and-suspenders; CSS rule only sets flex-shrink (no display/width override)"
metrics:
  duration: ~18 minutes
  completed_date: 2026-03-14
  tasks_completed: 2
  files_modified: 3
---

# Phase 27 Plan 02: Heatmap Year-Filter & Mobile Sync Dot Summary

Year-filtered heatmap scale calculation using filteredDailyData pre-filter and mobile flex-shrink fix on the cloud sync status dot.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Pre-filter dailyData to target year in renderSpendingHeatmap() | 8380774 |
| 2 | Add flex-shrink:0 to sync status dot inline style + CSS class | 6b43957 |

## What Was Built

### Task 1: Heatmap Year-Boundary Fix (Bug 4)

Added a `filteredDailyData` constant immediately after `const yearNum = parseInt(year)` in `renderSpendingHeatmap()`. The filter parses each date key and keeps only entries where `new Date(k).getFullYear() === yearNum`. This local constant replaces `dailyData` in four locations:

1. Scale calculation: `const dataForScale = allYearsData || filteredDailyData`
2. Cell rendering: `filteredDailyData[dateStr] || { total: 0 }`
3. Mousemove tooltip handler: `filteredDailyData[dateStr] || { total: 0 }`
4. Touchstart tooltip handler: `filteredDailyData[dateStr] || { total: 0 }`

The function parameter `dailyData` is unchanged — only a local `filteredDailyData` is introduced.

**Call-site analysis (dashboard.js):** Both the income heatmap (line 379) and spending heatmap (line 420) already pass year-scoped data via `getYearlyDailyIncome(year)` / `getYearlyDailySpending(year)`. No call-site filter was needed. The `allYearsData` option is passed for intentional cross-year scale comparison (two-year heatmap side-by-side display).

### Task 2: Mobile Header Sync Dot Fix (Bug 5)

Added `flex-shrink:0` to the `syncStatusDot` inline style string in `cloud-sync.js` (line 319). Also added a minimal `.sync-status-indicator` class rule in `css/main.css` that only sets `flex-shrink: 0`, providing belt-and-suspenders coverage without conflicting with the inline `display:inline-block` or `width:0.6em`.

## Verification Results

- `npx vitest run src/ui/heatmap.test.js` — 4/4 tests pass
- `grep -c 'filteredDailyData' src/ui/heatmap.js` returns 5 (declaration + scale + cell + 2 tooltip handlers)
- `grep 'Object.entries(dailyData).filter'` — match found in heatmap.js line 55
- `grep 'getFullYear() === yearNum'` — match found in heatmap.js line 57
- `grep 'sync-status-indicator\|flex-shrink:0'` confirms inline style carries `flex-shrink:0` and CSS class rule only sets `flex-shrink`
- Full suite: 372/373 tests pass; 1 pre-existing failure in `repository.test.js` (Dexie import isolation issue when run in full suite, passes in isolation — unrelated to this plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Missing Dependency] Installed jsdom for heatmap test environment**
- **Found during:** Task 1 verification
- **Issue:** `npx vitest run src/ui/heatmap.test.js` failed with `Cannot find package 'jsdom'` — the test file requires jsdom environment but the package was not installed
- **Fix:** `npm install --save-dev jsdom`
- **Files modified:** package.json, package-lock.json
- **Commit:** Included in Task 1 commit (dependency install, not tracked as separate commit)

## Pre-existing Issue (Out of Scope)

- `repository.test.js` (recurrentExpenseRepository smoke test) fails when run in the full vitest suite due to Dexie module isolation between test files, but passes in isolation. This pre-dated this plan and is unrelated to the heatmap or CSS changes. Logged for deferral.
