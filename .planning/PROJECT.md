# Project: Budget App

## Current State
- **Latest Version**: v2.7 (Cloud-First Sync & UX Refinement) — In Progress
- **Status**: Milestone v2.7 active. Phase 23 and Phase 24 are complete and verified.
- **Key Features**: Cloud-first header UX, modal-based cloud/local sync actions, startup cloud recency check, auto-push on exit, post-auth auto-pull, 323+ passing tests.
- **Codebase**: ~14,000 JS LOC | Vanilla JS + Dexie.js + Chart.js v4 + date-fns

## Current Milestone: v2.7 (Cloud-First Sync & UX Refinement)
**Goal:** Restructure the sync experience to prioritize Supabase cloud storage over local files, implement auto-sync on exit, and improve onboarding/auth flows.

---

<details>
<summary>Milestone History</summary>

### v2.7: Cloud-First Sync & UX Refinement (In Progress)
- [x] UX: Replace local Export/Import in top bar with Cloud Sync (Push/Pull) if configured.
- [x] Sync: Auto-pull prompt on app load if cloud data is newer.
- [x] Sync: Auto-push on `visibilitychange` (switching away from app).
- [x] UI: "Dirty State" indicator for unsynced local changes.
- [x] Auth: Auto-pull from cloud upon successful email sign-in.
- [ ] Error: Notify on sync failure and suggest local export as fallback.

### v2.6: Dashboard Invariants & Technical Polish (2026-03-11)
- Refactored Dashboard KPIs to be navigation-invariant (+30/+90 day projections).
- Implemented Automated CI/CD pipeline via GitHub Actions to GitHub Pages.
- Built fuzzy and case-insensitive category deduplication for merge imports.
- Stabilized UI test suite with 100% pass rate in jsdom.
- Refactored Theme, Haptics, and Privacy logic into dedicated modules.

... [Archive follows v2.5 to v1.0] ...
</details>

---
*Last updated: 2026-03-12*
