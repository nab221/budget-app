# Architecture Research

**Domain:** Vanilla JS PWA Budget App — v2.4 Feature Integration
**Researched:** 2026-03-07
**Confidence:** HIGH (based on direct codebase inspection)

---

## Context

This is an integration-focused research file, not a greenfield architecture document. The existing codebase is a mature Vanilla JS + Dexie.js + Chart.js v4 PWA. The three new features (ANAL-05 Heatmap, UX-03 Swipe, UX-04 Haptics) must integrate without refactoring existing modules.

---

## Standard Architecture

### System Overview (Existing)

```
┌──────────────────────────────────────────────────────────────────┐
│                          index.html                              │
│   Tab panels (dashboard, income, expenses, debts, …)            │
│   Static HTML canvas/table containers                            │
└──────────────┬───────────────────────────────────────────────────┘
               │ DOM manipulation / innerHTML
┌──────────────▼───────────────────────────────────────────────────┐
│                      src/app.js                                  │
│   Tab routing — window.app.renderAll() dispatches per-panel      │
│   Theme, Privacy, RecurrenceManager, FileSync init               │
└──────────┬──────────────────────────┬────────────────────────────┘
           │ import                   │ import
┌──────────▼──────────┐   ┌──────────▼──────────┐
│   src/ui/*.js        │   │  src/utils/*.js      │
│  dashboard.js        │   │  cashflow.js         │
│  transactions.js     │   │  finance.js          │
│  expenses.js         │   │  recurrence.js       │
│  charts.js           │   │  filtering.js        │
│  … (15 UI modules)   │   │  currency.js         │
└──────────┬──────────┘   └──────────────────────┘
           │ import
┌──────────▼──────────────────────────────────────┐
│            src/db/repository.js                  │
│   createBaseRepository() — add/update/delete     │
│   Specialized repos: incomeRepository,           │
│   recurrentExpenseRepository, oneOffExpense…     │
└──────────┬──────────────────────────────────────┘
           │ Dexie.js
┌──────────▼──────────────────────────────────────┐
│            src/db/schema.js (v16)                │
│   Tables: income, recurrentExpenses,             │
│   oneOffExpenses, dailyBalanceSnapshots,         │
│   balanceSnapshots, netWorthSnapshots, …         │
└─────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| `src/app.js` | Tab routing, global init, `window.app.renderAll()` | Entry point for all panel renders |
| `src/ui/dashboard.js` | Dashboard rendering, summary cards, chart wiring | Hosts existing analytics section |
| `src/ui/charts.js` | Chart.js chart factories (`_chartInstances` Map for destroy/re-render) | All Chart.js logic centralised here |
| `src/ui/expenses.js` | Expenses tab render, transaction row HTML, delete/status handlers | Rows are `<tr data-id="…">` inside `#expenseBody` |
| `src/ui/transactions.js` | Income tab render, transaction row HTML, delete/cleared handlers | Rows are `<tr data-id="…">` inside `#incBody` |
| `src/db/repository.js` | Dexie query layer; all DB reads/writes flow through here | `getByMonth()` is the primary query pattern |
| `src/utils/cashflow.js` | `getDailyRollingData()` — 410-point daily aggregation | Source of truth for balance data |

---

## Feature Integration Architecture

### ANAL-05: Monthly Spending Heatmap

#### Where It Lives

The heatmap belongs in the Dashboard panel's existing "Spending Analytics Section" (line 87 of `index.html`), alongside the doughnut and savings rate KPI. The current `grid2` layout (doughnut + savings rate) should expand to accommodate a full-width heatmap card below it, or replace the `grid2` with a three-card layout depending on screen size.

There is no separate "Analytics" tab. Adding one is possible but not required — the Dashboard already serves as the analytics hub.

#### Data Aggregation Needed

The heatmap needs daily spending totals for a 12-month window. The existing repositories do not expose this query. A new aggregation function is needed in `src/db/repository.js` (or a dedicated utility).

