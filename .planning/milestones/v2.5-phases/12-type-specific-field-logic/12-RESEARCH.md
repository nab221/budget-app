# Phase 12: Type-Specific Field Logic - Research

**Researched:** 2026-03-08
**Domain:** Vanilla JS DOM manipulation — CSS class-based show/hide of form fieldsets inside a modal
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fieldset structure**
- 4 separate, independent fieldsets — one per debt type (Credit Card, Mortgage, Personal Loan, Other)
- No shared DOM elements between Loan and Mortgage, even though they share fields
- Each fieldset has its own input IDs, consistent with the `FIELD_IDS` constants pattern
- All 4 fieldsets rendered inside `_buildFormHTML()` and present in the DOM at all times

**Credit Card fields**
- Fields: current balance, interest rate (APR), credit limit, min payment, promo end date, post-promo APR
- Retains the old `renderDebtForm()` field set for Credit Card as the reference baseline

**Mortgage fields**
- Fields: property value, remaining balance, term (months), interest rate, ERC (early repayment charge)
- ERC is a pound amount field only — no £/% toggle (earlyRepaymentFeeIsPercent not surfaced in Phase 12)

**Personal Loan fields**
- Fields: original amount, remaining balance, term (months), interest rate

**Other type fields**
- Fields: current balance only
- No notes field — defer to a later phase (requires schema migration)

**Show/hide mechanism**
- CSS class toggle — all 4 fieldsets in the DOM, non-matching ones carry `hidden` class
- `_onTypeChange()` method on debtUI: removes `hidden` from selected type's fieldset, adds it to the other three
- `onchange` attribute on the type `<select>` calls `debtUI._onTypeChange()`
- `openDebtModal()` calls `_onTypeChange()` after modal opens to pre-show the correct fieldset

**Value persistence on type switch**
- Values persist in the DOM — fields stay rendered (just hidden) so switching back restores previously entered values
- No reset logic needed; values only clear when the modal closes

**Edit mode (EDIT-03)**
- Phase 12 responsibility: make the correct fieldset visible when Edit modal opens
- Phase 12 does NOT pre-populate field values — that is Phase 13
- The type `<select>` value will be set to the existing debt's type before `_onTypeChange()` is called

### Claude's Discretion
- Exact FIELD_IDS naming for new fields (follow existing `debtNameInput`, `debtTypeInput` pattern)
- Whether to keep old `toggleDebtTypeFields()` method or replace it with `_onTypeChange()` (prefer replacing)
- Grouping of fields within each fieldset (form-row layout)

### Deferred Ideas (OUT OF SCOPE)
- Notes/description field for Other type — requires schema migration
- ERC £/% toggle for Mortgage — `earlyRepaymentFeeIsPercent` is in the DB schema but not surfaced in Phase 12
- Promo APR fields for Credit Card are INCLUDED in Phase 12, but save wiring for them is Phase 13
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TYPE-01 | Credit Card fields (credit limit, current balance, interest rate, min payment) appear automatically when Credit Card is selected | Covered by `_onTypeChange()` and credit card fieldset in `_buildFormHTML()` |
| TYPE-02 | Mortgage fields (property value, remaining balance, term, interest rate, ERC) appear when Mortgage is selected | Covered by `_onTypeChange()` and mortgage fieldset in `_buildFormHTML()` |
| TYPE-03 | Personal Loan fields (original amount, remaining balance, term, interest rate) appear when Personal Loan is selected | Covered by `_onTypeChange()` and loan fieldset in `_buildFormHTML()` |
| TYPE-04 | Generic/Other fields appear when Other type is selected | Covered by `_onTypeChange()` and other fieldset in `_buildFormHTML()` |
| EDIT-03 | The correct type-specific fields auto-show for the debt's existing type without switch-away | Covered by `openDebtModal(id)` calling `_onTypeChange()` after setting the select value |
</phase_requirements>

---

## Summary

Phase 12 is a pure DOM/HTML phase with no new dependencies, no schema changes, and no data-layer work. The entire implementation lives inside `src/ui/debts.js`. The work has three components: expanding `_buildFormHTML()` from 2 fields to 4 independent fieldsets, adding a new `_onTypeChange()` method that toggles `hidden` class on/off across the fieldsets, and wiring `_onTypeChange()` into both the type select's `onchange` and the `openDebtModal()` flow.

