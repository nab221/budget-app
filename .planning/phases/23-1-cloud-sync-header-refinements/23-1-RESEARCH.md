# Phase 23.1: Cloud Sync Header Refinements — Research

## Objective

Enhance the Phase 23 cloud-first top-bar experience with:
1. Modal sign-in flow (instead of Settings tab redirect).
2. Unified sync menu modal (consolidate Push/Pull/Sign-Out).
3. Dirty-state tracking linked to database mutations.
4. Visual status indicator (dot with color states).
5. "Last Synced" timestamp display.
6. Settings tab relabeling of local import/export actions.

---

## Current State (Phase 23 Baseline)

### Header Cloud Actions Container
- **Location:** `index.html` line 39, `#cloudSyncActionsHeader` in `.toolbar`.
- **Visibility:** Shown when `isConfigured()` == true and Supabase env vars are present.
- **Current Implementation:**
  - Signed in: Three buttons (☁ Push, ☁ Pull, Sign Out).
  - Signed out: One button (☁ Cloud Sign In), which triggers Settings tab click.

### localStorage Keys Used
- `CLOUD_LAST_SYNC_KEY = 'budget_cloud_last_sync'` (set by `pushSnapshot()`, milliseconds since epoch).
- **Candidates for Phase 23.1:**
  - `budget_cloud_is_dirty` — to track dirty state.
  - `budget_cloud_error_state` — optional, to track last sync error (risk vs benefit tradeoff).

### Modal Infrastructure
- **Module:** `src/ui/templates.js` re-exports `showModal` and `closeModal` from `src/ui/render.js`.
- **Pattern:** `templateUI.showModal(title, htmlContent, footerHtmlWithInlineHandlers)`.
- **Used At:** `src/ui/backup.js`, `src/ui/cloud-sync.js`, `src/ui/pdf-import.js`, `src/ui/expenses.js`.
- **Example** (from backup.js):
  ```javascript
  const footer = `
    <button class="ghost" onclick="window.templateUI.closeModal()">Cancel</button>
    <button class="primary" data-backup-action="execute-export">Download Backup</button>
  `;
  templateUI.showModal('Export Data', content, footer);
  ```
- **Key Insight:** Modals use inline `onclick` handlers or `data-*` attributes with event delegation.

### Database Mutation Event
- **Event:** `db:mutated` (custom event, no namespace).
- **Dispatch Location:** `src/db/repository.js` line 17, triggered on `add()`, `update()`, `delete()`.
- **Code:**
  ```javascript
  const triggerSync = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('db:mutated'));
    }
  };
  ```
- **Listeners:** Currently used in `src/utils/sync-manager.js` (line 28).

### Supabase Sync Integration
- **Key Functions:**
  - `pushSnapshot()` — writes all DB tables to Supabase, sets `CLOUD_LAST_SYNC_KEY` on success.
  - `pullSnapshot()` — fetches cloud snapshot, dispatches `budget:import-cloud-preview` event.
  - `signIn(email)` — sends magic link via Supabase Auth OTP.
  - `getSession()` — retrieves current auth session.
  - `isConfigured()` — checks if Supabase env vars are present.

### Current Sign-In Flow (Phase 23)
1. User clicks ☁ Cloud Sign In (header).
2. Click handler calls `settingsTab.click()` to switch to Settings.
3. User manually enters email and clicks "Send Magic Link".
4. Magic link arrives; user clicks link to authenticate.
5. Auth state change triggers `supabase.auth.onAuthStateChange()`.
6. Header actions re-render via `_renderHeaderActions(session)`.

### Settings Tab Export/Import Structure
- **Location:** `src/ui/backup.js` (89 lines of setup, 400+ lines of logic).
- **Key Elements:**
  - `#exportBtn` (button) — labeled "⬇ Export".
  - `label[for="importFile"]` (label wrapping file input) — labeled "⬆ Import".
  - Both are in the header `.toolbar` (currently hidden during Phase 23 if cloud is configured).
- **Modal Hooks:** Uses `templateUI.showModal()` for export/import confirmation.
- **Current Labels:** No explicit "Local" prefix; implicit in Settings tab context.

### Error Handling Patterns
- **Current:** `alertWithHaptic(message, optionalType)` displays both visual and haptic feedback.
- **Used in:** Cloud sync error catches, backup prompts, recurrence checks.
- **Example** (from cloud-sync.js):
  ```javascript
  catch (err) {
    console.error('[cloudSyncUI] Header push failed:', err);
    alertWithHaptic('Push failed: ' + err.message);
    pushBtn.textContent = '☁ Push';
    pushBtn.disabled = false;
  }
  ```

---

## Key Findings for Phase 23.1

