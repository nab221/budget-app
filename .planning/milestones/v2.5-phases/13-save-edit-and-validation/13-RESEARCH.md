# Phase 13: Save, Edit, and Validation - Research

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

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMPurify (via safeHTML) | ^3.2.4 | Sanitizes form HTML | Already wired; `safeHTML` template tag handles all innerHTML; error spans injected via `createElement` so no sanitization needed |
| `debtRepository` | — | IndexedDB add/update | Already imported in debts.js; accepts plain-float values and converts to pence internally via `toPence()` |

**No new installs required.**

---

## Architecture Patterns

### Pattern 1: Save Handler Structure

`_saveDebt()` is the single entry point for both Add and Edit. The function:
1. Clears all previous inline error spans.
2. Reads `name` and `type` from their FIELD_IDS inputs.
3. Validates `name` — required for all types.
4. Branches on `type` to read the appropriate fieldset's inputs.
5. Validates type-specific required fields.
6. If any validation failed, stops and returns (errors already shown inline).
7. Calls `debtRepository.add(payload)` or `debtRepository.update(this.editingId, payload)`.
8. On success: `triggerHaptic('success')`, `_closeDebtModal()`, `this.render()`, `window.app?.renderAll()`.
9. On repository error: shows a single top-level inline error (not alert).

```javascript
// Pattern: _saveDebt() skeleton (src/ui/debts.js)
async _saveDebt() {
  this._clearFieldErrors();

  const name = document.getElementById(FIELD_IDS.name)?.value.trim();
  const type = document.getElementById(FIELD_IDS.type)?.value;

  let valid = true;
  if (!name) {
    this._showFieldError(FIELD_IDS.name, 'Name is required');
    valid = false;
  }

  let payload = { name, debtType: type };

  if (type === 'credit-card') {
    // read ccBalance, ccApr, ccLimit, ccMinPayment, ccPromoEnd, ccPostApr
    // no required numeric validation needed beyond name
    payload = { ...payload, currentBalance, apr, creditLimit, minPayment, promoEndDate, postPromoApr };
  } else if (type === 'mortgage') {
    // read mortgagePropertyValue, mortgageBalance, mortgageTerm, mortgageRate, mortgageErc
    payload = { ...payload, propertyValue, currentBalance, termMonths, interestRate, earlyRepaymentFee };
  } else if (type === 'loan') {
    // read loanOriginal, loanBalance, loanTerm, loanRate
    payload = { ...payload, originalPrincipal, currentBalance, termMonths, interestRate };
  } else {
    // read otherBalance
    payload = { ...payload, currentBalance };
  }

  if (!valid) return;

  try {
    if (this.editingId) {
      await debtRepository.update(this.editingId, payload);
    } else {
      await debtRepository.add(payload);
    }
    triggerHaptic('success');
    this._closeDebtModal();
    await this.render();
    window.app?.renderAll();
  } catch (err) {
    console.error('Failed to save debt:', err);
    this._showFieldError(FIELD_IDS.name, 'Save failed: ' + err.message);
  }
},
```

### Pattern 2: Footer Button Array with Save Button

`openDebtModal()` currently passes only a Cancel button. Phase 13 adds the primary action button:

```javascript
// Pattern: openDebtModal() buttons array (Phase 13 update)
const isEdit = id !== null;
const buttons = [
  { label: 'Cancel', className: 'ghost', onClick: () => this._closeDebtModal() },
  { label: isEdit ? 'Save' : 'Add', className: 'primary', onClick: () => this._saveDebt() },
];
modalUI.show(title, formHTML, buttons);
```

`modalUI.show()` creates real `<button>` DOM elements from this array with `btn.onclick` set to the `onClick` function — no inline `onclick` attribute needed, no XSS exposure. Confirmed in `render.js` lines 112–128.

### Pattern 3: Edit Mode Field Pre-Population (EDIT-02)

After `modalUI.show()` and after `_onTypeChange()` reveals the correct fieldset, `openDebtModal(id)` calls `_populateEditFields(debt)`. This method sets `.value` on each of the visible fieldset's inputs using `fromPence()` for money fields (since the DB stores pence) and direct string assignment for rate/term fields.

