# Project: Budget App

## Vision

A personal UK household budget planner — not a transaction ledger, but a **forward-looking cash-flow planning tool**. Given a current account balance entered by the user, the app answers: *"How much can I safely pay extra toward my debts before my next payday?"* All data is stored locally in IndexedDB with optional Supabase cloud backup. No server required.

## Current State

- **Latest Version**: v3.1 (UX Fixes) — Shipped 2026-03-23
- **Status**: v3.1 complete. Planning next milestone.
- **Tech Stack**: Vanilla JS (ES Modules) · Dexie.js v7 (IndexedDB schema v23) · Chart.js v4 · date-fns · Vite build · Supabase optional cloud sync · PWA (service worker + Workbox)
- **Codebase**: ~32,000 LOC (JS + CSS) | Vitest tests passing
- **Deployment**: GitHub Pages via GitHub Actions CI/CD (Node.js 24)

## Core Value Proposition

> Based on my current account balance and all upcoming committed outgoings, tell me what I can afford to pay extra toward my debts between now and my next payday.

The app models:
1. **Configurable income sources** (Income Sources tab) arriving on different dates each month, banking-calendar adjusted
2. **All recurring fixed expenses** (mortgage, personal loan, utilities, subscriptions) with exact debit dates respecting the banking calendar
3. **Credit card statements** with minimum payments and the ability to pay extra
4. **Childcare Tax-Free accounts** for two children — how much to top up each period
5. **Spending buckets** (groceries, eating out, petrol, etc.) as estimated outgoings prorated per pay period
6. **A payoff planner** that ranks which debts to attack first given an available extra amount
7. **A data integrity checker** that validates referential integrity across all stores on startup/pull/import

## Key Design Principles

- **Mobile-first, read-friendly on phone** — the app is configured on desktop but consulted on mobile
- **No accurate transaction tracking required** — balance is manually entered from the bank app
- **Visual clarity** — charts, timelines, and date-stamped payment schedules are essential
- **Offline-first** — all data in IndexedDB; Supabase sync is additive
- **Banking calendar aware** — payment dates shift to the next working day when they fall on weekends/bank holidays
- **Data integrity enforced** — referential integrity validated on DB refresh and sync pull

## Schema Version

Current: **v23** (as of v3.0)

| Schema Version | Phase | Changes |
|---------------|-------|---------|
| v13 | Phase 31 | Banking calendar fields (`paymentAdjustment`) on `recurringExpenses` |
| v14 | Phase 32 | Debt type fields (`debtType`, `apr`, `originalTerm`, `monthlyPayment`, `paymentDate`) |
| v15 | Phase 33 | New stores: `incomeSources`, `spendingBuckets` |
| v16–v22 | Phases 34–35 | `childcareProviders`, `userPreferences` (safety buffer), affordability helpers |
| v23 | Phase 35 | `childcareProviders` store with `accountId`, `name`, `amount`, `frequency` |

## Requirements

### Validated

