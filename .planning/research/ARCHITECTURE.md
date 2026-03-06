# Architecture Patterns: Milestone v2.3 — Advanced Analytics & Mobile Polish

**Domain:** Personal Finance UX, Data Integrity, and Predictive Insights
**Researched:** 2024-05-24

## Recommended Architecture

### Reconciliation State Machine
The reconciliation process transforms a transaction from `pending` (manual or imported) to `cleared` (bank verified) and finally `reconciled` (locked).

| State | Flag | Description | UI Action |
|-------|------|-------------|-----------|
| **Pending** | `isCleared: false` | Transaction exists in app but not yet verified against bank. | Toggle 'Clear' (Checkmark) |
| **Cleared** | `isCleared: true` | Transaction verified against bank; part of 'Cleared Balance'. | Toggle 'Unclear' (Lock) |
| **Reconciled** | `isReconciled: true` | Transaction locked; matches statement balance. | Read-Only |

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `ReconciliationManager` | Handles the reconcile workflow (Start, Match, Finish). | `Repository`, `UI/ReconcilePanel` |
| `AnalyticsEngine` | Computes Category Spending, Savings Rate, and Trends. | `Repository`, `UI/Charts` |
| `MobileNavShell` | Manages Bottom Navigation and "More" menu. | `Router`, `UI/AppShell` |

## Patterns to Follow

### Pattern 1: Ledger-Based Integrity
Current balance should NOT be an stored number; it MUST be a derived sum of:
`Starting Balance + Sum(Income) - Sum(Expenses)`.
The `balanceSnapshots` and `dailyBalanceSnapshots` tables are the cache of this derived sum.

### Pattern 2: Immutable Reconciled Transactions
Once `isReconciled` is set to `true`, the `Repository` should throw an error on `update()` or `delete()` unless a specific `force` flag is passed.

```typescript
// Proposed Repository Guard
async function updateTransaction(id, updates) {
  const existing = await db.oneOffExpenses.get(id);
  if (existing.isReconciled && !updates.force) {
    throw new Error('Cannot edit reconciled transaction.');
  }
  return await db.oneOffExpenses.update(id, updates);
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Floating Point Currency
**What:** Storing currency as `12.50`.
**Why bad:** IEEE 754 precision errors (e.g. `0.1 + 0.2 != 0.3`).
**Instead:** ALWAYS store in **integer pence** (`1250`). *The app already follows this.*

### Anti-Pattern 2: Global Tab Redraw on Navigation
**What:** Re-rendering the entire DOM when switching from 'Dashboard' to 'Income'.
**Why bad:** Loss of scroll position, input focus, and perceived lag on mobile.
**Instead:** Use `display: hidden` on inactive panels and only trigger `render()` on the active panel if data is stale.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Analytics** | On-the-fly calculation. | On-the-fly calculation. | Background worker or cached snapshots. |
| **Data Size** | IndexedDB local storage. | IndexedDB local storage. | No change (data is local). |
| **Sync Debounce** | 500ms debounce. | 500ms debounce. | No change (local sync). |

## Sources

- [Double-Entry Bookkeeping in Modern Budget Apps](https://medium.com/@accounting-software/double-entry-bookkeeping-101)
- [IndexedDB Performance Best Practices](https://web.dev/indexeddb-performance/)
