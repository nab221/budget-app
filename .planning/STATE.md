---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: UX Fixes
status: verifying
stopped_at: Completed 48-02 — PERF-01 human-verified in browser; Phase 48 complete
last_updated: "2026-03-22T22:19:29.602Z"
last_activity: 2026-03-22 — 46-03 complete; INCOME-06..09 human-verified; Phase 46 done
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 28
  completed_plans: 28
  percent: 88
---

## Current Position

Phase: 46 of 46 (Income Card Edit/Delete/Unconfirm) — Complete
Plan: 3 of 3 complete in current phase (46-01, 46-02, 46-03 done)
Status: Phase 46 complete — INCOME-06, INCOME-07, INCOME-08, INCOME-09 all verified in live browser
Last activity: 2026-03-22 — 46-03 complete; INCOME-06..09 human-verified; Phase 46 done

Progress: [█████████░] 88%

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Based on my current account balance and all upcoming committed outgoings, tell me what I can afford to pay extra toward my debts between now and my next payday.
**Current focus:** Phase 41 — Bottom Nav Consistency & iOS Safe Area

## Accumulated Context

- v3.0 shipped 2026-03-18 with Pay-Period Affordability Engine, Banking Calendar, Debt Model Refactor, Childcare Top-Up Planner, Mobile Navigation Overhaul (Phases 27–39)
- Mobile bottom nav implemented in Phase 28 but inconsistencies remain across tabs — v3.1 targets these
- 722 Vitest tests passing as of Phase 41 Plan 02

### Decisions

