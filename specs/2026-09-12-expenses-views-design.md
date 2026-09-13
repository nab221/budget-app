# Expenses tab — Table and By-date views

**Status:** Implemented 2026-09-12 (plan: `specs/2026-09-12-expenses-views-plan.md`).
**Relates to:** `REFACTOR-SPEC.md` Amendment 2026-07-07 (expenses-first), §4.3 Debts,
`DASHBOARD-PLAN.md` (the Dashboard keeps its calendar and next-payments list; this
adds scannable views to the tab where the rows are edited).

## 1. Goal

The Expenses tab shows every committed outgoing as a card. Cards are good for editing
one thing but poor for comparing many. The owner wants to **see and compare what is
committed faster than scanning cards** (chosen over "left after income" and
"category caps" — both explicitly out of scope here). No data-model change: every
new figure is computed at read time from the existing schedule and debt records.

## 2. Structure

- The tab keeps its header, summary strip (Period control + "Going out" + average),
  Add / Import / edit / delete flows and modals unchanged.
- A second segmented control, **View**, sits in the summary strip beside Period with
  three options: **Cards · Table · By date**. It reuses `PeriodSelector` with custom
  options.
- **Cards** is the current page, unchanged.
- **Table** and **By date** replace only the sections below the summary strip. The
  Period control applies to all three views; the two totals stay visible in every view.
- Editing happens only in Cards. Table and By date are read-only: clicking a row's
  name switches to Cards and scrolls that card into view with a short highlight.
  Each `DebtCard` / `ExpenseCard` / childcare card gets a stable DOM id for this.

## 3. Table view

Two panels, each with a title, sortable column headers and a totals row.

### 3.1 Debts table

One row per credit card and loan.

| Column | Source |
|---|---|
| Name | debt row |
| Type | Card / Loan |
| Balance | `balancePence` |
| Rate | `effectiveApr` (insights.js) today. A card in its 0% promo shows 0% with the existing "0% until date" badge and the post-promo rate in the title tooltip. |
| Payment | card: `resolveMinPayment` (override wins); loan: fixed monthly payment |
| Interest / month | `monthlyInterestPence(...).byDebt` (insights.js) — same as Dashboard |
| Utilisation | inline bar + %, cards with a limit only; blank otherwise |
| Payoff | month the debt clears under the persisted Payoff strategy and extra: cards from `simulatePayoff(...).resultsByDebt`, loans from `simulateLoanPayoff`. Uses the existing adapters in `src/ui/payoff/payoffModel.js`; if an adapter is missing it is added there. |
| Next payment | `nextDebtPayment`, with the "shifted" tag |

Default sort: Rate descending. Totals row: Balance, Payment, Interest / month.

### 3.2 Expenses table

One row per recurring bill and one per childcare deposit.

| Column | Source |
|---|---|
| Name | bill label / deposit label |
| Category | category name, "Uncategorised", or "Childcare" |
| Amount | `amountPence` |
| Frequency | the same suffix map `ExpenseCard` uses |
| Per month | `annualToPeriodPence(annualisedBillPence(bill), 'month')` (childcare: amount) |
| Per year | `annualisedBillPence(bill)` |
| Next payment | `nextBillOccurrence` / `nextChildcareDeposit`, with "shifted" tag |
| Status | Active / Paused / Ended. Paused and Ended rows are muted and excluded from totals, as today. |

Default sort: Per month descending. Totals row: Per month, Per year.

### 3.3 Sorting

Every column header is a `<button>`: first click sorts ascending, second descending,
with an arrow indicator and `aria-sort`. Sort state is component state (not persisted).
Money and numeric columns sort numerically; text columns by `localeCompare`; empty
values sort last in both directions.

## 4. By-date view

One list of every occurrence in the selected period from `spendingOccurrences`
(spending.js) — the same function behind the "Going out" total, so the list and the
headline always agree.

- **Rows:** date, name, kind (Card / Loan / Bill + category / Childcare), amount,
  running total for the period. Adjusted dates carry the "shifted" tag.
- **Day groups:** rows sit under a day heading with the day's subtotal, matching the
  Dashboard's `PaymentDayGroup` look.
- **Today marker:** a divider row at today. Days before it are muted. A footer shows
  **Gone out so far**, **Still to go**, and the period total. (Occurrences dated
  today count as "still to go".)
- **Year period:** days roll up into month headings with the month total; a month
  expands to its days on click. Expanded state is component state.
- Read-only; name click jumps to the card. Nothing is confirmed or ticked off.

## 5. Persistence

One new settings key: `expensesView` ∈ `'cards' | 'table' | 'by-date'`, default
`'cards'`, added to `SETTINGS_DEFAULTS` with `getExpensesView` / `setExpensesView`
beside the Payoff getters. The tab reads it on load and writes it on every switch.
Sort order and expanded months are never persisted.

## 6. Files

All under `src/ui/expenses/`:

- `tableRows.js` — pure: builds debt-row and expense-row objects (pence) from the
  engine-shaped data (`mapDebtsToPence`, `mapBillsToPence`,
  `childcareDepositsFromChildren`) plus categories, strategy and extra.
- `sortRows.js` — pure: column sort helper shared by both tables.
- `byDate.js` — pure: groups occurrences by day, adds running totals, splits at
  today, rolls days into months.
- `DebtsTable.jsx`, `ExpensesTable.jsx`, `ByDateList.jsx` — components.
- `Expenses.jsx` — gains view state, the View control, and jump-to-card highlight.
- `src/db/settings.js` — the new key and accessors.

No engine changes. Money is pence everywhere until `<Money>`.

## 7. Tests

- Unit (`tableRows.test.js`, `sortRows.test.js`, `byDate.test.js`): effective rate
  during and after a promo; utilisation with no limit / over limit; loan rows have no
  utilisation; default sort orders; numeric vs text sort and empty-last; running
  totals; the today split (today counts as still-to-go); month roll-up for the year
  period; paused/ended rows excluded from totals.
- Render (`expensesRender.test.jsx`): switching views; the setting persisting across
  a remount; both tables render totals; header click toggles sort; name click returns
  to Cards with that card in the document; By date footer figures add up to the
  period total.

## 8. Non-goals

- No income comparison or "left this month" figure (owner chose option A).
- No category caps / envelopes.
- No actions in tables (edit, delete, update balance stay on cards).
- No new stored rows of any kind.
