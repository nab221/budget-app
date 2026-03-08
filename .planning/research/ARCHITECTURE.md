# Architecture Research

**Domain:** Modal dialog form integration — vanilla JS ES6 module budget app (v2.5)
**Researched:** 2026-03-07
**Confidence:** HIGH (based on direct codebase inspection)

## Context: What Already Exists

This is not a greenfield architecture question. The codebase has everything needed for a clean modal integration:

- A working generic modal system: `modalUI` in `src/ui/render.js` — overlay, title, body, footer slots, ESC key, scroll lock, already in production use
- `templateUI.showModal()` / `templateUI.closeModal()` — a thin bridge already used by `backupUI` and `expensesUI`
- A broken inline debt form at `#debtFormContainer` in index.html, rendered by `debtUI.renderDebtForm()` via innerHTML
- `debtUI` object (module singleton exposed as `window.debtUI`) with state properties: `editingId`, `editingStmtId`, `openLedgerId`, `activeStmtDebtId`
- `debtRepository.add/update` in `src/db/repository.js` with pence conversion and loan-payment side effects already baked in

The v2.5 goal is: replace the inline form with a modal dialog using the existing `modalUI` infrastructure, and add a fourth "Other/Generic" debt type.

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        UI Layer (src/ui/)                         │
├──────────────────┬───────────────────────────────────────────────┤
│   debts.js       │              render.js                         │
│                  │                                                │
│  openDebtModal() │  modalUI.show(title, body, buttons)           │
│  ─ renders form  │  modalUI.close()                              │
│    HTML string   │  ─ overlay, ESC, scroll lock (existing)       │
│  ─ calls repo    │  ─ footer button array API (existing)         │
│  ─ refreshes     │                                                │
│    list on save  │  safeHTML, renderTabSummary (unchanged)        │
└────────┬─────────┴──────────────────────────────────────────────┘
         │ debtRepository.add / update / delete
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Data Layer (src/db/)                        │
│  debtRepository — pence conversion, generateLoanPayments()        │
│  statementRepository — statement CRUD (unchanged)                 │
└──────────────────────────────────────────────────────────────────┘
         │ Dexie.js
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Storage (IndexedDB)                            │
│  db.debts   db.statements   db.recurrentExpenses                  │
└──────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

| Component | File | Responsibility | Change |
|-----------|------|---------------|--------|
| Debt list renderer | `src/ui/debts.js` | Renders debt cards, opens modal, handles delete/ledger | Minor (wire openDebtModal) |
| Debt modal form | `src/ui/debts.js` (same file) | Builds and manages the add/edit form via modalUI | Refactored from inline |
| Generic modal shell | `src/ui/render.js` (modalUI) | Show/hide overlay, inject title/body/footer HTML | Unchanged |
| Debt data access | `src/db/repository.js` (debtRepository) | add/update/delete with pence conversion and side effects | Unchanged |
| HTML shell | `index.html` | Hosts #modalOverlay (already present), #debtFormContainer (to remove) | Remove inline form div |

### Where the Modal Logic Lives

The debt modal logic stays in `src/ui/debts.js`. No new file is needed. Rationale:

- The form logic (`renderDebtForm`, `handleSaveDebt`, `toggleDebtTypeFields`) is already in `debts.js` and shares state with `debtUI.editingId`
- Extracting to a separate `src/ui/debt-modal.js` would require `debtUI` to import it (or vice versa), creating a coupling seam with no benefit at this scale
- All other tab forms (expenses, income, assets) follow the same single-file pattern — consistency matters
- `modalUI` in `render.js` is the shell infrastructure; `debts.js` is the consumer

If the form grows beyond 4 debt types with complex per-type validation logic, extraction to `src/ui/debt-modal.js` becomes worthwhile. Not for v2.5.

## Architectural Patterns

### Pattern 1: Modal-as-Container

**What:** `debtUI.openDebtModal(id)` builds a form HTML string and injects it into `modalUI`'s `#modalBody`. Footer buttons are passed as an array of `{ label, className, onClick }` configs — these are rendered as real DOM nodes with bound JS functions by `modalUI.show()`.

**When to use:** The form content is dynamic (differs for add vs edit, differs per debt type). The modal shell is static and reused.

**Why the array API for footer buttons:** The existing `modalUI.show()` already supports an array-of-button-configs path that creates real DOM elements. This is cleaner than embedding `onclick="debtUI.handleSaveDebt()"` strings in footer HTML — and avoids any edge cases with DOMPurify attribute stripping when content passes through `innerHTML`.

