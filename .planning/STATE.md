---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Debt Tab UX Overhaul
status: ready_to_plan
stopped_at: Completed 13-02-PLAN.md
last_updated: "2026-03-08T11:29:10.073Z"
last_activity: "2026-03-08 — Added Phase 15: Statement History Modal to v2.5"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
  percent: 25
---

---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Debt Tab UX Overhaul
status: ready_to_plan
stopped_at: Completed 12-type-specific-field-logic 12-02-PLAN.md
last_updated: "2026-03-08T11:15:00.000Z"
last_activity: 2026-03-08 — Added Phase 15: Statement History Modal to v2.5; Milestone v2.5 now has 5 phases
progress:
  [███░░░░░░░] 25%
  completed_phases: 2
  total_plans: 7
  completed_plans: 4
  percent: 40
---

---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: Debt Tab UX Overhaul
status: ready_to_plan
last_updated: "2026-03-08"
---

## Project State: Budget App

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** A personal budget tracker that helps a UK household track income, expenses, debts, assets, and forecast cash flow — fully offline, PWA-ready, no server required.
**Current focus:** Milestone v2.5 — Phase 13: Save, Edit, and Validation

## Current Position

Phase: 13 of 15 (Save, Edit, and Validation)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-08 — Added Phase 15: Statement History Modal to v2.5

Progress: [████░░░░░░] 40%

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
- [Phase 11-modal-scaffold]: Mock render.js show() to apply scroll-lock side effect in jsdom tests so MODAL-03 can assert body overflow without a real overlay
- [Phase 11-modal-scaffold]: Scoped Esc listener per openDebtModal() call (self-removing) intercepts before modalUI global Esc handler — ensures editingId reset, no listener stacking
- [Phase 11-modal-scaffold]: editDebt(id) old discard guard removed — openDebtModal always sets editingId fresh; save-state discard belongs in Phase 13
- [Phase 11-modal-scaffold]: Scoped self-removing Esc listener in openDebtModal() intercepts before global modalUI Esc handler to ensure editingId reset without listener stacking
- [Phase 11-modal-scaffold]: editDebt(id) old discard guard removed — openDebtModal always sets editingId fresh, save-state discard belongs in Phase 13
- [Phase 12-type-specific-field-logic]: Tests inject fieldsets manually into document.body (not via openDebtModal) because modalUI.show is mocked and doesn't set innerHTML
- [Phase 12-type-specific-field-logic]: EDIT-03 uses mockResolvedValueOnce on debtRepository.get to override default mock for async openDebtModal(id) path
- [Phase 12-type-specific-field-logic]: _onTypeChange() called after modalUI.show() in all paths (Add and Edit) — fieldset elements created by show(), do not exist before it
- [Phase 12-type-specific-field-logic]: toggleDebtTypeFields() removed entirely — referenced ccOnlyFields/loanOnlyFields IDs belonging to old inline form, dead code once _onTypeChange() in place

### Pending Todos

None.

### Blockers/Concerns

- Confirm during Phase 11 whether `modalUI`'s existing Esc/close handler calls a cleanup callback or calls `modalUI.close()` directly. If the latter, wire `editingId` cleanup via `dialog.addEventListener('close')` in `openDebtModal`.
- Discard-changes guard for Add mode: confirm behavior when user opens Add and immediately dismisses without typing — `confirm()` should not fire for a truly empty form.

## Session Continuity

Last session: 2026-03-08T11:29:10.067Z
Stopped at: Completed 13-02-PLAN.md
Resume file: None
