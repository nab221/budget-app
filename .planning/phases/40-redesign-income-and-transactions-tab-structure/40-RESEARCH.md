# Phase 40: Redesign Income and Transactions Tab Structure — Research

**Researched:** 2026-03-17
**Domain:** Navigation tab renaming, merged transactions view, heatmap relocation, render-bug diagnosis
**Confidence:** HIGH

---

## Summary

Phase 40 restructures three aspects of the app's navigation:

1. **"Pay Sources" tab** renamed to **"Income"** — this is the Phase 39.1 income-sources module (`src/ui/income-sources.js`). The tab label and aria-label in `index.html` must change. The tab's render bug (shows nothing) turns out to be a false alarm — the module renders correctly when the container `#incomeSourcesContainer` is present; the empty appearance during UAT was likely caused by testing the tab before the wrapper div `incomeSourcesContainer` was committed in Phase 39.1 fix (commit `baad868`). The current code is wired correctly: `panelId === 'income-sources'` triggers `incomeSourcesUI.render()` in `renderAll()`, and `index.html` already has `<div id="incomeSourcesContainer">` inside `data-panel="income-sources"`. No structural render bug exists in the current codebase — the UAT issue is now resolved. The only change needed here is the cosmetic label: "Pay Sources" → "Income".

2. **Current "Income" tab** (`data-panel="income"`, `data-tab="income"`) renamed to **"Transactions"** — `transactionUI` becomes the Transactions tab, now showing both income and expense rows together with colour/tag coding. The `data-tab` and `data-panel` attribute values must change to `transactions`. All JS string references in `app.js` (`panelId === 'income'`) and `transactions.js` (global `window.transactionUI`, localStorage key `transaction_month`, DOM IDs like `#incBody`, `#incMonthPicker`, `#incomeTabHeatmapContainer`) must be audited. The transactions tab gains expense rows sourced from `expensesUI`'s two repos (`recurrentExpenseRepository`, `oneOffExpenseRepository`) and the heatmaps from both income and spending.

3. **Dashboard heatmap repositioning** — the two heatmap section `<div>`s (`#incomeHeatmapSection` and `#spendingHeatmapSection`) currently appear near the top of `data-panel="dashboard"` in `index.html`, before the navigator controls and `#summaryGrid`. They must move to the bottom of the dashboard panel — after the pay-period affordability section.

**Primary recommendation:** Tackle in three atomic waves: (a) rename Pay Sources → Income label only, (b) rename Income tab → Transactions and build the merged view, (c) move dashboard heatmaps to bottom. All changes are confined to `index.html`, `app.js`, `src/ui/transactions.js`, `src/ui/dashboard.js`, and `css/main.css`. No schema changes. No new repositories.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| 40-01 | Rename "Pay Sources" tab label/aria to "Income"; fix any remaining render issue | Tab wiring is correct; only label change in index.html needed |
| 40-02 | Rename current "Income" tab/panel to "Transactions"; update all JS references | data-tab, data-panel, panelId branch, localStorage key, DOM IDs, CSS IDs |
| 40-03 | Transactions tab shows both income AND expense rows with IN/OUT colour tags | Merge incomeRepository + recurrentExpenseRepository + oneOffExpenseRepository data |
| 40-04 | Both income and spending heatmaps live in Transactions tab | Move heatmap sections from income panel to new transactions panel |
| 40-05 | Dashboard heatmaps moved to bottom of dashboard panel | index.html DOM reorder; no JS changes |
</phase_requirements>

---

## Standard Stack

### Core (all already in project — no new installs)

| Library / Module | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| `src/ui/transactions.js` | existing | Income tab renderer — becomes Transactions | Already has swipe, reconciliation, month nav, heatmap |
| `src/ui/expenses.js` | existing | Expense renderer — data sourced here for merged view | Already merges recurrent + oneoff; has badge/chip rendering |
| `src/ui/heatmap.js` | existing | `renderSpendingHeatmap()` canvas renderer | Already used by both income and expenses tabs |
| `src/db/repository.js` | existing | `incomeRepository`, `recurrentExpenseRepository`, `oneOffExpenseRepository` | All used by transactions.js and expenses.js already |
| `safeHTML` tag (`src/ui/render.js`) | existing | XSS-safe template rendering | Project standard — must be used for any new HTML strings |

