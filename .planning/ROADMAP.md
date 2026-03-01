# Roadmap: Budget App

## Overview

A clean rebuild of a buggy monolithic budget app into a modular, offline-first PWA. The six phases follow hard dependency order: foundation infrastructure and category management first, then the full suite of core budget data entry features, then computation-heavy display features (dashboard, payoff planner, budget targets), then PWA and charts, then the two highest-complexity integration features (PDF bank statement import, cloud backup) last. Every phase delivers a coherent, verifiable capability. The rebuild is complete when the app is installable, offline-capable, and covers the full feature set the prototype attempted — reliably.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Build infrastructure, fix core architectural risks, and deliver category management
- [x] **Phase 2: Core Budget Features** - Income, fixed/variable spending, subscriptions, recurring templates, debt tracker, assets, and data safety
- [x] **Phase 3: Dashboard, Payoff Planner, and Budget Targets** - Computation-heavy display features that depend on Phase 2 data
- [x] **Phase 4: PWA and Charts** - Make the app installable and offline; add spending trend and debt payoff timeline charts (completed 2026-02-28)
- [ ] **Phase 5: PDF Bank Statement Import** - Auto-parse UK bank PDFs with manual fallback for bulk transaction import
- [ ] **Phase 6: Cloud Backup** - Dropbox and Google Drive backup integration for cross-device data access

## Phase Details

### Phase 1: Foundation
**Goal**: A working modular app skeleton with correct arithmetic, safe data persistence, XSS protection, and functional category management — the prerequisite for everything financial
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, CAT-01, CAT-02, CAT-03, CAT-04, THEME-01, THEME-02
**Success Criteria** (what must be TRUE):
  1. User can view, add, and delete categories in both Fixed and Variable groups, and category dropdowns in all forms reflect the current list immediately
  2. User can toggle between dark and light theme and the preference is remembered when the app is reopened
  3. All money values throughout the app are stored and calculated as pence integers — no floating-point rounding errors visible in any output
  4. Opening the app in a second tab while an IndexedDB schema migration is in progress shows a "please reload this tab" message rather than hanging silently
  5. The app calls storage.persist() on first load and shows a persistent export reminder if permission is denied (Safari ITP protection active)
**Plans**:
- [x] 01-01-PLAN.md — Infrastructure & Data Layer (2026-02-28)
- [x] 01-02-PLAN.md — App Shell & Security (2026-02-28)
- [x] 01-03-PLAN.md — Category Management Feature (2026-02-28)

### Phase 2: Core Budget Features
**Goal**: Users can record all their financial data — income, fixed and variable expenses, subscriptions, recurring templates, debts, assets — and export or import it safely
**Depends on**: Phase 1
**Requirements**: INC-01, INC-02, INC-03, INC-04, FIXED-01, FIXED-02, FIXED-03, FIXED-04, VAR-01, VAR-02, VAR-03, VAR-04, SUB-01, SUB-02, SUB-03, SUB-04, REC-01, REC-02, REC-03, REC-04, DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05, DEBT-06, ASSET-01, ASSET-02, ASSET-03, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. User can add, edit, delete, and view income, fixed expense, variable expense, and subscription entries, each filtered by month — all date fields default to today
  2. User can add a subscription with quarterly or annual frequency and the list shows the correct monthly-equivalent cost alongside the actual amount
  3. User can create a recurring transaction template; when a new month begins the app prompts to confirm due items, and accepting creates the entry while dismissing skips it
  4. User can add a debt with APR and minimum payment rule; the debt list shows balance, credit utilisation %, and the calculated minimum payment using a single shared calcMinPayment() function; statement history is sorted chronologically
  5. User can export all data as a plain JSON backup, import a backup (with confirmation that it replaces — not merges — existing data), export an encrypted password-protected JSON backup, and import an encrypted backup by entering the password
**Plans**:
- [x] 02-01-PLAN.md — Data Layer & Security (2026-02-28)
- [x] 02-02-PLAN.md — Core CRUD Features (2026-02-28)
- [x] 02-03-PLAN.md — Debt Tracker & Assets (2026-02-28)
- [x] 02-04-PLAN.md — Recurring Templates & Data Safety (2026-02-28)

