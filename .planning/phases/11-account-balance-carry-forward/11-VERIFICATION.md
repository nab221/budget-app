---
phase: 11-account-balance-carry-forward
verified: 2026-03-01T18:20:00Z
status: human_needed
score: 10/10 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "Recurrent expenses now deducted correctly in all projected months (finance.js live getRecurrent uses .toArray())"
    - "app:refresh event dispatched after triggerBalanceRecalc completes (repository.js line 40)"
    - "Balance Start Date input kept as type=month — consistent with YYYY-MM schema, no code change needed (keep-month decision)"
    - "New Vitest test added: 'deducts recurrent expenses in projected months even when nextDate is in the current month' — passes"
    - "Full test suite: 93 tests pass, 0 failures (7 test files)"
  gaps_remaining:
    - "BAL-01 through BAL-04 still absent from REQUIREMENTS.md — no definitions and no traceability rows for Phase 11"
  regressions: []
gaps:
  - truth: "BAL-01 through BAL-04 requirements are traceable in REQUIREMENTS.md"
    status: failed
    reason: "BAL-01, BAL-02, BAL-03, BAL-04 are referenced in all three plan frontmatter files and in ROADMAP.md but do not appear anywhere in REQUIREMENTS.md. Plan 11-03 fixed three code bugs but did not update REQUIREMENTS.md. The traceability table ends at Phase 10 (PAY-08). Coverage count reads '88 total' but Phase 11 adds 4 more requirements that are entirely absent from the registry."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "No BAL-01 through BAL-04 entries in requirements list or traceability table; Phase 11 row absent from coverage table; count reads 88 not 92"
    missing:
      - "Add BAL-01 through BAL-04 definitions to REQUIREMENTS.md under a new 'Account Balance Carry-Forward' section"
      - "Add BAL-01, BAL-02, BAL-03, BAL-04 rows to the Traceability table with 'Phase 11 | Complete'"
      - "Add Phase 11 row to the coverage table"
      - "Update requirement count from 88 to 92 in the Coverage section"
human_verification:
  - test: "Open the app, go to Settings, set a Balance Start Date to a past month (e.g. 2026-01), click Save"
    expected: "Status reads 'Balance chain recalculated from 2026-01'. Dashboard shows Account Balance panel with a running balance card and 3-month forecast card."
    why_human: "DOM rendering and localStorage persistence cannot be tested without a browser"
  - test: "On the dashboard, verify the balance chart renders below the balance card"
    expected: "A 90-day Chart.js line chart appears with solid line for actuals and dashed line for projections"
    why_human: "Canvas rendering requires a browser"
  - test: "Add a large one-off expense in a future month that would make the balance go negative"
    expected: "Balance card background turns red and text reads 'Projected negative balance ahead'"
    why_human: "CSS alert state requires browser visual inspection"
  - test: "Reload the page after setting Balance Start Date"
    expected: "Settings input still shows the saved date; dashboard balance panel is populated on startup recalc"
    why_human: "localStorage persistence and page reload behaviour requires a browser"
  - test: "Add or edit an income entry (any amount). Do NOT switch tabs."
    expected: "The Account Balance card and chart on the dashboard update automatically within a second or two — no tab switch required."
    why_human: "The app:refresh auto-refresh wiring (triggerBalanceRecalc -> window.dispatchEvent -> refreshDashboard) requires a live browser session to verify the DOM update timing"
  - test: "Check the balance projection for next month after confirming a monthly recurrent expense exists"
    expected: "The projected month's expenseTotal includes the standing recurrent expense amount (not zero)"
    why_human: "Verifying the projected month deducts recurrent items requires a browser with real IndexedDB data"
---

# Phase 11: Account Balance Carry-Forward — Verification Report

**Phase Goal:** Users can see a running account balance panel that starts from a stated opening balance, accumulates income, and deducts expenses month by month — enabling future-month forecasting ("Do I have enough money to pay for upcoming expenses?")
**Verified:** 2026-03-01T18:20:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure plan 11-03 (recurrent projection fix, auto-refresh dispatch, start-date input decision)

---

## Re-Verification Summary

Plan 11-03 closed three of the four gaps identified in the initial verification:

| Gap | Description | Result |
|-----|-------------|--------|
| Code: Recurrent projection | Live `getRecurrent` used `.where('nextDate').startsWith()`, returned `[]` for future months | CLOSED — now uses `.toArray()` |
| Code: Auto-refresh | `triggerBalanceRecalc` never dispatched `app:refresh`, dashboard did not update on mutation | CLOSED — `window.dispatchEvent(new CustomEvent('app:refresh'))` added at line 40 |
| Decision: Start Date input | Ambiguity over `type="month"` vs `type="date"` | RESOLVED — `keep-month` decision, no code change |
| Docs: BAL-XX in REQUIREMENTS.md | BAL-01 to BAL-04 absent from requirements registry | STILL OPEN — plan 11-03 was code-only |

**Test suite:** 93 tests, 0 failures (7 test files) — confirmed by running `npm test -- --run`.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Database includes a v9 schema with a `balanceSnapshots` table | VERIFIED | `src/db/schema.js`: `db.version(9)` defines `balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal'` |
| 2 | The "Opening Balance" category is present in the database (seeded idempotently) | VERIFIED | `src/db/repository.js` lines 207-220: `ensureOpeningBalanceCategory` creates it with `group:'system'` if absent; called on every init |
| 3 | `calculateBalanceChain` correctly sums income and expenses, carries closing to next month's opening | VERIFIED | `src/utils/finance.js` lines 233-335: full implementation; 22 unit tests in `finance.test.js` all pass (93 total) |
| 4 | Projected months correctly deduct recurrent expenses even when `nextDate` is in the current month | VERIFIED | `finance.js` line 267-268: `getRecurrent = async (_monthStr) => db.recurrentExpenses.toArray()` — returns all standing commitments regardless of `nextDate`; new test at `finance.test.js` line 266 passes |
| 5 | Dashboard auto-refreshes after income or expense mutations (no tab switch required) | VERIFIED | `repository.js` line 40: `window.dispatchEvent(new CustomEvent('app:refresh'))` inside `try` block after `calculateBalanceChain` resolves; `app.js` line 66: listener calls `refreshDashboard()` |
| 6 | Dashboard shows today's balance and a 3-month forecast, with red alert for negative projections | VERIFIED | `src/ui/dashboard.js` lines 310-404: `renderBalancePanel` renders running balance + forecast card; `isAlertState` logic applies red background when any projected snapshot's `closingBalance < 0` |
| 7 | A 90-day trend chart renders with solid lines for actuals and dashed lines for projections | VERIFIED | `src/ui/charts.js` lines 177-270: `renderBalanceChart` implements two Chart.js datasets; projection dataset uses `borderDash:[6,4]` |
| 8 | User can configure and persist a Balance Start Date in Settings using a month picker | VERIFIED | `index.html` line 368: `<input type="month" id="balanceStartDate">`; `src/app.js` lines 166-195: save handler persists to `localStorage` key `budget_balance_start_date`; `src/utils/storage.js` line 12: `BALANCE_START_DATE_KEY` constant exported |
| 9 | Startup recalculates the balance chain from the saved start date | VERIFIED | `src/app.js` lines 144-148: reads `BALANCE_START_DATE_KEY` from localStorage; fires `calculateBalanceChain(savedBalanceStart, 3)` if present |
| 10 | BAL-01 through BAL-04 are defined and traceable in REQUIREMENTS.md | FAILED | `REQUIREMENTS.md` contains no BAL-XX entries — neither requirement definitions nor traceability rows for Phase 11; coverage count still reads 88 |

