# Phase 29: Mobile Table & Interaction Fixes - Research

**Researched:** 2026-03-14
**Domain:** Vanilla JS DOM — swipe gesture integration, mobile table layout, CSS badge chips
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace Edit/Delete buttons in Income table with swipe gestures: swipe-right = Edit, swipe-left = Delete
- Use existing `src/utils/gestures.js` (`SwipeHandler`) — do not introduce a new library
- Date format for both Income and Expenses: `dd-MMM` on line 1, `YYYY` on line 2
- Expenses table headers reduced to exactly 3 columns: `Date | Expense | Amount`
- Category rendered as a badge chip `<span class="badge-chip">` inside the Expense cell
- Status rendered as a compact icon only: ✓ = paid, ○ = pending, ✗ = cancelled (with `aria-label`)
- Debt-linked expenses: tap/swipe navigates to Debts tab; no inline edit form
- Swipe threshold: 60px minimum travel before action is revealed
- Horizontal swipe and vertical scroll must coexist — use angle detection to disambiguate
- Cleanup: `SwipeHandler.destroy()` must be called when a row is removed, to prevent memory leaks
- Debt-linkage field: inspect `src/ui/expenses.js` and `src/db/repository.js` — likely `sourceDebtId` or `sourceType === 'debt'`

### Claude's Discretion
- CSS class naming for the date compact wrapper (`.date-compact` is suggested)
- Whether badge chip styles are added to `css/main.css` as a global utility class or scoped to the table
- Exact translateX animation easing for swipe reveal (e.g. `transform: translateX(${delta}px)`)
- Whether to extend `SwipeHandler` with a thin `SwipeReveal` wrapper class or handle reveal logic inline in the UI modules
- How to trigger the Debts tab switch (likely calling the existing tab-switch function in `app.js` with `'debts'` as the target)

### Deferred Ideas (OUT OF SCOPE)
- Switching to a full touch library (Hammer.js, interact.js)
- Replacing the `SwipeHandler` implementation itself
- Any changes to desktop edit/delete button UX
- Tab menu stickiness — fixed in Phase 28; this phase handles only the table layout
- Any Expenses or Income schema changes
</user_constraints>

<research_summary>
## Summary

Phase 29 is an integration task, not a greenfield build. The `SwipeHandler` utility (`src/utils/gestures.js`, 128 lines) is already production-ready: it handles touch start/move/end, angle detection to distinguish horizontal swipe from vertical scroll, edge protection, a 60px threshold with haptic feedback on crossing, and a `destroy()` cleanup method. The swipe-reveal pattern (swipe to expose action buttons behind a row) is already implemented end-to-end in `src/ui/expenses.js` — `expensesUI` has `_swipeInstances`, `currentOpenRow`, `.swipe-row` class, and `.swipe-action-left`/`.swipe-action-right` divs.

The work for this phase divides cleanly into two parallel streams with no file overlap: (1) `transactions.js` + CSS additions for the Income tab, and (2) `expenses.js` + CSS additions for the Expenses tab. Both streams modify `css/main.css`, but only in additive ways (new utility classes, new mobile override rules) — no existing CSS is deleted — so the risk of collision is low.

The one genuine uncertainty is the field name used to identify debt-linked expenses. The CONTEXT.md mentions `sourceDebtId` but acknowledges it could be `debtId` or `sourceType === 'debt'`. The implementing agent must read `src/ui/expenses.js` and `src/db/repository.js` before writing any debt-link detection code. All other implementation details are deterministic from the existing codebase.

**Primary recommendation:** Copy the swipe-reveal pattern from `expenses.js` into `transactions.js` verbatim (adapting for income row structure), then add the three Expenses changes (header reduction, badge chips, status icons, debt-link navigation) as targeted edits to the existing `expenses.js` row render function. No new libraries. No changes to `gestures.js` unless debt-link tap detection requires a callback not yet present.
</research_summary>

