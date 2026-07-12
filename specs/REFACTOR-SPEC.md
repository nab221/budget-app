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

## ⚠ Amendment 2026-07-12 (e) — Dated "other income" events (consultancy fees…)

The owner received a **consultancy fee paid gross** (pre-tax, outside PAYE). It is not
a dividend (dividend rates and the £500 allowance don't apply) and not salary (no PAYE
deducted), so neither existing entry type fits. Where this conflicts with older
sections, this wins:

- `incomeEvents.kind` gains a third value: **`other-income`** — dated income paid gross
  outside PAYE (consultancy fee, freelance work). Same shape as a dividend draw: date
  (defaults today), positive amount, optional note; added via an **"Add other income"**
  action on the person card; editable/deletable. No schema version bump (`kind` values
  are not constrained at the Dexie level).
- **Tax treatment**: general income — it joins the non-dividend stack (taxed through
  the normal 20/40/45% bands, consumes band space before dividends, counts toward the
  £100k line and gross income), but its tax is **owed via Self Assessment**, not
  collected by PAYE. The engine treats it as the top slice of non-dividend income
  (marginal rates on top of salary) and reports the split: `payeTaxPence` (collected at
  source) vs `selfAssessmentTaxPence` (dividend tax + other-income tax).
- The projection convention follows dividends: other-income events count only as
  actually entered — no annualising.
- The person-level annual **`otherIncomePence` field stays** for steady annual amounts
  known up front (still estimated on the PAYE side, as before — e.g. amounts collected
  via a tax-code adjustment). One-off gross receipts belong in dated events.
- The person card's second tax stat becomes "**Extra bill via Self Assessment**"
  (dividends + other income, with the split shown when both exist); the dashboard Z6
  strip and monthly report show `PAYE ≈ X · Self Assessment ≈ Y`.

---

## ⚠ Amendment 2026-07-12 (d) — Payrolled benefits in kind on the payslip

The owner's payslip carries a **payrolled BIK** line (the car bought via salary
sacrifice): PAYE adds it to taxable pay every month, so taxable pay on the payslip is
**gross − pension + BIK** — amendment (c)'s `gross − pension` under-read it (real
example: £5,607.69 − £600.02 + £156.75 = £5,164.42) and the PAYE check flagged the tax
deducted on the benefit as an overpayment. Where this conflicts with (c), this wins:

- `payslips` gains **`bikPence`** and `salaryPeriods` gains **`bikAnnualPence`** (both
  non-indexed, £0 default — still schema v5, no version bump; old rows read as £0). A
  month's taxable pay is `max(0, gross − pension) + BIK`; projections use
  `(max(0, salary − sacrifice − workplace pension) + BIK) / 12` — the benefit is taxed
  even in a nil-cash month.
- The person-level annual **`benefitsInKindPence` (P11D) field stays**, but is now only
  for benefits **not** payrolled (assessed via P11D/tax code). A payrolled benefit
  entered both there and on the timeline would count twice — the UI hints say which
  field to use: on the payslip → timeline/payslips; P11D-only → person details.
- The PAYE check needs no change: it reads the month's taxable pay, which now includes
  the payrolled BIK.

---

## ⚠ Amendment 2026-07-12 (c) — Income redesign: salary timeline + monthly payslips

The owner's pay stopped fitting a single annual figure (mid-year raise, reduction to
less-than-full-time, an upcoming new contract), so the "**No monthly payslip logging**"
decision in amendment (b) is **superseded**. Full design and owner-confirmed decisions:
`specs/INCOME-TAB-REDESIGN-PLAN.md`. Where this conflicts with amendment (b), this
amendment wins. In brief:

- **Salary timeline** (`salaryPeriods`, schema v5): per person, dated entries
  "£X/year in force from date D" carrying annual salary, salary sacrifice, and the
  expected before-tax **workplace pension** per year. Months project from whichever
  entry is in force; a change month is pro-rated by day. The person row's
  `annualSalaryPence`/`salarySacrificePence` stop being written (v5 migrates them into
  an initial always-in-force entry; a person with no entries still falls back to them,
  covering pre-v5 backup restores).
- **Monthly payslip log** (`payslips`, one per person-month): full-detail entry per
  the owner's decision — gross pay, before-tax pension, **income tax deducted**, note.
  A month with a payslip shows the actual (taxable = gross − pension); a payslip on a
  future month is a *planned* amount (pencilled bonus); everything else stays
  projected.
- **Month grid** on the person card: Apr–Mar rows with actual/planned/projected
  badges and a running total toward the two thresholds; the current month nudges when
  its payslip is missing. Documented simplification: a payslip belongs to the tax year
  of its calendar month.
- **PAYE check**: cumulative-basis comparison (m/12 of allowance and bands) of tax
  actually deducted vs expected, warning beyond ±£100 — only when every month up to
  the latest payslip is entered. Standard allowance (no taper), non-dividend only.
- **"Add salary adjustment" is retired**: real payslips carry one-offs; known future
  one-offs go on future months. Existing adjustment events still count and stay
  editable/deletable; they can no longer be created.
- Dividends, the threshold meters, `computePersonTax`, and the dashboard Z6 strip are
  unchanged.

---

## ⚠ Amendment 2026-07-07 (b) — Income phase activated: two-person tax-year tracker

The "future phase" flagged in the amendment above is now specified (owner interview,
2026-07-07). It adds a new top-level **Income** tab. Where this conflicts with older
sections, this amendment wins.

### Purpose

