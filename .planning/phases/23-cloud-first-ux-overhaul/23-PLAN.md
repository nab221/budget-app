---
phase: 23
name: cloud-first-ux-overhaul
wave: 1
depends_on: ["Phase 22"]
files_modified: [
  "index.html",
  "css/main.css",
  "src/ui/cloud-sync.js",
  "src/utils/supabase-sync.js",
  "src/app.js"
]
new_files: ["src/ui/cloud-sync.test.js"]
autonomous: true
---

# Plan: Phase 23 — Cloud-First UX Overhaul

This phase delivers a modern "Cloud-First" top-bar experience. It replaces legacy local Export/Import actions in the header with a unified cloud sync interface when Supabase is configured, while retaining local backups as a fallback in the Settings tab.

## Tasks

<task id="23-01-01" wave="1" requirements="SYNC-UX-01">
  <description>Create unit tests for Cloud Sync UI and Dirty State logic</description>
  <plan>
    1. Create `src/ui/cloud-sync.test.js`.
    2. Mock `supabase-sync.js`, `repository.js`, and DOM elements.
    3. Test `cloudSyncUI` initialization and visibility toggling.
    4. Test dirty state transitions (mutated event -> dirty true, push -> dirty false).
    5. Test unified menu rendering and button click handlers.
  </plan>
  <verify>
    Run `npm test src/ui/cloud-sync.test.js`.
  </verify>
</task>

<task id="23-01-02" wave="1" requirements="SYNC-UX-01, SYNC-UX-02">
  <description>Implement Dirty State tracking foundation</description>
  <plan>
    1. Update `src/utils/supabase-sync.js`:
       - Add `isDirty()` and `setDirty(bool)` helpers.
       - Persist dirty state in `localStorage` as `budget_cloud_is_dirty`.
       - Update `pushSnapshot` to call `setDirty(false)` on success.
    2. Update `src/app.js` (or `cloudSyncUI.init`):
       - Listen for `db:mutated` event and call `setDirty(true)`.
  </plan>
  <verify>
    Trigger a database write (e.g. add an expense) and verify `localStorage.getItem('budget_cloud_is_dirty')` is 'true'.
  </verify>
</task>

<task id="23-01-03" wave="1" requirements="SYNC-UX-01">
  <description>Modify index.html and CSS for header cloud sync UI</description>
  <plan>
    1. Update `index.html`:
       - Add `<div id="cloudSyncActionsHeader" class="hidden"></div>` to `.toolbar`.
    2. Update `css/main.css`:
       - Style `#cloudSyncActionsHeader` (flex, gap, alignment).
       - Style the "Status Dot" (.status-dot with colors for green/yellow/red).
       - Style the "Last Synced" timestamp (small, soft text).
       - Ensure the smart icon (☁️) is prominent.
  </plan>
  <verify>
    Inspect the header in the browser; verify the container is present (even if hidden).
  </verify>
</task>

<task id="23-02-01" wave="2" requirements="SYNC-UX-01">
  <description>Implement Sign-In Modal Overlay</description>
  <plan>
    1. Update `src/ui/cloud-sync.js`:
       - Create `_showSignInModal()` using `templateUI.showModal`.
       - Template should include email input and "Send Magic Link" button.
       - Wire up button to `signIn(email)` from `supabase-sync.js`.
  </plan>
  <verify>
    Call `cloudSyncUI._showSignInModal()` from console and verify the modal appears and functions.
  </verify>
</task>

<task id="23-02-02" wave="2" requirements="SYNC-UX-01">
  <description>Implement Unified Sync Menu</description>
  <plan>
    1. Update `src/ui/cloud-sync.js`:
       - Create `_showSyncMenu()` using `templateUI.showModal`.
       - Menu should show: "Push to Cloud", "Pull from Cloud", "Sign Out".
       - Wire up buttons to existing `pushSnapshot()`, `pullSnapshot()`, and `supabase.auth.signOut()`.
  </plan>
  <verify>
    Call `cloudSyncUI._showSyncMenu()` from console and verify the menu options work.
  </verify>
</task>

<task id="23-02-03" wave="2" requirements="SYNC-UX-01">
  <description>Refine Settings Tab: Rebrand Local Actions</description>
  <plan>
    1. Update `src/ui/cloud-sync.js` (or relevant render logic):
       - Change "Export" label to "Local Export".
       - Change "Import" label to "Local Import".
       - Add hint: "Transaction data is synced to cloud. Use local export for app settings and manual backups."       
  </plan>
  <verify>
    Inspect the Settings tab and verify labels and hints.
  </verify>
</task>

<task id="23-03-01" wave="3" requirements="SYNC-UX-01, SYNC-UX-02">
  <description>Integrate Header UI in cloud-sync.js</description>
  <plan>
    1. Update `cloudSyncUI.init()`:
       - Hide `#exportBtn` and `label[for="importFile"]` if `isConfigured()`.
       - Show `#cloudSyncActionsHeader` if `isConfigured()`.
    2. Update `_refreshSection()` to also call `_refreshHeader()`.
    3. Implement `_refreshHeader()`:
       - If Signed Out: Render "☁️ Sign In" button (triggers `_showSignInModal`).
       - If Signed In: Render Smart Icon (☁️), Status Dot, and Last Synced timestamp.
       - Smart Icon click triggers `_showSyncMenu`.
       - Status Dot color: Green if !dirty, Yellow if dirty, Red if error (track error state in memory).
  </plan>
  <verify>
    Run `npm test src/ui/cloud-sync.test.js` and perform manual end-to-end verification.
  </verify>
</task>

## Verification Criteria

### Automated Tests
- `src/ui/cloud-sync.test.js`: Verifies UI state based on auth and dirty flags.
- `npm test`: Full suite regression check.

### Manual Verification (Must-Haves)
- [ ] Local buttons hidden from header when Supabase is configured.
- [ ] "☁️ Sign In" button shown in header when logged out.
- [ ] Clicking "☁️ Sign In" opens a modal (not a redirect).
- [ ] Logged in state shows Smart Icon + Status Dot + Timestamp.
- [ ] Status dot turns Yellow (🟡) immediately after a Dexie write.
- [ ] Status dot turns Green (🟢) immediately after a successful Cloud Push.
- [ ] Clicking Smart Icon opens menu with Push/Pull/Sign-Out options.
- [ ] Settings tab clearly labels "Local" actions and shows the explanatory hint.

## Must Haves
- [ ] Unified Sync Menu (modal or dropdown) in header.
- [ ] Status Dot for visual sync feedback.
- [ ] "Dirty State" tracking linked to `db:mutated`.
- [ ] Sign-In modal using `templateUI`.
- [ ] Rebranded local actions in Settings tab.
