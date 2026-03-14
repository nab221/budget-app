# Feature Research

**Domain:** Personal Finance PWA — Debt Form Modal UX (v2.5)
**Researched:** 2026-03-07
**Confidence:** HIGH (codebase is primary evidence; UX patterns from LogRocket, Eleken, YNAB support docs cross-referenced)

---

## Scope

This file covers the v2.5 milestone: replacing the broken inline debt form with a working modal
dialog and type-specific field sets. Already-shipped features (debt list, debt cards, edit pencil,
delete button, statement ledger, payoff planner) are not re-researched here.

---

## Current State (What Exists)

The inline form lives in `#debtFormContainer` inside the Debt tab's normal document flow. Problems:

- The container is a plain `<div class="card">` shown/hidden with `.hidden`; it is not a modal
- It sits above the debt list, which means editing scrolls the page awkwardly
- `toggleDebtTypeFields()` correctly swaps CSS visibility on `#ccOnlyFields` / `#loanOnlyFields`,
  so type-switching logic works — the bug is structural (container placement, not field logic)
- Edit pre-populates all fields correctly via `renderDebtForm()` with `this.editingId`
- Save/validation path in `handleSaveDebt()` is sound (name required, type-branch parsing, haptic)

The existing form fields exactly match the DB schema (v15). No new fields are needed for v2.5.
The fix is container structure (modal) and UX polish, not new data model work.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| True modal overlay (not inline) | Every modern finance app (YNAB, Monarch, Copilot) uses modals for add/edit forms; inline banners feel like dev scaffolding, not a finished app | LOW | Native `<dialog>` element with `showModal()` / `close()`; CSS backdrop covers page |
| Escape key closes modal | Browser convention for dialogs; every user tries this | LOW | `<dialog>` handles Escape natively if `method="dialog"`; also wire `keydown` for custom close with discard-changes guard |
| Click-outside-to-cancel | Users expect clicking the backdrop to dismiss; missing it feels like a trap | LOW | Listen on `dialog` click, check `event.target === dialog` (the backdrop area) |
| Focus trapped inside modal | Tab key must cycle within modal only; tabbing to background content is disorienting and an accessibility failure | LOW | `<dialog>` + `showModal()` provides native focus trapping; no custom implementation needed |
| Type selector immediately shows/hides type-specific fields | Already works in current code but broken visually due to inline placement; in a modal the layout is fixed so it will work correctly | LOW | `toggleDebtTypeFields()` already exists; just needs to fire correctly after modal renders |
| Edit pre-populates all fields | Already works via `renderDebtForm()` with `editingId`; must be preserved in modal | LOW | No logic change needed; `renderDebtForm()` populates into modal container instead |
| Name field is required | Most basic validation; every debt tracker requires a name | LOW | Already enforced in `handleSaveDebt()`; show inline error instead of `alert()` |
| Clear Add vs Edit mode signaling | User must instantly know if they are adding new or editing existing | LOW | Modal title, button label, and optional accent border already differentiate; keep this |
| Cancel / discard-changes guard | If user has edited fields and hits cancel, prompt before discarding | LOW | Already implemented in `cancelEditDebt()` with `confirm()`; wire to modal close paths |
| Haptic feedback on save and error | Already exists; must be preserved in modal path | LOW | No change needed in `handleSaveDebt()` haptic calls |

### Differentiators (Nice to Have for This Milestone)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Inline field-level validation (on blur) | Better than alert-on-submit: user sees the error as soon as they leave a bad field, not after filling in the whole form | MEDIUM | Show red border + error message below each invalid field on `focusout`; clear error on next valid input |
| Auto-focus first field on modal open | Saves a tap/click; user can start typing immediately | LOW | `dialog.addEventListener('close', ...)` / set `autofocus` on name input or call `.focus()` after `showModal()` |
| Type-specific field ordering that matches mental model | Credit card users think: balance, limit, rate. Loan users think: original amount, current balance, monthly payment, rate, term. Matching this order reduces cognitive friction | LOW | Reorder fields in `renderDebtForm()` HTML to match these mental models |
| Mortgage-specific label adjustments | "Original Principal" means nothing to a homeowner; "Original Mortgage Amount" does. Same for "Term (Months)" vs showing years with months as secondary | LOW | Conditional label text based on `debtType === 'mortgage'` in form render |
| Numeric input formatting hints | Placeholder text showing expected format (e.g., "0.00", "24", "2.5") reduces entry errors | LOW | Already has some placeholders; audit and complete them |
| Progressive disclosure for optional fields | Fields like "Promo End Date" and "Post-Promo APR" on credit cards are optional and rarely filled on first entry; collapsing them under an "Advanced" toggle keeps the form clean | MEDIUM | Toggle section show/hide; state resets on modal close |

