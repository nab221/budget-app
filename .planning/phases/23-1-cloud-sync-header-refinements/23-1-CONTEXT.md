---
phase: 23.1
name: Cloud Sync Header Refinements
goal: Enhance Phase 23 with modal-driven sign-in, unified sync menu, dirty-state tracking, and visual sync status indicators.
created: 2026-03-12
---

# Phase 23.1 Context

## Overview

Phase 23 delivered the cloud-first top-bar UX by showing/hiding cloud actions based on Supabase configuration and auth state. Phase 23.1 refines this experience with:

1. **Modal-driven sign-in** — Users can sign in via modal overlay (not Settings tab redirect).
2. **Unified sync menu** — Consolidate Push/Pull/Sign-Out buttons into a modal menu.
3. **Dirty-state tracking** — Mark data as "pending sync" after mutations.
4. **Visual status indicator** — Color-coded dot (🟢 synced, 🟡 dirty, 🔴 error) in header.
5. **Last synced timestamp** — Display when the user last pushed/pulled successfully.
6. **Settings label rebrand** — Clarify local export/import with "Local" prefix and explanatory hint.

## Strategic Fit

- **Before Phase 24 (Auto-Sync):** Phase 23.1 provides the manual sync UI and dirty-state foundation.
- **Before Phase 25 (Visibility & Errors):** Phase 23.1 tracks dirty state and basic error indicators; Phase 25 adds global notifications and retry logic.
- **Consolidation wave:** Phase 23.1 is part of the Phase 23 consolidation, delivering a polished cloud-first UX before automation.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Modal for sign-in** | Avoids tab navigation, keeps user in context, aligns with modern SPA patterns. |
| **Unified sync menu (modal)** | Reduces header clutter, leverages existing modal infrastructure, allows room for future options (settings, etc.). |
| **Dirty state via db:mutated** | Event-driven design, no polling, minimal performance overhead. Reuses existing event infrastructure. |
| **Status dot colors** | Emoji-based (🟢 🟡 🔴) for universal support and zero CSS overhead. Fallback text if emojis unavailable. |
| **localStorage for dirty state** | Survives page reload; user can see pending changes even after browser restart. |
| **Timestamp formatting with date-fns** | Library already in codebase; human-readable output (relative times like "2 hrs ago"). |

## Scope Exclusions (Deferred to Later Phases)

| Feature | Phase | Reason |
|---------|-------|--------|
| Global notification system | Phase 25 | Requires error state management and retry logic beyond Phase 23.1. |
| Auto-push on visibility change | Phase 24 | Automation layer; depends on dirty-state foundation (23.1). |
| Advanced error recovery | Phase 25 | Requires notification UI and user interaction patterns. |
| Status dot animations | Phase 26 | Polish; deferred to final UI refinement wave. |

## Manual Verification Focus

Phase 23.1 introduces several interactive elements that require manual end-to-end testing:
- Modal open/close interactions.
- Form submission (sign-in email).
- Status dot color transitions (add → push → status change).
- Timestamp accuracy and updates.
- Settings tab label visibility.

Automated unit tests will cover state transitions and logic; manual checks will verify user-facing UX.

## Success Criteria

- ✅ All 6 tasks implement successfully.
- ✅ Full test suite passes (no regressions).
- ✅ All "must-have" features verified manually.
- ✅ Modal patterns consistent with existing code.
- ✅ Dirty-state tracking is performant (no observable lag).
- ✅ Status dot and timestamp render correctly at all screen sizes.

---

*Context created: 2026-03-12*