- [v3.1 Roadmap]: 5 phases ordered by dependency — header first (audit-before-fix), then bottom nav (structural HTML change isolated), then tab buttons (independent), then debt history and income cards (feature work)
- [v3.1 Research]: Root cause of sticky header likely an overflow ancestor creating a per-tab scroll container — audit before writing CSS fixes
- [v3.1 Research]: `viewport-fit=cover` is missing from meta viewport tag — `env(safe-area-inset-bottom)` returns 0 on iPhones with home indicator; highest real-device impact fix in milestone
- [v3.1 Research]: Moving `.nav-container` to direct child of `<body>` is the correct fix for fixed-position containment trap
- [Phase 40]: Used ResizeObserver for --header-height so cloud-sync button injection doesn't break month-nav alignment
- [Phase 40]: Used behavior: instant for tab scroll reset to prevent jarring animation during content change
- [Phase 40]: CSS variables --header-height/--bottom-bar-height promoted to global :root with 56px/72px fallbacks; ResizeObserver overwrites at runtime
- [Phase 40 Verified]: Browser verification in Chrome DevTools at 390px confirmed HEADER-01, HEADER-02, HEADER-03, MONNAV-01 all passing
- [Phase 41]: viewport-fit=cover added to meta viewport — activates env(safe-area-inset-bottom) on iOS; .nav-container moved to direct body child to eliminate fixed-position containment trap; .shell mobile padding-bottom mirrors nav height including safe-area
- [Phase 41]: Use resolve.alias in vitest.config.js to stub virtual:pwa-register — cleaner resolution than per-test vi.mock for virtual modules
- [Phase 41]: Use typeof window.matchMedia === 'function' guard before calling matchMedia in _renderHeaderActions — jsdom in Vitest does not implement matchMedia, bare call throws TypeError
- [Phase 41]: CSS \!important on #cloudSyncActionsHeader at mobile breakpoint overrides JS classList.remove('hidden') — required because cloud-sync.js manages visibility via class manipulation
- [Phase 42-tab-button-uniformity]: Mobile .tab.active must explicitly reset all 7 desktop properties (border-radius, box-shadow, padding, border, font-weight, background, color) — partial reset causes cascade leak
- [Phase 42-tab-button-uniformity]: transition: color var(--tr) overrides desktop transition: all on mobile .tab — prevents pill-morph shape animation during tab tap
- [Phase 42-03]: Root cause of tab bar width expansion was CSS containment trap — position:fixed on .nav-container is trapped by transformed/overflow ancestors on Transactions/Payoff/Settings tabs; width:100% resolves against trapped ancestor's wider content box. Fix: use width:100vw (viewport units) which bypass all containment traps.
- [Phase 42 COMPLETE]: TABUI-01 and TABUI-02 confirmed by human verification 2026-03-20 — all 8 mobile tab buttons pixel-identical in height and shape; Payoff tab does not grow on activation
- [Phase 42-tab-button-uniformity]: Use viewport units (100vw) instead of percentage (100%) on fixed-position nav containers to bypass CSS containment traps from transformed/overflow ancestors
- [Phase 43]: Used real assertions in DEBT-05/06/07 test stubs (not placeholder fails) so Plan 02 has exact contracts to satisfy
- [Phase 43]: Extended recurrentExpenseRepository mock with getAll+add at vi.mock level (not just beforeEach) to ensure module-level mock resolution
- [Phase 43]: Used formatGBP (already imported) rather than formatCurrency — same function, already in scope
- [Phase 43]: Build historyHTML as plain string before safeHTML interpolation — lets DOMPurify sanitize full combined output
- [Phase 43]: generateHistoricalSchedule returns null (not []) for missing paymentStartDate — UI can distinguish unconfigured from no-past-payments
- [Phase 43]: Used getAll+filter upsert pattern for confirmLoanPayment — consistent with existing recurrentExpense access; no dedicated query by linkedDebtId exists
- [Phase 43]: span.innerHTML used directly in _renderLoanPaymentStatuses — post-render DOM updates consistent with showMarkPaidPrompt pattern; not safeHTML template literals
- [Phase 43]: Human browser verification gates phase 43 completion — Vitest covers functional correctness; browser confirms UI rendering, heatmap wiring, and regression safety for DEBT-05/06/07
- [Phase 44-income-tab-cards]: Wave 0 TDD: wrote failing test stubs before implementation — INCOME-01/02 RED, INCOME-03/04/05 GREEN (confirms existing confirmIncome/adjustIncome correctness)
- [Phase 44-income-tab-cards]: Keep old rendering methods in place (not deleted); openIncomeModal stub prevents runtime errors before Plan 03
- [Phase 44-income-tab-cards]: Global window handlers registered in _registerGlobalHandlers() called from init() — consistent with debt history modal pattern from Phase 43
- [Phase 44-income-tab-cards]: confirmIncomeEntry re-opens modal via incomeSources.openIncomeModal(sourceId) after save — refreshes status spans without full page render; 90-day look-forward window used in modal (wider than 45-day render window)
- [Phase 44-income-tab-cards]: Phase 39.1 stale tests updated for Phase 44 card grid: pending cards moved to modal, tests 4 and 8 updated to verify .grid3 card layout and open-income-modal de-dup respectively
- [Phase 44-income-tab-cards]: Human browser verification confirmed INCOME-01 through INCOME-05 all pass end-to-end — Phase 44 complete
- [Phase 45-transactions-tab-fixes]: jsdom bare <tbody> stripped as invalid top-level HTML — wrap in <table> for test DOM fixtures
- [Phase 45-transactions-tab-fixes]: Wave 0 TDD: TRANS-05 covered by two it-blocks for sortOrder default and ascending sort behavior
- [Phase 45-transactions-tab-fixes]: Replaced reconciliationMode ternary for income row with always-visible confirm-received button; recon header still shown via renderReconHeader
- [Phase 45-transactions-tab-fixes]: TRANS-03 test stub was self-contradicting (created element then asserted null) — fixed test fixture to reflect post-fix state before asserting
- [Phase 45-transactions-tab-fixes]: Used filterTransactions utility for unified search+category filtering — replaces manual .filter() chain and fixes broken category filter
- [Phase 45-transactions-tab-fixes]: Fixed self-contradicting TRANS-07 test fixture (hardcoded old placeholder, asserted new value) — updated fixture to post-fix state
- [Phase 45]: Store selectedCategories as strings; use String(c.id) in includes() to match checkbox.value type
- [Phase 45]: renderCategoryFilter fetches transactions inline to compute month-scoped category list — avoids restructuring render() call chain
- [Phase 45]: Debt rows use redirect button (data-tab=debts) matching income row pattern — restores pre-merge behaviour lost during Transactions tab consolidation
- [Phase 46-income-card-edit-delete-and-unconfirm-functionality]: Extend incomeRepository mock at vi.mock level so update+delete are available when module is first imported; INCOME-09 stubs added alongside INCOME-08 as plan body requires both
- [Phase 46]: Remove inline onclick=stopPropagation from card buttons; call e.stopPropagation() inside delegated handler branches so delegation fires correctly
- [Phase 46]: Confirmed entry edit/unconfirm: use allIncome.find() to correlate record; cancelEditIncomeEntry re-opens modal rather than rebuilding HTML inline
- [Phase 46]: Human browser verification gates Phase 46 completion — Vitest covers functional contracts; browser confirms UX correctness of form pre-population, dialog flow, modal refresh, and cross-tab sync
- [Phase 47-desktop-nav-sticky-dead-code-removal]: Mobile .nav-container override must include top: auto to prevent desktop sticky top: var(--header-height) bleeding through position: fixed on mobile
- [Phase 47-desktop-nav-sticky-dead-code-removal]: Phase 47 CLEAN-01: getBoundingClientRect block removed from dashboard.js; app.js ResizeObserver is confirmed sole writer of --header-height
- [Phase 48-app-refresh-double-render-fix]: Register app:refresh listener in beforeEach to expose double-render without calling init() — clean teardown via named reference in afterEach
- [Phase 48-app-refresh-double-render-fix]: Use window.transactionUI?.render() and window.debtUI?.render() (optional chaining, window globals not imports) to replace app:refresh dispatches and avoid circular import risk
- [Phase 48-app-refresh-double-render-fix]: Use window.transactionUI?.render() and window.debtUI?.render() (optional chaining, window globals not imports) to replace app:refresh dispatches and avoid circular import risk

### Roadmap Evolution
- Phase 46 added: Income card edit delete and unconfirm functionality

### Blockers/Concerns

- [Phase 42-03 RESOLVED] TABUI-01 and TABUI-02 confirmed by human verification 2026-03-20. Phase 42 complete.
- [Phase 41] iOS safe-area fixes must be verified on real iPhone or Safari simulator — Chrome DevTools will not expose the missing `viewport-fit=cover` issue
- [Phase 41 BLOCKED] 41-03 verification FAILED 2026-03-20 — 4 issues require fixes before BOTNAV requirements can be confirmed:
  1. Bottom nav visible on desktop (regression) — must be hidden above mobile breakpoint
  2. Nav not fixed on Transactions, Payoff, Settings tabs — overflow/transform ancestor trapping fixed positioning
  3. Header collapses differently on Dashboard vs Transactions — inconsistent sticky-header behaviour
  4. Auto-save UI (cloud-sync button, traffic-light) visible on mobile — must be hidden on mobile to preserve header space; local storage does not function on mobile

## Session Continuity

Last session: 2026-03-22T22:19:29.570Z
Stopped at: Completed 48-02 — PERF-01 human-verified in browser; Phase 48 complete
Resume file: None
