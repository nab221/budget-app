# Phase 12: Type-Specific Field Logic - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand `_buildFormHTML()` in `debts.js` to render all 4 type-specific fieldsets (Credit Card, Mortgage, Personal Loan, Other). Wire a `_onTypeChange()` handler that shows the matching fieldset and hides the other three — both on type select change and when the modal opens in Edit mode (EDIT-03 requires the correct fieldset pre-visible for the existing debt's type). No save/load logic, no value pre-population — that's Phase 13.

</domain>

<decisions>
## Implementation Decisions

### Fieldset structure
- 4 **separate, independent fieldsets** — one per debt type (Credit Card, Mortgage, Personal Loan, Other)
- No shared DOM elements between Loan and Mortgage, even though they share fields (remaining balance, term, interest rate)
- Each fieldset has its own input IDs, consistent with the `FIELD_IDS` constants pattern already established
- All 4 fieldsets rendered inside `_buildFormHTML()` and present in the DOM at all times

### Credit Card fields
- Include promo fields (Promo End date, Post-Promo APR) in addition to the 4 required fields
- Fields: current balance, interest rate (APR), credit limit, min payment, promo end date, post-promo APR
- Retains the old `renderDebtForm()` field set for Credit Card

### Mortgage fields
- Fields: property value, remaining balance, term (months), interest rate, ERC (early repayment charge)
- ERC is a **pound amount field only** — no £/% toggle (old `earlyRepaymentFeeIsPercent` flag not surfaced in Phase 12)

### Personal Loan fields
- Fields: original amount, remaining balance, term (months), interest rate

### Other type fields
- Fields: current balance only
- No notes field — the debt schema has no notes/description column; adding one requires a migration, deferred to a later phase
- "Other" option is already present in the Phase 11 type select

### Show/hide mechanism
- **CSS class toggle** — all 4 fieldsets in the DOM, the non-matching ones carry `hidden` class
- `_onTypeChange()` method on `debtUI`: removes `hidden` from the selected type's fieldset, adds it to the other three
- `onchange` attribute on the type `<select>` calls `debtUI._onTypeChange()` (debtUI is already partially exposed on window via existing code)
- `openDebtModal()` calls `_onTypeChange()` after modal opens to pre-show the correct fieldset for the current type value (both Add mode default and Edit mode pre-selection)

### Value persistence on type switch
- Values persist in the DOM — fields stay rendered (just hidden) so switching back restores previously entered values
- No reset logic needed; values only clear when the modal closes and `_buildFormHTML()` is called fresh on next open

### Edit mode (EDIT-03)
- Phase 12 responsibility: make the **correct fieldset visible** when Edit modal opens
- Phase 12 does NOT pre-populate field values with the existing debt's data — that's Phase 13
- The type `<select>` value will be set to the existing debt's type before `_onTypeChange()` is called

### Claude's Discretion
- Exact FIELD_IDS naming for new fields (follow existing `debtNameInput`, `debtTypeInput` pattern)
- Whether to keep old `toggleDebtTypeFields()` method or replace it with `_onTypeChange()` (underscored naming matches Phase 11 private method convention — prefer replacing)
- Grouping of fields within each fieldset (form-row layout)

</decisions>

<specifics>
## Specific Ideas

- The old `renderDebtForm()` Credit Card section is the reference for what Credit Card fields look like — reuse that as the baseline
- `_buildFormHTML()` is the single source of truth for the modal's form HTML; all 4 fieldsets live inside it

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FIELD_IDS` constants (top of `debts.js`): extend with new field IDs for all 4 type fieldsets
- `safeHTML` template tag (`render.js`): established pattern for building form HTML safely
- `modalUI.show(title, html, buttons)` (`render.js`): already wired in `openDebtModal()` — no changes needed here
- `toggleDebtTypeFields()` (existing in `debts.js`): the predecessor to `_onTypeChange()` — shows the pattern but uses old `ccOnlyFields`/`loanOnlyFields` IDs which are being replaced

### Established Patterns
- Private method naming: `_buildFormHTML`, `_closeDebtModal` — `_onTypeChange` follows the same convention
- CSS class toggle for visibility: `element.classList.remove('hidden')` / `classList.add('hidden')` — used throughout the codebase
- Phase 11 scaffold already has `<option value="other">Other</option>` in the type select

### Integration Points
- `openDebtModal(id)` in `debts.js`: call `_onTypeChange()` after `modalUI.show()` to pre-show the correct fieldset
- `_buildFormHTML()`: expand from scaffold (name + type only) to full 4-fieldset form
- `debtUI._onTypeChange()`: new method, replaces `toggleDebtTypeFields()`

</code_context>

<deferred>
## Deferred Ideas

- Notes/description field for Other type — requires schema migration, defer to a later phase
- ERC £/% toggle for Mortgage — `earlyRepaymentFeeIsPercent` is in the DB schema but not surfaced in Phase 12; handled in Phase 13 save wiring if needed
- Promo APR fields for Credit Card are included in Phase 12 (user confirmed), but save wiring for them is Phase 13

</deferred>

---

*Phase: 12-type-specific-field-logic*
*Context gathered: 2026-03-08*