The existing codebase already demonstrates every pattern needed. `toggleDebtTypeFields()` (the old inline-form equivalent) shows the exact CSS toggle pattern. `renderDebtForm()` in the old inline form shows the full Credit Card field set. The `FIELD_IDS` object at the top of `debts.js` establishes the constants pattern. `safeHTML` template tag from `render.js` handles all form HTML building safely. Phase 12 replaces the old dual-group approach (`ccOnlyFields` / `loanOnlyFields`) with 4 independent named fieldsets.

The only non-trivial question is Edit mode (EDIT-03): `openDebtModal(id)` needs to (a) read the existing debt's `debtType`, (b) set that value on the `<select>` element, and (c) call `_onTypeChange()`. All three of these are simple synchronous DOM operations after the modal opens. The repository lookup needed to get the debt type is the same async call Phase 13 will use for full pre-population — Phase 12 only needs the `debtType` field from it.

**Primary recommendation:** Extend `_buildFormHTML()` with 4 `hidden`-by-default fieldsets (Credit Card visible by default as the `<select>` defaults to `credit-card`), add `_onTypeChange()`, wire `onchange`, and call `_onTypeChange()` from `openDebtModal()` after optionally setting the select's value from the existing debt record.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^3.0.7 | Unit testing | Already installed, all existing tests use it |
| jsdom | ^28.1.0 | DOM environment for tests | Already installed as devDependency, used in debts.test.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMPurify (via safeHTML) | ^3.2.4 | Sanitizes all form HTML strings | Use safeHTML template tag for all innerHTML, never raw string concatenation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `hidden` class toggle | `display:none` inline style | `hidden` class is already the established project pattern — consistent |
| `onchange` attribute in HTML | `addEventListener` in `_onTypeChange` after modal opens | `onchange` attribute approach is already used in old `renderDebtForm()`; consistent, and avoids needing a re-query post-render |

**No install needed** — all dependencies already present.

---

## Architecture Patterns

### How _buildFormHTML() Should Be Structured

```
_buildFormHTML() returns:
  <div class="form-row">           ← name + type row (Phase 11 scaffold, unchanged)
  </div>

  <div id="fieldset-credit-card">  ← visible by default (credit-card is default select value)
    ...6 credit card inputs...
  </div>

  <div id="fieldset-mortgage" class="hidden">
    ...5 mortgage inputs...
  </div>

  <div id="fieldset-loan" class="hidden">
    ...4 personal loan inputs...
  </div>

  <div id="fieldset-other" class="hidden">
    ...1 other input...
  </div>
```

### Pattern 1: FIELD_IDS Extension
**What:** Extend the `FIELD_IDS` constant at the top of `debts.js` with IDs for every new input field across all 4 fieldsets.
**When to use:** Every new `<input>` or `<select>` introduced in Phase 12 gets a constant in FIELD_IDS before the template tag references it.
**Why:** Prevents the ID-drift bug that caused the previous save-NaN issue (documented in STATE.md accumulated context).

```javascript
// Source: src/ui/debts.js (existing pattern, Phase 12 extension)
const FIELD_IDS = {
  // Phase 11
  name: 'debtNameInput',
  type: 'debtTypeInput',

  // Phase 12 — Credit Card fieldset
  ccBalance:    'ccBalanceInput',
  ccApr:        'ccAprInput',
  ccLimit:      'ccLimitInput',
  ccMinPayment: 'ccMinPaymentInput',
  ccPromoEnd:   'ccPromoEndInput',
  ccPostApr:    'ccPostAprInput',

  // Phase 12 — Mortgage fieldset
  mortgagePropertyValue:  'mortgagePropertyValueInput',
  mortgageBalance:        'mortgageBalanceInput',
  mortgageTerm:           'mortgageTermInput',
  mortgageRate:           'mortgageRateInput',
  mortgageErc:            'mortgageErcInput',

  // Phase 12 — Personal Loan fieldset
  loanOriginal:  'loanOriginalInput',
  loanBalance:   'loanBalanceInput',
  loanTerm:      'loanTermInput',
  loanRate:      'loanRateInput',

  // Phase 12 — Other fieldset
  otherBalance: 'otherBalanceInput',
};
```

### Pattern 2: _onTypeChange() Method
**What:** A method on `debtUI` that reads the current value of the type select and toggles `hidden` on/off for each of the 4 fieldsets.
**When to use:** Called from two places — the type select's `onchange` event, and from `openDebtModal()` to set the initial state.

