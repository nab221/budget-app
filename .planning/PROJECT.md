# Project: Budget App

## Current State
- **Latest Version**: v2.7 (Cloud-First Sync & UX Refinement) — Shipped
- **Status**: Milestone v2.7 implementation and verification complete, archived.
- **Key Features**: Cloud-first header UX, modal-based cloud/local sync actions, startup cloud recency check, auto-push on exit, post-auth auto-pull, persistent sync error visibility, global sync notifications, expanded auto-pull edge-case coverage, standardized sync loading states with `aria-busy`, reduced-motion-safe sync polish, 354 passing tests.
- **Codebase**: ~14,000 JS LOC | Vanilla JS + Dexie.js + Chart.js v4 + date-fns

## Next Milestone Goals
- TBD. Run `/gsd:new-milestone` to start next milestone.

---

<details>
<summary>Milestone History</summary>

### v2.7: Cloud-First Sync & UX Refinement (Shipped 2026-03-12)
- [x] UX: Replace local Export/Import in top bar with Cloud Sync (Push/Pull) if configured.
- [x] Sync: Auto-pull prompt on app load if cloud data is newer.
- [x] Sync: Auto-push on `visibilitychange` (switching away from app).
- [x] UI: "Dirty State" indicator for unsynced local changes.
- [x] Auth: Auto-pull from cloud upon successful email sign-in.
- [x] Error: Notify on sync failure and suggest local export as fallback.
- [x] Test: Cover auto-pull comparison edge cases, including missing and malformed local sync timestamps.
- [x] UI: Standardize sync loading states and restore button semantics after completion.
- [x] Accessibility: Disable sync and notification motion when reduced motion is preferred.
- [x] Manual verification: Completed cross-device sync and error handling tests (.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md).

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

