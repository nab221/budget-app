# Phase 8 Context: Income & Expenses Refinement

## 1. Consolidated Expense UX
- **Tab Structure**: Recurrent and One-off expenses will be sub-views within a single "Expenses" top-level tab.
- **Visual Differentiation**: Recurrent expenses must be split into two primary groups: **Essential** and **Non-essential**.
- **Summation Logic**: The UI must display separate totals for Essential vs. Non-essential recurrent items to help users identify potential cancellations.
- **One-off Definition**: Strictly for singular purchases or those that occur randomly/infrequently.
- **Empty State**: Show a "No recurrent items" message when the list is empty.

## 2. Income History Presentation
- **Layout**: Income entries are displayed in a list at the bottom of the view, one per line.
- **Historical Window**: The view shows a 3-month sliding window (Current Month + 2 Previous) based on the month selected in the app's global filter.
- **Aggregation**: Totals should be calculated and shown per month within this list.

## 3. Recurrent Lifecycle & Labels
- **Cancellation**: Tracking is based on a "subscription end date."
- **Progress Tracking**: Items with fixed cycles (including loans) must show progress in the "Payment X of Y" format.
- **Persistence**: Completed cycles ("Finished") stay in the list but are visually marked as complete.
- **Bulk Actions**: A "Mark all as paid" action must be available for recurrent items.

## 4. Categorization & Grouping
- **Fluidity**: Categories are not bucket-locked; any category (e.g., Groceries) can contain both Recurrent and One-off entries.
- **Budget Targets**: Targets will be managed by bucket (Recurrent Target vs. One-off Target).
- **Recurrent Sorting**: Within the Recurrent sub-view, items are grouped/sorted by **due date**.

## Deferred Ideas
- **Balance Panel**: A dedicated panel showing carry-over balance from previous months. This requires a shift to a cumulative accounting model and is deferred to a future phase (e.g., Phase 11) to maintain Phase 8 scope.