**Example:**
```javascript
// In debtUI — replaces toggleDebtForm() + renderDebtForm()
async openDebtModal(id = null) {
  this.editingId = id;
  let data = { /* defaults */ };
  if (id) {
    const debt = await debtRepository.get(id);
    data = { ...debt, currentBalance: fromPence(debt.currentBalance), /* etc */ };
  }
  const content = this._buildFormHTML(data);   // returns HTML string, all type sections present
  modalUI.show(
    id ? 'Edit Debt Account' : 'Add Debt Account',
    content,
    [
      { label: 'Cancel', className: 'ghost', onClick: () => { this.editingId = null; modalUI.close(); } },
      { label: id ? 'Save Changes' : 'Add Account', className: 'primary', onClick: () => this.handleSaveDebt() }
    ]
  );
  this.toggleDebtTypeFields();  // set initial show/hide state after content is in DOM
}
```

### Pattern 2: DOM Show/Hide for Type Switching

**What:** All four type-specific field sets are rendered into the modal body at once. A `<select onchange>` triggers `debtUI.toggleDebtTypeFields()` to add/remove `hidden` class on the relevant div.

**Why not re-render on type change:** Re-rendering the entire modal body on type switch loses any values already entered in shared fields (name). DOM show/hide preserves all field values across type switches.

**Four types — toggle logic:**
```javascript
toggleDebtTypeFields() {
  const type = document.getElementById('debtTypeInput')?.value;
  if (!type) return;
  document.getElementById('ccOnlyFields')?.classList.toggle('hidden', type !== 'credit-card');
  document.getElementById('loanOnlyFields')?.classList.toggle('hidden', type !== 'loan');
  document.getElementById('mortgageOnlyFields')?.classList.toggle('hidden', type !== 'mortgage');
  document.getElementById('otherFields')?.classList.toggle('hidden', type !== 'other');
}
```

Note: the current code conflates loan and mortgage into one `loanOnlyFields` div. v2.5 separates them since mortgages have a distinct field (property value / ERC) from personal loans. The `<select>` gains a fourth `other` option.

**Trade-off:** Modal body HTML is slightly larger (all four type sections present but three hidden). Irrelevant at this scale.

### Pattern 3: Stateful Module Singleton

**What:** `debtUI.editingId` tracks whether the modal is in add or edit mode. Set before opening the modal, cleared on close or save.

**State inventory for v2.5:**
- `editingId` — null for add mode, debt ID for edit mode; cleared on save or cancel
- `editingStmtId`, `openLedgerId`, `activeStmtDebtId` — unchanged, not involved in debt modal

**On modal close without saving:** The Cancel button's `onClick` must set `this.editingId = null` before calling `modalUI.close()`. The existing `modalUI` close button (the X) also needs to clear `editingId` — wire this via `modalUI.elements.close.onclick` override after `modalUI.show()` is called, or by wrapping `modalUI.show()` in a helper that always registers a cleanup callback.

## Data Flow

### Add Debt Flow

```
User clicks "+ Add Debt Account"
    |
debtUI.openDebtModal(null)
    | editingId = null
    | builds form HTML (empty defaults, all type sections)
    | modalUI.show(title, html, buttons)
    |
User selects type -> debtUI.toggleDebtTypeFields() -> DOM show/hide [no fetch]
    |
User fills fields, clicks "Add Account"
    |
debtUI.handleSaveDebt()
    | reads values from DOM by ID
    | validates (name required, numeric fields)
    | builds payload object (pounds, not pence)
    |
debtRepository.add(payload)
    | toPence() on monetary fields [inside repo]
    | generateLoanPayments() side effect if loan/mortgage
    | triggerSync()
    |
triggerHaptic('success')
editingId = null
modalUI.close()
debtUI.render()         [refreshes debt card list]
window.app.renderAll()  [refreshes dashboard, payoff planner]
```

### Edit Debt Flow

```
User clicks edit button on debt card (event.stopPropagation() to avoid ledger toggle)
    |
debtUI.openDebtModal(id)
    | editingId = id
    | await debtRepository.get(id)   [fetch current values]
    | fromPence() on monetary fields for display
    | builds form HTML (pre-populated, type section visible for existing type)
    | modalUI.show(title, html, buttons)
    |
[same type-switching pattern as add — all sections present, current type visible]
    |
User edits, clicks "Save Changes"
    |
debtUI.handleSaveDebt()
    | same read/validate/build pattern as add
    |
debtRepository.update(editingId, payload)
    | toPence() on monetary fields [inside repo]
    | deleteLinkedExpenses() + generateLoanPayments() if type/payment changed
    | triggerSync()
    |
[same post-save flow as add]
```

