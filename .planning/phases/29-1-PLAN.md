---
phase: 29-mobile-table-interaction-fixes
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/ui/transactions.js, css/main.css]
autonomous: true
requirements: [MOB-04, MOB-05]
user_setup: []

# Goal-backward verification (derived during planning, verified after execution)
must_haves:
  truths:
    - "On any mobile viewport ≥320px, the Income table 'Amount' header fits on a single line"
    - "Income table date cells show two stacked lines: 'dd-MMM' on line 1 and 'YYYY' on line 2"
    - "Swiping right on an income row reveals an Edit action; swiping left reveals a Delete action"
    - "Swiping an income row with haptic feedback when the 60px threshold is crossed"
    - "Re-rendering the income table does not leak SwipeHandler instances (destroy() is called before rebuild)"
  artifacts:
    - path: "src/ui/transactions.js"
      provides: "SwipeHandler import, swipe-row row template, _swipeInstances and currentOpenRow tracking, _initSwipe method, destroy-on-rerender guard"
      contains: "SwipeHandler"
    - path: "src/ui/transactions.js"
      provides: "Compact date format helper"
      contains: "date-compact"
    - path: "css/main.css"
      provides: "Compact date CSS, Amount header nowrap, swipe-action styles"
      contains: "date-compact"
    - path: "css/main.css"
      provides: "Amount header no-wrap rule"
      contains: "white-space: nowrap"
  key_links:
    - from: "src/ui/transactions.js"
      to: "src/utils/gestures.js"
      via: "import { SwipeHandler } from '../utils/gestures.js'"
      pattern: "SwipeHandler"
    - from: "src/ui/transactions.js"
      to: "css/main.css"
      via: "swipe-row and swipe-content class names applied to rendered rows"
      pattern: "swipe-row"
---

<objective>
Add SwipeHandler-based swipe gestures to the Income table rows (replacing inline Edit/Delete buttons), fix the date format to compact two-line `dd-MMM / YYYY` style, and prevent the Amount column header from wrapping on narrow viewports.

Purpose: Delivers MOB-04 — the Income tab's three mobile usability regressions (wrapping header, overflowing date strings, space-consuming action buttons) are all resolved in a single file pair with no risk of touching the Expenses tab, while preserving a non-swipe action path for keyboard and mouse users.
Output: Updated `src/ui/transactions.js` with SwipeHandler integration and compact date rendering; additive CSS rules in `css/main.css` for `.date-compact`, `.date-year`, and Amount header `white-space: nowrap`.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@src/ui/transactions.js
@src/utils/gestures.js
@css/main.css
@.planning/phases/29-mobile-table-interaction-fixes/29-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add SwipeHandler to Income table rows</name>
  <files>src/ui/transactions.js</files>
  <read_first>src/ui/transactions.js, src/utils/gestures.js, src/ui/expenses.js</read_first>
  <action>
Read `src/ui/transactions.js` in full before making any changes to understand the current row rendering method, any existing `_swipeInstances` or `currentOpenRow` state, and where `_handleEdit` and `_handleDelete` are defined.

Read `src/ui/expenses.js` lines 800–900 (or search for `_swipeInstances`) to see the exact established swipe-reveal pattern. Replicate it for the income table.

Make the following changes to `src/ui/transactions.js`:

1. **Add import at top of file** (after existing imports):
   ```js
   import { SwipeHandler } from '../utils/gestures.js';
   ```

2. **Add instance tracking state** in the class constructor or at the top of the module (whichever pattern matches the file):
   ```js
   this._swipeInstances = [];
   this.currentOpenRow = null;
   ```