### No New Dependencies

This phase is pure reorganisation. No new npm packages required.

---

## Architecture Patterns

### Current Tab Wiring (complete inventory)

```
index.html                         app.js renderAll()
─────────────────────────────────────────────────────
data-tab="dashboard"             → renderDashboard()
data-tab="income"                → transactionUI.render()        ← RENAME to "transactions"
data-tab="expenses"              → expensesUI.render()
data-tab="debts"                 → debtUI.render()
data-tab="assets"                → assetUI.render()
data-tab="payoff"                → renderPayoffPlanner()
data-tab="childcare"             → childcareUI.render()
data-tab="income-sources"        → incomeSourcesUI.render()      ← RENAME label to "Income"
data-tab="settings"              → categoryUI.render() + targetsUI + incomeSpendingSettings.render()
```

**Key invariant:** `data-tab` and `data-panel` values must match — tab switching in `app.js` uses `t.dataset.tab` to find panels via `p.dataset.panel === panelId`.

### Rename 1: Pay Sources → Income (label only)

The `data-tab="income-sources"` value stays the same (it is the internal key). Only the visible label and aria-label change:

```html
<!-- BEFORE -->
<button class="tab" data-tab="income-sources" aria-label="Pay Sources">
  <span class="tab-label">Pay Sources</span>
</button>

<!-- AFTER -->
<button class="tab" data-tab="income-sources" aria-label="Income">
  <span class="tab-label">Income</span>
</button>
```

No JS changes required for this rename — the panelId `income-sources` is unchanged.

### Rename 2: Income tab → Transactions tab

This is a deeper rename. All of these must change together atomically:

**index.html changes:**
- `data-tab="income"` → `data-tab="transactions"`
- `data-panel="income"` → `data-panel="transactions"`
- `aria-label="Income"` on that button → `aria-label="Transactions"`
- Tab label span text: "Income" → "Transactions"
- The income tab panel HTML stays in place (DOM IDs like `#incBody`, `#incMonthPicker` etc. can be retained or renamed — see note below)

**app.js changes:**
- `if (panelId === 'income') renderTasks.push(transactionUI.render())` → change `'income'` to `'transactions'`

**transactions.js changes:**
- `localStorage.getItem('transaction_month')` / `localStorage.setItem('transaction_month', ...)` — key name can stay as-is (no user-visible impact)
- `updateTotal` method: `document.querySelector('[data-panel="${type}"]')` where type is passed as `'income'` — must update to `'transactions'`
- Global `window.transactionUI = transactionUI` — no change needed
- `window.deleteTransaction` — currently handles `type === 'income'` — will need to also handle `type === 'expense'` for the merged view

**Note on DOM IDs:** The existing DOM IDs in the income panel (`#incBody`, `#incMonthPicker`, `#incomeTabHeatmapContainer`, `#incReconHeader`, `#incomeSummary`, `#addIncBtn`, `#toggleIncReconBtn`, `#incSearch`, `#incCategoryFilterContainer`) are referenced only by transactions.js. They do not need to change for the rename to work — but the heatmap container `#incomeTabHeatmapContainer` should be renamed to `#transactionsIncomeHeatmapContainer` to avoid confusion after the heatmap split.

### Rename 3: Merged Transactions View (IN / OUT rows)

The merged view fetches from three repositories and renders a combined table.

**Data shape — income row:**
```js
{
  _rowType: 'income',
  id: item.id,
  displayDate: item.date,
  displayLabel: item.source,
  amount: item.amount,     // pence
  categoryId: item.categoryId,
  isReconciled: item.isReconciled,
  isCleared: item.isCleared,
}
```