### Type Switching (No Async)

```
User changes <select id="debtTypeInput">
    |
onchange -> debtUI.toggleDebtTypeFields()
    | reads select value (synchronous)
    | classList.toggle('hidden') on each of four type-section divs
    | [no fetch, no re-render, field values in other sections preserved]
```

## Recommended Project Structure Change

```
src/
├── ui/
│   ├── debts.js          MODIFIED: replace toggleDebtForm/renderDebtForm
│   │                               with openDebtModal/_buildFormHTML
│   │                               add 'other' type fields and handling
│   ├── render.js         UNCHANGED: modalUI already supports this use case
│   └── templates.js      UNCHANGED: bridge pattern unchanged
├── db/
│   └── repository.js     UNCHANGED: debtRepository API unchanged
index.html                MODIFIED: remove #debtFormContainer div
                                    #modalOverlay already exists and is correct
```

### What Gets Removed

- `#debtFormContainer` div and its `<!-- Form injected by debts.js -->` comment from index.html
- `debtUI.toggleDebtForm()` method — replaced by `modalUI.show/close`
- `debtUI.renderDebtForm()` method — replaced by `debtUI.openDebtModal()` + `debtUI._buildFormHTML()`
- `debtUI.cancelEditDebt()` method — replaced by the Cancel button's onClick in the array API
- The `addDebtBtn.onclick = () => this.toggleDebtForm()` wire in `setupEventListeners()` — replaced by `openDebtModal(null)`

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `debts.js` -> `render.js` (modalUI) | `import { modalUI } from './render.js'` + `modalUI.show()` / `modalUI.close()` | One new import; modalUI is already exported |
| `debts.js` -> `repository.js` | `debtRepository.add/update` — unchanged | Same API, same pence-conversion contract |
| Edit button in card list -> modal | inline `onclick="event.stopPropagation(); debtUI.openDebtModal(${debt.id})"` | Replaces current `debtUI.editDebt(id)` call |
| Add button -> modal | `addDebtBtn.onclick = () => this.openDebtModal(null)` in setupEventListeners | Replaces current `toggleDebtForm()` call |
| Modal save -> list refresh | `debtUI.render()` in handleSaveDebt after await repo call | Existing pattern, unchanged |
| Modal save -> app refresh | `window.app.renderAll()` in handleSaveDebt | Existing pattern, unchanged |

### DOMPurify Note

`safeHTML` is used for the debt card list HTML (the `container.innerHTML = html` assignment in `render()`). The form HTML injected into `modalBody.innerHTML` also goes through DOMPurify via `safeHTML` if the `_buildFormHTML()` method uses it. `onclick` is in `ALLOWED_ATTR` so inline `onchange="debtUI.toggleDebtTypeFields()"` on the type select is preserved.

Footer buttons must use the `modalUI.show()` array API (creates real DOM nodes) rather than HTML strings in the footer parameter — this is the cleaner path and avoids any attribute edge cases.

## Anti-Patterns

### Anti-Pattern 1: Re-rendering the Form on Type Switch

**What people do:** Wire the type `<select>` to re-fetch data and rebuild the entire modal body HTML on each change.

**Why it's wrong:** Loses values the user has already typed in shared fields (name, balance). Creates a flash. Requires another async operation on a trivial UI action.

**Do this instead:** Render all four type sections at once into the modal body. Use `classList.toggle('hidden')` to show/hide sections. This is already how `toggleDebtTypeFields()` works — keep it.

### Anti-Pattern 2: Two Separate Modal Open Methods for Add vs Edit

**What people do:** Write `openAddModal()` and `openEditModal(id)` as separate methods with duplicated form HTML.

**Why it's wrong:** The only structural differences between add and edit are: modal title string, whether fields are pre-populated, and whether `debtRepository.add` or `debtRepository.update` is called. Duplicating the HTML template for this is maintenance overhead.

**Do this instead:** A single `openDebtModal(id = null)` method. `id === null` means add mode. `id` is a number means edit mode. A private `_buildFormHTML(data)` renders the same template either way. `handleSaveDebt()` checks `this.editingId` to choose add vs update.

### Anti-Pattern 3: Bypassing the Repository Layer

