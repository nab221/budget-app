# CLAUDE.md

Personal budgeting app (single user, single Mac, GBP). **A ground-up v4 refactor is in
progress on this branch.**

## Source of truth

1. `specs/REFACTOR-SPEC.md` — the product contract: screens, data model, engine reuse
   map, non-goals. If code and spec disagree, the spec wins.
2. `specs/IMPLEMENTATION-PLAN.md` — the build order (Phases 0–6), verification
   checklist, and guardrails.

The previous planning system (GSD milestones v1.0–v3.1, `.planning/`, "Phase N" comments
scattered in old code, `docs/superpowers/`) is **obsolete and deleted**. Ignore any
references to it in old code comments or git history. Do not resurrect features listed
under the spec's Non-goals (§8): no sync/cloud, no PWA/service worker, no assets/net
worth, no statement logging, no reconciliation mode.

## Stack & layout (target state, per spec §3)

- Vite + React 18 (JSX, plain JavaScript — no TypeScript), Vitest.
- `src/engine/` — pure financial logic (finance, pay-period, affordability,
  banking-calendar, recurrence, currency, childcare, pdf-parser…) with its test suite.
  Ported from the old app; treat as stable, change only with tests.
- `src/db/` — Dexie database `BudgetAppV4`, schema v1 (spec §5), repositories, backup.
- `src/ui/` — React components. Legacy pre-refactor files under `src/ui/` (singleton
  objects, `innerHTML`, `window.*` handlers) are reference-only until deleted in
  Phase 0.

## Commands

- `npm run dev` — dev server (http://localhost:5173)
- `npm test` — Vitest
- `npm run build` — production build

## Hard rules

- Money is integer **pence** at rest and in the engine; pounds only at the UI boundary.
- Never persist computed/projection rows (bill instances, forecasts) — compute at read
  time.
- No `innerHTML`, no `window.*` handler globals, no inline `onclick=` attributes.
- Payment dates shift to the next UK working day via `banking-calendar`.
- When the spec is silent, choose the simpler option and note the decision in the PR —
  do not import complexity from the legacy code.