3. **Update the income row template** to wrap each row in the swipe-reveal structure. Find the `<tr>` generation for income rows (search for `class="..."` on `<tr>` elements or where `item.date`, `item.amount`, `item.description` are interpolated). Change the row template to:
   ```html
   <tr class="swipe-row income-row" data-id="${item.id}">
     <td colspan="[N]" class="swipe-cell p-0">
       <div class="swipe-action-right swipe-edit-action">Edit</div>
       <div class="swipe-content">
         <table class="swipe-inner-table w-full">
           <tr>
             <td class="col-date">[date cell content]</td>
             <td class="col-description">[description cell content]</td>
             <td class="col-amount">[amount cell content]</td>
           </tr>
         </table>
       </div>
       <div class="swipe-action-left swipe-delete-action">Delete</div>
     </td>
   </tr>
   ```
   `[N]` = the number of columns in the income table header. Use the exact number found by reading the file.
   Keep all existing cell content (description, amount, category badge if present) unchanged — only wrap it.

4. **Add `_initSwipe(tableBody)` method** (add as a new method, positioned near other private helpers):
   ```js
   _initSwipe(tableBody) {
     // Destroy existing instances first to prevent memory leaks
     this._swipeInstances.forEach(({ handler }) => handler.destroy());
     this._swipeInstances = [];
     this.currentOpenRow = null;

     tableBody.querySelectorAll('.swipe-row').forEach(row => {
       const id = row.dataset.id;
       const content = row.querySelector('.swipe-content');
       if (!content) return;

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
     });
   }
   ```

5. **Call `_initSwipe` after the table is rendered.** Find where the income table `innerHTML` or `appendChild` call completes (the point after all rows have been added to the DOM). Add:
   ```js
   this._initSwipe(tableBody); // tableBody = the <tbody> or table element reference
   ```

6. **Verify `_handleEdit(id)` and `_handleDelete(id)` exist** in `transactions.js`. If they are named differently (e.g. `_editIncome`, `_deleteIncome`), use the correct names. Do NOT create new edit/delete functions — wire the swipe actions to the existing handlers.
  </action>
  <verify>grep -n "SwipeHandler\|_swipeInstances\|currentOpenRow\|swipe-row\|_initSwipe" src/ui/transactions.js</verify>
  <acceptance_criteria>
    - src/ui/transactions.js contains `import { SwipeHandler }` from gestures.js
    - src/ui/transactions.js contains `_swipeInstances`
    - src/ui/transactions.js contains `currentOpenRow`
    - src/ui/transactions.js contains `swipe-row` in the row template string
    - src/ui/transactions.js contains `swipe-content` in the row template string
    - src/ui/transactions.js contains `swipe-action-right` in the row template string
    - src/ui/transactions.js contains `swipe-action-left` in the row template string
    - src/ui/transactions.js contains `_initSwipe`
    - src/ui/transactions.js contains `handler.destroy()` inside `_initSwipe`
    - src/ui/transactions.js contains `onSwipe` callback with `translateX`
    - src/ui/transactions.js contains `onEnd` callback calling `_handleEdit` or the equivalent edit method
  </acceptance_criteria>
  <done>SwipeHandler is imported, income rows use swipe-row structure, _initSwipe initialises handlers and destroys old ones before rebuild, swipe-right triggers edit and swipe-left triggers delete.</done>
</task>

<task type="auto">
  <name>Task 2: Fix Income table date format and Amount header</name>
  <files>src/ui/transactions.js, css/main.css</files>
  <read_first>src/ui/transactions.js, css/main.css</read_first>
  <action>
**A. Fix date format in `src/ui/transactions.js`:**

Find where the date value is currently rendered in the income row template (search for `item.date`, `formatDate`, or similar). Replace the existing date cell content with a call to a new `_formatDateCompact` helper:

Add this helper method to the transactions class/module:
```js
_formatDateCompact(dateStr) {
  const [yyyy, mm, dd] = String(dateStr).split('T')[0].split('-').map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mmm = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  const year = d.getUTCFullYear();
  return `<span class="date-compact">${day}-${mmm}<br><span class="date-year">${year}</span></span>`;
}
```

Assume input dates are stored as ISO strings. Do not use bare `new Date(dateStr)` on date-only values because browser timezone interpretation can shift the rendered day.

