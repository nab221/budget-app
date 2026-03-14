# Phase 16: Debt History UX Refinement - Research

**Researched:** 2026-03-08
**Domain:** Vanilla JS DOM manipulation, CSS sticky columns, inline UI patterns, Vitest/jsdom testing
**Confidence:** HIGH

## Summary

Phase 16 is a pure UI polish phase within a single file (`src/ui/debts.js`). No new dependencies are needed. All four requirements operate on already-existing DOM, repository, and utility patterns established in phases 11-15. The work is well-bounded: fix a bug in `_populateEditFields` (EDIT-04), apply CSS column widths + sticky positioning to the history table (HIST-01), swap one text button for a pencil icon (HIST-02), and wire an inline Mark Paid toggle per statement row (HIST-03).

The EDIT-04 bug is identifiable from code inspection: `openDebtModal` calls `modalUI.show()` which replaces body HTML synchronously, then immediately sets the `typeSelect.value` and calls `_onTypeChange()` and `_populateEditFields()`. Because `_buildFormHTML()` generates the form as an HTML string that `modalUI.show()` injects, the inputs exist in the DOM when `_populateEditFields` runs — so the bug likely lies in the mock DOM used during testing rather than the actual flow. The test for EDIT-02 (line 379 of debts.test.js) demonstrates the correct pattern: `modalUI.show` is mocked to inject content into `document.body.innerHTML`, which makes all inputs queryable. The EDIT-04 RED test must cover all four debt types (credit-card, mortgage, loan, other) with a similar pattern.

The history table CSS work (HIST-01) uses CSS `position: sticky` on `<td>` and `<th>` elements with fixed pixel widths and `overflow-x: auto` on the wrapper — a well-supported pattern in all modern browsers. The scroll indicator (visible on open, fades after ~2s) is implemented with a CSS class + `setTimeout` to remove it, no JS scroll listener needed.

**Primary recommendation:** Implement in one wave: EDIT-04 test + fix first (safest change, validates existing call chain), then HIST-01 CSS, then HIST-02 icon swap, then HIST-03 inline Mark Paid toggle.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**EDIT-04:**
- Bug confirmed: editing a debt opens modal with all fields empty. Broken for all four debt types.
- Approach: RED/GREEN test pattern — write failing test asserting fields populated for each type, then fix root cause.
- Test must cover all four types: credit-card, mortgage, loan, other.

**HIST-01:**
- Keep all 10 columns. Fixed widths totalling ~665px with `overflow-x: auto` (already in place).
- Column widths (exact): Date 80px, Opening 70px, Closing 70px, Int 50px, Fees 50px, Min Due 65px, Due Date 80px, Paid 60px, Paid On 80px, Actions 60px.
- Sticky: Date column sticks left, Actions column sticks right — always visible while scrolling.
- Scroll UX: box-shadow on scroll edges, visible horizontal scroll indicator on first load fading after ~2s.
- Date format: "08 Mar" (day + 3-letter month, no year).
- Large value abbreviation: "£1.2k" for Opening/Closing columns.

**HIST-02:**
- Replace text "Edit" button in statement rows with pencil icon ✏️.
- Keep consistent with the ✕ delete button sizing/class already in place.

**HIST-03:**
- Green tick (✓) button per statement row.
- Clicking ✓ replaces button with inline prompt (amount field + Confirm/Cancel) within the same `<td>`.
- Amount field pre-filled with `minimumPayment` for that statement (use `fromPence`).
- On confirm: save `actualPaymentAmount` + `actualPaymentDate` = today via `statementRepository.update`, then deduct from `debt.currentBalance` via `debtRepository.update`, then call `renderStatements(debtId)` + `render()`.
- On cancel: restore original row (no changes).
- Haptic success feedback on confirm via `triggerHaptic('success')`.
- If statement already has `actualPaymentDate` set: ✓ button does not show (or shows disabled).