```javascript
// Source: debts.js (new method, replacing toggleDebtTypeFields())
_onTypeChange() {
  const type = document.getElementById(FIELD_IDS.type)?.value;
  const fieldsets = {
    'credit-card': document.getElementById('fieldset-credit-card'),
    'mortgage':    document.getElementById('fieldset-mortgage'),
    'loan':        document.getElementById('fieldset-loan'),
    'other':       document.getElementById('fieldset-other'),
  };
  for (const [key, el] of Object.entries(fieldsets)) {
    if (!el) continue;
    if (key === type) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }
},
```

### Pattern 3: Edit Mode Fieldset Pre-Selection (EDIT-03)
**What:** `openDebtModal(id)` needs to read the debt's `debtType` and set the select value before calling `_onTypeChange()`.
**When to use:** Only when `id !== null` (Edit mode). Add mode defaults to `credit-card` via the select's first option, then `_onTypeChange()` is called regardless to ensure the fieldset matches.
**Important:** This requires an async read of the debt record. The existing `openDebtModal()` is currently synchronous — it will need to become async, or the debtType lookup must be done inside.

```javascript
// Source: debts.js (openDebtModal extension pattern)
async openDebtModal(id = null) {
  this.editingId = id;

  // ... existing title / formHTML / buttons / modalUI.show() / focus / Esc wiring ...

  if (id !== null) {
    const debt = await debtRepository.get(id);
    if (debt?.debtType) {
      const typeSelect = document.getElementById(FIELD_IDS.type);
      if (typeSelect) typeSelect.value = debt.debtType;
    }
  }

  this._onTypeChange();
},
```

### Pattern 4: Type Select onchange Wiring
**What:** The `<select>` in `_buildFormHTML()` needs `onchange="debtUI._onTypeChange()"`.
**Why this works:** `debtUI` is already exposed on `window` at the bottom of `debts.js` (`window.debtUI = debtUI`), so the attribute reference is valid.

```javascript
// Source: src/ui/debts.js _buildFormHTML() — type select (Phase 12 update)
<select id="${FIELD_IDS.type}" onchange="debtUI._onTypeChange()">
  <option value="credit-card">Credit Card</option>
  <option value="loan">Personal Loan</option>
  <option value="mortgage">Mortgage</option>
  <option value="other">Other</option>
</select>
```

Note: `safeHTML` allows `onchange` attributes — it is explicitly listed in `ALLOWED_ATTR` in `render.js`.

