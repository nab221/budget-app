# Roadmap: Budget App v3.0

## Overview

v3.0 is a ground-up redesign of the budget planning core. The headline feature is the **Pay-Period Affordability Engine**: given the user's current account balance, all upcoming committed outgoings, and both income streams, the app answers "how much can I safely pay extra toward my debts before my next payday?"

Phases are ordered P0-first within logical dependencies. P1 phases follow once the P0 core is complete.

---

## Phase Table

| Phase | Name | Priority | Requirements | Est. Complexity |
|-------|------|----------|-------------|------------------|
| 27 | 5/5 | Complete    | 2026-03-14 | Low |
| 28 | 3/3 | Complete    | 2026-03-15 | Medium |
| 29 | 2/2 | Complete    | 2026-03-15 | Medium |
| 30 | 1/1 | Complete    | 2026-03-15 | Medium |
| 31 | 2/2 | Complete   | 2026-03-15 | Medium-High |
| 32 | Debt Model Refactor — Loans & Mortgage | P0 | DEBT-01, DEBT-03 | High |
| 33 | Income & Spending Configuration | P0 | PLAN-06, PLAN-04, TECH-06 | Medium |
| 34 | Pay-Period Affordability Engine | P0 | PLAN-01, PLAN-02, PLAN-05 | High |
| 35 | Childcare Top-Up Planner | P0 | CHILD-01, CHILD-02, CHILD-03, TECH-06 | Medium |
| 36 | Navigator & View Toggle Redesign | P1 | NAV-02, NAV-03, MOB-03, MOB-02 | Medium |
| 37 | Cloud Snapshot Delta Preview | P1 | NAV-04 | Low |
| 38 | GitHub Actions Node.js 24, Legacy Import & Technical Hygiene | P1 | TECH-01, TECH-04, INTEGRITY-02 | Low |
| 39 | v3.0 Milestone Verification & Polish | P0 | All | Low |

---

## Dependency Chain

```plaintext
27 → 28 → 29 → 30   (these 4 can run somewhat in parallel as they don't share code, but order is recommended)

31 → 32 → 33 → 34   (hard chain — each phase depends on the previous)

35 depends on 34
36 depends on 28, 34
37 standalone after 27
38 standalone
```

---

## Phase Details

---

### Phase 27 — Critical Bug Fixes, Cloud-Sync Hardening & Data Integrity

**Priority:** P0
**Requirements:** SYNC-02, NAV-01, NAV-03, MOB-06, INTEGRITY-01
**Complexity:** Low

**Objective:** Fix five confirmed bugs (cloud-sync event listeners, XSS risk in snapshot modal, missing init guard, heatmap year-boundary rendering, mobile header layout). Add data integrity checker utility. No new features beyond the integrity checker. All fixes are surgical and targeted.

**Bug Fixes:**

**Bug 1 — Cloud-Sync Event Listener Accumulation (`cloud-sync.js`)**
`_renderSignedIn()` attaches `addEventListener('click', ...)` directly to `#cloudPushBtn` and `#cloudPullBtn` every time it re-renders. Because the element is re-inserted into the DOM, listeners pile up and push/pull are called multiple times per click.
- **Fix:** Use event delegation on the container element. Guard with `this._signedInListenerAttached` flag. Reset flag in `_renderSignedOut()`.
- **File:** `src/ui/cloud-sync.js`, lines ~69, 74, 90, 122

**Bug 2 — XSS Risk in Cloud Snapshot Modal (`cloud-sync.js`)**
In `_bindPreviewListener()`, table/store names from the Supabase payload are injected raw into the modal's innerHTML without escaping.
- **Fix:** Apply standard HTML entity escaping to all user-controlled strings before innerHTML interpolation. Use `safeHTML()` utility from `src/ui/render.js`.
- **File:** `src/ui/cloud-sync.js`, lines ~177–187

**Bug 3 — Missing Init Guard / Duplicate Auth Listeners (`cloud-sync.js`)**
`cloudSyncUI.init()` calls `_bindAuthListener()` and `_bindPreviewListener()` without idempotency guards. If init is called more than once, duplicate Supabase auth state change listeners are registered.
- **Fix:** Add `this._initialized` guard in `init()`. Add `this._authListenerBound` in `_bindAuthListener()`. Add `this._previewListenerBound` in `_bindPreviewListener()`.
- **File:** `src/ui/cloud-sync.js`, lines ~20–27, 150

