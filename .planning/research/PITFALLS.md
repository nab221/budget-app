# Pitfalls Research

**Domain:** Vanilla JS modal form with type-specific field switching — Debt Tab UX Overhaul (v2.5)
**Researched:** 2026-03-07
**Confidence:** HIGH (codebase-verified bugs, confirmed by reading debts.js directly); MEDIUM (modal accessibility and form state patterns — standard web platform behavior)

---

## Critical Pitfalls

### Pitfall 1: Unclosed HTML Div Swallows Action Buttons Into a Conditional Field Group

**What goes wrong:**
The `renderDebtForm()` function in `debts.js` injects HTML with an unclosed `<div id="loanOnlyFields">`. The closing `</div>` for that container is missing. As a result, the HTML parser promotes the action buttons row (Save/Cancel) into the loan fields container. The buttons only appear when `loanOnlyFields` is visible — i.e., when debt type is "loan" or "mortgage". For credit card type (the default), the buttons are inside a `hidden` div and are never seen. This is the root cause of "Edit shows only name/type with no save button."

**Why it happens:**
Template-literal HTML strings with nested conditionally-hidden divs are hard to visually balance. A closing tag gets dropped during a refactor and there is no compiler or linter to catch it. The bug is invisible in the source code because template literals don't enforce structure.

**How to avoid:**
In the modal replacement, write each type-specific fieldset as a named fragment with explicit open/close comments:
```html
<!-- BEGIN: credit-card fields -->
<div id="ccFields" class="field-group hidden">...</div>
<!-- END: credit-card fields -->
<!-- BEGIN: mortgage fields -->
<div id="mortgageFields" class="field-group hidden">...</div>
<!-- END: mortgage fields -->
<!-- Action row is OUTSIDE all fieldsets -->
<div class="form-actions">...</div>
```
Keep the action row (`<dialog>` footer or a dedicated `.modal-footer` element) completely separate from the conditional fieldset area. Never nest action buttons inside a conditional visibility container.

**Warning signs:**
- Save/Cancel buttons are missing for one debt type but visible for another
- Buttons appear after switching type selector but disappear when switching back
- DevTools shows the button elements inside a `hidden` parent

**Phase to address:** Modal scaffold phase — define the modal HTML structure with explicit fieldset boundaries before writing any JS

---

### Pitfall 2: Type-Switch Show/Hide State Not Reset When Modal Opens

**What goes wrong:**
If the modal is built by injecting HTML into a container (the current approach) or by re-using a persistent `<dialog>` element, the visible/hidden state of type-specific fieldsets can be stale when the modal opens for a new debt. Example: user opens Add modal for a credit card (credit card fields visible), saves it, then opens Add modal again and selects "mortgage" — at this point the `ccOnlyFields` div should hide and `loanOnlyFields` should show, but if `toggleDebtTypeFields()` is not called during initial render the old state persists. On first open this is not an issue, but after the second open the initial type display can be wrong.

**Why it happens:**
Developers call `toggleDebtTypeFields()` only from the `onchange` event on the type selector. They forget to call it once during form initialization to set the correct initial state for the pre-selected type. For edit mode (where a type is pre-selected), the fieldsets must reflect that type immediately without user interaction.

**How to avoid:**
After injecting the modal HTML or pre-populating fields for edit mode, explicitly call the field-visibility function once:
```js
renderDebtForm();          // inject HTML + set select value
toggleDebtTypeFields();    // apply visibility for the current type immediately
```
Do this at the end of the open/populate flow, not at the start. The select value must already be set before the toggle reads it.

**Warning signs:**
- Edit modal opens for a mortgage but shows credit card fields
- Switching type selector and switching back does not restore the correct set of fields
- Fields from the previous open are visible when opening a fresh Add modal

**Phase to address:** Field-switching logic phase — include an "initialize visibility on open" step in the implementation plan

---

### Pitfall 3: Edit Mode Does Not Pre-Populate Type-Specific Fields Because It Reads the Wrong Element IDs

**What goes wrong:**
The existing `handleSaveDebt()` reads form values from element IDs like `debtAprInput`, `debtLimitInput`, `loanPrincipalInput`. These IDs are injected by `renderDebtForm()`. If the modal uses a persistent `<dialog>` (not re-injected HTML), the inputs are created once and their IDs must match exactly. A mismatch — e.g., renaming an input during the modal rebuild — causes `document.getElementById()` to return `null`, and `parseFloat(null.value)` throws. The save silently fails or produces NaN values written to the database.

