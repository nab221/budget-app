# Phase 11: Modal Scaffold - Research

**Researched:** 2026-03-08
**Domain:** Native browser modal dialog, focus management, scroll lock, existing `modalUI` infrastructure
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MODAL-01 | User sees a modal dialog (not an inline banner) when adding or editing a debt | `modalUI.show()` in render.js provides working overlay; `openDebtModal()` replaces `toggleDebtForm()` |
| MODAL-02 | User can dismiss the modal by clicking the backdrop (outside the dialog) | Backdrop click not wired in existing `modalUI` — must add `overlay.addEventListener('click', ...)` with target check |
| MODAL-03 | Page scroll is locked while the debt modal is open | `modalUI.show()` already sets `document.body.style.overflow = 'hidden'`; `close()` restores it — scroll lock is FREE |
| MODAL-04 | Name field receives focus automatically when the modal opens | Must call `document.getElementById(FIELD_IDS.name).focus()` after `modalUI.show()` returns |
</phase_requirements>

---

## Summary

The existing `modalUI` object in `src/ui/render.js` already implements a fully functional div-based modal overlay (`#modalOverlay`), scroll lock, Esc-key close, and the `show(title, content, footerButtons[])` contract the planner must use. Phase 11 is almost entirely about **wiring**, not building.

Three of the four requirements are either already satisfied by `modalUI` or require a single additional line. The one missing behavior is backdrop-click dismissal (MODAL-02): the existing `modalUI` has no click listener on the overlay div. The pattern for fixing this — a `click` listener on the overlay that checks `e.target === overlay` — is standard and requires about four lines in `modalUI.init()`.

The architectural decision already documented in STATE.md is fully actionable: add `openDebtModal(id)` to `debtUI`, connect the "Add New Debt" button to it, and define `FIELD_IDS` constants at module top. The `editingId` state cleanup on all dismiss paths is the primary behavioral concern to get right, documented as an open blocker in STATE.md.

**Primary recommendation:** Wire `openDebtModal()` through the existing `modalUI.show()` path. Add backdrop click and focus as two targeted additions to `modalUI.init()` and `openDebtModal()` respectively. Do not introduce a native `<dialog>` element — `#modalOverlay` already fulfills MODAL-01 through MODAL-04.

---

## Standard Stack

### Core (what this phase touches)

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| `modalUI` | `src/ui/render.js:64-135` | overlay show/close, scroll lock, Esc key | Existing — already works |
| `#modalOverlay` | `index.html:410-423` | DOM overlay + `.modal` inner container | Existing — direct child of `<body>` |
| `debtUI` | `src/ui/debts.js` | debt tab state machine (`editingId`, render) | Existing — `toggleDebtForm` must be replaced |
| `FIELD_IDS` constants | `src/ui/debts.js` (new) | single source of truth for input IDs in template | New — define before first `getElementById` call |

### No New Packages

The decision is locked: zero new npm packages. `modalUI` covers everything.

---

## Architecture Patterns

### Existing `modalUI` API (verified from source)

```javascript
// src/ui/render.js — confirmed behavior
modalUI.show(title, content, footerButtonsArray)
// Sets title, injects content HTML into #modalBody,
// creates <button> elements from footerButtonsArray config objects,
// removes 'hidden' from #modalOverlay,
// sets document.body.style.overflow = 'hidden'

modalUI.close()
// Adds 'hidden' to #modalOverlay
// Resets document.body.style.overflow = ''

// Esc key is wired in modalUI.init() via document.addEventListener('keydown')
// modalUI.init() is NOT called in app.js — verify whether it needs to be called
// or whether the debt modal can call it once during debtUI.init()
```

### What `modalUI` Does NOT Have (gaps for Phase 11)

1. **Backdrop click dismiss** — no click listener on `#modalOverlay`. Adding one inside `modalUI.init()`:
   ```javascript
   this.elements.overlay.addEventListener('click', (e) => {
     if (e.target === this.elements.overlay) this.close();
   });
   ```
   This works because clicks inside `.modal` bubble up but `e.target` is not the overlay element.