### Phase 3: Dashboard, Payoff Planner, and Budget Targets
**Goal**: Users can see a complete financial picture — a live summary dashboard, debt payoff projections with strategy comparison, balance-transfer cost modelling, and per-category budget targets with progress bars
**Depends on**: Phase 2
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, BT-01, BT-02, BT-03, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Dashboard shows all 9 summary cards (income, fixed expenses, variable expenses, net position, total subscriptions, total debt, total assets, net worth, fixed-to-income ratio) and all cards update when the month/period filter changes
  2. User can view Avalanche, Snowball, and minimum-payments-only payoff simulations side by side; entering an extra monthly payment amount instantly updates months-to-clear and total interest for each strategy
  3. User can model a balance transfer by selecting a source debt, entering a 0% promotional period and transfer fee; the app shows total cost vs keeping the current debt and the minimum monthly payment needed to clear within the 0% window
  4. Dashboard shows a debt-free date countdown derived from the selected payoff strategy
  5. Dashboard shows budget target progress bars per spending category (actual spend vs set limit) and a net worth over time chart using monthly snapshots
**Plans**:
- [x] 03-01-PLAN.md — Data Layer & Utilities (2026-02-28)
- [x] 03-02-PLAN.md — Dashboard Core UI (2026-02-28)
- [x] 03-03-PLAN.md — Targets & Snapshots (2026-02-28)
- [x] 03-04-PLAN.md — Payoff Planner UI (2026-02-28)
- [x] 03-05-PLAN.md — BT Modeler & Finalize (2026-02-28)

### Phase 4: PWA and Charts
**Goal**: The app is installable on desktop and mobile, works fully offline, and provides spending trend and debt payoff timeline charts
**Depends on**: Phase 3
**Requirements**: CHART-01, CHART-02, PWA-01, PWA-02, PWA-04
**Note**: PWA-03 (iOS Safari "Add to Home Screen" banner) was descoped — Android/Chrome and Windows/Edge cover the primary target platforms.
**Success Criteria** (what must be TRUE):
  1. User can install the app to their home screen on Android/Chrome and on Windows/Edge and the installed app opens in standalone mode
  2. The app loads and works fully — including all data entry and viewing — with no network connection after first load
  3. When a new version of the app is deployed, the user sees a prompt to refresh and the update applies cleanly
  4. User can view a monthly spending trends chart (income vs fixed vs variable over the last 12 months) and a debt payoff timeline chart showing projected balance over time for each debt
**Plans**:
- [x] 04-01-PLAN.md — PWA Foundation & Offline Capability (2026-02-28)
- [x] 04-02-PLAN.md — Chart.js Integration & Spending Trends (2026-02-28)
- [x] 04-03-PLAN.md — Debt Payoff Timeline & PWA UX Polish (2026-02-28)

### Phase 5: PDF Bank Statement Import
**Goal**: Users can upload a UK bank PDF statement and bulk-import transactions with auto-parsing for common banks and a manual column-mapping fallback
**Depends on**: Phase 2
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05
**Success Criteria** (what must be TRUE):
  1. User can upload a PDF from Barclays, HSBC, NatWest, Lloyds, or Santander and see a transaction preview (date, description, amount) with the option to confirm or deselect individual rows before importing
  2. If auto-parse fails or user selects manual mode, user can map PDF columns to date, description, amount, and debt/credit fields and proceed to import
  3. If the PDF is image-based or scanned (no text layer), the app clearly tells the user it cannot be parsed and suggests manual entry instead
  4. After import, the user sees a summary of how many transactions were imported, skipped, or rejected, and imported entries appear in the correct tab (income or variable spending) based on user selection
**Plans**:
- [ ] 05-01-PLAN.md — PDF Parsing Engine & Data Layer
- [ ] 05-02-PLAN.md — Preview UI & Manual Mapping
- [ ] 05-03-PLAN.md — Bank Expansion & Refinement


### Phase 6: Cloud Backup
**Goal**: Users can back up and restore their data via Dropbox or Google Drive, enabling cross-device access without a backend
**Depends on**: Phase 2
**Requirements**: CLOUD-01, CLOUD-02, CLOUD-03, CLOUD-04
**Success Criteria** (what must be TRUE):
  1. User can connect their Dropbox account (PKCE OAuth, no server required), save their data file to Dropbox, and load it back to restore or sync across devices
  2. User can connect their Google Drive account and save/load their data file; re-authentication is handled silently when the token expires
  3. Connected cloud account preference persists across sessions and the user can disconnect at any time from the settings area
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6
(Note: Phase 5 depends on Phase 2, not Phase 4 — it can begin in parallel with Phase 4 if needed)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-02-28 |
| 2. Core Budget Features | 4/4 | Complete | 2026-02-28 |
| 3. Dashboard, Payoff Planner, and Budget Targets | 5/5 | Complete | 2026-02-28 |
| 4. PWA and Charts | 3/3 | Complete   | 2026-02-28 |
| 5. PDF Bank Statement Import | 0/TBD | Not started | - |
| 6. Cloud Backup | 0/TBD | Not started | - |
