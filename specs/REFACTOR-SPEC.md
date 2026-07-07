# Budget App v4 — Refactor Specification

**Status:** Approved by owner (interview conducted 2026-07-07)
**Supersedes:** everything in `.planning/` (GSD milestones v1.0–v3.1). Those documents are
historical reference only — none of their requirements carry over unless restated here.

---

## ⚠ Amendment 2026-07-07 — "Expenses-first" redirection (post-PR #25)

After testing PR #25 the owner redirected the product. Where this amendment conflicts
with the sections below, **the amendment wins**. The goal is no longer a ledger of what
happened; it is a live picture of **how much is going out per week / month / year**.

- **The app is not a record of transactions.** The transactions ledger UI, "Mark paid"
  bill/debt confirmations, and the whole *Money In & Out* tab are **removed**. The
  `transactions` table stays in the schema (dormant, still in backups) but nothing reads
  or writes it from the UI.
- **The Debts tab is now the *Expenses* tab** and is the heart of the app. It holds
  *every* committed outgoing as a card/panel: credit cards, loans, **and all other
  recurring expenses** (subscriptions, utilities, groceries…), grouped by category.
  What distinguishes credit cards and loans from other expenses is **interest and the
  payoff strategy** (Payoff tab unchanged). A recurring expense card simply shows
  **"£xx.xx at [next payment date]"**, computed at read time from its frequency —
  no confirmations, no advancing of stored dates.
- **Period totals** — the main figure: total committed spending for the selected
  calendar **week / month / year**, counting actual occurrences in that window (credit
  card = computed minimum payment, loan = fixed payment), with a normalised long-run
  average alongside (weekly ≈ ×52⁄12 per month). Engine: `src/engine/spending.js`.
- **Dashboard is minimal** pending a later graphics redesign: the three period totals
  plus the next upcoming payments. The pay-period plan/recommendation dashboard is gone
  (the plan engine itself remains and still powers Payoff).
- **Income is a future phase** (dividend drawing + salaries tracker). Income-source UI
  is hidden for now; the `incomeSources` table and data stay untouched.
- **Unchanged:** Payoff planner, Childcare calculator, credit-card statement PDF import
  (§4.6), Settings, backup/restore, and all Hard Rules in `CLAUDE.md`.

---

## 1. Purpose

A personal budgeting tool for a single user on **one Mac**, used in a **web browser as a
bookmarked page**. It answers exactly two questions:

1. **"How much am I spending every month?"** — a clear monthly picture of income vs
   spending by category (a "fancy spreadsheet with a dashboard").
2. **"If I have spare money, how do I pay my borrowings back?"** — given the current bank
   balance and everything committed before the next payday, how much is *safe* to pay
   extra, and onto which credit card / loan.

Everything in this spec exists to serve those two questions. Anything that doesn't is out
of scope (see §8).

## 2. Owner decisions (from interview)

| Decision | Choice |
|---|---|
| Approach | **Keep the engine, rebuild the UI.** Reuse the tested pure-logic modules (`finance`, `pay-period`, `affordability`, `banking-calendar`, `recurrence`, `currency`, `childcare`, `pdf-parser`) and their tests. Rebuild screens, data layer, and persistence from a clean slate. |
| Devices | **One main computer (MacBook).** No multi-device sync, no wife-access requirement. Must work in Safari as well as Chrome. |
| App form | **Bookmarked web page.** No PWA, no service worker, no install prompts, no offline machinery. |
| Data | **Start fresh.** New empty database, new schema v1. No migration from the old app, no legacy import pipelines. The owner re-enters debts and bills by hand. |
| Spending workflow | **Bills planned; actuals from confirmations + manual entry.** Recurring bills/subscriptions are set up once and auto-generate expected payments; ticking them paid writes the ledger. *(Amended 2026-07-07: the originally planned bank-statement transaction import was dropped after testing — PDF reading is for credit-card statements updating debts instead, §4.6.)* |
| Time model | **Both** views: payday-to-payday (for the affordability/payoff question) and calendar month (for the spending review). |
| Debts | **Simple balances.** Per debt: name, type, current balance, APR, promo details, minimum payment. Balance updated by hand from the banking app. **No statement logging/filing.** |
| Income | **Multiple income sources**, each with its own amount and pay-date rule. |
| Payoff advice | **Directive.** The dashboard states plainly: *"You can safely pay £X extra — put it on \<debt\>."* based on the affordability engine + the chosen strategy. |
| Childcare | **Simplified top-up calculator.** No ledger. Per child: provider monthly cost + current Tax-Free Childcare account balance (hand-updated). App computes the required monthly deposit including the 20% government top-up and treats it as a committed bill. |
| Charts/analytics | **Deferred to a later phase.** v4.0 ships with numbers and tables; heatmaps and rich charts come after the core is solid. |
| Assets / net worth | **Dropped.** |
| Cloud/file sync | **Dropped entirely** (Supabase, File System Access API, OPFS all removed). Persistence = IndexedDB + manual JSON export/import. |