**Bug 4 — Heatmap Cross-Year Split (`heatmap.js`)**
When a transaction is dated in a previous year and the navigator is showing the current year, the heatmap renders both years' canvases side by side.
- **Fix:** In `renderSpendingHeatmap()`, ensure `dailyData` is pre-filtered to only include entries for the selected `year`. The calling sites in `dashboard.js` and `transactions.js` must filter the data map before passing it in.
- **Files:** `src/ui/heatmap.js`, `src/ui/dashboard.js`, `src/ui/transactions.js`

**Bug 5 — Header Save-Dot Layout on Mobile (`css/main.css`)**
The auto-save indicator dot is rendering on a new line in the mobile header toolbar.
- **Fix:** Ensure the save dot element has `display:inline-flex` or `display:inline-block`. Use `flex-wrap: nowrap` on the header toolbar or a min-width guard.
- **File:** `css/main.css`, header toolbar styles

**Data Integrity Checker (INTEGRITY-01):**

Create `src/utils/data-integrity.js` that validates all FK-by-convention relationships across Dexie stores:
- `statements.debtId` → `debts.id`
- `childcareLedger.accountId` → `childcareAccounts.id`
- `recurrentExpenses.linkedStatementId` → `statements.id`
- `categoryMappings.categoryId` → `categories.id`
- `childcareProviders.accountId` → `childcareAccounts.id` (new store, added in Phase 35)

The checker must:
- Run on app startup (called from `src/app.js` init sequence)
- Run after every cloud pull (called from `cloud-sync.js` post-pull handler)
- Run after file import (called from import handler)
- Log all orphaned records to the console with store name and orphaned ID
- Surface a warning toast if integrity issues are found
- Offer to clean up (delete) orphaned records after user confirmation

**Files to Change:**
- `src/ui/cloud-sync.js`
- `src/ui/heatmap.js`
- `src/ui/dashboard.js` (heatmap data filter)
- `src/ui/transactions.js` (heatmap data filter)
- `css/main.css`
- `src/utils/data-integrity.js` (new)
- `src/app.js` (call `validateDataIntegrity()` on startup)

**Acceptance Criteria:**
- [ ] Push/Pull buttons trigger their handler exactly once per click, regardless of how many re-renders have occurred
- [ ] Cloud snapshot modal displays safely when store/table names contain `<`, `>`, `&`, `"` characters
- [ ] `cloudSyncUI.init()` is safe to call multiple times without registering duplicate listeners
- [ ] Heatmap shows only the selected year's data; no cross-year canvas split
- [ ] Auto-save dot and local icon appear on the same line in the mobile header
- [ ] `validateDataIntegrity()` correctly identifies orphaned records across all monitored stores
- [ ] `validateDataIntegrity()` runs on app startup and after cloud pull
- [ ] Warning toast is shown when integrity issues are found
- [ ] All 354+ existing Vitest tests pass after changes
- [ ] No new console errors on app load (HUMAN-VERIFICATION-REQUIRED)
- [ ] Manual check: toggle cloud sync push button rapidly — inspect console to confirm single invocation (HUMAN-VERIFICATION-REQUIRED)

---

### Phase 28 — Mobile Navigation Overhaul

**Priority:** P0
**Requirements:** MOB-01, MOB-02, NAV-01, NAV-02
**Complexity:** Medium

**Objective:** Make the main tab navigation permanently visible on all devices. On mobile, convert it to a fixed bottom bar with icons and labels. Make the header sticky. Eliminate the "disappearing tabs" regression reported for long-content pages.

**Background:**

The current navigation (`#mainTabs` / `.tabs`) is positioned in normal document flow inside a `.nav-container`. On pages with many chart elements or long transaction tables, the navigation scrolls off-screen. On mobile this is a severe usability regression.

**Target Design — Mobile (≤768px):**
- Fixed bottom bar: `position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000`
- Each tab: icon (emoji or SVG) + label text beneath
- Tab icons: Dashboard 🏠, Income 💰, Expenses 📋, Debts 💳, Payoff 📊, Assets 🏦, Childcare 👶, Settings ⚙️
- Height: ~56px (comfortable tap targets)
- All tab-panels must have `padding-bottom: 72px` to prevent content hiding behind the bar
- `#mobileMenuBtn` (hamburger): hidden on mobile when bottom bar is shown

**Breakpoint Strategy (MOB-01 requirement):**
- Default (>420px): full icon + label on each tab button
- `@media (max-width: 420px)`: label text truncated to maximum 6 characters with CSS `text-overflow: ellipsis; overflow: hidden; max-width: 6ch`
- `@media (max-width: 360px)`: icons only — label element set to `display: none`. Each icon element must maintain a 44×44px tap target (WCAG minimum). Tab buttons use `min-width: 40px; padding: 8px`.

This three-tier CSS mobile-first strategy ensures the bottom bar fits all realistic mobile viewport widths without overflow.