In the row template, replace the existing date interpolation (e.g. `${item.date}` or `${formatDate(item.date)}`) with:
```js
${this._formatDateCompact(item.date)}
```
(If the module is not a class, add `_formatDateCompact` as a module-level function and call it without `this.`.)

**B. Fix Amount header in `src/ui/transactions.js`:**

Find the table header (`<thead>`) for the income table. Locate the Amount `<th>` cell. Add the class `col-amount` to it if it does not already have a column-identifying class:
```html
<th class="col-amount">Amount</th>
```

**C. Add CSS rules to `css/main.css`:**

Locate the end of the existing styles (or a logical "utility classes" section). Append the following rules (only if they do not already exist — grep for `.date-compact` before adding):

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

Do not modify any existing CSS rules — only append new ones.
  </action>
  <verify>grep -n "date-compact\|col-amount\|_formatDateCompact" src/ui/transactions.js css/main.css</verify>
  <acceptance_criteria>
    - src/ui/transactions.js contains `_formatDateCompact` function/method
    - src/ui/transactions.js row template contains `date-compact` class reference (via `_formatDateCompact` call)
    - src/ui/transactions.js Amount `<th>` contains class `col-amount`
    - css/main.css contains `.date-compact` rule with `white-space: nowrap`
    - css/main.css contains `.date-year` rule with `font-size: 0.72rem`
    - css/main.css contains `th.col-amount` rule with `white-space: nowrap` inside a `@media (max-width: 768px)` block
    - No existing CSS rules in main.css are modified (only additions)
  </acceptance_criteria>
  <done>Income date cells render as dd-MMM on line 1 and YYYY on line 2; Amount column header does not wrap at any viewport ≥320px.</done>
</task>

<task type="auto">
  <name>Task 3: Preserve a non-swipe action path for accessibility</name>
  <files>src/ui/transactions.js</files>
  <read_first>src/ui/transactions.js</read_first>
  <action>
Do not make swipe the only way to edit or delete an income row. Preserve a keyboard- and mouse-accessible action path, for example by keeping a focusable action button/menu on each row or by exposing equivalent row actions when the row receives keyboard focus.

Document this explicitly in the implementation:
- Rows remain keyboard reachable
- Edit can be triggered without a touch gesture
- Delete can be triggered without a touch gesture
- Swipe is additive for touch users, not the only control path
  </action>
  <verify>grep -n "keyboard\|focus\|action path\|swipe the only" src/ui/transactions.js .planning/phases/29-1-PLAN.md</verify>
  <acceptance_criteria>
    - The implementation preserves an edit path for keyboard and mouse users
    - The implementation preserves a delete path for keyboard and mouse users
    - Swipe gestures are additive on touch devices, not the only control path
  </acceptance_criteria>
  <done>Income row actions remain accessible without requiring swipe gestures.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `grep -n "SwipeHandler" src/ui/transactions.js` returns the import line and at least one usage
- [ ] `grep -n "_swipeInstances" src/ui/transactions.js` returns at least 3 lines (init, push, destroy loop)
- [ ] `grep -n "date-compact" css/main.css` returns the CSS rule
- [ ] `grep -n "col-amount" css/main.css` returns the `white-space: nowrap` rule inside a `@media` block
- [ ] `npx vitest run` (or `npm test`) exits with all tests passing and zero new failures
- [ ] No JavaScript console errors introduced — check by loading the app and navigating to the Income tab
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- No errors or warnings introduced
- SwipeHandler import does not break the module (no circular dependency)
- The destroy loop in `_initSwipe` is called before every table rebuild — confirmed by code review, not assumed
- Existing income table functionality (add, edit, delete flows) continues to work via swipe actions
- Existing income table functionality remains accessible for keyboard and mouse users without swipe
- Income date cells render `14-Mar` / `2026` style on mobile — confirmed by visual inspection or DOM inspection in DevTools
</success_criteria>

<output>
After completion, create `.planning/phases/29-mobile-table-interaction-fixes/29-1-SUMMARY.md`
</output>