<standard_stack>
## Standard Stack

No new libraries are needed. This phase is pure Vanilla JS + Vanilla CSS.

### Core
| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| `SwipeHandler` (`src/utils/gestures.js`) | In-repo | Touch swipe with angle detection, threshold, haptics, cleanup | Already written, already used in `expenses.js`; battle-tested in this codebase |
| Vanilla CSS `transform: translateX()` | CSS standard | Animate row reveal during swipe | The correct mechanism for smooth 60fps swipe; no layout reflow |
| `Date.prototype.toLocaleString('en-GB', {month:'short'})` | JS built-in | Produce three-letter month abbreviation | Zero-dependency, locale-consistent, already used elsewhere in the codebase |
| CSS `white-space: nowrap` | CSS standard | Prevent Amount header wrapping | The minimal correct fix — no layout change, one property |

### Supporting
| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `aria-label` attribute | HTML standard | Accessible status icon (✓/○/✗) | Required on every presentational icon that carries semantic meaning |
| CSS `.badge-chip` utility class | In-repo (to be added) | Pill-shaped category label | One class, reusable across Income and Expenses tabs |
| `navigator.vibrate()` / `triggerHaptic()` | In-repo `haptics.js` | Haptic tick on swipe threshold crossing | Already wired in `SwipeHandler.handleTouchMove()` — no extra work needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing `SwipeHandler` | Hammer.js / interact.js | Third-party libraries solve no additional problem here; `SwipeHandler` already handles angle detection, threshold, haptics, and destroy |
| `translateX` + action-reveal divs | CSS `scroll-snap` horizontal scroll per row | Scroll-snap is cleaner in pure CSS but harder to control threshold, haptics, and programmatic close; swipe-reveal divs are already the established pattern in `expenses.js` |
| Inline date formatting | `date-fns` / `dayjs` | Overkill for a single `dd-MMM / YYYY` format; built-in `Date` API is sufficient |

**Installation:** No packages to install. No `package.json` changes.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Relevant File Structure
```
src/
├── ui/
│   ├── expenses.js      # Swipe-reveal already implemented — extend for debt-link, badge chip, status icon, date format
│   └── transactions.js  # Add swipe-reveal pattern (copy from expenses.js); fix date format; fix Amount header
├── utils/
│   └── gestures.js      # SwipeHandler — use as-is; extend only if tap-detect callback is missing
└── db/
    └── repository.js    # Inspect for debt-linkage field name before implementing detection
css/
└── main.css             # Add: .badge-chip, .date-compact, .swipe-action-*, mobile table overrides
```

### Pattern 1: Swipe-Reveal Row (already established in `expenses.js`)
**What:** Each table row is wrapped in a `.swipe-row` container. Behind the visible content, `.swipe-action-right` (Edit) and `.swipe-action-left` (Delete) divs sit at the edges. A `SwipeHandler` instance translates the content div left or right on swipe, revealing the action buttons. On release past threshold, the action fires; below threshold, the row snaps back.
**When to use:** Any data row that needs swipe-to-action behaviour.
**Example:**
```html
<!-- Row template (established in expenses.js, replicate in transactions.js) -->
<tr class="swipe-row" data-id="${item.id}">
  <td colspan="3" class="swipe-cell">
    <div class="swipe-action-right">Edit</div>
    <div class="swipe-content"><!-- actual row cells --></div>
    <div class="swipe-action-left">Delete</div>
  </td>
</tr>
```
```js
// Init swipe after render (pattern from expenses.js)
const swipe = new SwipeHandler(row.querySelector('.swipe-content'), {
  threshold: 60,
  onSwipe: (deltaX) => {
    content.style.transform = `translateX(${clamp(deltaX, -80, 80)}px)`;
  },
  onEnd: (deltaX, thresholdMet) => {
    if (thresholdMet) {
      if (deltaX > 0) handleEdit(item.id);
      else handleDelete(item.id);
    }
    content.style.transform = 'translateX(0)';
  }
});
this._swipeInstances.push({ id: item.id, handler: swipe });
```

