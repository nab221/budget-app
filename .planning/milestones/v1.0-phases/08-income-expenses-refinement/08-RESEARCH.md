<user_constraints>
## User Constraints (from 08-CONTEXT.md)

### Locked Decisions
1. **Consolidated Expense UX**
   - **Tab Structure**: Recurrent and One-off expenses will be sub-views within a single "Expenses" top-level tab.
   - **Visual Differentiation**: Recurrent expenses must be split into two primary groups: **Essential** and **Non-essential**.
   - **Summation Logic**: The UI must display separate totals for Essential vs. Non-essential recurrent items to help users identify potential cancellations.
   - **One-off Definition**: Strictly for singular purchases or those that occur randomly/infrequently.
   - **Empty State**: Show a "No recurrent items" message when the list is empty.
2. **Income History Presentation**
   - **Layout**: Income entries are displayed in a list at the bottom of the view, one per line.
   - **Historical Window**: The view shows a 3-month sliding window (Current Month + 2 Previous) based on the month selected in the app's global filter.
   - **Aggregation**: Totals should be calculated and shown per month within this list.
3. **Recurrent Lifecycle & Labels**
   - **Cancellation**: Tracking is based on a "subscription end date."
   - **Progress Tracking**: Items with fixed cycles (including loans) must show progress in the "Payment X of Y" format.
   - **Persistence**: Completed cycles ("Finished") stay in the list but are visually marked as complete.
   - **Bulk Actions**: A "Mark all as paid" action must be available for recurrent items.
4. **Categorization & Grouping**
   - **Fluidity**: Categories are not bucket-locked; any category (e.g., Groceries) can contain both Recurrent and One-off entries.
   - **Budget Targets**: Targets will be managed by bucket (Recurrent Target vs. One-off Target).
   - **Recurrent Sorting**: Within the Recurrent sub-view, items are grouped/sorted by **due date**.

### Claude's Discretion
- (None specified in 08-CONTEXT.md)

### Deferred Ideas (OUT OF SCOPE)
- **Balance Panel**: A dedicated panel showing carry-over balance from previous months. This requires a shift to a cumulative accounting model and is deferred to a future phase (e.g., Phase 11) to maintain Phase 8 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INC-05 | Income tab shows last 3 months of history for trend visibility | Verified IndexedDB query pattern for sliding windows |
| EXP-01 | Consolidate "Fixed", "Variable", and "Subscriptions" into "Recurrent" and "One-off" expense tabs | Outlined schema migration from 3 stores to 2 semantic views |
| EXP-02 | Support "cancelable" labels for recurrent items to distinguish optional spending from obligations | Established essential/non-essential flag pattern |
| EXP-03 | Support varying recurrent expenses (10-month cycles like Council Tax, quarterly like TV License) | Designed cycle tracking schema ('Payment X of Y') |
| EXP-04 | Expense list shows labels for things that can be cancelled | Defined UI badge requirements based on 'essential' flag and end dates |
</phase_requirements>

# Phase 8: Income & Expenses Refinement - Research

**Researched:** 2026-03-01
**Domain:** Dexie.js Schema Migrations, Unified Data Views, Recurring Pattern Logic
**Confidence:** HIGH

## Summary

This phase restructures the core expense tracking of the budget app. The legacy model of separate "Fixed Spends", "Variable Spends", and "Subscriptions" is being replaced by a unified "Expenses" view divided into "Recurrent" and "One-off" sub-views. Since a key constraint is "No legacy data migration needed; starting from zero for Phase 8," we can aggressively redesign the Dexie schema without complex data preservation logic. 

**Primary recommendation:** Upgrade the Dexie schema to version 5, deprecating `fixedSpends`, `variableSpends`, and `subscriptions` in favor of two new tables: `recurrentExpenses` and `oneOffExpenses`. Handle the 3-month income history using Dexie's `.between()` query on date strings.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^3.x or ^4.x | Client-side IndexedDB wrapper | Already in use in the project; provides robust versioning. |

## Architecture Patterns

### Merging Disparate Data Sources

Instead of "merging" three disparate stores on the fly (which causes performance and sorting issues), the architecture should consolidate the stores at the schema level.

1. **New Table: `recurrentExpenses`**
   - Replaces `fixedSpends` and `subscriptions`.
   - Fields: `++id, date, categoryId, label, amount, status, frequency, cycleTotal, cycleCurrent, isEssential, endDate`
   - `cycleTotal` and `cycleCurrent` handle the "Payment X of Y" requirement.
   - `isEssential` handles the "Cancelable / Non-essential" requirement.

