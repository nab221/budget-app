# Task 4 Code Review - Issue Examples with Code Comparisons

## Issue #1: Event Listener Memory Leak - Before & After

### Before (Current Implementation - BUGGY)

```javascript
// src/ui/cloud-sync.js, lines 48-104
_renderSignedIn(session, statusEl, actionsEl) {
  const lastSyncMs = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
  const lastSyncText = lastSyncMs
    ? `Last synced: ${new Date(parseInt(lastSyncMs)).toLocaleString()}`
    : 'Never synced';

  statusEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="color:var(--success);font-size:.85rem">Signed in as ${session.user.email}</span>
      <button id="cloudSignOutBtn" class="ghost" style="font-size:.75rem;padding:2px 8px">Sign Out</button>
    </div>
  `;

  actionsEl.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="cloudPushBtn" class="ghost">Push to Cloud</button>
      <button id="cloudPullBtn" class="ghost">Pull from Cloud</button>
    </div>
    <div class="hint" style="margin-top:6px;font-size:.75rem">${lastSyncText}</div>
  `;

  // PROBLEM: Each call to _renderSignedIn() adds NEW listeners
  // If _renderSignedIn() called twice, button has 2 listeners!
  document.getElementById('cloudSignOutBtn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    triggerHaptic('tap');
  });

  document.getElementById('cloudPushBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('cloudPushBtn');
    try {
      btn.textContent = 'Pushing...';
      btn.disabled = true;
      await pushSnapshot();  // <-- CALLED TWICE if listener duplicated!
      triggerHaptic('success');
      await this._refreshSection();
    } catch (err) {
      console.error('[cloudSyncUI] Push failed:', err);
      alertWithHaptic('Push failed: ' + err.message);
      btn.textContent = 'Push to Cloud';
      btn.disabled = false;
    }
  });

  document.getElementById('cloudPullBtn')?.addEventListener('click', async () => {
    // ... similar pattern ...
  });
}
```

**Problem:** When `_refreshSection()` calls `_renderSignedIn()` multiple times (on auth state changes), new event listeners accumulate on the buttons without the old ones being removed.

### After (Fixed Implementation)

```javascript
_renderSignedIn(session, statusEl, actionsEl) {
  const lastSyncMs = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
  const lastSyncText = lastSyncMs
    ? `Last synced: ${new Date(parseInt(lastSyncMs)).toLocaleString()}`
    : 'Never synced';

  statusEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="color:var(--success);font-size:.85rem">Signed in as ${session.user.email}</span>
      <button id="cloudSignOutBtn" class="ghost" style="font-size:.75rem;padding:2px 8px">Sign Out</button>
    </div>
  `;

  actionsEl.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="cloudPushBtn" class="ghost">Push to Cloud</button>
      <button id="cloudPullBtn" class="ghost">Pull from Cloud</button>
    </div>
    <div class="hint" style="margin-top:6px;font-size:.75rem">${lastSyncText}</div>
  `;

  // FIXED: Use event delegation - listener attached ONCE to parent
  // Subsequent calls to _renderSignedIn() do NOT add new listeners
  if (!this._signedInListenerAttached) {
    actionsEl.addEventListener('click', (e) => {
      if (e.target?.id === 'cloudSignOutBtn') {
        e.target.disabled = true;
        supabase.auth.signOut().catch(err => {
          console.error('[cloudSyncUI] Sign-out failed:', err);
          e.target.disabled = false;
        });
        triggerHaptic('tap');
      } else if (e.target?.id === 'cloudPushBtn') {
        this._handlePushClick(e.target);
      } else if (e.target?.id === 'cloudPullBtn') {
        this._handlePullClick(e.target);
      }
    });
    this._signedInListenerAttached = true;
  }
}

_renderSignedOut(statusEl, actionsEl) {
  // ... existing code ...

  // Reset flag when switching to signed-out state
  this._signedInListenerAttached = false;

  // ... rest of code ...
}

_handlePushClick(btn) {
  (async () => {
    try {
      btn.textContent = 'Pushing...';
      btn.disabled = true;
      await pushSnapshot();  // <-- Called ONCE, not twice
      triggerHaptic('success');
      await this._refreshSection();
    } catch (err) {
      console.error('[cloudSyncUI] Push failed:', err);
      alertWithHaptic('Push failed: ' + err.message);
      btn.textContent = 'Push to Cloud';
      btn.disabled = false;
    }
  })();
}
```

**Benefits:**
- ✓ Listeners attached only ONCE
- ✓ No memory leak from accumulated listeners
- ✓ No duplicate function calls on button click
- ✓ Cleaner code structure

---

## Issue #2: XSS Risk in Modal Body - Before & After

### Before (Current Implementation - RISKY)

```javascript
// src/ui/cloud-sync.js, lines 177-187
const countLines = Object.entries(counts)
  .filter(([, n]) => n > 0)
  .map(([t, n]) => `${n} ${t}`)  // <-- 't' (table name) not sanitized!
  .join(' · ');

const body = `
  <p>Cloud snapshot from <strong>${date}</strong></p>
  <p style="margin-top:6px;color:var(--text-soft);font-size:.85rem">${countLines || 'No data'}</p>
  ${versionWarning}
  <p style="margin-top:12px"><strong>Replace local data?</strong> This cannot be undone.</p>
`;

// ... later ...
templateUI.showModal('Cloud Snapshot Preview', body, footer);
```

**Problem:** If `countLines` contains unsanitized HTML tags, they will be rendered in the modal:

```javascript
// Example attack payload (hypothetical):
tableData = {
  "income": [],
  "<img src=x onerror='alert(\"XSS\")'>": []
}

// Would render as:
// "No data · <img src=x onerror='alert("XSS")'>"
//
// And the JavaScript would execute!
```

