# Phase 25: Sync Visibility (Dirty State & Error Handling) - Research

**Researched:** 2026-03-12  
**Domain:** Cloud sync UI/UX, error handling, state visibility  
**Confidence:** HIGH

## Summary

Phase 25 requires three coordinated features to improve user awareness of sync status: dirty state tracking, visual indicators, and error notifications with fallback options. *Most infrastructure is already in place from Phase 23.1*, making this phase primarily about **completing the error handling narrative** and **ensuring visual consistency**.

**Current State (Phase 23.1 complete):**
- ✅ Dirty state tracking exists (localStorage `budget_cloud_is_dirty`, Dexie hooks)
- ✅ Visual status dot indicator exists (green/yellow/red with pulse animation)
- ✅ Status indicator updates on sync success
- 🟡 Error handling exists but is **basic** (alertWithHaptic only, no persistent error state)
- ❌ No global notification system for sync failures
- ❌ No explicit "local export fallback" UI when cloud sync fails

**Primary recommendation:** Enhance Phase 23.1's foundation by:
1. Adding persistent error state tracking (like dirty state)
2. Creating a global notification/toast system for sync failures
3. Adding "Export Fallback" button when cloud operations fail
4. Improving error messages with user-actionable guidance

---

## User Constraints

(No CONTEXT.md exists for Phase 25; proceeding with Roadmap specifications)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| 25.1 | Implement "Dirty State" tracking (mark as dirty on Dexie writes, clear on push) | Already implemented in Phase 23.1; needs verification and enhancement |
| 25.2 | Add a visual indicator (dot/label) for the dirty state in the top bar | Already implemented in Phase 23.1; needs verification |
| 25.3 | Create a global notification system for sync failures with a local export fallback | Partial; needs notification infrastructure and error handling |

---

## Standard Stack

### Core Libraries (Already in Place)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Dexie | 4.0.11 | IndexedDB wrapper, mutation hooks | ✅ Active |
| @supabase/supabase-js | v2 | Cloud sync client | ✅ Active |
| modalUI | Custom | Modal/dialog rendering | ✅ Active |
| haptics | Custom (src/utils/haptics.js) | Haptic feedback + alertWithHaptic() | ✅ Active |
| localStorage | Native | Sync state persistence | ✅ Active |

### Supporting Libraries
| Library | Purpose | Current Usage |
|---------|---------|----------------|
| DOMPurify | XSS prevention in innerHTML | ✅ Used in render.js |
| RecurrenceManager | Auto-task generation | Not relevant to Phase 25 |

---

## Architecture Patterns

### Current Dirty State Implementation (Phase 23.1)

**Location:** `src/ui/cloud-sync.js` → `cloudSyncUI._initDirtyStateTracking()`

```javascript
// State tracking
_isDirty: false,
CLOUD_IS_DIRTY_KEY = 'budget_cloud_is_dirty'

// Dexie hooks on all tables
db.tables.forEach(table => {
  table.hook('creating', markDirty);
  table.hook('updating', markDirty);
  table.hook('deleting', markDirty);
});

// Mutation tracking during sync
_mutationsDuringSync: false
```

**How it works:**
1. On app load, load `CLOUD_IS_DIRTY_KEY` from localStorage
2. Any Dexie write (create/update/delete) calls `markDirty()`
3. If sync is in progress, mark `_mutationsDuringSync = true` instead
4. After successful push, set `_isDirty = _mutationsDuringSync` (if mutations occurred during sync)
5. Persist state to localStorage

**Status Indicator Update:**
```javascript
_updateStatusIndicator() {
  // Green (synced) → Yellow (dirty, pulse) → Red (error)
  const dot = document.getElementById('syncStatusDot');
  if (this._isDirty) {
    dot.style.background = '#eab308'; // Yellow
    dot.style.animation = 'pulse 1.5s infinite';
  } else {
    dot.style.background = '#22c55e'; // Green
  }
}
```

### Current Error Handling (Incomplete)

**Push Error Flow:**
```javascript
// In _showSyncMenuModal()
document.getElementById('_cloudPushBtn')?.addEventListener('click', async () => {
  try {
    await pushSnapshot();
    alertWithHaptic('Synced successfully!', 'success');
  } catch (err) {
    alertWithHaptic('Push failed: ' + err.message);
  }
});
```

