---
phase: 23.1
slug: cloud-sync-header-refinements
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-12
---

# Phase 23.1 — Validation Strategy & Context

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.js |
| **Quick run command** | `npm test -- --run src/ui/cloud-sync.test.js` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~5 seconds per unit test file |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/ui/cloud-sync.test.js` and `npm test -- --run src/utils/supabase-sync.test.js`.
- **After every wave completion:** Run `npm test -- --run`.
- **Before /gsd:verify-work:** Full suite must be green (all 350+ tests).
- **Max feedback latency:** 10 seconds per verification run.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Files to Create/Modify | Status |
|---------|------|------|-------------|-----------|-------------------|------------------------|--------|
| 23-1-01 | 01 | 1 | SYNC-UX-03 | Unit | `npm test src/ui/cloud-sync.test.js` | src/ui/cloud-sync.js, src/ui/cloud-sync.test.js | ⬜ pending |
| 23-1-02 | 01 | 1 | SYNC-UX-03 | Unit | `npm test src/ui/cloud-sync.test.js` | src/ui/cloud-sync.js, src/ui/cloud-sync.test.js | ⬜ pending |
| 23-1-03 | 02 | 2 | SYNC-UX-02 | Unit | `npm test src/utils/supabase-sync.test.js` | src/utils/supabase-sync.js, src/utils/supabase-sync.test.js | ⬜ pending |
| 23-1-04 | 02 | 2 | SYNC-UX-02 | Unit | `npm test src/ui/cloud-sync.test.js` | src/ui/cloud-sync.js, src/ui/cloud-sync.test.js | ⬜ pending |
| 23-1-05 | 02 | 2 | SYNC-UX-02 | Unit | `npm test src/ui/cloud-sync.test.js` | src/ui/cloud-sync.js, src/ui/cloud-sync.test.js | ⬜ pending |
| 23-1-06 | 03 | 3 | SYNC-UX-01 | Manual + Functional | `npm test -- --run` | src/ui/backup.js, index.html (Settings section) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `23-1-RESEARCH.md` — Infrastructure exploration and findings (COMPLETED).
- [x] `23-1-PLAN.md` — Task breakdown and sequencing (COMPLETED).
- [x] `23-1-VALIDATION.md` — This document (validation strategy).

No code-level Wave 0 dependencies. Ready to proceed with Wave 1 tasks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|-----------|-------------------|
| Sign-in modal UI | SYNC-UX-03 | Visual layout & interaction | Click header "☁ Cloud Sign In" button; verify modal appears with email input. Auto-focus should bring cursor to input. |
| Sync menu modal UI | SYNC-UX-03 | Visual layout & menu presentation | Sign in; click cloud icon/button in header; verify modal shows Push/Pull/Sign Out options with icons/labels. |
| Status dot colors | SYNC-UX-02 | Visual feedback | Add transaction (see yellow 🟡); perform push (see green 🟢); mock error (see red 🔴). |
| Timestamp update | SYNC-UX-02 | Real-time feedback | Push to cloud; verify timestamp in header updates immediately to current time. |
| Settings labels | SYNC-UX-01 | Visual text | Navigate to Settings tab; verify export button says "⬇ Local Export" and import label says "⬆ Local Import". |
| Hint text | SYNC-UX-01 | Clarity | Verify explanatory text about local export/import appears in Settings cloud sync section. |

---

## Feature-Level Test Checklist (Post-Implementation)

### Modal Sign-In Flow (23-1-01)
- [ ] Modal opens when header ☁ button clicked (signed out).
- [ ] Email input auto-focuses when modal opens.
- [ ] "Send Magic Link" button is disabled until email is entered.
- [ ] Submission calls `signIn(email)` function.
- [ ] On success, modal shows confirmation message.
- [ ] Modal can be closed via Cancel button and backdrop click.
- [ ] No regression: existing email form in Settings tab still works.

### Sync Menu Modal (23-1-02)
- [ ] Modal opens when cloud icon clicked (signed in).
- [ ] Menu displays three labeled buttons: Push, Pull, Sign Out.
- [ ] Push button triggers `pushSnapshot()` with loading state.
- [ ] Pull button triggers `pullSnapshot()` with loading state.
- [ ] Sign Out button triggers `supabase.auth.signOut()`.
- [ ] Modal closes after action completes or user dismisses.
- [ ] No regression: individual buttons behavior unchanged (encapsulated in modal).

### Dirty-State Tracking (23-1-03)
- [ ] Adding/updating/deleting transactions sets `budget_cloud_is_dirty = 'true'`.
- [ ] Successful push clears dirty state (`budget_cloud_is_dirty = 'false'`).
- [ ] Failed push does NOT clear dirty state (retains 'true').
- [ ] `isDirty()` returns correct boolean.
- [ ] Initial app load sets dirty state to 'false' if not persisted.

### Status Dot Indicator (23-1-04)
- [ ] 🟢 Green dot shows when synced (not dirty, no error).
- [ ] 🟡 Yellow dot shows when dirty (pending changes).
- [ ] 🔴 Red dot shows when error occurs (last push/pull failed).
- [ ] Dot updates immediately when state changes.
- [ ] Dot is visible and appropriately sized in header.

### Last Synced Timestamp (23-1-05)
- [ ] Timestamp displays in header when signed in (next to status dot).
- [ ] Format is human-readable (e.g., "2 hrs ago", "Mar 12, 2:30 PM").
- [ ] Timestamp updates immediately after successful push/pull.
- [ ] "Never synced" message shows if CLOUD_LAST_SYNC_KEY not set.
- [ ] Timestamp persists after page reload (read from localStorage).

### Settings Label Rebrand (23-1-06)
- [ ] Export button labeled "⬇ Local Export" (not just "⬇ Export").
- [ ] Import label labeled "⬆ Local Import" (not just "⬆ Import").
- [ ] Explanatory hint text visible: "Transaction data is synced to cloud. Use local export for app settings and manual backups."
- [ ] Hint text is readable and contextually placed.
- [ ] All existing export/import functionality continues to work (no logic changes).

---

## Regression Testing Scope

- **Config:** All existing cloud-sync and backup tests must continue to pass.
- **Files at Risk:**
  - `src/ui/cloud-sync.js` (modified for modal flows and status UI).
  - `src/utils/supabase-sync.js` (modified for dirty-state helpers).
  - `src/ui/backup.js` (modified for label rebrand).
  - `index.html` (Settings section structure may change cosmetically).
- **Existing Tests to Verify:**
  - `src/ui/cloud-sync.test.js` (new tests added, old tests should still pass).
  - `src/utils/supabase-sync.test.js` (new tests for dirty-state, old tests should still pass).
  - `src/ui/privacy.test.js`, `src/ui/theme.test.js` (unrelated, sanity check).
  - Full suite `npm test -- --run` (all 350+ tests should pass).

---

## Implementation Notes

### Modal Event Delegation Pattern
Both sign-in modal and sync menu modal will use the existing templateUI pattern:
```javascript
const footer = `
  <button class="ghost" onclick="window.templateUI.closeModal()">Cancel</button>
  <button class="primary" id="signInSubmitBtn">Send Magic Link</button>
`;
templateUI.showModal('Sign In', content, footer);