**Target Design — Desktop (>768px):**
- Keep existing horizontal tab bar at top — no change to desktop behaviour
- Make the header `position: sticky; top: 0; z-index: 100` so it persists on scroll

**Behaviour:**
- Active tab highlighted (colour accent, underline, or elevated icon)
- Tap switches tab-panel as before (existing JS logic in `src/app.js` reused)
- No hamburger menu on mobile — all 8 tabs visible simultaneously in the bottom bar

**Files to Change:**
- `css/main.css` — `.nav-container`, `.tabs`, `.tab`, `.tab-panel`, header sticky, mobile media query
- `index.html` — add icon markup to each tab button, remove hamburger button visibility
- `src/app.js` — remove hamburger toggle logic (or guard it behind desktop-only condition)

**Acceptance Criteria:**
- [ ] On mobile, tabs are always visible at the bottom of the screen regardless of scroll position
- [ ] Each mobile tab shows an icon and a short label
- [ ] On viewports ≤420px labels are truncated to 6 characters with ellipsis
- [ ] On viewports ≤360px only icons are shown; each tap target is ≥44×44px (WCAG minimum)
- [ ] No tab-panel content is hidden behind the bottom bar (sufficient padding-bottom)
- [ ] On desktop, tabs remain horizontal at top — no visual regression
- [ ] Header is sticky on desktop and mobile
- [ ] Switching tabs works correctly (renders the correct panel)
- [ ] Bottom bar z-index does not interfere with the Supabase magic link modal or notification toasts
- [ ] On PWA standalone mode, bar uses `padding-bottom: env(safe-area-inset-bottom)` for iOS safe area
- [ ] All 354+ Vitest tests pass
- [ ] Manual cross-device check on iOS Safari and Android Chrome (HUMAN-VERIFICATION-REQUIRED)

---

### Phase 29 — Mobile Table & Interaction Fixes

**Priority:** P0
**Requirements:** MOB-04, MOB-05, DEBT-04
**Complexity:** Medium

**Objective:** Fix all mobile table layout and interaction issues in the Income and Expenses tabs. Replace wide-column edit/delete buttons with swipe gestures. Fix category rendering in Expenses to use badge chips. Fix the "expenses created from debts" navigation target.

**Income Tab Issues:**
1. **Amount header wraps** — abbreviate or reduce padding so "Amount" fits on one line
2. **Date format** — two lines: `dd-MMM` on line 1, `YYYY` on line 2
3. **Edit/Delete buttons** — replace with swipe gestures (right-to-edit, left-to-delete) using `src/utils/gestures.js`

**Expenses Tab Issues:**
1. **Tab menu disappears** — Fixed in Phase 28 (bottom bar); this phase handles the table layout only
2. **Category column** — render as a badge chip, inline with the row
3. **Table headers overflow** — reduce to: `Date | Expense | Amount`. Status shown as an inline icon (✓ = paid, ○ = pending, ✗ = cancelled) and Category as a badge chip inside the Expense cell
4. **Date format** — same as Income: `dd-MMM / YYYY`
5. **Debt-linked expenses** — expenses generated from a debt record should navigate to the Debts tab when the row is tapped/swiped; no inline edit form
6. **Pending/Paid label** — replace text badge with compact icon (✓/○/✗) to save space

**Files to Change:**
- `src/ui/transactions.js` — date format, header layout, swipe gestures
- `src/ui/expenses.js` — category badge, header reduction, status icon, debt-link navigation, swipe gestures, date format
- `src/utils/gestures.js` — extend if table-row swipe-to-reveal is not already supported
- `css/main.css` — badge chip styles, table mobile overrides, status icon styles

**Acceptance Criteria:**
- [ ] Income table: "Amount" header does not wrap on any mobile viewport ≥320px
- [ ] Income table: dates display as `dd-MMM` / `YYYY` (two short lines)
- [ ] Income table: swipe-right reveals Edit, swipe-left reveals Delete (with haptic if enabled)
- [ ] Expenses table: headers are `Date | Expense | Amount` only (3 columns)
- [ ] Expenses table: category rendered as badge chip inside/below expense name
- [ ] Expenses table: status shown as ✓ (paid) / ○ (pending) / ✗ (cancelled) icon
- [ ] Expenses table: dates display as `dd-MMM` / `YYYY`
- [ ] Expenses table: debt-linked rows navigate to Debts tab when tapped/swiped
- [ ] Non-debt expenses: swipe-right = edit, swipe-left = delete
- [ ] Status icon has correct `aria-label` for accessibility
- [ ] All 354+ Vitest tests pass
- [ ] Manual check on narrow mobile viewport (HUMAN-VERIFICATION-REQUIRED)

