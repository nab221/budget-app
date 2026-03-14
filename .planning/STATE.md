---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Budget Planning Core Redesign
status: not-started
stopped_at: "Roadmap designed. Phase 27 ready to begin."
last_updated: "2026-03-14T13:00:00.000Z"
last_activity: "2026-03-14 — v3.0 roadmap authored. All CONTEXT.md files created. Ready to start Phase 27."
progress:
  total_phases: 13
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

## Project State: Budget App

## Project Reference

See: PROJECT.md (updated 2026-03-14)

**Core value:** A personal UK budget planner. Given the user's current account balance, answer: "How much can I safely pay extra toward my debts before my next payday?" Fully offline, PWA-ready, optional Supabase cloud sync.

**Current focus:** v3.0 — Budget Planning Core Redesign

## Current Position

Phase: Not started (Phase 27 is next)
Plan: Awaiting agent execution
Status: Ready to begin
Last activity: 2026-03-14 — Roadmap and all GSD planning files authored

Progress: [----------] 0%

## Completed Milestones

- v2.7 — Cloud-First Sync & UX Refinement (SHIPPED 2026-03-12)
- v2.6 — Dashboard Invariants & Technical Polish (SHIPPED 2026-03-11)
- v2.5 — Debt Tab UX Overhaul (SHIPPED 2026-03-08)
- v2.4 — UX Polish & Spending Insights (SHIPPED 2026-03-07)
- v2.3 — Advanced Analytics & Mobile Polish (SHIPPED 2026-03-07)

## v3.0 Phase Register

| # | Phase Name | Status |
|---|-----------|--------|
| 27 | Critical Bug Fixes & Cloud-Sync Hardening | pending |
| 28 | Mobile Navigation Overhaul | pending |
| 29 | Mobile Table & Interaction Fixes | pending |
| 30 | Magic Link PWA / Auth Fix | pending |
| 31 | Banking Calendar Utility & Recurrence Upgrade | pending |
| 32 | Debt Model Refactor — Loans & Mortgage | pending |
| 33 | Income & Spending Configuration | pending |
| 34 | Pay-Period Affordability Engine | pending |
| 35 | Childcare Top-Up Planner | pending |
| 36 | Navigator & View Toggle Redesign | pending |
| 37 | Cloud Snapshot Delta Preview | pending |
| 38 | GitHub Actions Node.js 24 & Technical Hygiene | pending |
| 39 | v3.0 Milestone Verification & Polish | pending |

## Accumulated Context

### Architecture Decisions (Carried Forward from v2.7)
- **Storage:** Dexie.js (IndexedDB) — all data local-first
- **Cloud:** Supabase optional; `src/utils/supabase-sync.js` + `src/ui/cloud-sync.js`
- **Build:** Vite; deploy via GitHub Actions → GitHub Pages
- **Test:** Vitest; 354 tests passing as of v2.7
- **State storage keys:** `BALANCE_START_DATE_KEY`, `BALANCE_OPENING_AMOUNT_KEY` in `src/utils/storage.js`

### Architecture Decisions (v3.0 New)
- **Banking calendar:** new `src/utils/banking-calendar.js` utility, GOV.UK bank holiday API + static fallback
- **Affordability engine:** pure function in `src/utils/affordability.js` — no side effects, fully testable
- **Income sources & spending buckets:** new DB stores (`incomeSources`, `spendingBuckets`) — schema version bump required
- **Debt types:** `debtType` discriminator field (`'credit-card' | 'personal-loan' | 'mortgage'`) added to debts schema

### Known Bugs Being Fixed in Phase 27
- `cloud-sync.js`: event listener accumulation on re-render
- `cloud-sync.js`: XSS risk in modal snapshot preview (table names not sanitised)
- `cloud-sync.js`: missing init guard (duplicate auth listener registration)
- `heatmap.js`: transactions from previous year cause cross-year canvas split
- `css/main.css` (mobile): auto-save dot and local icon on separate lines in header

### Pending Todos Before Phase 27
- None — Phase 27 may begin immediately

### Blockers/Concerns
- Magic link PWA fix (Phase 30): likely requires device testing on iOS Safari and Android Chrome; cannot be verified from agent runtime
- Banking holiday data (Phase 31): GOV.UK API must be fetched with a CORS-safe approach or pre-bundled
- Phase 32 schema migration: `debtType` field addition requires Dexie version bump and migration step — must not break existing debt records