- ✓ PLAN-01: Current Balance Entry — v3.0 (balance entry modal, `userPreferences` store)
- ✓ PLAN-02: Pay-Period Affordability View — v3.0 (affordability engine, max extra payment, timeline)
- ✓ PLAN-03: Banking Calendar Awareness — v3.0 (`banking-calendar.js`, recurrence working-day support)
- ✓ PLAN-04: Spending Buckets — v3.0 (configurable buckets, prorated to pay period)
- ✓ PLAN-05: Pay-Period Navigator — v3.0 (sticky navigator, prev/next arrows)
- ✓ PLAN-06: Income Configuration — v3.0 (Income Sources tab, unbounded sources, pay date rules)
- ✓ DEBT-01: Loan & Mortgage Projection Model — v3.0 (amortisation model, no statement import)
- ✓ DEBT-02: Credit Card Statements Retained — v3.0 (unchanged)
- ✓ DEBT-03: Debt Snapshot Confirmation — v3.0 (Confirm Balance modal, 5% warning threshold)
- ✓ DEBT-04: Expense Link for Debt Payments — v3.0 (debt-linked rows navigate to Debts tab)
- ✓ CHILD-01: Recurring Childcare Expense Tracking — v3.0 (providers list, required top-up)
- ✓ CHILD-02: Childcare Top-Up in Pay-Period View — v3.0 (top-ups as committed outgoings)
- ✓ CHILD-03: Entitlement Period Display — v3.0 (entitlement dates on childcare cards)
- ✓ MOB-01: Fixed Bottom Tab Bar — v3.0 (fixed bottom nav, icon+label, three breakpoints)
- ✓ MOB-02: Fixed Top Navigation / Pay-Period Bar — v3.0 (sticky header + navigator)
- ✓ MOB-03: View Toggle Modern Radio Design — v3.0 (segmented control component)
- ✓ MOB-04: Income Tab Mobile Fix — v3.0 (swipe gestures, compact date format)
- ✓ MOB-05: Expenses Tab Mobile Fix — v3.0 (unified into Transactions tab, swipe CRUD)
- ✓ MOB-06: Header Layout Fix — v3.0 (`flex-shrink:0` on sync dot)
- ✓ MOB-07: Magic Link Authentication on PWA/Mobile — v3.0 (VITE_SUPABASE_REDIRECT_URL, workbox denylist, iOS guidance)
- ✓ NAV-01: Tabs Always Visible — v3.0 (fixed bottom bar)
- ✓ NAV-02: Navigator Always Fixed / Visible — v3.0 (sticky/fixed navigator)
- ✓ NAV-03: Heatmap Year Boundary Fix — v3.0 (prior-year data filtered at call sites)
- ✓ NAV-04: Cloud Snapshot Preview Delta Mode — v3.0 (`snapshot-diff.js`, delta labels)
- ✓ SYNC-01: Magic Link PWA Fix — v3.0 (see MOB-07)
- ✓ SYNC-02: Init Guard & Listener Leak Fix — v3.0 (`_initialized`, `_authListenerBound`, `_previewListenerBound` guards)
- ✓ TECH-01: GitHub Actions Node.js 24 — v3.0 (already compliant, verified idempotent)
- ✓ TECH-02: Banking Calendar Utility — v3.0 (`banking-calendar.js`, static fallback 2025–2027)
- ✓ TECH-03: Recurrence Engine Working Day Support — v3.0 (`paymentAdjustment: 'next-working-day'`)
- ✓ TECH-04: Test Coverage for New Modules — v3.0 (10/15 modules ≥80%; 4 deferred to v3.1)
- ✓ TECH-06: Cloud Sync Store Registration — v3.0 (generic `db.tables.map` path covers all stores)
- ✓ INTEGRITY-01: Referential Integrity Validator — v3.0 (`data-integrity.js`, runs on startup/pull/import)
- ✓ INTEGRITY-02: Legacy Data Import — v3.0 (`legacy-import.js`, field mapping, conflict-safe)
- ✓ HEADER-01: Sticky top header on all 8 tabs — v3.1
- ✓ HEADER-02: Scroll shadow on header when scrolled — v3.1
- ✓ HEADER-03: Dynamic header height for month-nav anchoring — v3.1 (ResizeObserver pattern)
- ✓ MONNAV-01: Sticky month navigator below header on Transactions tab — v3.1
- ✓ BOTNAV-01: Fixed mobile bottom nav on all 8 tabs — v3.1
- ✓ BOTNAV-02: Tab content does not scroll behind bottom nav — v3.1
- ✓ BOTNAV-03: iOS safe-area padding for home indicator — v3.1 (viewport-fit=cover)
- ✓ BOTNAV-04: PWA update bar appears above bottom nav — v3.1
- ✓ TABUI-01: All 8 tab buttons identical height and shape — v3.1
- ✓ TABUI-02: Payoff tab button does not change shape on tap — v3.1
- ✓ DEBT-05: Payment history modal for loan/mortgage with expected dates — v3.1
- ✓ DEBT-06: Confirm historical loan payment as paid in history modal — v3.1
- ✓ DEBT-07: Adjust payment amount before confirming in history modal — v3.1
- ✓ INCOME-01: Income tab displays income sources as cards — v3.1
- ✓ INCOME-02: Income source card opens modal with income entries — v3.1
- ✓ INCOME-03: Confirm income entry as received in modal — v3.1
- ✓ INCOME-04: Change date of upcoming income entry in modal — v3.1
- ✓ INCOME-05: Adjust amount of specific income entry in modal — v3.1
- ✓ TRANS-01: Mark expense as paid from Transactions tab — v3.1
- ✓ TRANS-02: Confirm income as received from Transactions tab — v3.1
- ✓ TRANS-03: Single reconciliation mode button (duplicate removed) — v3.1
- ✓ TRANS-04: Unified Add button with income/expense type selector — v3.1
- ✓ TRANS-05: Sort order toggle (newest/oldest first) — v3.1
- ✓ TRANS-06: ±amount prefix on transactions (− expense, + income) — v3.1
- ✓ TRANS-07: Search bar placeholder reads "Search transactions" — v3.1
- ✓ TRANS-08: Category filter includes debt-linked categories — v3.1
- ✓ DESK-01: Desktop nav bar sticky when scrolling — v3.1
- ✓ CLEAN-01: Dead one-shot getBoundingClientRect() removed from dashboard.js — v3.1
- ✓ PERF-01: app:refresh fires at most one render pass per module on expense toggle — v3.1
- ✓ RECON-01: Legacy Transactions tab buttons audited and resolved — v3.1
- ✓ RECON-02: No broken/dead-end buttons in Transactions tab — v3.1