```javascript
// Pattern: _populateEditFields() (src/ui/debts.js)
_populateEditFields(debt) {
  // Always populate name and type (already set for _onTypeChange, but explicit here)
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };

  set(FIELD_IDS.name, debt.name);
  // type already set before _onTypeChange() call

  const type = debt.debtType;
  if (type === 'credit-card') {
    set(FIELD_IDS.ccBalance,    fromPence(debt.currentBalance));
    set(FIELD_IDS.ccApr,        debt.apr);
    set(FIELD_IDS.ccLimit,      fromPence(debt.creditLimit));
    set(FIELD_IDS.ccMinPayment, debt.minPayment ?? '');
    set(FIELD_IDS.ccPromoEnd,   debt.promoEndDate ?? '');
    set(FIELD_IDS.ccPostApr,    debt.postPromoApr ?? debt.apr);
  } else if (type === 'mortgage') {
    set(FIELD_IDS.mortgagePropertyValue, fromPence(debt.propertyValue ?? 0));
    set(FIELD_IDS.mortgageBalance,       fromPence(debt.currentBalance));
    set(FIELD_IDS.mortgageTerm,          debt.termMonths);
    set(FIELD_IDS.mortgageRate,          debt.interestRate);
    set(FIELD_IDS.mortgageErc,           fromPence(debt.earlyRepaymentFee ?? 0));
  } else if (type === 'loan') {
    set(FIELD_IDS.loanOriginal, fromPence(debt.originalPrincipal ?? 0));
    set(FIELD_IDS.loanBalance,  fromPence(debt.currentBalance));
    set(FIELD_IDS.loanTerm,     debt.termMonths);
    set(FIELD_IDS.loanRate,     debt.interestRate);
  } else {
    set(FIELD_IDS.otherBalance, fromPence(debt.currentBalance));
  }
},
```

Key: `fromPence()` is already imported in `debts.js`. The pence fields registered in `debtRepository` are: `currentBalance`, `creditLimit`, `originalPrincipal`, `fixedMonthlyPayment`, `earlyRepaymentFee`. Rates, terms, and boolean flags are stored as-is (not pence).

### Pattern 4: Inline Field Error Display

```javascript
// Pattern: _showFieldError / _clearFieldErrors (src/ui/debts.js)
_showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const existing = field.parentElement?.querySelector('.field-error');
  if (existing) existing.remove();
  const span = document.createElement('span');
  span.className = 'field-error';
  span.textContent = message;
  field.insertAdjacentElement('afterend', span);
},

_clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.remove());
},
```

The `.field-error` class needs a CSS rule. Check the existing stylesheet — if not defined, add it in Phase 13 or Phase 14. Minimum: `color: var(--danger, #e53e3e); font-size: 0.8rem; margin-top: 2px; display: block;`. The `insertAdjacentElement('afterend', ...)` approach works regardless of flex/grid layout without disrupting sibling elements.

### Pattern 5: Form Reset (ADD-03)

ADD-03 is already satisfied by the existing architecture: `_buildFormHTML()` returns a template with no `value=` attributes on any input (all inputs are empty by default). `modalUI.show()` overwrites `body.innerHTML` each call. Therefore, every time `openDebtModal()` is called for Add mode (`id = null`), the form is fresh. No explicit reset is needed.

The only risk is if `_populateEditFields()` is called when `id` is null — guarded by the `if (id !== null)` check already present in `openDebtModal()`.

### Anti-Patterns to Avoid

- **Calling `alertWithHaptic()` for validation errors:** ADD-02 explicitly forbids alert popups. Replace with `_showFieldError()` only.
- **Reading field values before checking if the element exists:** All FIELD_IDS inputs are in the DOM after `modalUI.show()`, but use optional chaining (`?.value`) to be safe and avoid crashes in tests where partial DOM is set up.
- **Calling `debtRepository.add()` with pence values:** The repository's `add()` and `update()` call `toPence()` on the pence fields automatically. Pass plain floats (GBP pounds, not pence). Passing pence-already values will double-convert and create 100x errors.
- **Setting `value` on hidden fieldset inputs in pre-population:** Setting `.value` on inputs that are hidden is harmless — the browser accepts it and the value is there when the user switches type. This is fine. Do not skip non-active-type fields in pre-population; it is simpler and correct to always populate all type-specific fields even if the fieldset is hidden.
- **Forgetting `apr` sync for loan/mortgage:** The old `handleSaveDebt()` sets `apr: rate` for loans/mortgages to keep the sort strategy consistent. Phase 13 must do the same: `payload.apr = interestRate` when type is `loan` or `mortgage`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pence conversion | Custom `* 100` math in save handler | `debtRepository.add/update` built-in conversion | Repository already calls `toPence()` on all 5 pence fields; duplicate conversion causes 100x errors |
| Modal close-after-save | Custom overlay hide logic | `_closeDebtModal()` | Already resets `editingId` and calls `modalUI.close()` — use it |
| Alert on validation failure | `alert()` or `alertWithHaptic()` | `_showFieldError()` inline spans | ADD-02 requirement; also better UX |
| Button wiring in modal | `onclick` attributes in HTML | `buttons` array to `modalUI.show()` | `modalUI.show()` creates real DOM buttons with closures — no global-window function exposure needed |