---

### Phase 30 — Magic Link PWA / Auth Fix

**Priority:** P0
**Requirements:** MOB-07, SYNC-01
**Complexity:** Medium

**Objective:** Make Supabase magic link sign-in work correctly when the app is installed as a PWA or opened on a mobile browser. Diagnose and fix the redirect URI handling in the service worker and/or PWA manifest.

**Problem Analysis:**
Magic links are redirect-based. In the current PKCE flow, Supabase redirects to a URL like `https://app.example.com/?code=...`. When the app is installed as a PWA:
- On iOS: the system opens the URL in Safari, not in the installed PWA, breaking the auth flow
- The service worker may intercept the URL before the Supabase client completes the redirect flow

**Fix Strategy:**
1. Verify `emailRedirectTo` in `signInWithOtp` points to the deployed GitHub Pages URL
2. Exclude auth callback URLs containing `?code=` from the service-worker navigation fallback/cache path
3. Let Supabase JS v2 complete the redirect flow automatically on app load and clean stale auth params after sign-in succeeds
4. Show iOS standalone guidance because email deep links open Safari, not the installed app

**Files to Change:**
- `src/utils/supabase-sync.js` — verify `emailRedirectTo`
- `vite.config.js` — exclude auth callback URLs from Workbox navigation fallback
- `src/ui/cloud-sync.js` — clean stale auth params after successful sign-in and show iOS standalone guidance
- `.env.example` — document the deployed redirect URL

**Acceptance Criteria:**
- [ ] Clicking the magic link on Android can open the installed PWA and complete sign-in
- [ ] Auth state transitions to signed-in after magic link click in supported browser and PWA flows
- [ ] Service worker does not interfere with the auth callback path containing `?code=`
- [ ] iOS standalone mode shows guidance explaining that the link opens in Safari rather than the installed app
- [ ] Fallback: if PWA is not installed, magic link works in the mobile browser
- [ ] All 354+ Vitest tests pass
- [ ] Manual end-to-end test on iOS Safari (HUMAN-VERIFICATION-REQUIRED)
- [ ] Manual end-to-end test on Android Chrome (HUMAN-VERIFICATION-REQUIRED)

---

### Phase 31 — Banking Calendar Utility & Recurrence Upgrade

**Priority:** P1
**Requirements:** TECH-02, TECH-03, PLAN-03
**Complexity:** Medium-High
**Hard dependency:** Phase 31 must be complete before Phase 33 begins (income sources and spending buckets use the adjusted payment date API).

**Objective:** Build the `banking-calendar.js` utility and extend the recurrence engine. This is foundational for Phase 32 (debt amortisation with adjusted payment dates) and Phase 33 (income configuration with banking-calendar-aware payday display).


**Plans:** 2/2 plans complete
- [ ] 31-01-PLAN.md — Create banking-calendar.js (TDD): synchronous module, static fallback 2025-2027, localStorage cache, GOV.UK API refresh
- [ ] 31-02-PLAN.md — Schema v19 + recurrence.js paymentAdjustment integration, Settings button, app.js startup wire
**Schema Change:** IndexedDB schema bumped to **v13** in this phase. The `recurringExpenses` store gains `paymentAdjustment: 'none' | 'next-working-day'` field.

**Banking Calendar Utility (`src/utils/banking-calendar.js`):**
```js
// England & Wales bank holidays, rolling 3-year window
const BANK_HOLIDAYS = [ /* hardcoded ISO date strings */ ];

export function isWeekend(date) { ... }
export function isBankHoliday(date) { ... }
export function nextWorkingDay(date) { ... }  // advances past weekends and holidays
export function adjustedPaymentDate(nominalDate) { ... }  // returns nominalDate if working day, else nextWorkingDay
```

**Recurrence Engine Extension (`src/utils/recurrence.js`):**
- Add `paymentAdjustment?: 'none' | 'next-working-day'` to `RecurringExpense` type
- When generating occurrences, if `paymentAdjustment === 'next-working-day'`, pass each date through `adjustedPaymentDate()`
- Default: `'none'` (no change to existing behaviour)

**Files to Change:**
- `src/utils/banking-calendar.js` (new)
- `src/utils/recurrence.js`
- `src/db/schema.js` (v13 migration)
- `tests/banking-calendar.test.js` (new, ≥80% coverage per TECH-04)
- `tests/recurrence.test.js` (extend existing)