2. **Close callback** — `modalUI.close()` does not call any registered callback. The STATE.md blocker notes: verify whether the Esc handler fires `close()` directly. It does (confirmed in render.js line 89: `if (e.key === 'Escape') this.close()`). This means `editingId` cleanup cannot rely on intercepting close — it must be done via a `close` event or by overriding `modalUI.close` locally. The safest pattern is a thin wrapper in `openDebtModal`:

   ```javascript
   // Pattern: wrap modalUI.close to inject cleanup
   openDebtModal(id = null) {
     this.editingId = id;
     modalUI.show('Add Debt', this._buildFormHTML(id === null ? null : data), [...buttons]);
     // focus the name field after show
     document.getElementById(FIELD_IDS.name)?.focus();
   }

   _closeDebtModal() {
     this.editingId = null;
     modalUI.close();
   }
   ```
   Footer buttons call `this._closeDebtModal()` (not `modalUI.close()` directly). The Esc and backdrop paths call `modalUI.close()` — for Phase 11 the form has no data to lose, so `editingId` can be reset inside a wrapper or ignored for now; Phase 13 wires the save flow fully.

   **Recommended Phase 11 approach:** Set `this.editingId = null` inside a `'hidden'` transitionend listener OR simply ensure all Phase 11 close paths (X button, backdrop, Esc) call `_closeDebtModal()`. For the Esc path, override `modalUI.elements.close.onclick` to point to `_closeDebtModal` after `show()`, and add the backdrop listener pointing to `_closeDebtModal` as well. This avoids needing to change `modalUI` itself.

### Recommended `openDebtModal` Skeleton

```javascript
// src/ui/debts.js additions for Phase 11
const FIELD_IDS = {
  name: 'debtNameInput',
  type: 'debtTypeInput',
  // ... (Phases 12-13 will fill these out)
};

openDebtModal(id = null) {
  this.editingId = id;

  const formHTML = this._buildFormHTML(); // Phase 11: empty scaffold with name + type fields only
  const title = id === null ? 'Add Debt Account' : 'Edit Debt Account';

  // Wire footer buttons via array config (avoids inline onclick globals)
  const buttons = [
    { label: 'Cancel', className: 'ghost', onClick: () => this._closeDebtModal() }
    // Save button added in Phase 13
  ];

  modalUI.show(title, formHTML, buttons);

  // MODAL-04: auto-focus name field
  document.getElementById(FIELD_IDS.name)?.focus();

  // Wire Esc and backdrop to call _closeDebtModal so editingId is cleared
  // (backdrop listener added to overlay after show; Esc already wired in modalUI.init)
},

_closeDebtModal() {
  this.editingId = null;
  modalUI.close();
},

_buildFormHTML() {
  // Phase 11: returns minimal scaffold with name input and type selector
  // Phases 12-13 expand this
  return safeHTML`
    <div class="form-row">
      <div>
        <label for="${FIELD_IDS.name}">Name</label>
        <input id="${FIELD_IDS.name}" type="text" placeholder="e.g. TSB Credit Card"/>
      </div>
      <div>
        <label for="${FIELD_IDS.type}">Type</label>
        <select id="${FIELD_IDS.type}">
          <option value="credit-card">Credit Card</option>
          <option value="loan">Personal Loan</option>
          <option value="mortgage">Mortgage</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>
  `;
},
```

### `setupEventListeners` Change

Replace the `addDebtBtn` handler:
```javascript
// Before:
addDebtBtn.onclick = () => this.toggleDebtForm();

// After:
addDebtBtn.onclick = () => this.openDebtModal();
```

The edit button on each debt card:
```javascript
// Before (inline onclick string in render):
onclick="debtUI.editDebt(${debt.id})"
// editDebt calls toggleDebtForm

// After Phase 11 — editDebt updated to:
editDebt(id) {
  this.openDebtModal(id);
}
```

### `#debtFormContainer` Status in Phase 11

Leave `#debtFormContainer` and `toggleDebtForm()` / `renderDebtForm()` in place. They are removed atomically in Phase 14. Phase 11 only bypasses them by redirecting button handlers to `openDebtModal()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll lock | Custom scroll position save/restore | `modalUI.show()` already does `body.style.overflow='hidden'` | Already implemented and tested in childcare/dashboard modals |
| Esc key close | Custom keydown handler | Already in `modalUI.init()` keydown listener | Duplicate listener causes double-close |
| Focus trapping (full) | Tab-cycle focus trap | Not required for Phase 11 — auto-focus is sufficient | MODAL-04 only requires name field gets focus on open; full trap is UX-01 (future) |
| Overlay HTML | New `<dialog>` element or new overlay div | Existing `#modalOverlay` in `index.html` | Already a direct child of `<body>`, correctly z-indexed, CSS already written |

