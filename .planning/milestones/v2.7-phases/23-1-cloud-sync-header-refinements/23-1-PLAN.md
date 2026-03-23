---
phase: 23.1
name: cloud-sync-header-refinements
wave: 1
depends_on: ["Phase 23"]
files_modified: [
  "src/ui/cloud-sync.js",
  "src/utils/supabase-sync.js",
  "src/ui/backup.js",
  "index.html"
]
new_files: [
  "src/ui/cloud-sync.test.js"
]
autonomous: true
---

# Plan: Phase 23.1 — Cloud Sync Header Refinements

This phase enhances the Phase 23 cloud-first experience with modal-driven sign-in, unified sync menu, dirty-state tracking, and visual sync status indicators.

## Tasks

<task id="23-1-01" wave="1" requirements="SYNC-UX-03">
  <description>Implement sign-in modal overlay (instead of Settings tab redirect)</description>
  <plan>
    1. Create `_showSignInModal()` method in `cloudSyncUI`.
    2. Use `templateUI.showModal()` with email input and "Send Magic Link" button.
    3. Wire button click to existing `signIn(email)` function.
    4. Replace Settings tab click behavior in `_renderHeaderActions()` line 129.
    5. Auto-focus email input when modal opens (`emailInput.focus()`).
    6. On success, show "Check your email for sign-in link" message.
    7. Add unit test for modal rendering and email submission.
  </plan>
  <verify>
    Run `npm test -- --run src/ui/cloud-sync.test.js` and verify sign-in modal test passes.
  </verify>
</task>

<task id="23-1-02" wave="1" requirements="SYNC-UX-03">
  <description>Create unified sync menu modal (Push/Pull/Sign-Out)</description>
  <plan>
    1. Create `_showSyncMenu(session)` method in `cloudSyncUI`.
    2. Use `templateUI.showModal()` to display menu with three action buttons.
    3. Wire buttons to existing `pushSnapshot()`, `pullSnapshot()`, and `supabase.auth.signOut()`.
    4. Replace three individual buttons in `_renderHeaderActions()` (signed-in path, lines 76-91 currently).
    5. Render a smart icon (☁️) or "Cloud Sync Menu" button that opens the modal on click.
    6. Include loading states ("Pushing...", "Fetching...") within modal feedback.
    7. Add unit test for modal rendering with three action options.
  </plan>
  <verify>
    - Manually click the cloud icon/button and verify the modal appears.
    - Click each option (Push, Pull, Sign Out) and verify expected behavior.
    - Run `npm test -- --run src/ui/cloud-sync.test.js` and ensure tests pass.
  </verify>
</task>

<task id="23-1-03" wave="2" requirements="SYNC-UX-02">
  <description>Implement dirty-state tracking via db:mutated event listener</description>
  <plan>
    1. Add new localStorage key: `CLOUD_DIRTY_STATE_KEY = 'budget_cloud_is_dirty'`.
    2. Create `isDirty()` and `setDirty(bool)` helpers in `src/utils/supabase-sync.js`.
    3. In `cloudSyncUI.init()`, listen for `db:mutated` event via `window.addEventListener('db:mutated', () => setDirty(true))`.
    4. In `pushSnapshot()` (src/utils/supabase-sync.js), call `setDirty(false)` on successful push.
    5. Initialize dirty state to `false` on app load if not set.
    6. Add unit tests for `isDirty()` and `setDirty()` state transitions.
  </plan>
  <verify>
    - Add a transaction and verify `localStorage.getItem('budget_cloud_is_dirty')` becomes 'true'.
    - Perform a cloud push and verify dirty state resets to 'false'.
    - Run `npm test -- --run src/utils/supabase-sync.test.js` and ensure new tests pass.
  </verify>
</task>

<task id="23-1-04" wave="2" requirements="SYNC-UX-02">
  <description>Add status dot indicator in header (🟢 synced, 🟡 dirty, 🔴 error)</description>
  <plan>
    1. Create `_renderStatusIndicator()` method in `cloudSyncUI`.
    2. Return colored dot based on state:
       - 🟢 Green: `!isDirty() && !error` (synced state).
       - 🟡 Yellow: `isDirty()` (pending changes).
       - 🔴 Red: `error` flag set (last sync failed).
    3. Render status dot next to smart icon (☁️) in header when signed in.
    4. Store error state in memory (consider localStorage if persistence required).
    5. Integrate into `_renderHeaderActions()` signed-in path.
    6. Add unit test for status dot color selection based on flags.
  </plan>
  <verify>
    - Verify green dot shows on app load (no changes yet).
    - Add a transaction; verify yellow dot appears.
    - Perform a successful push; verify green dot returns.
    - Mock a push error; verify red dot appears.
    - Run `npm test -- --run src/ui/cloud-sync.test.js` and ensure tests pass.
  </verify>
</task>

