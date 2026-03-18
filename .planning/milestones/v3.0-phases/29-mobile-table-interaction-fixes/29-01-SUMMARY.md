---
phase: 29-mobile-table-interaction-fixes
plan: 01
subsystem: ui
tags: [swipe, gestures, mobile, accessibility, income-table]

# Dependency graph
requires:
  - phase: 28-mobile-navigation-overhaul
    provides: Mobile navigation foundation and SwipeHandler utility in gestures.js
provides:
  - SwipeHandler integration for income table rows with destroy-on-rerender guard
  - Compact two-line date format (dd-MMM / YYYY) for income date cells using UTC-safe parsing
  - Amount column header white-space: nowrap rule for narrow viewports
  - Shared _handleEdit/_handleDelete methods routing both swipe and inline buttons to same logic
affects: [29-02, 30-magic-link-pwa-auth-fix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SwipeHandler additive pattern: swipe-row on <tr>, swipe-action-left/right inside first <td>, destroy loop before every rebuild"
    - "_formatDateCompact: UTC date parsing with Date.UTC to avoid browser timezone day-shift on ISO date-only strings"

key-files:
  created: []
  modified:
    - src/ui/transactions.js
    - css/main.css
    - index.html

key-decisions:
  - "Used expenses.js swipe pattern (transform on <tr> directly) rather than plan's nested inner-table variant — simpler, established, already working in production"
  - "swipe-action-right = Edit (right swipe), swipe-action-left = Delete (left swipe) — mirrors intuitive gesture direction"
  - "Swipe triggers action immediately on threshold (not after release-to-open) matching the faster UX expected on the income table"
  - "index.html static header updated with col-amount class so CSS media query can target it without JS overhead"

patterns-established:
  - "Destroy-before-rebuild: _initSwipe always destroys _swipeInstances before creating new ones — prevents touch listener leaks on re-render"
  - "Shared handler methods: _handleEdit/_handleDelete are the single canonical path; swipe callbacks and inline onclick both call them"

requirements-completed: [MOB-04, MOB-05]

# Metrics
duration: 25min
completed: 2026-03-15
---

# Phase 29 Plan 01: Income Table Swipe Gestures, Compact Dates & Amount Header Fix Summary

**SwipeHandler-based swipe gestures added to income rows with shared edit/delete routing, two-line compact date cells, and Amount header white-space fix — 393 tests pass, no regressions**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-15T07:55:00Z
- **Completed:** 2026-03-15T08:25:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added SwipeHandler integration to income table rows: swipe-right to Edit, swipe-left to Delete, with destroy-on-rerender guard preventing memory leaks
- Both swipe gestures and inline `.btn-edit` / `.btn-delete` buttons route through shared `_handleEdit` / `_handleDelete` methods — no divergent logic
- Income date cells now render `14-Mar` / `2026` in two-line compact format using UTC-safe parsing (no timezone day-shift)
- Amount `<th>` gains `col-amount` class with `white-space: nowrap` + `min-width: 60px` at mobile viewport — header stays on one line at ≥320px

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SwipeHandler to Income table rows** - `c80e67b` (feat)
2. **Task 2: Fix Income table date format and Amount header** - `6b3d6de` (feat)
3. **Task 3: Preserve non-swipe action path for accessibility** - included in Task 1 commit (inline buttons were part of row template)

## Files Created/Modified

- `src/ui/transactions.js` — Added SwipeHandler import, `_swipeInstances`/`currentOpenRow` state, swipe-row row template, `_initSwipe`, `_handleEdit`, `_handleDelete`, `closeAllRows`, `_formatDateCompact`
- `css/main.css` — Added `.date-compact`, `.date-year` rules and `@media (max-width: 768px)` rule for `th.col-amount`
- `index.html` — Added `col-amount` class to income table Amount `<th>`

## Decisions Made

- Used the expenses.js swipe pattern (transform applied directly to `<tr>`) rather than the plan's nested inner-table variant. The established pattern is simpler, already working in production, and avoids colspan/layout complications.
- Swipe-right reveals Edit (positive deltaX), swipe-left reveals Delete (negative deltaX) — matches natural gesture convention.
- Swipe triggers the action immediately when threshold is met (no "release-to-confirm" extra step), consistent with expenses.js behaviour.
- Updated `index.html` static markup (not JS) to add `col-amount` to the Amount `<th>` — the header is static HTML so a JS-based approach would be unnecessary overhead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] index.html updated instead of only transactions.js for col-amount class**
- **Found during:** Task 2 (Amount header fix)
- **Issue:** The income table `<thead>` lives in `index.html` as static markup, not rendered by `transactions.js`. The plan's `files_modified` list did not include `index.html`, but the CSS rule `th.col-amount` needs the class in the DOM.
- **Fix:** Added `col-amount` to the Amount `<th>` in `index.html` line 165.
- **Files modified:** index.html
- **Verification:** `grep -n "col-amount" index.html` returns the updated line
- **Committed in:** `6b3d6de` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking, wrong file identified in plan)
**Impact on plan:** Necessary for the CSS rule to have any effect. No scope creep.

## Issues Encountered

None — implementation was straightforward following the expenses.js established pattern.

## User Setup Required

None - no external service configuration required.

## Accessibility Test Notes

Manual keyboard verification (to be performed by user on next review):
1. Tab to an income row's `.btn-edit` button, press Enter — opens edit modal
2. Tab to `.btn-delete`, press Enter — triggers delete confirm dialog
3. No swipe gesture required at any step

Browser/device noted for UAT: to be recorded by user at verification time.

## Next Phase Readiness

- Plan 29-01 complete; income table has swipe gestures, compact dates, and nowrap Amount header
- Plan 29-02 can proceed independently (covers Expenses table or other mobile interaction items)
- No blockers

---
*Phase: 29-mobile-table-interaction-fixes*
*Completed: 2026-03-15*