### Active

_(None — all v3.1 requirements shipped. Add v3.2 requirements here.)_

### Out of Scope

- TECH-05: Print / Export to PDF — deferred to v3.1 (nice-to-have, not blocking)
- TECH-04 (partial): `ui/childcare.js` (0%), `ui/cloud-sync.js` (68.54%), `db/repository.js` (76.28%) coverage below 80% — deferred to v3.1 per Phase 38 coverage audit
- Phase 39 manual verification gates (cross-device, Lighthouse, PWA install, cloud sync round-trip) — not completed before archive; candidate for v3.1 regression testing baseline

## Key Decisions

| Decision | Phase | Outcome | Notes |
|----------|-------|---------|-------|
| Amortisation in `finance.js` (pure sync, integer pence) | 32 | ✓ Good | Avoids async complexity in debt cards |
| Generic `db.tables.map` for cloud sync registration | 33, 34, 35 | ✓ Good | No allowlist to maintain per new store |
| `_buildMergedRows()` pure helper on `transactionUI` | 40 | ✓ Good | Testable without DOM; keeps render logic clean |
| Remove Expenses tab; co-render via `app.js` 'transactions' branch | 40-06 | ✓ Good | Eliminates nav duplication; `expensesUI.render()` no-ops without `#expenseBody` |
| `!row.querySelector('.btn-edit')` as debt-row sentinel | 40-04 | ✓ Good | Avoids data-attribute coupling; works with existing debt card HTML |
| `_boundClickHandler` remove-then-add in `income-sources.js` | 40-05 | ✓ Good | Prevents listener accumulation without module-level flags |
| Decimal phase numbering (39.1, 40) for inserted phases | v3.0 | ✓ Good | Clear insertion semantics; no phase renumbering required |
| Yolo mode throughout v3.0 | v3.0 | ✓ Good | 5-day delivery from baseline; no blocking confirmation gates |
| ResizeObserver for --header-height (runtime measurement) | 40 | ✓ Good | Accommodates cloud-sync button injection without breaking month-nav alignment |
| behavior:instant for tab scroll reset | 40 | ✓ Good | Prevents jarring animation during content change |
| .nav-container moved to direct body child | 41 | ✓ Good | Eliminates CSS fixed-position containment trap; JS ID lookups unaffected |
| width:100vw on .nav-container/.tabs to bypass containment | 42 | ✓ Good | Simpler fix than restructuring; resolves Payoff tab button width expansion |
| generateHistoricalSchedule pure JS amortisation | 43 | ✓ Good | No DOM dependency; easily testable; reuses finance.js integer-pence math |
| _boundClickHandler remove-then-add pattern (income-sources) | 44 | ✓ Good | Prevents listener accumulation without module-level flags |
| Explicit transactionUI.render() replacing app:refresh dispatch | 48 | ✓ Good | Eliminates double-render; clearer data flow; more predictable than event bus |
| Remove Mark All As Paid + Trigger Recurrence buttons | 49 | ✓ Good | Audit confirmed both were non-functional; removal reduces UI debt |

## Context

Shipped v3.1 with ~32,000 LOC (JS + CSS), 236 files changed, in 5 days (Phases 40–49).
31/31 requirements delivered. Known tech debt: Chart.js compositing jank on mobile nav (accepted), minor Nyquist compliance gaps, INCOME-06/09 doc gap.
Tab structure: Dashboard → Transactions (merged IN/OUT + dual heatmaps + sort/filter) → Income (cards + modal) → Debts (history modal) → Payoff → Assets → Childcare → Settings.
Income source cards now editable from modal; confirmed income entries can be unconfirmed.
Desktop nav is sticky. Legacy broken buttons removed. app:refresh render coordination improved.

---
*Last updated: 2026-03-23 after v3.1 milestone*