**Required query:** For each calendar day in the past 12 months, sum `oneOffExpenses.amount` + paid `recurrentExpenses.amount` where `date` (or `nextDate`) falls within a date range.

Dexie query pattern (both tables indexed on `date` / `nextDate`):

```js
// Pseudocode — actual implementation in repository.js
async function getSpendingByDay(fromDate, toDate) {
  const [oneOff, recurrent] = await Promise.all([
    db.oneOffExpenses.where('date').between(fromDate, toDate, true, true).toArray(),
    db.recurrentExpenses.where('nextDate').between(fromDate, toDate, true, true)
      .filter(i => i.status === 'paid')
      .toArray()
  ]);
  // Group by date, sum amounts in pence
  const byDay = {};
  for (const item of [...oneOff, ...recurrent]) {
    const d = item.date || item.nextDate;
    byDay[d] = (byDay[d] || 0) + item.amount;
  }
  return byDay; // { 'YYYY-MM-DD': pence }
}
```

The function returns a plain object `{ 'YYYY-MM-DD': penceTotal }` covering the requested window. The caller fills in zero for days with no data.

#### Chart Implementation: Custom Canvas, Not Chart.js

A GitHub-style calendar heatmap is fundamentally a grid of colored rectangles. Chart.js v4 (as registered in `charts.js`) does not support a matrix/heatmap chart type natively. The registered set is: `LineController`, `DoughnutController`, `CategoryScale`, `LinearScale` — no matrix controller exists.

Options:

1. **Custom `<canvas>` drawn with the 2D Context API** — matches the "no new dependencies" constraint. The implementation is self-contained, renders fast for 365 cells, and integrates cleanly with the theme system (read `--accent`, `--bg-alt` CSS vars via `getComputedStyle`).

2. **chartjs-chart-matrix plugin** — adds a matrix chart type to Chart.js v4. Requires registering `MatrixController` and `MatrixElement`. This introduces a new npm dependency and more Chart.js configuration complexity. Given the bar-chart failures documented in `debugging.md`, adding more Chart.js complexity is a risk.

**Recommendation: Custom canvas with 2D Context API.**

The implementation is ~80-100 lines, fully controllable, and avoids Chart.js plugin risks. It should live in `src/ui/charts.js` as `renderSpendingHeatmap(canvasId, dailyData, year)` — consistent with the existing chart factory pattern. The canvas element goes in `index.html` inside the Dashboard panel.

Year-over-Year comparison: render two heatmaps (current year, prior year) stacked vertically, or add a year-selector UI control above a single heatmap.

#### Files Changed

| File | Change Type | What |
|------|-------------|------|
| `src/db/repository.js` | Modified | Add `getSpendingByDay(fromDate, toDate)` function |
| `src/ui/charts.js` | Modified | Add `renderSpendingHeatmap(canvasId, dailyData, year)` |
| `src/ui/dashboard.js` | Modified | Wire data fetch + `renderSpendingHeatmap` call in `renderDashboard()` |
| `index.html` | Modified | Add `<canvas id="spendingHeatmapChart">` inside Dashboard panel |

---

### UX-03: Swipe-to-Clear / Swipe-to-Delete on Transaction Rows

#### DOM Structure of Transaction Rows

Both Income and Expenses tabs render transaction rows as `<tr data-id="…">` elements inside a `<tbody>`. The rows are created via `innerHTML` assignment in `renderIncome()` and in the expenses `render()` method. They are fully replaced on every render call.

Because rows are re-created on every render, event listeners attached directly to `<tr>` elements are destroyed with them. There are two valid approaches:

**Option A: Delegated touch events on `<tbody>`** — attach `touchstart`/`touchmove`/`touchend` listeners to `#incBody` and `#expenseBody` once (at init time), then detect which `<tr>` is under the touch via `e.target.closest('tr')`. This survives re-renders because the `<tbody>` persists.

**Option B: SwipeRow utility that attaches per-row on each render** — call `SwipeRow.attach(trElement, { onSwipeLeft, onSwipeRight })` after `innerHTML` assignment. Requires modifying the render methods.

