# Phase 45: Transactions Tab Fixes - Research

**Researched:** 2026-03-21
**Domain:** Vanilla JS UI — transactions.js, expenses.js, income-sources.js, HTML template
**Confidence:** HIGH

---

## Summary

Phase 45 fixes eight distinct issues in the Transactions tab (`src/ui/transactions.js`). The tab currently renders a merged list of income and expense rows but was built when it handled income only — many IDs, labels, and behaviours are still income-scoped vestiges. The fixes fall into three categories:

1. **Action buttons** — Add a mark-as-paid button for expense rows (TRANS-01), add a confirm-received button for income rows (TRANS-02), replace two reconciliation mode buttons with one (TRANS-03), replace two Add buttons with one unified Add button (TRANS-04).
2. **Display/UX** — Add a sort order toggle (TRANS-05), add ± amount prefixes (TRANS-06), fix the search placeholder (TRANS-07), and extend the category filter to include all category groups instead of income-only (TRANS-08).
3. **HTML cleanup** — Several duplicate buttons in `index.html` and stale IDs in `transactions.js` need updating.

All infrastructure (repositories, modalUI, toggleExpenseStatus handler, confirmIncomeEntry handler) already exists in the codebase. The phase is primarily UI wiring, not new data model work.

**Primary recommendation:** Work directly in `transactions.js` and `index.html`. Avoid creating new global state or new repository methods — wire to existing `window.toggleExpenseStatus`, `window.showIncomeConfirmPrompt`, `window.expensesUI.openForm`, and `transactionUI.openForm` patterns already established in prior phases.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (no framework) | — | All UI modules | Established project pattern |
| Dexie.js (via repository.js) | — | IndexedDB access | All data operations go through repository layer |
| safeHTML tagged template | — | XSS-safe HTML strings | Used in every UI module |
| modalUI | — | Shared modal overlay | Single modal in DOM, reused across all tabs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| triggerHaptic | — | Touch feedback | After any user action that mutates data |
| notificationUI | — | Toast notifications | Error and success feedback |
| filterTransactions (filtering.js) | — | Search + category filter | Already used for expense tab; wire for transactions |
| formatGBP (currency.js) | — | Pence-to-£ formatting | All amount display |

### Installation
No new packages required. All dependencies are already in the project.

---

## Architecture Patterns

### Recommended Project Structure
No new files needed. All changes go to:
```
src/ui/transactions.js      — primary implementation file
index.html                  — button cleanup (duplicate remove, placeholder fix)
src/ui/transactions.test.js — new test file (Wave 0 TDD)
```

### Pattern 1: Mark-as-Paid for Expense Rows (TRANS-01)

**What:** Expense rows in the merged table need a "Mark Paid" / "Mark Pending" inline button. The toggle logic already exists as `window.toggleExpenseStatus(id, type, currentStatus)` in `expenses.js` (line 237). The transactions tab just needs to render a button that calls it.

**Current expense row renders (line 503-508 of transactions.js):**
```javascript
// Expense row action cell currently:
${isDebt ? '' : `
  <button class="sm ghost btn-edit" onclick="window.expensesUI?.editExpense(${item.id}, '${item.type}')">Edit</button>
  <button class="sm danger btn-delete" onclick="window.deleteExpense(${item.id}, '${item.type}')">&#x2715;</button>
`}
```

**After change — add a status toggle button before Edit:**
```javascript
// Source: existing pattern from expenses.js line 237
const isPaid = item.status === 'paid';
${isDebt ? '' : `
  <button class="sm ${isPaid ? 'success' : 'ghost'} btn-mark-paid"
    onclick="window.toggleExpenseStatus(${item.id}, '${item.type}', '${item.status || 'pending'}')">
    ${isPaid ? '✓ Paid' : 'Mark Paid'}
  </button>
  <button class="sm ghost btn-edit" onclick="window.expensesUI?.editExpense(${item.id}, '${item.type}')">Edit</button>
  <button class="sm danger btn-delete" onclick="window.deleteExpense(${item.id}, '${item.type}')">&#x2715;</button>
`}
```