### Anti-Patterns to Avoid
- **Shared fieldsets between Loan and Mortgage:** The user explicitly locked the decision to have 4 fully independent fieldsets. Do not share the "remaining balance" or "term" inputs between loan and mortgage.
- **Using the old `ccOnlyFields`/`loanOnlyFields` IDs:** These belong to the old `renderDebtForm()` inline form. The new fieldsets use new IDs under `FIELD_IDS`.
- **Leaving `toggleDebtTypeFields()` in place:** Replace it with `_onTypeChange()`. The old method references DOM IDs (`ccOnlyFields`, `loanOnlyFields`) that will not exist in the modal.
- **Making `openDebtModal()` call `_onTypeChange()` before `modalUI.show()`:** The fieldset elements are created by `_buildFormHTML()` which is passed to `modalUI.show()` — the elements do not exist in the DOM until after `show()` runs. Call `_onTypeChange()` after `modalUI.show()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form HTML sanitization | Custom escaping | `safeHTML` template tag | DOMPurify is already wired in; onchange attribute is in ALLOWED_ATTR |
| Modal lifecycle | Custom dialog open/close | `modalUI.show()` / `modalUI.close()` | Already handles scroll lock, backdrop, Esc; Phase 11 set this up |
| Visibility toggle | Custom CSS | `element.classList.add/remove('hidden')` | Project-wide pattern, CSS class already defined in stylesheet |

---

## Common Pitfalls

### Pitfall 1: Calling _onTypeChange() Before DOM Elements Exist
**What goes wrong:** `_onTypeChange()` queries the 4 fieldset elements by ID. If called before `modalUI.show()` sets `modalBody.innerHTML`, `getElementById()` returns `null` for all fieldsets and the method silently does nothing.
**Why it happens:** `_buildFormHTML()` returns a string; the DOM is only updated when `modalUI.show()` sets `body.innerHTML`. If `_onTypeChange()` runs before that, there is nothing to toggle.
**How to avoid:** Call `_onTypeChange()` after `modalUI.show(title, formHTML, buttons)` — not before.
**Warning signs:** Type switching in Add mode works fine (user triggered onchange fires after DOM is ready) but Edit mode shows the wrong fieldset (pre-selection ran too early).

### Pitfall 2: Edit Mode async/await Gap
**What goes wrong:** `openDebtModal(id)` needs to await `debtRepository.get(id)` to read `debtType`, but the method was synchronous in Phase 11. If the method is not made `async`, or if the await is incorrectly placed after `_onTypeChange()`, the type select will not be set before `_onTypeChange()` reads it.
**Why it happens:** `debtRepository.get()` is async (IndexedDB). Setting `typeSelect.value` must happen before `this._onTypeChange()` is called.
**How to avoid:** Make `openDebtModal` async and `await debtRepository.get(id)` before calling `_onTypeChange()`.
**Warning signs:** Edit modal always shows Credit Card fields regardless of debt type.

### Pitfall 3: onchange Not Firing on Programmatic Select Value Change
**What goes wrong:** Setting `selectEl.value = 'mortgage'` programmatically does NOT fire the `onchange` event. Only user interaction fires it.
**Why it happens:** This is standard browser behavior — `.value =` assignment is silent.
**How to avoid:** Always call `this._onTypeChange()` explicitly after setting the select value in code. The `onchange` attribute on the `<select>` only handles user-driven changes.

### Pitfall 4: The `hidden` Class Must Actually Be Defined
**What goes wrong:** `classList.add('hidden')` does nothing visible if the `hidden` CSS class is not in the stylesheet with `display: none`.
**Why it happens:** Not a pitfall here — `hidden` is already used throughout the project (confirmed in `toggleDebtTypeFields()` and `toggleLedger()`). Just confirming it exists.
**How to avoid:** No action needed — `hidden` class is already established. But if tests run in jsdom and visibility assertions are needed, be aware jsdom does not compute CSS.

### Pitfall 5: safeHTML Strips event handlers on fieldset wrappers
**What goes wrong:** DOMPurify's `ALLOWED_ATTR` in `render.js` permits `onchange` on `<select>` elements but DOMPurify may strip event attributes from container `<div>` elements.
**Why it happens:** The ALLOWED_ATTR list is global to all elements; DOMPurify doesn't restrict by tag. `onclick` and `onchange` are both in the list. Fieldset wrapper `<div>`s don't need any event attributes, so this is not actually a risk — just don't add event handlers to the fieldset `<div>` containers.
**How to avoid:** Put `onchange` only on the `<select>` element, not on any div wrapper.

---

## Code Examples

### Credit Card Fieldset (reference: old renderDebtForm())

The old `renderDebtForm()` in the existing inline form provides the exact reference for what Credit Card fields look like. The Phase 12 version adapts this into a fieldset div with new FIELD_IDS:

```javascript
// Source: src/ui/debts.js renderDebtForm() — Credit Card section (reference)
// Fields in old form: debtBalanceInput, debtAprInput, debtLimitInput,
//                     debtPromoEndInput, debtPostAprInput
// Phase 12 renames to: ccBalanceInput, ccAprInput, ccLimitInput,
//                      ccPromoEndInput, ccPostAprInput
// Also adds: ccMinPaymentInput (not in old form)
```

### Fieldset IDs Convention

```javascript
// Source: CONTEXT.md — fieldset structure decision
// Fieldset wrapper IDs (queried in _onTypeChange):
//   'fieldset-credit-card'
//   'fieldset-mortgage'
//   'fieldset-loan'
//   'fieldset-other'
```

### Test Pattern (from debts.test.js Phase 11)

The existing test file sets up a jsdom environment and mocks all external dependencies. Phase 12 tests follow the same structure:

```javascript
// Source: src/ui/debts.test.js — established pattern
// @vitest-environment jsdom
// vi.mock('./render.js', ...) — mock modalUI, safeHTML
// vi.mock('../db/repository.js', ...) — mock debtRepository
// Test: call debtUI.openDebtModal(), then query DOM for fieldset visibility
```

For TYPE-01 through TYPE-04, the test opens the modal (which renders all fieldsets), then calls `debtUI._onTypeChange()` after setting the select's value, and asserts the correct fieldset is visible (no `hidden` class) while others are hidden.

For EDIT-03, the test needs `debtRepository.get` mock to return a debt with a specific `debtType`, then asserts the correct fieldset is visible after `openDebtModal(1)` resolves.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ccOnlyFields` / `loanOnlyFields` (2 groups) | 4 independent named fieldsets | Phase 12 | Mortgage gets its own fields; Other type has a fallback; no shared DOM |
| `toggleDebtTypeFields()` (inline form) | `_onTypeChange()` (modal form) | Phase 12 | Replace the old method; new one works with new fieldset IDs |
| Synchronous `openDebtModal()` | Async `openDebtModal()` | Phase 12 | Needed for EDIT-03 debt type read |

