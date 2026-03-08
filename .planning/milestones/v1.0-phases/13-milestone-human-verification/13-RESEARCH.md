# Phase 13: Save, Edit, and Validation - Research

> **NOTE:** This file is at a legacy path. The canonical research file for Phase 13 (v2.5 milestone)
> is at `.planning/milestones/v2.5-phases/13-save-edit-and-validation/13-RESEARCH.md`.
> This file is kept here to satisfy the output path contract from the research agent invocation.

**Researched:** 2026-03-08
**Domain:** Vanilla JS form wiring — save handler, field pre-population for Edit mode, inline validation errors, modal button lifecycle
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADD-01 | User can add a new debt — clicking Add saves the form and closes the modal | `_saveDebt()` reads FIELD_IDS inputs, builds payload by type, calls `debtRepository.add()`, then `_closeDebtModal()` + `render()` |
| ADD-02 | Validation errors appear inline below the relevant field (not as alert popups) | Error `<span>` siblings injected next to each required field; existing `alertWithHaptic` pattern explicitly replaced by inline spans |
| ADD-03 | Form opens empty/reset each time Add New Debt is clicked | `openDebtModal()` with `id = null` — `_buildFormHTML()` always returns a fresh template with no `value=` attributes; `modalUI.show()` overwrites `body.innerHTML` each call |
| EDIT-01 | User can save an edited debt — clicking Save works for all debt types and closes the modal | Same `_saveDebt()` handler; branches on `this.editingId` to call `debtRepository.update()` instead of `add()` |
| EDIT-02 | All fields are pre-populated from the existing debt data when the edit modal opens | After `modalUI.show()`, `openDebtModal(id)` reads full debt record and sets `.value` on each FIELD_IDS input for the appropriate type |
</phase_requirements>

---

## Summary

Phase 13 wires the save path for the new debt modal built in Phases 11 and 12. All the scaffolding is complete: the modal opens, the fieldsets show and hide correctly, `FIELD_IDS` maps every input to a stable ID, and `debtRepository.add`/`update` accept plain-float payloads and convert to pence internally. Phase 13 adds three things: (1) a `_saveDebt()` method that reads the active fieldset's inputs and calls the repository, (2) a Save/Add button wired into the modal's footer button array, and (3) Edit mode pre-population that sets input `.value` properties from the fetched debt record after the modal opens.

Inline validation is the only new UI pattern. The project currently uses `alertWithHaptic()` for save errors (popup). ADD-02 requires replacing this with inline `<span>` error messages inserted beneath failing fields. The error spans must be injected into the live DOM after `modalUI.show()` sets `body.innerHTML`, and must be cleared at the start of each save attempt. This is a standard DOM-write pattern with no new dependencies.

The old `handleSaveDebt()` method and the old inline form (`renderDebtForm`, `toggleDebtForm`) remain in place until Phase 14 cleanup. Phase 13 must not call or depend on those methods.

**Primary recommendation:** Add `_saveDebt()` and `_populateEditFields()` methods to `debtUI`, wire the Save/Add button into the `buttons` array passed to `modalUI.show()`, and implement inline error display as a helper `_showFieldError(fieldId, message)` that inserts a `<span class="field-error">` after the field element.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^3.0.7 | Unit testing | Already installed; all existing tests use it |
| jsdom | ^28.1.0 | DOM environment for tests | Already installed; established in debts.test.js |

**No new installs required.**

---

## Architecture Patterns

### Pattern 1: Save Handler Structure

`_saveDebt()` is the single entry point for both Add and Edit:
1. Clears all previous inline error spans.
2. Reads `name` and `type` from FIELD_IDS inputs.
3. Validates `name` — required for all types.
4. Branches on `type` to read the appropriate fieldset's inputs.
5. If validation failed, returns (errors shown inline).
6. Calls `debtRepository.add(payload)` or `debtRepository.update(this.editingId, payload)`.
7. On success: `triggerHaptic('success')`, `_closeDebtModal()`, `this.render()`, `window.app?.renderAll()`.

### Pattern 2: Footer Button Array with Save Button

```javascript
const isEdit = id !== null;
const buttons = [
  { label: 'Cancel', className: 'ghost', onClick: () => this._closeDebtModal() },
  { label: isEdit ? 'Save' : 'Add', className: 'primary', onClick: () => this._saveDebt() },
];
modalUI.show(title, formHTML, buttons);
```

### Pattern 3: Edit Mode Field Pre-Population (EDIT-02)

`_populateEditFields(debt)` called after `modalUI.show()` + `_onTypeChange()`. Uses `fromPence()` for the 5 pence-stored fields (`currentBalance`, `creditLimit`, `originalPrincipal`, `fixedMonthlyPayment`, `earlyRepaymentFee`). Rates, terms, and boolean flags are stored as-is.

