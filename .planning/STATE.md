---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: UX Fixes
status: in-progress
stopped_at: Completed 41-01-PLAN.md — bottom nav containment fix and iOS safe-area clearance
last_updated: "2026-03-19T22:20:11.783Z"
last_activity: 2026-03-19 — 41-01 complete; viewport-fit=cover added, nav-container moved to body, .shell safe-area padding updated (BOTNAV-01, BOTNAV-02, BOTNAV-03)
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 5
  completed_plans: 3
  percent: 50
---

## Current Position

Phase: 41 of 44 (Bottom Nav Consistency & iOS Safe Area) — IN PROGRESS
Plan: 1 of 3 complete in current phase (41-01 done)
Status: In Progress — 41-02 next (visual browser verification of nav structure)
Last activity: 2026-03-19 — 41-01 complete; viewport-fit=cover added, nav-container moved to body, .shell safe-area padding updated (BOTNAV-01, BOTNAV-02, BOTNAV-03)

Progress: [█████░░░░░] 50%

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Based on my current account balance and all upcoming committed outgoings, tell me what I can afford to pay extra toward my debts between now and my next payday.
**Current focus:** Phase 41 — Bottom Nav Consistency & iOS Safe Area

## Accumulated Context

- v3.0 shipped 2026-03-18 with Pay-Period Affordability Engine, Banking Calendar, Debt Model Refactor, Childcare Top-Up Planner, Mobile Navigation Overhaul (Phases 27–39)
- Mobile bottom nav implemented in Phase 28 but inconsistencies remain across tabs — v3.1 targets these
- 715 Vitest tests passing as of Phase 41 Plan 01

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

### Blockers/Concerns

- [Phase 41] iOS safe-area fixes must be verified on real iPhone or Safari simulator — Chrome DevTools will not expose the missing `viewport-fit=cover` issue

## Session Continuity

Last session: 2026-03-19T22:20:11.766Z
Stopped at: Completed 41-01-PLAN.md — bottom nav containment fix and iOS safe-area clearance
Resume file: None