---

## Common Pitfalls

### Pitfall 1: Double-Pence Conversion on Edit
**What goes wrong:** When pre-populating edit fields with `_populateEditFields()`, `fromPence()` is applied to DB values. If `_saveDebt()` then reads those values and passes them to `debtRepository.update()`, which again calls `toPence()`, the round-trip is correct. But if `_saveDebt()` forgets to parse the field value as a float (relying on the string), the value passes through `toPence()` as `NaN`.
**Why it happens:** `input.value` is always a string. `toPence("1234.56")` works because `toPence` calls `parseFloat` internally, but `toPence(NaN)` or `toPence(undefined)` produces `NaN` silently stored in DB.
**How to avoid:** Always `parseFloat(el.value) || 0` (with the `|| 0` default for optional numeric fields). Use `|| 0` only for truly optional fields; for required fields, validate that `isNaN(parsed)` is false before building the payload.
**Warning signs:** Debt saves successfully but all numeric values in the DB read as 0 or NaN.

### Pitfall 2: `minPayment` Field Name Mismatch
**What goes wrong:** FIELD_IDS has `ccMinPayment: 'ccMinPaymentInput'`. The DB schema (schema.js v15) does not have a field called `minPayment` — the schema stores `fixedMonthlyPayment` for loans, but credit cards don't have a dedicated min-payment column in the indexed schema definition. The `debtRepository` pence conversion list does NOT include `minPayment`.
**Why it happens:** The credit card `minPayment` field is new in Phase 12 (added per TYPE-01 requirement). The old `renderDebtForm()` did not save a min payment for credit cards. The DB schema (Dexie indexed columns) does not list `minPayment` explicitly — but Dexie stores all properties passed to `add()`/`update()`, whether indexed or not.
**How to avoid:** Pass the field under a consistent key (e.g. `minPayment`) and accept it will be stored as a plain float (not pence-converted, since it is not in the repository pence fields list). If min payment should be stored as pence, add it to the pence fields list in the repository — but this is a decision for Phase 13 to make. Safest: treat `minPayment` as a plain-float field (GBP), consistent with how `interestRate` and `apr` are stored.
**Warning signs:** Min payment saves correctly in Add mode but reads back as the raw float, not pence — which is actually correct if treated as non-pence.

### Pitfall 3: `_clearFieldErrors()` Before Each Save vs. After Close
**What goes wrong:** If `_clearFieldErrors()` is only called inside `_closeDebtModal()`, validation errors persist if the user edits and retries without closing. If it is only called at the top of `_saveDebt()`, errors from a previous failed save are visible until the next save attempt.
**Why it happens:** The error spans are injected into the modal body's DOM; `modalUI.show()` wipes `body.innerHTML` on the next `openDebtModal()` call, so cross-session leakage is not possible. The issue is within a single modal session.
**How to avoid:** Call `_clearFieldErrors()` at the start of every `_saveDebt()` call. This ensures a clean slate before each save attempt.