**Dependency:** `window.toggleExpenseStatus` is registered by `expensesUI.setupEventListeners()` (expenses.js line 237). The transactions tab re-renders from `app:refresh` after the status update, so no extra render call needed in transactions.js.

**Visual feedback:** The `isPaid` boolean drives button label and class — when `status === 'paid'` the button shows `✓ Paid` with a success class.

### Pattern 2: Confirm Income as Received (TRANS-02)

**What:** Income rows need a "Confirm Received" button for unconfirmed entries. Confirmed entries (those that exist in `incomeRepository`) are already rendered — they ARE the income rows. The concept of "confirming" is about the link back to an income source's pending event.

**Key insight:** Income rows in `incomeRepository` represent confirmed entries. What TRANS-02 requires is showing an inline status on income rows (received / not received) and a quick way to mark them as cleared/confirmed without leaving the tab. The simplest approach, consistent with Phase 43 (debt history) and Phase 44 (income modal), is to add an "isCleared" status toggle button to income rows that is always visible (not just in reconciliation mode).

**Current income row action cell (transactions.js line 472-482):**
```javascript
${this.reconciliationMode ? `
  <div>...<input type="checkbox" ... onclick="toggleIncCleared(...)"/></div>
` : `
  <button class="sm ghost btn-edit" ...>Edit</button>
  <button class="sm danger btn-delete" ...>&#x2715;</button>
`}
```

**After change — promote isCleared toggle out of reconciliation mode:**
```javascript
// Always show: cleared toggle + edit + delete
const isCleared = item.isCleared === true;
`<button class="sm ${isCleared ? 'success' : 'ghost'} btn-confirm-income"
  onclick="window.toggleIncCleared(${item.id}, ${isCleared})"
  title="${isCleared ? 'Received' : 'Mark as Received'}">
  ${isCleared ? '✓ Received' : 'Confirm'}
</button>`
```

`window.toggleIncCleared` already exists (transactions.js line 139) and calls `incomeRepository.update(id, { isCleared: !currentStatus })`.

### Pattern 3: Remove Duplicate Reconciliation Button (TRANS-03)

**What:** `index.html` currently contains TWO reconciliation buttons on the Transactions tab:
- `#toggleIncReconBtn` (line 159) — wired in transactions.js to income recon mode
- `#toggleExpReconBtn` (line 160) — wired in expenses.js to expense recon mode

**Fix:** Remove `#toggleExpReconBtn` from the Transactions tab HTML. The expense-specific reconciliation belongs on the Expenses tab (if one exists), not here. The income reconciliation button `#toggleIncReconBtn` stays.

**Check:** `expenses.js` line 315 looks up `document.getElementById('toggleExpReconBtn')`. If this element is absent, the lookup returns `null` and the if-block is skipped safely — no crash. Confirmed by reading expenses.js line 155-156 (addEventListener guard: `if (reconBtn)`).

### Pattern 4: Unified Add Button (TRANS-04)

**What:** Replace separate `#addIncBtn` (Add Income) and `#addExpenseBtn` (Add Expense) buttons with a single "Add" button that opens a type-selection step in the modal.

**Approach:** Add a new `openAddTypeModal()` method to `transactionUI`:
```javascript
openAddTypeModal() {
  const content = safeHTML`
    <p style="margin-bottom:16px">What would you like to add?</p>
    <div style="display:flex;gap:12px;flex-direction:column">
      <button class="primary" onclick="transactionUI._addIncome()">+ Income</button>
      <button class="primary" onclick="transactionUI._addExpense()">+ Expense</button>
    </div>
  `;
  modalUI.show('Add Transaction', content, [
    { label: 'Cancel', className: 'ghost', onClick: () => modalUI.close() }
  ]);
},
_addIncome() { modalUI.close(); this.openForm(); },
_addExpense() { modalUI.close(); window.expensesUI?.openForm(); },
```

**HTML change:** Replace two buttons with one in `index.html`:
```html
<!-- Before -->
<button id="addIncBtn" class="primary">+ Add Income</button>
<button id="addExpenseBtn" class="primary">+ Add Expense</button>

<!-- After -->
<button id="addTransBtn" class="primary">+ Add</button>
```

