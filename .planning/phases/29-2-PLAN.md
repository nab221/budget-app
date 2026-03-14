---
phase: 29-mobile-table-interaction-fixes
plan: 02
type: execute
wave: 1
depends_on: []
files_modified: [src/ui/expenses.js, css/main.css]
autonomous: true
requirements: [MOB-05, DEBT-04]
user_setup: []

# Goal-backward verification (derived during planning, verified after execution)
must_haves:
  truths:
    - "Expenses table has exactly 3 column headers: Date, Expense, Amount"
    - "Category is rendered as a badge chip inside the Expense cell, not as a separate column"
    - "Status is rendered as a single icon (✓/○/✗) with aria-label, not as a text badge or separate column"
    - "Expense date cells show two stacked lines: dd-MMM on line 1 and YYYY on line 2"
    - "Tapping or swiping a debt-linked expense row navigates to the Debts tab instead of opening an edit form"
    - "Non-debt expense rows retain swipe-right = Edit, swipe-left = Delete behaviour"
    - "The status icon has an aria-label attribute for screen reader accessibility"
  artifacts:
    - path: "src/ui/expenses.js"
      provides: "3-column header, badge chip category, status icon, compact date, debt-link navigation"
      contains: "badge-chip"
    - path: "src/ui/expenses.js"
      provides: "Debt-link detection and Debts tab navigation"
      contains: "isDebtLinked"
    - path: "src/ui/expenses.js"
      provides: "Accessible status icon rendering"
      contains: "aria-label"
    - path: "css/main.css"
      provides: "Badge chip styles (if not already added by Plan 1)"
      contains: "badge-chip"
    - path: "css/main.css"
      provides: "Status icon styles"
      contains: "status-icon"
  key_links:
    - from: "src/ui/expenses.js"
      to: "isDebtLinked"
      via: "field check on expense record before SwipeHandler init"
      pattern: "sourceDebtId|debtId|sourceType"
    - from: "src/ui/expenses.js"
      to: "[data-tab=\"debts\"]"
      via: "click() on Debts tab button for debt-linked rows"
      pattern: "data-tab.*debts"
---

<objective>
Redesign the Expenses table for mobile: reduce headers to 3 columns (Date | Expense | Amount), render category as an inline badge chip, replace status text with a compact accessible icon, fix date format to dd-MMM / YYYY, and add debt-linked expense detection so tapping/swiping those rows navigates to the Debts tab instead of opening an inline edit form.