## 3. Technology

- **Build:** Vite (already in place). Remove `vite-plugin-pwa`.
- **UI:** **React 18 + JSX** (new dependency), plain JavaScript (no TypeScript — keeps the
  whole codebase one language, matching the engine). No `innerHTML` templating, no
  `window.*` global handlers, no inline `onclick=` — this was the core disease of the old
  UI layer. Component state via React; app-wide data via a small context/hook around the
  repository layer.
- **Persistence:** Dexie (IndexedDB), **new database name** (`BudgetAppV4`), schema
  **version 1**, designed fresh (§5). The old `BudgetConsoleDB` is left untouched.
- **Money:** integer **pence** everywhere in storage and engine; pounds only at the UI
  boundary. GBP only. Reuse `src/utils/currency.js`.
- **Dates:** `date-fns` (already a dependency). UK banking-calendar awareness retained:
  payment dates that fall on weekends/bank holidays shift to the next working day
  (`banking-calendar.js`, gov.uk feed with static fallback).
- **Charts:** `chart.js` stays in `package.json` for the later analytics phase but is not
  used in v4.0.
- **Tests:** Vitest, keeping the existing engine test suites green and adding tests for the
  new data layer.
- **Dependencies to remove:** `@supabase/supabase-js`, `vite-plugin-pwa`. `dompurify`
  becomes unnecessary once no HTML is string-built (React escapes by default) — remove it
  unless the PDF-import preview genuinely needs it.

## 4. Screens