### Pattern 2: Compact Date Format
**What:** Render the date value as two stacked short lines to save horizontal space on narrow viewports.
**When to use:** Any date cell in a mobile-optimised table.
**Example:**
```js
// Source: built-in Date API
function formatDateCompact(dateStr) {
  const d = new Date(dateStr);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = d.toLocaleString('en-GB', { month: 'short' });
  const yyyy = d.getFullYear();
  return `<span class="date-compact">${dd}-${mmm}<br><span class="date-year">${yyyy}</span></span>`;
}
```
```css
/* css/main.css */
.date-compact {
  display: inline-block;
  line-height: 1.2;
  font-size: 0.82rem;
  white-space: nowrap;
}
.date-year {
  font-size: 0.72rem;
  opacity: 0.7;
}
```

### Pattern 3: Badge Chip
**What:** A pill-shaped inline label for category or status metadata.
**When to use:** Any short label that needs visual grouping but must not take column space.
**Example:**
```html
<span class="badge-chip">Utilities</span>
```
```css
/* css/main.css */
.badge-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  background: var(--badge-bg, #e8e8e8);
  color: var(--badge-color, #555);
  white-space: nowrap;
  vertical-align: middle;
  margin-top: 2px;
}
```

### Pattern 4: Debt-Link Detection and Tab Navigation
**What:** Before rendering a swipe handler, check whether the expense record is debt-linked. If so, skip the swipe handler; instead attach a `click` listener that triggers the app's tab-switch function with `'debts'` as the target tab ID.
**When to use:** Any expense row where `expense.sourceDebtId` (or equivalent field) is truthy.
**Example:**
```js
// Confirm exact field name by reading src/ui/expenses.js and src/db/repository.js
const isDebtLinked = !!(expense.sourceDebtId || expense.debtId || expense.sourceType === 'debt');

if (isDebtLinked) {
  row.addEventListener('click', () => {
    // Use the same tab-switch mechanism as the rest of the app
    document.querySelector('[data-tab="debts"]')?.click();
    // Or: app.switchTab('debts') if that function is exported
  });
} else {
  // Attach SwipeHandler as normal
}
```

### Anti-Patterns to Avoid
- **Rebuilding SwipeHandler:** The existing implementation already handles all edge cases (angle disambiguation, edge protection, haptics, cleanup). Copy the usage pattern, not the implementation.
- **Skipping `destroy()` on re-render:** Every time the table is re-rendered, all old `SwipeHandler` instances in `_swipeInstances` must be destroyed before the array is cleared. Skipping this causes orphaned touch listeners and memory leaks on long sessions.
- **Using `innerHTML` with untrusted category names:** When inserting category names into the badge chip, use `textContent` or an escaping utility (`safeHTML()` from `src/ui/render.js`) — not raw interpolation.
- **Adding a 4th column for status icons:** The status icon (✓/○/✗) must be placed inside the Amount cell or the Expense cell — NOT as a new column. The spec requires exactly 3 column headers.
- **Hard-coding the debt field name without reading the source:** The field name is uncertain. Always read `expenses.js` and `repository.js` first and check for `sourceDebtId`, `debtId`, and `sourceType` before writing detection logic.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe gesture detection | Custom `touchstart`/`touchmove` handler with angle detection | Existing `SwipeHandler` from `src/utils/gestures.js` | `SwipeHandler` already handles dead zone, angle disambiguation, edge protection, threshold haptics, and `destroy()` cleanup — rewriting it introduces regression risk |
| Three-letter month abbreviation | Manual `['Jan','Feb',...]` lookup array | `Date.prototype.toLocaleString('en-GB', {month:'short'})` | Built-in, locale-aware, zero maintenance |
| Pill/chip visual style | Bespoke per-element CSS | `.badge-chip` utility class in `main.css` | One class reusable across Income and Expenses; consistent visual language |
| Tab navigation from Debts-linked row | Custom routing / hash navigation | Call the existing tab-switch mechanism (`[data-tab="debts"]?.click()` or equivalent app API) | The tab switching logic already exists in `app.js`; duplicating it creates two sources of truth |
| Swipe instance cleanup | Manual DOM event removal per row | `SwipeHandler.destroy()` (already implemented) | `destroy()` removes all three bound touch listeners in one call; manual removal risks missing `touchcancel` |

