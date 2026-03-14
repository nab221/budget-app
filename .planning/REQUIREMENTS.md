# Requirements: Budget App v3.0

## Requirement Categories

- **PLAN** — Budget planning core features
- **DEBT** — Debt management and payoff
- **CHILD** — Childcare Tax-Free account management
- **MOB** — Mobile/PWA experience
- **NAV** — Navigation and layout
- **SYNC** — Cloud sync and auth
- **FIX** — Bug fixes from identified issues
- **TECH** — Technical/infrastructure improvements
- **INTEGRITY** — Data integrity & portability

---

## PLAN — Budget Planning Core

### PLAN-01 · Current Balance Entry (P0)
The user must be able to enter their current account balance manually (pulled from their bank app). This becomes the starting point for the "how much can I afford?" calculation.
- Input: current balance (£), date it was checked
- The entered balance replaces any computed balance for that snapshot

### PLAN-02 · Pay-Period Affordability View (P0)
Given the current balance and all upcoming committed outgoings until the next expected payday, the app must display:
- Estimated balance at the next payday
- Total committed outgoings in that window
- Suggested maximum extra debt payment without going below a user-defined safety buffer
- A timeline/list of upcoming payments in the window with their dates

### PLAN-03 · Banking Calendar Awareness (P1)
All recurring payment dates must shift to the next working day (Mon–Fri, non-UK-bank-holiday) when the scheduled date falls on a Saturday, Sunday, or a UK public bank holiday.
- Cover England & Wales bank holidays
- Recurrence engine must expose an adjusted date for display
- Affects: mortgage, personal loan, direct debits, any fixed recurring expense

### PLAN-04 · Spending Buckets (P1)
A set of user-configurable estimated spending buckets for the period:
- Default buckets: Groceries, Eating Out, Petrol/Transport, Entertainment, Clothing, Personal Care, Misc
- Each bucket has a monthly estimated amount
- Buckets appear in the affordability calculation as committed outgoings (prorated to the remaining days if within a pay period)
- Bucket prorating formula: `dailyRate = monthlyAmount / daysInMonth; proratedAmount = dailyRate × daysRemainingInPayPeriod`
- Buckets are not tracked per-transaction — they are estimates

### PLAN-05 · Pay-Period Navigator (P1)
A clearly visible, persistent navigator showing which pay period is being viewed.
- Shows: "Pay period: 25 Mar → 24 Apr" style display
- Previous/next arrows to navigate between pay periods
- On mobile: fixed at top of screen below header

### PLAN-06 · Income Configuration (P0)
Support for exactly two income sources with:
- Name (e.g. "NHS Salary", "Locum")
- Expected monthly amount
- Expected pay date (e.g. "last working day of month", "25th", etc.)
- Banking-calendar adjusted date displayed
- Validation: when `payDateRule === 'nth-of-month'`, `payDateDay` must be present, integer, and in the range 1..28

---

## DEBT — Debt Management

### DEBT-01 · Loan & Mortgage — Projection Model (P0)
Loans and mortgages must NOT use statements. Instead, they use a predictive amortisation model:
- Store: outstanding balance, interest rate (APR), original term, monthly payment amount, payment date
- Optionally: confirm actual balance if user made an extra payment
- Display: remaining balance, projected payoff date, amortisation schedule visualisation
- Remove the statement import/PDF upload buttons from loan/mortgage debt cards

### DEBT-02 · Credit Card — Statements Retained (P0)
Credit card debt management with statement import remains. Keep existing PDF/CSV statement import. Keep reconciliation workflow. No changes to CC debt flow unless a bug fix.

### DEBT-03 · Debt Snapshot Confirmation (P1)
For loans and mortgages, allow the user to confirm/update the current balance at any time (e.g. after making an overpayment). This updates the amortisation model's starting point.
- When the confirmed balance differs from the computed balance by more than 5% (configurable via `CONFIRM_BALANCE_WARNING_THRESHOLD`), show a warning before finalizing.
- Confirm action does not retroactively change posted transactions.