**Issues:**
- Error message appears in a transient alert only
- No persistent error state (red dot)
- No "save locally as backup" fallback option
- Error only visible if user has modal open

### Notification System (Target Architecture)

Need to implement a **global toast/notification system**:

```
┌─────────────────────────────────────┐
│   Global Notification Container     │
├─────────────────────────────────────┤
│  ✅ Success message (2s auto-hide)  │
│  ⚠️  Warning message (persistent)   │
│  ❌ Error + [Export Fallback] btn    │
└─────────────────────────────────────┘
```

**Properties:**
- Location: Fixed/sticky in header or corner
- Stack: Multiple notifications can queue
- Auto-dismiss: Success (2-3s), others persistent until dismissed
- Accessibility: ARIA-live region for screen readers

### Local Export Fallback Pattern

When cloud push fails:

```
Cloud Push Error
├─ Error message (e.g., "Network timeout")
├─ [Export as Backup] button ← NEW
│  └─ Triggers: exportBackupData() from src/ui/backup.js
├─ [Retry Push] button
└─ [Dismiss] button
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-state notification UI | Custom toast component | Extend existing modalUI or build simple notification container with CSS positioning | Modals are proven; notifications are 50 LOC |
| Error persistence | Custom error object | localStorage key like `budget_cloud_last_error` + state field | Single source of truth pattern used across codebase |
| Export on demand | Custom export logic | `importBackupData()` from src/db/backup.js (inverse: trigger local export via exportBtn click) | Already battle-tested, handles encryption, validation |

---

## Common Pitfalls

### Pitfall 1: Error State Not Persisting Across Page Reload

**What goes wrong:** User sees error on desktop, closes modal, refreshes page. Error state is lost. User thinks issue is fixed.

**Why it happens:** Phase 23.1 only stores dirty state, not error state. Error is transient (alertWithHaptic only).

**How to avoid:**
- Add `CLOUD_LAST_ERROR_KEY` localStorage tracking
- Update status dot to RED when error occurs
- Update color only on successful sync or explicit dismiss
- Show error in header indicator (like dirty state)

**Warning signs:**
- Status dot immediately returns to green after error
- No indicator visible if user navigates away during sync error

### Pitfall 2: Notification System Flooding (Multiple Simultaneous Sync Attempts)

**What goes wrong:** User clicks "Push" multiple times rapidly → multiple alerts stack → confusing UI.

**Why it happens:** `_syncInProgress` flag protects against re-entry in code, but multiple error notifications can still queue.

**How to avoid:**
- Ensure `_syncInProgress` prevents modal button clicks (already done: `if (this._syncInProgress || !this._isDirty) return;`)
- When new notification appears, dismiss previous error notifications
- Show only latest error state

**Warning signs:**
- Multiple "Push failed" alerts visible simultaneously

### Pitfall 3: Export Button Hidden When Cloud Fails

**What goes wrong:** User's cloud push fails. They want to export as backup. Export button is hidden (because cloud is configured).

**Why it happens:** Phase 23.2 hides Export/Import buttons when cloud header is active. Error state doesn't toggle them back.

**How to avoid:**
- Show "Export Fallback" button inside error notification (not relying on main toolbar state)
- Alternatively: Show temporary export button overlay when error occurs

**Warning signs:**
- User unable to manually export after cloud failure

### Pitfall 4: "Last Synced" Timestamp Misleading After Error

**What goes wrong:** Cloud push fails. Timestamp still shows "5 min ago" (from last *successful* sync). User thinks current changes are synced.

**Why it happens:** `CLOUD_LAST_SYNC_KEY` is only updated on `pushSnapshot()` success. Timestamp display doesn't reflect current session's failed attempts.

**How to avoid:**
- Distinguish between "Last Successful Sync" and "Last Sync Attempt"
- Show error state visually (red dot) instead of relying on timestamp alone
- Consider showing "Sync failed 2 min ago" when error occurred

**Warning signs:**
- Timestamp doesn't change even though user tried and failed to sync

---

## Code Examples

### Example 1: Enhanced Dirty State with Error Tracking

**Current (Phase 23.1):**
```javascript
const CLOUD_IS_DIRTY_KEY = 'budget_cloud_is_dirty';
this._isDirty = false;
```

**Phase 25 Enhancement:**
```javascript
// State keys
const CLOUD_IS_DIRTY_KEY = 'budget_cloud_is_dirty';
const CLOUD_LAST_ERROR_KEY = 'budget_cloud_last_error';      // NEW
const CLOUD_LAST_ERROR_TIME_KEY = 'budget_cloud_last_error_time'; // NEW