**Why it happens:**
Input IDs are defined in two places: the HTML template (in `renderDebtForm`) and the read-back logic (in `handleSaveDebt`). These drift apart during refactoring. In the inline-form architecture there is no compile-time check, so a typo in one place is only caught at runtime.

**How to avoid:**
Define input IDs as named constants at the top of the module:
```js
const FIELD_IDS = {
  name: 'debtModal-name',
  type: 'debtModal-type',
  ccBalance: 'debtModal-cc-balance',
  ccApr: 'debtModal-cc-apr',
  // ...
};
```
Reference these constants in both the HTML template string and the save handler. A missing constant reference will be `undefined` rather than a silently wrong string, making the error obvious.

**Warning signs:**
- Save produces `0` values for all numeric fields despite the user filling them in
- `document.getElementById('someInputId')` returns `null` in DevTools console
- Edit modal pre-populates some fields but not others

**Phase to address:** Modal scaffold phase — establish canonical IDs before writing either the template or the save handler

---

### Pitfall 4: Inline `onclick` Attribute Handlers Require `window.debtUI` to Be Synchronously Available

**What goes wrong:**
The current form uses `onchange="debtUI.toggleDebtTypeFields()"` and `onclick="debtUI.handleSaveDebt()"` inline in injected HTML. These resolve `debtUI` against `window` at event time. In the current code, `window.debtUI = debtUI` is set at module bottom, so it works. But if any refactor moves the modal open call earlier in the module load sequence — or if the modal HTML is injected before `window.debtUI` is assigned — these handlers throw `ReferenceError: debtUI is not defined`.

**Why it happens:**
Inline `onclick` attributes are global namespace lookups. ES module scope is not available to inline handlers. This is a long-standing vanilla JS constraint that becomes a pitfall when mixing module-scoped objects with inline-HTML event wiring.

**How to avoid:**
After injecting modal HTML, wire all events programmatically using `addEventListener` on the specific elements:
```js
document.getElementById(FIELD_IDS.type).addEventListener('change', () => toggleDebtTypeFields());
document.getElementById('debtModal-save').addEventListener('click', () => handleSaveDebt());
```
This keeps all event wiring in JS scope where the module object is accessible, and removes the dependency on `window` global exposure for form events. The `window.debtUI` global can be kept for external callers (edit button on debt cards) but should not be relied on for internal modal wiring.

**Warning signs:**
- `ReferenceError: debtUI is not defined` in console when interacting with form
- Type selector change does nothing — no visible field switch
- Save button click does nothing and no error is thrown (handler registered but references wrong scope)

**Phase to address:** Modal scaffold phase — establish event wiring pattern before implementing any field logic

---

### Pitfall 5: Data Loss When Add Modal Is Dismissed Then Re-Opened

**What goes wrong:**
The current inline form approach calls `renderDebtForm()` every time the form is shown. This resets all inputs to blank/default values. If a user partially fills an Add form (e.g., enters name and balance), closes it by clicking "Hide", then re-opens it, all their input is gone. For a modal, the same issue occurs if the open function re-injects HTML rather than just showing the dialog.

**Why it happens:**
Re-injecting innerHTML is the simplest way to reset a form to a known state. Developers do this to avoid having to explicitly reset each field. The cost — silent data loss on dismiss — is only noticed by users who cancel and retry.

**How to avoid:**
For a `<dialog>` modal: use `dialog.showModal()` and `dialog.close()` for open/close. Only reset form fields explicitly (via `form.reset()` or manual field clearing) when opening a fresh Add flow, not on close. This preserves partial input if the user accidentally dismisses. For Edit mode, always overwrite all fields on open. Consider a light warning on dismiss if any field has been modified from its initial state.

**Warning signs:**
- User reports "I had to fill in the form twice" — dismissed and re-opened
- Opening the Add modal always shows blank fields even after a previous partial fill
- The cancel button and the dismiss-by-clicking-backdrop produce different results

**Phase to address:** Modal open/close logic phase — establish a clear contract: "reset on open for Add, reset on open for Edit (to DB values), never reset on close"

---

### Pitfall 6: Edit Mode Partially Pre-Populates — Fields Not in the Active Fieldset Are Missed

**What goes wrong:**
When editing a credit card debt, only the credit card fieldset is visible. The loan fieldset inputs (`loanPrincipalInput`, `loanTermInput`, etc.) are hidden but still present in the DOM. On save, `handleSaveDebt()` reads the active type's inputs and ignores the hidden fieldset entirely. This is correct behavior. The pitfall is the reverse: if the user switches type during edit (credit card → mortgage), the mortgage fields need to be populated from the debt's existing loan data, but they start blank. The user can accidentally save a mortgage record with all-zero loan fields if they simply switch type and click Save without filling in anything.