### Claude's Discretion
- Exact CSS for sticky columns (position: sticky implementation details)
- Scroll edge shadow implementation (CSS or JS scroll event)
- Scroll indicator fade animation duration/style
- Inline prompt HTML structure within the table row
- Whether to use a separate function or inline logic for the Mark Paid row toggle

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDIT-04 | Clicking pencil icon on a debt row auto-fills modal fields with current debt data | Call chain exists (`editDebt` → `openDebtModal` → `_populateEditFields`); bug is in test DOM setup or a timing issue in the async flow; fixed by writing RED test that proves population then finding root cause |
| HIST-01 | History modal table uses improved spacing/layout with fixed column widths, sticky Date/Actions columns, scroll edge shadows, and fade-in scroll indicator | Pure CSS + minimal JS (setTimeout for fade); no new dependencies; `_buildHistoryModalHTML` and `renderStatements` are the only files to modify |
| HIST-02 | Edit buttons in history rows use standard pencil icon ✏️ for consistency | Single string change in `renderStatements` row template at debts.js:867 |
| HIST-03 | Each statement row has a "Mark Paid" green tick button with inline confirm prompt | Inline toggle pattern matches existing `stmtFormContainer` show/hide; uses `statementRepository.update` (already has `actualPaymentAmount` field in penceFields) and `debtRepository.update`; `fromPence`/`toPence` utilities already imported |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2022+ | DOM manipulation, event handling | Project uses no frontend framework |
| CSS `position: sticky` | Native | Sticky table columns | Browser-native, no library needed |
| Vitest | ^3.0.7 | Unit testing | Already in project (package.json devDependencies) |
| jsdom | ^28.1.0 | DOM environment for tests | Already configured (`// @vitest-environment jsdom` at top of debts.test.js) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `safeHTML` template tag | Project util | Safe HTML string generation | All dynamic HTML in debts.js — already used everywhere |
| `formatGBP(pence)` | Project util | Format currency for display | Standard display; for abbreviated £1.2k format, needs a new helper or inline logic |
| `fromPence(val)` | Project util | Pence to decimal | Pre-filling Mark Paid amount field |
| `toPence(val)` | Project util | Decimal to pence | Already handled by `statementRepository` penceFields array |
| `triggerHaptic(type)` | Project util | Haptic feedback | Mark Paid confirm: `triggerHaptic('success')` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS sticky | JS-based fixed overlay columns | CSS is far simpler; JS alternative only needed for IE11 (not a concern) |
| Inline Mark Paid toggle | Second modal | User explicitly chose inline — no modal |
| setTimeout fade | CSS animation + class removal | Both work; setTimeout is simpler and already used in this file (PDF pulse effect at line 629) |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
No structural changes — all work is within `src/ui/debts.js`. The file's existing layout:
```
debtUI = {
  // State
  editingId, editingStmtId, activeStmtDebtId

  // Lifecycle
  init(), setupEventListeners()

  // Debt Modal
  openDebtModal(), _buildFormHTML(), _populateEditFields(), _saveDebt(), _closeDebtModal()

  // History Modal            ← HIST-01 changes here
  openHistoryModal(), _buildHistoryModalHTML(), _closeHistoryModal()

  // Statement CRUD
  renderStatements()          ← HIST-02, HIST-03 changes here
  renderStmtForm(), handleSaveStatement(), ...

  // Validation
  _onTypeChange(), _showFieldError(), _clearFieldErrors()
}
```

### Pattern 1: RED/GREEN Bug Fix (EDIT-04)
**What:** Write a failing test that asserts field values match the debt object, run it to confirm failure, then identify and fix root cause in `openDebtModal` / `_populateEditFields`.
**When to use:** Bug confirmed in production code, test coverage doesn't yet prove the specific field-population behaviour.
**Example pattern from existing tests (EDIT-02 at debts.test.js:379):**
```javascript
// Mock modalUI.show to inject the form into real DOM
modalUI.show.mockImplementationOnce((title, content) => {
  document.body.innerHTML = content;
});

debtRepository.get.mockResolvedValueOnce({
  id: 1, name: 'Test CC', debtType: 'credit-card',
  currentBalance: 50000,  // pence
  apr: 19.9, creditLimit: 200000, minPayment: 2500,
  promoEndDate: '', postPromoApr: 19.9
});

await debtUI.openDebtModal(1);

expect(document.getElementById('ccBalanceInput').value).toBe('500');   // fromPence(50000)
expect(document.getElementById('ccAprInput').value).toBe('19.9');
```
The same pattern must be replicated for mortgage, loan, and other types in separate `it()` blocks.