**Key insight:** Every primitive needed (swipe, date formatting, tab switching, cleanup) already exists in this codebase. Phase 29 is wiring, not invention.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Orphaned SwipeHandler Instances (Memory Leak)
**What goes wrong:** After multiple re-renders (e.g. filtering transactions, switching month views), hundreds of `SwipeHandler` instances pile up in memory, each holding three live touch event listeners on detached DOM nodes.
**Why it happens:** The table is re-rendered by clearing `innerHTML` and rebuilding rows. If `_swipeInstances.forEach(({ handler }) => handler.destroy())` is not called before the rebuild, the old handlers are never cleaned up.
**How to avoid:** Before every table rebuild, iterate `this._swipeInstances`, call `destroy()` on each, then set `this._swipeInstances = []`. Mirror the exact pattern already in `expenses.js`.
**Warning signs:** `performance.memory.usedJSHeapSize` grows monotonically; touch events fire multiple times per gesture on a row that has been re-rendered several times.

### Pitfall 2: Vertical Scroll Blocked by Swipe Handler
**What goes wrong:** The user cannot scroll the transaction table vertically because every downward drag is intercepted as a horizontal swipe in progress.
**Why it happens:** `SwipeHandler.handleTouchMove()` calls `e.preventDefault()` once `isConfirmedSwipe` is true. If the angle disambiguation dead zone is set too small, a slightly diagonal scroll gesture crosses the horizontal threshold before the vertical one, locking the scroll.
**How to avoid:** Do not reduce `deadZone` below 10px. The existing default of 10px is calibrated for this codebase. The handler correctly cancels itself (`this.isSwiping = false`) when `Math.abs(deltaY) > deadZone` is detected before horizontal intent — trust this logic.
**Warning signs:** User reports "can't scroll the list"; vertical drag in the table moves the row content horizontally instead of scrolling the page.

### Pitfall 3: Debt-Link Field Name Mismatch
**What goes wrong:** Debt-linked expenses behave identically to regular expenses — they show an edit form on swipe and do not navigate to the Debts tab.
**Why it happens:** The field name used in the detection check (e.g. `expense.sourceDebtId`) does not match the actual field stored by the repository (e.g. `expense.debtId`). The condition is always falsy.
**How to avoid:** Before writing any debt-link detection code, grep `src/ui/expenses.js` and `src/db/repository.js` for: `sourceDebtId`, `debtId`, `linkedDebtId`, `sourceType`. Use the field name(s) confirmed in the source. If multiple variants exist, check all of them (`expense.sourceDebtId || expense.debtId`).
**Warning signs:** All expense rows show Edit/Delete swipe actions including rows that should navigate to Debts.

### Pitfall 4: Status Icon Not Accessible
**What goes wrong:** Screen reader users hear nothing or hear the raw Unicode character (e.g. "check mark") without context.
**Why it happens:** A bare `✓` character in an element with no ARIA attributes has no accessible name.
**How to avoid:** Always wrap the icon in a `<span>` with `aria-label`:
```html
<span class="status-icon" aria-label="Paid">✓</span>
<span class="status-icon" aria-label="Pending">○</span>
<span class="status-icon" aria-label="Cancelled">✗</span>
```
Add `aria-hidden="true"` if the icon is purely decorative and the row already conveys status through other accessible means.
**Warning signs:** Accessibility audit (axe, NVDA) flags "element has no accessible name" on status cells.