**Wire in setupEventListeners:** Replace `addIncBtn` listener with `addTransBtn` listener:
```javascript
const addTransBtn = document.getElementById('addTransBtn');
if (addTransBtn) addTransBtn.onclick = () => this.openAddTypeModal();
```

**Note:** `expensesUI.setupEventListeners` also looks up `#addExpenseBtn` (line 149-151). If element is absent, the guard `if (addExpenseBtn)` makes it safe.

### Pattern 5: Sort Order Toggle (TRANS-05)

**What:** Add a `sortOrder` state property ('desc' = newest first, 'asc' = oldest first) and a toggle button. Current sort in `_buildMergedRows` is hardcoded to `b.displayDate.localeCompare(a.displayDate)` (descending).

**State change:**
```javascript
// Add to transactionUI object:
sortOrder: 'desc', // 'desc' | 'asc'
```

**Sort change in `_buildMergedRows`:**
```javascript
_buildMergedRows(incomeItems, recurrentItems, oneOffItems) {
  // ... same row building ...
  return [...incomeRows, ...recurrentRows, ...oneOffRows]
    .sort((a, b) => {
      const cmp = (b.displayDate || '').localeCompare(a.displayDate || '');
      return this.sortOrder === 'asc' ? -cmp : cmp;
    });
},
```

**Button in HTML (add to toolbar row in index.html):**
```html
<button id="sortOrderBtn" class="ghost sm">↓ Newest First</button>
```

**Wire in setupEventListeners:**
```javascript
const sortOrderBtn = document.getElementById('sortOrderBtn');
if (sortOrderBtn) {
  sortOrderBtn.onclick = () => {
    this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    sortOrderBtn.textContent = this.sortOrder === 'asc' ? '↑ Oldest First' : '↓ Newest First';
    this.render();
  };
}
```

### Pattern 6: Amount Prefix ± (TRANS-06)

**What:** Expense amounts need a `−` prefix; income amounts need a `+` prefix.

**Current amount cells use `formatGBP(item.amount)` directly (lines 470, 502).**

**After:**
```javascript
// Income row:
<td class="r"><span class="privacy-blur">+${formatGBP(item.amount)}</span></td>

// Expense row:
<td class="r"><span class="privacy-blur">\u2212${formatGBP(item.amount)}</span></td>
```

`\u2212` is the proper minus sign (−), matching the requirement.

### Pattern 7: Fix Search Placeholder (TRANS-07)

**What:** `index.html` line 169 has `placeholder="Search income..."`. Change to `placeholder="Search transactions"`.

**Fix:** Single attribute change in index.html.

### Pattern 8: Category Filter Includes All Groups (TRANS-08)

**What:** `renderCategoryFilter` in transactions.js (line 377) currently filters to income-only categories: `const incomeCats = categories.filter(c => c.group === 'income')`. This excludes expense categories and any debt-linked categories.

**Fix:** Show all non-system categories:
```javascript
// Before:
const incomeCats = categories.filter(c => c.group === 'income');

// After:
const allCats = categories.filter(c => c.group !== 'system');
```

Then use `allCats` in the dropdown rendering. Category groups in the repo are: `'income'`, `'expenses'`, `'system'`. Debt-linked expense rows use the `'expenses'` group categories (e.g. "Credit Cards & Loans"). This change makes all non-system categories available for filtering.

**selectedCategories filter in renderTransactions:** The `filterTransactions` utility is not currently called in `renderTransactions` — search is done with a manual `.filter()` on `displayLabel` only (line 427). The category filter's `this.selectedCategories` is set by `handleCategoryChange` but never applied to the merged rows. This is an existing bug that TRANS-08 exposes. Fix: replace the manual search filter with `filterTransactions` from `utils/filtering.js`:
```javascript
const filtered = filterTransactions(
  allMerged,
  this.searchQuery,
  this.selectedCategories,
  ['displayLabel'],
  catMap
);
```

