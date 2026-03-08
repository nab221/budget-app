# Phase 16: Debt History UX Refinement - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the Debt Tab UX: fix broken edit field auto-population (EDIT-04), refine the history modal table layout for mobile readability (HIST-01), replace text "Edit" buttons with pencil icons in history rows (HIST-02), and add a "Mark Paid" quick action per statement row (HIST-03).

Creating debts, adding statements, and PDF import are out of scope — this phase is refinement only.

</domain>

<decisions>
## Implementation Decisions

### EDIT-04: Edit field auto-population bug fix
- **Bug confirmed**: Clicking the pencil icon on a debt row opens the modal with all fields empty (as if opening Add New Debt). Broken for all debt types consistently.
- The call chain `editDebt(id)` → `openDebtModal(id)` → `_populateEditFields(debt)` exists but something in it is failing.
- **Approach**: RED/GREEN test pattern (write failing test asserting fields are populated for each type, then fix the root cause in the call chain).
- Test should cover all four debt types: credit-card, mortgage, loan, other.

### HIST-01: History table layout
- Keep all 10 columns — no hiding. Users need the complete audit trail (audit philosophy of the app).
- Fixed column widths, total ~665px scrollable width (manageable on phone with overflow-x:auto, already in place):
  - Date: 80px (no-wrap, "08 Mar" format)
  - Opening: 70px (right-align, abbreviate to "£1.2k" for large values)
  - Closing: 70px (right-align, bold for emphasis)
  - Int: 50px (right-align, abbreviated)
  - Fees: 50px (right-align)
  - Min Due: 65px (right-align)
  - Due Date: 80px (no-wrap, "15 Mar" format)
  - Paid: 60px (right-align, "£500" or "—")
  - Paid On: 80px (no-wrap, "12 Mar" or "—")
  - Actions: 60px (icon-only buttons)
- **Sticky columns**: Date column sticks to left, Actions column sticks to right — always visible while scrolling.
- **Scroll UX**: Subtle box-shadow on scroll edges to indicate more content. Horizontal scroll indicator visible on first load, fades after ~2s.

### HIST-02: Pencil icon for Edit button
- Replace the text "Edit" button in statement rows with the standard pencil icon ✏️ (matches debt card edit button style).
- Claude's discretion on exact button class/sizing — keep consistent with the ✕ delete button already there.

### HIST-03: Mark Paid quick action
- **Trigger**: Green tick (✓) button on each statement row.
- **Interaction**: Inline in the row — clicking ✓ replaces the button with a compact inline prompt (amount field + Confirm/Cancel) within the same row. No modal, no page-level form.
- **Pre-fill**: Amount field pre-filled with `minimumPayment` for that statement. User can adjust upward or leave as-is.
- **On confirm**:
  1. Save `actualPaymentAmount` = entered amount, `actualPaymentDate` = today on the statement record.
  2. Deduct payment amount from `debt.currentBalance` (calls `debtRepository.update` with reduced balance).
  3. Re-render the statement row and debt card to reflect updated values.
- **On cancel**: Restore the original row (no changes saved).
- Haptic success feedback on confirm (using existing `haptics.js` success pattern).
- If statement already has `actualPaymentDate` set, the ✓ button should not show (or show disabled) — the statement is already paid.

### Claude's Discretion
- Exact CSS for sticky columns (position: sticky implementation details)
- Scroll edge shadow implementation (CSS or JS scroll event)
- Scroll indicator fade animation duration/style
- Inline prompt HTML structure within the table row
- Whether to use a separate function or inline logic for the Mark Paid row toggle

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `haptics.js` success pattern: used in save/delete flows — same trigger for Mark Paid confirm
- `debtRepository.update(id, payload)`: updates debt record — use to deduct payment from currentBalance
- `statementRepository.update(id, payload)` (if exists) or equivalent: update actualPaymentAmount/Date on statement
- `formatGBP(pence)`: used throughout for display — use in Mark Paid inline prompt
- `fromPence(val)`: converts pence to decimal — use when pre-filling amount field
- `toPence(val)`: converts decimal to pence — use when saving actualPaymentAmount

### Established Patterns
- `.tbl.sm` is the standard table class (set in Phase 14)
- Pencil icon ✏️ already used on debt card rows (line 719 in debts.js)
- Inline toggle pattern: `container.classList.remove('hidden')` / `add('hidden')` — used for stmtFormContainer
- `safeHTML` template tag: used for all dynamic HTML in debts.js — Mark Paid row must use this
- RED/GREEN test pattern: established in Phase 13 (debts.test.js) — EDIT-04 fix follows same structure

### Integration Points
- `renderStatements(debtId)`: re-renders the full statement tbody — call after Mark Paid confirm to refresh row
- `debtUI.render()` or equivalent: re-render debt card after balance update to show new currentBalance
- Statement rows rendered in `renderStatements()` at debts.js:851 — Mark Paid button added here
- `_buildHistoryModalHTML()` at debts.js:793 — table structure lives here, sticky CSS applied here

</code_context>

<specifics>
## Specific Ideas

- Table column widths and sticky behaviour spec comes directly from user — implement exactly as specified
- "08 Mar" date format (day + 3-letter month, no year) to save column width
- "£1.2k" abbreviation for large values in Opening/Closing columns
- Scroll indicator: visible on first modal open, fades after ~2s — subtle, not intrusive
- Mark Paid inline prompt replaces the ✓ button within the same `<td>` — no row height jump if possible

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-debt-history-ux-refinement*
*Context gathered: 2026-03-08*