**Why it happens:**
Pre-population in `renderDebtForm()` populates all inputs at inject-time regardless of type, which is correct. But if the form is a persistent `<dialog>` that is not re-injected on open, the populate step must explicitly write to every input in all fieldsets, not just the currently visible one.

**How to avoid:**
Always populate all fieldsets on modal open, not just the currently active one. The hidden fields are in the DOM and their values persist. When saving, read only from the active type's fieldset (current behavior is correct) — but on populate, write to all of them:
```js
// Always set all inputs, even in hidden fieldsets
document.getElementById(FIELD_IDS.ccBalance).value = toGBP(debt.currentBalance);
document.getElementById(FIELD_IDS.loanPrincipal).value = toGBP(debt.originalPrincipal);
// ... etc for every field
```

**Warning signs:**
- Switching type during edit clears the destination fieldset to zeros
- Editing a debt that was previously a different type shows zeros in type-specific fields
- Saving after a type switch produces a record with mostly zero values

**Phase to address:** Edit mode pre-population phase — write a populate function that always targets all inputs, not just the visible fieldset

---

### Pitfall 7: Modal Backdrop Click Dismisses Without Confirmation, Losing Edit Changes

**What goes wrong:**
The HTML `<dialog>` element fires a `cancel` event and closes itself when the user presses Escape. Clicking outside the dialog (on the backdrop `::backdrop`) does not close it by default, but developers often add a `click` handler on the dialog element itself to catch backdrop clicks and call `dialog.close()`. Without a "discard changes?" prompt, the user loses an in-progress edit with no warning.

**Why it happens:**
The Escape key `cancel` event and the backdrop click both feel like "dismiss" to the user. Developers implement dismiss-on-backdrop because users expect it. The confirmation step is forgotten because it requires intercepting both paths.

**How to avoid:**
Handle `cancel` event (Escape key) explicitly:
```js
dialog.addEventListener('cancel', (e) => {
  if (hasUnsavedChanges()) {
    e.preventDefault();
    if (confirm('Discard changes?')) dialog.close();
  }
});
```
For backdrop click, compare the click target to the dialog element itself:
```js
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) {  // clicked backdrop, not dialog content
    if (hasUnsavedChanges()) {
      if (!confirm('Discard changes?')) return;
    }
    dialog.close();
  }
});
```
For Edit mode, "has unsaved changes" means any field differs from its pre-populated value. For Add mode, "has unsaved changes" means any field is non-empty/non-zero.

**Warning signs:**
- Pressing Escape during edit immediately closes modal with no prompt
- User clicks slightly outside dialog and loses everything
- Add flow has no dismiss protection at all (because `editingId` is null, current code skips the confirm)

**Phase to address:** Modal open/close logic phase — implement dismiss guards before wiring any save logic

---

### Pitfall 8: `debtFormContainer` Banner Position Causes User Confusion — Not a Code Bug, a Layout Bug

**What goes wrong:**
In the current HTML, `#debtFormContainer` appears above `#addDebtBtn`. When the user clicks Add, the form expands above the button and shifts the button and debt list downward. The user's eye is at the button location; the form appears above it. On mobile, this pushes the button off-screen. The user may think nothing happened.

**Why it happens:**
Inline forms placed above the triggering button are conventional in some designs, but on mobile they require a scroll-up to find the newly-appeared form — the opposite direction from the user's intent. A modal overlay eliminates this entirely by centering over the viewport.

**How to avoid:**
The modal approach (`<dialog>`) solves this structurally — the dialog overlays the viewport at center regardless of where the trigger button is. Ensure the modal is appended to `document.body` (or is a direct child of body) rather than nested inside a scrolling tab panel, which would constrain the `::backdrop` and stacking context.

**Warning signs:**
- After clicking Add, the form appears but the user's viewport position doesn't scroll to it
- On mobile, user taps Add then sees nothing change (form appeared above scroll position)
- The tab panel container has `overflow: hidden` or `position: relative` — these limit `<dialog>` backdrop coverage

**Phase to address:** Modal scaffold phase — place `<dialog>` as direct body child; do not nest inside tab panels

---

### Pitfall 9: `window.editDebt` Global Survives Re-Renders But Closes Over Stale State