### DEBT-04 · Expense Link for Debt Payments (P1)
When a regular debt payment (mortgage, loan, minimum CC payment) is added to the expenses tab, the edit/delete swipe actions on the Expenses tab for that entry must navigate to the corresponding Debt tab record — not trigger an inline edit form.

---

## CHILD — Childcare Tax-Free Accounts

### CHILD-01 · Recurring Childcare Expense Tracking (P0)
Currently childcare tracks deposits and ledger entries but does NOT answer "how much do I need to top up this month?". Add:
- Per-account: list of regular childcare providers with their monthly/termly cost
- Calculate: total periodic spend from the account
- Display: "Required top-up this period" = total spend − current account balance − any pending government bonus
- For 'termly' frequency, `monthlyEquivalent = amount / 3`

### CHILD-02 · Childcare Top-Up Reminder in Pay-Period View (P1)
The required childcare top-up amounts for both children must appear as committed outgoings in the pay-period affordability calculation (PLAN-02).

### CHILD-03 · Entitlement Period Display (P1)
Show the current entitlement period clearly on the childcare tab per account (already partially implemented in `src/utils/childcare.js` — surface in UI).

---

## MOB — Mobile / PWA

### MOB-01 · Fixed Bottom Tab Bar (P0)
On mobile, the tab navigation must be fixed at the bottom of the screen at all times, regardless of scroll position. Tabs must show an icon and a label beneath it (like native iOS/Android bottom bars).
- Must not disappear when the page is long (dashboard charts, transaction lists, etc.)
- Tab bar height must be constant; page content must have sufficient bottom padding
- Viewports below 360px switch to icons-only (maintaining 44×44px tap target). Between 360–420px, labels are truncated to a maximum of 6 characters with ellipsis. CSS mobile-first strategy: default full labels, `@media (max-width:420px)` truncation, `@media (max-width:360px)` icons-only.

### MOB-02 · Fixed Top Navigation / Pay-Period Bar (P0)
On mobile, the pay-period navigator (PLAN-05) must be fixed at the top of the page below the header. The header itself should also remain fixed/sticky so the user always sees it.

### MOB-03 · View Toggle — Modern Radio Design (P1)
The current `<select>` dropdown for "Month View / Year to Date / All Time" must be replaced with a segmented-control / radio-toggle group that is visually modern and part of the navigator area.

### MOB-04 · Income Tab Mobile Fix (P0)
- Table header: "Amount" must not wrap to two lines — abbreviate or reduce padding
- Date column: format as `dd-MMM` / `YYYY` across two lines with a clear break
- Edit/Delete buttons: replace with swipe-right (edit) and swipe-left (delete) gestures using the existing gesture utility

### MOB-05 · Expenses Tab Mobile Fix (P0)
- Tab menu must remain visible (sticky/fixed) — not disappear when scrolling
- Category column: render as a badge chip (matching Income tab style) instead of a table header
- Table headers: reduce to `Date`, `Expense`, `Amount` only — remove Status column header (show status as a small indicator on the row instead)
- Date: same format as MOB-04
- Edit/Delete/Swipe: entries created from Debts must navigate to Debts tab; other entries use swipe edit/delete
- Pending/Paid: replace with a single tick/cross icon (✓/✗) or badge to save column space

### MOB-06 · Header Layout Fix (P0)
On mobile, the auto-save dot indicator is rendering on a different line from the local sync icon. Both must be on the same line in the header toolbar.

### MOB-07 · Magic Link Authentication on PWA/Mobile (P0)
Magic link sign-in does not work when the app is installed as a PWA or accessed on mobile. Root cause: deep-link / redirect URL is not handled correctly in the service worker or PWA manifest.
- Investigate and fix redirect URI so that clicking the magic link in a mobile email opens the installed PWA and completes authentication

---

## NAV — Navigation & Layout

### NAV-01 · Tabs Always Visible (P0)
Tabs (main navigation) must be visible at all times on all screen sizes — they must not disappear when content is long. (Already reported as a known bug.)