### Anti-Features (Deliberately Out of Scope for This Milestone)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-step wizard for debt entry | Breaks long form into steps (step 1: name/type, step 2: amounts, step 3: rates) | Adds navigation complexity and state management for a form that already fits a single screen in a modal; overkill for 5-8 fields | Single-screen modal with type-specific section reveal |
| Inline balance history on the form | "Show me past statements while I'm editing" | The statement ledger already exists on the debt card (click-to-expand); duplicating it in the edit form doubles the modal height and blurs the form's job | Keep edit form for metadata only; ledger stays on the card |
| Real-time payoff calculation preview in form | "Show projected debt-free date as I type APR" | Requires live calculation on every keystroke; complex to get right and distracts from the task of entering accurate data | Payoff planner tab already shows this; user goes there after saving |
| Debt type creation/custom types | "I want to add a car loan type" | Scope creep; the payoff logic and statement forms are hardcoded to the three existing types; a custom type needs special-case handling throughout the app | "Other/Generic" type covers unlisted debts with the shared loan field set |
| Bulk import of debts from CSV | "I have 10 credit cards" | Out of scope for this milestone; the PDF import for statements is separate; adding CSV import for the debt accounts themselves requires a parser, validation, and conflict resolution flow | Manual entry per debt; bulk import is a future milestone |
| Undo on save | "Oops, I accidentally saved" | Requires in-memory undo state and a toast/snackbar UI; the discard-changes guard on cancel already prevents accidental saves | Discard-changes guard on cancel path |

---

## Field Sets Per Debt Type

### Credit Card

All fields are already in the DB schema and current form. Correct field set for the modal:

| Field | Label | Type | Required | Validation | Notes |
|-------|-------|------|----------|------------|-------|
| name | Account Name | text | YES | Non-empty | e.g. "Barclaycard Platinum" |
| debtType | Type | select | YES | One of valid values | Drives field visibility |
| currentBalance | Current Balance (£) | number | YES | >= 0 | What is owed right now |
| apr | APR (%) | number | YES | >= 0, <= 100 | Used for payoff simulation |
| creditLimit | Credit Limit (£) | number | NO | >= 0 | 0 = N/A (no limit tracking) |
| promoEndDate | Promo Rate Ends | date | NO | Valid date or empty | Optional intro-rate expiry |
| postPromoApr | Post-Promo APR (%) | number | NO | >= 0 if promoEndDate set | Defaults to APR if blank |

Validation rules:
- `name` required — show "Please enter an account name" inline
- `currentBalance` required — show "Please enter the current balance"
- `apr` required for payoff simulation accuracy — show "Please enter the APR (enter 0 if unknown)" rather than blocking
- If `promoEndDate` is set, `postPromoApr` should be required or default to `apr`

### Mortgage

The DB schema currently stores mortgages with the same fields as personal loans (`originalPrincipal`,
`termMonths`, `fixedMonthlyPayment`, `interestRate`, `earlyRepaymentFee`, `earlyRepaymentFeeIsPercent`,
`earlyRepaymentAllowed`, `isInterestOnly`). No new schema fields are needed.

The modal should show mortgage-appropriate labels:

| Field | Label (Mortgage) | Type | Required | Validation | Notes |
|-------|-----------------|------|----------|------------|-------|
| name | Account Name | text | YES | Non-empty | e.g. "Nationwide 2yr Fixed" |
| debtType | Type | select | YES | — | Drives field visibility |
| originalPrincipal | Original Mortgage Amount (£) | number | NO | >= 0 | Amount at origination |
| currentBalance | Remaining Balance (£) | number | YES | >= 0 | What is still owed |
| fixedMonthlyPayment | Monthly Payment (£) | number | NO | >= 0 | P+I only, not insurance/tax |
| interestRate | Interest Rate (%) | number | YES | >= 0, <= 20 | Used for payoff simulation |
| termMonths | Remaining Term | number | NO | >= 0 | Show as months; label "(months)" |
| earlyRepaymentFee | Early Repayment Charge | number | NO | >= 0 | ERC amount or % |
| earlyRepaymentFeeIsPercent | ERC type | toggle (£/%) | NO | — | Controls fee interpretation |
| earlyRepaymentAllowed | Overpayment Allowed | checkbox | NO | — | Defaults to true |
| isInterestOnly | Interest-Only | checkbox | NO | — | Affects payoff simulation logic |