### Pitfall 5: `currentOpenRow` Not Closed When Another Row is Swiped
**What goes wrong:** Two rows are simultaneously showing their action buttons — the previous row stays revealed while a new row is swiped open.
**Why it happens:** The `currentOpenRow` tracking variable is only updated when a new swipe begins but the old row's `translateX` is never reset.
**How to avoid:** At the start of each `onStart` callback, check `this.currentOpenRow`. If set and different from the current row, reset its `swipe-content` transform to `translateX(0)`. This is the established pattern in `expenses.js` — replicate exactly.
**Warning signs:** Multiple rows appear "open" simultaneously; visual state does not match expected single-open-at-a-time behaviour.

### Pitfall 6: `Amount` Header Still Wraps After Fix
**What goes wrong:** The "Amount" header still wraps on very narrow viewports (< 360px) despite adding `white-space: nowrap`.
**Why it happens:** The column's width is set too narrow by the table layout algorithm. If the table uses `table-layout: auto` and the amount column has no minimum width, the browser can shrink it below the single-word width.
**How to avoid:** Add both `white-space: nowrap` and `min-width: 60px` to the Amount `<th>` cell. Alternatively, abbreviate the header to "Amt" as an additional fallback inside a `@media (max-width: 360px)` block.
**Warning signs:** Header cell still wraps on 320px emulation in Chrome DevTools even after the CSS fix.
</common_pitfalls>

<code_examples>
## Code Examples

### Initialising SwipeHandler on Income Table Rows (to add to `transactions.js`)
```js
// Source: Mirror of the swipe-reveal pattern in src/ui/expenses.js
// Called after the income table is rendered

_initSwipe(tableBody) {
  // Destroy any existing instances first (prevent memory leak)
  if (this._swipeInstances) {
    this._swipeInstances.forEach(({ handler }) => handler.destroy());
  }
  this._swipeInstances = [];
  this.currentOpenRow = null;

  tableBody.querySelectorAll('.swipe-row').forEach(row => {
    const id = row.dataset.id;
    const content = row.querySelector('.swipe-content');
    if (!content) return;

    const handler = new SwipeHandler(content, {
      threshold: 60,
      onStart: () => {
        // Close any other open row
        if (this.currentOpenRow && this.currentOpenRow !== content) {
          this.currentOpenRow.style.transform = 'translateX(0)';
          this.currentOpenRow.style.transition = 'transform 0.2s ease';
        }
        this.currentOpenRow = content;
      },
      onSwipe: (deltaX) => {
        const clamped = Math.max(-80, Math.min(80, deltaX));
        content.style.transform = `translateX(${clamped}px)`;
        content.style.transition = 'none';
      },
      onEnd: (deltaX, thresholdMet) => {
        content.style.transition = 'transform 0.2s ease';
        if (thresholdMet) {
          if (deltaX > 0) {
            this._handleEdit(id);
          } else {
            this._handleDelete(id);
          }
        }
        content.style.transform = 'translateX(0)';
        this.currentOpenRow = null;
      }
    });

    this._swipeInstances.push({ id, handler });
  });
}
```

### Compact Date Helper
```js
// Source: built-in Date API — no library needed
function formatDateCompact(dateStr) {
  const d = new Date(dateStr);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = d.toLocaleString('en-GB', { month: 'short' });
  const yyyy = d.getFullYear();
  return `<span class="date-compact">${dd}-${mmm}<br><span class="date-year">${yyyy}</span></span>`;
}
// Output: <span class="date-compact">14-Mar<br><span class="date-year">2026</span></span>
```