Four tabs + a settings page. Desktop-first layout (it's used on a Mac); it should merely
not-break on a narrow window — no bottom nav, no swipe gestures, no haptics, no
safe-area CSS.

### 4.1 Dashboard (home)

Top strip:
- **Current bank balance** — a manually entered figure with "as of \<date\>" and an *Update*
  button (the owner copies it from their banking app). This is the anchor for all
  projections; there is no attempt to derive it from transactions.

**Pay-period panel** (the headline feature):
- Shows the current pay period: last income event → next expected income event (across all
  income sources, so a period ends whenever the *next* income of any source arrives).
- A timeline table of committed outgoings in the period: recurring bills (working-day
  adjusted), debt minimum payments, the childcare required deposit, and a prorated
  "everyday spending allowance" (a single monthly figure the owner sets in Settings,
  scaled to the period length).
- Running projected balance; a warning banner if it dips below the **safety buffer**
  (owner-configurable, stored in settings) or below zero.
- **The recommendation card:** *"Safe to pay extra: £X — pay it onto \<debt name\>."*
  X = projected end-of-period balance − safety buffer (floor 0). The target debt comes
  from the payoff strategy (§4.4). If X is 0/negative, say so plainly ("No spare money
  this period — projected to end £Y below your buffer").
- Prev/next period navigation.

**This-month panel** (the spending review):
- Month navigator. Income total, spending total, net.
- Spending by category as a sorted table with amounts and % of total (chart added in the
  later analytics phase).

### 4.2 Money In & Out (setup + review)

Two sections on one tab (or two sub-tabs — implementer's choice):

**Planned** — the things that repeat:
- **Income sources:** name, amount (pence), pay-date rule (`nth-of-month` day 1–28,
  `last-day`, `last-working-day`), active flag. These generate the expected income events
  the pay-period engine uses.
- **Recurring bills:** label, amount, category, frequency (weekly / 2-weekly / 4-weekly /
  5-weekly / 6-weekly / monthly / quarterly / 6-monthly / annual — week-based frequencies
  step by days, month-based ones keep a day-of-month anchor), next due date, working-day
  adjustment on/off, optional end date, active flag. Subscriptions are just recurring
  bills — no separate concept. *(Frequency list extended per owner testing feedback,
  2026-07-07.)*
- **Debt payments appear in this list too** (owner decision 2026-07-07): each debt's
  minimum/fixed payment renders as a derived, read-only recurring-bill row (computed from
  the debt record, never persisted). It supports "mark paid" like any bill: ticking it
  logs a spend transaction and removes it from the current period's committed list; the
  debt's balance is **not** changed (balances stay honest — updated manually or from a
  card-statement PDF).
- **Bulk mark-paid**: multiple bill rows (including derived debt-payment rows) can be
  selected and confirmed as paid in one action.

**Actual** — the ledger of what really happened:
- A flat `transactions` list (income and spending in one table), month-filtered, with
  category editing, add/edit/delete, and search.
- Rows arrive two ways: **manual entry** and **bill/debt-payment confirmation** (marking
  a planned instance as paid creates/links the actual row). *(PDF transaction import
  removed per owner decision 2026-07-07 — PDF reading now serves debts, §4.6.)*
- No reconciliation mode, no cleared/uncleared flags — the current-balance anchor makes
  bank-style reconciliation unnecessary.

### 4.3 Debts

- Card list grouped by type: **credit cards** and **loans**.
- Credit card fields: name, current balance, APR, credit limit (optional, for a
  utilisation bar), 0% promo end date + post-promo APR (optional), payment day of month.
- Loan fields: name, current balance, interest rate, fixed monthly payment, payment day.
- Minimum payment computed by the existing UK formula in `finance.js`
  (`max(1% + interest + fees, 2.25% + fees, £5)`), overridable per card.
- **Update balance** is the primary interaction: a quick inline edit storing the new
  balance + "as of" date (or one click from a card-statement PDF, §4.6). No statement
  history, no amortisation confirmation flows.
- Debt minimum payments (and loan fixed payments) automatically appear as committed
  outgoings in the pay-period panel **and as derived rows in the Recurring Bills list
  (§4.2)** — derived at read time from the debt records, **not** materialised as
  generated expense rows (the old app's generate-and-regenerate approach was a persistent
  bug source). Marking one paid logs the transaction only; it never mutates the balance.

### 4.4 Payoff planner

Reuses `finance.js` almost verbatim:
- Extra-payment input, defaulting to the dashboard's current "safe to pay" figure.
- Strategy comparison: **avalanche vs snowball vs minimums-only** — months to debt-free
  and total interest for each, honouring 0% promo periods and post-promo rate jumps.
- The owner picks a strategy; the choice persists (settings table, not localStorage) and
  drives the dashboard recommendation card.
- **Balance-transfer modeler** (`modelBalanceTransfer`): fee, required monthly payment to
  clear within the promo, and stay-vs-transfer cost comparison.
- Consolidated month-by-month schedule table. Projection charts deferred to the analytics
  phase.

### 4.5 Childcare (simplified)

Per child: name, provider monthly cost (pence), current Tax-Free Childcare account
balance (hand-updated, with "as of" date).
Computed: required monthly parent deposit = shortfall ÷ 1.25 (so that deposit + 20%
government top-up covers the provider cost), capped at the TFC quarterly limit (£500
top-up per quarter, £1000 if disabled — constants already in the old code). The required
deposit feeds the pay-period committed outgoings. Reuse the math from
`src/utils/childcare.js`; drop accounts-ledger, providers-with-frequencies, and
entitlement-period UI.

### 4.6 PDF statement import — credit-card statements

*(Rescoped per owner decision 2026-07-07: the owner's real use of PDF reading is card
statements, not bank-transaction capture. Bank current-account import is removed.)*

Reads a **credit-card statement PDF** (parsers: **Lloyds/TSB credit card, MBNA, Amex** —
restore from the pre-Phase-5 `pdf-parser.js` in git history) and extracts the statement
summary: closing balance, minimum payment, statement/due date.
Flow (lives on the **Debts** tab): upload PDF → auto-detect parser → summary preview
matched to an existing debt (pick from a list; remember the association) → one-click
**"Update debt"**: sets the debt's `balancePence` + `balanceAsOf` (and min-payment
override if the user opts in). Nothing is written to the transactions ledger. Graceful
error with a manual-entry hint for unparseable PDFs.

### 4.7 Settings

- Categories (name, kind: income/spending; seeded defaults; deletable only when unused).
- Everyday spending allowance (monthly pence figure used by the pay-period panel).
- Safety buffer (pence).
- Theme (light/dark/system) and privacy blur toggle — both small and kept.
- **Backup:** *Export JSON* (plain, unencrypted, versioned envelope) and *Import JSON*
  (replace-all with confirmation). A gentle in-app reminder if no export for 14 days.
- Danger zone: wipe all data (typed confirmation).

## 5. Data model (Dexie `BudgetAppV4`, schema v1)

All money fields are integer pence. All dates ISO `yyyy-MM-dd` strings.

| Table | Fields (indexed → `*`) |
|---|---|
| `settings` | `*key`, value — currentBalancePence, balanceAsOf, safetyBufferPence, everydaySpendPence, payoffStrategy, payoffExtraPence, theme, privacyMode, lastExportAt |
| `categories` | `*id`, `*name`, `*kind` (`income`\|`spending`) |
| `incomeSources` | `*id`, name, amountPence, `*payDateRule`, payDateDay, active |
| `recurringBills` | `*id`, label, amountPence, `*categoryId`, frequency, `*nextDueDate`, adjustToWorkingDay, endDate, active |
| `transactions` | `*id`, `*date`, `*kind` (`income`\|`spend`), amountPence, `*categoryId`, description, `*source` (`manual`\|`import`\|`bill`), `*importHash`, billId |
| `debts` | `*id`, name, `*debtType` (`credit-card`\|`loan`), balancePence, balanceAsOf, apr, creditLimitPence, promoEndDate, postPromoApr, minPaymentOverridePence, interestRate, fixedMonthlyPaymentPence, paymentDayOfMonth |
| `children` | `*id`, name, providerMonthlyCostPence, tfcBalancePence, tfcBalanceAsOf, isDisabled |
| `categoryMappings` | `*id`, `*descriptionKey`, categoryId |

Deliberately absent (were in the old schema): statements, assets, netWorthSnapshots,
balanceSnapshots, dailyBalanceSnapshots, expectedIncome, targets, spendingBuckets,
childcareAccounts/Ledger/Providers, bankHolidayOverrides, income vs
recurrentExpenses vs oneOffExpenses split. Projections are always computed at read time
from live data — **no derived rows are ever persisted**.

Backup envelope: `{ app: "budget-app", format: 1, exportedAt, schemaVersion: 1,
data: { <table>: rows } }`. Import refuses `format`/`schemaVersion` newer than the app.

## 6. Engine reuse map

| Old file | Fate |
|---|---|
| `utils/finance.js` + tests | **Keep verbatim** (move to `src/engine/`). Remove its one `localStorage` fallback — opening balance is passed in as a parameter. |
| `utils/pay-period.js`, `utils/affordability.js` + tests | **Keep**, adapted to the new repositories (multiple income sources already supported). |
| `utils/banking-calendar.js` + tests | **Keep.** localStorage cache of gov.uk holidays is acceptable (it's a cache, not data). |
| `utils/currency.js`, `utils/filtering.js`, `utils/income.js` + tests | **Keep.** |
| `utils/recurrence.js` + tests | **Keep the date math; change the model.** Bill instances are computed at read time for display; the only persistence is bumping `nextDueDate` when a bill is confirmed paid. No 12-months-of-generated-rows. |
| `utils/childcare.js` + tests | **Keep the top-up/cap math only.** |
| `utils/pdf-parser.js`, `utils/string-similarity.js` + tests | **Keep**, bank-statement parsing only. |
| `utils/cashflow.js` + tests | **Park in `src/engine/`** for the later analytics phase (90-day forecast); not wired into v4.0 UI. |
| `db/schema.js`, `db/repository.js` | **Replace** with the fresh v1 schema/repositories (the old ones carry 23 migrations and 64 exports). Port the `createBaseRepository` pence-conversion pattern and relevant repository tests as a starting point. |
| `utils/supabase-sync.js`, `sync-manager.js`, `opfs-store.js`, `snapshot-diff.js`, `legacy-import.js`, `storage.js`, `gestures.js`, `haptics.js`, `security.js`, `data-integrity.js` | **Delete** (+ their tests). |
| All of `src/ui/*` | **Delete**; rebuild as React components. Old files are reference for behaviour only. |
| `index.html` (439 lines) | **Replace** with a minimal Vite/React mount point. |

## 7. Quality bar

- All kept engine tests pass unmodified in spirit (path/import updates allowed).
- New tests for: repositories (pence conversion, CRUD), pay-period assembly from the new
  model, the recommendation calculation, backup export/import round-trip, PDF import
  dedup.
- No `innerHTML`, no `window.*` handler globals, no inline event attributes.
- `npm run build` and `npm test` green; app verified manually in Safari and Chrome on
  macOS (add a `docs/VERIFICATION.md` checklist and complete it — the old project's
  biggest process failure was skipping manual verification).

## 8. Non-goals (explicit)

No cloud sync or accounts. No file auto-save / File System Access API / OPFS. No PWA,
service worker, or install flows. No mobile-first UI, gestures, or haptics. No multi-user
or wife-access features. No assets/net-worth tracking. No per-debt statement logging or
amortisation-confirmation flows. No reconciliation mode. No budget targets/spending
buckets. No multi-currency. No backup encryption. No migration from `BudgetConsoleDB`.
Charts, heatmaps, and the 90-day forecast UI are **deferred** (phase 6), not dropped.