// State fields
_isDirty: false,
_lastError: null,       // NEW: { message, code, timestamp }
_errorDismissed: false, // NEW
```

**Source:** GSD Phase 25 pattern (consistent with Phase 23.1's approach)

### Example 2: Status Indicator with Error State

**Current:**
```javascript
_updateStatusIndicator() {
  const dot = document.getElementById('syncStatusDot');
  if (this._isDirty) {
    dot.style.background = '#eab308'; // Yellow (dirty)
  } else {
    dot.style.background = '#22c55e'; // Green (synced)
  }
}
```

**Phase 25 Enhancement:**
```javascript
_updateStatusIndicator() {
  const dot = document.getElementById('syncStatusDot');
  
  // Red (error) > Yellow (dirty) > Green (synced)
  if (this._lastError && !this._errorDismissed) {
    dot.style.background = '#ef4444'; // Red (error)
    dot.title = `Sync failed: ${this._lastError.message}`;
  } else if (this._isDirty) {
    dot.style.background = '#eab308'; // Yellow (dirty)
    dot.style.animation = 'pulse 1.5s infinite';
    dot.title = 'Unsaved changes (click Sync to sync)';
  } else {
    dot.style.background = '#22c55e'; // Green (synced)
    dot.title = 'All changes saved to cloud';
  }
}
```

**Source:** Pattern derived from existing Phase 23.1 code structure

### Example 3: Notification System Container (New)

**Build location:** `src/ui/notifications.js` (new file)

```javascript
export const notificationUI = {
  _queue: [],
  _container: null,
  
  init() {
    this._container = document.createElement('div');
    this._container.id = 'notificationContainer';
    this._container.style.cssText = `
      position: fixed;
      top: 80px; right: 20px; left: auto;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
      pointer-events: none;
    `;
    document.body.appendChild(this._container);
  },

  /**
   * Show a notification with optional action buttons
   * @param {string} message - Main message text
   * @param {string} level - 'success' | 'warning' | 'error'
   * @param {object[]} actions - [{ label, onClick }, ...]
   * @param {number} duration - Auto-dismiss ms (null = manual only)
   */
  show(message, level = 'info', actions = [], duration = null) {
    const el = document.createElement('div');
    el.className = `notification notification-${level}`;
    el.style.cssText = `
      background: ${this._bgColor(level)};
      color: ${this._textColor(level)};
      border: 1px solid ${this._borderColor(level)};
      padding: 12px 16px;
      border-radius: 8px;
      pointer-events: all;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s ease-out;
    `;
    
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    el.appendChild(messageEl);
    
    if (actions.length > 0) {
      const buttonsEl = document.createElement('div');
      buttonsEl.style.cssText = 'display: flex; gap: 8px;';
      actions.forEach(action => {
        const btn = document.createElement('button');
        btn.textContent = action.label;
        btn.onclick = () => {
          action.onClick?.();
          this._remove(el);
        };
        buttonsEl.appendChild(btn);
      });
      el.appendChild(buttonsEl);
    }
    
    this._container.appendChild(el);
    
    if (duration) {
      setTimeout(() => this._remove(el), duration);
    }
    
    return el; // For testing/manual removal
  },
  
  _bgColor(level) {
    if (level === 'success') return '#dcfce7'; // Light green
    if (level === 'warning') return '#fef3c7'; // Light yellow
    if (level === 'error') return '#fee2e2';   // Light red
    return '#f3f4f6';                          // Light gray
  },
  
  _remove(el) {
    el.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => el.remove(), 300);
  }
};
```

**Source:** Standard notification pattern, custom implementation to match app's haptics+modal style

### Example 4: Error Handling in Push Flow

**Enhanced _showSyncMenuModal():**
```javascript
document.getElementById('_cloudPushBtn')?.addEventListener('click', async () => {
  try {
    this._syncInProgress = true;
    templateUI.closeModal();
    
    this._mutationsDuringSync = false;
    await pushSnapshot();
    
    // Success: clear error state
    this._isDirty = this._mutationsDuringSync;
    this._lastError = null;
    this._errorDismissed = false;
    localStorage.removeItem(CLOUD_LAST_ERROR_KEY);
    localStorage.removeItem(CLOUD_LAST_ERROR_TIME_KEY);
    
    localStorage.setItem(CLOUD_IS_DIRTY_KEY, this._isDirty ? 'true' : 'false');
    this._updateStatusIndicator();
    
    alertWithHaptic('Synced successfully!', 'success');
    await this._refreshSection();
    
  } catch (err) {
    // Error: store and show with fallback option
    this._lastError = {
      message: err.message || 'Unknown error',
      code: err.code || 'UNKNOWN',
      timestamp: Date.now()
    };
    this._errorDismissed = false;
    
    localStorage.setItem(CLOUD_LAST_ERROR_KEY, JSON.stringify(this._lastError));
    localStorage.setItem(CLOUD_LAST_ERROR_TIME_KEY, String(this._lastError.timestamp));
    
    this._updateStatusIndicator();
    
    // Show error notification with fallback option
    notificationUI.show(
      `Push failed: ${err.message}`,
      'error',
      [
        {
          label: '💾 Export Fallback',
          onClick: () => document.getElementById('exportBtn')?.click()
        },
        {
          label: 'Retry',
          onClick: async () => {
            // Re-open sync menu and try again
            await this._showSyncMenuModal();
          }
        },
        {
          label: 'Dismiss',
          onClick: () => {
            this._errorDismissed = true;
            this._updateStatusIndicator();
          }
        }
      ],
      null // Persistent until dismissed
    );
    
  } finally {
    this._syncInProgress = false;
  }
});
```

**Source:** Derived from existing error handling pattern + new notification system

---

## Implementation Approach

### Task 25.1: Enhance Dirty State Tracking

**What's done (Phase 23.1):**
- ✅ Dexie hooks detect writes
- ✅ localStorage persistence
- ✅ Mutation tracking during sync

**What's needed (Phase 25):**
- Add error state tracking alongside dirty state (localStorage `budget_cloud_last_error`)
- Load error state from localStorage on init
- Clear error state on successful sync
- Emit event when error state changes (for header indicator)

**Files to modify:**
- `src/ui/cloud-sync.js` → enhance `_initDirtyStateTracking()` and error handling

**Estimated LOC:** +40-60 lines

---

### Task 25.2: Enhance Visual Indicator

**What's done (Phase 23.1):**
- ✅ Status indicator exists (green/yellow/red)
- ✅ Pulse animation for dirty state
- ✅ Updates on sync completion

**What's needed (Phase 25):**
- Add RED state when error occurs (currently only green/yellow)
- Show error message in tooltip on RED state
- Only transition to GREEN on successful sync (not on dismiss)
- Add visual distinction between "dirty" and "error" states

**Files to modify:**
- `src/ui/cloud-sync.js` → enhance `_updateStatusIndicator()`

**Estimated LOC:** +30-50 lines

---

### Task 25.3: Create Notification System & Error Fallback

**What's needed:**
- Create `src/ui/notifications.js` with notificationUI module
- Initialize in app.js
- Add notification function wrappers in cloud-sync.js
- Integrate "Export Fallback" button into error notifications
- Handle notification stacking/auto-dismiss

**Files to create:**
- `src/ui/notifications.js` (new, ~200 lines)

**Files to modify:**
- `src/app.js` → initialize notificationUI
- `src/ui/cloud-sync.js` → use notificationUI instead of alertWithHaptic for errors
- `src/ui/cloud-sync.test.js` → add tests for error notification flow

**Estimated LOC:** +250-300 lines (new file + modifications)

---

## File Dependency Map

```
src/ui/cloud-sync.js ──┬─→ src/utils/supabase-sync.js (pushSnapshot, pullSnapshot)
                       ├─→ src/ui/templates.js (templateUI.showModal)
                       ├─→ src/utils/haptics.js (alertWithHaptic)
                       ├─→ src/ui/file-sync.js (getFileSyncState)
                       └─→ src/ui/notifications.js (NEW) ← notificationUI

