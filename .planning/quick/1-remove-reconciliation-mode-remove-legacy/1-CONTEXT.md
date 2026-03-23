# Quick Task 001: Remove Reconciliation mode, remove legacy expSearch input, add Subscriptions todo - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Task Boundary

Three-part cleanup task:
1. Hide the Reconciliation mode button (it is not behaving as intended and is low priority)
2. Remove the legacy Search Expenses input (`input#expSearch`) from the Transactions tab — it duplicates Search Transaction functionality
3. Add a todo in STATE.md for a future milestone to implement a Subscriptions debt type (card per subscription with annual cost stats, etc.)

</domain>

<decisions>
## Implementation Decisions

### Reconciliation Mode Button
- **Hide the button** (CSS `display: none` or remove from DOM), do NOT remove underlying JS logic or handlers
- The logic must be preserved because it will be re-implemented properly in a future milestone
- Add a todo in STATE.md noting the reconciliation button needs proper re-implementation

### expSearch Removal
- **Complete removal**: remove the `input#expSearch` element AND all associated JS event listeners, handlers, and related code tied specifically to it
- This is safe because Search Transaction already covers the same functionality

### Subscriptions Todo
- Add the Subscriptions feature idea to **STATE.md todos/backlog section**
- Description: future milestone — "Subscriptions" debt type with a card per subscription showing stats like annual cost, monthly cost, renewal date, etc. Currently users workaround by adding as recurrent transactions.

### Claude's Discretion
- Exact mechanism for hiding the Reconciliation button (remove from HTML vs hide via CSS)
- Where in STATE.md the todos section should be added if it doesn't exist

</decisions>

<specifics>
## Specific Ideas

- Reconciliation button: preserve JS, only remove/hide from the UI surface
- expSearch: `input#expSearch` and anything bound to it (search handler, keyup listeners, etc.)
- Subscriptions: "would be nice to have a card for each subscription with stats such as annual cost, etc." — future milestone scope, not current work

</specifics>
