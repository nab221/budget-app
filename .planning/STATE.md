---
gsd_state_version: 1.0
milestone: v2.7
milestone_name: Cloud-First Sync & UX Refinement
status: in-progress
stopped_at: "Started Phase 23: Cloud-First UX Overhaul"
last_updated: "2026-03-11T20:45:00.000Z"
last_activity: "2026-03-11 — Started Milestone v2.7"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

## Project State: Budget App

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** A personal budget tracker that helps a UK household track income, expenses, debts, assets, and forecast cash flow — fully offline, PWA-ready, no server required.
**Current focus:** v2.7 — Cloud-First Sync & UX Refinement

## Current Position

Phase: 23 of 26 (Cloud-First UX Overhaul)
Plan: TBD
Status: Context Gathered
Last activity: 2026-03-11 — Phase 23 context gathered

Progress: [||--------] 25%

## Completed Milestones

- v2.6 — Dashboard Invariants & Technical Polish (SHIPPED 2026-03-11)
- v2.5 — Debt Tab UX Overhaul (SHIPPED 2026-03-08)
- v2.4 — UX Polish & Spending Insights (SHIPPED 2026-03-07)
- v2.3 — Advanced Analytics & Mobile Polish (SHIPPED 2026-03-07)

## Accumulated Context

### Decisions (v2.7)
- **Top Bar Strategy:** Local Export/Import will be hidden if Supabase is configured, replaced by Cloud Push/Pull icons in the header.
- **Auto-Sync Trigger:** `visibilitychange` (hidden state) will be used to trigger background cloud pushes when the user leaves the app.
- **Dirty State:** A "Dirty" flag will be tracked in memory/localStorage based on Dexie database activity to determine if a push is needed.

### Roadmap Evolution
- Added Phase 23: Cloud-First UX Overhaul
- Added Phase 24: Intelligent Sync Logic (Auto-Pull & Auto-Push)
- Added Phase 25: Sync Visibility (Dirty State & Error Handling)
- Added Phase 26: Milestone v2.7 Verification & Polish

### Pending Todos
- Identify best location in header for Cloud Sync icons.
- Verify `visibilitychange` reliability on iOS Safari.
- Implement a global "Dirty" state tracking mechanism.

### Blockers/Concerns
- iOS Safari background task limitations (may need `beforeunload` or limited sync window).
