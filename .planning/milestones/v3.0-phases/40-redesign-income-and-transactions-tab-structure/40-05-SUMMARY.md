---
phase: 40-redesign-income-and-transactions-tab-structure
plan: "05"
subsystem: ui
tags: [tabs, css, icons, nav-order, listener-dedup, tdd, gap-closure]

requires:
  - phase: 40-02
    provides: Transactions tab wired in index.html + app.js; income-sources tab present

provides:
  - css/main.css: ::before icon rules for data-tab="transactions" (💸) and data-tab="income-sources" (💰)
  - index.html: Tab order Dashboard → Transactions → Income → Debts → Payoff → Assets → Childcare → Expenses → Settings
  - src/ui/income-sources.js: _boundClickHandler guard in _bindEvents — single add produces single entry and single notification

affects:
  - css/main.css (added 2 icon rules, removed dead income rule)
  - index.html (tab button order rewritten)
  - src/ui/income-sources.js (_boundClickHandler property, _bindEvents remove-then-add)
  - tests/income-sources.test.js (Tests 7+8 added for de-duplication)

tech-stack:
  added: []
  patterns:
    - "Listener de-duplication guard: store _boundClickHandler as module property; removeEventListener before addEventListener on each render (mirrors _authListenerBound pattern)"
    - "TDD RED→GREEN: failing de-duplication tests committed before fix; fix turns all 8 income-sources tests GREEN"

key-files:
  created:
    - .planning/phases/40-redesign-income-and-transactions-tab-structure/40-05-SUMMARY.md
  modified:
    - css/main.css
    - index.html
    - src/ui/income-sources.js
    - tests/income-sources.test.js

key-decisions:
  - "Removed dead .tab[data-tab='income']::before rule from main.css (data-tab='income' no longer exists in DOM after Phase 40-02)"
  - "Expenses tab moves to position 8 (before Settings) in nav order — GAP-06 plan will remove it from nav entirely"
  - "Used Option B (removeEventListener guard) for listener de-duplication — surgical, no DOM manipulation, follows existing _authListenerBound pattern"

metrics:
  duration_minutes: 53
  tasks_completed: 2
  files_modified: 4
  commits: 3
  completed_date: "2026-03-18"
---

# Phase 40 Plan 05: Tab Icons, Nav Order, and Listener De-dup Summary

**One-liner:** CSS icon rules for transactions/income-sources tabs, nav reorder to Dashboard→Transactions→Income→Debts→..., and removeEventListener guard in income-sources.js to prevent duplicate handler accumulation on re-render.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add tab icons to CSS, fix tab order in index.html | ddd157d | css/main.css, index.html |
| 2 (RED) | Add failing de-duplication tests | 17064f3 | tests/income-sources.test.js |
| 2 (GREEN) | Fix listener accumulation bug in income-sources.js | 8cf30c8 | src/ui/income-sources.js |

## Verification

- [x] css/main.css has `.tab[data-tab="transactions"]::before { content: "💸"; }` and `.tab[data-tab="income-sources"]::before { content: "💰"; }`
- [x] index.html tab order: Dashboard → Transactions → Income (income-sources) → Debts → Payoff → Assets → Childcare → Expenses → Settings
- [x] income-sources.js has `_boundClickHandler: null` property and remove-then-add guard in `_bindEvents()`
- [x] All 8 income-sources tests GREEN (including Tests 7+8 de-duplication)
- [x] 708/711 tests pass — 3 failures are pre-existing dashboard timeout issues unrelated to this plan
- [x] `npm run build` succeeds

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Pre-existing Test Failures (out of scope)

Two dashboard timeout failures (`dashboard.view-toggle.test.js` and `dashboard.affordability.test.js`) existed before this plan and are unchanged. These are not caused by any changes in this plan.

## Self-Check: PASSED

- css/main.css: transactions and income-sources rules present
- index.html: tab order matches specification
- src/ui/income-sources.js: _boundClickHandler property and guard present
- tests/income-sources.test.js: Tests 7 and 8 added
- Commits ddd157d, 17064f3, 8cf30c8 exist in git log