**Acceptance Criteria:**
- [ ] `nextWorkingDay('2026-04-03')` returns `'2026-04-07'` (Good Friday + Easter Monday skip)
- [ ] `nextWorkingDay('2026-08-29')` returns `'2026-09-01'` (Summer Bank Holiday skip)
- [ ] `nextWorkingDay('2026-12-25')` returns `'2026-12-29'` (Christmas + Boxing Day skip)
- [ ] Recurrence engine with `paymentAdjustment: 'next-working-day'` adjusts all weekend/bank-holiday dates
- [ ] Recurrence engine with `paymentAdjustment: 'none'` behaves identically to v2.7
- [ ] Schema v13 migration runs without errors on existing v12 data
- [ ] New tests achieve ≥80% line coverage for `banking-calendar.js`
- [ ] All 354+ existing Vitest tests pass

---

### Phase 32 — Debt Model Refactor — Loans & Mortgage

**Priority:** P0
**Requirements:** DEBT-01, DEBT-03
**Complexity:** High

**Objective:** Remove statement-based tracking for loans and mortgages. Replace with a predictive amortisation model. This frees the UI from requiring PDF/CSV imports for loan management, which the user never had.

**Schema Change:** IndexedDB schema bumped to **v14**. The `debts` store gains fields: `debtType: 'loan' | 'mortgage' | 'creditCard'`, `apr: number`, `originalTerm: number` (months), `monthlyPayment: number`, `paymentDate: number` (day of month), `confirmedBalance?: number`, `confirmedBalanceDate?: string`.

**Amortisation Model:**
```js
// src/utils/amortisation.js (new)
export function monthlyInterestRate(apr) { return apr / 100 / 12; }
export function remainingBalance(principal, apr, monthlyPayment, monthsElapsed) { ... }
export function projectedPayoffDate(principal, apr, monthlyPayment, startDate) { ... }
export function amortisationSchedule(principal, apr, monthlyPayment, startDate, periods) { ... }
```

**UI Changes:**
- Loan/mortgage debt cards: remove "Import Statement" and "Upload PDF" buttons
- Add "Confirm Balance" button → opens a modal to enter current actual balance
- Balance confirmation stores `confirmedBalance` + `confirmedBalanceDate` and restarts amortisation from that point
- Show amortisation schedule as a chart (monthly balance curve) on the debt card
- Warning if confirmed balance differs from computed balance by >5% (configurable threshold: `CONFIRM_BALANCE_WARNING_THRESHOLD = 0.05`)

**Files to Change:**
- `src/utils/amortisation.js` (new)
- `src/db/schema.js` (v14 migration)
- `src/ui/debts.js` — conditional rendering based on `debtType`
- `src/ui/debt-card.js` — new confirm balance flow, remove import buttons for loans/mortgages
- `tests/amortisation.test.js` (new, ≥80% coverage)

**Acceptance Criteria:**
- [ ] Loan/mortgage debt cards show no import statement or upload PDF buttons
- [ ] "Confirm Balance" button opens a modal; entering a new balance updates `confirmedBalance` and `confirmedBalanceDate`
- [ ] Warning toast shown when confirmed balance differs from computed balance by >5%
- [ ] Amortisation schedule chart visible on loan/mortgage card
- [ ] `projectedPayoffDate` is accurate to within ±1 month for standard amortisation
- [ ] Credit card debt cards remain unchanged
- [ ] Schema v14 migration runs without errors on v13 data
- [ ] `amortisation.test.js` achieves ≥80% line coverage
- [ ] All 354+ existing Vitest tests pass

---

### Phase 33 — Income & Spending Configuration

**Priority:** P0
**Requirements:** PLAN-06, PLAN-04, TECH-06
**Complexity:** Medium
**Hard dependency:** Phase 31 must be complete before Phase 33 begins.

**Objective:** Add two configurable income sources and a set of spending bucket estimates. Both are used by the Pay-Period Affordability Engine (Phase 34). Income payday display must use the banking calendar.

**Schema Change:** IndexedDB schema bumped to **v15**. Two new stores:
- `incomeSources`: `{ id, name, monthlyAmount, payDateRule, payDateDay? }`
- `spendingBuckets`: `{ id, name, monthlyAmount, icon? }`

**Cloud Sync Registration (TECH-06):** Both new stores must be added to the Supabase sync allowlist in `supabase-sync.js` immediately when created.

**Income Sources UI:**
- Settings panel section: "Income Sources"
- Add/edit/delete (max 2 sources enforced in the UI with a warning)
- `payDateRule` options: `'nth-of-month'` (with `payDateDay: 1..28`) | `'last-working-day'` | `'last-day'`
- Validation: when `payDateRule === 'nth-of-month'`, `payDateDay` must be present, integer, and in the range 1..28
- Display the banking-calendar-adjusted next payday for each source

