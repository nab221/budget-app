---
phase: 40-sticky-header-month-navigator
plan: 01
subsystem: ui
tags: [css, sticky-header, scroll-shadow, resize-observer, month-nav]

# Dependency graph
requires: []
provides:
  - Global --header-height CSS variable written dynamically via ResizeObserver
  - header::before bleed pseudo-element for full-width background on viewports > 1200px
  - header.scrolled CSS class toggled by passive scroll listener
  - Tab switch scroll reset via window.scrollTo instant
  - .month-nav sticky positioning anchored to accurate --header-height
affects:
  - 40-02 (visual checkpoint for sticky header, scroll shadow, month-nav alignment)
  - Phase 41 (bottom nav / safe-area fixes build on this header foundation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ResizeObserver used to measure header height at runtime (accommodates dynamic content injection by cloud-sync)
    - CSS custom property promoted to global :root with JS runtime override via setProperty
    - Passive scroll listener pattern for scroll-shadow class toggling
    - behavior: instant for programmatic scroll reset on tab switch

key-files:
  created: []
  modified:
    - css/main.css
    - src/app.js

key-decisions:
  - "Used ResizeObserver for --header-height so cloud-sync button injection does not break month-nav alignment"
  - "Used behavior: instant for tab scroll reset to prevent jarring animation during content change"
  - "CSS variables promoted to global :root with 56px/72px fallbacks; ResizeObserver overwrites at runtime"

patterns-established:
  - "CSS custom property global fallback + JS ResizeObserver runtime override pattern"
  - "Passive scroll listener for UI class toggling (no scroll thread blocking)"

requirements-completed: [HEADER-01, HEADER-02, HEADER-03, MONNAV-01]

# Metrics
duration: 15min
completed: 2026-03-19
---

# Phase 40 Plan 01: Sticky Header Foundation Summary

**Global --header-height CSS variable + ResizeObserver runtime measurement + passive scroll shadow + instant tab scroll reset anchoring month-nav to header bottom**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-19T07:15:00Z
- **Completed:** 2026-03-19T07:30:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Promoted `--header-height: 56px` and `--bottom-bar-height: 72px` to global `:root` (previously mobile-only), enabling desktop month-nav sticky positioning
- Added `header::before` pseudo-element using `calc(-50vw + 50%)` to extend header background to full viewport width on screens wider than 1200px
- Added `header.scrolled` / `[data-theme='dark'] header.scrolled` box-shadow rules (toggled by scroll listener)
- Added ResizeObserver on `<header>` writing `--header-height` accurately at runtime so cloud-sync button injection cannot misalign the month navigator
- Added passive scroll listener toggling `.scrolled` class on window scroll events
- Added `window.scrollTo({ top: 0, behavior: 'instant' })` and `.scrolled` class removal before `renderAll()` in tab click handler

## Task Commits

Each task was committed atomically:

1. **Task 1: CSS — promote --header-height, add header::before bleed, add scroll shadow rules** - `a7da45a` (feat)
2. **Task 2: JS — ResizeObserver, scroll listener, tab-switch scroll reset in app.js** - `0fe35aa` (feat)

## Files Created/Modified
- `css/main.css` — Added global `--header-height`/`--bottom-bar-height` to `:root`, removed from mobile media query `:root`, added `header::before` bleed rule, `header.scrolled` shadow rules
- `src/app.js` — Added ResizeObserver on `<header>`, passive scroll listener, `scrollTo` + `.scrolled` removal in tab click handler

## Decisions Made
- Used ResizeObserver (not a hardcoded px value) for --header-height so cloud-sync button injection does not break month-nav alignment
- Used `behavior: 'instant'` (not `'smooth'`) for tab scroll reset — smooth scroll during tab switch causes visible animation while content has already changed
- Removing `.scrolled` class explicitly on tab switch prevents shadow flicker before the passive scroll listener fires

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing intermittent timeout failures in `supabase-sync.test.js`, `income-sources.test.js`, `transactions-merged.test.js`, and `dashboard.affordability.test.js` were present in the test run. These are flaky timeout-based failures unrelated to the CSS/JS changes in this plan (no test touches `header`, `scrolled`, `ResizeObserver`, `--header-height`, or `scrollTo`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Sticky header CSS/JS foundation complete — Plan 02 (visual checkpoint) can verify header behavior in browser
- `--header-height` variable is now globally available for any future component needing to offset below the header
- Month-nav sticky positioning on Income and Expenses tabs depends on --header-height being accurate — now fulfilled at runtime

---
*Phase: 40-sticky-header-month-navigator*
*Completed: 2026-03-19*
