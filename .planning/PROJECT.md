# Project: Budget App

## Vision

A personal UK household budget planner — not a transaction ledger, but a **forward-looking cash-flow planning tool**. Given a current account balance entered by the user, the app answers: *"How much can I safely pay extra toward my debts before my next payday?"* All data is stored locally in IndexedDB with optional Supabase cloud backup. No server required.

## Current State

- **Latest Version**: v2.7 (Cloud-First Sync & UX Refinement) — Shipped 2026-03-12
- **Status**: v2.7 complete. v3.0 roadmap reviewed by Opus 4.6 (2026-03-14) — ready to begin.
- **Tech Stack**: Vanilla JS (ES Modules) · Dexie.js (IndexedDB) · Chart.js v4 · date-fns · Vite build · Supabase optional cloud sync · PWA (service worker)
- **Codebase**: ~14,000 JS LOC | Vitest test suite (354 passing)
- **Deployment**: GitHub Pages via GitHub Actions CI/CD

## Core Value Proposition

> Based on my current account balance and all upcoming committed outgoings, tell me what I can afford to pay extra toward my debts between now and my next payday.

The app must therefore model:
1. **Two income sources** arriving on different dates each month
2. **All recurring fixed expenses** (mortgage, personal loan, utilities, subscriptions, etc.) with exact debit dates that respect the banking calendar
3. **Credit card statements** with minimum payments and the ability to pay extra
4. **Childcare Tax-Free accounts** for two children — how much to top up each period
5. **Spending buckets** (groceries, eating out, petrol, etc.) as estimated outgoings
6. **A payoff planner** that, given an available extra amount, ranks which debts to attack first
7. **A data integrity checker** that validates referential integrity across all stores

## Key Design Principles

- **Mobile-first, read-friendly on phone** — the app is configured on desktop but consulted on mobile
- **No accurate transaction tracking required** — balance is manually entered from the bank app
- **Visual clarity** — charts, timelines, and date-stamped payment schedules are essential
- **Offline-first** — all data in IndexedDB; Supabase sync is additive
- **Banking calendar aware** — payment dates shift to the next working day when they fall on weekends/bank holidays
- **Data integrity enforced** — referential integrity validated on DB refresh and sync pull

## Schema Version Plan

| Schema Version | Phase | Changes |
|---------------|-------|---------|
| v13 | Phase 31 | Banking calendar fields |
| v14 | Phase 32 | Debt type fields |
| v15 | Phase 33 | Income sources + spending buckets stores |
| v16 | Phase 35 | Childcare providers store |

## Milestone History (Summary)

| Version | Name | Status |
|---------|------|--------|
| v1.0 | Foundation | Shipped |
| v2.0 | Debt Tracking & Payoff | Shipped |
| v2.3 | Advanced Analytics & Mobile Polish | Shipped 2026-03-07 |
| v2.4 | UX Polish & Spending Insights | Shipped 2026-03-07 |
| v2.5 | Debt Tab UX Overhaul | Shipped 2026-03-08 |
| v2.6 | Dashboard Invariants & Technical Polish | Shipped 2026-03-11 |
| v2.7 | Cloud-First Sync & UX Refinement | Shipped 2026-03-12 |
| **v3.0** | **Budget Planning Core Redesign** | **Upcoming** |

## Current Milestone: v3.0 Budget Planning Core Redesign

**Goal:** Build the Pay-Period Affordability Engine — given the current account balance and all upcoming committed outgoings, tell the user exactly how much they can safely pay extra toward their debts before their next payday.

**Target features:**
- Pay-Period Affordability Engine with balance entry and payment timeline (PLAN-01, PLAN-02, PLAN-05)
- Income configuration (2 sources) and Spending Buckets (PLAN-04, PLAN-06)
- Banking Calendar utility + recurrence engine working-day support (TECH-02, TECH-03, PLAN-03)
- Debt Model Refactor: loans & mortgages use amortisation model, no statement import (DEBT-01, DEBT-03)
- Childcare Top-Up Planner integrated into affordability calculation (CHILD-01, CHILD-02, CHILD-03)
- Mobile overhaul: fixed bottom nav, sticky header, swipe gestures, table fixes (MOB-01 – MOB-07)
- Cloud sync hardening: listener leak fixes, XSS fix, init guard (SYNC-01, SYNC-02)
- Data integrity validator + legacy data import (INTEGRITY-01, INTEGRITY-02)
- GitHub Actions Node.js 24 upgrade (TECH-01)

---
*Last updated: 2026-03-14 — Milestone v3.0 started*