src/app.js ────────────→ src/ui/cloud-sync.js
                       └─→ src/ui/notifications.js (NEW) ← init

src/ui/notifications.js (NEW) ─→ (no external deps; pure DOM + styling)
```

---

## Dexie Database Hooks

**Current Usage (Phase 23.1):**
```javascript
// Per-table hooks in _initDirtyStateTracking()
db.tables.forEach(table => {
  table.hook('creating', markDirty);
  table.hook('updating', markDirty);
  table.hook('deleting', markDirty);
});
```

**Available Hooks (Dexie 4 docs):**
- `hook.creating()` – Before insert
- `hook.created()` – After insert (transaction committed)
- `hook.updating()` – Before update
- `hook.updated()` – After update
- `hook.deleting()` – Before delete
- `hook.deleted()` – After delete
- `hook.reading()` – On read (affects queries)

**Phase 25 Use Case:**
- Mark dirty on `creating`, `updating`, `deleting` (existing, correct)
- No need for `created`/`updated`/`deleted` hooks — writes are immediate

**Risk:** Dexie hook system is strongly typed; ensure hooks are bound correctly in try-catch (already done in Phase 23.1).

---

## Error Handling Patterns in Codebase

### Pattern 1: alertWithHaptic (Current)
```javascript
import { alertWithHaptic } from '../utils/haptics.js';