### 1. Modal Sign-In Flow
- **Current Limitation:** Requires user to navigate to Settings tab to see email input.
- **Improvement:** Replace with inline modal using `templateUI.showModal()`.
- **Considerations:**
  - Modal will need email input (`<input type="email" id="cloudSignInEmailModal" />`).
  - "Send Magic Link" button will call existing `signIn(email)` function.
  - On success, show "Check your email for sign-in link" message.
  - Option: Auto-focus email input when modal opens (UX best practice).

### 2. Unified Sync Menu
- **Current State:** Three separate buttons in header (Push, Pull, Sign Out).
- **Intent:** Consolidate into a modal menu (drop-down or modal popup).
- **Options:**
  - **A) Modal Menu** (matches templateUI patterns): Click icon → modal shows "Push to Cloud", "Pull from Cloud", "Sign Out".
  - **B) DropDown** (CSS-based): Requires new styling, not aligned with modal infrastructure.
- **Recommendation:** Use modal for consistency (Option A).
- **Reference Point:** Cloud pull already uses a modal for snapshot preview.

### 3. Dirty-State Tracking
- **Mechanism:** Listen for `db:mutated` event, set `budget_cloud_is_dirty = true`.
- **Clear Mechanism:** After successful `pushSnapshot()`, set `budget_cloud_is_dirty = false`.
- **Storage:** localStorage key `budget_cloud_is_dirty` (boolean string 'true' / 'false').
- **Implementation Location:** Should be inside `cloudSyncUI` (or in sync-manager.js if multi-listener).
- **Side Benefit:** Can be queried by status-dot indicator to pick color.

### 4. Status Dot Indicator
- **Visual Choices:**
  - 🟢 Green: Synced (not dirty, last push successful).
  - 🟡 Yellow: Dirty (changes pending push).
  - 🔴 Red: Error (last push/pull failed).
- **Placement:** Next to smart icon (☁️) or above it in header.
- **Complexity:** Requires tracking error state (new localStorage key or in-memory flag).
- **Note:** Phase 25 (Visibility) may overlap here; Phase 23.1 will provide foundation.

### 5. Last Synced Timestamp
- **Source:** `CLOUD_LAST_SYNC_KEY` (existing, already tracked).
- **Display:** "Last synced: {formatted date/time}" or simplified "2 hrs ago" relative time.
- **Location:** Next to status dot in header, or in sync menu modal.
- **Library:** Date formatting via `date-fns` (already used in codebase).

### 6. Settings Tab Relabeling
- **Current Labels:** "⬇ Export" and "⬆ Import" (implicit "Local" context).
- **New Labels:** "⬇ Local Export" and "⬆ Local Import".
- **Hint Text:** Below buttons or in section header: "Transaction data is synced to cloud. Use local export for app settings and manual backups."
- **Location:** In `src/ui/backup.js` (button labels) and `index.html` (Settings section markup).

---

## Implementation Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Modal Sign-In conflicts with existing Settings tab flow.** | Settings tab still shows cloud sync section for authenticated users; modal is "fast path" for new users. Both coexist. |
| **Dirty-state tracking adds event listener overhead.** | Single listener on `db:mutated`; no performance impact (existing pattern in sync-manager.js). |
| **Error state tracking (🔴 status dot) requires new storage.** | Optional for Phase 23.1; can be deferred to Phase 25 if scope creep risk. Core feature is dirty state (🟡). |
| **Status dot color states may not render on all systems.** | Emojis are widely supported; fallback to text ("SYNCED", "DIRTY", "ERROR") if needed. |
| **Unified Sync Menu modal requires button interaction redesign.** | Three-button → smart-icon-click pattern; existing modal infrastructure supports this. |

---

## Dependencies & Infrastructure Readiness

| Dependency | Status | Notes |
|-----------|--------|-------|
| `templateUI.showModal()` | ✅ Available | Used in 10+ places; well-tested. |
| `db:mutated` event | ✅ Available | Triggered on all mutations; sync-manager.js already listens. |
| localStorage | ✅ Available | Used throughout app for UI state. |
| `pushSnapshot()` / `pullSnapshot()` | ✅ Available | Phase 23 baseline; no changes needed. |
| `date-fns` | ✅ Available | Already used for date formatting in dashboard. |
| Haptics UI feedback | ✅ Available | `alertWithHaptic()` used widely. |
| Supabase Auth state listener | ✅ Available | `supabase.auth.onAuthStateChange()` used in Phase 23. |

---

## Scope Notes

- **In Scope:** Modal flows, dirty-state tracking, status dot (base colors), timestamp, relabeling.
- **Future (Phase 25+):** Global notification system, advanced error states, sync retry logic, background auto-push.
- **Out of Scope:** Mobile-specific UX tweaks (covered in Phase 26 polish).

---

## Next Steps

1. Finalize modal interaction patterns (sign-in, sync menu).
2. Design status dot color states and transitions.
3. Plan event listener wiring (db:mutated → dirty state → UI update).
4. Create detailed task breakdown in Phase 23.1 PLAN.md.

---

*Research completed: 2026-03-12*