Purpose: Delivers MOB-05 and DEBT-04. The Expenses table currently overflows on mobile due to too many columns, unformatted dates, and inline action buttons. Debt-linked expenses have no navigation path back to the originating debt record.
Output: Updated `src/ui/expenses.js` with redesigned row template and debt-link routing; additive CSS rules in `css/main.css` for `.badge-chip` and `.status-icon` (shared with Plan 1's additions to `main.css` — append only if not already present).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@src/ui/expenses.js
@src/utils/gestures.js
@src/db/repository.js
@css/main.css
@.planning/phases/29-mobile-table-interaction-fixes/29-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Confirm debt-linkage field name and reduce table headers to 3 columns</name>
  <files>src/ui/expenses.js</files>
  <read_first>src/ui/expenses.js, src/db/repository.js</read_first>
  <action>
**Step 1 — Determine the debt-linkage field name (REQUIRED before writing any code):**

Run these greps on the actual source files:
```bash
grep -n "sourceDebtId\|debtId\|linkedDebtId\|sourceType\|debt" src/ui/expenses.js | head -30
grep -n "sourceDebtId\|debtId\|linkedDebtId\|sourceType\|debt" src/db/repository.js | head -30
```

Note the exact field name(s) returned. Use them in the `isDebtLinked` function below. If multiple fields appear, use all of them in an `||` guard.

**Step 2 — Read the current table header structure:**

Search `src/ui/expenses.js` for the `<thead>` or `<th>` elements. Note the current column count and column names (likely: Date, Category, Expense/Description, Amount, Status, and possibly action columns).

**Step 3 — Reduce headers to exactly 3 columns:**

Replace the existing `<thead>` (or wherever the header row `<tr><th>...</th></tr>` is generated) with:
```html
<thead>
  <tr>
    <th class="col-date">Date</th>
    <th class="col-expense">Expense</th>
    <th class="col-amount">Amount</th>
  </tr>
</thead>
```

Remove all other `<th>` elements (Category, Status, actions). Do NOT leave any empty `<th>` placeholders.

**Step 4 — Add `isDebtLinked` helper function** (add as a module-level function or private method, near the top of the relevant section):
```js
function isDebtLinked(expense) {
  // IMPORTANT: replace field names below with those confirmed in Step 1
  return !!(
    expense.sourceDebtId ||
    expense.debtId ||
    expense.sourceType === 'debt'
  );
}
```

After grepping in Step 1, update this function to use only the confirmed field name(s).
  </action>
  <verify>grep -n "col-date\|col-expense\|col-amount\|isDebtLinked\|sourceDebtId\|debtId" src/ui/expenses.js | head -20</verify>
  <acceptance_criteria>
    - src/ui/expenses.js thead contains exactly 3 `<th>` elements: `col-date`, `col-expense`, `col-amount`
    - src/ui/expenses.js does NOT contain old column headers (Category as `<th>`, Status as `<th>`) in the expenses table header
    - src/ui/expenses.js contains `isDebtLinked` function
    - `isDebtLinked` checks at least one of: `sourceDebtId`, `debtId`, `sourceType` — whichever was confirmed present by the grep in Step 1
  </acceptance_criteria>
  <done>Table header reduced to 3 columns; isDebtLinked helper defined with confirmed field names.</done>
</task>

<task type="auto">
  <name>Task 2: Redesign expense row template — badge chip, status icon, compact date</name>
  <files>src/ui/expenses.js</files>
  <read_first>src/ui/expenses.js</read_first>
  <action>
Read the current expense row template in `src/ui/expenses.js` (search for `swipe-row`, `<tr class=`, or where `expense.date`, `expense.amount`, `expense.description`/`expense.name` are interpolated into HTML).

The row template must be updated to match the 3-column header from Task 1. The row structure (with swipe-reveal wrapper already present from the existing implementation) should become:

```html
<tr class="swipe-row expense-row${isDebtLinked(expense) ? ' debt-linked' : ''}"
    data-id="${expense.id}"
    data-debt-linked="${isDebtLinked(expense)}">
  <td colspan="3" class="swipe-cell p-0">
    <div class="swipe-action-right swipe-edit-action">Edit</div>
    <div class="swipe-content">
      <table class="swipe-inner-table w-full">
        <tr>
          <td class="col-date">${this._formatDateCompact(expense.date)}</td>
          <td class="col-expense">
            <span class="expense-name">${safeHTML(expense.description || expense.name || '')}</span>
            <br>
            <span class="badge-chip">${safeHTML(categoryName)}</span>
            ${renderStatusIcon(expense.status)}
          </td>
          <td class="col-amount">${formatCurrency(expense.amount)}</td>
        </tr>
      </table>
    </div>
    <div class="swipe-action-left swipe-delete-action">Delete</div>
  </td>
</tr>
```

Adapt the template to match the actual variable names found in the file:
- `expense.description` or `expense.name` — use whichever exists in the file
- `categoryName` — find how category name is resolved in the current template (it may already be a variable, or may need `this._getCategoryName(expense.categoryId)` or similar)
- `formatCurrency` — use the existing currency formatting function already in the file
- `safeHTML` — use the existing `safeHTML` utility from `src/ui/render.js` (already imported in `expenses.js`)

**Add `_formatDateCompact` helper** (same as in Plan 1 — add to `expenses.js` as well since they are independent files):
```js
_formatDateCompact(dateStr) {
  const d = new Date(dateStr);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = d.toLocaleString('en-GB', { month: 'short' });
  const yyyy = d.getFullYear();
  return `<span class="date-compact">${dd}-${mmm}<br><span class="date-year">${yyyy}</span></span>`;
}
```
(If `_formatDateCompact` is already extracted to a shared utility by Plan 1, import it instead of redefining it. But since the two plans run in parallel and modify different files, define it locally in `expenses.js` — deduplication can happen in a later cleanup phase.)

**Add `renderStatusIcon` helper:**
```js
function renderStatusIcon(status) {
  const map = {
    paid:      { icon: '✓', label: 'Paid' },
    pending:   { icon: '○', label: 'Pending' },
    cancelled: { icon: '✗', label: 'Cancelled' },
  };
  const s = (status || 'pending').toLowerCase();
  const { icon, label } = map[s] || map.pending;
  return `<span class="status-icon" aria-label="${label}">${icon}</span>`;
}
```

Ensure the row template's existing `colspan` attribute matches the new 3-column header (colspan="3").
  </action>
  <verify>grep -n "badge-chip\|status-icon\|date-compact\|_formatDateCompact\|renderStatusIcon\|aria-label" src/ui/expenses.js</verify>
  <acceptance_criteria>
    - src/ui/expenses.js row template contains `badge-chip` class for category
    - src/ui/expenses.js row template contains `status-icon` class for status
    - src/ui/expenses.js row template contains `aria-label` on the status icon element
    - src/ui/expenses.js contains `_formatDateCompact` method or function
    - src/ui/expenses.js row template contains `date-compact` (via `_formatDateCompact` call)
    - src/ui/expenses.js row `<td colspan=` value matches the 3-column header (value is "3")
    - src/ui/expenses.js does NOT contain the old Status `<td>` as a standalone cell (status is now inline in the Expense cell)
    - src/ui/expenses.js does NOT contain the old Category `<td>` as a standalone cell (category is now a badge chip inside the Expense cell)
  </acceptance_criteria>
  <done>Expense rows show category as badge chip and status as accessible icon inside the Expense cell; date shows dd-MMM/YYYY compact format.</done>
</task>

<task type="auto">
  <name>Task 3: Add debt-linked row navigation; update swipe init to skip debt rows</name>
  <files>src/ui/expenses.js</files>
  <read_first>src/ui/expenses.js</read_first>
  <action>
Find the existing `_initSwipe` method (or equivalent swipe initialisation code) in `src/ui/expenses.js` — it should be at approximately line 819 or search for `_swipeInstances`. This method iterates over `.swipe-row` elements and attaches `SwipeHandler` instances.

**Modify `_initSwipe` to skip debt-linked rows and add click navigation instead:**

```js
_initSwipe(tableBody) {
  // Destroy existing instances
  this._swipeInstances.forEach(({ handler }) => handler.destroy());
  this._swipeInstances = [];
  this.currentOpenRow = null;

  tableBody.querySelectorAll('.swipe-row').forEach(row => {
    const id = row.dataset.id;
    const isLinked = row.dataset.debtLinked === 'true';
    const content = row.querySelector('.swipe-content');
    if (!content) return;

    if (isLinked) {
      // Debt-linked rows: tap navigates to Debts tab, no swipe actions
      row.style.cursor = 'pointer';
      row.onclick = (e) => {
        // Prevent accidental navigation from swipe drag finishing as a tap
        e.stopPropagation();
        const debtsTabBtn = document.querySelector('[data-tab="debts"]');
        if (debtsTabBtn) debtsTabBtn.click();
      };
      // Visually hide the swipe action divs for debt-linked rows
      const actionRight = row.querySelector('.swipe-action-right');
      const actionLeft  = row.querySelector('.swipe-action-left');
      if (actionRight) actionRight.style.display = 'none';
      if (actionLeft)  actionLeft.style.display  = 'none';
    } else {
      // Non-debt rows: standard swipe-to-reveal
      const handler = new SwipeHandler(content, {
        threshold: 60,
        onStart: () => {
          if (this.currentOpenRow && this.currentOpenRow !== content) {
            this.currentOpenRow.style.transition = 'transform 0.2s ease';
            this.currentOpenRow.style.transform = 'translateX(0)';
          }
          this.currentOpenRow = content;
        },
        onSwipe: (deltaX) => {
          const clamped = Math.max(-80, Math.min(80, deltaX));
          content.style.transition = 'none';
          content.style.transform = `translateX(${clamped}px)`;
        },
        onEnd: (deltaX, thresholdMet) => {
          content.style.transition = 'transform 0.2s ease';
          content.style.transform = 'translateX(0)';
          this.currentOpenRow = null;
          if (thresholdMet) {
            if (deltaX > 0) {
              this._handleEdit(id);
            } else {
              this._handleDelete(id);
            }
          }
        }
      });
      this._swipeInstances.push({ id, handler });
    }
  });
}
```

**Important:** If the existing `_initSwipe` in `expenses.js` already contains the non-debt swipe logic (the `else` branch above), do NOT replace it wholesale — instead, add the `if (isLinked) { ... }` block at the top of the `forEach` callback before the existing `SwipeHandler` constructor call, guarded by `if (isLinked) return;` after assigning the click handler. Prefer `row.onclick = ...` or another idempotent pattern so repeated swipe initialization does not stack duplicate click bindings.

**Add CSS for debt-linked rows** in `css/main.css` (append only):
```css
/* ── Phase 29: Debt-linked expense row indicator ── */
.expense-row.debt-linked .swipe-content {
  background: var(--debt-linked-bg, #f5f0ff);
  cursor: pointer;
}
.expense-row.debt-linked:hover .swipe-content {
  background: var(--debt-linked-hover-bg, #ede7ff);
}
```
  </action>
  <verify>grep -n "debt-linked\|debtLinked\|data-tab.*debts\|debtsTabBtn\|isLinked" src/ui/expenses.js | head -20</verify>
  <acceptance_criteria>
    - src/ui/expenses.js `_initSwipe` (or equivalent) contains `isLinked` check reading from `row.dataset.debtLinked`
    - src/ui/expenses.js contains `document.querySelector('[data-tab="debts"]')` for navigation
    - src/ui/expenses.js debt-linked branch does NOT attach a SwipeHandler (SwipeHandler is only constructed for non-debt rows)
    - src/ui/expenses.js row template sets `data-debt-linked` attribute (from Task 1)
    - Debt-linked navigation binding is idempotent and does not stack duplicate click handlers on re-render
    - css/main.css contains `.expense-row.debt-linked` rule (additive, no existing rules modified)
  </acceptance_criteria>
  <done>Tapping a debt-linked expense row navigates to the Debts tab; no swipe handler is attached; non-debt rows retain full swipe-to-reveal edit/delete behaviour.</done>
</task>

<task type="auto">
  <name>Task 4: Add CSS utility classes to main.css (badge chip, status icon — additive only)</name>
  <files>css/main.css</files>
  <read_first>css/main.css</read_first>
  <action>
Read `css/main.css` and search for `.badge-chip` and `.status-icon`. If either class is already present (added by Plan 1 running in parallel, or pre-existing), do NOT re-add it — skip that specific rule.

For each class that is NOT already present, append the following to the end of `css/main.css`:

```css
/* ── Phase 29: Badge chip (category label in Expense cell) ── */
.badge-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  background: var(--chip-bg, #e8ecf0);
  color: var(--chip-color, #445566);
  white-space: nowrap;
  vertical-align: middle;
  margin-top: 3px;
}

/* ── Phase 29: Status icon (✓/○/✗ in Expense cell) ── */
.status-icon {
  font-size: 0.88rem;
  display: inline-block;
  margin-left: 5px;
  vertical-align: middle;
  line-height: 1;
}
```

Also append (if `.date-compact` is not already present from Plan 1):
```css
/* ── Phase 29: Compact date cells ── */
.date-compact {
  display: inline-block;
  line-height: 1.3;
  white-space: nowrap;
}
.date-year {
  font-size: 0.72rem;
  opacity: 0.65;
}

/* ── Phase 29: Prevent Amount header wrapping on mobile ── */
@media (max-width: 768px) {
  th.col-amount {
    white-space: nowrap;
    min-width: 60px;
  }
}
```

**Rule:** Only append. Do not modify, reorder, or delete any existing CSS rule. The Phase 29 additions are purely additive.
  </action>
  <verify>grep -n "badge-chip\|status-icon\|date-compact\|date-year" css/main.css</verify>
  <acceptance_criteria>
    - css/main.css contains `.badge-chip` with `border-radius: 999px`
    - css/main.css contains `.status-icon` with `font-size` property
    - css/main.css contains `.date-compact` with `white-space: nowrap`
    - css/main.css contains `.date-year` with reduced `font-size`
    - No existing CSS rules in main.css are modified — only new rules are appended
  </acceptance_criteria>
  <done>All Phase 29 CSS utility classes present in main.css; no regressions introduced to existing styles.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `grep -n "badge-chip" src/ui/expenses.js` returns the row template interpolation
- [ ] `grep -n "aria-label" src/ui/expenses.js` returns the status icon elements with Paid/Pending/Cancelled labels
- [ ] `grep -c "<th" src/ui/expenses.js` — count of `<th>` elements in the expenses table header section equals 3
- [ ] `grep -n "data-tab.*debts\|debtsTabBtn" src/ui/expenses.js` returns the navigation call in `_initSwipe`
- [ ] `grep -n "badge-chip\|status-icon\|date-compact" css/main.css` returns at least 3 different rule blocks
- [ ] `npx vitest run` (or `npm test`) exits with all 354+ tests passing and zero new failures
- [ ] No JavaScript console errors on the Expenses tab — check DevTools console after load
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- No errors or warnings introduced
- Expenses table has exactly 3 `<th>` elements (Date, Expense, Amount) — confirmed by DOM inspection or code review
- Category is NOT rendered as a standalone `<td>` column — it is a `.badge-chip` inside the Expense `<td>`
- Status is NOT rendered as a standalone `<td>` column — it is a `.status-icon` with `aria-label` inside the Expense `<td>`
- Debt-linked rows are visually distinct (`.debt-linked` CSS class applied) and navigating to the Debts tab on click
- Non-debt rows retain swipe-to-reveal Edit/Delete behaviour from the pre-existing `expenses.js` implementation
- All existing Expenses functionality (add, edit, delete, reconciliation mode) continues to work for non-debt rows
</success_criteria>

<output>
After completion, create `.planning/phases/29-mobile-table-interaction-fixes/29-2-SUMMARY.md`
</output>