Validation rules:
- `name` and `currentBalance` required
- `interestRate` required for payoff accuracy (same soft guidance as credit card APR)
- ERC fee only meaningful if a value > 0 is entered; `earlyRepaymentFeeIsPercent` toggle next to the field

### Personal Loan

Same DB fields as mortgage; labels use loan terminology:

| Field | Label (Personal Loan) | Type | Required | Validation | Notes |
|-------|----------------------|------|----------|------------|-------|
| name | Account Name | text | YES | Non-empty | e.g. "TSB Personal Loan" |
| debtType | Type | select | YES | — | Drives field visibility |
| originalPrincipal | Original Loan Amount (£) | number | NO | >= 0 | Amount at origination |
| currentBalance | Remaining Balance (£) | number | YES | >= 0 | What is still owed |
| fixedMonthlyPayment | Monthly Payment (£) | number | NO | >= 0 | |
| interestRate | Interest Rate (%) | number | YES | >= 0, <= 50 | |
| termMonths | Remaining Term (months) | number | NO | >= 0 | |
| earlyRepaymentFee | Early Repayment Fee | number | NO | >= 0 | Less common than mortgages |
| earlyRepaymentFeeIsPercent | Fee type | toggle (£/%) | NO | — | |
| earlyRepaymentAllowed | Overpayment Allowed | checkbox | NO | — | |
| isInterestOnly | Interest-Only | checkbox | NO | — | Rare for personal loans but schema supports it |

### Other / Generic

For debt types that don't fit credit card or loan/mortgage. Uses the loan field set as a fallback.
The current code has no "other" option — the select has only credit-card, loan, mortgage.

| Field | Label | Type | Required | Notes |
|-------|-------|------|----------|-------|
| name | Account Name | text | YES | |
| debtType | Type | select | YES | |
| currentBalance | Current Balance (£) | number | YES | |
| interestRate | Interest Rate (%) | number | NO | May be 0 for 0% buy-now-pay-later |
| fixedMonthlyPayment | Monthly Payment (£) | number | NO | |

Note: The "Other" type as a fourth option is a minor addition to the select element and the
type-switching logic — it is not a new category of data model work.

---

## Feature Dependencies

```
Existing: <div id="debtFormContainer"> (inline banner)
    └──replaced by──> <dialog id="debtModal"> (modal overlay)
                          └──requires──> showModal() / close() API
                          └──provides──> native focus trapping (no custom code)
                          └──provides──> Escape key close (native, with guard override)

Existing: toggleDebtTypeFields() (works correctly)
    └──reused by──> modal; fires on type <select> change inside modal DOM
                        └──requires──> field element IDs exist in modal after renderDebtForm()

Existing: renderDebtForm() (populates fields)
    └──reused by──> modal; renders into modal's inner container instead of #debtFormContainer
                        └──unchanged logic, changed target container

Existing: handleSaveDebt() (save path, haptics, validation)
    └──reused by──> modal; same logic, calls dialog.close() after success instead of toggleDebtForm(false)

Existing: cancelEditDebt() (discard-changes guard)
    └──reused by──> modal Escape key, cancel button, click-outside
                        └──requires──> modal.close() called after confirmation

Inline validation (new)
    └──enhances──> name, currentBalance, apr/interestRate fields
    └──requires──> blur event listeners attached after renderDebtForm() fills the modal
```

### Dependency Notes

- **Modal replaces container, not logic**: `renderDebtForm()`, `handleSaveDebt()`, `toggleDebtTypeFields()`, and `cancelEditDebt()` all remain largely unchanged. Only their entry/exit points (show/hide container) change to `dialog.showModal()` / `dialog.close()`.
- **Native dialog focus trapping**: Using `<dialog>` with `showModal()` gives focus trapping for free. Do not implement a custom focus trap — it would conflict with the native behavior.
- **Mortgage/loan labels**: Conditional label text requires either a `data-mortgage-label` / `data-loan-label` attribute pattern or rendering the entire form HTML in a template string (current approach), switching the label text based on `debtType` at render time.
- **"Other" type**: Requires adding a fourth `<option>` to the type select and a third branch in `toggleDebtTypeFields()` that shows the generic field set (reuse `loanOnlyFields` with reduced required fields, or a dedicated `otherOnlyFields` section).

---

## MVP Definition

### Launch With (v2.5)

