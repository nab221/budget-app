# Phase 24 Plan: Intelligent Sync Logic (Auto-Pull & Auto-Push)

## Objective
Implement roadmap Phase 24 for milestone v2.7 by automating key cloud sync checkpoints while preserving the existing preview-confirm pull safety flow.

## Scope (from ROADMAP)
- Task 24.1: Auto-pull check on app load; prompt if cloud is newer.
- Task 24.2: Auto-push on exit via `visibilitychange`.
- Task 24.3: Auto-trigger `pullSnapshot` after successful magic link sign-in.

## Implementation Plan

### 1) Add metadata read helper
- File: `src/utils/supabase-sync.js`
- Add `getLatestSnapshotMeta()` to query latest `updated_at` + `schema_version` for current user.
- Keep existing signed-in/config guards and `maybeSingle()` no-row behavior.

### 2) Add startup auto-pull check
- File: `src/ui/cloud-sync.js`
- In `init()`, run one guarded `_runAutoPullCheckOnLoad()`.
- Compare cloud `updated_at` with local `budget_cloud_last_sync`.
- If cloud is newer (or local missing), call `pullSnapshot()` so existing preview modal prompts user before import.

### 3) Add auto-push on app exit
- File: `src/ui/cloud-sync.js`
- Bind `visibilitychange` once via `_bindVisibilityAutoPush()`.
- On hidden, run `_autoPushOnExit()` only when dirty + signed in + not already syncing.

### 4) Add post-auth auto-pull
- File: `src/ui/cloud-sync.js`
- Extend auth listener to react to `SIGNED_IN`/`INITIAL_SESSION`.
- Trigger `_runAutoPullAfterSignIn(session)` and de-duplicate per user/session.

### 5) Add/extend tests
- Files:
  - `src/utils/supabase-sync.test.js`
  - `src/ui/cloud-sync.test.js`
- Cover metadata helper success/null/error, startup recency check behavior, visibility auto-push guards, and auth-event dedupe.

## Verification Steps
- Targeted tests:
  - `npm test -- src/utils/supabase-sync.test.js src/ui/cloud-sync.test.js --run`
- Full suite:
  - `npm test -- --run`

## Completion Record
- **Status:** ✅ Completed
- **Completed on:** 2026-03-12
- **Implementation commit:** `2c947db`
- **Verification artifact:** `.planning/phases/24-intelligent-sync-logic/24-VERIFICATION.md`
