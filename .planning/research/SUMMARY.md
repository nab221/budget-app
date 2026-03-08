# Project Research Summary

**Project:** Budget App v2.5 — Debt Form Modal UX Overhaul
**Domain:** Vanilla JS PWA — Modal dialog form integration with type-specific field switching
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

This milestone is a structural fix, not a feature addition. The debt form is broken in a specific and diagnosable way: an unclosed `<div>` in the `renderDebtForm()` template swallows the Save/Cancel action buttons into the `loanOnlyFields` container, making them invisible for credit card type (the default). The fix is to replace the broken inline `#debtFormContainer` banner with a native `<dialog>` modal that uses the existing `modalUI` infrastructure already proven in production by `backupUI` and `expensesUI`. No new npm packages, no architectural invention, and no new DB schema work is required.

The recommended approach leans entirely on existing infrastructure: `modalUI.show()` in `render.js` already handles overlay, Esc key, scroll lock, and footer button rendering via a real-DOM array API. The `debtUI` singleton in `debts.js` already owns `editingId` state, `handleSaveDebt()` validation, and `toggleDebtTypeFields()` field-switching logic — all of which are reused unchanged. The refactor is a wrapper replacement: `toggleDebtForm()` and `renderDebtForm()` are replaced by `openDebtModal(id)` and `_buildFormHTML(data)`, with the form HTML injected into `modalUI`'s body slot and footer buttons passed as the array config.

The primary risk is not technical complexity but execution discipline. Nine distinct pitfalls are documented, all preventable by following a strict build order: establish modal scaffold and canonical field ID constants first, then port field logic, then wire save/cancel, then remove the old inline form. Any phase that skips the scaffold step and jumps directly to feature logic will reproduce the unclosed-div class of bug in new form. The discard-changes guard and backdrop-click confirm must be wired before save logic, not after, to avoid data loss paths shipping.

---

## Key Findings

### Recommended Stack

No new npm dependencies are required for v2.5. All techniques are native browser APIs (Baseline Widely Available since 2022) or existing in-codebase infrastructure.

**Core technologies:**
- `<dialog>` + `showModal()`: Native modal container — replaces `#debtFormContainer`; provides focus trapping, Esc close, `::backdrop`, and `inert` background automatically. Supported Chrome 37+, Firefox 98+, Safari 15.4+, iOS Safari 15.4+ (95.57% global coverage).
- `modalUI` (existing, `src/ui/render.js`): Generic modal shell already in production — overlay, scroll lock, footer button array API, ESC wiring. No change needed.
- Constraint Validation API (native): `checkValidity()`, `setCustomValidity()`, `validity` object — handles required fields, type checking, and cross-field business rules with zero library overhead.
- CSS class toggle (`classList.toggle('hidden')`): Field-switching pattern — already implemented in `toggleDebtTypeFields()`, reused as-is for four debt types.

### Expected Features

**Must have (table stakes — v2.5 P1):**
- True modal overlay replacing inline banner — the core fix; unblocks all other form UX
- Esc key and click-outside dismiss with discard-changes guard
- Focus trapped inside modal (native with `showModal()`)
- Type selector shows/hides correct fieldsets in modal (reuse `toggleDebtTypeFields()`)
- Add mode: blank form, "Add Account" button label
- Edit mode: pre-populated form, "Save Changes" button label
- Name and current balance inline validation errors (replace `alert()`)
- Mortgage-appropriate field labels ("Remaining Balance" vs "Current Balance")

**Should have (v2.5 P2 — add after core modal works):**
- Blur-time inline validation on APR/interest rate fields
- Auto-focus name input on modal open
- Numeric placeholder hints ("0.00", "2.50%")

**Defer (v2.6+):**
- "Other/Generic" fourth debt type — useful but not blocking the UX fix
- Progressive disclosure for promo rate fields ("Advanced" toggle)
- Property value / LTV field for mortgage (requires new DB schema version)
- Multi-step wizard, bulk CSV import, real-time payoff preview in form