The household is two adults (the owner and his wife). Both draw a **PAYE salary** and
both can draw **dividends** from their company. The tab answers, per person, per UK tax
year (6 April – 5 April):

1. **"How close am I to £100,000?"** — Tax-Free Childcare and free hours are lost if
   **either** parent's *adjusted net income* crosses £100,000, so the £100k line is shown
   for **both** people, with a plain warning when crossed.
2. **"How close is she to the 40% band?"** — headroom to the £50,270 higher-rate
   threshold, shown for both people.
3. **"What will the tax bill be?"** — estimated **total income tax for the year** per
   person, split into the part PAYE handles automatically and the **extra bill created
   by dividends** (settled later via Self Assessment) — both figures shown (owner
   decision).

This is a *tax-year planning* concern, entirely separate from the dormant
`incomeSources` table (a *cashflow pay-date* concern). `incomeSources` stays untouched.

### Owner decisions (interview 2026-07-07)

| Decision | Choice |
|---|---|
| Salary input | ~~**Annual gross salary once** per person, plus optional dated **salary adjustments** (signed one-off amounts for a bonus month, unpaid leave, a mid-year raise correction). No monthly payslip logging.~~ **Superseded by amendment (c)**: salary timeline + monthly payslips. |
| Pensions | Per-person **annual personal pension contributions** field, subtracted when computing adjusted net income for the £100k check. UI hint: if the provider adds 25% basic-rate relief, enter the grossed-up total. £0 default. |
| Salary sacrifice | Per-person **annual salary sacrifice** field (owner follow-up 2026-07-07: wife has a car salary-sacrifice scheme). Subtracted **from the annual salary before anything else** — it reduces taxable pay *and* adjusted net income, unlike the pension field. UI hint: a sacrificed car usually creates a benefit in kind, which belongs in the P11D field. £0 default. |
| Other income | Two optional per-person annual figures: **benefits in kind** (P11D: car, medical…) and a generic **other income** catch-all. Both count toward the totals and the £100k line. |
| Tax figure | **Both**: full-year total income tax AND the extra dividend bill highlighted separately. |
| Dividends | Recorded per person via an **"Add dividend draw"** action: date (defaults today), amount, optional note. Editable/deletable. |

### Tax rules (engine `src/engine/tax.js`, pure + tested)

- Tax-year constants keyed by label (`2025-26`, `2026-27` seeded). A date after the last
  known year reuses the latest table (simpler option; revisit each Budget).
  2026-27 values: personal allowance £12,570 (tapered £1 per £2 of adjusted net income
  over £100,000, gone at £125,140); basic-rate band £37,700 (higher rate from £50,270,
  additional from £125,140); rates 20/40/45%; dividend allowance £500; dividend rates
  **10.75% / 35.75% / 39.35%** (the April 2026 increases).
- Non-dividend income (salary − salary sacrifice + adjustments + BIK + other) is taxed
  first through the bands after the personal allowance; dividends stack on top — the £500 allowance is
  taxed at 0% but **consumes band space**, then dividend rates apply per band.
- **Adjusted net income** = all of the above income **plus dividends minus pension
  contributions**.
- Projection convention: salary/BIK/other are annual figures assumed for the full year;
  dividends and adjustments count only as actually entered (dividends are discretionary
  — that is the point of the tool). So the headline reads "if you draw nothing more,
  this is the year".
- Headroom figures: dividends drawable before the £100k adjusted-net-income line, and
  before the higher-rate threshold.
- **Documented simplifications** (chosen per the "simpler option" rule): National
  Insurance ignored (not income tax); student loans out of scope; personal pension
  contributions reduce adjusted net income only (basic-rate band extension not
  modelled); savings-interest allowances not modelled (other income treated as general
  income); rUK bands only (no Scottish rates); tax codes not modelled — PAYE is
  estimated from the annual salary.

### Screen (§4.8 Income)

- Tab order: Dashboard, **Income**, Expenses, Payoff, Childcare.
- **Tax-year navigator** (‹ 2026–27 ›), defaulting to the tax year containing today.
- One **person card** per person (add/edit/delete people; expected count: 2):
  - Headline: gross income and adjusted net income for the selected year.
  - Two threshold meters — £50,270 (40% band) and £100,000 (childcare) — each with
    "≈ £X more dividends before …" headroom text; a clear danger state when crossed
    (£100k crossing = "household loses Tax-Free Childcare / free hours").
  - Tax summary: estimated total income tax for the year; of which PAYE ≈ £X; **extra
    bill from dividends ≈ £Y** (Self Assessment).
  - **Add dividend draw** (primary action) and *Add salary adjustment*; the year's
    events listed beneath with edit/delete.
- Deleting a person asks for confirmation and removes their events.

### Data model (schema v3 — additive)

| Table | Fields (indexed → `*`) |
|---|---|
| `people` | `*id`, name, annualSalaryPence, salarySacrificePence, pensionAnnualPence, benefitsInKindPence, otherIncomePence |
| `incomeEvents` | `*id`, `*personId`, `*date`, `*kind` (`dividend`\|`salary-adjustment`), amountPence, note |

Both join `TABLE_NAMES` (so backup/wipe cover them automatically). All money integer
pence at rest; pounds at the repository edge, as everywhere else.

### Non-goals for this phase

No company-side accounting (corporation tax, retained profit, dividend vouchers). No
National Insurance or student-loan maths. No Scottish bands. No payslip OCR/import. No
HMRC filing or export. No linkage between `people` and the dormant `incomeSources`.

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
