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

## Milestone: v3.1 — UX Fixes

**Shipped:** 2026-03-23
**Phases:** 10 (40–49) | **Plans:** 30 | **Timeline:** 5 days (2026-03-19 → 2026-03-23)

### What Was Built

- Sticky header on all 8 tabs via ResizeObserver + CSS custom property; passive scroll shadow; instant tab scroll reset
- Fixed mobile bottom nav: `viewport-fit=cover` activating iOS safe-area, `.nav-container` moved to direct body child to escape CSS containment trap; PWA update bar stacked above nav
- Uniform tab button dimensions — CSS `width:100vw` bypass for containment trap affecting Payoff/Transactions/Settings
- Debt history modal: generates expected payment dates from loan start to today, confirm as paid, per-entry amount adjustment
- Income source cards matching Debt tab layout; modal with confirm/reschedule/adjust; broken Edit/Delete card buttons fixed; unconfirm for confirmed entries
- Full Transactions tab overhaul: mark-as-paid, confirm-income, unified Add modal, sort toggle, ±prefix, search placeholder, full category filter
- `app:refresh` double-render eliminated on expense toggle; legacy reconciliation/mark-all-paid/trigger-recurrence buttons removed

### What Worked

- **CSS containment trap root-cause analysis** — Identifying that `position:fixed` was trapped by transformed/overflow ancestors explained three separate bugs (bottom nav, tab buttons, desktop nav). Once understood, `width:100vw` and direct-body-child restructuring were fast fixes.
- **Wave 0 TDD with real assertions** — Writing failing tests with concrete contracts (not placeholder `expect(true).toBe(false)`) meant implementation had clear targets. Phases 43, 44, 45, 46, 48, 49 all used this pattern successfully.
- **Extending vi.mock at module level** — Adding `update`/`delete` to repository mocks in `vi.mock()` (not just `beforeEach`) ensured mocks were available at import time. Saved debugging time.
- **Browser verification gating** — Each feature phase ended with a human browser verification checkpoint. Caught real issues (Phase 41 4-bug regression, Phase 42 width expansion) before archiving.
- **Audit-extended milestone** — The initial audit (Phases 40–45) exposed gaps; Phases 46–49 closed them cleanly. The audit → gap-close → re-audit loop worked well for a UX milestone.

### What Was Inefficient

- **Phase 41 verification failure cost** — 41-03 FAILED with 4 bugs requiring a 41-04 gap closure plan. The CSS containment root cause wasn't diagnosed until Phase 42. Upfront containment-trap audit (checking for `overflow`/`transform` ancestors on affected tabs) before any fixed-position work would have prevented this.
- **ROADMAP.md checkbox drift** — Plans 43-01 through 45-04 had unchecked `[ ]` markers despite being complete (they were added after the progress table was last updated). The archive captured this noise.
- **Nyquist compliance debt** — Only Phase 40 achieved full Nyquist compliance. Phases 41–49 have `nyquist_compliant: false` or no VALIDATION.md. This is accepted tech debt but adds friction to any future `/gsd:validate-phase` runs.

### Patterns Established

- **`viewport-fit=cover` + `env(safe-area-inset-bottom)` pattern** — Required for any fixed-position element on iPhones with home indicator; `0px` fallback for non-iOS
- **`width:100vw` for fixed-position elements inside containment traps** — Viewport units bypass all CSS containment; `width:100%` does not
- **Direct body child for fixed nav** — `.nav-container` as direct `<body>` child avoids fixed-position containment from Shell/main ancestors
- **Explicit render call replacing `app:refresh` dispatch** — When a specific module needs to re-render after an action, call `window.moduleUI?.render()` directly rather than dispatching a broadcast event

### Key Lessons

1. **Diagnose CSS containment before writing fixed-position CSS** — Check for `overflow`, `transform`, `contain` ancestors on affected containers first. Three v3.1 bugs had the same root cause.
2. **Wave 0 TDD with real contracts pays off** — Writing concrete failing assertions (not placeholders) means implementation has no ambiguity. The test is the spec.
3. **Browser verification checkpoints are worth the gate** — They caught real regressions (Phase 41) before they compounded. Don't skip them to "save time."
4. **Legacy button removal is safer than wiring** — Phase 49 confirmed that both non-functional legacy buttons were cleaner to remove than to re-implement. Audit first, then decide.

### Cost Observations

- Model mix: primarily Sonnet 4.6 (balanced profile throughout)
- Sessions: ~15+ sessions across 5 days
- Notable: UX-heavy milestone (CSS + browser verification) required more human-in-the-loop gates than v3.0 feature work, but caught real regressions before they became tech debt

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v2.3–v2.7 | 8–26 | Established GSD workflow, gap-closure pattern, phase summaries |
| v3.0 | 27–40 | Yolo mode throughout; decimal phases; generic cloud sync registration |
| v3.1 | 40–49 | CSS containment trap pattern identified; Wave 0 TDD with real contracts; browser gates mandatory |

### Cumulative Quality

| Milestone | Tests | Notes |
|-----------|-------|-------|
| v2.7 | 354 | Baseline for v3.0 |
| v3.0 | 715 | +361 tests; all new utilities TDD-first |
| v3.1 | ~750+ | Wave 0 TDD on each feature phase; Vitest + jsdom for UI modules |
