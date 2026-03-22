# Roadmap: Budget App

## Milestones

- ✅ **v3.0 Budget Planning Core Redesign** — Phases 27–39 (shipped 2026-03-18)
- 🚧 **v3.1 UX Fixes** — Phases 40–44 (in progress)

---

<details>
<summary>✅ v3.0 Budget Planning Core Redesign (Phases 27–39) — SHIPPED 2026-03-18</summary>

Phases 27–39 archived to `.planning/milestones/v3.0-phases/`

</details>

---

## 🚧 v3.1 UX Fixes (In Progress)

**Milestone Goal:** Fix navigation consistency across all tabs — sticky top header on every tab, consistent always-visible mobile bottom nav on every tab, and uniform tab button size and shape. Deliver debt transaction history modal and income tab card layout as companion features.

## Phases

- [x] **Phase 40: Sticky Header & Month Navigator** — Top header sticks on all 8 tabs; scroll shadow appears when scrolled; month nav positions correctly below header
- [x] **Phase 41: Bottom Nav Consistency & iOS Safe Area** — VERIFICATION FAILED 2026-03-20; 4 issues require code fixes before BOTNAV requirements can be confirmed (completed 2026-03-20)
- [x] **Phase 42: Tab Button Uniformity** — All 8 tab buttons identical height and shape in active and inactive states; Payoff tab no longer changes shape on tap
- [x] **Phase 43: Debt History Modal** — Loan and mortgage transaction history modal with expected payment dates, paid confirmation, and amount adjustment (completed 2026-03-20)
- [x] **Phase 44: Income Tab Cards** — Income tab shows income source cards; user can confirm, date-change, and amount-adjust income entries from a modal (completed 2026-03-21)
- [x] **Phase 45: Transactions Tab Fixes** — Mark as paid for expenses, income confirm, single reconciliation mode, unified Add button, sort toggle, ±amount display, correct search label, full category filter (completed 2026-03-22)

## Phase Details

### Phase 40: Sticky Header & Month Navigator
**Goal**: Users see a sticky top header on all 8 tabs that masks scrolling content, shows a scroll shadow when the page is scrolled, and keeps the month navigator correctly anchored below it with no overlap.
**Depends on**: Nothing (first v3.1 phase)
**Requirements**: HEADER-01, HEADER-02, HEADER-03, MONNAV-01
**Success Criteria** (what must be TRUE):
  1. User scrolls down on any of the 8 tabs and the top header remains fixed at the top of the viewport — it does not scroll away
  2. User sees a shadow separator appear on the header only after scrolling down from the top of the page; no shadow is visible when at the top
  3. User switches tabs and immediately sees the page reset to the top — no tab opens mid-scroll
  4. Month navigator (on the Transactions tab) sticks immediately below the header while scrolling with no gap, overlap, or misalignment regardless of whether notification banners are visible
**Plans**: 2 plans
Plans:
- [x] 40-01-PLAN.md — CSS + JS implementation (--header-height promotion, header::before, scroll shadow, ResizeObserver, scrollTo on tab switch)
- [x] 40-02-PLAN.md — Browser verification checkpoint (human confirms all 4 phase requirements)

### Phase 41: Bottom Nav Consistency & iOS Safe Area
**Goal**: The mobile bottom tab bar is fixed and visible at the bottom of every tab at all times, tab content does not scroll behind it, iOS home-indicator devices show correct safe-area padding, and the PWA update bar appears above (not over) the nav.
**Depends on**: Phase 40
**Requirements**: BOTNAV-01, BOTNAV-02, BOTNAV-03, BOTNAV-04
**Success Criteria** (what must be TRUE):
  1. User scrolls to the bottom of any content-heavy tab (Transactions, Income) on a mobile device and the bottom nav bar remains fully visible — it is never obscured by content
  2. The last content item on every tab is fully visible above the bottom nav bar — no content is hidden behind the bar
  3. On an iPhone with a home indicator, the bottom nav bar does not overlap the home indicator; the safe-area inset is visually respected
  4. When a PWA service-worker update is available, the update notification bar appears above the bottom nav bar — the nav icons remain fully tappable
**Plans**: 4 plans
Plans:
- [x] 41-01-PLAN.md — HTML + CSS foundation (viewport-fit=cover, .nav-container moved to body, .shell safe-area padding)
- [x] 41-02-PLAN.md — PWA update bar implementation (onNeedRefresh wired, _showUpdateBar/_hideUpdateBar, mobile CSS offset)
- [ ] 41-03-PLAN.md — Browser verification checkpoint (FAILED — 4 issues found; code fixes needed before re-verification)
- [ ] 41-04-PLAN.md — Gap closure: desktop display:none, iOS will-change fix, auto-save mobile hide, re-verification checkpoint