### Pitfall 4: `openDebtModal()` Sequencing for EDIT-02
**What goes wrong:** `_populateEditFields(debt)` must run AFTER `modalUI.show()` (which creates the input elements) AND after `_onTypeChange()` (which removes `hidden` from the correct fieldset). The ordering matters only for visibility — but population must happen after `show()` regardless.
**Why it happens:** The input elements do not exist in the DOM until `modalUI.show()` writes `body.innerHTML`. Calling `_populateEditFields()` before `show()` means `getElementById()` returns `null` for every field.
**How to avoid:** The call order in `openDebtModal()` must be:
  1. `modalUI.show(title, formHTML, buttons)` — creates all inputs
  2. `document.getElementById(FIELD_IDS.name)?.focus()` — MODAL-04 auto-focus
  3. Wire X button and Esc handler
  4. If edit: `await debtRepository.get(id)` → set type select value → `_onTypeChange()` → `_populateEditFields(debt)`
**Warning signs:** Fields appear empty when Edit modal opens even though data was returned from the repository.

### Pitfall 5: `propertyValue` Field Does Not Exist in DB Schema
**What goes wrong:** Phase 12 added `mortgagePropertyValueInput` (FIELD_IDS.mortgagePropertyValue) for the mortgage fieldset. The DB schema's indexed columns for `debts` do not include `propertyValue`. Dexie will store any key passed to `add()`/`update()` even if it is not indexed, so the value will persist — but the key name must be consistent between save and load.
**Why it happens:** The old `renderDebtForm()` did not have a property value field. The schema v15 indexed column list does not include it. The field was added in Phase 12 as a UI concern.
**How to avoid:** Pick one consistent property name for both save (in `_saveDebt()`) and load (in `_populateEditFields()`). `propertyValue` is a reasonable choice. It will be stored as a non-indexed Dexie property. Use `fromPence()` on load and include it in the pence fields passed to `debtRepository.update()` — OR treat it as a plain float. Given the repository does not know about it, pass it as a plain float (GBP pounds, not pence) to avoid the double-convert issue. If pence storage is desired for consistency, add it explicitly to the repository.

---

## Field-to-DB Mapping Reference

This is the complete mapping for `_saveDebt()` → `debtRepository.add/update(payload)` → stored in DB.

### Credit Card Payload

| FIELD_IDS key | Input Element ID | Parse | Payload key | Pence-converted by repo? |
|---------------|-----------------|-------|-------------|--------------------------|
| name | debtNameInput | `.trim()` | `name` | No |
| type | debtTypeInput | direct | `debtType` | No |
| ccBalance | ccBalanceInput | `parseFloat \|\| 0` | `currentBalance` | YES |
| ccApr | ccAprInput | `parseFloat \|\| 0` | `apr` | No |
| ccLimit | ccLimitInput | `parseFloat \|\| 0` | `creditLimit` | YES |
| ccMinPayment | ccMinPaymentInput | `parseFloat \|\| 0` | `minPayment` | No (not in repo list) |
| ccPromoEnd | ccPromoEndInput | direct string | `promoEndDate` | No |
| ccPostApr | ccPostAprInput | `parseFloat \|\| apr` | `postPromoApr` | No |

### Mortgage Payload

| FIELD_IDS key | Input Element ID | Parse | Payload key | Pence-converted by repo? |
|---------------|-----------------|-------|-------------|--------------------------|
| mortgagePropertyValue | mortgagePropertyValueInput | `parseFloat \|\| 0` | `propertyValue` | No (not in repo list) |
| mortgageBalance | mortgageBalanceInput | `parseFloat \|\| 0` | `currentBalance` | YES |
| mortgageTerm | mortgageTermInput | `parseInt \|\| 0` | `termMonths` | No |
| mortgageRate | mortgageRateInput | `parseFloat \|\| 0` | `interestRate` | No |
| mortgageErc | mortgageErcInput | `parseFloat \|\| 0` | `earlyRepaymentFee` | YES |
| — | — | — | `apr` | No (set = interestRate) |

### Personal Loan Payload

| FIELD_IDS key | Input Element ID | Parse | Payload key | Pence-converted by repo? |
|---------------|-----------------|-------|-------------|--------------------------|
| loanOriginal | loanOriginalInput | `parseFloat \|\| 0` | `originalPrincipal` | YES |
| loanBalance | loanBalanceInput | `parseFloat \|\| 0` | `currentBalance` | YES |
| loanTerm | loanTermInput | `parseInt \|\| 0` | `termMonths` | No |
| loanRate | loanRateInput | `parseFloat \|\| 0` | `interestRate` | No |
| — | — | — | `apr` | No (set = interestRate) |

### Other Payload

