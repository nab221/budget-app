# Project: Budget App

## Current State
- **Latest Version**: v1.5 (Automatic Recurring Transactions)
- **Status**: Milestone v1.5 Complete. Replaced manual templates with true automatic recurrence engine.
- **Key Features**: Automated Recurring Transactions (12-month projection), Independent Monthly Navigation (Income/Expenses), Schema v12 Migration, Smart Month-End Drift Protection.

## Next Milestone: v1.6 Budget Forecasting & Cash Flow Refinement
- **Goal**: Improve the accuracy of daily balance projections and add more granular budgeting targets.
- **Status**: Initializing.

---

<details>
<summary>Milestone History</summary>

### v1.5: Automatic Recurring Transactions (2026-03-03)
- Implemented `RecurrenceManager` for automatic series expansion (2-month horizon).
- Built `generateInstances` utility with `parentDate` anchoring for drift protection.
- Refactored `src/db/schema.js` to version 12; migrated legacy templates to `recurrentExpenses`.
- Added independent month navigation pickers to Income and Expenses tabs.
- Integrated `filterTransactions` for multi-select category filtering in Income tab.
- Implemented "This vs All Future" edit/delete logic for recurring series.

### v1.4: Local File Persistence (2026-03-02)
- Ported File System Access API integration from legacy monolith to modular `src/`.
- Implemented `SyncManager` with 500ms debounce and exponential backoff retry.
- Standardized all repository mutations (`src/db/repository.js`) to trigger sync.
- Added persistent `FileSystemFileHandle` storage via native IndexedDB.
- Archived legacy `budget-app.html` draft.

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
*Last updated: 2026-03-03 (v1.5 Completion)*