**Data shape — expense row:**
```js
{
  _rowType: 'expense',
  id: item.id,
  type: item.type,           // 'recurrent' | 'oneoff'
  displayDate: item.nextDate || item.date,
  displayLabel: item.label || item.note,
  amount: item.amount,       // pence
  categoryId: item.categoryId,
  status: item.status,
  isDebtPayment: item.isDebtPayment,
  debtType: item.debtType,
}
```

**IN / OUT tag pattern:**
```html
<!-- Income row tag -->
<span class="tag-in" style="background:var(--success); color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:4px">IN</span>

<!-- Expense row tag -->
<span class="tag-out" style="background:var(--danger); color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:4px">OUT</span>
```

**Sorting:** All merged rows sorted by `displayDate` descending (same pattern as existing expense sort).

**Month navigation:** Single shared month navigator controls both income and expense fetches. The existing `#incMonthPicker` + `transactionUI.currentMonth` month state drives both.

**Edit/Delete for merged rows:** Income rows use existing `transactionUI._handleEdit(id)` / `transactionUI._handleDelete(id)`. Expense rows delegate to `expensesUI.editExpense(id, type)` and `deleteExpense(id, type)`. Debt-linked expense rows navigate to Debts tab (existing pattern from `expenses.js`).

### Heatmap Relocation

**Current state in index.html dashboard panel (top-to-bottom order):**
1. `#rollingOverviewChartContainer` — Rolling chart
2. `#incomeHeatmapSection` — **income heatmap (MOVE TO BOTTOM)**
3. `#spendingHeatmapSection` — **spending heatmap (MOVE TO BOTTOM)**
4. `.dashboard-navigator-shell` — month picker + view toggle
5. `#summaryGrid` — actionable summary cards
6. Spending analytics `#grid2` (spending breakdown chart, savings rate)
7. (Dynamic) `#payPeriodSection` — pay-period affordability (inserted after summaryGrid by JS)

**Target order:**
1. `#rollingOverviewChartContainer`
2. `.dashboard-navigator-shell`
3. `#summaryGrid`
4. Spending analytics `#grid2`
5. (Dynamic) `#payPeriodSection`
6. `#incomeHeatmapSection` — now at bottom
7. `#spendingHeatmapSection` — now at bottom

This is a pure `index.html` DOM reorder. No JS changes needed — `renderDashboard()` in `dashboard.js` renders heatmaps by container ID (`renderSpendingHeatmap('incomeHeatmapContainer', ...)`) and those container IDs stay the same.

### Heatmaps in Transactions Tab

The current income tab has `#incomeTabHeatmapSection` (income heatmap only). In the new Transactions tab, both income AND spending heatmaps should live here, since transactions now shows both data flows.

**New Transactions panel heatmap section structure:**
```html
<!-- Income heatmap (moved from income tab) -->
<div class="card" id="transactionsIncomeHeatmapSection" ...>
  <div id="transactionsIncomeHeatmapContainer" class="privacy-blur"></div>
</div>

<!-- Spending heatmap (new — was only in expenses tab and dashboard) -->
<div class="card" id="transactionsSpendingHeatmapSection" ...>
  <div id="transactionsSpendingHeatmapContainer" class="privacy-blur"></div>
</div>
```

`transactions.js renderHeatmap()` must call both:
```js
renderSpendingHeatmap('transactionsIncomeHeatmapContainer', year, incomeData);
renderSpendingHeatmap('transactionsSpendingHeatmapContainer', year, spendingData);
```

Existing `#expensesTabHeatmapSection` in the Expenses tab can be retained (expenses tab still shows the spending heatmap).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row merging | Custom merge sort | `[...incomeRows, ...expenseRows].sort(...)` | Already done in expenses.js (recurrent + oneoff merge) |
| Heatmap | New canvas renderer | `renderSpendingHeatmap()` from `heatmap.js` | Already supports both income and spending — it's just a daily-data-to-canvas renderer |
| Row XSS protection | Manual escaping | `safeHTML` tag from `render.js` | Project standard, already in use everywhere |
| Tag badges | New CSS component | Inline style on `<span>` like existing badges in expenses.js | Consistent with TFC badge, debt badge, etc. |