**Recommendation: Option A — delegated listeners on `<tbody>`.**

This avoids modifying the render methods and aligns with how the existing delete handlers work (`window.deleteExpense`, `window.deleteTransaction` — global functions called from `onclick` attributes). The `<tbody>` elements (`#incBody`, `#expenseBody`) are static HTML containers that persist across renders.

#### SwipeManager Utility

Create `src/utils/swipe.js` — a reusable `SwipeManager` class.

Responsibilities:
- Accept a container element and callbacks `{ onSwipeLeft(row), onSwipeRight(row) }`
- Track `touchstart` → `touchmove` → `touchend` on the container
- Determine swipe direction and minimum distance threshold (e.g. 60px horizontal, less than 40px vertical drift to distinguish from scroll)
- Apply a CSS transform `translateX` during the gesture for visual feedback
- Call the appropriate callback on release
- Reset the transform after callback completion

```js
// src/utils/swipe.js — interface sketch
export class SwipeManager {
  constructor(containerEl, { onSwipeLeft, onSwipeRight, threshold = 60 }) { … }
  destroy() { … } // removeEventListeners — for future cleanup
}
```

The manager itself does not know about delete or clear semantics. It calls the provided callbacks with the `<tr>` element. The caller in `transactions.js` / `expenses.js` reads `tr.dataset.id` and dispatches to the existing `deleteTransaction` / `toggleIncCleared` / `deleteExpense` / `toggleExpCleared` handlers.

#### Attaching in Init

In `transactionUI.init()` (transactions.js) and `expensesUI.init()` (expenses.js), after the `<tbody>` exists in the DOM:

```js
import { SwipeManager } from '../utils/swipe.js';

// In transactionUI.init():
new SwipeManager(document.getElementById('incBody'), {
  onSwipeLeft: (tr) => window.deleteTransaction('income', parseInt(tr.dataset.id)),
  onSwipeRight: (tr) => window.toggleIncCleared(parseInt(tr.dataset.id), false)
});
```

Swipe-to-delete (left) and swipe-to-clear (right) are the two actions — matching the existing button actions already present in each row.

#### Visual Feedback

The `<tr>` element needs `overflow: hidden` (or a wrapper div) and a CSS transition for the translateX. A swipe hint background (red for delete on the left, green for clear on the right) can be shown via a pseudo-element or an absolutely-positioned div inside the row wrapper. This requires CSS changes in `main.css`.

#### Reconciliation Mode Guard

Swiping must be disabled when `reconciliationMode` is active (rows show checkboxes instead of buttons, and reconciled rows cannot be deleted). The SwipeManager callbacks should check reconciliationMode state before acting, or the manager should be paused via a `.setEnabled(bool)` method.

#### Files Changed

| File | Change Type | What |
|------|-------------|------|
| `src/utils/swipe.js` | New | `SwipeManager` class with delegated touch handling |
| `src/ui/transactions.js` | Modified | Instantiate SwipeManager in `init()` with income callbacks |
| `src/ui/expenses.js` | Modified | Instantiate SwipeManager in `init()` with expense callbacks |
| `css/main.css` | Modified | Swipe feedback CSS (transition, color hints, overflow hidden on rows) |

---

### UX-04: Haptic Feedback

#### API Availability

`navigator.vibrate()` is a browser API. It is supported in Chrome/Android and Firefox/Android. It is **not supported** in Safari (iOS) — `navigator.vibrate` is undefined on iOS Safari as of 2026. The implementation must feature-detect before calling.

#### Centralization: HapticManager Utility

Create `src/utils/haptics.js` — a thin wrapper with a feature-detected `vibrate(pattern)` function.

```js
// src/utils/haptics.js
const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const haptics = {
  // Short tap feedback — confirmations, selections
  tap:    () => supported && navigator.vibrate(10),
  // Success feedback — saved, paid, cleared
  success: () => supported && navigator.vibrate([10, 30, 10]),
  // Error/warning feedback — validation fail
  error:   () => supported && navigator.vibrate([50, 30, 50]),
  // Delete feedback — destructive action
  delete:  () => supported && navigator.vibrate(30),
};
```

