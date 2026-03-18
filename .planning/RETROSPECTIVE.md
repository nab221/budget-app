# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v3.0 — Budget Planning Core Redesign

**Shipped:** 2026-03-18
**Phases:** 15 (27–40 incl. 39.1) | **Plans:** 30 | **Timeline:** 5 days (2026-03-14 → 2026-03-18)

### What Was Built

- Pay-Period Affordability Engine: balance entry → projected balance at next payday → max safe extra debt payment, with collapsible payment timeline
- Full mobile overhaul: fixed bottom tab bar (icon + label, WCAG tap targets), sticky header, swipe gestures for Income/Expenses rows
- Banking Calendar utility (`banking-calendar.js`) + recurrence engine working-day support — payment dates auto-shift past UK bank holidays/weekends
- Debt Model Refactor: loans/mortgages now use predictive amortisation model instead of statement import; Confirm Balance modal with 5% drift warning
- Income Sources tab + Spending Buckets (configurable, prorated to pay period) feeding into affordability engine
- Childcare providers per account — required top-up calculation feeding affordability timeline
- Unified Transactions tab (merged IN/OUT cashflow view, dual heatmaps) — Expenses tab removed
- Delta-mode cloud snapshot preview (shows only changes since last sync)
- Legacy v2.x data import pipeline + referential integrity validator (runs on startup/pull/import)

### What Worked

- **Yolo mode throughout** — 5-day delivery of a ground-up redesign with 30 plans. No blocking confirmation gates meant fast forward momentum.
- **Gap-closure decimal phases (39.1, 40)** — Adding phases 39.1 and 40 mid-milestone without renumbering was clean and unambiguous. The decimal convention proved its value.
- **Generic `db.tables.map` for cloud sync** — Avoided maintaining a per-store allowlist across three phases (33, 34, 35). Each new store was automatically included.
- **TDD-first on new utilities** — `banking-calendar.js`, `amortisation.js`, `snapshot-diff.js`, `affordability.js` all written test-first. Zero regression surprises.
- **Pure helper pattern** — `_buildMergedRows()` on transactionUI being a pure function made 40's testing straightforward despite DOM complexity.

### What Was Inefficient

- **Phase 39 manual verification deferred** — The v3.0 sign-off gate (cross-device, Lighthouse, PWA round-trip) was never completed. Automated checks passed but Task 2 was never triggered. This leaves a formal quality gap in the archived milestone.
- **ROADMAP.md Phase Table deteriorated** — By Phase 38, the phase table had lost column alignment and phase names (showing plan counts instead of names for many rows). Should be kept clean as a reference, not just updated mechanically.
- **STATE.md bloat** — STATE.md accumulated 28 frontmatter stanzas from all phase updates. Could be reset more aggressively between phases.

### Patterns Established

- **Decimal phase numbering** (39.1, 40) for mid-milestone inserted phases — continue this convention
- **`_boundClickHandler` remove-then-add** in UI modules with re-render — prevents listener accumulation without module-level state flags
- **Debt-row sentinel via `!row.querySelector('.btn-edit')`** — distinguishes debt-linked rows without adding data attributes
- **Co-rendering via `app.js` branch** — `expensesUI.render()` called from 'transactions' branch; UI module no-ops without its DOM element

### Key Lessons

1. **Ship manual verification gates before archiving** — Automated tests pass in CI but manual cross-device/PWA checks are the actual user-facing quality bar. Don't skip Phase 39 Task 2 style gates.
2. **Keep ROADMAP.md names intact** — Phase table rows should preserve phase names, not be replaced with plan counts. The names are the semantic value.
3. **STATE.md frontmatter should be single-entry** — Only the current state matters; accumulated history belongs in git log, not STATE.md stanzas.
4. **Pure helpers pay dividends in complex UI phases** — Any non-trivial DOM transform that needs testing should be extracted to a pure function first.

### Cost Observations

- Model mix: primarily Sonnet 4.6 (balanced profile throughout)
- Sessions: ~20+ sessions across 5 days
- Notable: Yolo + balanced profile was the right call for a ground-up redesign — fast execution without quality regressions

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v2.3–v2.7 | 8–26 | Established GSD workflow, gap-closure pattern, phase summaries |
| v3.0 | 27–40 | Yolo mode throughout; decimal phases; generic cloud sync registration |

### Cumulative Quality

| Milestone | Tests | Notes |
|-----------|-------|-------|
| v2.7 | 354 | Baseline for v3.0 |
| v3.0 | 715 | +361 tests; all new utilities TDD-first |
