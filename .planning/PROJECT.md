# Project: Budget App

## Current State
- **Latest Version**: v1.0 (Shipped 2026-03-01)
- **Status**: Stable. Rebuilt from monolith to modular PWA.
- **Key Features**: Offline-first, IndexedDB, UK Bank PDF Import, Cloud Backup (GDrive/OneDrive), Debt Payoff Planner, Account Balance Forecasting.

## Next Milestone: v1.1
- **Goal**: UX Refinement & Multi-currency Foundation.
- **Planned Features**: Multi-currency account tracking (isolated from GBP budget), foreign currency summary tab, and UI polish based on initial v1.0 feedback.

---

<details>
<summary>Initial Requirements & Context (v1.0 Rebuild)</summary>

## What This Is

A personal budget tracking web app — a full rebuild of a buggy AI-generated prototype — designed for a UK-based user and their partner. It runs entirely in the browser (no server required), stores data locally via IndexedDB, and is installable as a PWA on desktop and mobile. GBP is the primary currency; foreign currency accounts are tracked separately and kept out of the main budget.

## Core Value

A clear, reliable view of where the money goes each month — income vs fixed vs variable spending, debt progress, and net worth — all in one place, accessible on any device.

## Requirements (v1.0)

### Validated

- ✓ Dashboard with income, fixed/variable expenses, net position, subscriptions, total debt, total assets, net worth, and fixed-to-income ratio
- ✓ Income tracking
- ✓ Fixed and variable spending tabs
- ✓ Subscriptions tab with monthly-equivalent calculation
- ✓ Credit card & debt tracker with UK minimum payment rules
- ✓ Payoff planner (Avalanche + Snowball strategies)
- ✓ Assets snapshot for net-worth tracking
- ✓ Category management (add/delete/seed)
- ✓ JSON export/import for backup
- ✓ Rebuild as clean modular structure (separate HTML/CSS/JS, ES6 modules)
- ✓ Fix all known bugs
- ✓ Recurring transaction templates
- ✓ Charts: spending trends, debt-payoff timeline
- ✓ Budget targets per category
- ✓ PDF bank statement import
- ✓ Balance-transfer modelling
- ✓ Dark/light theme toggle
- ✓ PWA manifest
- ✓ Encrypted export
- ✓ Debt-free date countdown on dashboard
- ✓ Google Drive / OneDrive backup integration

### Out of Scope

- Real-time cloud sync
- Multi-user accounts / authentication
- Native mobile app (iOS/Android)
- Mixing foreign currencies into main GBP budget totals
- Server-side processing

## Context

- Existing codebase: `budget-app.html` (796-line monolith, vanilla JS + Dexie.js 4.0.8)
- UK-based user; GBP primary currency; also holds accounts in BRL, EUR, USD
- App currently opened as a local HTML file; goal is GitHub Pages or similar static hosting + PWA install

## Constraints

- **No server**: Must remain fully client-side; all data in IndexedDB
- **Tech stack**: Vanilla JS; Dexie.js for IndexedDB
- **Offline**: Must work fully offline after first load (PWA requirement)
- **Compatibility**: Chrome, Edge, Firefox, Safari (modern versions)

</details>

---
*Last updated: 2026-03-01 after v1.0 milestone completion*
