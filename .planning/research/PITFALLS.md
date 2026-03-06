# Domain Pitfalls: Milestone v2.3 — Advanced Analytics & Mobile Polish

**Domain:** Personal Finance UX, Data Integrity, and Predictive Insights
**Researched:** 2024-05-24

## Critical Pitfalls

Mistakes that cause rewrites or major data issues.

### Pitfall 1: Manual Adjustment Spirals
**What goes wrong:** Users create manual balance adjustments to "fix" discrepancies during reconciliation without finding the root cause.
**Why it happens:** Reconciliation is difficult or tedious.
**Consequences:** The app's ledger becomes meaningless; users lose trust in "Net Position" or "Savings Rate" because it's padded with fake data.
**Prevention:** Provide an "Adjustment" button as a LAST resort; encourage finding the missing transaction first with filters (e.g., "Show Uncleared").

### Pitfall 2: Chart Noise (Overplotting)
**What goes wrong:** Adding too many categories to a Doughnut chart or too many lines to a Net Worth trend.
**Why it happens:** Wanting to show "all the data" at once.
**Consequences:** The chart becomes unreadable on mobile; tooltips overlap; users ignore the analytics.
**Prevention:** Group smaller categories into an "Other" bucket automatically if they represent < 2% of total spend. Limit trend charts to 12-24 months by default.

## Moderate Pitfalls

### Pitfall 1: Privacy Leaks in Public
**What goes wrong:** The user opens the app on a train to log an expense; the person next to them sees their net worth or low account balance.
**Prevention:** Implement a "Privacy Mode" (blur effect) that can be toggled via a persistent icon in the header or bottom bar.

### Pitfall 2: Navigation Fatigue
**What goes wrong:** Moving to a Bottom Navigation bar but keeping too many items (7+).
**Prevention:** Follow the "Rule of 5": No more than 5 primary tabs in the bottom bar. Move secondary tools (Childcare, Assets, Settings) to a "More" menu.

## Minor Pitfalls

### Pitfall 1: Inconsistent "Paid" vs "Cleared" logic
**What goes wrong:** A recurrent expense is marked 'paid' in the app (internal status) but isn't yet 'cleared' at the bank.
**Prevention:** Clearly distinguish these in the UI. 'Paid' is the app-level state; 'Cleared' is the bank-level state.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Reconciliation** | Off-by-one errors in balance math. | Use the existing `calculateBalanceChain` and add unit tests for the new `isCleared` filter logic. |
| **Mobile Polish** | Tap targets too small (Fat Finger). | Increase touch target size to at least 44x44px; use CSS `gap` on flex containers. |

## Sources

- [Common Budget App Mistakes (Reddit /r/personalfinance)](https://www.reddit.com/r/personalfinance/comments/6u9v80/common_budgeting_mistakes_youre_making/)
- [Apple Human Interface Guidelines — Tab Bars](https://developer.apple.com/design/human-interface-guidelines/components/navigation-and-search/tab-bars/)
