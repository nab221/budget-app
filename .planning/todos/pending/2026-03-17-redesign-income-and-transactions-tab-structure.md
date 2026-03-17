---
created: 2026-03-17T19:20:16.923Z
title: Redesign income and transactions tab structure
area: ui
files:
  - src/ui/income-sources.js
  - src/app.js
  - index.html
  - src/ui/income-spending-settings.js
  - src/ui/dashboard.js
---

## Problem

Phase 39.1 added a "Pay Sources" tab for income source management, but during UAT the tab shows nothing (no console error — likely a render path or container wiring issue). Beyond the bug, the current tab structure is confusing:

- There's an "Income" tab (shows income transactions) and a new "Pay Sources" tab (manages income sources) — two tabs for income-related things is redundant and unclear.
- The "Income" tab only shows income; expenses are in a separate tab — users can't see both flows together.
- Heatmaps exist on the Dashboard but are prime real estate taking up space above more actionable info.

## Solution

Restructure the navigation tabs and content:

1. **Rename "Pay Sources" → "Income" tab** (use the existing income icon). This tab manages income sources (the Phase 39.1 feature). Fix whatever render issue causes it to show nothing.

2. **Rename current "Income" tab → "Transactions" tab** (in/out icon — visually distinct for income vs expenses):
   - Shows both income and expense transactions together
   - Income entries: distinct color + tag (e.g. green, "IN")
   - Expense entries: distinct color + tag (e.g. red/amber, "OUT")
   - Both the income heatmap AND spending heatmap live here (full transaction context)

3. **Dashboard**: Keep heatmaps but move them to the bottom — they are the least-important information on that page. Actionable summary cards stay at the top.

Needs research (existing tab wiring, heatmap component locations, transaction rendering) before planning.
