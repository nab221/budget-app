---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: UX Fixes
status: verifying
stopped_at: "Completed 41-04 Tasks 1-2; stopped at Task 3 checkpoint:human-verify — awaiting BOTNAV visual verification"
last_updated: "2026-03-20T09:07:01.778Z"
last_activity: 2026-03-20 — 41-03 verification FAILED; 4 issues found (see Blockers/Concerns)
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
  percent: 58
---

## Current Position

Phase: 41 of 44 (Bottom Nav Consistency & iOS Safe Area) — IN PROGRESS (BLOCKED)
Plan: 2 of 3 complete in current phase (41-01, 41-02 done); 41-03 verification failed
Status: BLOCKED — 41-03 browser verification failed; code fixes required before re-verification
Last activity: 2026-03-20 — 41-03 verification FAILED; 4 issues found (see Blockers/Concerns)

Progress: [██████░░░░] 58%

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Based on my current account balance and all upcoming committed outgoings, tell me what I can afford to pay extra toward my debts between now and my next payday.
**Current focus:** Phase 41 — Bottom Nav Consistency & iOS Safe Area

## Accumulated Context

- v3.0 shipped 2026-03-18 with Pay-Period Affordability Engine, Banking Calendar, Debt Model Refactor, Childcare Top-Up Planner, Mobile Navigation Overhaul (Phases 27–39)
- Mobile bottom nav implemented in Phase 28 but inconsistencies remain across tabs — v3.1 targets these
- 722 Vitest tests passing as of Phase 41 Plan 02

### Decisions

- [v3.1 Roadmap]: 5 phases ordered by dependency — header first (audit-before-fix), then bottom nav (structural HTML change isolated), then tab buttons (independent), then debt history and income cards (feature work)
- [v3.1 Research]: Root cause of sticky header likely an overflow ancestor creating a per-tab scroll container — audit before writing CSS fixes
- [v3.1 Research]: `viewport-fit=cover` is missing from meta viewport tag — `env(safe-area-inset-bottom)` returns 0 on iPhones with home indicator; highest real-device impact fix in milestone
- [v3.1 Research]: Moving `.nav-container` to direct child of `<body>` is the correct fix for fixed-position containment trap
- [Phase 40]: Used ResizeObserver for --header-height so cloud-sync button injection doesn't break month-nav alignment
- [Phase 40]: Used behavior: instant for tab scroll reset to prevent jarring animation during content change
- [Phase 40]: CSS variables --header-height/--bottom-bar-height promoted to global :root with 56px/72px fallbacks; ResizeObserver overwrites at runtime
- [Phase 40 Verified]: Browser verification in Chrome DevTools at 390px confirmed HEADER-01, HEADER-02, HEADER-03, MONNAV-01 all passing
- [Phase 41]: viewport-fit=cover added to meta viewport — activates env(safe-area-inset-bottom) on iOS; .nav-container moved to direct body child to eliminate fixed-position containment trap; .shell mobile padding-bottom mirrors nav height including safe-area
- [Phase 41]: Use resolve.alias in vitest.config.js to stub virtual:pwa-register — cleaner resolution than per-test vi.mock for virtual modules
- [Phase 41]: Use typeof window.matchMedia === 'function' guard before calling matchMedia in _renderHeaderActions — jsdom in Vitest does not implement matchMedia, bare call throws TypeError
- [Phase 41]: CSS \!important on #cloudSyncActionsHeader at mobile breakpoint overrides JS classList.remove('hidden') — required because cloud-sync.js manages visibility via class manipulation

### Blockers/Concerns

- [Phase 41] iOS safe-area fixes must be verified on real iPhone or Safari simulator — Chrome DevTools will not expose the missing `viewport-fit=cover` issue
- [Phase 41 BLOCKED] 41-03 verification FAILED 2026-03-20 — 4 issues require fixes before BOTNAV requirements can be confirmed:
  1. Bottom nav visible on desktop (regression) — must be hidden above mobile breakpoint
  2. Nav not fixed on Transactions, Payoff, Settings tabs — overflow/transform ancestor trapping fixed positioning
  3. Header collapses differently on Dashboard vs Transactions — inconsistent sticky-header behaviour
  4. Auto-save UI (cloud-sync button, traffic-light) visible on mobile — must be hidden on mobile to preserve header space; local storage does not function on mobile

## Session Continuity

Last session: 2026-03-20T06:59:01.569Z
Stopped at: Completed 41-04 Tasks 1-2; stopped at Task 3 checkpoint:human-verify — awaiting BOTNAV visual verification
Resume file: None