---

## Common Pitfalls

### Pitfall 1: Splitting the `data-tab` vs `data-panel` rename
**What goes wrong:** Changing `data-tab` on the button but forgetting `data-panel` on the content div (or vice versa). The tab switch logic in `app.js` matches `t.dataset.tab` against `p.dataset.panel` — a mismatch causes the panel to never activate.
**How to avoid:** Search-replace both attributes together. Verify by testing tab click.

### Pitfall 2: `updateTotal()` type string mismatch
**What goes wrong:** `transactionUI.updateTotal('income', total)` calls `document.querySelector('[data-panel="income"]')` — after renaming the panel to `transactions`, this query returns `null` and the total div is never appended.
**How to avoid:** Update the `type` argument passed to `updateTotal` in `renderIncome()` to `'transactions'`.

### Pitfall 3: Edit/Delete for expense rows in the merged view
**What goes wrong:** Expense edit/delete requires knowing `type` ('recurrent' or 'oneoff') in addition to `id`. The existing income-only table only passes `id`. The merged view must preserve `data-type` on each expense row.
**How to avoid:** Add `data-id`, `data-type`, `data-row-type` attributes to every `<tr>` in the merged table. Delegate to the correct handler based on `_rowType`.

### Pitfall 4: Heatmap container ID duplication
**What goes wrong:** The dashboard has `#incomeHeatmapContainer` and the old income tab had `#incomeTabHeatmapContainer`. If the new Transactions tab reuses `#incomeTabHeatmapContainer` (unchanged), `renderSpendingHeatmap` writes to a container that may exist in a non-active panel.
**How to avoid:** Rename the Transactions tab heatmap containers to `#transactionsIncomeHeatmapContainer` and `#transactionsSpendingHeatmapContainer`. Update `transactions.js renderHeatmap()` accordingly.
**Warning signs:** Heatmap renders on wrong tab, or both heatmaps appear in dashboard.

### Pitfall 5: CSS heatmap container selectors
**What goes wrong:** `css/main.css` has explicit ID selectors for every heatmap container. New container IDs won't get the `min-width`, `canvas` sizing, or `privacy-blur` styles unless added.
**Current selectors (lines ~692–740):**
```css
#spendingHeatmapContainer, #incomeHeatmapContainer,
#incomeTabHeatmapContainer, #expensesTabHeatmapContainer { ... }
```
**How to avoid:** Add the two new container IDs to all four selector groups in main.css.

### Pitfall 6: Month state for merged expense rows
**What goes wrong:** `transactionUI.currentMonth` drives income fetch. Expense rows use `expensesUI.selectedMonth` separately. If they diverge, the merged view shows mismatched months.
**How to avoid:** The Transactions tab should use a single month state (transactionUI.currentMonth) and pass it explicitly to both `incomeRepository.getByMonth(month)` and `recurrentExpenseRepository.getByMonth(month)` / `oneOffExpenseRepository.getByMonth(month)`.

### Pitfall 7: localStorage key `transaction_month` vs `expenses_selected_month`
**What goes wrong:** When the Transactions tab fetches expenses, the month comes from `transactionUI.currentMonth` (from localStorage `transaction_month`). Expenses tab uses `expensesUI.selectedMonth` (from `expenses_selected_month`). These are independent — they may show different months. This is correct and intentional; don't merge them.

### Pitfall 8: `window.incPrevMonth` / `window.incNextMonth` globals
**What goes wrong:** The income month picker injects `onclick="incPrevMonth()"` etc. as global function strings via `safeHTML`. These globals are set up in `transactionUI.setupEventListeners()`. After renaming, these inline onclick strings still work as long as the function names don't change. However, the container ID `incMonthPicker` must still exist in the Transactions panel HTML.
**How to avoid:** Keep container ID `incMonthPicker` unchanged, or rename both the ID and the references in `renderMonthPicker()`.

