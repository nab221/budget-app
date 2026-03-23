---
phase: 41-bottom-nav-consistency-ios-safe-area
plan: "02"
subsystem: ui
tags: [pwa, service-worker, update-bar, bottom-nav, css, vitest]

# Dependency graph
requires:
  - phase: 41-01
    provides: "Bottom nav containment fix, --bottom-bar-height CSS variable in :root, iOS safe-area padding on .shell and .nav-container"

provides:
  - "PWA update notification bar (_showUpdateBar, _hideUpdateBar) in pwa-ux.js"
  - "onNeedRefresh callback wired in _registerUpdateListener calling _showUpdateBar(() => updateSW(true))"
  - "Mobile CSS override raising .update-bar above bottom nav via calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px))"
  - "vitest resolve alias for virtual:pwa-register virtual module"
  - "7 new Vitest tests for update bar behaviour (722 total passing)"

affects: [pwa, update-notifications, bottom-nav, ios-safe-area]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Virtual module test stubbing: vitest.config.js resolve.alias maps virtual:pwa-register to src/__mocks__/virtual-pwa-register.js"
    - "PWA update bar idempotency: _showUpdateBar reuses #pwa-update-bar element if already in DOM"
    - "CSS override hierarchy: base .update-bar { bottom: 0 } overridden inside @media (max-width: 768px) to float above nav"

key-files:
  created:
    - src/ui/pwa-ux.test.js
    - src/__mocks__/virtual-pwa-register.js
  modified:
    - src/ui/pwa-ux.js
    - css/main.css
    - vitest.config.js

key-decisions:
  - "Use resolve.alias in vitest.config.js to stub virtual:pwa-register — cleaner than per-test vi.mock for virtual modules that need path resolution before mocking"
  - "bar.style.removeProperty('display') used instead of hardcoding flex — preserves CSS class display value when reshowing bar"
  - "Event listeners added each time _showUpdateBar is called — idempotency guard prevents duplicate elements but listener stacking on repeated calls is acceptable given single-session usage"

patterns-established:
  - "Virtual module stubs: place in src/__mocks__/ and wire via vitest.config.js resolve.alias"

requirements-completed: [BOTNAV-04]

# Metrics
duration: 20min
completed: 2026-03-19
---

# Phase 41 Plan 02: PWA Update Bar — onNeedRefresh wired with update-bar positioned above mobile bottom nav

**PWA update notification bar implemented with _showUpdateBar/_hideUpdateBar in pwa-ux.js and mobile CSS override raising the bar above the bottom nav so nav icons stay tappable**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-19T22:22:21Z
- **Completed:** 2026-03-19T22:42:31Z
- **Tasks:** 2 (+ TDD RED/GREEN commits for Task 2)
- **Files modified:** 5

## Accomplishments

- Added `.update-bar { bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px)) }` inside `@media (max-width: 768px)` in main.css — update bar now floats above the nav bar on mobile
- Wired `onNeedRefresh` callback in `_registerUpdateListener()` in pwa-ux.js — `registerSW` return value captured as `updateSW`, callback calls `_showUpdateBar(() => updateSW(true))`
- `_showUpdateBar(onUpdate)` creates `div#pwa-update-bar.update-bar` appended to `document.body`, with "Update now" and "Later" buttons; idempotent on repeat calls
- `_hideUpdateBar()` sets `display: none` on bar if present; no error if absent
- Added vitest resolve alias for `virtual:pwa-register` virtual module + stub file enabling pwa-ux.js tests
- 7 new Vitest tests pass; total 722 passing (up from 715)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add mobile media query to raise .update-bar above bottom nav** - `f4dcec7` (feat)
2. **Task 2 RED: Add failing tests for _showUpdateBar / _hideUpdateBar** - `c74d393` (test)
3. **Task 2 GREEN: Wire onNeedRefresh and implement _showUpdateBar / _hideUpdateBar** - `5edd3ab` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 2 used TDD — separate RED test commit followed by GREEN implementation commit._

## Files Created/Modified

- `src/ui/pwa-ux.js` — Added `_showUpdateBar()`, `_hideUpdateBar()`, and `onNeedRefresh` callback in `_registerUpdateListener()`
- `css/main.css` — Added `.update-bar` mobile override inside `@media (max-width: 768px)` block
- `src/ui/pwa-ux.test.js` — 7 tests covering update bar DOM creation, idempotency, button actions
- `src/__mocks__/virtual-pwa-register.js` — Test stub for `virtual:pwa-register` virtual module
- `vitest.config.js` — Added `resolve.alias` mapping `virtual:pwa-register` to stub file

## Decisions Made

- Used `resolve.alias` in vitest.config.js to stub `virtual:pwa-register` rather than per-test `vi.mock` — resolves the virtual module before Vite's import analysis runs, allowing pwa-ux.js to be imported in tests without error
- Used `bar.style.removeProperty('display')` to restore visibility rather than `bar.style.display = 'flex'` — preserves the CSS class's native display value
- `_showUpdateBar` and `_hideUpdateBar` are not exported (module-private) — tested through `initPWA()` triggering `onNeedRefresh` via mocked `registerSW`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vitest.config.js resolve alias and virtual module stub**
- **Found during:** Task 2 (TDD RED — writing tests)
- **Issue:** `virtual:pwa-register` is a build-time virtual module provided by vite-plugin-pwa. Vitest's default configuration could not resolve it, causing `Failed to resolve import "virtual:pwa-register"` error — tests could not run at all
- **Fix:** Created `src/__mocks__/virtual-pwa-register.js` stub exporting a no-op `registerSW`. Updated `vitest.config.js` to add `resolve: { alias: { 'virtual:pwa-register': path.resolve(...) } }` so Vite resolves the virtual module to the stub during tests. `vi.mock` in the test file then overrides the stub with a spy that captures callbacks.
- **Files modified:** `src/__mocks__/virtual-pwa-register.js`, `vitest.config.js`
- **Verification:** Test file imports successfully; 7 tests run and 6 fail as expected (RED confirmed)
- **Committed in:** `c74d393` (Task 2 RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required infrastructure fix to enable TDD. No scope creep — stub is minimal and alias only affects test resolution.

## Issues Encountered

- `vi.mock('virtual:pwa-register', { virtual: true }, factory)` syntax did not prevent Vite's import analysis from failing before the mock was applied. Root cause: Vite transforms the importing file (pwa-ux.js) before the test runner's mock intercept fires. Solution was to add resolve alias in vitest.config.js so Vite resolves the module path to a real file during transformation.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- BOTNAV-04 complete: update bar now appears above the mobile nav bar, keeping nav icons tappable during update prompts
- Phase 41 Plan 03 (browser verification checkpoint) is next — visual confirmation of nav structure and iOS safe-area clearance on real/simulated device
- iOS safe-area fixes still require verification on real iPhone or Safari simulator (documented concern from Phase 41 planning)

## Self-Check: PASSED

- `src/ui/pwa-ux.js` — FOUND
- `css/main.css` — FOUND
- `src/ui/pwa-ux.test.js` — FOUND
- `src/__mocks__/virtual-pwa-register.js` — FOUND
- `vitest.config.js` — FOUND
- `.planning/phases/41-bottom-nav-consistency-ios-safe-area/41-02-SUMMARY.md` — FOUND
- Commit `f4dcec7` (Task 1) — FOUND
- Commit `c74d393` (Task 2 RED) — FOUND
- Commit `5edd3ab` (Task 2 GREEN) — FOUND

---
*Phase: 41-bottom-nav-consistency-ios-safe-area*
*Completed: 2026-03-19*
