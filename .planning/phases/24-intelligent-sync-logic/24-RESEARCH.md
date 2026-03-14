# Phase 24: Intelligent Sync Logic (Auto-Pull & Auto-Push) - Research

**Researched:** 2026-03-12
**Domain:** Cloud sync orchestration (Supabase + UI lifecycle)
**Confidence:** HIGH

## User Constraints

### Locked Scope (from ROADMAP v2.7)
1. Auto-Pull check on app load; prompt user if cloud is newer.
2. Auto-Push on Exit via `visibilitychange` event.
3. Auto-trigger `pullSnapshot` after successful magic link sign-in.

### Out of Scope
- New UX systems (global toasts/notification framework).
- Dirty-state redesign (already implemented in Phase 23.1; formally listed under Phase 25 in roadmap text).
- Retry queues/background workers/offline sync engine.
- Any broad auth or data-model refactor.

## Findings

- `cloudSyncUI.init()` is the central startup hook and is already called during app bootstrap in `app.js`; this is the right place to add app-load auto-pull checks and lifecycle listeners.
- Current pull flow is preview-first: `pullSnapshot()` dispatches `budget:import-cloud-preview`, then `cloudSyncUI` asks for explicit confirmation before destructive import. This already satisfies the prompt part of Task 24.1 if triggered automatically.
- Current auth listener re-renders only (`onAuthStateChange(() => this._refreshSection())`); it does not auto-trigger pull after sign-in.
- `supabase-sync.js` currently has no lightweight metadata API to compare cloud `updated_at` against local `budget_cloud_last_sync` without triggering full preview/import.
- No `visibilitychange` listener currently exists in the app for cloud push behavior.

## Existing Behavior Summary

### Pull
- Manual pulls are triggered from cloud modal/buttons and call `pullSnapshot()`.
- `pullSnapshot()` fetches latest row from `budget_snapshots` and dispatches `budget:import-cloud-preview` with `updated_at`, `schema_version`, `counts`, and `tableData`.
- `cloudSyncUI._bindPreviewListener()` shows confirmation modal and only imports after explicit user click.

### Push
- Manual push calls `pushSnapshot()` which upserts user snapshot and writes local `budget_cloud_last_sync`.
- `cloudSyncUI` tracks dirty state (`budget_cloud_is_dirty`) and clears it after successful push.

### Sign-In
- Sign-in modal calls `signIn(email)` (magic link send).
- Completion of magic-link auth triggers Supabase auth state change listener, which currently only refreshes UI.

### Conflict/Guard Behavior
- Pull preview includes schema-version warning when cloud schema is newer than local Dexie schema.
- No cloud-vs-local timestamp comparison is run on app load today.

## Proposed Design (Minimal, Phase-24 only)

1. **Add metadata-only cloud check utility** in `supabase-sync.js` (e.g., `getLatestSnapshotMeta()` returning `{ updated_at, schema_version } | null`).
2. **App-load auto-pull check in `cloudSyncUI.init()`**:
   - Run only when configured + signed in.
   - Compare local `budget_cloud_last_sync` (ms) to cloud `updated_at` (ISO date).
   - If cloud is newer, prompt via existing pull-preview flow by calling `pullSnapshot()` (do not auto-import).
3. **Auto-push on exit** in `cloudSyncUI`:
   - Bind `visibilitychange` once.
   - When `document.visibilityState === 'hidden'` and `_isDirty` and signed in and not syncing, fire `pushSnapshot()` best-effort.
   - No new UI beyond optional existing `alertWithHaptic`/console logging suppression for background flow.
4. **Post-auth auto-pull** in `_bindAuthListener()`:
   - On sign-in-like events (`SIGNED_IN`, `INITIAL_SESSION` with session), trigger one guarded `pullSnapshot()` call.
   - Keep existing preview confirmation, avoiding forced destructive import.

## File-by-file Plan

### `src/utils/supabase-sync.js`
- Add `getLatestSnapshotMeta()` near `pullSnapshot()` helpers.
- Query same `budget_snapshots` table but select only `updated_at,schema_version` and return `null` when none.
- Reuse existing signed-in/config guards.

### `src/ui/cloud-sync.js`
- In `init()` (after `_bindAuthListener()` / before or after `_refreshSection()`), call new `_runAutoPullCheckOnLoad()` helper.
- Add `_bindVisibilityAutoPush()` and register it in `init()`.
- Update `_bindAuthListener()` to inspect auth event/session and trigger guarded post-auth pull.
- Add guard flags to prevent duplicate auto-pulls during startup/auth churn (e.g., `_hasAutoPulledThisSession`).

### `src/app.js`
- No required change; `cloudSyncUI.init()` is already wired during initialization.
- Optional comment-only clarification is unnecessary; avoid touching file unless needed.

### `src/utils/supabase-sync.test.js`
- Add tests for `getLatestSnapshotMeta()`:
  - returns metadata row when present.
  - returns `null` when no snapshot.
  - throws on supabase error.

### `src/ui/cloud-sync.test.js`
- Extend coverage for new auto behaviors with mocks:
  - app-load check calls pull when cloud timestamp is newer.
  - app-load check does not call pull when local is newer/equal.
  - visibility hidden + dirty triggers push.
  - visibility hidden + clean does not push.
  - auth state sign-in triggers pull once.

## Test Plan

- Run targeted: `npm test -- src/utils/supabase-sync.test.js src/ui/cloud-sync.test.js --run`
- Run focused full suite: `npm test -- --run`

### Edge Cases to Cover
- Not configured / signed out => no auto pull/push side effects.
- No cloud snapshot exists => app-load check should no-op (no error modal spam).
- Invalid or missing local last-sync timestamp => treat as stale and allow prompt.
- Visibility event fires during active sync => skip duplicate push.
- Multiple auth callbacks (`INITIAL_SESSION` + `SIGNED_IN`) => ensure single auto-pull.

## Risks / Scope Drift

- **Biggest drift risk:** introducing new notification or retry infrastructure (belongs to later phases).
- **Another drift risk:** auto-importing without confirmation; Phase 24 only requires prompt/check, not forced overwrite.
- **Potential accidental expansion:** changing dirty-state semantics or Dexie mutation hooks (already in place; avoid touching).
- **Legacy planning mismatch risk:** `.planning/phases/24-PLAN.md` currently documents older UAT phase naming; do not follow it for implementation scope—use roadmap v2.7 only.

## Phase Requirements Mapping

| ID | Requirement | Research Support |
|----|-------------|------------------|
| SYNC-BEH-01 | Auto-Pull prompt on app load | Add metadata compare + trigger existing preview-first pull flow |
| SYNC-BEH-02 | Auto-Push on visibility change | Add `visibilitychange` listener guarded by dirty/signed-in/sync state |
| SYNC-BEH-03 | Post-auth auto-pull | Extend auth listener to trigger guarded pull on sign-in completion |

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md` (Phase 24 tasks)
- `.planning/REQUIREMENTS.md` (SYNC-BEH-01/02/03)
- `src/ui/cloud-sync.js`
- `src/utils/supabase-sync.js`
- `src/app.js`
- `src/ui/cloud-sync.test.js`
- `src/utils/supabase-sync.test.js`