### Pattern 4: Inline Field Error Display

```javascript
_showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const span = document.createElement('span');
  span.className = 'field-error';
  span.textContent = message;
  field.insertAdjacentElement('afterend', span);
},

_clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.remove());
},
```

### Pattern 5: Form Reset (ADD-03)

Already satisfied by architecture: `_buildFormHTML()` returns a template with no `value=` attributes. `modalUI.show()` overwrites `body.innerHTML` each call. No explicit reset logic needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pence conversion | Custom `* 100` in save handler | `debtRepository.add/update` built-in | Repository calls `toPence()` on pence fields; double-convert causes 100x errors |
| Modal close-after-save | Custom overlay hide | `_closeDebtModal()` | Resets `editingId` and calls `modalUI.close()` |
| Alert on validation | `alert()` or `alertWithHaptic()` | `_showFieldError()` inline spans | ADD-02 requirement |
| Button wiring | `onclick` attributes in HTML | `buttons` array to `modalUI.show()` | Creates real DOM buttons with closures |

---

## Common Pitfalls

### Pitfall 1: Double-Pence Conversion on Edit
Pass plain floats (GBP) to `debtRepository`. The 5 registered pence fields are converted automatically. Always `parseFloat(el.value) || 0` — never pass raw string or already-pence value.

### Pitfall 2: `minPayment` Not in Repo Pence List
`ccMinPaymentInput` maps to `minPayment` but this key is NOT in the repository's pence fields list. Store as plain float (GBP pounds). Same applies to `propertyValue` for mortgage.

### Pitfall 3: `_clearFieldErrors()` Timing
Call at the top of every `_saveDebt()` invocation, not only on modal close.

### Pitfall 4: `_populateEditFields()` Sequencing
Must run AFTER `modalUI.show()`. Call order: `show()` → `focus()` → Esc wiring → `debtRepository.get()` → set type → `_onTypeChange()` → `_populateEditFields(debt)`.

### Pitfall 5: `apr` Sync for Loan/Mortgage
Set `payload.apr = interestRate` when saving loan or mortgage (matches old `handleSaveDebt()` behavior for strategy sort).

---

## Field-to-DB Mapping Reference

**Repository pence fields (auto-converted):** `currentBalance`, `creditLimit`, `originalPrincipal`, `fixedMonthlyPayment`, `earlyRepaymentFee`.

**Non-pence fields (stored as-is):** `apr`, `interestRate`, `termMonths`, `promoEndDate`, `postPromoApr`, `minPayment`, `propertyValue`, `earlyRepaymentFeeIsPercent`, `earlyRepaymentAllowed`, `isInterestOnly`.

---

## Validation Architecture

> `nyquist_validation` is not set in `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.7 |
| Config file | none — reads from `package.json` |
| Quick run command | `npx vitest run src/ui/debts.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADD-01 | `_saveDebt()` Add mode calls `debtRepository.add()` with correct payload | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| ADD-02 | Empty name: `add` NOT called, `.field-error` span appears below name input | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| ADD-03 | `openDebtModal()` Add mode: all inputs have empty/zero values | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| EDIT-01 | `_saveDebt()` Edit mode calls `debtRepository.update(editingId, payload)` for each type | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| EDIT-02 | `openDebtModal(id)` sets input values from fetched debt record (pence converted) | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |

### Sampling Rate
- **Per task commit:** `npx vitest run src/ui/debts.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — `src/ui/debts.test.js` exists with all mocks in place.

---

## Sources

### Primary (HIGH confidence)
- `src/ui/debts.js` (direct read, 2026-03-08) — FIELD_IDS, `openDebtModal()`, old `handleSaveDebt()`, `renderDebtForm()`, `_buildFormHTML()`
- `src/ui/render.js` (direct read, 2026-03-08) — `modalUI.show()` synchronous; footer button array creates DOM buttons with closures; ALLOWED_ATTR confirmed
- `src/db/repository.js` (direct read, 2026-03-08) — `debtRepository` pence fields list; `generateLoanPayments` auto-called for loan/mortgage
- `src/db/schema.js` (direct read, 2026-03-08) — v15 schema; `propertyValue`/`minPayment` not indexed
- `src/ui/debts.test.js` (direct read, 2026-03-08) — mock infrastructure; all stubs confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies
- Architecture: HIGH — all patterns derive directly from existing code
- Field-to-DB mapping: HIGH — repository pence field list read from source
- Pitfalls: HIGH — concrete code-level risks confirmed by reading implementation

**Research date:** 2026-03-08
**Valid until:** 2026-09-08
