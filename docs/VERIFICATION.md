# Budget App v4 — Verification Record

**Date:** 2026-07-07
**Branch:** `claude/budget-app-refactor-imeo8u`
**Commit under test:** `63eb6c4` (feat(phase-5): PDF bank-statement import and childcare top-up calculator)
**Verifier:** automated end-to-end browser drive + manual review (verification engineer)

## Method

- **Static gates:** `npm run build` and `npm test` run from a clean tree.
- **End-to-end drive:** the app was served with `npm run dev`
  (`http://localhost:5173/budget-app/`, base path `/budget-app/`) and driven in a **real
  Chromium browser** (Playwright, `/opt/pw-browsers/chromium-1194`) against a **fresh,
  empty IndexedDB profile**. Every step asserted on the live DOM and captured a
  screenshot. Console `error`/`warning` output and uncaught page errors were collected for
  the whole session.
- **Driver + screenshots:** kept out of the repo, in the session scratchpad
  (`driver.mjs`, `shots/*.png`). Nothing under `src/` was modified.

## Result summary

| Outcome | Count |
|---|---|
| PASS | 10 of 12 automated scenarios + all static/quality gates |
| FAIL | 1 (bill-confirmation double-count — see BUG-1) |
| MANUAL (owner must still do) | real bank-PDF round-trip, Safari on macOS, real-world payday sanity check |

`npm test` → **391 passed (38 files)**. `npm run build` → **green**. No uncaught page
errors on any tab. One benign 404 (`favicon.ico`) and one benign pdf.js warning during the
junk-file import test (details under *Console noise*).

---

## BUG-1 (FIXED) — a bill marked paid is still counted as a committed outgoing

**Status:** FIXED in the post-review pass. `src/engine/plan.js` `billOutgoings()` no
longer steps the cursor back a whole frequency step; it now walks forward from
`nextDueDate` (by definition the next UNPAID occurrence), stopping the fast-forward one
step before the window so a working-day shift can still pull an occurrence in, but never
emitting anything earlier than `nextDueDate`. A confirmed bill whose `nextDueDate` has
advanced past the period start therefore drops out of the timeline and the projected end
balance rises by the bill amount. Regression test:
`src/engine/plan.test.js` → "paid bill does not re-enter the timeline (M1 / BUG-1)".

**Severity:** Medium — breaks the spec's "no double counting" guarantee for the Phase‑4
mark-paid flow and distorts the headline *Safe to pay extra* projection.

**Symptom:** On the dashboard pay-period panel, marking a bill paid correctly (a) creates a
`source:'bill'` transaction in the ledger and (b) lists the bill under **"Paid this
period."** But the same occurrence **also remains in the committed-outgoings timeline
table as an unpaid deduction**, and the **projected end balance does not change**. The paid
bill is therefore represented twice and continues to reduce the "safe to pay extra" figure
even though it has been paid. Unmarking works correctly (row returns, paid entry clears).

**Where:** `src/engine/plan.js` → `billOutgoings()`. After locating the first occurrence
on/after the window start it unconditionally steps the cursor back one whole frequency step
(`cursor = addMonths(cursor, -stepMonths)`). When a bill's `nextDueDate` sits about one
step *after* the window start — which is exactly the state produced by
`confirmBillPayment` advancing `nextDueDate` by one step — the step-back re-introduces the
just-paid occurrence into the window. (The step-back is only meant to catch a nominal date
just *before* the window start that a working-day shift pulls *into* it.)

**Deterministic engine repro** (pure `buildPlan`, no DB), income on the 28th + last working
day so the current period is `2026-06-30 → 2026-07-28`, opening balance £5,000:

| Bill `nextDueDate` | Timeline rows | Projected end |
|---|---|---|
| `2026-07-15` (before confirm) | `2026-07-15 Netflix £15.00` | £4,985.00 |
| `2026-08-15` (after confirm)  | `2026-07-15 Netflix £15.00` *(should be empty)* | £4,985.00 *(should be £5,000.00)* |

The 15 Jul row and its £15 deduction persist after the due date has advanced to 15 Aug.