### Architecture Approach

The debt modal logic stays in `src/ui/debts.js`. No new file is needed. The pattern is Modal-as-Container: `openDebtModal(id = null)` builds form HTML via `_buildFormHTML(data)` and injects it into `modalUI`'s `#modalBody` slot. Footer buttons are passed as a `{ label, className, onClick }` array to `modalUI.show()`, which creates real DOM nodes with bound JS functions — this avoids inline `onclick` attribute globals and sidesteps DOMPurify attribute stripping concerns. The repository layer (`debtRepository.add/update`) is unchanged; pence conversion and `generateLoanPayments()` side effects remain encapsulated there.

**Major components and changes:**

| Component | File | Change |
|-----------|------|--------|
| Debt modal form | `src/ui/debts.js` | `openDebtModal()` + `_buildFormHTML()` replace `toggleDebtForm()` + `renderDebtForm()` |
| Generic modal shell | `src/ui/render.js` (modalUI) | Unchanged — already supports this use case |
| Debt data access | `src/db/repository.js` | Unchanged — API contract unaffected |
| HTML shell | `index.html` | Remove `#debtFormContainer`; `#modalOverlay` already present |

Build order matters: (1) wire `modalUI` import and placeholder open, (2) port form HTML into `_buildFormHTML`, (3) add "Other" type section, (4) wire save/cancel buttons, (5) remove inline form from HTML, (6) pre-population and validation pass.

### Critical Pitfalls

1. **Unclosed `<div>` swallows Save/Cancel buttons** — The root cause of the current bug. In `renderDebtForm()`, `loanOnlyFields` div is missing its closing tag, so action buttons are nested inside it and hidden for credit card type. Fix: define explicit HTML structure with comments marking BEGIN/END of each fieldset; keep action row completely outside all conditional containers.

2. **Type-switch state not initialized on modal open** — `toggleDebtTypeFields()` is called only on `<select>` change events, not on modal open. For edit mode (pre-selected type), fieldsets show the wrong set until user touches the selector. Fix: always call `toggleDebtTypeFields()` once at the end of the open/populate sequence, after the select value is set.

3. **Field ID drift between template and save handler** — Input IDs are defined in the HTML template and referenced by string in `handleSaveDebt()`. They drift apart during refactoring; `getElementById()` returns null; save silently writes NaN to DB. Fix: define a `FIELD_IDS` constants object at module top; use it in both the template and the save handler.

4. **Inline `onclick`/`onchange` attributes fail after refactor** — Inline attributes resolve against `window` scope. If `window.debtUI` is not yet assigned, handlers throw `ReferenceError`. Fix: wire all internal modal events via `addEventListener` after injection; reserve `window.debtUI` globals only for external callers (edit buttons on debt cards).

5. **Backdrop dismiss loses unsaved edit changes** — The native `<dialog>` fires a `cancel` event on Esc; developers add a backdrop-click handler but forget the confirm prompt. Fix: handle both the `cancel` event (Esc) and the `click` event (backdrop target check `e.target === dialog`) with a "Discard changes?" confirm gate; wire these before any save logic.

6. **`<dialog>` nested in tab panel breaks backdrop** — If `<dialog>` is a child of a tab panel div with `overflow: hidden` or `position: relative`, the `::backdrop` clips to that panel's bounds. Fix: place `<dialog>` as a direct child of `<body>`.

---

## Implications for Roadmap

Based on the combined research, this milestone maps cleanly to a four-phase build sequence. Each phase leaves the app in a working state.

### Phase 1: Modal Scaffold

**Rationale:** The modal structure must exist before any field logic is written. This phase establishes the patterns (field ID constants, `addEventListener` wiring, `<dialog>` placement) that prevent the entire pitfall class of the current bug. Skip this and you reproduce the unclosed-div problem in new code.

**Delivers:** A working (but empty) debt modal that opens, closes, responds to Esc, handles backdrop click with confirm guard, clears `editingId` on all dismiss paths, and is placed as a direct body child.