### Anti-Patterns to Avoid
- **Creating new repository methods:** All required data access (`incomeRepository.update`, `recurrentExpenseRepository.update`, `oneOffExpenseRepository.update`) already exists.
- **Adding a second modal overlay:** Use the existing `modalUI.show` for the type-selection step in TRANS-04.
- **Deleting the reconciliation feature entirely:** TRANS-03 only removes the duplicate button — income reconciliation mode remains functional.
- **Calling `window.expensesUI.render()` from transactions.js:** After toggling expense status, `app:refresh` fires via `triggerSync()` in the repository layer, causing both tabs to update. Do not add a manual cross-module render call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expense paid/pending toggle | Custom update function | `window.toggleExpenseStatus(id, type, status)` (expenses.js line 237) | Already handles cycleTotal, debt intercept, haptic |
| Income cleared toggle | Custom update function | `window.toggleIncCleared(id, currentStatus)` (transactions.js line 139) | Already in module, calls repository update |
| Modal overlay | Second modal element | `modalUI.show(title, content, footer)` (render.js) | Single shared modal in DOM |
| Search + category filter | Manual array filter | `filterTransactions` (utils/filtering.js) | Handles both search fields and category IDs |
| Safe HTML rendering | String concatenation | `safeHTML` tagged template (render.js) | DOMPurify-backed XSS protection |

---

## Common Pitfalls

### Pitfall 1: toggleExpReconBtn null-check gap
**What goes wrong:** If `#toggleExpReconBtn` is removed from index.html, `expensesUI.setupEventListeners` looks it up. The guard `if (reconBtn)` at line 155 makes the addEventListener call safe, but the `toggleReconciliationMode` method (line 313-316) also does `document.getElementById('toggleExpReconBtn')` — if this runs it gets null. The `if (btn)` guard at line 315 handles null correctly.
**How to avoid:** Verify both lookup sites in expenses.js have null guards before removing the element from HTML.

### Pitfall 2: addExpenseBtn null-check gap
**What goes wrong:** `expensesUI.setupEventListeners` looks up `#addExpenseBtn` at line 149. Guard `if (addExpenseBtn)` at line 150 makes it safe when element is absent.
**How to avoid:** Confirm the guard before removing from HTML. Search `addExpenseBtn` in expenses.js to find all references.

### Pitfall 3: Category filter not applied to merged rows
**What goes wrong:** `this.selectedCategories` is populated by `handleCategoryChange` but the current `renderTransactions` only applies a text search, not the category filter. The dropdown appears functional but does nothing.
**How to avoid:** Switch to `filterTransactions` for both search and category filtering in `renderTransactions` (TRANS-08 fix).

### Pitfall 4: sortOrder not persisted across renders
**What goes wrong:** `_buildMergedRows` is a pure method that receives items as arguments. If `sortOrder` is stored on `transactionUI` as a property, it survives re-renders within the same session but resets on page reload. This is consistent with existing behaviour (searchQuery also resets).
**How to avoid:** No special action needed — localStorage persistence is not required by TRANS-05.

### Pitfall 5: Amount prefix double-formats pence
**What goes wrong:** `formatGBP` expects pence (integer). If the prefix is added inside the safeHTML template literal after calling formatGBP, the result is a string like `+£12.00` which is correct. Do NOT call `formatGBP` on a pounds value.
**How to avoid:** Keep the pattern `+${formatGBP(item.amount)}` — amount is always pence in the merged row objects.

### Pitfall 6: safeHTML strips onclick attributes
**What goes wrong:** DOMPurify (via safeHTML) strips inline `onclick` attributes when content is set via `innerHTML`. The project works around this by using `.addEventListener` after render (see Phase 43 pattern for loan history rows). However, most existing transactions.js buttons use `onclick="window.xyz()"` patterns that ARE preserved because they reference global window functions, and DOMPurify allows event handlers on trusted strings passed through safeHTML tagged templates.
**How to avoid:** Follow the existing pattern — use `window.toggleExpenseStatus(...)` and `window.toggleIncCleared(...)` in onclick attributes, matching how other buttons in the same template are already handled.

---

## Code Examples