<task id="23-1-05" wave="2" requirements="SYNC-UX-02">
  <description>Display "Last Synced" timestamp in header</description>
  <plan>
    1. Create `_formatLastSyncTime()` helper in `cloudSyncUI`.
    2. Read `CLOUD_LAST_SYNC_KEY` from localStorage (milliseconds since epoch).
    3. Format as human-readable string using `date-fns` (e.g., "2 hrs ago", "Mar 12, 2:30 PM").
    4. Render timestamp next to status dot in header (when signed in).
    5. Display "Never synced" if `CLOUD_LAST_SYNC_KEY` is not set.
    6. Update timestamp on every successful push/pull.
    7. Add unit test for timestamp formatting logic.
  </plan>
  <verify>
    - Inspect header and verify timestamp appears next to status dot.
    - Perform a push and verify timestamp updates immediately.
    - Pull from cloud and verify timestamp updates.
    - Manually manipulate localStorage CLOUD_LAST_SYNC_KEY and verify format changes as expected.
    - Run `npm test -- --run src/ui/cloud-sync.test.js` and ensure tests pass.
  </verify>
</task>

<task id="23-1-06" wave="3" requirements="SYNC-UX-01">
  <description>Rebrand local Import/Export buttons in Settings as "Local Import" and "Local Export"</description>
  <plan>
    1. Update button labels in `src/ui/backup.js`:
       - Change "⬇ Export" to "⬇ Local Export".
       - Change "⬆ Import" to "⬆ Local Import".
    2. Add explanatory hint near the buttons (or in section header):
       "Transaction data is synced to cloud. Use local export for app settings and manual backups."
    3. Update related modal titles if needed (e.g., "Export Data" → "Export Local Data").
    4. Preserve all existing export/import logic (no functional changes, labels only).
    5. Add unit test or manual check to verify new labels appear in rendered UI.
  </plan>
  <verify>
    - Inspect Settings tab and verify buttons labeled "⬇ Local Export" and "⬆ Local Import".
    - Verify explanatory hint text is visible and readable.
    - Test export/import functionality still works as expected (no logic changes).
    - Run `npm test -- --run` and verify no regressions in backup tests.
  </verify>
</task>

## Task Sequencing

**Wave 1 (Modal Flows):**
- 23-1-01: Sign-in modal (blocks on-header ☁ button interaction pattern).
- 23-1-02: Unified sync menu (depends on header icon/button pattern).

**Wave 2 (State Tracking & Indicators):**
- 23-1-03: Dirty-state tracking (foundation for status dot).
- 23-1-04: Status dot rendering (depends on dirty-state helpers).
- 23-1-05: Timestamp display (reads CLOUD_LAST_SYNC_KEY, independent).

**Wave 3 (Settings Polish):**
- 23-1-06: Label rebrand (independent, no blocking dependencies).

---

## Verification Criteria

### Automated Tests
- `src/ui/cloud-sync.test.js`: Covers modal rendering, sign-in flow, sync menu, status dot states, timestamp formatting.
- `src/utils/supabase-sync.test.js`: Covers dirty-state helpers and setDirty() on pushSnapshot().
- `npm test -- --run`: Full suite passes (no regressions).

### Manual Verification (Must-Haves)
- [ ] Sign-in modal opens when header "☁ Cloud Sign In" button is clicked (signed-out state).
- [ ] Email input is auto-focused in sign-in modal.
- [ ] "Send Magic Link" button submits email and shows success feedback.
- [ ] Sync menu modal opens when header cloud icon is clicked (signed-in state).
- [ ] Sync menu shows "Push to Cloud", "Pull from Cloud", "Sign Out" options.
- [ ] Status dot color matches state: 🟢 synced, 🟡 dirty, 🔴 error.
- [ ] Status dot updates immediately after adding a transaction (turns yellow).
- [ ] Status dot updates immediately after successful push (turns green).
- [ ] "Last Synced" timestamp displays correctly and updates on push/pull.
- [ ] Settings tab "Local Export" and "Local Import" labels are visible.
- [ ] Explanatory hint text is visible in Settings tab.
- [ ] All existing export/import and sync functionality continues to work.

## Must Haves
- [ ] Modal sign-in flow (replaces Settings tab redirect).
- [ ] Unified sync menu modal.
- [ ] Dirty-state tracking linked to db:mutated.
- [ ] Status dot color indicator (🟢 / 🟡 / 🔴).
- [ ] Last synced timestamp in header.
- [ ] Rebranded "Local" buttons in Settings.
- [ ] All tests green (no regressions).

---

## Notes

- **Phase 25 Overlap:** Dirty-state tracking (23.1-03) and status indicator (23.1-04) will layer well with Phase 25's more advanced error handling and notification system. Phase 23.1 is foundation; Phase 25 adds automation and retry logic.
- **Error State Flag:** Using in-memory error flag for 23.1 simplicity. If cross-session error persistence is needed, promote to localStorage in Phase 25.
- **Mobile Responsiveness:** Modal patterns are inherently responsive (full-screen on mobile). No extra work needed for Phase 23.1; Polish (Phase 26) can fine-tune animations if needed.

---

*Plan created: 2026-03-12*
