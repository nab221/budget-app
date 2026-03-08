---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Debt Tab UX Overhaul
status: ready_to_plan
last_updated: "2026-03-07"
---

## Project State: Budget App

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** A personal budget tracker that helps a UK household track income, expenses, debts, assets, and forecast cash flow — fully offline, PWA-ready, no server required.
**Current focus:** Milestone v2.5 — Phase 11: Modal Scaffold

## Current Position

Phase: 11 of 14 (Modal Scaffold)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-07 — Roadmap created for v2.5 (4 phases, 13 requirements mapped)

Progress: [░░░░░░░░░░] 0% (v2.5)

## Completed Milestones

- v2.3 — Advanced Analytics & Mobile Polish (SHIPPED 2026-03-07, Phases 1-7, 22 plans)
- v2.4 — UX Polish & Spending Insights (SHIPPED 2026-03-07, Phases 8-10)

## Accumulated Context

### Decisions

- **v2.5 debt form strategy**: Native `<dialog>` + existing `modalUI` (render.js). No new packages, no schema changes. `openDebtModal(id)` + `_buildFormHTML(data)` replace `toggleDebtForm()` + `renderDebtForm()`. Footer buttons passed as config array to `modalUI.show()` — avoids inline onclick globals.
- **v2.5 FIELD_IDS constants**: Define at module top before writing a single getElementById call. Prevents ID drift between HTML template and save handler (root cause of previous save-NaN bug).
- **v2.5 build order**: Modal scaffold first (Phase 11) → field logic (Phase 12) → save wiring (Phase 13) → cleanup (Phase 14). Old form removed atomically in Phase 14 after all new paths are confirmed working.
- **v2.5 dialog placement**: `<dialog>` must be a direct child of `<body>`, not nested inside tab panel, to avoid `::backdrop` clipping.
- **v2.4 heatmap rendering**: Custom canvas 2D Context (not chartjs-chart-matrix). ~80-line fillRect renderer, zero new dependencies.
- **v2.4 swipe logic**: Enforced "reveal-and-tap" (no auto-trigger) and single-row coordination for mobile safety.

### Pending Todos

None.

### Blockers/Concerns

- Confirm during Phase 11 whether `modalUI`'s existing Esc/close handler calls a cleanup callback or calls `modalUI.close()` directly. If the latter, wire `editingId` cleanup via `dialog.addEventListener('close')` in `openDebtModal`.
- Discard-changes guard for Add mode: confirm behavior when user opens Add and immediately dismisses without typing — `confirm()` should not fire for a truly empty form.

## Session Continuity

Last session: 2026-03-07
Stopped at: Roadmap created. Ready to plan Phase 11.
Resume file: None