**Score:** 9/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.js` | v9 `balanceSnapshots` table | VERIFIED | v9 schema with correct index definition |
| `src/db/repository.js` | `balanceSnapshotRepository` + seeding logic + `app:refresh` dispatch | VERIFIED | Lines 640-701: full repository; `triggerBalanceRecalc` dispatches `app:refresh` at line 40 |
| `src/utils/finance.js` | `calculateBalanceChain` with fixed live `getRecurrent` | VERIFIED | Line 267-268: `getRecurrent` uses `.toArray()` (fixed from `.where('nextDate').startsWith()`); full engine lines 233-335 |
| `src/utils/finance.test.js` | New test for projected-month recurrent deduction | VERIFIED | Lines 266-296: "deducts recurrent expenses in projected months even when nextDate is in the current month" — passes |
| `src/ui/dashboard.js` | `renderBalancePanel` wired into `renderDashboard` | VERIFIED | Lines 310-404: full panel implementation; called unconditionally inside `renderDashboard` |
| `src/ui/charts.js` | `renderBalanceChart` with actual/projection split | VERIFIED | Lines 177-270: two-dataset Chart.js chart; actual dataset nulls out projection months, projection dataset uses `borderDash` |
| `src/app.js` | Settings save handler + startup recalc + `app:refresh` listener | VERIFIED | Lines 144-148: startup recalc; lines 166-195: save handler; line 66: `app:refresh` listener wired to `refreshDashboard()` |
| `index.html` | Balance Start Date input (`type="month"`) in Settings | VERIFIED | Line 368: `<input type="month" id="balanceStartDate">` and `<button id="saveBalanceStartBtn">` present |
| `src/utils/storage.js` | `BALANCE_START_DATE_KEY` constant exported | VERIFIED | Line 12: `export const BALANCE_START_DATE_KEY = 'budget_balance_start_date'` |
| `tests/balance/balance-ui.test.js` | 14 unit tests for balance UI logic | VERIFIED | 14 tests across 5 describe blocks; all pass |
| `.planning/REQUIREMENTS.md` | BAL-01 to BAL-04 defined and traceable | FAILED | No BAL-XX entries exist anywhere in the file |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `incomeRepository.add/update/delete` | `calculateBalanceChain` | `triggerBalanceRecalc` (fire-and-forget) | WIRED | `repository.js` lines ~278, 289, 297: all three mutation methods call `triggerBalanceRecalc(date).catch(() => {})` |
| `oneOffExpenseRepository.add/update/delete` | `calculateBalanceChain` | `triggerBalanceRecalc` (fire-and-forget) | WIRED | `repository.js` lines ~406, 416, 424: all three mutation methods call `triggerBalanceRecalc(date).catch(() => {})` |
| `triggerBalanceRecalc` | `window app:refresh` | `window.dispatchEvent(new CustomEvent('app:refresh'))` | WIRED | `repository.js` line 40: dispatch inside `try` block after `calculateBalanceChain` resolves |
| `window app:refresh` | `refreshDashboard()` | event listener in `app.js` | WIRED | `app.js` line 66: `window.addEventListener('app:refresh', () => { refreshDashboard(); })` |
| `calculateBalanceChain` live `getRecurrent` | `db.recurrentExpenses.toArray()` | direct closure | WIRED (fixed) | `finance.js` line 267-268: `getRecurrent = async (_monthStr) => db.recurrentExpenses.toArray()` — returns all items, not filtered by `nextDate` |
| `renderDashboard` | `renderBalancePanel` | direct call | WIRED | `dashboard.js`: `renderBalancePanel()` called unconditionally |
| `renderBalancePanel` | `renderBalanceChart` | direct call after innerHTML set | WIRED | `dashboard.js`: `renderBalanceChart('balanceChart', snapshots)` |
| `app.js` startup | `calculateBalanceChain` | `localStorage.getItem(BALANCE_START_DATE_KEY)` | WIRED | `app.js` lines 144-148: fires chain recalculation if saved start date exists |
| `saveBalanceStartBtn` handler | `balanceSnapshotRepository.deleteFrom` + `calculateBalanceChain` | async click handler | WIRED | `app.js` lines 183-186: deletes all snapshots then recalculates from new start date |
| `calculateBalanceChain` (live path) | `balanceSnapshotRepository.save` | lazy `import('../db/repository.js')` | WIRED | `finance.js` lines 260-263: lazy import resolves at call time, avoiding circular dependency |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BAL-01 | 11-01-PLAN.md | Opening balance transaction creates correct starting point | SATISFIED (code) / NOT DOCUMENTED | `calculateBalanceChain` seeds `openingBalance` from "Opening Balance" category entry in the start month (`finance.js` lines 302-303); unit tested. Not defined in REQUIREMENTS.md. |
| BAL-02 | 11-01-PLAN.md | Closing balance of one month becomes opening balance of next | SATISFIED (code) / NOT DOCUMENTED | `finance.js` line 331: `runningOpeningBalance = closingBalance` at end of each month loop; proven by carry-forward unit tests. Not defined in REQUIREMENTS.md. |
| BAL-03 | 11-01-PLAN.md | Balance chain engine with projections | SATISFIED (code) / NOT DOCUMENTED | `calculateBalanceChain` with `horizonMonths` parameter covers actuals and projections; recurrent projection bug fixed in 11-03. Not defined in REQUIREMENTS.md. |
| BAL-04 | 11-02-PLAN.md | Dashboard UI: balance panel, chart, settings persistence | SATISFIED (code) / NOT DOCUMENTED | `renderBalancePanel`, `renderBalanceChart`, settings input, save handler, and startup recalc all implemented. Not defined in REQUIREMENTS.md. |

**Critical gap:** BAL-01 through BAL-04 are referenced in plan frontmatter (11-01, 11-02, 11-03) but do not appear anywhere in REQUIREMENTS.md. The traceability table ends at Phase 10 (PAY-08). Phase 11 has no entry in the coverage table. The requirement count states "88 total" but the codebase implements 4 additional requirements.

---

## Anti-Patterns Found

No anti-patterns detected in any Phase 11 file:

- No TODO/FIXME/HACK/PLACEHOLDER comments in modified files
- No stub implementations (`return null`, `return {}`, `return []`)
- All `triggerBalanceRecalc` call sites include `.catch(() => {})` — no silent failures
- No dead/orphaned exports
- `window.dispatchEvent` call is inside `try` block — only fires on successful recalculation (correct)

---

## Human Verification Required

### 1. Balance Panel Renders on Dashboard

**Test:** Open the app, navigate to Settings, enter a past month (e.g. `2026-01`) in "Start Month", click Save.
**Expected:** Status message reads "Balance chain recalculated from 2026-01". Navigate to Dashboard — an "Account Balance" section appears above the budget progress grid, showing a "Running Balance" card and a "3-Month Forecast" card.
**Why human:** DOM insertion (`section` created and prepended) cannot be verified programmatically without a browser runtime.

### 2. 90-Day Trend Chart Renders

**Test:** With balance data loaded (from test 1 above), observe the dashboard below the balance cards.
**Expected:** A Chart.js line chart appears. Actual months render as a solid blue line with area fill; projected months render as a dashed blue line with no fill.
**Why human:** Canvas rendering requires a browser.

### 3. Negative Balance Alert State

**Test:** Add a large one-off expense (e.g. £50,000) dated in a future month (e.g. next month). Refresh the dashboard.
**Expected:** The Account Balance card background turns red and a warning line "Projected negative balance ahead" appears in red below the running balance figure.
**Why human:** CSS/visual state change requires visual inspection in a browser.

### 4. Settings Persistence Across Reloads

**Test:** Set a Balance Start Date and save. Close the browser tab and reopen the app.
**Expected:** The Settings "Start Month" input still shows the previously saved date. The dashboard balance panel is populated on load (startup recalc fires from the saved date).
**Why human:** localStorage persistence and page reload behaviour requires a live browser session.

### 5. Auto-Refresh After Income Mutation (11-03 gap fix)

**Test:** With a Balance Start Date set, add or edit an income entry. Do NOT switch tabs.
**Expected:** The Account Balance card and trend chart on the dashboard update automatically within a few seconds — the running balance reflects the new income without any manual navigation.
**Why human:** The `app:refresh` dispatch wiring (`triggerBalanceRecalc` -> `window.dispatchEvent` -> `refreshDashboard`) requires a live browser session to confirm DOM update timing.

### 6. Recurrent Expense Deducted in Projected Month (11-03 gap fix)

**Test:** With at least one recurrent expense configured (e.g. £800/month rent), set a Balance Start Date and save. View the balance projection for next month.
**Expected:** The projected month's expense total includes the recurrent expense amount (not zero). The closing balance decreases by the recurrent expense amount each projected month.
**Why human:** Verifying the projected month deducts recurrent items from the live IndexedDB requires a browser with real data.

---

## Gaps Summary

One gap remains from the initial verification: **BAL-01 through BAL-04 are absent from REQUIREMENTS.md**.

Plan 11-03 was explicitly scoped to three code bugs (recurrent projection, auto-refresh dispatch, start-date input decision). It did not include updating REQUIREMENTS.md. The code fully and correctly implements all four requirements — the engine, carry-forward logic, recurrent projection fix, auto-refresh, and UI are all present, substantive, and wired. However, the requirements registry was never updated.

The fix is purely additive — no code changes are needed:
1. Add four requirement definitions (`BAL-01` through `BAL-04`) to REQUIREMENTS.md under a new "Account Balance Carry-Forward" section.
2. Add four rows to the Traceability table mapping each BAL-XX to Phase 11 with status "Complete".
3. Add Phase 11 to the coverage table.
4. Update the requirement count from 88 to 92.

All nine automated truths about the codebase pass. Six human-verification items require browser testing (four carried from initial verification, two new items confirming the 11-03 fixes work end-to-end in the browser).

---

_Verified: 2026-03-01T18:20:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after gap-closure plan 11-03_