**Root cause investigation:** Looking at `openDebtModal` (lines 112-158 of debts.js): `modalUI.show(title, formHTML, buttons)` is called synchronously. If the real `modalUI.show` renders into a shadow DOM or re-attaches elements rather than replacing `document.body.innerHTML`, `document.getElementById` calls inside `_populateEditFields` would find elements from _before_ the modal rendered. But since the existing EDIT-02 test proves this works when `modalUI.show` injects HTML into `document.body.innerHTML`, the EDIT-04 RED tests should use the same mock pattern. The production bug (fields empty) likely happens because `modalUI.show` renders into a `<dialog>` element and there's a timing issue or a DOM reset after `_populateEditFields` is called — check if `modalUI.show` clears the modal body after other async operations.

### Pattern 2: CSS Sticky Table Columns (HIST-01)
**What:** Apply `position: sticky` to the first and last column cells, with `z-index` layering and background color to prevent content bleed-through when scrolling.
**When to use:** Table wider than viewport, certain columns must always be visible.
**Example:**
```css
/* Applied via inline style in _buildHistoryModalHTML */
/* or via a class added to the wrapper */
.tbl-scroll-wrapper {
  overflow-x: auto;
  position: relative;
}

/* On <th> and <td> for Date column (first): */
position: sticky;
left: 0;
z-index: 2;
background: var(--bg);   /* must match row background or content will show through */

/* On <th> and <td> for Actions column (last): */
position: sticky;
right: 0;
z-index: 2;
background: var(--bg);
```
Since this project uses inline styles extensively (debts.js uses `style="..."` throughout), the sticky styles can be applied as inline styles in the `safeHTML` template or via a `<style>` block injected into the modal body. A `<style>` block is cleaner for table-wide column width rules.

### Pattern 3: Scroll Indicator Fade (HIST-01)
**What:** Add a CSS class that shows a translucent scroll hint, then remove it after ~2s.
**When to use:** Overflow-scrollable container where the scroll affordance isn't obvious.
**Example:**
```javascript
// In openHistoryModal(), after modalUI.show():
const wrapper = document.getElementById('stmtTableWrapper');
wrapper?.classList.add('scroll-hint-visible');
setTimeout(() => wrapper?.classList.remove('scroll-hint-visible'), 2000);
```
The `.scroll-hint-visible` class can use a `::after` pseudo-element or a separate indicator element. Since this project avoids external CSS files per phase, the style should be injected in the modal body `<style>` block.

### Pattern 4: Inline Mark Paid Toggle (HIST-03)
**What:** The ✓ button's `<td>` content is replaced with an inline form; cancel restores it.
**When to use:** Quick action that doesn't warrant a full modal, per user decision.
**Example:**
```javascript
// Global handler wired in setupEventListeners or via onclick in safeHTML:
window.showMarkPaidPrompt = (stmtId, debtId, minPaymentPence) => {
  const td = document.getElementById(`mark-paid-td-${stmtId}`);
  if (!td) return;
  const defaultAmount = (minPaymentPence / 100).toFixed(2);
  td.innerHTML = `
    <input id="markPaidAmt-${stmtId}" type="number" step="0.01" value="${defaultAmount}" style="width:60px">
    <button class="sm primary" onclick="confirmMarkPaid(${stmtId}, ${debtId})">✓</button>
    <button class="sm ghost" onclick="cancelMarkPaid(${stmtId}, ${debtId})">✕</button>
  `;
};

window.confirmMarkPaid = async (stmtId, debtId) => {
  const amtInput = document.getElementById(`markPaidAmt-${stmtId}`);
  const amtPounds = parseFloat(amtInput?.value) || 0;
  const today = new Date().toISOString().slice(0, 10);

  await statementRepository.update(stmtId, {
    actualPaymentAmount: amtPounds,   // penceFields handles toPence conversion
    actualPaymentDate: today
  });

  const debt = await debtRepository.get(debtId);
  const newBalancePence = (debt.currentBalance || 0) - toPence(amtPounds);
  await debtRepository.update(debtId, { currentBalance: fromPence(Math.max(0, newBalancePence)) });

  triggerHaptic('success');
  await debtUI.renderStatements(debtId);
  await debtUI.render();
};
```