---

## Common Pitfalls

### Pitfall 1: `modalUI.init()` Not Called
**What goes wrong:** `modalUI.init()` sets up the Esc listener and the X-button onclick. If it is never called, Esc does nothing and the X button does nothing.
**Why it happens:** `app.js` imports `modalUI` but does NOT call `modalUI.init()`. The childcare and dashboard modules call `modalUI.show()` directly without needing init because the X button onclick is set at module evaluation time... actually reading the code: `modalUI.elements.close` is queried at import time and `this.elements.close.onclick = () => this.close()` is set in `init()`. If `init()` is never called, the X button has no handler.
**Verification:** Grep for `modalUI.init()` in the codebase — it is NOT called anywhere. This means the existing childcare/dashboard modals have a latent bug where X-button does nothing (Esc also does nothing). For Phase 11, calling `modalUI.init()` once from `debtUI.init()` fixes this for all modals.
**Warning sign:** X button in any modal does nothing → `init()` was never called.

### Pitfall 2: Backdrop Click Propagation
**What goes wrong:** Click inside `.modal` (e.g., on a form field) dismisses the modal.
**Why it happens:** Click bubbles up through `.modal` to `#modalOverlay`. Without the `e.target === overlay` guard, any click triggers close.
**How to avoid:** Always check `e.target === this.elements.overlay` before calling `this.close()`.

### Pitfall 3: `editingId` Left Set After Dismiss
**What goes wrong:** User opens Edit for debt A, presses Esc, then clicks "Add New Debt" — the modal opens pre-populated with debt A's data.
**Why it happens:** Esc path calls `modalUI.close()` which doesn't know about `editingId`.
**How to avoid:** Wire ALL close paths (X button, backdrop click, Esc) to `_closeDebtModal()` which resets `editingId = null` before calling `modalUI.close()`. For Esc specifically, since `modalUI.init()` uses a direct close call, the safest Phase 11 approach is to not rely on the global Esc handler for debt modal cleanup — instead, set `this.elements.close.onclick` to point to `_closeDebtModal` each time `openDebtModal` is called, and add the backdrop listener pointing to `_closeDebtModal`.

### Pitfall 4: `focus()` Called Before DOM Insertion
**What goes wrong:** `document.getElementById(FIELD_IDS.name)` returns null, `.focus()` throws.
**Why it happens:** `focus()` is called before `modalUI.show()` injects the HTML into `#modalBody`.
**How to avoid:** Call `focus()` after `modalUI.show()` returns — `show()` is synchronous, so the DOM is ready on the next line.

### Pitfall 5: `safeHTML` Strips `<dialog>` Tag
**What goes wrong:** If anyone uses a native `<dialog>` inside `safeHTML`, it is stripped.
**Why it happens:** DOMPurify ALLOWED_TAGS in render.js does not include `dialog`.
**How to avoid:** Not applicable — decision is to use existing `#modalOverlay` div, not `<dialog>`. No action needed.

### Pitfall 6: `modalUI.elements` Queried at Module Evaluation Time
**What goes wrong:** `document.getElementById('modalOverlay')` returns null if called before DOM is ready.
**Why it happens:** `modalUI.elements` is populated at object literal definition time (module top-level), which runs when the ES module is first imported. `render.js` is imported by `app.js` which is a `<script type="module">` — modules are deferred by default, so DOM is ready. This is safe, but confirms init() re-query is a fallback for edge cases.
**How to avoid:** No action needed; current pattern is correct for deferred modules.

---

## Code Examples

### Backdrop Click — Standard Pattern

```javascript
// Source: MDN pattern for modal overlay dismiss
// Added to modalUI.init()
this.elements.overlay.addEventListener('click', (e) => {
  if (e.target === this.elements.overlay) this.close();
});
```

### Auto-Focus After Show

```javascript
// MODAL-04: call after modalUI.show() — show() is synchronous
modalUI.show(title, formHTML, buttons);
document.getElementById(FIELD_IDS.name)?.focus();
```

### Wiring `_closeDebtModal` to the X Button