try {
  await operation();
  alertWithHaptic('Success!', 'success');
} catch (err) {
  alertWithHaptic('Operation failed: ' + err.message);
}
```

**Pros:** Simple, haptic feedback, consistent  
**Cons:** Transient, no persistent state, requires user interaction

### Pattern 2: localStorage State (Phase 25)
```javascript
const ERROR_KEY = 'budget_last_operation_error';
try {
  await operation();
  localStorage.removeItem(ERROR_KEY);
} catch (err) {
  localStorage.setItem(ERROR_KEY, JSON.stringify({
    message: err.message,
    timestamp: Date.now()
  }));
}
```

**Pros:** Persists across page reloads, can show in UI without user action  
**Cons:** Requires manual cleanup; can become stale

### Pattern 3: modalUI (Existing)
```javascript
templateUI.showModal(title, body, footer);
```

**Pros:** Rich content, footer buttons, dismissible  
**Cons:** Blocking full-screen; can only show one at a time

### Pattern 4: Global Event (NEW for Phase 25)
```javascript
window.dispatchEvent(new CustomEvent('cloudSync:error', {
  detail: { message, code, timestamp }
}));
```

**Pros:** Decoupled, multiple listeners, can be logged/analytics  
**Cons:** Requires listener setup; harder to test

**Phase 25 Recommendation:** Use Pattern 2 (localStorage) + Pattern 1 (alertWithHaptic small notification) + Pattern 4 (event dispatch for logging).

---

## localStorage Keys Summary

| Key | Purpose | Type | Example |
|-----|---------|------|---------|
| `budget_cloud_last_sync` | Last successful sync timestamp (ms) | Number (string) | "1710259632000" |
| `budget_cloud_is_dirty` | Unsaved changes pending | Boolean (string) | "true" \| "false" |
| `budget_cloud_last_error` (NEW) | Last sync error details | JSON string | `{"message":"Network timeout","code":"NETWORK_ERROR","timestamp":1710259700000}` |
| `budget_cloud_last_error_time` (NEW) | Quick access to error timestamp | Number (string) | "1710259700000" |
| `budget_cloud_runtime_config` | Runtime Supabase config (Phase 23.4) | JSON string | `{"url":"...","anonKey":"..."}` |

---

## API Surface Changes

### cloud-sync.js Exports (Enhanced)

**NEW Fields:**
```javascript
cloudSyncUI._lastError = null;       // { message, code, timestamp }
cloudSyncUI._errorDismissed = false; // User acknowledged error
```

**NEW Methods:**
```javascript
cloudSyncUI._loadErrorState()    // Load from localStorage on init
cloudSyncUI._saveErrorState()    // Persist error to localStorage
cloudSyncUI._clearErrorState()   // Clear on successful sync
```

**MODIFIED Methods:**
```javascript
cloudSyncUI._updateStatusIndicator()  // Add RED state for errors
cloudSyncUI._initDirtyStateTracking() // Integrate error loading
```

### notifications.js Exports (NEW)

```javascript
export const notificationUI = {
  init(): void
  show(message, level, actions, duration): HTMLElement
  success(message, duration?: number): HTMLElement
  error(message, actions?: object[], duration?: null): HTMLElement
  warning(message, actions?: object[]): HTMLElement
}
```

---

## State Transitions

```
Initial State (No sync)
    ↓