Note: `statementRepository`'s `penceFields` array already includes `'actualPaymentAmount'` (confirmed at repository.js:263), so passing the decimal value will be correctly stored as pence.

### Anti-Patterns to Avoid
- **Writing raw HTML strings outside `safeHTML`:** The project uses `safeHTML` for all dynamic HTML in debts.js — do not bypass it, especially for user-controlled data like debt names displayed in the inline prompt.
- **Adding a new `<dialog>` for Mark Paid:** User explicitly chose inline prompt within the row. No second modal.
- **Modifying the DB schema:** Schema v15 already has `actualPaymentAmount` and `actualPaymentDate` on statements. No migration needed.
- **Using `window.event` or `event` from inline onclick for the Mark Paid amount:** Use `document.getElementById` with the statement ID in the input ID to retrieve the value reliably.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency abbreviation (£1.2k) | Custom formatter | Inline helper `abbrevGBP(pence)` or one-liner in renderStatements | Only needed in 2 columns; a 3-line function suffices — don't add a new utility file |
| Scroll edge shadow | Intersection Observer or scroll event | CSS `box-shadow` on the wrapper + `::before`/`::after` pseudo-elements | CSS handles this without JS; simpler and zero runtime cost |
| Pence conversion in Mark Paid | Custom converter | `fromPence` (already imported) for pre-fill; `statementRepository.update` penceFields for save | These already exist and are tested |

**Key insight:** This phase is refinement, not new infrastructure. Every utility needed already exists — the work is wiring them together correctly.

## Common Pitfalls

### Pitfall 1: Sticky Column Background Bleed-Through
**What goes wrong:** Sticky column cells scroll over other cells but the content underneath shows through because the sticky cell has a transparent background.
**Why it happens:** `position: sticky` does not clip content behind the cell — it just keeps the cell in view. Without an explicit `background` matching the modal background, scrolled content is visible.
**How to avoid:** Always set `background: var(--bg)` (or equivalent modal background variable) on sticky `<th>` and `<td>` elements. In dark mode this is critical since contrast is low.
**Warning signs:** Test by scrolling the table and checking if text from non-sticky columns shows under the Date or Actions columns.

### Pitfall 2: z-index Conflicts with Modal Overlay
**What goes wrong:** Sticky table columns appear above the modal overlay or other elements in the stacking context.
**Why it happens:** The modal uses `position: fixed` with a high z-index. Sticky elements inside the modal create a new stacking context only within the modal's overflow container.
**How to avoid:** Keep sticky cell `z-index` values modest (2–3) — they only need to be above sibling cells within the same table, not above the modal itself.

