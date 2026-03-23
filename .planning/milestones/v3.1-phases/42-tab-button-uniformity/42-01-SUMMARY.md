---
phase: 42-tab-button-uniformity
plan: 01
subsystem: ui
tags: [css, mobile, bottom-nav, tab-buttons, cascade]

# Dependency graph
requires:
  - phase: 41-bottom-nav-consistency
    provides: Mobile .nav-container layout and .tab base rules in css/main.css
provides:
  - Mobile .tab.active full cascade reset — border-radius, box-shadow, padding, border, font-weight
  - transition: color override on mobile .tab preventing desktop transition: all shape animation
  - .tab:active UA-suppression rule preventing transform/background flash on tap
affects: [42-02-tab-button-uniformity-visual-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mobile breakpoint .tab.active must explicitly reset EVERY property set by the desktop rule — not just background and color"
    - "transition: all on a desktop base rule always leaks to mobile unless the mobile breakpoint overrides with transition: color (or specific properties)"

key-files:
  created: []
  modified:
    - css/main.css

key-decisions:
  - "Override desktop transition: all on mobile .tab with transition: color var(--tr) — prevents shape-affecting properties (border-radius, padding, box-shadow) from animating during tab tap"
  - "Explicit font-weight: 500 on mobile .tab.active — prevents the desktop font-weight: 600 micro-reflow that causes label text to shift width on activation"
  - "Added .tab:active rule (transform: none, background: none) to suppress UA active-state styling on iOS/Chrome that could produce transient visual artifacts"

patterns-established:
  - "Cascade reset pattern: mobile active-state rules must list ALL properties changed by the desktop active-state rule, even properties the mobile rule doesn't change in value — the cascade requires explicit resets"

requirements-completed: [TABUI-01, TABUI-02]

# Metrics
duration: 20min
completed: 2026-03-20
---

# Phase 42 Plan 01: Tab Button Uniformity Summary

**CSS-only cascade reset on mobile .tab.active — eliminates pill-shape halo, font-weight reflow, and shape transition animation on all 8 bottom-nav tab buttons**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-20T16:03:59Z
- **Completed:** 2026-03-20T16:24:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Expanded mobile `.tab.active` from 2 properties to 7, explicitly resetting all desktop rule properties that were leaking through the cascade
- Added `transition: color var(--tr)` to mobile `.tab` to prevent `transition: all` from animating border-radius/padding/box-shadow during tap
- Added `.tab:active` rule to suppress UA transform and background-flash on tap press
- All 722 Vitest tests pass — zero regressions from the CSS-only change

## Task Commits

1. **Task 1: Expand mobile .tab.active and add transition + :active overrides** - `ba1932d` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `css/main.css` - Three edits inside existing `@media (max-width: 768px)` block: expanded `.tab.active`, added `transition: color` to `.tab`, added `.tab:active` rule

## Decisions Made
- Override `transition: all` with `transition: color var(--tr)` on mobile `.tab` — the desktop base rule sets `transition: all var(--tr)` which causes border-radius, padding, and box-shadow to animate on tap, producing a visible pill-morph effect on mobile
- Include `font-weight: 500` in mobile `.tab.active` reset — the desktop `.tab.active` rule sets `font-weight: 600` which causes micro-reflow (label text briefly widens) when a tab is activated

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all three edits applied cleanly, 722 tests pass on first run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- CSS changes are complete; Plan 02 (visual browser verification checkpoint) is unblocked
- Verify in Chrome DevTools mobile emulation at 390px: tap each of the 8 tabs and confirm no shape change, no shadow halo, no font-weight shift on activation

---
*Phase: 42-tab-button-uniformity*
*Completed: 2026-03-20*