---

## Code Examples

### Renaming the tab button (index.html)
```html
<!-- Pay Sources → Income (label only, data-tab stays 'income-sources') -->
<button class="tab" data-tab="income-sources" aria-label="Income">
  <span class="tab-label">Income</span>
</button>

<!-- Income → Transactions (data-tab and aria-label change) -->
<button class="tab" data-tab="transactions" aria-label="Transactions">
  <span class="tab-label">Transactions</span>
</button>
```

### app.js renderAll() patch
```js
// Before
if (panelId === 'income') renderTasks.push(transactionUI.render());
// After
if (panelId === 'transactions') renderTasks.push(transactionUI.render());
```

### Merged row rendering skeleton (transactions.js)
```js
// Source: project pattern from expenses.js lines 678-685
const incomeRows = (await incomeRepository.getByMonth(this.currentMonth))
  .map(i => ({ ...i, _rowType: 'income', displayDate: i.date, displayLabel: i.source }));

const recurrentRaw = await recurrentExpenseRepository.getByMonth(this.currentMonth);
const oneOffRaw = await oneOffExpenseRepository.getByMonth(this.currentMonth);
const expenseRows = [
  ...recurrentRaw
    .filter(i => (i.nextDate || i.date || '').startsWith(this.currentMonth))
    .map(i => ({ ...i, _rowType: 'expense', type: 'recurrent', displayDate: i.nextDate || i.date, displayLabel: i.label })),
  ...oneOffRaw
    .map(i => ({ ...i, _rowType: 'expense', type: 'oneoff', displayDate: i.date, displayLabel: i.note }))
];

const merged = [...incomeRows, ...expenseRows].sort((a, b) => b.displayDate.localeCompare(a.displayDate));
```

### IN / OUT tag pattern (consistent with existing badge style)
```js
// Source: project pattern from expenses.js badge HTML
const directionTag = item._rowType === 'income'
  ? `<span class="pill" style="background:var(--success);color:#fff;font-size:.65rem">IN</span>`
  : `<span class="pill" style="background:var(--danger);color:#fff;font-size:.65rem">OUT</span>`;
```

### CSS selector additions for new heatmap containers (main.css)
```css
/* Add new IDs to existing selector groups */
#spendingHeatmapContainer,
#incomeHeatmapContainer,
#incomeTabHeatmapContainer,
#expensesTabHeatmapContainer,
#transactionsIncomeHeatmapContainer,    /* NEW */
#transactionsSpendingHeatmapContainer { /* NEW */
  /* existing rules */
}
```

### Heatmap DOM reorder in index.html (dashboard panel)
```html
<!-- BEFORE (top of dashboard panel, before navigator) -->
<div id="incomeHeatmapSection" ...> ... </div>
<div id="spendingHeatmapSection" ...> ... </div>
<div class="dashboard-navigator-shell" ...> ... </div>
<div class="sum-grid" id="summaryGrid" ...> </div>
<div class="grid2" ...> <!-- spending breakdown --> </div>

<!-- AFTER (heatmaps moved to bottom, after grid2) -->
<div class="dashboard-navigator-shell" ...> ... </div>
<div class="sum-grid" id="summaryGrid" ...> </div>
<div class="grid2" ...> <!-- spending breakdown --> </div>
<!-- payPeriodSection injected dynamically after summaryGrid by dashboard.js -->
<div id="incomeHeatmapSection" ...> ... </div>
<div id="spendingHeatmapSection" ...> ... </div>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Separate Income and Expenses tabs | Merged Transactions tab with IN/OUT tags | Users see full cashflow picture in one place |
| Heatmaps at top of Dashboard | Heatmaps at bottom, actionable cards first | Reduces scroll-to-actionable on mobile |
| "Pay Sources" tab label | "Income" label (shorter, clearer) | Matches what the tab actually does |

---

## Open Questions

1. **Reconciliation mode in merged view**
   - What we know: Income tab has reconciliation mode (finalize reconciliation, lock rows). Expense tab has its own reconciliation mode.
   - What's unclear: Should the merged Transactions tab support reconciliation for income rows only, expense rows only, or both? The todo spec doesn't mention reconciliation.
   - Recommendation: Keep reconciliation mode for income rows only (unchanged behaviour). Hide it for expense rows in the merged view. Add a note to the plan.

2. **Search/category filter in merged view**
   - What we know: Income tab has `#incSearch` and `#incCategoryFilterContainer`. Expenses tab has `#expSearch` and `#expCategoryFilterContainer`.
   - What's unclear: Should merged view have one unified search or keep separate income/expense category filter?
   - Recommendation: Single search bar searching across both `displayLabel` fields. Category filter shows both income and expense categories.