**What goes wrong:**
The `window.editDebt = (id) => this.editDebt(id)` global is set in `setupEventListeners()`, which runs once on init. The closure over `this` (the `debtUI` object) is stable because `debtUI` is a singleton. This is fine. The risk is if a refactor moves the global assignment inside `render()` — then each render creates a new closure and the old one on `window` is replaced. During a render, if a card's onclick fires mid-replacement, it might call a stale or undefined function.

**Why it happens:**
Moving event wiring into render functions is a common refactoring mistake when trying to keep everything in one place. It feels simpler but creates timing issues and multiple assignments to the same global.

**How to avoid:**
Keep `window.editDebt`, `window.deleteDebt`, `window.toggleLedger` assignments strictly in `init()` / `setupEventListeners()`, never in `render()`. These globals are stable references to the singleton's methods and should never change after init.

**Warning signs:**
- Edit button works for the first debt card but not for subsequent ones after re-render
- Console shows `window.editDebt` is `undefined` after navigation away and back to the tab
- Multiple renders cause the global to be reassigned repeatedly (detectable via breakpoint)

**Phase to address:** Modal scaffold phase — audit global assignment locations during the refactor

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Re-inject full modal HTML on every open | Simple reset to known state | Data loss on dismiss; no field animation; re-wires all event listeners | Acceptable for MVP if dismiss protection is added |
| Inline `onchange`/`onclick` in injected HTML strings | No separate wiring step | Depends on `window` globals; breaks if module load order changes; untestable | Never for new code — use `addEventListener` after injection |
| Single `currentBalance` field shared between CC and loan (overloaded) | One save path | CC balance and loan remaining balance are semantically different; mixing causes downstream calc errors in payoff planner | Never — use distinct field IDs per type |
| `confirm()` for unsaved-changes guard | Zero dependencies | Blocks the main thread; cannot be styled; disruptive on mobile | Acceptable for this app's scope — no need for a custom confirm modal |
| Reading form fields by `document.getElementById` in save handler | Simple, direct | Couples save handler to DOM structure; any rename breaks silently | Acceptable if field IDs are defined as named constants |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `<dialog>` element + tab panel `overflow: hidden` | Dialog backdrop clips to the overflow boundary of the parent tab panel | Place `<dialog>` as a direct child of `<body>`, not inside the tab panel div |
| `<dialog>` + `form method="dialog"` | Using `<form method="dialog">` auto-closes dialog on submit, bypassing async save logic | Do not use `method="dialog"`; handle submit manually via `addEventListener('click')` on the save button |
| `debtRepository.update()` + pence conversion | Passing raw float pounds to repository that expects pence — or vice versa — produces 100x wrong values | Establish a clear boundary: all repository calls use pence; all form inputs use pounds; convert at the save handler boundary only |
| `safeHTML` template tag + dynamic form HTML | `safeHTML` escapes values but does not validate HTML structure — a missing `</div>` still produces malformed output | Use `safeHTML` for user-visible values only; do not use it to escape the structural HTML of the form template itself |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calling `debtRepository.getAll()` + `statementRepository.getAll()` on every modal open | Visible delay before modal appears; blocking UI on slow devices | Cache debt data in the modal open call; pass the debt object directly to the pre-populate function rather than re-fetching by ID | Not a real issue at <50 debts; noticeable at no realistic scale for this app — moot |
| Re-calling `this.render()` (full debt list re-render) after every modal close | Debt list flickers on every add/save/cancel | Only re-render after a successful save, not on cancel | Immediately noticeable on modal dismiss |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual indication which fields are required | User submits with missing name; gets an alert after the fact | Mark required fields with `*` in label; show inline validation on blur |
| Type selector defaults to Credit Card even when editing a mortgage | User must re-select type when editing a non-CC debt (if type is not pre-populated) | Always pre-select the saved debt type; initialize fieldset visibility immediately after pre-selection |
| "Add Account" button label on edit form (current bug) | User editing an existing debt sees "Add Account" as the submit label, which is misleading | Conditionally set button label: `isUpdate ? 'Save Changes' : 'Add Account'` — current code does this, but the button is hidden due to the unclosed-div bug |
| Modal opens but focus stays on the background | Screen reader / keyboard user cannot interact with modal fields | Call `dialog.showModal()` (native implementation moves focus into dialog); ensure the first focusable element in the modal gets focus on open |
| Save button shows no loading state during async DB write | User double-clicks Save; two records are created | Disable save button during async operation; re-enable on success or error |

---

## "Looks Done But Isn't" Checklist