**What people do:** Call `db.debts.add(...)` or `db.debts.update(...)` directly from the UI module to avoid "extra layers."

**Why it's wrong:** Bypasses pence conversion, bypasses `generateLoanPayments` side effect (which creates the recurring expense for loan/mortgage), bypasses `triggerSync`. These concerns are correctly encapsulated in the repository.

**Do this instead:** Always go through `debtRepository.add()` and `debtRepository.update()`. They handle all the side effects.

### Anti-Pattern 4: Forgetting to Clear editingId on Modal Dismiss

**What people do:** Wire the modal's Cancel button and X button to just call `modalUI.close()` without clearing `debtUI.editingId`.

**Why it's wrong:** If the user opens edit for debt A, closes without saving, then clicks "+ Add Debt," `editingId` is still set to A's ID. The save call will update A instead of creating a new debt.

**Do this instead:** Every modal close path (Cancel button onClick, X button, ESC key) must call `this.editingId = null` before or alongside `modalUI.close()`. Wire the cleanup via the Cancel button's onClick in the array API, and override `modalUI.elements.close.onclick` after `modalUI.show()` completes.

### Anti-Pattern 5: Keeping #debtFormContainer in HTML Alongside the Modal

**What people do:** Leave the old `#debtFormContainer` div in index.html as a "fallback" while the modal is being built.

**Why it's wrong:** The container will still be present and the old `addDebtBtn` click handler may still reference `toggleDebtForm`. This creates confusion during testing and risks the old code path being triggered.

**Do this instead:** Remove `#debtFormContainer` from index.html in the same commit that wires `openDebtModal()`. The two changes are atomic.

## Build Order

Sequence the work so the app remains functional at each step:

1. **Wire modalUI import into debts.js** — Add `import { modalUI } from './render.js'`. Write `openDebtModal(null)` that calls `modalUI.show()` with a placeholder body. Wire `addDebtBtn.onclick` to it. Verify the modal opens, closes, ESC works.

2. **Port the form HTML into the modal body** — Write `_buildFormHTML(data)` that returns the same HTML as the current `renderDebtForm()` produces, but as a returned string. Keep `toggleDebtTypeFields()` exactly as-is (IDs are unchanged). Remove `toggleDebtForm()` and `renderDebtForm()`. Verify type switching works inside the modal.

3. **Add the "Other/Generic" type section** — New fourth `<option value="other">` in the select, new `#otherFields` div with generic fallback fields (name, balance, notes), extend `toggleDebtTypeFields()`, add the `other` branch in `handleSaveDebt()`. This is new functionality — isolate it from the infrastructure refactor.

4. **Wire save and cancel** — Pass the footer button array to `modalUI.show()`. Ensure `handleSaveDebt()` calls `modalUI.close()` on success. Ensure Cancel clears `editingId`. Ensure the modal X button also clears `editingId`. Test add, edit, and cancel for all four debt types.

5. **Remove the inline form from HTML** — Delete `#debtFormContainer` from index.html. Confirm the page renders without it. Remove `cancelEditDebt()` from debts.js.

6. **Pre-population and validation pass** — Verify edit pre-populates all fields for each debt type. Test the "Discard changes?" guard when opening a second edit while one is in progress. Validate all required fields across all types.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (personal app, 1 user) | Single modal instance, sync DOM reads on save — correct as-is |
| If 5+ debt types added | Extract form builder to `src/ui/debt-modal.js`; keep state in `debtUI` |
| If async validation needed | Disable Save button during repo call; show spinner in button text |

## Sources

- Direct inspection: `src/ui/debts.js` — full `debtUI` object, `renderDebtForm`, `handleSaveDebt`, `toggleDebtTypeFields`
- Direct inspection: `src/ui/render.js` — `modalUI.show()` implementation including array-of-button-configs path
- Direct inspection: `src/ui/templates.js` — `templateUI.showModal` bridge (confirms modal infrastructure is proven in production)
- Direct inspection: `src/ui/backup.js` — `templateUI.showModal()` usage pattern as reference
- Direct inspection: `src/db/repository.js` — `debtRepository` pence fields, `generateLoanPayments` side effect, `deleteLinkedExpenses`
- Direct inspection: `index.html` — `#modalOverlay` structure, `#debtFormContainer` location, `#addDebtBtn` placement
- Direct inspection: `src/app.js` — `debtUI` import and init wiring

---
*Architecture research for: v2.5 debt modal dialog integration, vanilla JS ES6 module budget app*
*Researched: 2026-03-07*