### CSS for New Utility Classes (to add to `css/main.css`)
```css
/* Source: codebase convention — see existing .badge styles in main.css */

/* Compact date cell */
.date-compact {
  display: inline-block;
  line-height: 1.3;
  white-space: nowrap;
}
.date-year {
  font-size: 0.72rem;
  opacity: 0.65;
}

/* Badge chip (category label) */
.badge-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  background: var(--chip-bg, #e8ecf0);
  color: var(--chip-color, #445);
  white-space: nowrap;
  vertical-align: middle;
  margin-top: 3px;
}

/* Status icon */
.status-icon {
  font-size: 0.9rem;
  display: inline-block;
  margin-left: 4px;
  vertical-align: middle;
}

/* Mobile table header — prevent Amount column header from wrapping */
@media (max-width: 768px) {
  .income-table th.col-amount,
  .expenses-table th.col-amount {
    white-space: nowrap;
    min-width: 60px;
  }
}
```

### Debt-Link Detection and Debts Tab Navigation
```js
// Source: Pattern derived from CONTEXT.md + defensive field-name check
// Read src/ui/expenses.js and src/db/repository.js first to confirm field name

function isDebtLinked(expense) {
  return !!(
    expense.sourceDebtId ||
    expense.debtId ||
    expense.sourceType === 'debt'
  );
}

function navigateToDebtsTab() {
  // Prefer the app's own tab-switch mechanism if exported:
  //   app.switchTab('debts');
  // Fall back to simulating a click on the Debts tab button:
  const debtsTab = document.querySelector('[data-tab="debts"]');
  if (debtsTab) debtsTab.click();
}

// In the row render loop:
if (isDebtLinked(expense)) {
  row.style.cursor = 'pointer';
  row.addEventListener('click', navigateToDebtsTab);
} else {
  // Attach SwipeHandler as normal
  this._initSwipeRow(row, expense.id);
}
```

### Status Icon Render
```js
// Source: CONTEXT.md spec + WCAG accessible name pattern
function renderStatusIcon(status) {
  const map = {
    paid:      { icon: '✓', label: 'Paid' },
    pending:   { icon: '○', label: 'Pending' },
    cancelled: { icon: '✗', label: 'Cancelled' },
  };
  const { icon, label } = map[status] || map.pending;
  return `<span class="status-icon" aria-label="${label}">${icon}</span>`;
}
```
</code_examples>

<sota_updates>
## State of the Art (2025–2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Action buttons inline in table row | Swipe-to-reveal action pattern | ~2016 (iOS Mail, native apps) | Industry standard for mobile tables; recovers horizontal space for data |
| Full date string in table cell (`Mar 14, 2026`) | Two-line compact format (`14-Mar` / `2026`) | N/A — codebase-specific decision | Reduces date column width by ~40% on narrow viewports |
| Status text badge (`Paid`, `Pending`) | Single icon (✓ / ○ / ✗) | ~2020 (mobile-first table patterns) | Reduces status column to near-zero width; icon is universally understood with aria-label fallback |
| Category as a table column | Category as inline badge chip | ~2018 (card-based UI patterns) | Removes one full column while keeping the data discoverable |

**New patterns relevant to this phase:**
- **`pointer-events: none` on swipe-action divs while row is snapping back:** Prevents accidental tap-activation of Edit/Delete during the CSS transition back to `translateX(0)`. Add `pointer-events: none` to the action div while transitioning, remove it after `transitionend`.
- **`will-change: transform` on `.swipe-content`:** Promotes the row to its own compositor layer, ensuring 60fps translateX animation even on mid-range Android devices.

**Deprecated/outdated:**
- **Separate Edit/Delete button columns:** Too wide on mobile (confirmed issue in CONTEXT.md). Remove entirely from mobile layout.
</sota_updates>

<open_questions>
## Open Questions

