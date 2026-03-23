# Phase 25: Sync Visibility (Dirty State & Error Handling) - PLAN

**Created:** 2026-03-12  
**Phase Goal:** Improve user awareness of sync status and failures through enhanced error tracking, visual indicators, and persistent notifications.

---

## 1. PHASE OBJECTIVE

### Goal Statement
Complete the error handling narrative initiated in Phase 23.1 by introducing persistent error state tracking, visual RED status indicators, and a global notification system with local export fallback options.

### Success Outcomes
- ✅ Users see RED indicator when cloud sync fails
- ✅ Error state persists across page reloads
- ✅ Error notifications provide "Export Fallback" button when cloud sync fails
- ✅ Visual consistency: Status dot reflects 3 states (🟢 synced, 🟡 dirty, 🔴 error)
- ✅ Notification stacking works correctly on rapid sync attempts
- ✅ All manual tests pass without regression

### Impact
- Reduces user confusion when cloud sync fails
- Enables manual backup workflow when cloud is unavailable
- Improves visibility of sync problems vs. successful operations

---

## 2. TASK BREAKDOWN

### Task 25.1: Enhance Dirty State & Implement Error State Tracking

**Objective:** Add persistent error state tracking alongside existing dirty state tracking (localStorage keys for error message/timestamp).

**Current State (Phase 23.1):**
- ✅ Dexie hooks mark `_isDirty` on creates/updates/deletes
- ✅ localStorage key `budget_cloud_is_dirty` persists state
- ✅ Status indicator reflects dirty/synced states
- ✅ Error handling exists but is transient (only alertWithHaptic)

**What's Needed:**
1. Add error state fields: `_lastError`, `_errorDismissed`
2. Add localStorage keys: `budget_cloud_last_error`, `budget_cloud_last_error_time`
3. Load error state from localStorage on app init
4. Save error state on push failure
5. Clear error state on successful push
6. Update state transitions to reflect error flow

**Files Modified:**
- `src/ui/cloud-sync.js` (enhance _initDirtyStateTracking, add error methods, update push/pull handlers)
- `src/ui/cloud-sync.test.js` (add error state tests)

**Subtasks:**
1. Add error state fields and localStorage keys to cloudSyncUI module
2. Create `_loadErrorState()` method to restore error state from localStorage on init
3. Create `_saveErrorState()` method to persist error to localStorage
4. Create `_clearErrorState()` method to clean up error state
5. Update push flow to catch errors and save error state
6. Update pull flow to clear error state on success
7. Add unit tests for error state persistence and transitions

**Estimated LOC:** 80-120 lines (code + tests)

**Verification Steps:**
- [ ] Error state saved to localStorage on push failure
- [ ] Error state loaded from localStorage on app reload
- [ ] Error state cleared on successful push
- [ ] Status indicator updates to RED when error occurs

---

### Task 25.2: Enhance Visual Status Indicator with ERROR State

**Objective:** Update the status indicator to show RED state for errors, with tooltips and proper state transitions.

**Current State (Phase 23.1):**
- ✅ Status indicator exists (green/yellow/red with pulse)
- ✅ Updates on sync success
- ⚠️ RED state not fully implemented for persistent errors

**What's Needed:**
1. Update `_updateStatusIndicator()` to check error state first (RED > Yellow > Green priority)
2. Add error message to tooltip on RED state
3. Visual distinction: Red = persistent error, Yellow = unsaved changes
4. Proper color and styling for each state
5. Tooltip text varies by state

**Files Modified:**
- `src/ui/cloud-sync.js` (enhance _updateStatusIndicator)
- `index.html` or CSS file (ensure tooltip styling if needed)

