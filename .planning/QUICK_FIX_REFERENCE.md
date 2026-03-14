# Quick Fix Reference - Task 4 Issues

## Issue #1: Event Listener Leak (10 min fix)

**Location:** Lines 69, 74, 90, 122 in _renderSignedIn()

**Current Pattern (BUGGY):**
```javascript
document.getElementById('cloudPushBtn')?.addEventListener('click', async () => {
  // ... handler ...
});
```

**Fixed Pattern (USE THIS):**
```javascript
// In _renderSignedIn():
if (!this._signedInListenerAttached) {
  actionsEl.addEventListener('click', (e) => {
    if (e.target?.id === 'cloudPushBtn') {
      // ... push handler ...
    }
    if (e.target?.id === 'cloudPullBtn') {
      // ... pull handler ...
    }
  });
  this._signedInListenerAttached = true;
}

// In _renderSignedOut():
this._signedInListenerAttached = false;
```

**Why:** Event delegation prevents listener duplication on re-render

---

## Issue #2: XSS in Modal (5 min fix)

**Location:** Lines 177-187 in _bindPreviewListener()

**Current Pattern (RISKY):**
```javascript
const countLines = Object.entries(counts)
  .filter(([, n]) => n > 0)
  .map(([t, n]) => `${n} ${t}`)  // 't' not escaped!
  .join(' · ');
```

**Fixed Pattern (USE THIS):**
```javascript
const countLines = Object.entries(counts)
  .filter(([, n]) => n > 0)
  .map(([t, n]) => {
    const escaped = t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    return `${n} ${escaped}`;
  })
  .join(' · ');
```

**Why:** Prevents HTML injection if Supabase payload is compromised

---

## Issue #3: Multiple Init Guard (5 min fix)

**Location:** Lines 20-27 (init method) and Line 150 (_bindAuthListener)

**Current Pattern (NOT ROBUST):**
```javascript
async init() {
  if (!isConfigured()) return;
  this._bindAuthListener();  // Can be called multiple times
  this._bindPreviewListener();
  // ...
}

_bindAuthListener() {
  supabase.auth.onAuthStateChange(() => this._refreshSection());
  // Listener registered each time this is called
}
```

**Fixed Pattern (USE THIS):**
```javascript
async init() {
  if (!isConfigured()) return;
  if (this._initialized) return;  // Add this line
  this._initialized = true;       // Add this line

  this._bindAuthListener();
  this._bindPreviewListener();
  // ...
}

_bindAuthListener() {
  if (this._authListenerBound) return;  // Add this line
  this._authListenerBound = true;       // Add this line

  supabase.auth.onAuthStateChange(() => this._refreshSection());
}

_bindPreviewListener() {
  if (this._previewListenerBound) return;  // Add this line
  this._previewListenerBound = true;       // Add this line

  window.addEventListener('budget:import-cloud-preview', async (e) => {
    // ... existing code ...
  });
}
```

**Why:** Makes initialization idempotent (safe to call multiple times)

---

## Verification Checklist

After applying fixes:

- [ ] Run: `npm run test` (all 272 tests pass)
- [ ] Run: `npm run build` (build succeeds, no errors)
- [ ] Check: No console errors when opening Settings
- [ ] Check: Push button only calls pushSnapshot() once (use console.log to verify)
- [ ] Check: Auth state changes trigger refresh only once
- [ ] Check: Modal with special characters in table names shows safely

---

## What NOT to Change

- ✗ Don't modify the plan or architecture
- ✗ Don't add new features
- ✗ Don't change HTML structure (that's Task 5)
- ✗ Don't change app.js imports (that's Task 5)
- ✓ ONLY apply the three fixes above

---

## Commit Message Template

```bash
git add src/ui/cloud-sync.js
git commit -m "fix(cloud-sync): resolve listener leak, XSS, and re-initialization issues

- Fix event listener accumulation on re-render (Issue #1)
- Sanitize table names in modal body to prevent XSS (Issue #2)
- Add initialization guards to prevent duplicate listeners (Issue #3)
"
```

---

## Files Modified
- `src/ui/cloud-sync.js` - Only file to change for these fixes

---

## Time Estimate
- Issue #1: 10 minutes
- Issue #2: 5 minutes
- Issue #3: 5 minutes
- Testing: 5-10 minutes
- **Total: 25-30 minutes**

---

## Help Resources
- Full review: `.planning/task4-review.md`
- Code examples: `.planning/task4-issue-examples.md`
- Plan reference: `docs/superpowers/plans/2026-03-10-supabase-cloud-sync.md`