**Spending Buckets UI:**
- Settings panel section: "Spending Buckets"
- Pre-populated defaults on first install: Groceries £400, Eating Out £100, Petrol/Transport £150, Entertainment £50, Clothing £50, Personal Care £30, Misc £50
- User can add/edit/delete buckets
- Each bucket: name, monthly estimate (£), optional emoji icon

**Files to Change:**
- `src/db/schema.js` (v15 migration, new stores)
- `src/ui/settings.js` — income sources section, spending buckets section
- `src/utils/supabase-sync.js` — register `incomeSources`, `spendingBuckets` stores
- `src/utils/income.js` (new) — `nextPayday(source)` using banking-calendar
- `tests/income.test.js` (new, ≥80% coverage)

**Acceptance Criteria:**
- [ ] Up to 2 income sources can be added, edited, and deleted in Settings
- [ ] Attempting to add a 3rd income source shows a warning and is blocked
- [ ] `payDateDay` validation enforces integer in range 1..28 when rule is `nth-of-month`
- [ ] Next payday is displayed using banking-calendar-adjusted date
- [ ] Spending buckets are pre-populated on first install
- [ ] Buckets can be added, edited, and deleted
- [ ] Both `incomeSources` and `spendingBuckets` stores are included in cloud backup/restore
- [ ] Schema v15 migration runs without errors on v14 data
- [ ] `income.test.js` achieves ≥80% line coverage
- [ ] All 354+ existing Vitest tests pass

---

### Phase 34 — Pay-Period Affordability Engine

**Priority:** P0
**Requirements:** PLAN-01, PLAN-02, PLAN-05
**Complexity:** High

**Objective:** Build the core engine and UI that answers the question: "How much can I safely pay extra toward my debts before my next payday?" This is the headline feature of v3.0.

**Engine Logic (`src/utils/affordability.js`):**
```plaintext
inputs:
  currentBalance: £
  currentDate: Date
  nextPayday: Date           ← from income sources (Phase 33)
  recurringExpenses: [...]   ← filtered to window [currentDate, nextPayday]
  spendingBuckets: [...]     ← prorated to remaining days in pay period
  childcareTopUps: [...]     ← from Phase 35 (optional at this phase, default [])
  safetyBuffer: £            ← user setting

output:
  projectedBalanceAtPayday: £
  totalCommittedOutgoings: £
  maxExtraPayment: £         ← max(0, projectedBalanceAtPayday - safetyBuffer)
  paymentTimeline: [{date, description, amount}]  ← sorted by date
```

**UI — Pay-Period Dashboard View:**
- Large display: "You can safely pay **£XXX** extra toward debts"
- Sub-display: current balance → projected balance at next payday
- Collapsible timeline: list of upcoming payments in the window with dates and amounts
- Persistent pay-period navigator (PLAN-05): "Pay period: 25 Mar → 24 Apr" with prev/next arrows
- "Balance Entry" button → opens modal to enter new current balance snapshot

**Files to Change:**
- `src/utils/affordability.js` (new)
- `src/ui/dashboard.js` — add affordability section
- `src/ui/balance-entry.js` (new modal component)
- `src/ui/pay-period-nav.js` (new navigator component)
- `tests/affordability.test.js` (new, ≥80% coverage)

**Acceptance Criteria:**
- [ ] Affordability calculation is correct for a known test fixture (manual verification)
- [ ] `maxExtraPayment` is never negative (floor at 0)
- [ ] Balance entry modal saves the snapshot and triggers recalculation
- [ ] Pay-period navigator shows correct period and navigates prev/next correctly
- [ ] Timeline lists all recurring expenses and prorated bucket amounts in date order
- [ ] Safety buffer is respected (user-configurable, default £200)
- [ ] `affordability.test.js` achieves ≥80% line coverage
- [ ] All 354+ existing Vitest tests pass
- [ ] Manual verification of affordability output against manual spreadsheet (HUMAN-VERIFICATION-REQUIRED)

---

### Phase 35 — Childcare Top-Up Planner

**Priority:** P0
**Requirements:** CHILD-01, CHILD-02, CHILD-03, TECH-06
**Complexity:** Medium

**Objective:** Answer "how much do I need to top up my Childcare Tax-Free accounts this period?" and include those amounts in the affordability calculation.

**Schema Change:** IndexedDB schema bumped to **v16**. New store:
- `childcareProviders`: `{ id, accountId, name, amount, frequency: 'monthly' | 'termly' }`

**Cloud Sync Registration (TECH-06):** `childcareProviders` store must be added to the Supabase sync allowlist in `supabase-sync.js`.