[SYNCED] (🟢 Green)
    ↓
User edits data
    ↓
[DIRTY] (🟡 Yellow, pulse)
    ↓
User clicks "Push"
    ├─→ Success → [SYNCED] (🟢)
    └─→ Failure → [ERROR] (🔴 Red)
         ├─→ User clicks "Retry" → attempt push again
         ├─→ User clicks "Export Fallback" → open export dialog
         └─→ User clicks "Dismiss" → [ERROR-DISMISSED] (🟡 faded)
                                       (transitions to 🟢 on next successful sync)

Error State Behavior:
- [ERROR]: Show red dot + error notification (persistent)
- [ERROR-DISMISSED]: Show yellow dot (no pulse, grayed) + allow retry
- Error clears only on successful sync, not on dismiss
```

---

## Test Coverage Map

### Unit Tests (vitest)

| Test | File | Purpose |
|------|------|---------|
| `_initDirtyStateTracking` | `src/ui/cloud-sync.test.js` | Verify dirty state loads from localStorage |
| `_updateStatusIndicator` (RED state) | `src/ui/cloud-sync.test.js` | Verify red dot shows on error |
| Error state persistence | `src/ui/cloud-sync.test.js` | Verify `CLOUD_LAST_ERROR_KEY` save/load |
| `notificationUI.show()` | `src/ui/notifications.test.js` (new) | Verify notification DOM creation |
| Notification dismissal | `src/ui/notifications.test.js` (new) | Verify auto-dismiss and button clicks |
| Error → Export fallback flow | `src/ui/cloud-sync.test.js` | Mock export button, verify click |

### Integration Tests

| Test | Purpose |
|------|---------|
| Push error → notification → export button click → export modal | End-to-end error recovery |
| Error persists across page reload | Verify localStorage state |
| Multiple sync errors don't stack notifications | Verify notification deduplication |
| Successful sync clears error state | Verify state transition cleanup |

### Manual Tests (Phase 26)

- Network offline → Push fails → Error shows
- Export fallback button works when cloud fails
- Error state visible in header after page reload
- Retry button from notification re-opens sync menu

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Dexie hooks not binding on all tables | LOW | Error state never marks dirty | Test hook binding with mock Dexie instance |
| localStorage quota exceeded (error key bloats) | VERY LOW | Error keys not persisted | Limit error message length, implement JSON.stringify with reviver |
| Notification system blocks clicks on elements behind | MEDIUM | UX friction | Use `pointer-events: none` by default, `pointer-events: all` on container |
| Error notification shows generic Supabase error (too technical) | HIGH | User confusion | Map error codes to user-friendly messages (e.g., "Network timeout" instead of "PGRST501") |
| User keeps clicking "Retry" without fixing issue | MEDIUM | Spam notifications | Implement exponential backoff; show "last attempted 1 min ago" |
| Export fallback modal doesn't appear after push error | MEDIUM | User can't recover | Ensure export button (`#exportBtn`) is always in DOM and clickable |

---

## State of the Art

| Aspect | Old Approach (Pre-Phase 23.1) | Current Approach (Phase 23.1+) | Phase 25 Enhancement |
|--------|--------|--------|--------|
| Dirty state tracking | Manual flag in component | Dexie hooks + localStorage persistence | + Error state tracking |
| Sync status visibility | Manual button label changes | Status indicator dot (green/yellow) | + Red state for errors |
| Error handling | alertWithHaptic only | + localStorage persistence tracking | + Global notification system |
| Error recovery | Manual retry button in modal | + "Retry Push" button | + "Export Fallback" direct from notification |
| User messaging | Transient alerts | + Last sync timestamp display | + Error reason in tooltip |

---

## Open Questions

1. **Error Message Mapping: How detailed should error messages be?**
   - What we know: Current code shows raw Supabase errors (e.g., "PGRST116")
   - What's unclear: Should we create an error code → user-friendly message map?
   - Recommendation: Create `src/utils/error-messages.js` with mapping (5-10 common cloud errors)

