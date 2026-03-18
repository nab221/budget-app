---
phase: 27-critical-bug-fixes
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/ui/cloud-sync.js]
autonomous: true
requirements: [SYNC-02]
user_setup: []

must_haves:
  truths:
    - "cloud-sync.js does NOT contain any unescaped session.user.email in innerHTML"
    - "Modal push/pull/sign-out buttons use .onclick = assignment, not addEventListener"
    - "_bindAuthListener() checks this._authListenerBound before registering a new subscription"
    - "_bindPreviewListener() checks this._previewListenerBound before registering a new listener"
    - "All existing cloud-sync tests pass"
  artifacts:
    - path: "src/ui/cloud-sync.js"
      provides: "Hardened cloud-sync UI with XSS fix, listener deduplication, and init guards"
      contains: "escHtml(session.user.email)"
  key_links:
    - from: "src/ui/cloud-sync.js"
      to: "_showSyncMenuModal"
      via: "onclick assignment on _cloudPushBtn, _cloudPullBtn, _cloudSignOutBtn"
      pattern: "\\.onclick\\s*="
    - from: "src/ui/cloud-sync.js"
      to: "_bindPreviewListener"
      via: "_previewListenerBound guard"
      pattern: "_previewListenerBound"
---

<objective>
Fix three security and reliability bugs in src/ui/cloud-sync.js: an XSS vulnerability from unescaped email in innerHTML, modal button listener accumulation that causes push/pull to fire multiple times, and missing idempotency guards on _bindAuthListener and _bindPreviewListener.

Purpose: Prevent potential XSS injection via session.user.email, stop push/pull handlers from firing N times after N modal opens, and ensure auth/preview listeners are never double-registered.
Output: Patched src/ui/cloud-sync.js with all three bugs fixed. No new files, no new tests required (existing cloud-sync.test.js must remain green).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@src/ui/cloud-sync.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix XSS — wrap session.user.email in escHtml() at line 1237</name>
  <files>src/ui/cloud-sync.js</files>
  <read_first>src/ui/cloud-sync.js</read_first>
  <action>
Audit every `innerHTML` assignment in src/ui/cloud-sync.js for unescaped user-controlled string interpolation. The primary fix is at line 1237 inside `_renderSignedIn()`:

BEFORE (line 1237):
```js
<span style="color:var(--success);font-size:.85rem">Signed in as ${session.user.email}</span>
```

AFTER:
```js
<span style="color:var(--success);font-size:.85rem">Signed in as ${escHtml(session.user.email)}</span>
```

The file already defines `escHtml` at line 1139 inside `_showSyncMenuModal()` as a local `const`:
```js
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
```

The `_bindPreviewListener()` method (line 1368) defines its own `escapeHtml` (line 1387) and already uses it correctly for count table names.

The fix for `_renderSignedIn` must use the same inline escHtml pattern. Because `_renderSignedIn` is a separate method from `_showSyncMenuModal`, add a local `const escHtml` declaration at the top of `_renderSignedIn()` (line 1229), identical to the one already used at line 1139. Then replace the bare `${session.user.email}` at line 1237 with `${escHtml(session.user.email)}`.

Full grep audit: run `grep -n 'innerHTML' src/ui/cloud-sync.js` and verify each `${...}` interpolated expression that touches user-controlled data (session fields, store names, error messages) is wrapped in escHtml. The only unescaped user-controlled value confirmed by audit is `session.user.email` at line 1237 — fix that one specifically. Do NOT alter the already-correct usages in `_showSyncMenuModal` (line 1157 already has `escHtml(email)`) or `_bindPreviewListener` (lines 1392–1393 already use `escapeHtml(t)`).
  </action>
  <verify>grep -n 'session.user.email' src/ui/cloud-sync.js</verify>
  <acceptance_criteria>
    - src/ui/cloud-sync.js contains `escHtml(session.user.email)` (NOT bare `session.user.email`) in the innerHTML template at the _renderSignedIn method
    - grep -c 'innerHTML.*\${session\.user\.email}' src/ui/cloud-sync.js returns 0
    - grep -c 'escHtml(session\.user\.email)' src/ui/cloud-sync.js returns 1
  </acceptance_criteria>
  <done>session.user.email is escaped via escHtml() before every innerHTML interpolation; no unescaped occurrence remains in the file</done>
</task>

<task type="auto">
  <name>Task 2: Fix listener accumulation — replace addEventListener with .onclick on modal buttons</name>
  <files>src/ui/cloud-sync.js</files>
  <read_first>src/ui/cloud-sync.js</read_first>
  <action>
In `_showSyncMenuModal()` (lines ~1179–1225), three buttons inside the modal body are wired with `addEventListener('click', ...)`. Because `templateUI.showModal()` may reuse the container element, these listeners accumulate on each modal open — causing push, pull, and sign-out to fire multiple times.

Replace all three `addEventListener` calls with `.onclick =` assignment:

**Fix at line 1179** (`_cloudPushBtn`):
BEFORE:
```js
document.getElementById('_cloudPushBtn')?.addEventListener('click', async () => {
```
AFTER:
```js
const pushBtnModal = document.getElementById('_cloudPushBtn');
if (pushBtnModal) pushBtnModal.onclick = async () => {
```
Close the handler with `};` (replacing the closing `});`).

**Fix at line 1197** (`_cloudPullBtn`):
BEFORE:
```js
document.getElementById('_cloudPullBtn')?.addEventListener('click', async () => {
```
AFTER:
```js
const pullBtnModal = document.getElementById('_cloudPullBtn');
if (pullBtnModal) pullBtnModal.onclick = async () => {
```
Close the handler with `};`.

