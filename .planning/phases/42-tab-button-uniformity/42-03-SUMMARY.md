---
phase: 42-tab-button-uniformity
plan: 03
subsystem: ui
tags: [css, mobile, flex, tabs, navigation, viewport-units]

# Dependency graph
requires:
  - phase: 42-tab-button-uniformity/42-02
    provides: Confirmed that .tabs container grows from 412px to 491px when Payoff tab is active; root cause is missing width constraint on mobile .tabs
provides:
  - Mobile .tabs and .nav-container use 100vw width — immune to fixed-pos containment trap from transformed ancestors
  - TABUI-01 confirmed: all 8 mobile tab buttons identical height and shape in active and inactive states
  - TABUI-02 confirmed: Payoff tab button does not grow or change shape on activation
affects: [42-tab-button-uniformity, 41-bottom-nav]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use viewport units (100vw) instead of percentage (100%) on fixed-position nav containers to bypass CSS containment traps from transformed/overflow ancestors"

key-files:
  created: []
  modified:
    - css/main.css

key-decisions:
  - "Root cause of width expansion was fixed-pos containment trap: position:fixed on .nav-container is trapped by transformed/overflow ancestors on Transactions/Payoff/Settings tabs, making left:0/right:0/width:100% resolve against the ancestor's wider content box rather than the viewport. The Plan 03 fix of width:100% was insufficient because 100% resolves against the trapped containing block."
  - "Fix: replace width:100%/max-width:100% with width:100vw/max-width:100vw on both .nav-container and .tabs. Viewport units (vw) always resolve against the viewport, not the containing block — completely immune to containment traps."

patterns-established:
  - "Pattern: When position:fixed elements may be trapped by transformed ancestors, use vw/vh units instead of % for size constraints"

requirements-completed: [TABUI-01, TABUI-02]

# Metrics
duration: 45min
completed: 2026-03-20
---

# Phase 42 Plan 03: Tab Button Uniformity Gap-Closure Summary

**Mobile tab bar width pinned to viewport using 100vw on .nav-container and .tabs — bypasses CSS containment trap that caused Payoff/Transactions/Settings tabs to expand the bar to 441-479px**

## Performance

- **Duration:** 45 min
- **Started:** 2026-03-20T18:00:00Z
- **Completed:** 2026-03-20T18:45:00Z
- **Tasks:** 2 (both complete — Task 2 human verification APPROVED)
- **Files modified:** 1

## Accomplishments
- Diagnosed root cause: `position:fixed` containment trap made `width:100%` resolve against ancestor's wider content box, not the viewport
- Applied `width:100vw` fix to both `.nav-container` and `.tabs` — viewport units bypass the containment trap entirely
- 722 Vitest tests pass with no regressions
- Human verification APPROVED: `div#mainTabs.tabs` computed width stable across all 8 tab activations at 390px viewport; Payoff tab button width matches Dashboard tab button width (~48-49px each)
- TABUI-01 confirmed: all 8 mobile tab buttons are pixel-identical in height and shape in both active and inactive states
- TABUI-02 confirmed: Payoff tab button does not grow, shrink, gain a pill background, or change border-radius on activation

## Task Commits

Each task was committed atomically:

1. **Task 1 (Plan 03, initial): Pin .tabs container to parent width** - `56c4db6` (fix) — added width:100%/max-width:100% (insufficient — containment trap)
2. **Task 1 (continuation): Switch to viewport units to bypass containment trap** - `39e2fa6` (fix) — replaced with width:100vw/max-width:100vw on .nav-container and .tabs

## Files Created/Modified
- `css/main.css` — Mobile `.nav-container` gets `width: 100vw`; mobile `.tabs` gets `width: 100vw; max-width: 100vw` (replaces `width: 100%; max-width: 100%`)

## Decisions Made
- Width:100% on `.tabs` failed because `position:fixed` on `.nav-container` is trapped by transformed/overflow ancestors (Transactions, Payoff, Settings tabs). When trapped, the containing block is the ancestor's content box, not the viewport. `left:0; right:0` and `width:100%` all resolve against this wider ancestor.
- Switched to `width:100vw` (viewport units) which are always relative to the actual viewport — immune to all CSS containment traps.
- Applied `width:100vw` to `.nav-container` itself as well, not just `.tabs`, so both layers are anchored to viewport width.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced width:100% with width:100vw on .nav-container and .tabs**
- **Found during:** Task 2 (Visual verification FAILED)
- **Issue:** width:100% resolves against the fixed-pos containing block. When position:fixed is trapped by a transformed ancestor (which happens on Transactions/Payoff/Settings tabs), width:100% becomes 100% of the expanded ancestor width (441px, 479px) rather than the viewport (390px).
- **Fix:** Changed `width: 100%` → `width: 100vw` and `max-width: 100%` → `max-width: 100vw` on both `.nav-container` and `.tabs` in the `@media (max-width: 768px)` block.
- **Files modified:** css/main.css
- **Verification:** 722 Vitest tests pass
- **Committed in:** 39e2fa6

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix was necessary for correctness. Using viewport units is the correct CSS approach for fixed-positioned elements that may be trapped.

## Issues Encountered
- First fix attempt (width:100%) was insufficient because the root cause was a CSS containment trap, not a missing width constraint.
- Second fix (width:100vw) correctly bypasses the trap by using viewport units.
- Note: The containment trap itself (Phase 41 blocker) is a separate architectural issue not resolved in this plan — this plan works around it for the tab bar specifically.

## Next Phase Readiness
- Phase 42 complete — TABUI-01 and TABUI-02 both confirmed by human verification (approved 2026-03-20)
- Phase 43 (Debt History Modal) and Phase 44 (Income Tab Cards) can now begin; both depend on Phase 40 (complete) not Phase 42
- Phase 41 still has 41-03/41-04 pending (Bottom Nav verification failed 2026-03-20 — desktop display:none, iOS will-change, auto-save mobile hide need fixes before BOTNAV requirements confirmed)

---
*Phase: 42-tab-button-uniformity*
*Completed: 2026-03-20*