```javascript
// Inside openDebtModal(), after modalUI.show():
// Override the X button to also clear editingId
if (this.elements.close) {
  // Note: modalUI is a singleton — this persists until next show()
  // which is fine because openDebtModal always re-sets it
  this.elements.close.onclick = () => this._closeDebtModal();
}
```
Note: `modalUI.elements` is the reference to access the close button from within `debtUI`.

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 11 |
|--------------|------------------|---------------------|
| `toggleDebtForm()` shows `#debtFormContainer` inline banner | `openDebtModal()` calls `modalUI.show()` | Old form stays in HTML until Phase 14; redirect button handlers only |
| No focus management | Auto-focus name field after show | Single `.focus()` call satisfies MODAL-04 |
| No backdrop dismiss | Add `click` listener with target guard | ~4 lines in `modalUI.init()` |

---

## Open Questions

1. **Should backdrop click be added to `modalUI.init()` globally or locally per-caller?**
   - What we know: childcare and dashboard modals also use `modalUI` and currently have no backdrop dismiss.
   - What's unclear: Whether backdrop dismiss on those modals is desired or would break anything.
   - Recommendation: Add it to `modalUI.init()` globally — it is universally correct behavior and fixes the silent bug in existing modals too.

2. **`modalUI.init()` call location**
   - What we know: It is not called anywhere currently. X button and Esc do nothing in all existing modals — this is a pre-existing latent bug.
   - Recommendation: Call `modalUI.init()` from `debtUI.init()` as part of Phase 11. This fixes all existing modals as a side effect with zero risk.

3. **Discard-changes guard for empty Add mode**
   - What we know: STATE.md notes this as a blocker concern — `confirm()` should NOT fire for a truly empty form.
   - Phase 11 scope: The Cancel button in Phase 11 just calls `_closeDebtModal()` with no guard (there is no data to lose yet). The guard is a Phase 13 concern when save logic is added.
   - Recommendation: No action in Phase 11.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | None detected — uses Vitest defaults via `"test": "vitest"` in package.json |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODAL-01 | `openDebtModal()` calls `modalUI.show()` and overlay becomes visible | unit | `npx vitest run src/ui/debts.test.js` | ❌ Wave 0 |
| MODAL-02 | Backdrop click calls `modalUI.close()` | unit | `npx vitest run src/ui/debts.test.js` | ❌ Wave 0 |
| MODAL-03 | `document.body.style.overflow` is `'hidden'` while modal open, `''` after close | unit | `npx vitest run src/ui/debts.test.js` | ❌ Wave 0 |
| MODAL-04 | Name field receives `.focus()` after `openDebtModal()` | unit | `npx vitest run src/ui/debts.test.js` | ❌ Wave 0 |

Note: All four behaviors are UI/DOM behaviors that require jsdom (already in devDependencies) and DOM mocking. These are fast unit tests that mock `modalUI` and assert calls.

### Sampling Rate

- **Per task commit:** `npx vitest run src/ui/debts.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/ui/debts.test.js` — covers MODAL-01, MODAL-02, MODAL-03, MODAL-04
- [ ] Vitest environment config for jsdom — add `environment: 'jsdom'` to vitest config or inline `// @vitest-environment jsdom` in test file

---

## Sources

### Primary (HIGH confidence)

- `src/ui/render.js` (lines 64-135) — `modalUI` implementation read directly; scroll lock, close, init, Esc key all confirmed
- `index.html` (lines 409-423) — `#modalOverlay` DOM structure confirmed; is a direct child of `<body>`
- `src/ui/debts.js` — current `toggleDebtForm`, `renderDebtForm`, `editDebt`, `setupEventListeners` read directly
- `src/app.js` — confirmed `modalUI.init()` is never called; confirmed `debtUI` is imported and initialized
- `css/main.css` (lines 307-342) — `.modal-overlay`, `.modal`, `.modal-body`, `.hidden` CSS confirmed

### Secondary (MEDIUM confidence)

- MDN pattern for overlay backdrop dismiss — `e.target === overlay` guard is the universally documented approach (HIGH confidence based on prior knowledge, no live fetch needed for such a fundamental pattern)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries read from source; no external lookups needed
- Architecture: HIGH — `modalUI` API fully read; wiring patterns are direct
- Pitfalls: HIGH — all pitfalls identified from reading actual code paths, not speculation

**Research date:** 2026-03-08
**Valid until:** 2026-06-08 (stable codebase, no time-sensitive APIs)