### After (Fixed Implementation)

```javascript
const countLines = Object.entries(counts)
  .filter(([, n]) => n > 0)
  .map(([t, n]) => {
    // Sanitize HTML entities in table name
    const escaped = t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    return `${n} ${escaped}`;
  })
  .join(' · ');

const body = `
  <p>Cloud snapshot from <strong>${date}</strong></p>
  <p style="margin-top:6px;color:var(--text-soft);font-size:.85rem">${countLines || 'No data'}</p>
  ${versionWarning}
  <p style="margin-top:12px"><strong>Replace local data?</strong> This cannot be undone.</p>
`;

templateUI.showModal('Cloud Snapshot Preview', body, footer);
```

**Benefits:**
- ✓ HTML entities are escaped, preventing injection
- ✓ Malicious tags render as text, not executable code
- ✓ Defense-in-depth security posture

**Example:**
```
Attack: "<img src=x onerror='alert(\"XSS\")'>"
Sanitized: "&lt;img src=x onerror=&#39;alert(&quot;XSS&quot;)&#39;&gt;"
Renders as: "<img src=x onerror='alert("XSS")'>" (as text, harmless)
```

---

## Issue #3: Multiple Auth Listener Registration - Before & After

### Before (Current Implementation - NOT ROBUST)

```javascript
// src/ui/cloud-sync.js, lines 20-27
async init() {
  if (!isConfigured()) return;

  this._bindAuthListener();  // If init() called 2x, listener registered 2x
  this._bindPreviewListener();  // Same here
  await this._refreshSection();
  document.getElementById('cloudSyncSection')?.classList.remove('hidden');
},

_bindAuthListener() {
  // No guard against multiple calls
  supabase.auth.onAuthStateChange(() => this._refreshSection());
  // This callback will be triggered multiple times if called twice
},

_bindPreviewListener() {
  // Also has no guard
  window.addEventListener('budget:import-cloud-preview', async (e) => {
    // ... logic ...
  });
  // If called twice, listener is registered twice
}
```

**Problem:** If `init()` is called multiple times (unlikely but possible), listeners accumulate:

```javascript
// Example attack sequence:
cloudSyncUI.init();      // Listeners registered once
cloudSyncUI.init();      // Listeners registered AGAIN

// Now:
// - Auth state change triggers callback TWICE
// - App refreshes unnecessarily
// - Preview listener fires twice on cloud import
// - Memory usage increases
```

### After (Fixed Implementation)

```javascript
// src/ui/cloud-sync.js
async init() {
  if (!isConfigured()) return;

  // Guard against multiple initialization
  if (this._initialized) return;
  this._initialized = true;

  this._bindAuthListener();
  this._bindPreviewListener();
  await this._refreshSection();
  document.getElementById('cloudSyncSection')?.classList.remove('hidden');
},

_bindAuthListener() {
  // Guard against multiple registration
  if (this._authListenerBound) return;
  this._authListenerBound = true;

  supabase.auth.onAuthStateChange(() => this._refreshSection());
},

_bindPreviewListener() {
  // Guard against multiple registration
  if (this._previewListenerBound) return;
  this._previewListenerBound = true;

  window.addEventListener('budget:import-cloud-preview', async (e) => {
    // ... logic ...
  });
}
```

**Benefits:**
- ✓ Listeners registered only ONCE even if init() called multiple times
- ✓ Idempotent initialization (safe to call multiple times)
- ✓ Better robustness for unexpected scenarios
- ✓ No memory leak from duplicate listeners

---

## Summary of Fixes

| Issue | Lines | Type | Severity | Effort |
|-------|-------|------|----------|--------|
| #1 Event listener leak | 69, 74, 90, 122 | Memory Leak | Important | 10 min |
| #2 XSS in modal | 177-187 | Security | Low | 5 min |
| #3 Multiple listener registration | 20-27, 150 | Robustness | Medium | 5 min |
| Total estimated effort | | | | 20 min |

---

## Testing Recommendations

After applying fixes, test these scenarios:

### Test #1: Listener Leak Fix
```javascript
// Scenario: Sign in/out cycle
1. Page loads → Settings tab visible
2. Click "Send Magic Link" → button disabled
3. Check browser console: pushSnapshot() function called once on Push button click ✓
4. Sign out → click back in quickly
5. Click "Push to Cloud" → should only push ONCE, not twice ✓
6. Repeat 5 times, verify each push only executes once ✓
```

### Test #2: XSS Prevention
```javascript
// Scenario: Verify HTML escaping in modal
// (Requires manual Supabase testing with malicious payload)
1. Create snapshot with table name containing HTML tags
2. Pull from cloud → modal appears
3. Right-click → Inspect Element on table name in modal
4. Should show escaped HTML entities (&lt;, &gt;, etc.), not raw tags ✓
```

### Test #3: Idempotent Initialization
```javascript
// Scenario: Multiple init() calls (simulated in console)
1. cloudSyncUI.init(); await cloudSyncUI.init();
2. Trigger auth state change (sign in/out)
3. Should only refresh ONCE, not twice ✓
4. No errors in console ✓
```

---

## Implementation Checklist

After reviewing this document, the developer should:

- [ ] Apply fix for Issue #1 (Event listener delegation)
- [ ] Apply fix for Issue #2 (HTML entity escaping)
- [ ] Apply fix for Issue #3 (Initialization guards)
- [ ] Run `npm run test` to verify all tests still pass
- [ ] Run `npm run build` to verify build succeeds
- [ ] Perform manual testing scenarios above
- [ ] Commit fixes with message: `fix(cloud-sync): resolve listener leak, XSS, and re-initialization issues`
- [ ] Proceed with Task 5 (HTML and app.js integration)