**Deprecated/outdated:**
- `toggleDebtTypeFields()`: references `ccOnlyFields`/`loanOnlyFields` IDs that belong to the old inline form; superseded by `_onTypeChange()` in Phase 12
- `renderDebtForm()`: old inline form renderer; kept but will be removed in Phase 14 cleanup

---

## Open Questions

1. **Min payment field for Credit Card**
   - What we know: TYPE-01 in REQUIREMENTS.md lists "min payment" as a required Credit Card field. The old `renderDebtForm()` did NOT include a min payment input (it was computed, not entered).
   - What's unclear: Is `ccMinPaymentInput` a new manually-entered field or computed from APR + balance?
   - Recommendation: Add it as a plain `number` input with step 0.01. Phase 13 save wiring will use it; Phase 12 only needs to render it. The requirement says the field must appear — it does not say it must be computed.

2. **Whether to `await` the debt read in openDebtModal before or after modalUI.show()**
   - What we know: `modalUI.show()` is synchronous and sets innerHTML immediately. `_onTypeChange()` must run after `show()`. The debt read is async.
   - What's unclear: Should the sequence be (1) show modal, (2) await debt, (3) set select, (4) call _onTypeChange? Or (1) await debt, (2) show modal with pre-set select value, (3) call _onTypeChange?
   - Recommendation: Option 1 — show modal first so the user sees the modal open immediately (MODAL-04 auto-focus fires), then set type and call `_onTypeChange()`. The brief flash of the default Credit Card fieldset before the correct one shows is acceptable, and the user will not perceive it given async resolution speed on local IndexedDB.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.7 |
| Config file | none — vitest reads from package.json `"test": "vitest"` |
| Quick run command | `npx vitest run src/ui/debts.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TYPE-01 | Credit Card fieldset visible, others hidden when type = credit-card | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| TYPE-02 | Mortgage fieldset visible, others hidden when type = mortgage | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| TYPE-03 | Personal Loan fieldset visible, others hidden when type = loan | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| TYPE-04 | Other fieldset visible, others hidden when type = other | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |
| EDIT-03 | Correct fieldset pre-visible when openDebtModal(id) called in Edit mode | unit | `npx vitest run src/ui/debts.test.js` | Extend existing ✅ |

### Sampling Rate
- **Per task commit:** `npx vitest run src/ui/debts.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing `src/ui/debts.test.js` is the correct file to extend. All mocks are already set up. New test cases are additions within the existing `describe('debtUI modal scaffold', ...)` block (or a new describe block in the same file).

---

## Sources

### Primary (HIGH confidence)
- `src/ui/debts.js` (direct read) — full current implementation: FIELD_IDS, `_buildFormHTML()`, `openDebtModal()`, `toggleDebtTypeFields()`, `renderDebtForm()`
- `src/ui/render.js` (direct read) — `safeHTML` ALLOWED_ATTR list confirms `onchange` is permitted; `modalUI.show()` is synchronous
- `src/db/schema.js` (direct read) — schema v15 debt fields confirmed: `debtType`, `creditLimit`, `currentBalance`, `promoEndDate`, `postPromoApr`, `originalPrincipal`, `termMonths`, `fixedMonthlyPayment`, `interestRate`, `earlyRepaymentFee`, `earlyRepaymentFeeIsPercent`, `earlyRepaymentAllowed`, `isInterestOnly`
- `src/ui/debts.test.js` (direct read) — test infrastructure, mock patterns, jsdom environment
- `.planning/milestones/v2.5-phases/12-type-specific-field-logic/12-CONTEXT.md` (direct read) — all user decisions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — accumulated context confirms FIELD_IDS pattern rationale (NaN save bug history)
- `.planning/REQUIREMENTS.md` — TYPE-01 through TYPE-04 and EDIT-03 requirement text

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified in existing source files
- Architecture: HIGH — `_onTypeChange()` pattern, fieldset IDs, and FIELD_IDS extension all derive directly from existing code; no speculation required
- Pitfalls: HIGH — async ordering pitfall and programmatic select change pitfall are well-known browser behaviors, confirmed by reading the existing synchronous `openDebtModal()` and `toggleDebtTypeFields()` implementations

**Research date:** 2026-03-08
**Valid until:** 2026-09-08 (stable codebase — no external dependencies changing)
