# Phase 23: Cloud-First UX Overhaul (Consolidation) - Research

## Objective
Replace legacy local Export/Import in the top bar with Cloud Sync actions when Supabase is enabled. This consolidates sync actions into the primary interface for users who have opted into cloud storage.

## Key Files
- `index.html`: Header structure and toolbar.
- `src/ui/cloud-sync.js`: UI logic for cloud sync actions.
- `src/utils/supabase-sync.js`: Core sync logic and configuration state.
- `src/app.js`: Main application initialization and coordination.

## Current UI State (Top Bar)
- **Local Buttons (to be hidden if Cloud is active):**
  - `<button id="exportBtn" class="ghost">⬇️ Export</button>`
  - `<label for="importFile">... ⬆️ Import ...</label>`
- **Toolbar Container:** `<div class="toolbar">` in `header`.

## Findings

### 1. Detection Mechanism
`src/utils/supabase-sync.js` provides `isConfigured()`, which returns `true` if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present in the environment. This is the master switch for Phase 23.

### 2. Header Container Integration
- Task 23.1 requires adding `#cloudSyncActionsHeader` to the toolbar.
- Placement: Before or after existing buttons. To minimize visual shift, placing it as the first item in the toolbar is recommended.

### 3. Cloud Sync UI Logic (`cloud-sync.js`)
- `cloudSyncUI.init()`: Needs to check if `#cloudSyncActionsHeader` exists and initiate its refresh cycle.
- `_refreshSection()`: Currently only refreshes `#cloudSyncSection` (the settings tab view). It should be updated to also refresh `#cloudSyncActionsHeader`.
- **Auth State Handling:**
  - **Signed Out:** Show a single "☁️ Sign In" button. Clicking this triggers a modal overlay for email entry, keeping the user in the current view.
  - **Signed In:** Show compact "☁️ Sync" icon (triggers a unified menu).

### 4. Visibility Toggling
- In `cloud-sync.js:init()`, if `isConfigured()` is true:
  - Add `hidden` class to `#exportBtn` and the import label.
  - Remove `hidden` class from `#cloudSyncActionsHeader`.
- If `isConfigured()` is false:
  - Ensure `#cloudSyncActionsHeader` remains hidden.
  - Ensure local Export/Import buttons remain visible.

### 5. Interaction Design
- **Sign In Button:** Triggers `_showSignInModal()`.
- **Sync Icon:** Triggers `_showSyncMenu()` with Push/Pull/Sign-Out options.
- **Loading States:** The icon should pulse or show a spinner during active sync.

## Planning "Consolidated Top-Bar Actions" (SYNC-UX-01)
To plan this well, the following must be addressed:
- **Mobile Responsiveness:** The top bar is crowded. Buttons in the header must be compact (icons + short text).      
- **Modal Overlay:** For "Sign In", since it requires an email input, use a modal overlay (via `templateUI.showModal`) to keep the user context.
- **Loading States:** Ensure buttons are disabled and show feedback during async operations.
- **Haptics:** Maintain consistency with existing `triggerHaptic('tap')` and `triggerHaptic('success')` calls.        

## Next Steps
1.  **Task 23.1:** Add `#cloudSyncActionsHeader` to `index.html`.
2.  **Task 23.2:** Update `cloud-sync.js` to manage the header UI and auth state changes.
3.  **Task 23.3:** Implement visibility logic for local buttons based on `isConfigured()`.