**Note:** this contradicts the design comment in `src/db/billConfirmation.js` ("the
confirmed occurrence drops out of the read-time plan … no double counting"). The normal,
pre-confirmation case is fine — a monthly bill shows exactly once — so the existing 391
tests do not catch it; there is no test that advances `nextDueDate` a full step past the
period start and re-reads the plan. **Not fixed** (verification only); recommend a targeted
`plan.js` fix plus a regression test that confirms a bill and asserts the occurrence leaves
the timeline and the projected balance rises by the bill amount.

---

## Post-review fixes (2026-07-07)

An adversarial review + a real-browser re-verification produced the findings below; all
were fixed in this pass with a regression test each. Gates after the pass: `npx vitest run`
→ **412 passed (38 files)**; `TZ=Europe/London npx vitest run` → **412 passed** (new
`test:tz` npm script gates this permanently); `npm run build` → green.

| # | Fix | File(s) | Regression test |
|---|---|---|---|
| H1 | Card with a blank (`null`) post-promo APR no longer simulates at 0%; `null` normalised to omitted at the payoff edge and the finance engine treats `null` like `undefined` (`!= null` → falls back to `apr`). | `src/ui/payoff/payoffModel.js`, `src/engine/finance.js` | payoffModel.test.js "null postPromoApr accrues interest at the card APR (H1)" |
| H2 | BST timezone bug: nominal payment dates were built by mixing local `getDaysInMonth` with `setUTCDate`. Replaced with pure string math (`dateForMonthDayStr` + `daysInMonthYM`); month enumeration still uses a local-parsed cursor only to derive `yyyy-MM`. | `src/engine/plan.js` | plan.test.js "date helpers are timezone-independent (H2)" + whole suite green under `TZ=Europe/London` |
| H3 | TFC quarterly cap was applied per-month as if it reset monthly; now capped at the even monthly share `floor(quarterlyCap/3)` (16666p standard, 33333p disabled). The `quarterlyTopUpUsedPence` param is retained. | `src/engine/childcare.js` | childcare.test.js "caps the monthly top-up at the even 1/3 share…" + "…£1,000/3 monthly share for a disabled child" (existing cap tests updated) |
| M1 | See BUG-1 above (paid bill re-entering the timeline) — forward-only walk. | `src/engine/plan.js` | plan.test.js "paid bill does not re-enter the timeline (M1 / BUG-1)" |
| M2 | `useLiveData` stale race: `runId` is now captured per `run()` invocation (mutation-triggered re-runs no longer share a stale id), so only the latest run commits. | `src/db/useLiveData.js` | useLiveData.test.js "a slow earlier run cannot overwrite a newer one (M2 stale race)" |
| M3 | Mid-period balance refresh double-counted outgoings already reflected in the anchor. For the current period (offset 0) only, outgoings dated strictly before `balanceAsOf` are excluded from the projection and flagged `beforeBalance` (dimmed in the UI). | `src/engine/plan.js`, `src/db/planData.js`, `src/ui/dashboard/PayPeriodPanel.jsx` | plan.test.js "balanceAsOf mid-period exclusion (M3)" |
| M4 | Month-end bill drift (31 Jan → 28 Feb → stuck on 28th). Added a `dueDayAnchor` field (defaulted in the repo, set by the bill form); `advanceByFrequency` takes an optional `anchorDay` and re-clamps each step; the plan walk and confirm flow both use it. | `src/engine/plan.js`, `src/db/repositories.js`, `src/db/billConfirmation.js`, `src/ui/money/RecurringBillForm.jsx` | plan.test.js "advanceByFrequency month-end anchor (M4)", repositories.test.js "recurringBills dueDayAnchor default (M4)", billConfirmation.test.js "does not let a 31st-of-month bill drift…" |
| L1 | Balance-transfer stay-cost ignored an active promo; promo details now passed through to `modelBalanceTransfer`'s baseline. | `src/ui/payoff/BalanceTransferModeler.jsx` | finance.test.js "honours an active promo in the stay-cost baseline (L1)" |
| L2 | Bill confirm atomicity + double-click: read-check + txn insert + `nextDueDate` bump wrapped in one Dexie rw transaction; `MarkPaidControl` disables Confirm while in flight. | `src/db/billConfirmation.js`, `src/ui/money/MarkPaidControl.jsx` | billConfirmation.test.js "is atomic and double-click safe…" |
| L3 | Seeding race: `count` + `bulkAdd` wrapped in one Dexie rw transaction. | `src/db/seed.js` | seed.test.js "does not double-seed under a concurrent race (L3)" |
| L4 | Category delete left dangling `categoryMappings`; deletion now cascade-deletes the category's learned mappings in one transaction. | `src/db/repositories.js` | repositories.test.js "category delete cascades its learned mappings (L4)" |
| L5 | Added an inline `£` SVG data-URI favicon to silence the `/favicon.ico` 404. | `index.html` | n/a (static markup) |

Also added the `test:tz` npm script (`TZ=Europe/London vitest run`) as a permanent
timezone gate.

---

## Owner-flow scenario checklist

| # | Scenario | Result | Observed |
|---|---|---|---|
| 1 | Fresh profile first run: loads with no page errors, 10 seeded categories in Settings, all 6 tabs render empty states | **PASS** | 10 categories seeded (Salary, Other Income / Groceries, Utilities, Housing, Transport, Eating Out, Kids, Debt Payment, Other). Dashboard shows "Add your current bank balance" + "No income set up yet"; Money shows 3 empty states; Debts shows 2; Payoff "nothing to plan"; Childcare "No children yet"; Settings renders. No uncaught errors. |
| 2 | Settings: safety buffer £200, everyday allowance £400 | **PASS** | Both persisted via blur; inputs re-read £200 / £400 after live refresh. |
| 3 | Money In & Out: 2 income sources, 4 recurring bills (monthly + quarterly, WD-adjust mix), 1 manual transaction | **PASS** | Salary £2,600 (28th) + Side income £1,400 (last working day). Bills: Netflix £15 (mo), Council Tax £180 (mo), Water £120 (qtr), Gym £40 (mo, WD-shift off → "no WD shift" tag). Manual: Tesco £52.50 spend. *(Checklist nominally says 5 bills; 4 were used, covering monthly, quarterly, WD-shift-on and WD-shift-off — the count is immaterial to what is exercised.)* |
| 4 | Debts: 2 credit cards (one 0% promo + post-promo APR + limit) + 1 loan; computed min payments sane (UK formula); inline balance update | **PASS** | Barclaycard £3,000 @ 27.9% → **min £99.75** (= 1% £30 + interest ≈ £69.75; matches `max(1%+interest, 2.25%, £5)`). MBNA Platinum £900 @ 18.9% with 0% promo to 2027-12-31 → promo badge shown, **min £20.25** (2.25%, interest suppressed in promo). Utilisation bar "50% of £6,000 limit". Car loan £8,000 @ 6.9%, £250/mo. Inline balance update £3,000 → **£2,850** applied. |
| 5 | Childcare: 1 child (provider £400/mo, balance £100) → deposit £240 parent + £60 top-up, and appears in pay-period timeline | **PASS** | Ava: required monthly deposit **£240.00**; breakdown "You pay £240.00, the government adds £60.00 — together covering the £300.00 shortfall" (80/20 of the £300 gap). Childcare deposit row appears in the dashboard timeline (see #6). |
| 6 | Dashboard: set balance, pay-period panel shows income events, bills on adjusted dates, debt minimums, childcare deposit, prorated allowance, a recommendation naming a debt with a £ amount; prev/next nav | **PASS** | Balance set £5,000. Period "Tue 30 Jun → Tue 28 Jul". Income line "Next payday Tue 28 Jul: Salary £2,600.00". Timeline contains bills, Card min, Loan, Childcare and Everyday-allowance rows; **3 working-day-shifted rows** carry the "shifted" tag (e.g. Council Tax 18 Jul Sat → 20 Jul). Projected end £3,666.66. Recommendation: **"Safe to pay extra: £3,466.66 — Pay it onto Barclaycard."** Prev/next/Today navigation changes the period label. |
| 7 | Payoff: 3 strategies render; switching strategy re-targets the dashboard recommendation; balance-transfer modeler produces a recommendation | **PASS** | Strategy table shows Avalanche / Snowball / Minimums only. Switching to Snowball changes the dashboard reco target from **Barclaycard** (avalanche, highest APR) to **MBNA Platinum** (snowball, smallest balance) and back. BT modeler returns a stay-vs-transfer recommendation ("Transferring looks cheaper — you'd save about £…"). |
| 8 | Bill confirmation: mark a bill paid from the dashboard → moves to "paid this period" + ledger transaction; unmark → returns | **FAIL** | Mark paid creates the ledger transaction (Bill source) and adds the "Paid this period" entry, and Unmark restores correctly — **but the paid bill is NOT removed from the committed-outgoings timeline and the projected balance is not corrected.** See **BUG-1**. |
| 9 | This-month panel reflects the transactions (income/spend/category table) | **PASS** | With the manual Tesco £52.50 spend (Netflix left unmarked after #8), This-month shows Spending £52.50, Income £0.00, and a by-category table row "Groceries £52.50 100%". |
| 10 | Backup: export JSON, wipe via danger zone, import, verify everything returns | **PASS** | Exported `budget-backup-2026-07-07.json` (debts=3, bills=4, txns=1). Typed-DELETE wipe cleared all debts (0). Import (replace-all, confirmed) restored: debts=3 (Barclaycard present), bills=4, Tesco transaction, allowance £400, balance £5,000. |
| 11 | Theme toggle light/dark; privacy mode blurs money values | **PASS** | Theme select stamps `data-theme="dark"` / `"light"` on `<html>`. Privacy toggle adds `body.privacy`; a sampled `.money` element computes `filter: blur(6px)`; toggling off removes both. |
| — | PDF import panel opens and shows a graceful error on a junk file | **PASS** | Import dialog opens; a junk `.pdf` yields an in-panel error "Could not read this PDF. Make sure it's a bank current-account statement, or add the transactions manually." No crash, no rows inserted. |
| — | Real bank-PDF import round-trip (parse → categorise → re-import inserts 0 duplicates) | **MANUAL** | No real bank statement available in this environment. Owner must run with a genuine current-account PDF. |

---

## Spec §7 "Quality bar" checklist

| Item | Result | Observed |
|---|---|---|
| All kept engine tests pass (path/import updates allowed) | **PASS** | `npm test` → 391 passed / 38 files. |
| New tests: repositories, pay-period assembly, recommendation calc, backup round-trip, PDF dedup | **PASS** | Present and green: `db/repositories.test.js`, `db/planData.test.js`, `engine/plan.test.js`, `ui/dashboard/recommendationCopy.test.js`, `db/backup.test.js`, `db/importRepos.test.js`, `engine/import-parse.test.js`. (Coverage gap: no test exercises the confirm→re-read path — see BUG-1.) |
| No `innerHTML`, no `window.*` handler globals, no inline event attributes | **PASS** | `grep` over `src/`: no `innerHTML`; no `onclick=/onchange=/onsubmit=` string attributes; the only `window.` reference is `window.dispatchEvent(...)` in `db/events.js` (a legitimate DOM CustomEvent dispatch, not a global handler). No `dompurify`. |
| `npm run build` and `npm test` green; app verified in Safari and Chrome on macOS | **PARTIAL / MANUAL** | Build + test green; app verified end-to-end in **Chromium** (Chrome-family). **Safari on macOS = MANUAL** (not runnable here). |

## IMPLEMENTATION-PLAN "Verification" checklist

| Item | Result | Observed |
|---|---|---|
| Fresh browser profile: first run seeds categories, all tabs render empty states | **PASS** | Scenario #1. |
| 2 income, bills, 2 cards (one 0% promo), 1 loan, 1 child → dashboard shows committed items on working-day-adjusted dates + a sane recommendation | **PASS** | Scenarios #3–#6 (4 bills used rather than 5; mechanisms fully exercised). |
| Recommendation flips to the correct next debt when strategy is switched | **PASS** | Scenario #7 (Barclaycard ⇄ MBNA Platinum). |
| Import a real bank PDF; categories suggested; re-import inserts zero duplicates | **MANUAL** | No real PDF available; junk-file graceful-error path PASS. |
| Backup export → wipe all → import restores everything | **PASS** | Scenario #10. |
| Works in both Safari and Chrome on macOS | **PARTIAL / MANUAL** | Chromium PASS; Safari MANUAL. |
| `npm test` and `npm run build` green; no console errors on any tab | **PASS (with note)** | Build/test green; no app/page errors. Cosmetic `favicon.ico` 404 + a pdf.js warning during the junk-import test only — see below. |

---

## Console noise

- **`favicon.ico` → 404** — benign; no favicon is shipped (`vite.svg` serves 200). Cosmetic
  only. Owner may add a favicon to silence it.
- **pdf.js warning "Indexing all PDF objects"** — emitted only while attempting to parse the
  deliberately-junk PDF in the graceful-error test; expected, harmless.
- **No uncaught page errors** were observed on any tab during the full session.

## Manual verification still required (owner)

1. **Real bank-PDF import round-trip** — parse a genuine current-account statement, confirm
   category suggestions, and re-import the same file to confirm zero duplicates
   (`importHash` dedup).
2. **Safari on macOS** — repeat the core flows (IndexedDB persistence, backup file
   download/upload, PDF import) in Safari, the owner's stated second browser.
3. **Real-world payday sanity check** — after a genuine payday, confirm the pay-period
   boundaries, committed outgoings, and the "safe to pay extra" figure match the owner's
   actual bank position.

## Artifacts

Screenshots for every step were captured to the session scratchpad
(`shots/01-*.png` … `shots/11-*.png`, plus `pdf-junk-error.png`). The Playwright driver is
`driver.mjs` in the same scratchpad. Nothing was committed and no `src/` file was changed.