**Childcare Top-Up Calculation:**
```plaintext
For each childcare account:
  monthlySpend = sum of providers where:
    frequency === 'monthly' → amount
    frequency === 'termly'  → amount / 3
  requiredTopUp = max(0, monthlySpend - currentAccountBalance - pendingGovernmentBonus)
```

**UI Changes:**
- Childcare tab: new "Providers" sub-section per account — list of providers with name, amount, frequency
- Add/edit/delete providers
- Display: "Required top-up this period: £XXX" per account
- Display entitlement period (already in `src/utils/childcare.js` — surface it prominently)

**Integration with Affordability Engine:**
- `affordability.js` accepts `childcareTopUps` parameter (sum of required top-ups across both accounts)
- Top-ups appear as line items in the payment timeline

**Files to Change:**
- `src/db/schema.js` (v16 migration, new `childcareProviders` store)
- `src/ui/childcare.js` — providers sub-section, top-up calculation display
- `src/utils/supabase-sync.js` — register `childcareProviders` store
- `src/utils/affordability.js` — integrate childcare top-ups
- `tests/childcare-topup.test.js` (new, ≥80% coverage)

**Acceptance Criteria:**
- [ ] Providers can be added, edited, and deleted per childcare account
- [ ] Monthly equivalent is correctly calculated for termly providers (amount / 3)
- [ ] Required top-up is correctly calculated (spend − balance − pending bonus)
- [ ] Top-up amount appears as a line item in the pay-period affordability timeline
- [ ] Entitlement period is prominently displayed per account
- [ ] `childcareProviders` store is included in cloud backup/restore
- [ ] Schema v16 migration runs without errors on v15 data
- [ ] `childcare-topup.test.js` achieves ≥80% line coverage
- [ ] All 354+ existing Vitest tests pass

---

### Phase 36 — Navigator & View Toggle Redesign

**Priority:** P1
**Requirements:** NAV-02, NAV-03, MOB-03, MOB-02
**Complexity:** Medium

**Objective:** Replace the `<select>` view-toggle with a modern segmented control. Fix the heatmap year-boundary rendering (if not already resolved in Phase 27). Ensure the pay-period navigator is always fixed/visible.

**View Toggle (MOB-03):**
- Replace `<select id="viewRange">` with a custom `<div class="segmented-control">` component
- Segments: "This Month" | "Year to Date" | "All Time"
- Active segment: filled background in accent colour, white text
- Inactive: outline style
- Keyboard accessible (arrow keys navigate between segments)

**Navigator Fixed (NAV-02):**
- Pay-period navigator (from Phase 34) must be `position: sticky` at top of viewport on desktop and `position: fixed` on mobile (below the fixed header)

**Files to Change:**
- `src/ui/components/segmented-control.js` (new)
- `src/ui/dashboard.js` — replace select with segmented control
- `css/main.css` — segmented control styles, navigator position

**Acceptance Criteria:**
- [ ] Segmented control renders with 3 segments, correct active state
- [ ] Clicking/tapping a segment updates the view (Month/YTD/All Time)
- [ ] Keyboard navigation works (arrow keys cycle segments)
- [ ] Navigator is always visible without scrolling on both mobile and desktop
- [ ] No visual regression on desktop layout
- [ ] All 354+ Vitest tests pass
- [ ] Manual check on mobile (HUMAN-VERIFICATION-REQUIRED)

---

### Phase 37 — Cloud Snapshot Delta Preview

**Priority:** P1
**Requirements:** NAV-04
**Complexity:** Low

**Objective:** Change the cloud snapshot preview modal to show a diff (what has changed) rather than a full summary.

**Delta Logic:**
- On cloud pull, compare the incoming payload against the current IndexedDB state before applying
- Compute: added records, deleted records, updated records per store
- Show in modal: "+2 expenses added", "1 income deleted", "credit card balance updated", etc.
- If no previous snapshot exists (first sync), fall back to showing the full summary

**Files to Change:**
- `src/ui/cloud-sync.js` — `_bindPreviewListener()` delta computation
- `src/utils/snapshot-diff.js` (new)
- `tests/snapshot-diff.test.js` (new, ≥80% coverage)

**Acceptance Criteria:**
- [ ] Preview modal shows delta items (added/deleted/updated) not full list
- [ ] Delta is computed correctly for all monitored stores
- [ ] Falls back to full summary if no previous snapshot
- [ ] `snapshot-diff.test.js` achieves ≥80% line coverage
- [ ] All 354+ Vitest tests pass

---

### Phase 38 — GitHub Actions Node.js 24, Legacy Import & Technical Hygiene

**Priority:** P1
**Requirements:** TECH-01, TECH-04, INTEGRITY-02
**Complexity:** Low