A centralized module is correct here because:
- Feature detection runs once at import, not on every call
- Patterns can be tuned in one place
- No risk of calling undefined in non-supporting environments
- The module is trivially tree-shakeable if not imported

#### Action Sites

These are the existing handlers that should trigger haptics:

| Action | Handler Location | Haptic Pattern |
|--------|-----------------|----------------|
| Save income entry | `transactionUI.handleSave()` in `transactions.js` | `haptics.success()` |
| Save expense entry | `expensesUI.handleSaveExpense()` in `expenses.js` | `haptics.success()` |
| Delete income | `window.deleteTransaction` in `transactions.js` | `haptics.delete()` |
| Delete expense | `window.deleteExpense` in `expenses.js` | `haptics.delete()` |
| Mark expense paid | `window.toggleExpenseStatus` in `expenses.js` | `haptics.tap()` |
| Mark all paid | `expensesUI.handleMarkAllPaid()` in `expenses.js` | `haptics.success()` |
| Toggle cleared (recon) | `window.toggleExpCleared` / `window.toggleIncCleared` | `haptics.tap()` |
| Swipe gesture confirm | `SwipeManager` callbacks in `swipe.js` | `haptics.delete()` or `haptics.tap()` |
| Form validation fail | `handleSave` / `handleSaveExpense` before early return | `haptics.error()` |

Haptics should NOT fire on read-only actions (rendering, navigation, search). They should fire only on data-mutating or destructive confirmations.

#### Files Changed

| File | Change Type | What |
|------|-------------|------|
| `src/utils/haptics.js` | New | `haptics` object with feature-detected vibrate patterns |
| `src/ui/transactions.js` | Modified | Import `haptics`, call at save/delete/toggle sites |
| `src/ui/expenses.js` | Modified | Import `haptics`, call at save/delete/toggle/markPaid sites |
| `src/utils/swipe.js` | Modified | Import `haptics`, call `haptics.delete()` / `haptics.tap()` in gesture callbacks |

---

## Data Flow

### Heatmap Data Flow

```
renderDashboard() in dashboard.js
    |
    +--> getSpendingByDay(fromDate, toDate) in repository.js
    |        |
    |        +--> db.oneOffExpenses (Dexie range query by date)
    |        +--> db.recurrentExpenses (Dexie range query by nextDate, filter paid)
    |        |
    |        <-- { 'YYYY-MM-DD': penceTotal }
    |
    +--> renderSpendingHeatmap('spendingHeatmapChart', dailyData, year) in charts.js
             |
             +--> canvas.getContext('2d')
             +--> getComputedStyle() for theme colors
             +--> 365 fillRect() calls, color-scaled by spend amount
```

### Swipe Gesture Flow

```
User touches <tr> inside #incBody / #expenseBody
    |
SwipeManager (delegated listener on <tbody>)
    |
    +--> touchstart: record startX, startY, target <tr>
    +--> touchmove:  compute deltaX, apply translateX CSS
    +--> touchend:   if |deltaX| > threshold and |deltaY| < drift-limit:
    |        |
    |        +--> swipeLeft  --> haptics.delete() --> window.deleteExpense(id)
    |        +--> swipeRight --> haptics.tap()    --> window.toggleExpCleared(id)
    |
    +--> reset translateX to 0
```

### Haptic Flow

```
User action (button click / swipe gesture)
    |
Handler (transactions.js / expenses.js / swipe.js)
    |
haptics.success() / haptics.delete() / haptics.tap() / haptics.error()
    |
navigator.vibrate(pattern)  [no-op if unsupported]
```

---

## Recommended Project Structure Changes