// Wire up button click handler
document.getElementById('signInSubmitBtn').addEventListener('click', async () => {
  const email = document.getElementById('cloudSignInEmailModal').value;
  await signIn(email);
});
```

### Dirty-State Persistence
localStorage key: `budget_cloud_is_dirty` (string: 'true' or 'false').
- Set to 'true' when `db:mutated` fires.
- Set to 'false' when `pushSnapshot()` succeeds.
- Default to 'false' on app load if not found.

### Error State Storage
**Decision Point:** Store error in memory or localStorage?
- **In-memory (simpler):** Error flag reset on page reload (acceptable for Phase 23.1).
- **localStorage (persistent):** Survives reload; useful for debugging (defer to Phase 25 if needed).
- **Phase 23.1 approach:** Use in-memory flag for MVP; Phase 25 can promote to persistent storage if warranted.

---

## Dependencies & Blockers

| Dependency | Status | Notes |
|-----------|--------|-------|
| Phase 23 (header container, basic cloud actions) | ✅ Complete | Phase 23.1 builds on Phase 23 baseline. |
| `templateUI.showModal()` | ✅ Available | Tested in 10+ places. Ready to use. |
| `db:mutated` event | ✅ Available | Fired on all mutations; sync-manager.js listens. |
| `supabase.auth.onAuthStateChange()` | ✅ Available | Phase 23 uses it; no changes needed. |
| `date-fns` library | ✅ Available | Already used in dashboard for date formatting. |
| Existing modal styling | ✅ Available | No new CSS needed; reuse existing modal styles. |

---

## Validation Sign-Off

- [x] All tasks have automated or manual verify steps.
- [x] Sampling continuity: no 3+ consecutive tasks without automated verify.
- [x] Wave 0 complete (research, plan, validation).
- [x] No watch-mode flags (all run commands are `--run`).
- [x] Feedback latency < 10s per verify cycle.
- [x] `nyquist_compliant: true` set in frontmatter.
- [x] Dependencies and blockers mapped.
- [x] Regression test scope defined.

**Readiness:** ✅ READY FOR EXECUTION

---

*Validation strategy created: 2026-03-12*
*Prepared by: GitHub Copilot (Phase Planning Agent)*
