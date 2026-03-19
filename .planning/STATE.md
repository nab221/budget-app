---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: UX Fixes
status: planning
stopped_at: Completed 40-01-PLAN.md — CSS/JS sticky header foundation
last_updated: "2026-03-19T07:31:33.401Z"
last_activity: 2026-03-18 — v3.1 roadmap created; 5 phases defined (40–44)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
  percent: 83
---

## Current Position

Phase: 40 of 44 (Sticky Header & Month Navigator)
Plan: 1 of 2 complete in current phase (40-01 done, 40-02 pending visual checkpoint)
Status: In Progress
Last activity: 2026-03-19 — 40-01 executed; CSS/JS sticky header foundation implemented

Progress: [████░░░░░░] 44%

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Based on my current account balance and all upcoming committed outgoings, tell me what I can afford to pay extra toward my debts between now and my next payday.
**Current focus:** Phase 40 — Sticky Header & Month Navigator

## Accumulated Context

- v3.0 shipped 2026-03-18 with Pay-Period Affordability Engine, Banking Calendar, Debt Model Refactor, Childcare Top-Up Planner, Mobile Navigation Overhaul (Phases 27–39)
- Mobile bottom nav implemented in Phase 28 but inconsistencies remain across tabs — v3.1 targets these
- 453+ Vitest tests passing at end of v3.0

### Decisions

- [v3.1 Roadmap]: 5 phases ordered by dependency — header first (audit-before-fix), then bottom nav (structural HTML change isolated), then tab buttons (independent), then debt history and income cards (feature work)
- [v3.1 Research]: Root cause of sticky header likely an overflow ancestor creating a per-tab scroll container — audit before writing CSS fixes
- [v3.1 Research]: `viewport-fit=cover` is missing from meta viewport tag — `env(safe-area-inset-bottom)` returns 0 on iPhones with home indicator; highest real-device impact fix in milestone
- [v3.1 Research]: Moving `.nav-container` to direct child of `<body>` is the correct fix for fixed-position containment trap
- [Phase 40]: Used ResizeObserver for --header-height so cloud-sync button injection doesn't break month-nav alignment
- [Phase 40]: Used behavior: instant for tab scroll reset to prevent jarring animation during content change
- [Phase 40]: CSS variables --header-height/--bottom-bar-height promoted to global :root with 56px/72px fallbacks; ResizeObserver overwrites at runtime

### Blockers/Concerns

- [Phase 41] iOS safe-area fixes must be verified on real iPhone or Safari simulator — Chrome DevTools will not expose the missing `viewport-fit=cover` issue

## Session Continuity

Last session: 2026-03-19T07:31:33.383Z
Stopped at: Completed 40-01-PLAN.md — CSS/JS sticky header foundation
Resume file: None