2. **New Table: `oneOffExpenses`**
   - Replaces `variableSpends`.
   - Fields: `++id, date, categoryId, note, amount`

3. **Schema Versioning:**
   ```javascript
   // src/db/schema.js
   db.version(5).stores({
     // ... existing unchanged stores
     income: '++id, date, source, amount, categoryId',
     
     // NEW STORES
     recurrentExpenses: '++id, date, categoryId, label, amount, status, nextDate, isEssential, cycleTotal',
     oneOffExpenses: '++id, date, categoryId, note, amount',
     
     // DEPRECATED (keep for reference if needed, or drop if truly starting from zero)
     // fixedSpends, variableSpends, subscriptions
   });
   ```

### 3-Month Sliding Window for Income

To efficiently fetch the last 3 months of income without performance degradation in IndexedDB, use string-based lexicographical filtering on the `YYYY-MM-DD` date format.

**Pattern:**
```javascript
// src/db/repository.js -> incomeRepository
async getThreeMonthHistory(targetMonthStr) { // e.g. "2026-03"
  const targetDate = new Date(`${targetMonthStr}-01`);
  
  // Calculate the start of the window (2 months prior)
  const startDate = new Date(targetDate);
  startDate.setMonth(startDate.getMonth() - 2);
  const startMonthStr = startDate.toISOString().slice(0, 7) + "-01";
  
  // Calculate the end of the window (end of target month)
  const endDate = new Date(targetDate);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(0); // Last day of target month
  const endMonthStr = endDate.toISOString().slice(0, 10);

  return await db.income
    .where('date')
    .between(startMonthStr, endMonthStr, true, true)
    .toArray();
}
```

### Recurrent Cycle Logic (Council Tax, etc.)

For things like Council Tax (10 months) or fixed-term loans, the `recurrentExpenses` record needs metadata.

**Pattern:**
Store `cycleCurrent` and `cycleTotal` integers. When `status` is toggled to 'paid', a background function (or UI action) increments `cycleCurrent` and updates the `nextDate`. If `cycleCurrent >= cycleTotal`, the item is marked as 'Finished'.

### Bucket-Based Budget Targets

Currently, `targets` are linked to `categoryId`.
To support "Recurrent Target vs One-off Target", update the `targets` schema to remove `categoryId` and use a `bucket` identifier instead.

**Pattern:**
```javascript
// db.version(5) update
targets: '++id, bucket, amount' // bucket is 'recurrent' or 'one-off'
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date Math | Custom leap-year / end-of-month logic | Native `Date` object manipulation | JavaScript's `Date` object handles overflow (e.g., setting month to `+1` and day to `0` gets the last day of the current month reliably). |
| Data Migration | Complex scripts to move old `fixedSpends` to `recurrentExpenses` | Nothing | Constraint explicitly states: "No legacy data migration needed; starting from zero". Just define the new schema. |

## Common Pitfalls

### Pitfall 1: Sorting Merged Arrays in Memory
**What goes wrong:** If you try to keep `fixedSpends` and `subscriptions` separate but show them in one list, sorting them dynamically in memory on every render will cause layout thrashing and UI sluggishness on mobile.
**How to avoid:** Consolidate into a single `recurrentExpenses` IndexedDB table so Dexie can query and sort natively.

### Pitfall 2: Date String Comparisons
**What goes wrong:** Comparing `2026-3` with `2026-03` fails lexicographically.
**How to avoid:** Always enforce `YYYY-MM-DD` zero-padded strings before saving to Dexie.

### Pitfall 3: "Mark all as paid" Concurrency
**What goes wrong:** Firing 50 individual `db.table.update()` calls simultaneously can lock the UI thread or hit IndexedDB transaction limits.
**How to avoid:** Use Dexie's bulk operations (`db.recurrentExpenses.bulkPut()` or a transaction block) for the "Mark all as paid" action.

## Code Examples

### Essential vs Non-Essential Rendering
```javascript
// Example UI rendering logic
const recurrent = await repository.getRecurrent(currentMonth);

const essential = recurrent.filter(r => r.isEssential);
const nonEssential = recurrent.filter(r => !r.isEssential);

const essentialTotal = essential.reduce((sum, item) => sum + item.amount, 0);
const nonEssentialTotal = nonEssential.reduce((sum, item) => sum + item.amount, 0);

// Render separate sections...
```