```
src/
├── db/
│   ├── schema.js               # No change (v16 schema sufficient)
│   └── repository.js           # MODIFIED: add getSpendingByDay()
├── ui/
│   ├── dashboard.js            # MODIFIED: heatmap data fetch + render call
│   ├── charts.js               # MODIFIED: add renderSpendingHeatmap()
│   ├── transactions.js         # MODIFIED: SwipeManager init, haptics import
│   ├── expenses.js             # MODIFIED: SwipeManager init, haptics import
│   └── … (no other UI changes)
└── utils/
    ├── swipe.js                # NEW: SwipeManager class
    ├── haptics.js              # NEW: haptics object
    └── … (existing utils unchanged)
```

No new DB schema version is required. All data is derivable from existing `oneOffExpenses` and `recurrentExpenses` tables via date-range queries.

---

## Architectural Patterns

### Pattern 1: Chart Factory with Instance Map

**What:** Each chart render function checks `_chartInstances.has(canvasId)`, destroys the existing Chart.js instance, then creates a new one and stores it. This prevents "Canvas already in use" errors.

**When to use:** For any new Chart.js-based chart added to `charts.js`.

**Trade-offs:** Simple and reliable. Slight overhead from full destroy/recreate on every render. Acceptable at this scale.

**Note for heatmap:** The custom canvas implementation does not use Chart.js, so it does not use `_chartInstances`. Instead, the render function clears the canvas with `ctx.clearRect()` before redrawing. No destroy/create cycle needed.

### Pattern 2: Delegated Event Handling on Persistent Containers

**What:** Event listeners are attached to stable container elements (`<tbody>`, `<table>`) once at `init()` time. Event delegation (`e.target.closest('tr')`) identifies the actual target.

**When to use:** Any time row-level interaction is needed on dynamically re-rendered lists.

**Trade-offs:** Listeners survive re-renders without re-attachment. Requires discipline to guard against acting on non-row clicks (null check on `closest()` result).

**This is the correct approach for SwipeManager.** The existing delete handlers already follow a similar pattern via global `window.deleteExpense` functions called from `onclick` attributes.

### Pattern 3: Feature-Detected Utility Wrapper

**What:** A utility module checks for API availability at import time and exports safe wrapper functions that silently no-op when the API is absent.

**When to use:** Browser APIs with incomplete cross-browser support (`navigator.vibrate`, `navigator.share`, etc.).

**Trade-offs:** Zero runtime errors on unsupported platforms. Slightly harder to test (requires mocking `navigator.vibrate`). Worth it for any capability-gated Web API.

---

## Anti-Patterns

### Anti-Pattern 1: Attaching Swipe Listeners Inside innerHTML Assignment

**What people do:** Call `attachSwipeToRow(tr)` inside the `.map()` that builds HTML strings, or add a `data-swipe` attribute and re-query after innerHTML.

**Why it's wrong:** The render methods use `innerHTML = safeHTML...` which replaces all DOM nodes. Any listeners attached to old `<tr>` elements are orphaned. The re-query approach adds a post-render sweep that couples swipe logic to render timing.

**Do this instead:** Attach once to the persistent `<tbody>` via delegated listeners in `init()`. The SwipeManager never needs to be re-initialized on render.

### Anti-Pattern 2: Using Chart.js for the Heatmap

**What people do:** Import `chartjs-chart-matrix`, register `MatrixController`, and configure a matrix chart.

**Why it's wrong:** Adds a new npm dependency, increases bundle size, and introduces Chart.js plugin compatibility risk. The project already has documented bar-chart failures (CategoryScale bar-width issues). A custom canvas draw is simpler, faster, and fully predictable.

**Do this instead:** Draw directly with `canvas.getContext('2d')` inside `renderSpendingHeatmap()` in `charts.js`. Approximately 80 lines, no dependencies.

### Anti-Pattern 3: Calling navigator.vibrate Without Feature Detection

**What people do:** Call `navigator.vibrate(100)` directly inline at action sites.

**Why it's wrong:** `navigator.vibrate` is undefined on iOS Safari. The call throws a TypeError and breaks the action handler on iPhone.

**Do this instead:** Import `haptics` from `src/utils/haptics.js`. The feature detection is done once at module load time.

### Anti-Pattern 4: Firing Haptics on Read / Navigation Actions

**What people do:** Add haptic feedback to tab clicks, month navigation, search input, or filter changes.