### Phase 42: Tab Button Uniformity
**Goal**: All 8 mobile bottom tab buttons are pixel-identical in height and shape whether active or inactive — the Payoff tab button does not change shape or size when tapped.
**Depends on**: Phase 41
**Requirements**: TABUI-01, TABUI-02
**Success Criteria** (what must be TRUE):
  1. User taps through all 8 tabs on a mobile device and observes that each tab button maintains the same height and outer shape in both active and inactive states
  2. User taps the Payoff tab button and it does not grow, shrink, gain a pill background, or change border-radius compared to its inactive state
**Plans**: 2 plans
Plans:
- [x] 42-01-PLAN.md — CSS fix (expand mobile .tab.active reset, add transition: color, add .tab:active suppress rule)
- [x] 42-02-PLAN.md — Browser verification FAILED 2026-03-20 — Payoff tab width expansion gap found (61.38px vs 51.5px active width; bar grows 412px → 491px); TABUI-01 and TABUI-02 unconfirmed
- [x] 42-03-PLAN.md — Gap closure: width:100vw on .nav-container and .tabs bypasses CSS containment trap; human verification APPROVED 2026-03-20; TABUI-01 and TABUI-02 confirmed

### Phase 43: Debt History Modal
**Goal**: Users can open a payment history modal for any loan or mortgage debt, see all expected historical payment dates, confirm individual payments as paid so they appear on the heatmap, and adjust the amount of any payment before confirming.
**Depends on**: Phase 40
**Requirements**: DEBT-05, DEBT-06, DEBT-07
**Success Criteria** (what must be TRUE):
  1. User opens a loan or mortgage debt card and finds a button to view transaction history; tapping it opens a modal listing every expected payment date from the loan start date up to today
  2. User selects an unconfirmed payment in the modal, confirms it as paid, and the payment subsequently appears on the debt heatmap
  3. User adjusts the payment amount on a specific historical entry before confirming — the confirmed amount saved reflects the edited value, not the scheduled amount
**Plans**: 4 plans
Plans:
- [ ] 43-01-PLAN.md — Test stubs (Nyquist Wave 0: DEBT-05/06/07 failing tests + extended repository mock)
- [ ] 43-02-PLAN.md — generateHistoricalSchedule + payment history list in modal HTML (DEBT-05)
- [ ] 43-03-PLAN.md — getConfirmedPaymentMap + confirmLoanPayment + inline confirm wiring (DEBT-06, DEBT-07)
- [ ] 43-04-PLAN.md — Human verification checkpoint (DEBT-05, DEBT-06, DEBT-07 confirmed in browser)

### Phase 44: Income Tab Cards
**Goal**: The Income tab displays each configured income source as a card matching the Debt tab card layout, and users can open a modal per card to confirm, reschedule, or adjust individual income entries.
**Depends on**: Phase 40
**Requirements**: INCOME-01, INCOME-02, INCOME-03, INCOME-04, INCOME-05
**Success Criteria** (what must be TRUE):
  1. User navigates to the Income tab and sees each income source displayed as a card that visually matches the card style used in the Debt tab
  2. User taps an income source card and a modal opens showing the income entries (upcoming and recent) for that source
  3. User selects an income entry in the modal and confirms it as received — the entry is marked as received and the UI reflects the updated state
  4. User changes the date of an upcoming income entry in the modal — the new date is saved and displayed correctly
  5. User adjusts the amount of a specific income entry in the modal — the adjusted amount is saved and shown in the entry
**Plans**: 4 plans
Plans:
- [ ] 44-01-PLAN.md — Test stubs (Nyquist Wave 0: INCOME-01..05 failing tests, mock setup for repository/render/income utils)
- [ ] 44-02-PLAN.md — Card grid layout: _renderSourceCards replaces _renderSourceList, safeHTML import, open-income-modal delegation (INCOME-01)
- [ ] 44-03-PLAN.md — Modal flow: openIncomeModal, _buildIncomeModalHTML, _renderIncomeEntryStatuses, window global handlers (INCOME-02, INCOME-03, INCOME-04, INCOME-05)
- [ ] 44-04-PLAN.md — Human browser verification checkpoint (INCOME-01 through INCOME-05 confirmed)

### Phase 45: Transactions Tab Fixes
**Goal**: Restore and improve the Transactions tab — mark-as-paid for expenses, income confirm, remove duplicate reconciliation mode, unified Add button, sort order toggle, ±amount prefix, correct search label, and full category filter including debts.
**Depends on**: Phase 40
**Requirements**: TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05, TRANS-06, TRANS-07, TRANS-08
**Success Criteria** (what must be TRUE):
  1. User can mark an expense transaction as paid from the Transactions tab and the status updates visibly
  2. User can confirm an income transaction as received from the Transactions tab
  3. Transactions tab shows exactly one reconciliation mode button
  4. User taps a single "Add" button and can select income or expense type before completing the form
  5. User toggles sort order and the list re-renders newest-first or oldest-first as selected
  6. Expense amounts show with a − prefix; income amounts show with a + prefix
  7. Search bar placeholder reads "Search transactions"
  8. Category filter dropdown includes debt-linked transaction categories