| FIELD_IDS key | Input Element ID | Parse | Payload key | Pence-converted by repo? |
|---------------|-----------------|-------|-------------|--------------------------|
| otherBalance | otherBalanceInput | `parseFloat \|\| 0` | `currentBalance` | YES |

**Key insight:** Pass all money values as plain floats (GBP pounds). The repository converts the 5 registered pence fields (`currentBalance`, `creditLimit`, `originalPrincipal`, `fixedMonthlyPayment`, `earlyRepaymentFee`) to pence. Rates, terms, and boolean flags bypass conversion.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `handleSaveDebt()` reads old inline form IDs (`debtBalanceInput`, `loanPrincipalInput`) | `_saveDebt()` reads FIELD_IDS constants (`ccBalanceInput`, `loanOriginalInput`) | Phase 13 | New IDs match Phase 12 fieldsets; old IDs are dead in the modal |
| `alertWithHaptic()` for validation errors | `_showFieldError()` inline spans | Phase 13 | ADD-02 requirement; better UX |
| Cancel-only footer button in modal | Cancel + Save/Add two-button footer | Phase 13 | Primary action now accessible; modal is functional end-to-end |
| Old form `renderDebtForm()` pre-populates inputs via `innerHTML` with `value="${data.field}"` | New modal `_populateEditFields()` sets `.value` on live DOM elements after `modalUI.show()` | Phase 13 | Separation of structure (HTML template) from data (JS population) |

**Deprecated/outdated** (still in codebase until Phase 14):
- `handleSaveDebt()`: reads old inline form IDs; will break if called from new modal context
- `renderDebtForm()`: generates old inline form HTML with old IDs; to be removed in Phase 14
- `toggleDebtForm()`: show/hide for `#debtFormContainer`; to be removed in Phase 14

---

## Open Questions

1. **`minPayment` storage format (pence vs. float)**
   - What we know: `ccMinPaymentInput` is in FIELD_IDS; `minPayment` is not in the repository's pence fields list; the old form did not save this field.
   - What's unclear: Should `minPayment` be stored as pence (consistent with other balance fields) or as a plain float?
   - Recommendation: Store as plain float (GBP pounds) to avoid touching the repository. If consistency with other balance fields is desired, add `minPayment` to the `debtRepository` pence fields list — a one-line change.

2. **`propertyValue` for Mortgage — pence or float?**
   - What we know: `mortgagePropertyValueInput` is in FIELD_IDS; `propertyValue` is not in the repository's pence fields list.
   - What's unclear: Whether a large number like 350000 stored as a float (vs. 35000000 pence) causes display issues downstream.
   - Recommendation: Store as plain float for simplicity. Add to repo pence list only if other mortgage display code relies on pence-stored `propertyValue`. Phase 14 cleanup can address if needed.

3. **Required fields beyond `name`**
   - What we know: ADD-02 requires inline validation. Only `name` is hard-required across all types. Numeric fields default to 0 if empty.
   - What's unclear: Should balance fields be required (must be > 0)? The old `handleSaveDebt()` does not enforce this.
   - Recommendation: Match old behavior — validate `name` only. Do not add new required-field rules in Phase 13.

---

## Validation Architecture

> `nyquist_validation` is not set in `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.7 |
| Config file | none — vitest reads from `package.json` (`"test": "vitest"`) |
| Quick run command | `npx vitest run src/ui/debts.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADD-01 | `_saveDebt()` in Add mode: calls `debtRepository.add()` with correct payload and calls `_closeDebtModal()` | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| ADD-02 | Validation error on empty name: `debtRepository.add` NOT called, `<span class="field-error">` appears below name input | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| ADD-03 | `openDebtModal()` (Add mode) shows empty inputs: all text/number inputs have `value = ""` or `value = 0` | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| EDIT-01 | `_saveDebt()` in Edit mode: calls `debtRepository.update(editingId, payload)` for each debt type, calls `_closeDebtModal()` | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| EDIT-02 | `openDebtModal(id)` sets input values from fetched debt record for each type | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |

### Test Strategy Notes

All tests extend the existing `src/ui/debts.test.js` file. The mock infrastructure is already complete:
- `modalUI.show` mock applies scroll-lock side effect (confirmed working in Phase 11 tests)
- `debtRepository.add` and `debtRepository.update` are already `vi.fn()`
- `debtRepository.get` is already `vi.fn(async () => ({ id: 1, name: 'Test Debt', debtType: 'credit-card', ... }))`