2. **Notification Auto-dismiss Duration: Should success notifications auto-dismiss?**
   - What we know: alertWithHaptic closes after ~2 seconds
   - What's unclear: Should new notificationUI also auto-dismiss after 2-3 seconds?
   - Recommendation: Yes; keep consistent with alertWithHaptic behavior. Errors persist until dismissed.

3. **Multiple Device Sync: How should Phase 25 handle conflicts if user syncs from two devices?**
   - What we know: Current implementation is last-write-wins (no conflict detection)
   - What's unclear: Should error notification warn user about potential overwrites on pull?
   - Recommendation: Out of scope for Phase 25 (Phase 24 auto-pull already shows preview); Phase 25 only improves visibility of current flows.

4. **Error State Cleanup: When should stored error state clear?**
   - What we know: Cleaned on successful sync
   - What's unclear: Should errors auto-clear after 24 hours if user never retries?
   - Recommendation: Keep simple for Phase 25; always require successful sync or manual dismiss. Consider time-based cleanup in Phase 26 maintenance.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom |
| Config file | `vitest.config.js` |
| Quick run command | `npm test -- src/ui/cloud-sync.test.js --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 25.1 | Dirty state loads from localStorage on init | unit | `npm test -- src/ui/cloud-sync.test.js -t "dirty state"` | ✅ |
| 25.1 | Dexie hooks mark dirty on write | unit | `npm test -- src/ui/cloud-sync.test.js -t "dexie hooks"` | ✅ |
| 25.1 | Error state loads from localStorage | unit | `npm test -- src/ui/cloud-sync.test.js -t "error state"` | ❌ Wave 0 |
| 25.2 | Status dot RED on error | unit | `npm test -- src/ui/cloud-sync.test.js -t "red indicator"` | ❌ Wave 0 |
| 25.2 | Status dot GREEN on successful sync | unit | `npm test -- src/ui/cloud-sync.test.js -t "green indicator"` | ✅ |
| 25.3 | Notification shows on push error | unit | `npm test -- src/ui/notifications.test.js -t "show error"` | ❌ Wave 0 |
| 25.3 | Notification dismisses on button click | unit | `npm test -- src/ui/notifications.test.js -t "dismiss"` | ❌ Wave 0 |
| 25.3 | Export fallback button triggers export modal | integration | `npm test -- src/ui/cloud-sync.test.js -t "export fallback"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- src/ui/cloud-sync.test.js --run` (cloud sync module)
- **Per wave merge:** `npm test -- --run` (full suite)
- **Phase gate:** Full suite green + manual error recovery test before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/ui/cloud-sync.test.js` – Add tests for `_lastError` state loading/saving/clearing (REQ 25.1, 25.2)
- [ ] `src/ui/notifications.test.js` – New file; cover show/dismiss/actions (REQ 25.3)
- [ ] Test mock for Supabase errors (e.g., network timeout, permission denied) to verify error messaging

---

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** – Read Phase 23.1 implementation (cloud-sync.js, supabase-sync.js)
- **ROADMAP.md** – Phase 25 specification (3 task bullets)
- **Dexie 4.0 docs** – Hook system (table.hook() API)
- **localStorage API** – Native browser API (no external doc needed)

### Secondary (MEDIUM confidence)
- **File-sync.js pattern** – Status indicator pattern (local file sync uses same yellow/green/red scheme)
- **backup.js** – Export logic already exists and is tested
- **haptics.js** – alertWithHaptic() function signature and behavior

### Tertiary (Source Code Only)
- **cloud-sync.js Phase 23.1** – Existing dirty state implementation (verified by reading source)
- **render.js** – modalUI system (verified by reading source)

---

## Metadata

**Confidence breakdown:**
- **Dirty state tracking:** HIGH – Already implemented in Phase 23.1; codebase review complete
- **Visual indicators:** HIGH – Status dot exists; just needs RED state addition
- **Notification system:** HIGH – Modal pattern proven; notifications are standard pattern
- **Error handling:** MEDIUM – Current minimal error handling; Phase 25 extends it significantly
- **Dexie hooks:** HIGH – Hook system is documented; Phase 23.1 uses it successfully

**Research date:** 2026-03-12  
**Valid until:** 2026-03-19 (stable libraries, low churn)

**Key Assumptions:**
- Dexie 4 hook system remains stable (API has not changed in recent releases)
- Supabase error types remain consistent (can map error codes)
- No major refactoring of cloud-sync.js planned before Phase 26