### Existing `window.toggleExpenseStatus` (expenses.js line 237)
```javascript
// Source: src/ui/expenses.js line 237
window.toggleExpenseStatus = async (id, type, currentStatus) => {
  try {
    if (type === 'recurrent') {
      const item = await recurrentExpenseRepository.get(id);
      if (!item) return;
      // debt intercept...
      const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
      const updates = { status: newStatus };
      if (newStatus === 'paid' && item.cycleTotal > 0) {
        updates.cycleCurrent = Math.min((item.cycleCurrent || 0) + 1, item.cycleTotal);
      }
      await recurrentExpenseRepository.update(id, updates);
    } else {
      const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
      await oneOffExpenseRepository.update(id, { status: newStatus });
    }
    triggerHaptic('tap');
    await this.render(); // renders expensesUI, not transactionUI
  } catch (err) { ... }
};
```
Note: This handler calls `this.render()` which renders the Expenses tab. For the Transactions tab to update, it listens on `app:refresh` dispatched by `triggerSync` in the repository layer. Confirm `triggerSync` fires on `recurrentExpenseRepository.update` — it does (repository.js line 44).

### Existing `window.toggleIncCleared` (transactions.js line 139)
```javascript
// Source: src/ui/transactions.js line 139
window.toggleIncCleared = async (id, currentStatus) => {
  try {
    await incomeRepository.update(id, { isCleared: !currentStatus });
    await this.render();
  } catch (err) {
    console.error('Failed to toggle cleared status:', err);
  }
};
```
This already calls `this.render()` (transactionUI.render). The Confirm button for income rows simply calls this same handler.

### filterTransactions utility (utils/filtering.js)
```javascript
// Source: src/utils/filtering.js
export function filterTransactions(items, query, categoryIds = [], searchFields = [], catMap = {}) {
  const normalizedQuery = (query || '').toLowerCase().trim();
  return items.filter(item => {
    const matchesSearch = !normalizedQuery || searchFields.some(field => {
      const val = (item[field] || '').toLowerCase();
      const catName = (catMap[item.categoryId] || '').toLowerCase();
      return val.includes(normalizedQuery) || catName.includes(normalizedQuery);
    });
    const itemCatId = item.categoryId ? Number(item.categoryId) : null;
    const matchesCat = categoryIds.length === 0 || categoryIds.map(Number).includes(itemCatId);
    return matchesSearch && matchesCat;
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Income-only transactions tab | Merged income + expense rows | Prior to v3 | renderTransactions builds merged rows but toolbar still income-labelled |
| Two separate Add buttons | Unified Add with type picker | Phase 45 | Reduces button count in toolbar |
| Category filter income-only | All non-system categories | Phase 45 | Debt expense categories become filterable |

**Deprecated/outdated:**
- `#addIncBtn` / `#addExpenseBtn`: replaced by `#addTransBtn` in Phase 45
- `#toggleExpReconBtn` in Transactions tab HTML: removed (remains in Expenses tab if applicable)
- `incSearch` placeholder "Search income...": updated to "Search transactions"

---

## Open Questions

1. **Does the Expenses tab have its own dedicated HTML panel?**
   - What we know: index.html shows the Transactions tab (`data-panel="transactions"`) contains both income and expense buttons/tables. There is no separate `data-panel="expenses"` visible in the HTML snippet reviewed.
   - What's unclear: Whether `#toggleExpReconBtn` and `#addExpenseBtn` appear only in the Transactions tab or also elsewhere.
   - Recommendation: Before removing these elements, grep index.html for all occurrences to confirm they appear only once.

2. **Should the reconciliation feature stay for income in the Transactions tab?**
   - What we know: TRANS-03 says "exactly one reconciliation mode button" — not "remove reconciliation mode." The income reconciliation (`#toggleIncReconBtn`) should remain.
   - What's unclear: Whether the expense recon (`#toggleExpReconBtn`) should move to an Expenses tab or just be removed from Transactions.
   - Recommendation: Remove `#toggleExpReconBtn` from Transactions tab HTML. If there's no dedicated Expenses tab panel, accept that expense reconciliation is not accessible from Transactions tab after Phase 45.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment) |