**Fix at line 1215** (`_cloudSignOutBtn`):
BEFORE:
```js
document.getElementById('_cloudSignOutBtn')?.addEventListener('click', async () => {
```
AFTER:
```js
const signOutBtnModal = document.getElementById('_cloudSignOutBtn');
if (signOutBtnModal) signOutBtnModal.onclick = async () => {
```
Close the handler with `};`.

Note: The settings panel buttons (`#cloudPushBtn`, `#cloudPullBtn`, `#cloudSignOutBtn` in `_renderSignedIn` at lines 1258–1286) already use `.onclick =` — do NOT change those.
  </action>
  <verify>grep -n 'addEventListener.*click' src/ui/cloud-sync.js | grep -E '_cloudPushBtn|_cloudPullBtn|_cloudSignOutBtn'</verify>
  <acceptance_criteria>
    - grep returns 0 results for `addEventListener('click'` on `_cloudPushBtn`, `_cloudPullBtn`, or `_cloudSignOutBtn`
    - src/ui/cloud-sync.js contains `pushBtnModal.onclick = async () =>` (or equivalent `.onclick =` assignment on each of the three modal buttons)
    - grep -c '_cloudPushBtn.*addEventListener\|addEventListener.*_cloudPushBtn' src/ui/cloud-sync.js returns 0
    - grep -c '_cloudPullBtn.*addEventListener\|addEventListener.*_cloudPullBtn' src/ui/cloud-sync.js returns 0
    - grep -c '_cloudSignOutBtn.*addEventListener\|addEventListener.*_cloudSignOutBtn' src/ui/cloud-sync.js returns 0
  </acceptance_criteria>
  <done>All three modal buttons (_cloudPushBtn, _cloudPullBtn, _cloudSignOutBtn) use .onclick = assignment — no addEventListener remains on these elements</done>
</task>

<task type="auto">
  <name>Task 3: Add _previewListenerBound guard to _bindPreviewListener()</name>
  <files>src/ui/cloud-sync.js</files>
  <read_first>src/ui/cloud-sync.js</read_first>
  <action>
`_bindAuthListener()` (line 1331) already has a full idempotency guard: it checks `this._authListenerBound && this._authBoundClient === supabase` at line 1341 and sets `this._authListenerBound = true` at line 1360. No change needed there.

`_bindPreviewListener()` (line 1368) has NO guard — it calls `window.addEventListener('budget:import-cloud-preview', ...)` unconditionally. If `_bindPreviewListener` is ever called more than once (e.g., via a direct call path or in test environments), duplicate preview listeners accumulate.

Fix: add a `_previewListenerBound` flag to the object literal (already has `_authListenerBound: false` at line 34 of the object definition) and add the guard at the top of `_bindPreviewListener()`.

**Step 1:** In the object literal at the top of `cloudSyncUI` (around line 32–46, where `_authListenerBound: false` is declared), add `_previewListenerBound: false,` on a new line directly after `_authListenerBound: false,`.

**Step 2:** At the top of `_bindPreviewListener()` (line 1368), add the guard before the `window.addEventListener` call:
```js
_bindPreviewListener() {
  if (this._previewListenerBound) return;
  this._previewListenerBound = true;
  window.addEventListener('budget:import-cloud-preview', async (e) => {
    // ... existing handler body unchanged ...
  });
},
```

Do NOT change anything inside the handler body — only add the guard at the entry point.
  </action>
  <verify>grep -n '_previewListenerBound' src/ui/cloud-sync.js</verify>
  <acceptance_criteria>
    - src/ui/cloud-sync.js contains `_previewListenerBound: false` in the cloudSyncUI object literal
    - src/ui/cloud-sync.js contains `if (this._previewListenerBound) return;` inside `_bindPreviewListener()`
    - src/ui/cloud-sync.js contains `this._previewListenerBound = true;` inside `_bindPreviewListener()`, before the `window.addEventListener` call
    - grep -c '_previewListenerBound' src/ui/cloud-sync.js returns at least 3 (declaration + guard + set)
  </acceptance_criteria>
  <done>_bindPreviewListener() is idempotent — calling it more than once registers at most one 'budget:import-cloud-preview' listener</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] npx vitest run src/ui/cloud-sync.test.js — all tests pass
- [ ] grep -c 'innerHTML.*\${session\.user\.email}' src/ui/cloud-sync.js returns 0
- [ ] grep -c 'escHtml(session\.user\.email)' src/ui/cloud-sync.js returns 1
- [ ] grep -E '_cloudPushBtn.*addEventListener|_cloudPullBtn.*addEventListener|_cloudSignOutBtn.*addEventListener' src/ui/cloud-sync.js returns no results
- [ ] grep -c '_previewListenerBound' src/ui/cloud-sync.js returns 3 or more
</verification>

<success_criteria>
- All three tasks completed
- cloud-sync.js does NOT contain any unescaped `session.user.email` in innerHTML
- Modal buttons (_cloudPushBtn, _cloudPullBtn, _cloudSignOutBtn) use `.onclick =` not `addEventListener`
- `_bindPreviewListener` checks `_previewListenerBound` before registering
- `_bindAuthListener` already had its guard (no change needed)
- All existing cloud-sync tests pass with no new failures
- No new console errors introduced
</success_criteria>

<output>
After completion, create `.planning/phases/27-critical-bug-fixes/27-01-SUMMARY.md`
</output>