**ADD-01 test pattern:** Build the fieldset DOM manually (same pattern as TYPE-01 tests), set `debtUI.editingId = null`, call `await debtUI._saveDebt()`, assert `debtRepository.add` was called with payload containing `name`, `debtType`, and the correct type-specific fields.

**ADD-02 test pattern:** Set name input to empty string, call `await debtUI._saveDebt()`, assert `debtRepository.add` was NOT called, assert `document.querySelector('.field-error')` is not null, assert its `textContent` is non-empty.

**ADD-03 test pattern:** Call `debtUI.openDebtModal()` (Add mode), then assert inputs in `_buildFormHTML()` output have no pre-filled values. Since `modalUI.show` is mocked and does not set `body.innerHTML`, this test may need to inject `_buildFormHTML()` output manually into `document.body` (same pattern as Phase 12 fieldset tests).

**EDIT-01 test pattern:** Set `debtUI.editingId = 42`, build fieldset DOM with inputs, call `await debtUI._saveDebt()`, assert `debtRepository.update` was called with `42` as first arg and correct payload as second.

**EDIT-02 test pattern:** `debtRepository.get.mockResolvedValueOnce({ id: 1, debtType: 'mortgage', currentBalance: 35000000, termMonths: 300, ... })`, call `await debtUI.openDebtModal(1)`, assert `document.getElementById('mortgageBalanceInput').value === '350000'` (fromPence applied), assert `document.getElementById('mortgageTermInput').value === '300'`.

### Sampling Rate
- **Per task commit:** `npx vitest run src/ui/debts.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

None — `src/ui/debts.test.js` exists with all mocks in place. New test cases are additions within the file. No new test files or framework configuration needed.

---

## Sources

### Primary (HIGH confidence)
- `src/ui/debts.js` (direct read, 2026-03-08) — full current implementation: FIELD_IDS, `openDebtModal()`, `_closeDebtModal()`, `_buildFormHTML()`, `_onTypeChange()`, old `handleSaveDebt()` (reference for payload structure and pence handling), `renderDebtForm()` (reference for pre-population pattern)
- `src/ui/render.js` (direct read, 2026-03-08) — `modalUI.show()` implementation: `body.innerHTML = content` is synchronous; footer button array creates real DOM buttons with `onclick` closures; `ALLOWED_ATTR` includes `onclick`, `onchange`
- `src/db/repository.js` (direct read, 2026-03-08) — `debtRepository.add/update`: pence fields are `['currentBalance', 'creditLimit', 'originalPrincipal', 'fixedMonthlyPayment', 'earlyRepaymentFee']`; `generateLoanPayments` is called automatically for `loan` and `mortgage` types
- `src/db/schema.js` (direct read, 2026-03-08) — v15 debt schema indexed columns; confirms `propertyValue` and `minPayment` are NOT indexed (stored as plain object properties only)
- `src/ui/debts.test.js` (direct read, 2026-03-08) — full mock infrastructure; `debtRepository.get/add/update` are `vi.fn()`; DOM setup pattern for fieldset tests

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — accumulated context: FIELD_IDS pattern rationale (NaN save bug history); Phase 11 and 12 decisions locked
- `.planning/REQUIREMENTS.md` — ADD-01 through ADD-03, EDIT-01 through EDIT-02 requirement text
- `.planning/milestones/v2.5-phases/12-type-specific-field-logic/12-RESEARCH.md` — Phase 12 architecture patterns that Phase 13 directly extends

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified in existing source files
- Architecture: HIGH — `_saveDebt()` structure derives directly from old `handleSaveDebt()`; pre-population pattern derives from `renderDebtForm()` + DOM-write sequence established in `openDebtModal()`; inline validation is a standard DOM pattern
- Field-to-DB mapping: HIGH — repository pence field list read directly from source; schema version confirmed
- Pitfalls: HIGH — double-pence conversion and pre-population sequencing are concrete code-level risks confirmed by reading both the repository and the `openDebtModal()` implementation

**Research date:** 2026-03-08
**Valid until:** 2026-09-08 (stable codebase — no external dependencies changing; schema v15 is current)
