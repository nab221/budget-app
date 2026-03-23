# Phase 23: Cloud-First UX Overhaul (Consolidation) - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 23 delivers a modern "Cloud-First" top-bar experience. It replaces the legacy local file-based actions in the header with a unified cloud sync interface when Supabase is configured, while retaining local backups as a fallback in the Settings tab.

</domain>

<decisions>
## Implementation Decisions

### Header Layout & Density
- **Unified Sync Menu:** Instead of separate Push/Pull buttons, use a single smart "Sync" icon that opens a menu for **Push to Cloud**, **Pull from Cloud**, and **Sign Out** actions.
- **Icons Only (Header):** The primary sync trigger in the header uses icons only to save space, while full text labels remain in the Settings tab.
- **Visual Feedback:** Use subtle visual spinners or pulsing effects on the sync icon to indicate an active sync operation.
- **Status Visibility:** A color-coded dot (🟢 Synced, 🟡 Dirty, 🔴 Error) will be placed next to the sync icon. The **"Last synced"** timestamp will be always visible in the header next to the status.

### Sign-In Flow
- **Sign-In Button:** Show a clear "☁️ Sign In" button in the header when unauthenticated.
- **Modal Overlay:** Clicking the header Sign-In button will trigger a modal overlay (using `templateUI.showModal`) for email entry, keeping the user in the current view.
- **Privacy:** The user's email address will NOT be displayed in the header; it remains strictly in the Settings tab.

### Legacy Fallback (Local Actions)
- **Header Suppression:** Local "Export" and "Import" buttons are **completely hidden** from the top-bar header when Supabase is configured.
- **Settings Fallback:** Local actions remain accessible in the **Settings tab** only.
- **Explicit Rebranding:** Labels in the Settings tab are changed to **"Local Export"** and **"Local Import"** to distinguish them from cloud actions.
- **Explanatory Hint:** Add a hint below the local buttons in Settings: *"Transaction data is synced to cloud. Use local export for app settings and manual backups."*

### Error Handling
- **Warning Icon:** If a cloud sync operation fails, the header icon changes to a warning sign (⚠️☁️).
- **Persistent Error State:** The status dot turns Red (🔴) until a successful sync occurs.

### Claude's Discretion
- Implementation of the "Dirty State" tracking logic (foundation for Phase 25).
- Specific icon choices (e.g., using standard emojis ☁️, ⬆️, ⬇️ or Lucide-like SVG paths if preferred).
- Exact modal styling for the Sign-In overlay.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `templateUI.showModal`: For the Sign-In email entry and the Pull Preview confirmation.
- `cloudSyncUI`: Current object in `src/ui/cloud-sync.js`. Needs expansion to handle header rendering.
- `supabase-sync.js`: Existing utility for `isConfigured()`, `pushSnapshot()`, etc.

### Established Patterns
- `isConfigured()` guard: Used to determine if Cloud-First UI should be active.
- `localStorage.getItem(CLOUD_LAST_SYNC_KEY)`: For the "Last synced" timestamp.
- `triggerHaptic('tap')`: Consistent feedback on sync actions.

### Integration Points
- `index.html`: `.toolbar` section in the `<header>`.
- `src/ui/cloud-sync.js`: `init()` method and render logic.
- `src/app.js`: Where `cloudSyncUI.init()` is called during app startup.

</code_context>

<specifics>
## Specific Ideas
- The "Sign In" modal should be clean and use the existing modal infrastructure to avoid redundant styling.
- The "Unified Sync Menu" could be a simple dropdown or a secondary modal with quick action buttons.

</specifics>

<deferred>
## Deferred Ideas
- Auto-sync on exit (Phase 24).
- Detailed "Dirty State" indicator for specific tables (Phase 25).
- Syncing Settings to cloud (Phase 22).

</deferred>

---

*Phase: 23-cloud-first-ux-overhaul*
*Context gathered: 2026-03-11*
