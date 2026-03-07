# Project: Budget App

## Current State
- **Latest Version**: v2.4 (UX Polish & Spending Insights)
- **Status**: Milestone v2.4 Complete. Shipped Haptic Feedback, Swipe Gestures (reveal-and-tap), and Interactive Spending Heatmap.
- **Key Features**: Rhythmic Haptic Patterns, Swipe-to-Delete/Clear with Coordination, 52x7 Spending Heatmap, Quartile Scaling, Privacy Blur for Gestures/Heatmap.
- **Codebase**: ~12,500 JS LOC | Vanilla JS + Dexie.js + Chart.js v4 + date-fns

## Next Milestone: Pending Definition
*Run `/gsd:new-milestone` to define the next set of goals.*

---

<details>
<summary>Milestone History</summary>

### v2.4: UX Polish & Spending Insights (2026-03-07)
- Implemented centralized Haptic Feedback utility (`haptics.js`) with rhythmic patterns (tap, success, delete, error).
- Built advanced Swipe Gesture system with "reveal-and-tap" flow, single-row coordination, and 40px iOS edge guardrail.
- Added tactile "thud" feedback for locked/reconciled rows.
- Developed Interactive Spending Heatmap (Canvas 2D) with quartile scaling and multi-year comparison support.
- Integrated Privacy Mode blur for both heatmap and swipe affordances.

### v2.3: Advanced Analytics & Mobile Polish (2026-03-07)
- Implemented full Reconciliation workflow (cleared/reconciled lifecycle, padlock UI).
- Built Analytics suite: Expenses Doughnut Chart, Savings Rate KPI, 12-month Net Worth Trend.
- Delivered mobile PWA polish: bottom navigation bar, Privacy Mode blur, PWA install icons.
- Hardened Privacy Mode for Dashboard Summary Cards and Payoff Planner.
- Unified forecast engine: chart and table aligned to 45-day horizon with identical balance calculations.
- Fixed advanceNextDate bug in recurrence lifecycle; removed dead bar chart code.

### v2.2: Navigation Overhaul, Dashboard Redesign, and Debt Bug Fixes (2026-03-05)
- Transformed Dashboard into a top-level tab and repositioned navigation to the top of the shell.
- Implemented a 365-day daily granularity balance graph with forecast projections.
- Reordered and consolidated Dashboard summary boxes (Debt Stats, Childcare, Balance).
- Added per-tab summary banners using a shared `renderTabSummary` utility.
- Fixed debt statement rendering regressions and restored the PDF import pipeline.
- Added a mobile-responsive hamburger menu for navigation.

### v2.1: Advanced Refinements & Security (2026-03-04)
- Implemented robust UUID fallback in `src/utils/security.js` (Crypto -> Math.random).
- Refined persistence banner and toolbar logic in `src/ui/file-sync.js`.
- Built `simulateLoanPayoff` with support for interest-only loans and ERC fee calculations.
- Consolidated balance configuration in Settings and added manual recurrence trigger.
- Cleaned up redundant v1.x UI elements (Income tab import button).

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
*Last updated: 2026-03-07 after v2.4 milestone completion*