| Config file | `vitest.config.js` |
| Quick run command | `npx vitest run src/ui/transactions.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRANS-01 | Expense row in merged table renders a mark-paid button; clicking calls `window.toggleExpenseStatus` | unit | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |
| TRANS-02 | Income row renders a confirm/received button; clicking calls `window.toggleIncCleared` | unit | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |
| TRANS-03 | Transactions tab HTML has exactly one reconciliation button | unit | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |
| TRANS-04 | `openAddTypeModal` shows income/expense type choice in modal | unit | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |
| TRANS-05 | `sortOrder` toggles between 'asc'/'desc'; `_buildMergedRows` respects order | unit | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |
| TRANS-06 | Income amount cells contain `+` prefix; expense amount cells contain `−` prefix | unit | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |
| TRANS-07 | `#incSearch` placeholder attribute is "Search transactions" | unit (DOM assert) | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |
| TRANS-08 | Category filter dropdown renders categories from all non-system groups | unit | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/ui/transactions.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/ui/transactions.test.js` — covers TRANS-01 through TRANS-08
- [ ] Mock pattern: follow `src/ui/expenses.test.js` — mock `../db/repository.js`, `./render.js`, `../utils/haptics.js`, `../utils/currency.js`

---

## Sources

### Primary (HIGH confidence)
- `src/ui/transactions.js` — full source read; all current IDs, state, and render patterns confirmed
- `src/ui/expenses.js` — `window.toggleExpenseStatus`, `window.toggleExpCleared` confirmed; `#addExpenseBtn` and `#toggleExpReconBtn` null guards confirmed
- `src/ui/income-sources.js` — `confirmIncome`, `confirmIncomeEntry`, `window.toggleIncCleared` confirmation patterns
- `src/db/repository.js` — category groups (`'income'`, `'expenses'`, `'system'`), `incomeRepository`, expense repos, `triggerSync` on all update calls
- `index.html` lines 127-184 — full Transactions tab HTML structure confirmed; all button IDs and placeholder text confirmed
- `src/utils/filtering.js` — `filterTransactions` signature and behaviour confirmed

### Secondary (MEDIUM confidence)
- `src/ui/expenses.test.js` — test file structure used as pattern reference for Wave 0 test setup

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in source code
- Architecture: HIGH — all handler functions and DOM IDs confirmed by reading source files
- Pitfalls: HIGH — null guards confirmed by reading expenses.js line-by-line

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable codebase, no external dependencies changing)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TRANS-01 | User can mark an expense transaction as paid from the Transactions tab and see the status update | `window.toggleExpenseStatus(id, type, currentStatus)` exists in expenses.js line 237; just needs a button in the expense row action cell |
| TRANS-02 | User can confirm an income transaction as received from the Transactions tab | `window.toggleIncCleared(id, currentStatus)` exists in transactions.js line 139; promote from reconciliation-mode-only to always-visible |
| TRANS-03 | Transactions tab shows exactly one reconciliation mode button (duplicate removed) | `#toggleExpReconBtn` in index.html line 160 is the duplicate; null guards in expenses.js make removal safe |
| TRANS-04 | User can add a transaction via a single "Add" button that lets them select income or expense type inside the modal | `modalUI.show` pattern established; `transactionUI.openForm()` and `window.expensesUI.openForm()` are the two branches |
| TRANS-05 | User can toggle the transaction list sort order between newest first and oldest first | `_buildMergedRows` sort comparator hardcoded to descending; add `sortOrder` state property and toggle button |
| TRANS-06 | Expense transaction amounts display with a minus (−) prefix; income amounts display with a plus (+) prefix | `formatGBP` called directly in template; wrap with `+` / `\u2212` prefix before the call result |
| TRANS-07 | Transaction search bar placeholder reads "Search transactions" | index.html line 169 placeholder is "Search income..."; single string change |
| TRANS-08 | Category filter in Transactions tab includes debt-linked transaction categories, not only income categories | `renderCategoryFilter` filters to `c.group === 'income'` only; change to `c.group !== 'system'`; also wire `filterTransactions` for category filtering which is currently not applied |
</phase_requirements>