**Plans**: 4 plans
Plans:
- [ ] 45-01-PLAN.md — Test stubs (Wave 0: TRANS-01..08 failing tests, mock pattern from expenses.test.js)
- [ ] 45-02-PLAN.md — Action buttons: mark-paid expense rows, confirm-received income rows, remove duplicate recon button, unified Add button (TRANS-01, TRANS-02, TRANS-03, TRANS-04)
- [ ] 45-03-PLAN.md — Display/UX: sort order toggle, ± amount prefix, search placeholder fix, full category filter + filterTransactions wiring (TRANS-05, TRANS-06, TRANS-07, TRANS-08)
- [ ] 45-04-PLAN.md — Human browser verification checkpoint (TRANS-01 through TRANS-08 confirmed)

## Progress

**Execution Order:** 40 → 41 → 42 → 43 → 44 → 45 → 46
(Note: Phases 43, 44, and 45 both depend on Phase 40 and can run in parallel with each other after Phase 42 if needed, but sequential is recommended.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 40. Sticky Header & Month Navigator | 2/2 | Complete    | 2026-03-19 |
| 41. Bottom Nav Consistency & iOS Safe Area | 4/4 | Complete    | 2026-03-20 |
| 42. Tab Button Uniformity | 3/3 | Complete    | 2026-03-20 |
| 43. Debt History Modal | 4/4 | Complete    | 2026-03-20 |
| 44. Income Tab Cards | 4/4 | Complete    | 2026-03-21 |
| 45. Transactions Tab Fixes | 5/5 | Complete    | 2026-03-22 |
| 46. Income Card Edit/Delete/Unconfirm | 3/3 | Complete    | 2026-03-22 |
| 47. Desktop Nav Sticky + Dead Code Removal | 1/1 | Complete    | 2026-03-22 |
| 48. app:refresh Double-Render Fix | 1/2 | In Progress|  |
| 49. Reconciliation Mode & Legacy Button Audit | 0/0 | Pending     | — |

### Phase 46: Income card edit delete and unconfirm functionality

**Goal:** Fix income source card Edit/Delete buttons (currently broken) and add edit/unconfirm capability to confirmed income entries in the modal — so users can correct wrong amounts or dates and revert mistaken confirmations.
**Requirements**: INCOME-06, INCOME-07, INCOME-08, INCOME-09
**Depends on:** Phase 45
**Plans:** 3/3 plans complete

Plans:
- [ ] 46-01-PLAN.md — Wave 0 TDD: failing test stubs for INCOME-06..09 + extend incomeRepository mock with update/delete
- [ ] 46-02-PLAN.md — Implementation: fix card Edit/Delete delegation, confirmed entry shows amount+date+Edit+Unconfirm, saveEditedIncomeEntry/unconfirmIncomeEntry global handlers
- [ ] 46-03-PLAN.md — Human browser verification checkpoint (INCOME-06 through INCOME-09 confirmed)

### Phase 47: Desktop Nav Sticky + Dead Code Removal

**Goal:** Fix the desktop navigation bar so it stays visible when the user scrolls (currently scrolls off-screen), and remove the dead one-shot `getBoundingClientRect()` measurement in `dashboard.js` that was superseded by Phase 40's ResizeObserver.
**Requirements**: DESK-01, CLEAN-01
**Depends on:** Phase 46
**Tech debt closes:** TODO-NAV-01 (Phase 41), dead code (Phase 40)
**Plans:** 1/1 plans complete

Plans:
- [ ] 47-01-PLAN.md — CSS sticky fix + dead code removal + human browser verification (DESK-01, CLEAN-01)

### Phase 48: app:refresh Double-Render Fix

**Goal:** Consolidate `app:refresh` event handling so that `toggleExpenseStatus` triggers at most one render pass per UI module — eliminating the double-render of `transactionUI` and `expensesUI` that currently fires on every expense status toggle.
**Requirements**: PERF-01
**Depends on:** Phase 46
**Tech debt closes:** double-render (Phase 45)
**Plans:** 1/2 plans executed

Plans:
- [ ] 48-01-PLAN.md — Wave 0 TDD: 3 failing PERF-01 tests in expenses.test.js (render count + no-dispatch assertions)
- [ ] 48-02-PLAN.md — Fix both app:refresh dispatches in expenses.js + human browser verification (PERF-01)

### Phase 49: Reconciliation Mode & Legacy Button Audit

**Goal:** Audit all legacy buttons in the Transactions tab (reconciliation mode, Mark All As Paid, Trigger Recurrence) — determine what each currently does or fails to do in the current app, then either wire them up properly or remove them so no dead/broken buttons remain.
**Requirements**: RECON-01, RECON-02
**Depends on:** Phase 46
**Tech debt closes:** reconciliation mode deferred (Phase 45)
**Plans:** TBD

---
*v3.1 roadmap created: 2026-03-18*