**Why it's wrong:** Haptic feedback on non-committal actions feels aggressive and drains battery. Users expect haptics on confirmation of irreversible or significant actions, not on passive browsing.

**Do this instead:** Limit haptics to: save (data mutation), delete (destructive), status toggle (state commitment), and swipe-to-action (gesture confirmation).

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `dashboard.js` → `repository.js` | Direct async call to `getSpendingByDay()` | New function, same import pattern as existing repos |
| `dashboard.js` → `charts.js` | Direct call to `renderSpendingHeatmap()` | New named export from charts.js |
| `transactions.js` → `swipe.js` | Import `SwipeManager`, instantiate in `init()` | One-way; SwipeManager calls back via provided callbacks |
| `expenses.js` → `swipe.js` | Import `SwipeManager`, instantiate in `init()` | Same pattern as transactions.js |
| `swipe.js` → `haptics.js` | Import `haptics`, call on gesture completion | SwipeManager owns gesture haptics |
| `transactions.js` → `haptics.js` | Import `haptics`, call at save/delete/toggle sites | Action handler owns those haptics |
| `expenses.js` → `haptics.js` | Import `haptics`, call at save/delete/toggle/markPaid sites | Action handler owns those haptics |

### No New External Services

All three features are fully client-side:
- Heatmap: Dexie queries + canvas 2D API
- Swipe: Touch Events API (standard)
- Haptics: Vibration API (`navigator.vibrate`)

No new npm packages are required if the custom canvas approach is taken for the heatmap.

---

## Build Order

Dependencies between the three features determine implementation order:

1. **`src/utils/haptics.js` (UX-04, first)** — No dependencies. Required by both `swipe.js` and the action handlers. Build first so it can be imported immediately.

2. **`src/utils/swipe.js` (UX-03, second)** — Depends on `haptics.js`. Build second. No DB or render dependencies.

3. **`src/ui/transactions.js` + `src/ui/expenses.js` modifications (UX-03 + UX-04 together)** — Attach `SwipeManager` and add `haptics` calls. These two files can be modified in parallel. Swipe and haptics modifications in these files are independent of the heatmap work.

4. **`src/db/repository.js` + `getSpendingByDay()` (ANAL-05, prerequisite)** — The Dexie query function. No UI dependencies. Can be built in parallel with step 3.

5. **`src/ui/charts.js` + `renderSpendingHeatmap()` (ANAL-05, depends on step 4 design)** — Canvas draw function. Can be stubbed with test data before repository is complete.

6. **`src/ui/dashboard.js` + `index.html` changes (ANAL-05, last)** — Wire heatmap into the dashboard render pipeline and add canvas element to HTML. Depends on steps 4 and 5.

```
haptics.js  ──────────────────────────────────────────────────────────┐
                                                                       ▼
swipe.js (imports haptics) ──────────────> transactions.js modifications
                           ──────────────> expenses.js modifications

repository.js (getSpendingByDay) ──────> charts.js (renderSpendingHeatmap) ──────> dashboard.js + index.html
```

---

## Scaling Considerations

This is a single-user PWA. Scaling does not apply. The heatmap query (365 days, two Dexie range queries) will return at most a few hundred records in typical use — well within IndexedDB performance bounds.

---

## Sources

- Direct code inspection: `src/app.js`, `src/ui/dashboard.js`, `src/ui/charts.js`, `src/ui/expenses.js`, `src/ui/transactions.js`, `src/db/repository.js`, `src/db/schema.js`, `index.html`
- MDN Vibration API: `navigator.vibrate` is undefined in Safari (iOS) — confirmed via MDN compatibility data
- Chart.js v4 registered components: verified from `src/ui/charts.js` import block (LineController, DoughnutController, CategoryScale, LinearScale — no MatrixController)
- Project memory: bar chart failure history — informs recommendation against chartjs-chart-matrix

---
*Architecture research for: Budget App v2.4 — Heatmap, Swipe, Haptics integration*
*Researched: 2026-03-07*
