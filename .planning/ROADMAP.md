# Roadmap: Budget App (Milestone v2.7)

## Phase 23: Cloud-First UX Overhaul (Consolidation) ✅ COMPLETE
**Goal:** Replace legacy local Export/Import in the top bar with Cloud Sync actions when Supabase is enabled.
- **Task 23.1:** Modify `index.html` to include a `#cloudSyncActionsHeader` container in the top bar.
- **Task 23.2:** Update `cloud-sync.js` to render sync actions in the top bar based on auth state.
- **Task 23.3:** Conditional visibility for local Import/Export buttons (hide if Cloud is configured).
- **Verified:** 2026-03-12 via `PHASE-23-VERIFICATION.md` and `.planning/phases/23-cloud-first-ux-overhaul/23-VERIFICATION.md`.

## Phase 23.1: Cloud Sync Header Refinements (Enhancements) ✅ COMPLETE
**Goal:** Add modal sign-in flow, unified sync menu, dirty-state tracking, and visual status indicators to the cloud header.
- **Task 23.1.1:** Implement sign-in modal overlay using `templateUI.showModal` (instead of Settings tab redirect).
- **Task 23.1.2:** Create unified sync menu modal with Push/Pull/Sign-Out options.
- **Task 23.1.3:** Implement dirty-state tracking (localStorage `budget_cloud_is_dirty`); set dirty on `db:mutated`, clear on successful push.
- **Task 23.1.4:** Add status dot indicator in header (🟢 synced, 🟡 dirty, 🔴 error).
- **Task 23.1.5:** Display "Last Synced" timestamp in header next to status dot.
- **Task 23.1.6:** Rebrand local Import/Export buttons in Settings as "Local Import" / "Local Export" with explanatory hint.

## Phase 23.2: Header Button Consolidation
**Goal:** Reduce clutter in the top bar by removing Sign Out from the header and consolidating local backup actions behind a single 📁 Local button.
- **Task 23.2.1:** Remove "Sign Out" button from the header bar (it already exists inside the Cloud Sync modal).
- **Task 23.2.2:** Add a 📁 Local button to the header that opens a modal with Export, Import, and Cancel options.
- **Task 23.2.3:** Local button is shown in both signed-in and signed-out cloud states (replaces standalone Export/Import buttons).

## Phase 23.3: Sync Modal Parity and Safety Controls ✅ COMPLETE
**Goal:** Make Cloud and Local actions follow the same modal pattern, keep file-sync controls inside Local, and move destructive data clearing out of the top bar.
- **Task 23.3.1:** Move local file actions (Select Budget File, Change File, Disconnect File) into the 📁 Local modal.
- **Task 23.3.2:** Add a dedicated local file-sync status indicator in the header (auto-saving, saving/dirty, error, no file).
- **Task 23.3.3:** Restructure the ☁ Cloud modal to match the 📁 Local modal with panel-based actions, signed-in account panel, and a Close footer action.
- **Task 23.3.4:** Move "Clear All Data" from the top bar into Settings under a cautionary Danger Zone section.
- **Task 23.3.5:** Keep the header subtitle static by removing "Auto-saving to ..." text under the app title (status remains in header indicator dots).

## Phase 23.4: Runtime Cloud Configuration for Hosted Builds ✅ COMPLETE
**Goal:** Allow users to configure Supabase URL and anon key at runtime when `.env.local` is unavailable (e.g., GitHub Pages).
- **Task 23.4.1:** Add runtime Supabase config persistence in `localStorage` and use it as fallback when `import.meta.env` is missing.
- **Task 23.4.2:** Show a ☁ Configure Cloud button in the header when cloud is not configured.
- **Task 23.4.3:** Add a modal to capture `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with minimal guidance.
- **Task 23.4.4:** Reinitialize cloud auth/UI after runtime config save so users can sign in immediately.
- **Task 23.4.5:** Add unit test coverage for runtime config behavior.

## Phase 24: Intelligent Sync Logic (Auto-Pull & Auto-Push) ✅ COMPLETE
**Goal:** Automate sync checkpoints to reduce manual effort.
- **Task 24.1:** Implement "Auto-Pull check" on app load; prompt user if cloud is newer.
- **Task 24.2:** Implement "Auto-Push on Exit" via `visibilitychange` event.
- **Task 24.3:** After a successful magic-link sign-in, automatically trigger `pullSnapshot`.
- **Verified:** 2026-03-12 via `.planning/phases/24-intelligent-sync-logic/24-VERIFICATION.md`.

## Phase 25: Sync Visibility (Dirty State & Error Handling)
**Goal:** Improve user awareness of sync status and failures.
- **Task 25.1:** Implement "Dirty State" tracking (mark as dirty on Dexie writes, clear on push).
- **Task 25.2:** Add a visual indicator (dot/label) for the dirty state in the top bar.
- **Task 25.3:** Create a global notification system for sync failures with a local export fallback.

## Phase 26: Milestone v2.7 Verification & Polish
**Goal:** End-to-end testing and performance audit.
- **Task 26.1:** Comprehensive manual sync testing (Cross-device simulation).
- **Task 26.2:** Unit tests for auto-pull comparison logic.
- **Task 26.3:** Final UI polish (animations, loading states).

---
*Last updated: 2026-03-12* (Phase 23.4 and Phase 24 completed/documented)
