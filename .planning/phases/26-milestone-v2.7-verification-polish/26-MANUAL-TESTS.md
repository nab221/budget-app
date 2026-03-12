# Phase 26 Manual Sync Test Protocol

**Phase:** 26 - Milestone v2.7 Verification & Polish
**Canonical plan:** `.planning/phases/26-milestone-v2.7-verification-polish/26-PLAN.md`
**Purpose:** Provide a repeatable cross-device simulation protocol for validating cloud sync behavior, failure handling, and UI signals before closing out v2.7.

## Legacy Artifact Note

Use this file and `.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md` as the canonical Phase 26 verification record.

Do not use `.planning/phases/26-PLAN.md` or `PHASE-26-VERIFICATION.md` as the source of truth for milestone v2.7 close-out. Those artifacts reflect an older documentation-alignment phase and are legacy/conflicting for this roadmap phase.

## Environment Setup

Run the app in two independent browser contexts against the same Supabase account:

- Device A: regular browser profile
- Device B: separate browser, profile, or private window
- Account: the same authenticated cloud-sync user on both contexts
- Build: current `feat/phase-26-verification-polish` branch
- Seed data: a known budget with at least one editable income/expense row

## Evidence Rules

- Record the browser and account used for each device.
- Capture the visible sync state before and after each scenario.
- Save at least one screenshot, console note, or timestamp excerpt per scenario.
- If a scenario fails, log the exact step, observed UI, and any sync notification text.

## Expected UI Markers

- `syncStatusDot` colors:
  - green: synced
  - yellow + pulse: dirty/pending local changes
  - red: cloud sync error
- `lastSyncedTime` updates after successful push/pull flows
- Sync buttons enter a disabled loading state with `aria-busy="true"`
- Error notifications include retry and, for push failures, export-backup fallback actions

## Scenario Matrix

### 26.1-A Device A Push -> Device B Auto-Pull On Load

**Goal:** Confirm that a newer cloud snapshot is pulled automatically when a second device loads stale local state.

**Preconditions**

- Device A and Device B are signed in to the same cloud account.
- Device B has an older `budget_cloud_last_sync` value than Device A's next push.
- No modal is left open from a previous sync attempt.

**Steps**

1. On Device A, edit any budget value and confirm the status indicator turns dirty.
2. Trigger cloud push from the sync modal.
3. Confirm Device A returns to synced state and `Last synced` updates.
4. On Device B, reload the app.
5. Observe startup behavior without manually pressing Pull.

**Expected**

- Device A push succeeds with a success notification.
- Device B automatically pulls the newer snapshot during load.
- Device B ends in synced state without a persistent error.
- Updated budget values match Device A.

**Evidence**

- Device A before/after status:
- Device B load result:
- Screenshot or note:
- Pass/Fail:

### 26.1-B Local Newer Than Cloud -> No Auto-Pull

**Goal:** Confirm that the app does not overwrite newer local state when the cloud snapshot is older.

**Preconditions**

- Device B has a newer local edit than the last cloud snapshot.
- Device B remains dirty and has not pushed the local change.

**Steps**

1. On Device B, make a local change and do not push.
2. Ensure `syncStatusDot` shows dirty state.
3. Reload Device B.
4. Observe whether an automatic pull occurs.

**Expected**

- No auto-pull occurs.
- Local unsynced change remains visible after reload.
- Status remains dirty or returns to dirty after data load.
- No success notification for pull is shown.

**Evidence**

- Dirty indicator before reload:
- State after reload:
- Screenshot or note:
- Pass/Fail:

### 26.1-C Dirty Exit -> Auto-Push On Visibility Change

**Goal:** Confirm that leaving the page while dirty triggers background push behavior.

**Preconditions**

- Device A is signed in and online.
- Local data is dirty.

**Steps**

1. On Device A, make a local budget change.
2. Confirm the status indicator shows dirty state.
3. Switch tabs, minimize the browser, or otherwise trigger `document.visibilityState = hidden`.
4. Return to the app.
5. Optionally reload a second device to confirm cloud state updated.

**Expected**

- A background push is attempted when the document becomes hidden.
- On success, local dirty state clears and the status returns to synced.
- A second device can observe the updated data after reload/pull.

**Evidence**

- Action used to trigger `visibilitychange`:
- Status before leaving page:
- Status after returning:
- Second-device confirmation:
- Pass/Fail:

### 26.1-D Offline / Failure Path -> Error Persistence And Export Fallback

**Goal:** Confirm that sync failures remain visible and provide the expected recovery actions.

**Preconditions**

- Device A is signed in.
- Browser network can be disabled or Supabase can be made unreachable.

**Steps**

1. Disconnect the network on Device A.
2. Make a local budget change.
3. Attempt Push to Cloud from the sync modal.
4. Observe notification actions and header error state.
5. Restore connectivity.
6. Retry push from the notification action or modal.

**Expected**

- Failed push sets the header status to red.
- Error notification includes Retry and Export Backup actions.
- Error state persists until a later successful sync.
- After connectivity is restored and retry succeeds, the error clears and the app returns to synced.

**Evidence**

- Error message text:
- Notification actions shown:
- Status after reconnect and retry:
- Screenshot or note:
- Pass/Fail:

## Evidence Template

Copy this block into `.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md` for each manual run.

```md
## Manual Run

- Date:
- Branch:
- Build/command:
- Device A browser:
- Device B browser:
- Account used:

### Scenario Results

| Scenario | Result | Notes | Evidence |
| --- | --- | --- | --- |
| 26.1-A Device A Push -> Device B Auto-Pull On Load | | | |
| 26.1-B Local Newer Than Cloud -> No Auto-Pull | | | |
| 26.1-C Dirty Exit -> Auto-Push On Visibility Change | | | |
| 26.1-D Offline / Failure Path -> Error Persistence And Export Fallback | | | |

### Summary

- Overall result:
- Follow-up issues:
```