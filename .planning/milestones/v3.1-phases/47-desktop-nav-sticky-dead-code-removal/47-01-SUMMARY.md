---
phase: 47-desktop-nav-sticky-dead-code-removal
plan: 01
subsystem: ui
tags: [css, sticky, nav, dead-code, cleanup, mobile]

# Dependency graph
requires:
  - phase: 40-sticky-header-month-navigator
    provides: "ResizeObserver writing --header-height CSS variable from app.js"
  - phase: 41-bottom-nav-consistency-ios-safe-area
    provides: "Mobile .nav-container position: fixed at bottom: 0"
  - phase: 42-tab-button-uniformity
    provides: "Mobile .nav-container width: 100vw and full mobile tab styling"
provides:
  - "Desktop .nav-container is position: sticky, anchored below header via --header-height"
  - "Dead getBoundingClientRect block removed from dashboard.js initDashboard()"
  - "app.js ResizeObserver is confirmed sole writer of --header-height"
affects: [future-css-phases, desktop-layout, nav-positioning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mobile overrides must explicitly reset ALL base-rule properties (top: auto resets desktop sticky top)"
    - "position: sticky on parent + position: fixed in mobile override requires top: auto in mobile to prevent dimension bleed"

key-files:
  created: []
  modified:
    - css/main.css
    - src/ui/dashboard.view-toggle.test.js

key-decisions:
  - "Mobile .nav-container override must include top: auto to prevent the desktop sticky top: var(--header-height) from applying on mobile via position: fixed (which does not reset top)"
  - "Stale test asserting getBoundingClientRect presence updated to assert its absence, consistent with CLEAN-01 intent"
  - "Pre-existing test failures in finance.test.js and dashboard.affordability.test.js are out of scope — confirmed by stash-revert test run"

patterns-established:
  - "When base rule has position: sticky with top: X, a mobile override using position: fixed must also set top: auto or the top value bleeds through"

requirements-completed: [DESK-01, CLEAN-01]

# Metrics
duration: ~60min (includes browser verification and regression fix cycle)
completed: 2026-03-22
---

# Phase 47 Plan 01: Desktop Nav Sticky & Dead Code Removal Summary

**Desktop .nav-container made sticky below header via CSS variable; getBoundingClientRect dead code removed from dashboard.js; mobile regression (nav spanning full screen) fixed by adding `top: auto` to mobile override**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-03-22 (continuation session)
- **Completed:** 2026-03-22T19:49:56Z
- **Tasks:** 3 (Task 1: CSS sticky, Task 2: dead code removal, Task 3: verification + fixes)
- **Files modified:** 2

## Accomplishments

- DESK-01: Desktop nav bar (tab pills) now stays visible when scrolling on any tab — `position: sticky; top: var(--header-height, 56px); z-index: 99; background: var(--bg)` added to `.nav-container`
- CLEAN-01: Dead Phase 36 getBoundingClientRect block removed from `initDashboard()` in dashboard.js — `app.js` ResizeObserver is now the confirmed sole writer of `--header-height`
- Mobile regression fixed: added `top: auto` to mobile `@media (max-width: 768px) .nav-container` rule so the base sticky `top:` does not apply when `position: fixed` is active on mobile
- Stale test updated: `dashboard.view-toggle.test.js` assertion updated from "must contain getBoundingClientRect" to "must NOT contain getBoundingClientRect"

## Task Commits

Each task was committed atomically:

1. **Task 1: Make desktop nav bar sticky in CSS** - `7806387` (feat)
2. **Task 2: Remove dead getBoundingClientRect block from dashboard.js** - `dcd1f57` (fix)
3. **Fix: Mobile nav regression** - `28f0ae0` (fix)
4. **Fix: Stale test update** - `26fbdfb` (test)

## Files Created/Modified

- `css/main.css` - Added `position: sticky; top: var(--header-height, 56px); z-index: 99; background: var(--bg)` to desktop `.nav-container`; added `top: auto` to mobile `.nav-container` override to prevent regression
- `src/ui/dashboard.view-toggle.test.js` - Updated stale test that asserted getBoundingClientRect presence to assert its absence post-CLEAN-01

## Decisions Made

- **Mobile `top: auto` is mandatory:** When a base rule uses `position: sticky` with a `top` value, a mobile override using `position: fixed` does NOT automatically reset `top`. Without `top: auto`, the fixed nav spanned from `var(--header-height)` to `bottom: 0` — filling the full visible screen below the header. The `top: auto` reset is the correct fix and does not affect desktop behavior.
- **Stale test updated, not deleted:** Rather than deleting the test block, updated it to assert the inverse (no getBoundingClientRect) — provides regression protection against the dead code being accidentally re-introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mobile nav regression introduced by Task 1 sticky CSS**
- **Found during:** Task 3 (human browser verification — Galaxy S20 Ultra 412px)
- **Issue:** The new base rule `position: sticky; top: var(--header-height, 56px)` was not being fully overridden by the mobile `@media (max-width: 768px)` `.nav-container` rule. `position: fixed` overrides `sticky` but does NOT reset `top`. Result: mobile nav was `top: 56px; bottom: 0` — filling the screen below the header.
- **Fix:** Added `top: auto` to the mobile `.nav-container` override immediately before `bottom: 0`
- **Files modified:** `css/main.css`
- **Verification:** grep confirms `top: auto` present in mobile block; desktop behavior confirmed by prior browser verify
- **Committed in:** `28f0ae0`

**2. [Rule 1 - Bug] Stale test asserting removed code still exists**
- **Found during:** Task 3 (test suite run post-Task-2 commit)
- **Issue:** `dashboard.view-toggle.test.js` contained a test expecting `getBoundingClientRect` to be present in `dashboard.js`. Task 2 intentionally removed it (CLEAN-01). The test was now a false regression guard.
- **Fix:** Updated the `it` block to assert the code is ABSENT, aligning with the Phase 47 CLEAN-01 requirement
- **Files modified:** `src/ui/dashboard.view-toggle.test.js`
- **Verification:** `npx vitest run src/ui/dashboard.view-toggle.test.js` — all 18 tests pass
- **Committed in:** `26fbdfb`

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for correctness. CSS top: auto is required for mobile regression. Test update required for test suite integrity. No scope creep.

## Issues Encountered

- Pre-existing test failures (3 tests in `finance.test.js` and `dashboard.affordability.test.js`) confirmed out of scope via stash-revert run — these failures existed before Phase 47 changes and are unrelated to DESK-01/CLEAN-01 work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DESK-01 and CLEAN-01 requirements both satisfied and browser-verified
- Desktop sticky nav ready; mobile nav unchanged (still fixed at bottom)
- app.js ResizeObserver is now confirmed sole writer of --header-height with no competing measurement code
- Phase 48 (next tech debt phase) can proceed

---
*Phase: 47-desktop-nav-sticky-dead-code-removal*
*Completed: 2026-03-22*
