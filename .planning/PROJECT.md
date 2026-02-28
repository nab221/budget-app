# Budget App

## What This Is

A personal budget tracking web app — a full rebuild of a buggy AI-generated prototype — designed for a UK-based user and their partner. It runs entirely in the browser (no server required), stores data locally via IndexedDB, and is installable as a PWA on desktop and mobile. GBP is the primary currency; foreign currency accounts are tracked separately and kept out of the main budget.

## Core Value

A clear, reliable view of where the money goes each month — income vs fixed vs variable spending, debt progress, and net worth — all in one place, accessible on any device.

## Requirements

### Validated

- ✓ Dashboard with income, fixed/variable expenses, net position, subscriptions, total debt, total assets, net worth, and fixed-to-income ratio — existing (buggy)
- ✓ Income tracking — existing (buggy)
- ✓ Fixed and variable spending tabs — existing (buggy)
- ✓ Subscriptions tab with monthly-equivalent calculation — existing (buggy)
- ✓ Credit card & debt tracker with UK minimum payment rules — existing (buggy)
- ✓ Payoff planner (Avalanche + Snowball strategies with side-by-side comparison) — existing (buggy)
- ✓ Assets snapshot for net-worth tracking — existing (buggy)
- ✓ Category management (add/delete/seed) — existing (buggy)
- ✓ JSON export/import for backup — existing (buggy)

### Active

- [ ] Rebuild as clean modular structure (separate HTML/CSS/JS, ES6 modules)
- [ ] Fix all known bugs: debt calculation inconsistency, statement sorting, missing date defaults, category dropdown reset, import duplicates data
- [ ] Recurring transaction templates: monthly, quarterly, and annual frequency options
- [ ] Charts: spending trends, debt-payoff timeline, net-worth over time (Plotly.js)
- [ ] Budget targets per category with visual progress bars
- [ ] PDF bank statement import: auto-parse common UK banks (Barclays, HSBC, NatWest, Lloyds, Santander), fall back to manual column mapping
- [ ] Balance-transfer modelling (0% deals with fee calculation)
- [ ] Dark/light theme toggle
- [ ] PWA manifest — installable on desktop and mobile
- [ ] Multi-currency accounts (EUR, USD, BRL, others) tracked separately, not mixed into GBP main budget
- [ ] Encrypted export (password-protected JSON)
- [ ] Debt-free date countdown on dashboard
- [ ] Google Drive / Dropbox backup integration for cross-device sync

### Out of Scope

- Real-time cloud sync — Google Drive/Dropbox manual backup chosen instead; avoids backend dependency
- Multi-user accounts / authentication — personal tool; no login needed
- Native mobile app (iOS/Android) — PWA covers mobile use case
- Mixing foreign currencies into main GBP budget totals — foreign accounts tracked separately
- Server-side processing — fully browser-based, local-first

## Context

- Existing codebase: `budget-app.html` (796-line monolith, vanilla JS + Dexie.js 4.0.8)
- Codebase already analysed — see `.planning/codebase/` for full concerns, bugs, and stack audit
- UK-based user; GBP primary currency; also holds accounts in BRL, EUR, USD
- Partner will use the app primarily for viewing/visualising — output clarity matters
- App currently opened as a local HTML file; goal is GitHub Pages or similar static hosting + PWA install
- No build tools currently; rebuild may introduce a simple bundler (Vite) or stay bundle-free

## Constraints

- **No server**: Must remain fully client-side; all data in IndexedDB
- **Tech stack**: Vanilla JS or lightweight framework (no React/Vue complexity); Dexie.js for IndexedDB
- **Currency**: GBP as base currency throughout the main budget; foreign currencies isolated
- **Offline**: Must work fully offline after first load (PWA requirement)
- **Compatibility**: Chrome, Edge, Firefox, Safari (modern versions); mobile browsers for PWA

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full rebuild over patch | Monolithic 796-line file with structural bugs makes patching risky and slow | — Pending |
| Google Drive/Dropbox sync | Avoids backend; uses storage users already have; keeps data private | — Pending |
| PDF import with auto + manual fallback | UK bank PDF formats vary; auto-parse for common banks, manual mapping as safety net | — Pending |
| Foreign currencies excluded from main budget | User lives in UK; GBP is primary; foreign accounts are incidental | — Pending |
| Recurring templates include quarterly option | TV Licence and similar UK bills billed quarterly/annually | — Pending |

---
*Last updated: 2026-02-28 after initialization*
