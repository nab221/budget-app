---
phase: 23
name: cloud-first-ux-overhaul
wave: 1
depends_on: ["Phase 22"]
files_modified: ["index.html", "css/main.css", "src/ui/cloud-sync.js"]
new_files: ["src/ui/cloud-sync.test.js"]
autonomous: true
---

# Plan: Phase 23 — Cloud-First UX Overhaul

This phase replaces legacy local Export/Import actions in the header with Cloud Sync actions (Push/Pull/Sign-In) when Supabase is configured. This prioritises the cloud-first experience while maintaining local fallbacks.

## Tasks

<task id="23-01-01" wave="1" requirements="SYNC-UX-01">
  <description>Create unit test for Cloud Sync UI logic</description>
  <plan>
    1. Create `src/ui/cloud-sync.test.js`.
    2. Mock `supabase-sync.js` and DOM elements.
    3. Test `cloudSyncUI.init()` handles header visibility correctly.
    4. Test `_refreshSection()` updates both settings and header areas.
    5. Test button rendering for signed-in and signed-out states.
  </plan>
  <verify>
    Run `npm test src/ui/cloud-sync.test.js` and ensure it passes (some tests may fail initially until implementation).
  </verify>
</task>

<task id="23-01-02" wave="1" requirements="SYNC-UX-01">
  <description>Modify index.html to include cloud sync header container</description>
  <plan>
    1. Open `index.html`.
    2. Locate `.toolbar` in the `header` section.
    3. Insert `<div id="cloudSyncActionsHeader" class="hidden"></div>` as the first item in the toolbar.
  </plan>
  <verify>
    Manually inspect `index.html` or use `grep` to confirm the element exists in the correct location.
  </verify>
</task>

<task id="23-01-03" wave="1" requirements="SYNC-UX-01">
  <description>Add CSS for Cloud Sync header elements</description>
  <plan>
    1. Open `css/main.css`.
    2. Add styles for `#cloudSyncActionsHeader`.
    3. Ensure it uses `display: flex` and maintains consistent spacing with other toolbar items.
    4. Define compact button styles if needed for mobile header space.
  </plan>
  <verify>
    Verify CSS rules exist in `css/main.css`.
  </verify>
</task>

<task id="23-01-04" wave="2" requirements="SYNC-UX-01">
  <description>Update cloud-sync.js to manage header UI and auth state</description>
  <plan>
    1. Update `cloudSyncUI.init()` to toggle visibility of `#cloudSyncActionsHeader` and local buttons (`#exportBtn`, `label[for="importFile"]`) based on `isConfigured()`.
    2. Update `_refreshSection()` to call new header rendering methods.
    3. Implement `_renderHeaderSignedIn(session, container)`:
       - Show compact "☁️ Push" and "☁️ Pull" buttons.
       - Wire up click handlers to existing `pushSnapshot` and `pullSnapshot` logic.
    4. Implement `_renderHeaderSignedOut(container)`:
       - Show "☁️ Sign In" button.
       - Wire up click handler to redirect user to Settings tab: `document.querySelector('.tab[data-tab="settings"]')?.click()`.
  </plan>
  <verify>
    Run `npm test src/ui/cloud-sync.test.js`.
  </verify>
</task>

<task id="23-01-05" wave="3" requirements="SYNC-UX-01">
  <description>Final verification and local button suppression</description>
  <plan>
    1. Ensure local Export/Import buttons are hidden when `isConfigured()` is true.
    2. Verify haptic feedback is triggered on button clicks in the header.
    3. Perform manual check: sign in/out and verify header updates immediately.
  </plan>
  <verify>
    Manual verification:
    - Set `VITE_SUPABASE_URL` in `.env`.
    - Observe header change.
    - Click "Sign In", verify redirection to Settings.
    - Sign in, verify Push/Pull buttons appear in header.
  </verify>
</task>

## Verification Criteria

### Automated Tests
- `src/ui/cloud-sync.test.js`: Validates DOM state transitions and button rendering based on auth.
- `npm test`: Full suite regression check.

### Manual Verification (Must-Haves)
- **Condition:** Supabase env vars present.
- **Header:** `#cloudSyncActionsHeader` is visible; `#exportBtn` and Import label are hidden.
- **Auth Signed Out:** "☁️ Sign In" button shown in header.
- **Auth Signed In:** "☁️ Push" and "☁️ Pull" buttons shown in header.
- **Interaction:** "Sign In" button switches active tab to Settings.
- **Interaction:** Push/Pull buttons trigger respective sync operations with loading states.

## Must Haves
- [ ] Local buttons hidden if Cloud is enabled.
- [ ] Cloud actions available in top-bar header.
- [ ] "Sign In" redirects to settings for email entry.
- [ ] Push/Pull logic reused from existing settings tab implementation.
- [ ] No regressions in existing local import/export when Cloud is disabled.
