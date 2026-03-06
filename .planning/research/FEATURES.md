# Feature Landscape: Milestone v2.3 — Advanced Analytics & Mobile Polish

**Domain:** Personal Finance UX, Data Integrity, and Predictive Insights
**Researched:** 2024-05-24

## Table Stakes (Reconciliation & Integrity)

Features users expect for basic trust in their financial data.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Cleared Status** | Track which transactions have hit the bank. | Low | Add `isCleared` boolean to transaction entities. |
| **Reconcile Tool** | Match app balance to actual bank balance. | Med | YNAB-style workflow: Enter balance → Clear → Finish. |
| **Transaction Locking** | Prevent accidental edits to reconciled data. | Low | Disable edit/delete for locked transactions. |
| **Duplicate Solver** | Resolve potential duplicates during import. | Med | UI to "Merge", "Keep Both", or "Ignore" duplicates. |

## Differentiators (Advanced Analytics)

Features that provide deeper insight into financial health.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Category Breakdown** | Visualize where money goes (Doughnut). | Low | Aggregates monthly spend by category. |
| **Savings Rate KPI** | Track the most important finance number. | Low | (Income - Expense) / Income % trend. |
| **Net Worth Trend** | Visualize long-term asset/debt trajectory. | Med | Line chart showing Assets vs Debts vs Net Worth. |
| **Spending Velocity** | "Am I spending faster than usual this month?" | High | Comparison of current cumulative spend vs avg. |

## Mobile UX Enhancements

| Feature | Why Valuable | Complexity | Notes |
|---------|--------------|------------|-------|
| **Bottom Navigation** | Better ergonomics for one-handed use. | Med | Core tabs at bottom; secondary items in "More". |
| **Privacy Mode** | Use the app in public without stress. | Low | CSS toggle to blur sensitive balance numbers. |
| **Swipe-to-Action** | Reduce friction for management tasks. | Med | Swipe-left to Delete; Swipe-right to Edit. |
| **Haptic Feedback** | Tactile confirmation of app state. | Low | `navigator.vibrate` on Success/Error/Done. |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Direct Bank API** | High cost, complex OAuth, privacy concerns. | Stick to PDF/CSV imports + Manual reconciliation. |
| **Full AI Coaching** | High complexity, LLM cost, hallucination risk. | Rule-based "Spending Insights" (e.g. "20% higher than avg"). |

## Feature Dependencies

```
isCleared Field → Reconcile Tool → Transaction Locking
```

## MVP Recommendation (Milestone v2.3 Scope)

Prioritize:
1.  **Formal Reconciliation**: `isCleared` field + Basic Reconcile UI.
2.  **Category Insight**: Doughnut chart on Dashboard + Savings Rate KPI.
3.  **Mobile Foundation**: Bottom Navigation Bar + Privacy Mode toggle.

Defer: **Spending Velocity** and **Full AI Coaching** to a later "v3.x" milestone.

## Sources

- [YNAB: Reconciling Accounts](https://docs.youneedabudget.com/article/166-reconciling-accounts)
- [Monzo: Trends & Categorization](https://monzo.com/features/trends/)
- [Revolut: Budgeting & Analytics](https://www.revolut.com/budgeting-and-analytics/)