**Objective:** Upgrade GitHub Actions to Node.js 24. Add legacy data import from v2.x. Ensure all new modules from v3.0 phases have ≥80% test coverage.

**Node.js 24 Upgrade (TECH-01):**
- Update `.github/workflows/*.yml` to use `node-version: '24'`
- Update any `actions/setup-node@v3` → `actions/setup-node@v4` if not already done
- Deadline: before June 2, 2026

**Legacy Data Import (INTEGRITY-02):**
- Settings panel: "Import v2.x Data" button
- File picker for a v2.x IndexedDB export JSON
- Validates: checks for known v2.x field names, reports incompatibilities
- Maps: old field names → new schema field names
- Reports: summary of what was imported and what was skipped
- Does not overwrite existing v3.0 data — merges or prompts

**Test Coverage Audit (TECH-04):**
- Run `vitest --coverage` and confirm all new modules from Phases 31–37 are at ≥80% line coverage
- Add missing tests for any module below threshold

**Files to Change:**
- `.github/workflows/deploy.yml` — Node.js 24
- `src/ui/settings.js` — legacy import section
- `src/utils/legacy-import.js` (new)
- `tests/legacy-import.test.js` (new, ≥80% coverage)

**Acceptance Criteria:**
- [ ] GitHub Actions workflow uses Node.js 24
- [ ] `actions/setup-node` is at v4 or later
- [ ] Legacy import accepts a v2.x JSON export and maps fields correctly
- [ ] Import summary is shown to the user after import
- [ ] All new v3.0 modules achieve ≥80% line coverage
- [ ] All 354+ Vitest tests pass (plus any new ones)

---

### Phase 39 — v3.0 Milestone Verification & Polish

**Priority:** P0
**Requirements:** All
**Complexity:** Low

**Objective:** Final integration testing, visual polish, and milestone sign-off for v3.0.

**Verification Checklist:**
- [ ] All P0 requirements are implemented and acceptance criteria met
- [ ] All P1 requirements are implemented (or formally deferred to v3.1 with a note)
- [ ] Full Vitest test suite passes (target: 400+ tests)
- [ ] Lighthouse mobile score ≥ 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] PWA install prompt works on Android Chrome
- [ ] Offline mode: app loads and displays cached data without network
- [ ] Cloud sync round-trip: sign in → push → sign out → sign in → pull → verify data integrity
- [ ] Banking calendar: payment dates adjust correctly for the next 6 months of upcoming UK bank holidays
- [ ] Affordability engine: manual verification against known test fixture (HUMAN-VERIFICATION-REQUIRED)
- [ ] Cross-browser: Chrome, Firefox, Safari (desktop)
- [ ] Cross-device: iPhone SE (375px), iPhone 14 Pro (393px), Samsung Galaxy S21 (360px), iPad (768px), Desktop 1440px
- [ ] WCAG AA: no critical accessibility violations (axe scan)
- [ ] No console errors on app load
- [ ] Version bump: update `package.json` version to `3.0.0`
- [ ] Tag: `git tag v3.0.0` after merge

**Polish Items:**
- Consistent loading states across all new UI components
- Consistent error states and user-facing error messages
- Animation/transition review: no janky transitions on mobile
- Colour contrast review for new badge chips and status icons

**Files to Change:**
- `package.json` (version bump)
- Any files with outstanding polish TODOs from previous phases

---

## Requirements Coverage Matrix

| Requirement | Phase |
|-------------|-------|
| SYNC-02 | 27 |
| NAV-01 | 27, 28 |
| NAV-03 | 27, 36 |
| MOB-06 | 27 |
| INTEGRITY-01 | 27 |
| MOB-01 | 28 |
| MOB-02 | 28, 36 |
| NAV-02 | 28, 36 |
| MOB-04 | 29 |
| MOB-05 | 29 |
| DEBT-04 | 29 |
| MOB-07 | 30 |
| SYNC-01 | 30 |
| TECH-02 | 31 |
| TECH-03 | 31 |
| PLAN-03 | 31 |
| DEBT-01 | 32 |
| DEBT-03 | 32 |
| PLAN-06 | 33 |
| PLAN-04 | 33 |
| TECH-06 | 33, 35 |
| PLAN-01 | 34 |
| PLAN-02 | 34 |
| PLAN-05 | 34 |
| CHILD-01 | 35 |
| CHILD-02 | 35 |
| CHILD-03 | 35 |
| NAV-04 | 37 |
| MOB-03 | 36 |
| TECH-01 | 38 |
| TECH-04 | 38 |
| INTEGRITY-02 | 38 |

---
*Last updated: 2026-03-14*