### Pitfall 3: `safeHTML` Escaping Breaking Inline Styles in Mark Paid Prompt
**What goes wrong:** If the inline prompt HTML is built using `safeHTML` with dynamic values, the template tag may escape characters needed for the inline event handler strings.
**Why it happens:** `safeHTML` calls `sanitize()` on interpolated values. If an ID or amount contains unexpected characters, display may break.
**How to avoid:** Use numeric IDs only in the `onclick` attribute (which are safe), and build the inline prompt HTML as a regular string assigned to `td.innerHTML` (since the inputs themselves have no user content, DOMPurify isn't needed for static structure). This matches the existing `container.innerHTML = ...` pattern in `renderStmtForm` which also uses plain assignment after `safeHTML` generation.

### Pitfall 4: EDIT-04 — Modal Show Timing
**What goes wrong:** `_populateEditFields(debt)` is called but the form fields aren't in the DOM yet because `modalUI.show` is async or defers rendering.
**Why it happens:** If `modalUI.show` uses `requestAnimationFrame` or a CSS transition before inserting content, `document.getElementById` calls immediately after `modalUI.show()` would find nothing.
**How to avoid:** Inspect the real `modalUI.show` implementation in `src/ui/render.js` to confirm it is synchronous. If it is synchronous (likely given EDIT-02 test passes with synchronous mock), the bug is something else — check whether `_populateEditFields` is called before or after `_onTypeChange()` shows the correct fieldset (it must run after, which it does in the current code at lines 153-154).

### Pitfall 5: Mark Paid Balance Goes Negative
**What goes wrong:** User enters a payment larger than `currentBalance` — `debt.currentBalance` becomes negative.
**Why it happens:** No guard on the subtraction.
**How to avoid:** Clamp with `Math.max(0, newBalance)` when calculating the updated balance. The `confirmMarkPaid` example above already includes this.

### Pitfall 6: `position: sticky` Not Working on `<td>` Inside Scrollable Parent
**What goes wrong:** Sticky table cells don't stick because the `overflow-x: auto` container is a direct ancestor but lacks `height` or `position`.
**Why it happens:** Browsers require the sticky element's scrolling ancestor (the `overflow-x: auto` wrapper) to have a defined size. `<div style="overflow-x:auto">` without a defined height sometimes doesn't create the right stacking context for horizontal sticky.
**How to avoid:** Set `overflow-x: auto; overflow-y: visible` on the wrapper (separate axes). For horizontal sticky: the wrapper needs `overflow-x: auto` but `overflow-y: visible` or `unset` — not `overflow: auto` on both axes (which can break vertical sticky). For this phase only horizontal sticky is needed, so this is straightforward.

## Code Examples

Verified patterns from existing codebase:

### Inline Toggle Pattern (already in debts.js)
```javascript
// Source: debts.js:424-431 (toggleStmtForm)
if (show) {
  this.activeStmtDebtId = debtId;
  container.classList.remove('hidden');
  return await this.renderStmtForm(debtId);
} else {
  container.classList.add('hidden');
  this.editingStmtId = null;
}
```
Mark Paid follows the same toggle: replace `<td>` content on show, restore on cancel.

### statementRepository.update with penceFields
```javascript
// Source: repository.js:262-263
export const statementRepository = {
  ...createBaseRepository(db.statements, ['amount', 'interest', 'fees', 'openingBalance', 'minimumPayment', 'actualPaymentAmount']),
```
`actualPaymentAmount` is already in the penceFields list — pass decimal pounds to `statementRepository.update` and it converts to pence automatically.

### PDF pulse effect (setTimeout fade precedent)
```javascript
// Source: debts.js:624-630
el.style.transition = 'background-color 0.5s';
el.style.backgroundColor = 'var(--accent-light)';
setTimeout(() => el.style.backgroundColor = '', 1500);
```
Same setTimeout pattern applies to the scroll indicator fade.

### debtRepository.update (balance deduction)
```javascript
// Source: debts.js:99-100 (deleteStatement handler)
const newBalance = debtStmts.length > 0 ? fromPence(debtStmts[0].amount) : 0;
await debtRepository.update(debtId, { currentBalance: newBalance });
```
Mark Paid uses the same `debtRepository.update` call but calculates new balance as `currentBalance - paymentAmount`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline ledger expansion | History modal via `modalUI.show` | Phase 15 | `_buildHistoryModalHTML` is the canonical table location |
| Text "Edit" button in statement rows | Pencil icon ✏️ | Phase 16 (this phase) | One-line change in `renderStatements` |
| No payment tracking in rows | Mark Paid inline action | Phase 16 (this phase) | `actualPaymentAmount`/`actualPaymentDate` already in DB schema |

**Deprecated/outdated:**
- `toggleLedger` / `openLedgerId`: removed in Phase 15. Do not reference.
- `#stmtBody-${debtId}` / `#stmtFormContainer-${debtId}`: legacy IDs. Current IDs are `stmtBody-modal` and `stmtFormContainer-modal`. The code has fallback logic — don't remove fallbacks in this phase.

## Open Questions

1. **Root cause of EDIT-04**
   - What we know: The call chain (`openDebtModal` → `_populateEditFields`) is structurally correct. The EDIT-02 test (which tests the same chain for mortgage) passes.
   - What's unclear: The EDIT-04 issue is described as "confirmed broken in production" but EDIT-02 tests look like they should cover the same code path. The bug may be in a specific debt type, a `null`/`undefined` value being passed, or the real `modalUI.show` doing something the mock doesn't (e.g., clearing content after a transition).
   - Recommendation: When writing the RED tests for EDIT-04, use all four debt types with realistic pence values. If RED tests pass immediately (no failure), the bug is in the real browser environment, not the code path tested. In that case, inspect `src/ui/render.js` `modalUI.show` implementation directly.

2. **"£1.2k" abbreviation threshold**
   - What we know: User specified this for Opening and Closing columns.
   - What's unclear: The exact threshold (above what amount to abbreviate — £1,000? £10,000?).
   - Recommendation: Use £1,000 as the threshold. Values ≥ 100,000 pence (£1,000) display as £X.Xk. Values below display as full formatGBP output. Implement as a one-liner in `renderStatements`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.7 |
| Config file | none (auto-detected via package.json `"test": "vitest"`) |
| Quick run command | `npx vitest run src/ui/debts.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-04 | `openDebtModal(id)` populates correct fields for credit-card type | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |
| EDIT-04 | `openDebtModal(id)` populates correct fields for mortgage type | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |
| EDIT-04 | `openDebtModal(id)` populates correct fields for loan type | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |
| EDIT-04 | `openDebtModal(id)` populates correct fields for other type | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |
| HIST-01 | Table renders with column widths and sticky selectors in HTML | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |
| HIST-02 | Statement row contains ✏️ instead of text "Edit" | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |
| HIST-03 | Statement without `actualPaymentDate` renders ✓ button | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |
| HIST-03 | Statement with `actualPaymentDate` does not render ✓ button | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |
| HIST-03 | `confirmMarkPaid` calls `statementRepository.update` with amount and today | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |
| HIST-03 | `confirmMarkPaid` calls `debtRepository.update` with reduced balance | unit | `npx vitest run src/ui/debts.test.js` | ✅ (file exists, test to be added) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/ui/debts.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. `debts.test.js` exists with correct `// @vitest-environment jsdom` header and all mocks in place. New `it()` blocks slot into existing `describe` suites.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `src/ui/debts.js` (876 lines, full read) — call chain, existing patterns, line numbers
- Direct code inspection of `src/ui/debts.test.js` (403 lines, full read) — test structure, mock patterns, existing coverage
- Direct code inspection of `src/db/repository.js` (lines 262-263) — `statementRepository` penceFields confirmation
- Direct code inspection of `src/db/schema.js` — `actualPaymentAmount`/`actualPaymentDate` confirmed in statements schema v15+
- Direct inspection of `package.json` — Vitest ^3.0.7, jsdom ^28.1.0 confirmed

### Secondary (MEDIUM confidence)
- CSS `position: sticky` for table columns — universally supported in modern browsers (Chrome 56+, Firefox 59+, Safari 8+); no external verification needed for this project's PWA target

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools confirmed from direct code inspection, no new dependencies
- Architecture: HIGH — all patterns traced directly to existing code in debts.js
- Pitfalls: HIGH — most derived from direct code reading; CSS sticky pitfall is well-known
- EDIT-04 root cause: MEDIUM — root cause hypothesised from code reading; RED test will confirm exact failure point

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain — pure DOM/CSS, no external API dependencies)