**Addresses:** True modal overlay, Esc close, click-outside cancel, focus trapping (native), clear add vs edit mode signaling.

**Avoids:** Unclosed div swallowing buttons (Pitfall 1), inline onclick globals (Pitfall 4), dialog nested in tab panel (Pitfall 6), stale `editingId` on dismiss.

**Research flag:** Standard pattern — skip research-phase. Native `<dialog>` + `modalUI` integration is fully documented.

### Phase 2: Field Logic and Type Switching

**Rationale:** With the scaffold in place, port the form HTML from `renderDebtForm()` into `_buildFormHTML(data)`. Extend `toggleDebtTypeFields()` to handle all debt types in the modal DOM context. Define `FIELD_IDS` constants before writing a single `getElementById` call.

**Delivers:** Modal with all type-specific fieldsets (credit card, mortgage, loan, other), correct show/hide on type select change, and correct initial visibility on modal open without user interaction.

**Implements:** DOM Show/Hide pattern, field ID constants (Pitfall 3 fix), `addEventListener`-based event wiring (Pitfall 4 fix), `toggleDebtTypeFields()` initialization call on open (Pitfall 2 fix).

**Avoids:** Type-switch not initialized on open (Pitfall 2), field ID drift (Pitfall 3), inline onclick globals (Pitfall 4).

**Research flag:** Standard pattern — skip research-phase.

### Phase 3: Save, Edit Pre-Population, and Validation

**Rationale:** With the form structure stable, wire `handleSaveDebt()` to the modal's Save button via the `modalUI` footer array API. Implement edit pre-population that writes to all fieldsets (not just the visible one). Replace `alert()` validation with inline field-level error text.

**Delivers:** Fully working Add and Edit flows for all debt types. Inline required-field validation. Mortgage-appropriate labels. `editingId` correctly gates `debtRepository.add` vs `debtRepository.update`.

**Addresses:** Add mode, edit mode pre-population, name/balance required inline errors, mortgage label adjustments, haptic feedback on save (preserved, no change needed in `handleSaveDebt()`).

**Avoids:** Edit pre-population gaps (Pitfall 6 from PITFALLS.md), type-switch during edit zeroing fields, pence conversion boundary bugs, double-save on slow connection (disable Save button during async write).

**Research flag:** Standard pattern — skip research-phase. Constraint Validation API patterns fully documented in STACK.md.

### Phase 4: Cleanup and Polish Pass

**Rationale:** Remove the old `#debtFormContainer` from `index.html` atomically with confirming all new modal paths work. Then add P2 polish items as incremental improvements.

**Delivers:** Clean HTML with no dead code. Improved form feel with auto-focus, blur validation on rate fields, and complete placeholder coverage.

**Addresses:** Auto-focus name field (P2), blur-time validation on APR fields (P2), numeric placeholder hints (P2).

**Avoids:** Keeping `#debtFormContainer` alongside modal during testing (the two removals are atomic — old form and old code path removed in the same change).

**Research flag:** Standard pattern — skip research-phase. Incremental polish with no integration unknowns.

### Phase Ordering Rationale

- Scaffold before field logic: the current bug proves that writing field HTML before establishing structural boundaries produces invisible action buttons. Phase 1 makes Phase 2 safe.
- Field structure before save wiring: `handleSaveDebt()` reads inputs by ID. Those IDs must exist and be stable (via `FIELD_IDS` constants) before the save handler is written or tested.
- Save/edit before cleanup: Phase 4 removes the old form. Removing it before Phase 3 is complete leaves the app with no working debt form at all.
- The "Other" type is included in Phase 2 (field structure) rather than deferred — it is a single new fieldset div and a fourth `<option>`, and deferring it creates a second HTML structure change later.

### Research Flags

