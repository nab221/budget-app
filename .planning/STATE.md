---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Debt Tab UX Overhaul
status: defining_requirements
last_updated: "2026-03-07"
---

## Project State: Budget App

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** A personal budget tracker that helps a UK household track income, expenses, debts, assets, and forecast cash flow — fully offline, PWA-ready, no server required.
**Current focus:** Milestone v2.5 — Debt Tab UX Overhaul

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-07 — Milestone v2.5 started

## Completed Milestones

- v2.3 — Advanced Analytics & Mobile Polish (SHIPPED 2026-03-07, Phases 1-7, 22 plans)
- v2.4 — UX Polish & Spending Insights (SHIPPED 2026-03-07, Phases 8-10)

## Accumulated Context

### Decisions

- **v2.4 heatmap rendering**: Custom canvas 2D Context (not chartjs-chart-matrix). Avoids Chart.js plugin risk (documented bar-chart failures in codebase history). ~80-line `fillRect` renderer is sufficient and zero new dependencies.
- **v2.4 build order**: Haptics first (leaf dependency), Swipe second (imports haptics), Heatmap third (independent, most complex).
- **v2.4 swipe logic**: Enforced "reveal-and-tap" (no auto-trigger) and single-row coordination for mobile safety.
- **v2.5 debt form**: Modal/dialog replaces inline banner. Type-specific fields auto-shown on type selection.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-07
Stopped at: v2.5 milestone definition started.
Resume file: None
