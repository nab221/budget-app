# Project: Budget App

## Current State
- **Latest Version**: v1.3 (Enhanced Debt Management)
- **Status**: Starting Milestone v1.4: Local File Persistence.
- **Key Features**: Offline-first, UK Bank PDF Summary Extraction, Automated Debt Payment Tracking, 90-day Daily Cash Flow Forecast, Cloud Backup (GDrive/OneDrive).

## Next Milestone: v1.4 Local File Persistence
- **Goal**: Enable direct sync between IndexedDB and a local file via File System Access API.
- **Status**: Roadmap Created. Ready for Phase 1.

---

<details>
<summary>Milestone History</summary>

### v1.4: Local File Persistence (Active)
- Refactoring database mutations to repository.
- File System Handle utility.
- Debounced auto-save logic.
- Cloud-sync folder resilience.

### v1.3: Enhanced Debt Management (2026-03-02)
- Implemented Schema v11 for statement lifecycle.
- Added automated "Min Payment" recurrent expense generation.
- Built multi-strategy PDF summary extractor (Lloyds, NW, Amex, etc.).
- specialized "Mark Paid" workflow for debt validation.
- Integrated debt obligations into 90-day cash flow forecast.

### v1.2: Daily Cash Flow Engine (2026-03-02)
- Implemented daily balance forecasting.
- Added UK bank holiday and weekend date adjustments.
- Built interactive 90-day balance trend charts.
- Added low-balance critical alerts.

### v1.1: UX Refinement & CRUD Hardening
- Unified Expenses tab with sub-views.
- Cycle tracking for recurrent items.
- Search and category filtering.

### v1.0: Modular Rebuild & Foundation
- Full rebuild from monolith to ES6 modules.
- Core budget entities (Income, Expenses, Debts, Assets).
- Payoff planner and budget targets.
- PDF transaction import.
- Encrypted export/import.

</details>

<details>
<summary>Initial Requirements & Context (v1.0 Rebuild)</summary>

## What This Is
A personal budget tracking web app — a full rebuild of a buggy AI-generated prototype — designed for a UK-based user and their partner. It runs entirely in the browser (no server required), stores data locally via IndexedDB, and is installable as a PWA on desktop and mobile.

## Constraints
- **No server**: Must remain fully client-side; all data in IndexedDB
- **Offline**: Must work fully offline after first load (PWA requirement)
- **Tech stack**: Vanilla JS; Dexie.js for IndexedDB

</details>

---
*Last updated: 2026-03-02 (v1.4 Initialization)*