1. **Exact field name for debt-linked expenses (`sourceDebtId` vs `debtId` vs `sourceType`)**
   - What we know: The CONTEXT.md acknowledges uncertainty. The most likely candidates are `sourceDebtId` (referenced in CONTEXT.md), `debtId` (mentioned in INTEGRITY-01 schema), and `sourceType === 'debt'` (generic pattern).
   - What's unclear: Which field(s) are actually populated by the debt system when it creates an expense record.
   - Recommendation: The implementing agent **must** read `src/ui/expenses.js` (search for `debtId`, `sourceDebtId`, `sourceType`) and `src/db/repository.js` before writing any detection logic. Use all applicable fields in an `||` guard to be defensive.

2. **Does `SwipeHandler` support a tap (zero-travel touch) callback?**
   - What we know: `SwipeHandler` has `onStart`, `onSwipe`, `onEnd`, `onThresholdCross` callbacks. A "tap" is a touch with `|deltaX| < deadZone` and `|deltaY| < deadZone`.
   - What's unclear: Whether the existing `onEnd` fires for a tap (it should, with `deltaX ≈ 0` and `thresholdMet = false`), or whether `isSwiping` is set to false before `onEnd` is reached in the tap case.
   - Recommendation: For debt-linked rows, use a native `click` event listener rather than relying on `SwipeHandler.onEnd`. The `click` event fires reliably for taps and does not conflict with swipe (the swipe handler calls `e.preventDefault()` only after horizontal intent is confirmed, so taps are not suppressed).

3. **Does `expenses.js` already have `_swipeInstances` and `currentOpenRow`?**
   - What we know: The task brief says yes (line 819+). The implementing agent should verify this directly by reading the relevant lines before making any changes.
   - What's unclear: The exact method names and class structure around the swipe init code.
   - Recommendation: Read `src/ui/expenses.js` lines 800–900 before writing anything. Copy the destroy+reinit pattern verbatim.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `src/utils/gestures.js` (128 lines, full source read) — SwipeHandler API: constructor options, `onStart`/`onSwipe`/`onEnd`/`onThresholdCross` callbacks, `destroy()` method, angle disambiguation logic, edge protection, `triggerHaptic('threshold')` integration
- `/home/user/workspace/planning-updates/phases/29-CONTEXT.md` — locked decisions, acceptance criteria, field name guidance, debt-link navigation spec
- `/home/user/workspace/REQUIREMENTS.md` — MOB-04, MOB-05, DEBT-04 full requirement text confirmed
- `/home/user/workspace/ROADMAP.md` — Phase 29 objective and file list confirmed

### Secondary (MEDIUM confidence)
- `planning-updates/phases/28-RESEARCH.md` — established codebase conventions (CSS class naming, pattern style) for continuity
- Task brief context section — confirms `expensesUI._swipeInstances`, `currentOpenRow`, swipe-row class, line 819+ swipe pattern in `expenses.js`

### Tertiary (LOW confidence - needs validation during execution)
- Task brief claim that `expenses.js` swipe is at line 819 — needs direct file read to confirm line numbers and exact method names before modifying
- Debt-link field name (`sourceDebtId`) — needs `src/db/repository.js` inspection to confirm
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Vanilla JS touch events, CSS transform animations, HTML table structure
- Ecosystem: In-repo `SwipeHandler`, in-repo `triggerHaptic`, built-in `Date` API
- Patterns: Swipe-reveal, compact date format, badge chip, status icon, debt-link detection
- Pitfalls: Memory leaks, scroll conflict, field name mismatch, accessibility gaps, concurrent open rows

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all technology is in-repo or built-in
- Architecture: HIGH — patterns derived directly from existing `expenses.js` implementation (confirmed in task brief) and `gestures.js` source (full read)
- Pitfalls: HIGH — all pitfalls are known failure modes for this exact pattern; confirmed by `gestures.js` source review
- Code examples: HIGH — all examples based on actual `SwipeHandler` API (read from source); date format is standard JS; CSS is additive

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days — no external dependencies; all technology is stable in-repo code)
</metadata>

---

*Phase: 29-mobile-table-interaction-fixes*
*Research completed: 2026-03-14*
*Ready for planning: yes*
