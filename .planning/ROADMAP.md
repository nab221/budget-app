# Roadmap: Budget App v3.0

## Milestone: v3.0 — Budget Planning Core Redesign

**Goal:** Transform the app from a transaction tracker into a genuine budget planning tool. The user enters their current account balance, and the app answers: *"How much can I afford to pay extra toward my debts before my next payday?"* All major UX regressions and mobile issues from v2.7 are resolved first, then the planning core is built on top.

**Starting Phase:** 27 (next after v2.7's Phase 26)

---

## Phase Overview

| Phase | Name | Priority | Requirements | Est. Complexity |
|-------|------|----------|-------------|-----------------|
| 27 | Critical Bug Fixes & Cloud-Sync Hardening | P0 | SYNC-02, NAV-01, NAV-03, MOB-06 | Low |
| 28 | Mobile Navigation Overhaul | P0 | MOB-01, MOB-02, NAV-01, NAV-02 | Medium |
| 29 | Mobile Table & Interaction Fixes | P0 | MOB-04, MOB-05, DEBT-04 | Medium |
| 30 | Magic Link PWA / Auth Fix | P0 | MOB-07, SYNC-01 | Medium |
| 31 | Banking Calendar Utility & Recurrence Upgrade | P1 | TECH-02, TECH-03, PLAN-03 | Medium |
| 32 | Debt Model Refactor — Loans & Mortgage | P0 | DEBT-01, DEBT-03 | High |
| 33 | Income & Spending Configuration | P0 | PLAN-06, PLAN-04 | Medium |
| 34 | Pay-Period Affordability Engine | P0 | PLAN-01, PLAN-02, PLAN-05 | High |
| 35 | Childcare Top-Up Planner | P0 | CHILD-01, CHILD-02, CHILD-03 | Medium |
| 36 | Navigator & View Toggle Redesign | P1 | NAV-02, NAV-03, MOB-03, MOB-02 | Medium |
| 37 | Cloud Snapshot Delta Preview | P1 | NAV-04 | Low |
| 38 | GitHub Actions Node.js 24 & Technical Hygiene | P1 | TECH-01, TECH-04 | Low |
| 39 | v3.0 Milestone Verification & Polish | P0 | All | Low |

---

## Phase Details

### Phase 27 — Critical Bug Fixes & Cloud-Sync Hardening
Fix the three known cloud-sync.js bugs (event listener leak, XSS in modal, missing init guard), fix the header auto-save dot layout on mobile, and fix the heatmap year boundary rendering bug.

**Key deliverables:**
- `cloud-sync.js`: event delegation, XSS sanitisation, init guards
- `heatmap.js`: filter transactions strictly to the selected year's canvas; do not render cross-year data
- `css/main.css`: fix header toolbar flex layout so the save indicator and local icon are on the same line on mobile

**Files likely changed:** `src/ui/cloud-sync.js`, `src/ui/heatmap.js`, `css/main.css`

---

### Phase 28 — Mobile Navigation Overhaul
Redesign the navigation to be always visible on all screen sizes. On mobile, tabs become a fixed bottom bar with icons + labels. On desktop, tabs remain horizontal at the top. The header becomes sticky.

**Key deliverables:**
- Fixed bottom tab bar on mobile (icon + label, always visible)
- Sticky/fixed header on all screen sizes
- Tab bar must not disappear on long pages
- Sufficient bottom padding on all tab-panels to avoid content hidden behind the tab bar

**Files likely changed:** `css/main.css`, `index.html` (tab HTML structure), `src/app.js` (tab navigation logic)

---

### Phase 29 — Mobile Table & Interaction Fixes
Fix all mobile table rendering issues in the Income and Expenses tabs. Introduce swipe gestures for row actions. Fix category rendering in Expenses to use badge chips. Fix the expenses-created-from-debts navigation target.

**Key deliverables:**
- Income tab: date format `dd-MMM / YYYY`, amount header no-wrap, swipe-right = edit, swipe-left = delete
- Expenses tab: category as badge chip, headers = `Date | Expense | Amount`, status as tick/badge, date format matching income
- Expenses tab: rows linked to a debt record must navigate to Debts tab via swipe/tap (not show inline edit)
- Gesture utility (`src/utils/gestures.js`) used/extended for table rows

**Files likely changed:** `src/ui/transactions.js`, `src/ui/expenses.js`, `css/main.css`, `src/utils/gestures.js`

---

### Phase 30 — Magic Link PWA / Auth Fix
Diagnose and fix the Supabase magic link authentication failure when the app is installed as a PWA on iOS/Android. Likely involves: service worker redirect handling, Supabase redirect URL allowlist, and/or PWA manifest `start_url`/`scope` settings.

**Key deliverables:**
- Magic link emails open the installed PWA and complete sign-in correctly on iOS Safari and Android Chrome
- Service worker does not intercept the magic link callback in a way that drops the auth token
- Test documented in phase verification with cross-device pass evidence

**Files likely changed:** `public/sw.js` (service worker), `public/manifest.json`, `src/ui/cloud-sync.js`, `.env.example`

---

### Phase 31 — Banking Calendar Utility & Recurrence Upgrade
Create a dedicated banking calendar utility for England & Wales. Extend the recurrence engine to use it. This is the foundation for accurate recurring payment date display throughout the app.

**Key deliverables:**
- `src/utils/banking-calendar.js`: UK bank holidays (rolling 3-year static list + GOV.UK API fetch with cache), `nextWorkingDay(date)`, `adjustedPaymentDate(nominalDate, adjustment)`
- `src/utils/recurrence.js`: new `paymentAdjustment` field (`'none' | 'next-working-day'`)
- Unit tests for both modules covering edge cases (Friday before a bank holiday, Christmas week, etc.)

**Files likely changed:** `src/utils/banking-calendar.js` (new), `src/utils/recurrence.js`, `src/db/schema.js` (schema version bump), `src/db/repository.js`

---

### Phase 32 — Debt Model Refactor — Loans & Mortgage
Remove statement-based management from loan and mortgage debt types. Replace with a predictive amortisation model. Add the ability to confirm the current balance at any time (after an overpayment). The existing credit card statement flow is untouched.

**Key deliverables:**
- Schema change: `debts` table gains `debtType` field distinguishing `'credit-card'`, `'personal-loan'`, `'mortgage'`
- Loan/mortgage debt cards: remove PDF/statement import buttons, add "Confirm Current Balance" action
- Amortisation projection: given outstanding balance, APR, and monthly payment, compute full schedule
- Visual: remaining term bar, projected payoff date, monthly payment breakdown (interest vs principal)
- Payoff planner: include loan/mortgage in the extra-payment allocation

**Files likely changed:** `src/db/schema.js`, `src/db/repository.js`, `src/ui/debts.js`, `src/utils/finance.js`, `src/ui/payoff.js`

---

### Phase 33 — Income & Spending Configuration
Build the income configuration UI (two named sources with expected pay dates) and the spending buckets setup. These feed into the affordability engine in Phase 34.

**Key deliverables:**
- Income sources: stored in DB, each has name, expected monthly amount, pay-date rule (e.g. "last working day", "Nth of month"), and banking-calendar-adjusted preview date
- Spending buckets: create/edit/delete budget categories with monthly estimated amounts
- Settings panel: new "Budget Setup" section housing income sources and spending buckets
- Data persisted in `src/db/schema.js` (new stores: `incomeSources`, `spendingBuckets`)

**Files likely changed:** `src/db/schema.js`, `src/db/repository.js`, `src/ui/expenses.js` or new `src/ui/budget-setup.js`, `index.html`

---

### Phase 34 — Pay-Period Affordability Engine
The headline feature of v3.0. Given the current account balance (manually entered), all upcoming committed outgoings in the window to the next payday, and spending bucket estimates, compute and display:
- "Available to spend" before next payday
- "Suggested maximum extra debt payment"
- Timeline of upcoming payments
- A prominent "What can I pay extra?" card on the Dashboard

**Key deliverables:**
- New utility: `src/utils/affordability.js` — pure function taking balance, payDate, expenses[], incomeSources[], spendingBuckets[], safetyBuffer → returns affordabilityResult
- Dashboard: prominent affordability card (current balance input + result, always visible)
- Pay-period timeline: ordered list of all upcoming payments in the current pay period
- Safety buffer setting: user-configurable minimum balance to always maintain

**Files likely changed:** `src/utils/affordability.js` (new), `src/ui/dashboard.js`, `src/db/repository.js`, `index.html`, `css/main.css`

---

### Phase 35 — Childcare Top-Up Planner
Extend the Childcare tab to answer "how much do I need to top up this period?" per child. Surface required top-up amounts in the affordability calculation.

**Key deliverables:**
- Per childcare account: add recurring provider costs (name, monthly/termly amount, frequency)
- Compute: `required_topup = total_period_spend - current_account_balance - pending_gov_bonus`
- Display: "Required top-up this period" KPI on childcare account card
- Dashboard/affordability: childcare top-ups appear as committed outgoings in the pay-period window
- Entitlement period: surface clearly in the account card (existing util already computes it)

**Files likely changed:** `src/ui/childcare.js`, `src/utils/childcare.js`, `src/utils/affordability.js`, `src/db/schema.js`, `src/db/repository.js`

---

### Phase 36 — Navigator & View Toggle Redesign
Redesign the dashboard navigator for a modern, consistent experience across devices. Replace the `<select>` view dropdown with a segmented radio toggle. Fix all heatmap year-boundary issues that survive Phase 27.

**Key deliverables:**
- Pay-period navigator: fixed/sticky, shows current pay period, prev/next arrows
- View toggle: `[ Month | YTD | All Time ]` segmented control replacing the select dropdown
- Mobile: navigator fixed below header
- Heatmap: year navigation respects the currently selected year strictly

**Files likely changed:** `src/ui/dashboard.js`, `src/ui/heatmap.js`, `index.html`, `css/main.css`

---

### Phase 37 — Cloud Snapshot Delta Preview
Change the cloud snapshot preview from a full item list to a delta (what changed) view.

**Key deliverables:**
- Compare current local snapshot with the last pushed cloud snapshot
- Display: "Changes since last cloud save: +2 expenses, 1 income modified, mortgage balance updated"
- Fall back to full summary if no previous cloud snapshot exists

**Files likely changed:** `src/ui/cloud-sync.js`, `src/utils/supabase-sync.js`

---

### Phase 38 — GitHub Actions Node.js 24 & Technical Hygiene
Upgrade CI/CD pipeline actions to Node.js 24 compatible versions. Clean up loose test files in root (`test-output.txt`, `test-purify.cjs`, `test-security.js`, `test-syntax.cjs`, `print_lines.cjs`) — these should be moved to `tests/` or removed.

**Key deliverables:**
- All GitHub Actions upgraded to Node.js 24 compatible versions (deadline: before June 2, 2026)
- Root-level test/debug files cleaned up
- CI green on all 354+ tests after upgrades

**Files likely changed:** `.github/workflows/deploy.yml`, root-level test files

---

### Phase 39 — v3.0 Milestone Verification & Polish
Full regression test, cross-device manual verification, documentation update, and version bump to v3.0.

**Key deliverables:**
- All P0 requirements verified in manual checklist
- Full Vitest suite green (target: 400+ tests)
- README updated to reflect v3.0 capabilities
- PROJECT.md and STATE.md updated to v3.0 shipped
- GitHub release tag `v3.0.0`

---

## Requirements Coverage Matrix

| Requirement | Phase |
|------------|-------|
| SYNC-02 (cloud-sync bugs) | 27 |
| NAV-03 (heatmap year fix) | 27 |
| MOB-06 (header layout) | 27 |
| MOB-01 (fixed bottom tabs) | 28 |
| MOB-02 / NAV-02 (fixed nav) | 28, 36 |
| NAV-01 (tabs always visible) | 28 |
| MOB-04 (income table mobile) | 29 |
| MOB-05 (expenses table mobile) | 29 |
| DEBT-04 (expense→debt link) | 29 |
| MOB-07 / SYNC-01 (magic link) | 30 |
| TECH-02 (banking calendar) | 31 |
| TECH-03 (recurrence upgrade) | 31 |
| PLAN-03 (banking calendar dates) | 31 |
| DEBT-01 (loan/mortgage model) | 32 |
| DEBT-03 (balance confirmation) | 32 |
| PLAN-06 (income config) | 33 |
| PLAN-04 (spending buckets) | 33 |
| PLAN-01 (balance entry) | 34 |
| PLAN-02 (affordability view) | 34 |
| PLAN-05 (pay-period navigator) | 34, 36 |
| CHILD-01 (top-up calc) | 35 |
| CHILD-02 (top-up in affordability) | 35 |
| CHILD-03 (entitlement display) | 35 |
| MOB-03 (view toggle) | 36 |
| NAV-04 (snapshot delta) | 37 |
| TECH-01 (GH Actions Node 24) | 38 |
| TECH-04 (test coverage) | 38 |

---
*Last updated: 2026-03-14*