- [ ] **Unclosed div fix:** Verify Save/Cancel buttons are visible for ALL debt types (credit card, mortgage, loan) — not just one
- [ ] **Type-switch initialization:** Open Add modal, confirm credit card fields are shown without touching the type selector
- [ ] **Edit pre-population:** Edit a mortgage; confirm all mortgage fields are pre-filled (not zero)
- [ ] **Edit pre-population cross-type:** Edit a credit card; confirm credit card fields are pre-filled; switch type to mortgage — mortgage fields should show empty/zero (no stale CC values)
- [ ] **Dismiss protection (edit):** Open Edit modal, change a field, press Escape — confirm "Discard changes?" prompt appears
- [ ] **Dismiss protection (add):** Open Add modal, type a name, click backdrop or Escape — confirm prompt appears
- [ ] **Backdrop vs dialog click:** Click inside the modal content area — confirm it does NOT dismiss; click the backdrop — confirm it does (with prompt)
- [ ] **Add success → clean re-open:** Save a new debt, click Add again — confirm modal opens with blank fields, not the previous entry's values
- [ ] **Mobile layout:** Open modal on 375px viewport — confirm all fields are visible; confirm modal does not extend off-screen
- [ ] **Keyboard navigation:** Tab through all visible fields in order; confirm no hidden fields receive focus

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Unclosed div swallowing Save button | LOW | Add the missing `</div>` closing tag for `loanOnlyFields` in the HTML template; verify with DevTools Elements panel |
| Type-switch not initializing on open | LOW | Add `toggleDebtTypeFields()` call at end of `renderDebtForm()` or `openModal()` |
| Edit not pre-populating type-specific fields | LOW | Ensure populate function writes to all inputs regardless of which fieldset is currently hidden |
| Backdrop click dismissing without confirm | MEDIUM | Add `cancel` event handler (Escape) and `click` handler (backdrop) with unsaved-changes check |
| Inline onclick not working after refactor | MEDIUM | Replace all inline `onchange`/`onclick` in injected HTML with `addEventListener` calls after injection |
| Modal nested in tab panel breaking backdrop | LOW | Move `<dialog>` element to `<body>` in `index.html`; reference from JS via `document.getElementById` |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Unclosed div / missing Save button | Modal scaffold — define HTML structure with explicit fieldset boundaries | Open modal for each debt type; Save button must be visible for all |
| Inline onclick globals | Modal scaffold — establish addEventListener-based wiring pattern | No `onclick=` attributes in injected modal HTML |
| Field ID drift | Modal scaffold — define FIELD_IDS constants before writing template or save handler | Save handler uses only constants, not string literals for getElementById |
| Type-switch not initializing | Field-switching logic phase | Open Add modal; credit card fields show without user interaction |
| Edit pre-population gaps | Edit mode pre-population phase | Edit each debt type; all fields pre-filled correctly |
| Backdrop dismiss without confirm | Modal open/close logic phase | Escape and backdrop click show confirm prompt when fields are dirty |
| Add modal re-open data loss | Modal open/close logic phase | Dismiss and re-open Add modal; fields are blank (for add) or preserved (optional) |
| Type switch during edit zeros out fields | Edit mode pre-population phase | Switch type on edit modal; new type fields show DB values, not zeros |
| Banner layout confusion | Modal scaffold phase — use `<dialog>` at body level | Modal appears centered on viewport regardless of scroll position |
| Double-save on slow connection | Save handler phase | Disable Save button on first click; re-enable after response |

---

## Sources

- `src/ui/debts.js` — direct code inspection; unclosed div confirmed at line 246; missing `</div>` for `loanOnlyFields` container
- `index.html` lines 283–301 — confirmed `debtFormContainer` placement above `addDebtBtn`; dialog is not yet used
- `.planning/debug/debt-ui-consolidation-failure.md` — historical evidence of disconnected form/container architecture
- `.planning/debug/debt-id-mismatch-and-save-error.md` — Dexie transaction table scope bug (separate from modal, but confirms save handler fragility pattern)
- [MDN — HTMLDialogElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement) — `showModal()`, `cancel` event, backdrop behavior
- [MDN — `<dialog>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) — `method="dialog"` behavior and focus management
- [HTML Spec — dialog cancel event](https://html.spec.whatwg.org/multipage/interactive-elements.html#canceling-dialogs) — Escape key handling
- Known vanilla JS pattern: inline `onclick` resolves against `window` scope, not module scope

---
*Pitfalls research for: v2.5 Debt Tab UX Overhaul — Modal Form with Type-Specific Fields*
*Researched: 2026-03-07*