No phase in this milestone requires a dedicated `/gsd:research-phase` run. All patterns are either verified from direct codebase inspection (HIGH confidence) or from official MDN documentation (HIGH confidence). The "Other" debt type and Constraint Validation API are fully characterized in the research files.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | v2.5 uses only native browser APIs. `<dialog>` support data fetched directly from Can I Use (95.57%). No new npm packages. |
| Features | HIGH | Primary evidence is the codebase itself (`src/ui/debts.js`, `src/db/schema.js`). No fields or schema changes needed. Field sets and validation rules derived from direct schema inspection. |
| Architecture | HIGH | All components inspected directly. `modalUI` in `render.js` confirmed to support this use case via `backupUI` and `expensesUI` production usage. Data flow documented from first-party source. |
| Pitfalls | HIGH (code bugs) / MEDIUM (modal patterns) | Pitfalls 1 and 2 confirmed by direct code inspection (line 246 for unclosed div). Modal accessibility patterns from MDN and established web platform references. |

**Overall confidence:** HIGH

### Gaps to Address

- **Discard-changes detection for Add mode:** Determining "has the user entered anything?" requires either tracking initial field state on modal open or checking if any field is non-empty/non-zero. The research recommends the latter as simpler. Confirm the specific implementation during Phase 3 — the `confirm()` call should not fire if the user opens Add and immediately dismisses without typing anything.

- **`modalUI` ESC handler and `editingId` cleanup:** Confirm during Phase 1 that `modalUI`'s existing Esc/close handler calls a cleanup callback (clearing `editingId`) rather than calling `modalUI.close()` directly without running cleanup. If not, wire the cleanup via a `dialog.addEventListener('close')` callback in `openDebtModal`.

- **Mortgage vs loan field separation:** Current code conflates loan and mortgage into one `loanOnlyFields` div. v2.5 separates them since mortgages have distinct fields (ERC, interest-only flag). This separation must happen in Phase 2; mixing them is the existing source of label confusion for mortgage users.

---

## Sources

### Primary (HIGH confidence)
- `src/ui/debts.js` — existing `debtUI` object; `renderDebtForm`, `handleSaveDebt`, `toggleDebtTypeFields`; unclosed div confirmed at line 246
- `src/ui/render.js` — `modalUI.show()` implementation; array-of-button-configs path; scroll lock
- `src/db/repository.js` — `debtRepository` pence fields, `generateLoanPayments` side effect
- `src/db/schema.js` — v13–v15 debt schema; all persisted fields
- `index.html` — `#modalOverlay` structure; `#debtFormContainer` location; `#addDebtBtn` placement
- [MDN: `<dialog>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) — showModal(), cancel event, backdrop behavior, focus management
- [Can I Use: dialog element](https://caniuse.com/dialog) — 95.57% global support, browser floor versions
- [MDN: Constraint Validation API](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation) — checkValidity(), setCustomValidity()

### Secondary (MEDIUM confidence)
- [LogRocket: Modal UX Design Patterns](https://blog.logrocket.com/ux-design/modal-ux-design-patterns-examples-best-practices/) — focus trapping, validation UX patterns
- [YNAB: Loan Accounts Guide](https://support.ynab.com/en_us/loan-accounts-a-guide-HkNSkPHJi) — field expectations for loan tracking apps
- [Jared Cunha: HTML Dialog Accessibility](https://jaredcunha.com/blog/html-dialog-getting-accessibility-and-ux-right) — autofocus pitfalls, scroll lock pattern, scrollbar-gutter
- [web.dev: dialog and popover baseline](https://web.dev/articles/baseline-in-action-dialog-popover) — modal vs non-modal distinction
- `.planning/debug/debt-ui-consolidation-failure.md` — historical evidence of disconnected form/container architecture
- `.planning/debug/debt-id-mismatch-and-save-error.md` — save handler fragility and Dexie transaction scope bug

### Tertiary (LOW confidence)
- [Monarch Money: Manual Accounts](https://help.monarch.com/hc/en-us/articles/360058187072-Manual-Accounts) — minimal required field pattern for competitor context
- [Eleken: Mastering Modal UX](https://www.eleken.co/blog-posts/modal-ux) — modal UX best practices (general industry reference)

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