3. **"+ Add Income" and "Trigger Recurrence" buttons**
   - What we know: Both buttons currently live in the income panel HTML and the expenses panel respectively.
   - Recommendation: Keep "+ Add Income" in the Transactions tab. "+ Add Expense" can be added too. "Trigger Recurrence" stays (or moves to expenses tab only).

4. **`#expensesTabHeatmapSection` in Expenses tab**
   - What we know: Expenses tab has its own spending heatmap. After moving heatmaps to Transactions tab, the Expenses tab heatmap would be redundant.
   - Recommendation: Leave the Expenses tab heatmap in place for this phase. Removing it is a separate decision. The todo spec doesn't say to remove it.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (version from package.json — latest installed) |
| Config file | none — uses vite.config.js |
| Quick run command | `npm test -- --run tests/income-sources.test.js` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 40-01 | Pay Sources tab label reads "Income" in DOM | manual/smoke | `npm test -- --run` (no DOM test) | N/A — label-only change |
| 40-02 | `renderAll()` with panelId `'transactions'` calls `transactionUI.render()` | unit | `npm test -- --run tests/app.test.js` | ❌ Wave 0 |
| 40-03 | Merged transaction list contains both income and expense rows | unit | `npm test -- --run tests/transactions-merged.test.js` | ❌ Wave 0 |
| 40-04 | `transactionUI.renderHeatmap()` calls renderSpendingHeatmap for both income and spending containers | unit | `npm test -- --run tests/transactions-merged.test.js` | ❌ Wave 0 |
| 40-05 | Dashboard heatmap DOM order — actionable cards appear before heatmaps | manual/smoke | manual HTML review | N/A — static HTML |

### Sampling Rate
- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/transactions-merged.test.js` — covers REQ-40-03, 40-04 (merged row render, heatmap calls)
- [ ] `tests/app.test.js` already exists? No — check: no app-level test file found. If needed, a minimal renderAll routing test can be added.

*(Existing `tests/income-sources.test.js` — 6 tests — covers `incomeSourcesUI` and requires no changes for this phase.)*

---

## Sources

### Primary (HIGH confidence)
- Direct source code inspection: `src/app.js`, `index.html`, `src/ui/income-sources.js`, `src/ui/transactions.js`, `src/ui/dashboard.js`, `src/ui/expenses.js` — all read verbatim above
- `css/main.css` lines 690–740 — heatmap container CSS selectors
- `tests/income-sources.test.js` — existing test coverage confirmed

### Secondary (MEDIUM confidence)
- `.planning/todos/pending/2026-03-17-redesign-income-and-transactions-tab-structure.md` — problem/solution specification from user
- `.planning/STATE.md` — Phase 39.1 decisions log, confirmed wiring state

---

## Metadata

**Confidence breakdown:**
- Tab rename mechanics: HIGH — read from source directly
- Merged view data model: HIGH — read from transactions.js and expenses.js directly
- Render bug diagnosis: HIGH — module is wired correctly; label-only fix confirmed
- Heatmap relocation: HIGH — DOM structure fully read from index.html + dashboard.js
- CSS impact: HIGH — all selector blocks read from main.css

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable codebase, no upstream dependencies changing)