**Subtasks:**
1. Update _updateStatusIndicator() logic to check error state first
2. Add tooltip with error message when error state exists
3. Apply correct styling per state:
   - 🔴 Red (#ef4444) - Error, persistent until sync success
   - 🟡 Yellow (#eab308) - Dirty, pulsing animation
   - 🟢 Green (#22c55e) - Synced, no animation
4. Ensure status indicator updates when error state changes (via event or direct call)
5. Add CSS for error tooltip styling if needed
6. Add unit tests for indicator state logic

**Estimated LOC:** 50-80 lines

**Verification Steps:**
- [ ] Dot shows RED when error state exists
- [ ] Tooltip shows error message on RED state
- [ ] Dot shows YELLOW when dirty (no error)
- [ ] Dot shows GREEN when synced (no error or dirty)
- [ ] Visual hierarchy: error > dirty > synced

---

### Task 25.3: Create Global Notification System & Error Fallback

**Objective:** Build a global, stackable notification system with support for actions (buttons) and auto-dismiss behavior. Integrate into push/pull error flows.

**Current State:**
- ✅ alertWithHaptic() exists for transient alerts
- ✅ modalUI exists for blocking modals
- ❌ No global toast/notification system
- ❌ No "Export Fallback" button for cloud errors

**What's Needed:**
1. Create `src/ui/notifications.js` with notificationUI module
2. Implement container with fixed positioning (top-right, z-index 1000)
3. Implement show() method with message, level, actions array, duration
4. Add convenience methods: success(), error(), warning()
5. Support multiple notifications stacking
6. Add animations: slideIn (0.3s), slideOut (0.3s)
7. Initialize notificationUI in app.js
8. Wire error flows in cloud-sync.js to use notificationUI.error() instead of alertWithHaptic()

**Files Created:**
- `src/ui/notifications.js` (new, ~220 lines)

**Files Modified:**
- `src/app.js` (initialize notificationUI, import it)
- `src/ui/cloud-sync.js` (use notificationUI for error notifications)
- `src/ui/cloud-sync.test.js` (mock notificationUI in tests if needed)
- `src/styles.css` or main CSS (add notification styling + animations)

**Subtasks:**
1. Create notifications.js with notificationUI module
2. Implement container DOM setup in init()
3. Implement show(message, level, actions, duration) method
4. Add styling for success/warning/error/info levels
5. Add slideIn/slideOut animations
6. Add convenience methods (success, error, warning)
7. Implement action button rendering and onClick handling
8. Add button styling for notification actions
9. Update cloud-sync.js push error handler to use notificationUI.error()
10. Add "Export Fallback" button in push error notification
11. Add "Retry Push" button in push error notification
12. Add "Dismiss" button to acknowledge error
13. Initialize notificationUI in app.js on startup
14. Add tests for notification rendering and dismissal
15. Add CSS keyframes for slideIn/slideOut animations

**Estimated LOC:** 300-400 lines (new file + modifications + CSS)

**Verification Steps:**
- [ ] Notification container renders in fixed position (top-right)
- [ ] Success notifications show green background, auto-dismiss in 2s
- [ ] Error notifications show red background, persist until dismissed
- [ ] Multiple notifications stack vertically with gap
- [ ] "Export Fallback" button in error notification triggers export
- [ ] "Retry" button re-opens sync menu
- [ ] "Dismiss" button acknowledges error and hides notification
- [ ] Notifications have slideIn/slideOut animation
- [ ] Button clicks are responsive and functional

---

## 3. EXECUTION ORDER & DEPENDENCY GRAPH

### Dependency Analysis

```
Task 25.1: Error State Tracking
├─ Load/save error state to localStorage
├─ No external dependencies (only cloud-sync.js internals)
└─ Can run independently (Wave 1)

Task 25.2: Visual Indicator Enhancement
├─ Depends on: Task 25.1 (needs _lastError field to check)
├─ Modifies: _updateStatusIndicator() logic
└─ Should run after Task 25.1 (Wave 2)

Task 25.3: Notification System
├─ Depends on: Task 25.1 (uses error state from cloud-sync)
├─ Can run in parallel with Task 25.2 (different subsystems)
├─ Task 25.1 creates error state, Task 25.3 displays it
└─ Final wiring depends on Task 25.1 (Wave 2, parallel with 25.2)
```

### Wave Structure (Parallel Execution)

**Wave 1: Foundation (Error State Tracking)**
- Task 25.1: Implement error state tracking and localStorage persistence
  - This forms the foundation for visual and notification changes
  - Can be tested independently with unit tests
  - ~60 minutes execution

**Wave 2: Presentation & Integration (Parallel)**
- Task 25.2: Enhance visual indicator to show error state
  - Uses error state from Task 25.1
  - Can start immediately after 25.1 completes
  - ~40 minutes execution

- Task 25.3: Create notification system + wire error flows
  - Creates new notification infrastructure
  - Integrates with error state from Task 25.1
  - Can run in parallel with Task 25.2
  - ~90 minutes execution

**Wave 3: Integration & Testing (Manual Verification)**
- Checkpoint: Manual UAT of complete flow (push failure → red dot + error notification + export button)
- ~20 minutes verification

### Critical Path

```
25.1 (60 min) → 25.2 (40 min) + 25.3 (90 min) → Checkpoint (20 min)
                        └─ Total: ~170 minutes (2.8 hours critical path)
```

**Parallelization:** Tasks 25.2 and 25.3 run in parallel after 25.1, reducing total time from 190 min to ~170 min.

**Key Dependency:** Both 25.2 and 25.3 depend on Task 25.1 completing successfully. Task 25.1 must establish error state tracking before visual or notification features can consume it.

---

## 4. FILE CHANGES MAP

### Overview

| Phase | File | Change Type | Subtasks | Est. LOC |
|-------|------|-------------|----------|---------|
| 25.1 | src/ui/cloud-sync.js | Enhance | Add error tracking fields, methods, and state management | +80 |
| 25.1 | src/ui/cloud-sync.test.js | Enhance | Add error state tests | +40 |
| 25.2 | src/ui/cloud-sync.js | Enhance | Update _updateStatusIndicator() | +40 |
| 25.2 | src/styles.css | Enhance | Add tooltip styling (if new) | +20 |
| 25.3 | src/ui/notifications.js | Create | New notification system module | +220 |
| 25.3 | src/app.js | Enhance | Initialize notificationUI | +5 |
| 25.3 | src/ui/cloud-sync.js | Enhance | Wire error notifications | +60 |
| 25.3 | src/styles.css | Enhance | Add notification styling + animations | +100 |
| 25.3 | src/ui/cloud-sync.test.js | Enhance | Add notification mocking | +30 |

**Total:** 8 files (1 new, 7 modified, 2 created CSS sections)

### Detailed File Changes

#### src/ui/cloud-sync.js (Wave 1 + 2 + 3)

**Wave 1 (Task 25.1) Changes:**
- Add module-level constants for localStorage keys
  - `const CLOUD_LAST_ERROR_KEY = 'budget_cloud_last_error'`
  - `const CLOUD_LAST_ERROR_TIME_KEY = 'budget_cloud_last_error_time'`

- Add error state fields to cloudSyncUI object
  - `_lastError: null` ({ message, code, timestamp })
  - `_errorDismissed: false`

- Create `_loadErrorState()` method
  - Reads localStorage keys on init
  - Restores _lastError and _errorDismissed
  - Called from init flow

- Create `_saveErrorState()` method
  - Writes _lastError to localStorage
  - Writes timestamp to localStorage
  - Called after error occurs

- Create `_clearErrorState()` method
  - Removes error from memory and localStorage
  - Sets _errorDismissed to false
  - Called after successful sync

- Update `_initCloudSync()` or init handler
  - Call `_loadErrorState()` after dirty state load

- Update push error handler
  - Catch block saves error state via `_saveErrorState()`
  - Stores error.message, error.code, timestamp

- Update pull/push success handlers
  - Call `_clearErrorState()` on success

**Wave 2 (Task 25.2) Changes:**
- Update `_updateStatusIndicator()` method
  - Check error state first (priority: error > dirty > synced)
  - Set red (#ef4444) if error
  - Set yellow (#eab308) with pulse if dirty (no error)
  - Set green (#22c55e) if synced (no error/dirty)
  - Add tooltip with error message

**Wave 3 (Task 25.3) Changes:**
- Import `notificationUI` from notifications.js
- Update push error handler
  - Call `notificationUI.error()` instead of/in addition to alertWithHaptic()
  - Pass actions array with "Export Fallback", "Retry", "Dismiss" buttons
  - Handle button clicks via onClick callbacks

#### src/ui/cloud-sync.test.js (Wave 1 + 3)

**Wave 1 (Task 25.1) Changes:**
- Add test: "Error state persists to localStorage"
  - Mock error, call _saveErrorState(), verify localStorage
- Add test: "Error state loads on init"
  - Set localStorage, call _loadErrorState(), verify _lastError
- Add test: "Error state cleared on successful push"
  - Set error, call _clearErrorState(), verify localStorage and memory

**Wave 3 (Task 25.3) Changes:**
- Mock notificationUI in test setup
- Add test: "Push error triggers notification"
  - Verify notificationUI.error() called with correct message and actions

#### src/ui/notifications.js (Wave 3 - New File)

**File Structure:**

```javascript
/**
 * Global notification system for displaying user-facing messages
 * Supports stacking, auto-dismiss, and action buttons
 */

export const notificationUI = {
  _queue: [],
  _container: null,

  /**
   * Initialize notification container in DOM
   * Call once on app startup via app.js
   */
  init() { ... }

  /**
   * Show a notification with optional actions
   * @param {string} message - Main message text
   * @param {string} level - 'success' | 'warning' | 'error' | 'info'
   * @param {Array<{label, onClick}>} actions - Action buttons
   * @param {number|null} duration - Auto-dismiss ms (null = manual only)
   * @returns {HTMLElement} notification element (for testing)
   */
  show(message, level = 'info', actions = [], duration = null) { ... }

  /**
   * Convenience methods for common notification types
   */
  success(message, duration = 2000) { ... }
  error(message, actions = [], duration = null) { ... }
  warning(message, duration = null) { ... }
  info(message, duration = 5000) { ... }

  /**
   * Internal methods
   */
  _bgColor(level) { ... }
  _textColor(level) { ... }
  _borderColor(level) { ... }
  _remove(element) { ... }
}
```

**Key Features:**
- Container positioned fixed, top-right, z-index 1000
- Support for success (2s auto-dismiss), error/warning (persistent), actions
- Notifications have pointer-events: none container, pointer-events: all for individual notifications
- Action buttons trigger onClick callback then dismiss notification
- slideIn animation (0.3s ease-out), slideOut animation (0.3s ease-in)
- Color scheme: success=#dcfce7 (light green), error=#fee2e2 (light red), warning=#fef3c7 (light yellow)

#### src/app.js (Wave 3)

**Changes:**
- Import `notificationUI` from './ui/notifications.js'
- Call `notificationUI.init()` on app startup (early, before other UI modules)
- Add comment: "Initialize global notification system for sync errors"

#### src/styles.css (Wave 2 + 3)

**Wave 2 (Task 25.2) Changes:**
- Add tooltip styling if not present
  - `[title]` selector or `.tooltip` class
  - Dark background, white text, small font
  - Position absolute or use browser default

**Wave 3 (Task 25.3) Changes:**
- Add notification container styling
  ```css
  #notificationContainer {
    position: fixed;
    top: 80px;
    right: 20px;
    left: auto;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 400px;
    pointer-events: none;
  }
  ```

- Add notification element styling
  ```css
  .notification {
    background: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    padding: 12px 16px;
    border-radius: 8px;
    pointer-events: all;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .notification-success { --bg-color: #dcfce7; --text-color: #166534; --border-color: #86efac; }
  .notification-error { --bg-color: #fee2e2; --text-color: #991b1b; --border-color: #fca5a5; }
  .notification-warning { --bg-color: #fef3c7; --text-color: #92400e; --border-color: #fcd34d; }
  .notification-info { --bg-color: #f3f4f6; --text-color: #374151; --border-color: #d1d5db; }
  ```

- Add button styling within notifications
  ```css
  .notification button {
    padding: 6px 12px;
    border: 1px solid currentColor;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .notification button:hover {
    background: rgba(0, 0, 0, 0.1);
  }
  ```

- Add animations
  ```css
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
  ```

---

## 5. GIT COMMIT STRATEGY

### Atomic Commits (One Logical Change Per Commit)

Commits should be small, focused, and reversible. Each commit should compile and pass tests.

#### Wave 1 Commits (Task 25.1)

```
Commit 1: feat(25.1): add error state tracking to localStorage
- Add CLOUD_LAST_ERROR_KEY and CLOUD_LAST_ERROR_TIME_KEY constants
- Add _lastError and _errorDismissed fields to cloudSyncUI
- Create _saveErrorState() and _loadErrorState() methods
- [Files: src/ui/cloud-sync.js]

Commit 2: feat(25.1): enhance push/pull handlers with error state management
- Update _cloudPushBtn click handler to call _saveErrorState() on error
- Update pull handler to call _clearErrorState() on success
- Initialize error state on app load via _loadErrorState()
- [Files: src/ui/cloud-sync.js]

Commit 3: test(25.1): add unit tests for error state persistence
- Test _saveErrorState() persists to localStorage
- Test _loadErrorState() restores from localStorage
- Test _clearErrorState() removes state
- [Files: src/ui/cloud-sync.test.js]
```

#### Wave 2 Commits (Task 25.2)

```
Commit 4: feat(25.2): enhance status indicator with error state
- Update _updateStatusIndicator() to show red for errors
- Add error message tooltip
- Apply color priority: error > dirty > synced
- [Files: src/ui/cloud-sync.js]

Commit 5: style(25.2): add tooltip styling for error state
- Add CSS for tooltip display when error occurs
- Ensure readability and positioning
- [Files: src/styles.css]

Commit 6: test(25.2): add tests for status indicator error state
- Test indicator shows red when error state exists
- Test indicator shows yellow when dirty (no error)
- Test indicator shows green when synced
- [Files: src/ui/cloud-sync.test.js]
```

#### Wave 3 Commits (Task 25.3)

```
Commit 7: feat(25.3): create global notification system
- Create src/ui/notifications.js with notificationUI module
- Implement init(), show(), and convenience methods
- Support stacking and auto-dismiss
- [Files: src/ui/notifications.js]

Commit 8: style(25.3): add notification styling and animations
- Add notification container positioning and z-index
- Add notification element styling per level (success/error/warning/info)
- Add button styling within notifications
- Add slideIn/slideOut animations
- [Files: src/styles.css]

Commit 9: feat(25.3): initialize notification system on app startup
- Import notificationUI in app.js
- Call notificationUI.init() on startup
- Add comment explaining global notification system
- [Files: src/app.js]

Commit 10: feat(25.3): wire error notifications into cloud sync flow
- Update push error handler to use notificationUI.error()
- Add "Export Fallback", "Retry", "Dismiss" actions
- Handle button clicks via onClick callbacks
- Remove or reduce alertWithHaptic() for errors
- [Files: src/ui/cloud-sync.js]

Commit 11: test(25.3): add tests for notification integration
- Mock notificationUI in cloud-sync tests
- Test push error triggers notification
- Test action buttons work (export, retry, dismiss)
- [Files: src/ui/cloud-sync.test.js]
```

### Commit Message Format

Follow conventional commits:
- `feat(XX.Y): description` - New feature
- `fix(XX.Y): description` - Bug fix
- `test(XX.Y): description` - Tests only
- `style(XX.Y): description` - CSS/styling only
- `refactor(XX.Y): description` - Code restructuring
- `docs(XX.Y): description` - Documentation only

Each message should include the phase number (25) and task number (1, 2, 3).

---

## 6. TESTING STRATEGY

### Wave 0: Unit Test Scaffolding (Before Implementation)

Before writing any feature code, ensure test files exist and basic structure is in place:

**Tests to Create (TDD style - write tests first, implement after RED phase):**

1. `src/ui/cloud-sync.test.js` - Error state tests
   - `test('_saveErrorState saves error to localStorage')`
   - `test('_loadErrorState restores error from localStorage')`
   - `test('_clearErrorState removes error state')`
   - `test('_updateStatusIndicator shows red for error state')`

2. `src/ui/notifications.test.js` - Notification system tests (NEW)
   - `test('notificationUI.init creates container')`
   - `test('notificationUI.show adds notification to container')`
   - `test('notificationUI.error shows red notification')`
   - `test('notificationUI.show with duration auto-dismisses')`
   - `test('notification action button triggers onClick and dismisses')`
   - `test('multiple notifications stack vertically')`

3. `src/ui/cloud-sync.integration.test.js` - Integration tests (NEW or extend existing)
   - `test('push error triggers error notification')`
   - `test('error notification has export fallback button')`

### Wave 1-3: Manual Testing During Implementation

**Step 1: Unit Tests (Red → Green → Refactor)**
- Run tests after each commit
- Ensure all tests pass before moving to next commit
- Command: `npm test -- --run` or `npm test` (watch mode during dev)

**Step 2: Manual Local Testing**
- Open app in browser (local dev)
- Sign in to cloud (if configured)
- Make a change (e.g., add/edit a transaction)
- Verify status dot shows 🟡 (yellow, dirty)
- Trigger push (via Sync menu)
- Verify success → status dot 🟢 (green)

**Step 3: Simulate Failure (Network Error)
- Test error handling by mocking a network failure:
  - Temporarily modify push endpoint to invalid URL
  - Or use browser's network throttling to timeout
  - Trigger push
  - Verify status dot shows 🔴 (red)
  - Verify error notification appears in top-right
  - Verify notification has "Export Fallback", "Retry", "Dismiss" buttons

**Step 4: Test Export Fallback Button**
- From error notification, click "Export Fallback"
- Verify export dialog opens (existing export functionality)
- Verify user can download backup file

**Step 5: Test Retry Button**
- Fix network issue (restore valid endpoint)
- From error notification, click "Retry"
- Verify push is attempted again
- Verify success → status dot 🟢, notification dismisses

**Step 6: Test Dismiss Button**
- Trigger error again
- Click "Dismiss"
- Verify notification closes
- Verify status dot stays 🔴 (error persists until sync succeeds)
- Refresh page
- Verify status dot is still 🔴 (error state persists across reload)

**Step 7: Test Error Clears on Success**
- After previous step, fix network and trigger push again
- Verify push succeeds
- Verify status dot becomes 🟢
- Verify error notification clears
- Verify localStorage error keys are removed

### Wave 4: Automated Testing (Jest/Vitest)

After manual testing confirms functionality:

```bash
npm test -- --run
```

All tests must pass: 
- Unit tests for error state operations
- Unit tests for notification rendering
- Integration tests for push error flow
- No regressions in existing tests

**Target Coverage:**
- cloud-sync.js error state methods: 100% (high criticality)
- notifications.js: 90%+ (new code)
- Integration points: 80%+

---

## 7. SUCCESS CRITERIA

### Functional Requirements

- [ ] **Error state persists:** 
  - After push fails, status dot is 🔴 (red)
  - After page reload, status dot is still 🔴
  - Error message is visible in localStorage (`budget_cloud_last_error`)

- [ ] **Visual indicator priority:**
  - 🔴 Red (error) shows when any error state exists
  - 🟡 Yellow (dirty) shows only when no error and unsaved changes
  - 🟢 Green (synced) shows when no error and all changes synced

- [ ] **Notification system works:**
  - Notifications appear in fixed container (top-right)
  - Success notifications auto-dismiss in 2-3 seconds
  - Error notifications persist until dismissed
  - Multiple notifications stack vertically with 10px gap

- [ ] **Error notification has actions:**
  - "Export Fallback" button triggers export dialog
  - "Retry" button re-opens sync modal or retries push
  - "Dismiss" button closes notification but keeps red status dot

- [ ] **Error state clears on success:**
  - After successful push, status dot becomes 🟢 (green)
  - Error notification dismisses
  - localStorage error keys are removed
  - _lastError is set to null

### Non-Functional Requirements

- [ ] **No breaking changes:** All existing tests pass
- [ ] **Performance:** Notification rendering < 50ms
- [ ] **Accessibility:** Error messages readable, semantic HTML
- [ ] **Browser compatibility:** Chrome, Firefox, Safari, Edge (latest 2 versions)

### Verification Checklist

**Pre-Launch:**
- [ ] All unit tests pass (`npm test -- --run`)
- [ ] Manual tests completed (Steps 1-7 above)
- [ ] No console errors or warnings
- [ ] localStorage keys are clean and properly scoped
- [ ] Git commits are atomic and well-formatted

**Post-Launch (UAT):**
- [ ] Red indicator appears on cloud sync failure
- [ ] Error notification includes actionable buttons
- [ ] Export fallback works when cloud fails
- [ ] Retry button successfully resumes sync
- [ ] Error state persists across page reload
- [ ] No regressions in existing sync functionality

---

## 8. RISK MITIGATION

### Risk 1: Multiple Concurrent Sync Attempts Causing Notification Spam

**Risk:** User clicks "Push" multiple times rapidly → multiple error notifications stack → confusing.

**Mitigation:**
- `_syncInProgress` flag already prevents re-entry (Phase 23.1)
- Sync menu modal is disabled during sync (button unavailable)
- If multiple errors occur, ensure only latest error is shown:
  - Clear previous error notifications before showing new one
  - Or only show one error notification at a time (dismiss old first)

**Implementation:**
```javascript
// Before calling notificationUI.error(), dismiss any existing error notification
if (this._errorNotificationElement) {
  this._errorNotificationElement.remove();
}
this._errorNotificationElement = notificationUI.error(message, actions);
```

**Testing:** Click push 3 times rapidly, verify only one error notification appears.

---

### Risk 2: Error State Not Clearing on Successful Sync

**Risk:** User's local error state gets out of sync with actual cloud state. Error persists even though push succeeded.

**Mitigation:**
- Explicitly call `_clearErrorState()` in push success handler
- Call `_clearErrorState()` in pull success handler too (for completeness)
- Verify localStorage keys are removed after success
- Add assertion in tests to ensure error state is cleared

**Implementation:**
```javascript
// In push success handler
if (pushSuccess) {
  this._clearErrorState();
  localStorage.removeItem(CLOUD_LAST_ERROR_KEY);
  localStorage.removeItem(CLOUD_LAST_ERROR_TIME_KEY);
  this._isDirty = this._mutationsDuringSync;
  // ... rest of success logic
}
```

**Testing:** Trigger error, fix issue, retry push, verify localStorage keys are gone.

---

### Risk 3: Notification Container Blocking UI Elements

**Risk:** Fixed notification container positioned top-right with high z-index (1000) could block/cover other UI elements.

**Mitigation:**
- Position notifications at `top: 80px` (below header)
- Position at `right: 20px` to avoid covering sync buttons
- Set `max-width: 400px` to prevent excessive width
- Use `pointer-events: none` on container, `pointer-events: all` on individual notifications
- Test with various notification widths/lengths

**Testing:** 
- Open notification container
- Verify header and other UI elements are not covered
- Verify buttons behind notification are not clickable
- Verify buttons in notification are clickable

---

### Risk 4: Error Message Contains Sensitive Information

**Risk:** Error messages from Supabase or network layer might leak API keys, passwords, or internal URLs.

**Mitigation:**
- Sanitize error messages before displaying to user
- Log full error server-side only
- Show user-friendly message, not raw error.message
- Use error.code to classify errors (NETWORK_ERROR, AUTH_ERROR, etc.)

**Implementation:**
```javascript
const userFriendlyMessage = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet.',
  AUTH_ERROR: 'Authentication failed. Please sign in again.',
  UNKNOWN_ERROR: 'Sync failed. Please try again.'
}[error.code] || 'Sync failed. Please try again.';

notificationUI.error(userFriendlyMessage, [...]);
```

**Testing:** Trigger various error types, verify messages are user-friendly.

---

### Risk 5: Notification Styling Conflicts with Existing CSS

**Risk:** New notification CSS might conflict with existing Tailwind, modal styles, or app theme.

**Mitigation:**
- Use specific selectors (#notificationContainer, .notification)
- Avoid generic selectors that might conflict
- Add `!important` only if necessary (prefer specificity)
- Test notification rendering alongside existing modals and UI
- Check for z-index conflicts (ensure notifications are always visible)

**Testing:**
- Open notification while sync modal is open
- Verify notification is visible above modal
- Open notification while other elements are on screen
- Verify no visual overlap issues

---

### Risk 6: Error State Lost on Browser Storage Clear

**Risk:** User clears browser storage → error state is lost → visual inconsistency.

**Mitigation:**
- This is acceptable behavior (user intentionally cleared data)
- Document that clearing storage resets error state
- On next sync attempt, error state will be re-established if needed
- No action needed

---

### Risk 7: "Export Fallback" Button Visible But Export Not Working

**Risk:** Error notification shows "Export Fallback" button, but export functionality is broken or unavailable.

**Mitigation:**
- Ensure export function is tested and working (Phase 23.2 prerequisite)
- Export button should be available regardless of cloud state
- Test export flow works when clicked from error notification
- Add fallback message if export is unavailable ("Local export not available")

**Testing:**
- Trigger push error
- Click "Export Fallback"
- Verify export dialog opens and works

---

### Risk 8: Memory Leak: Error Notification Element Not Cleaned Up

**Risk:** If notification elements are not properly removed from DOM, could cause memory leak on long-running app.

**Mitigation:**
- Call `_remove(element)` which removes from DOM and clears animation
- Use timeout to ensure animation completes before element removal
- Test with browser dev tools memory profiler after many notifications

**Implementation (already in notifications.js):**
```javascript
_remove(el) {
  el.style.animation = 'slideOut 0.3s ease-in';
  setTimeout(() => el.remove(), 300);  // Remove after animation
}
```

**Testing:** Open and close notifications 20+ times, check memory usage doesn't spike.

---

### Rollback Plan

If Phase 25 introduces regressions:

1. **Revert commits in reverse order:**
   ```bash
   git revert HEAD~11..HEAD  # Revert all 11 Phase 25 commits
   git push origin main
   ```

2. **Quick Rollback (immediate fix):**
   - Remove notification imports from app.js
   - Undo push error handler changes to use alertWithHaptic only
   - Revert cloud-sync.js to Phase 24 state
   - Commit as `fix(25): revert to Phase 24 due to regressions`

3. **Recovery Path:**
   - Identify regression source from test failures
   - Fix in isolated commit
   - Re-test before re-landing
   - Consider breaking into smaller phases if too complex

---

## 9. PHASE SUMMARY

### What We're Building

A complete error visibility and fallback system that:
1. **Tracks** error state persistently via localStorage
2. **Shows** error status via visual RED indicator in header
3. **Notifies** users with persistent Toast notifications including export fallback option
4. **Allows** retry or manual backup when cloud sync fails

### Key Assumptions

- Phase 23.1 (dirty state tracking) is complete and working
- Phase 23.2 (header consolidation) is complete
- Export functionality exists and works (Phase 23.2)
- Browser localStorage is available and functional
- Dexie mutation hooks are properly attached (Phase 23.1)

### Success Indicators

- ✅ All tests pass
- ✅ Manual UAT passes all steps
- ✅ No regressions in existing functionality
- ✅ Error state persists across reloads
- ✅ Visual hierarchy: error > dirty > synced
- ✅ Notification system available for future use cases

### Next Phase

Phase 26 will conduct end-to-end testing and performance audit across all cloud sync features.

---

**Plan Created:** 2026-03-12  
**Created By:** GSD Planner (v4 - Phase 25 executable plan)  
**Status:** Ready for execution
