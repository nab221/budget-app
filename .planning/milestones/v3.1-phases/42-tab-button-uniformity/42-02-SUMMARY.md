---
phase: 42-tab-button-uniformity
plan: 02
subsystem: ui
tags: [css, mobile, bottom-nav, tab-buttons, verification, gap-found]

# Dependency graph
requires:
  - phase: 42-tab-button-uniformity
    plan: 01
    provides: Mobile .tab.active cascade reset
provides:
  - Verified record of TABUI-01 and TABUI-02 status (INCOMPLETE — gap found)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Plan 01 fixed shape/height issues but did not address width expansion — a separate gap-closure plan is required"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 42 Plan 02: Tab Button Uniformity — Visual Verification Summary

**Verification FAILED — width expansion gap found on Payoff tab; TABUI-01 and TABUI-02 remain unconfirmed**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-03-20
- **Tasks:** 1 of 2 (Task 1 auto-passed; Task 2 human-verify rejected)
- **Files modified:** 0

## Accomplishments

- Confirmed 722 Vitest tests pass after Plan 01 CSS changes (no regressions)
- Proceeded to human visual verification checkpoint

## Task Commits

1. **Task 1: Regression suite** — no commit (run-only, 722 tests pass)
2. **Task 2: Browser verification** — REJECTED (see gap below)

## Verification Result

**FAILED.**

Human inspection in Chrome DevTools revealed a width expansion bug not addressed by Plan 01:

| Measurement | Dashboard active | Payoff active |
|---|---|---|
| `div#mainTabs.tabs` width | 412 px | 491 px |
| `button.tab.active` width | 51.5 px | 61.38 px |
| `button.tab.active` height | 51.41 px | 51.41 px |

- Height is uniform — the Plan 01 height/shape fix is working.
- Width is NOT uniform — the Payoff tab button expands to 61.38 px when active (vs 51.5 px for Dashboard), and pulls the entire tab bar from 412 px to 491 px.
- Root cause is unknown — likely the Payoff tab label or icon forces a wider intrinsic width when the active font-weight or padding applies, and the button is not constrained to a fixed or equal-flex width.

**TABUI-01** — NOT confirmed (width uniformity broken)
**TABUI-02** — NOT confirmed (Payoff tab changes size on activation)

## Decisions Made

- Do not attempt an in-place CSS fix here — gap is documented and will be addressed via a dedicated gap-closure plan
- Plan 02 is recorded as incomplete; requirements TABUI-01 and TABUI-02 remain open

## Deviations from Plan

**1. [Gap Found] Payoff tab width expansion not covered by Plan 01**
- **Found during:** Task 2 (human visual verification)
- **Issue:** `button.tab.active` is 61.38 px wide when Payoff tab is active vs 51.5 px when Dashboard is active. The whole tab bar grows from 412 px to 491 px.
- **Plan 01 scope:** Plan 01 addressed border-radius, box-shadow, padding, transition, and font-weight — it did not enforce equal flex widths across all tab buttons.
- **Fix:** Requires a gap-closure plan that sets `flex: 1` (or fixed equal widths) on `.tab` inside the mobile tab bar so intrinsic content differences cannot widen any individual button.
- **Status:** Deferred to gap-closure plan

## Issues Encountered

- Plan 01 CSS fix was partial — it correctly addressed shape/height but left the width dimension unguarded.

## User Setup Required

None.

## Next Steps

A gap-closure plan must be created to enforce equal-width tab buttons on mobile. The fix is likely `flex: 1` on `.tab` within the mobile `.tabs` container, preventing any tab from growing beyond its equal share.

---
*Phase: 42-tab-button-uniformity*
*Completed: 2026-03-20*

## Self-Check: FAILED

- TABUI-01 not confirmed — width not uniform across all 8 tabs
- TABUI-02 not confirmed — Payoff tab changes width on activation
- No files were created or modified in this plan (verification-only plan, CSS fix deferred)
- Gap documented for gap-closure plan