- [ ] `<dialog>` modal replaces `#debtFormContainer` inline banner — core fix that unblocks everything
- [ ] `showModal()` / `close()` with focus trapping and Escape-key close (native)
- [ ] Click-outside-to-cancel (with discard-changes guard)
- [ ] Type selector shows/hides correct field sections in modal (reuse existing `toggleDebtTypeFields()`)
- [ ] Add mode: empty form, "Add Account" button, closes and re-renders debt list on save
- [ ] Edit mode: pre-populated form, "Save Changes" button, closes on save
- [ ] Name and current balance required — inline error text below field (not `alert()`)
- [ ] Mortgage-appropriate labels for mortgage type (at minimum: "Remaining Balance" instead of "Current Balance"; "Interest Rate" not "APR")
- [ ] Cancel button with discard-changes guard (existing `confirm()` is acceptable for MVP)

### Add After Validation (v2.5 polish pass)

- [ ] Blur-time inline validation on APR/interest rate fields — add once core modal is working
- [ ] Auto-focus name input on modal open — one-liner, add after basic modal works
- [ ] Numeric placeholder hints ("0.00", "2.50%") — audit and fill gaps

### Future Consideration (v2.6+)

- [ ] "Other" type as fourth debt type — useful but not blocking the main UX fix
- [ ] Progressive disclosure for promo rate fields — "Advanced" toggle; defer until user feedback indicates form feels long
- [ ] Mortgage-specific: property value field and LTV calculation — adds a new DB field; separate schema version; defer

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `<dialog>` modal container | HIGH — fixes the broken form | LOW — swap container type + two JS calls | P1 |
| Type-specific field switching in modal | HIGH — core purpose of milestone | LOW — existing logic reused | P1 |
| Add / edit pre-population in modal | HIGH — edit is already broken visually | LOW — existing `renderDebtForm()` unchanged | P1 |
| Inline required-field errors | HIGH — removes jarring `alert()` | LOW | P1 |
| Mortgage label adjustments | MEDIUM — clarity for the one mortgage type | LOW | P1 |
| Click-outside and Escape close | MEDIUM — UX completeness | LOW — native dialog + one event listener | P1 |
| Auto-focus name field | MEDIUM — reduces friction | LOW — one `.focus()` call | P2 |
| Blur-time validation on rate fields | MEDIUM — catches common entry errors early | MEDIUM | P2 |
| Placeholder formatting hints | LOW — marginal improvement | LOW | P2 |
| "Other" debt type | LOW — edge case | LOW-MEDIUM (new branch in toggle + form) | P3 |
| Progressive disclosure (advanced fields) | LOW — form is not long | MEDIUM | P3 |
| Property value / LTV for mortgage | LOW — requires new DB schema | HIGH | P3 |

**Priority key:** P1 = must ship in v2.5, P2 = ship in v2.5 if straightforward, P3 = future milestone

---

## Competitor Feature Analysis

| Feature | YNAB | Monarch Money | Our Approach (v2.5) |
|---------|------|---------------|---------------------|
| Add account UI | Modal dialog | Modal dialog | Modal `<dialog>` replacing inline banner |
| Type-specific fields | Account type changes available fields | Account type drives shown fields | Same — type select drives section visibility |
| Required fields for add | Name + account type | Name + account type | Name + current balance |
| Interest rate required | Optional (needed for projections) | Optional | Optional with soft prompt; required for payoff sim accuracy |
| Mortgage vs personal loan separation | Separate account types with different labels | Both are "liability" with same fields | Same DB schema; labels differ by `debtType` |
| Edit pre-population | Yes | Yes | Already works; preserved in modal |
| Cancel / discard guard | No (closes silently) | No (closes silently) | Yes — `confirm()` on discard |
| ERC / early repayment fee | Not tracked | Not tracked | Tracked (existing DB field, existing form field) |

---

## Sources

- `src/ui/debts.js` — existing form rendering, validation, save, and type-switching logic (HIGH confidence — primary source)
- `src/db/schema.js` — v13-v15 debt schema, all persisted fields (HIGH confidence — primary source)
- [YNAB: Loan Accounts Guide](https://support.ynab.com/en_us/loan-accounts-a-guide-HkNSkPHJi) — field expectations for loan tracking apps (MEDIUM confidence)
- [Monarch Money: Manual Accounts](https://help.monarch.com/hc/en-us/articles/360058187072-Manual-Accounts) — minimal required fields, optional detail pattern (MEDIUM confidence)
- [LogRocket: Modal UX Design Patterns](https://blog.logrocket.com/ux-design/modal-ux-design-patterns-examples-best-practices/) — focus trapping, validation, close behavior (MEDIUM confidence)
- [Eleken: Mastering Modal UX](https://www.eleken.co/blog-posts/modal-ux) — modal best practices (MEDIUM confidence)
- [MDN: HTMLDialogElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement) — native `<dialog>` API, `showModal()`, focus trapping (HIGH confidence)

---

*Feature research for: v2.5 — Debt Form Modal UX*
*Researched: 2026-03-07*