### NAV-02 · Navigator Always Fixed / Visible (P0)
The month/pay-period navigator must be sticky/fixed so it is always accessible without scrolling to the top. On mobile it should be below the fixed header.

### NAV-03 · Heatmap Year Boundary Fix (P0)
When a transaction exists in the previous year, the heatmap breaks and renders across two years simultaneously. The heatmap must only display the year currently selected via the navigator — transactions outside that year must be filtered to the correct calendar year's canvas.

### NAV-04 · Cloud Snapshot Preview — Delta Mode (P1)
The cloud snapshot preview modal currently shows a full summary of all items. Instead it should show only what has changed since the last cloud snapshot:
- "+1 income added", "1 expense deleted", "credit card balance updated", etc.
- Fall back to a full summary if no previous snapshot exists for comparison

---

## SYNC — Cloud Sync & Auth

### SYNC-01 · Magic Link PWA Fix (P0)
See MOB-07 — deduplication of requirement. Ensure the Supabase magic link redirect works in PWA standalone mode on iOS and Android.

### SYNC-02 · Init Guard & Listener Leak Fix (P0)
Known bugs in `cloud-sync.js`:
- Event listener accumulation on re-render (QUICK_FIX_REFERENCE Issue #1)
- XSS risk in modal cloud snapshot preview (QUICK_FIX_REFERENCE Issue #2)
- Multiple init guard missing (QUICK_FIX_REFERENCE Issue #3)

---

## TECH — Technical Improvements

### TECH-01 · GitHub Actions Node.js 24 Upgrade (P1)
GitHub Actions Node.js 20 deprecation deadline is June 2, 2026. Upgrade all actions to Node.js 24 compatible versions.

### TECH-02 · Banking Calendar Utility (P1)
Create a `src/utils/banking-calendar.js` module:
- UK bank holidays list (fetched from GOV.UK API or hardcoded for rolling 3 years)
- `nextWorkingDay(date)` function
- `adjustedPaymentDate(nominalDate)` function used by recurrence engine

### TECH-03 · Recurrence Engine — Working Day Support (P1)
Extend `src/utils/recurrence.js` to support `paymentAdjustment: 'next-working-day'` option, delegating to the banking calendar utility.

### TECH-04 · Test Coverage for New Modules (P1)
All new utility modules must have Vitest unit test coverage ≥ 80%.

### TECH-05 · Print / Export to PDF (P2)
Budget summary printable view / PDF export for sharing with a financial advisor or personal reference.

### TECH-06 · Cloud Sync Store Registration (P0)
When new IndexedDB stores are added (`incomeSources`, `spendingBuckets`, `childcareProviders`), they must be registered in the Supabase sync allowlist in `supabase-sync.js`. Without this, new data won't survive a cloud backup/restore cycle.

---

## INTEGRITY — Data Integrity & Portability

### INTEGRITY-01 · Referential Integrity Validator (P0)
A utility function `validateDataIntegrity()` that checks all FK-by-convention relationships across stores:
- `statements.debtId` → `debts.id`
- `childcareLedger.accountId` → `childcareAccounts.id`
- `recurrentExpenses.linkedStatementId` → `statements.id`
- `categoryMappings.categoryId` → `categories.id`
- `childcareProviders.accountId` → `childcareAccounts.id` (new store, Phase 35)

Must run on:
- App startup
- After cloud pull
- After file import

Must log and surface any orphaned records and offer to clean them up. Surface a warning toast if integrity issues are found.

### INTEGRITY-02 · Legacy Data Import (P2)
Settings panel function to import data from v2.x format. Validates compatibility, maps old fields to new schema, and reports what could and couldn't be imported. Since the app is not in active use, this is a convenience feature rather than critical.

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| P0 | Must have — v3.0 blocked without it |
| P1 | Should have — important for full v3.0 value |
| P2 | Nice to have — defer to v3.1 if needed |

---
*Last updated: 2026-03-14*
