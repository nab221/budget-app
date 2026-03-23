---
phase: quick-01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - index.html
  - src/ui/expenses.js
  - .planning/STATE.md
autonomous: true
requirements: [QUICK-01]

must_haves:
  truths:
    - "Reconciliation Mode button is not visible in the Transactions tab UI"
    - "expSearch input is not present in the Transactions tab UI"
    - "expSearch handler is removed from expenses.js with no JS errors"
    - "STATE.md has a todo for reconciliation button re-implementation"
    - "STATE.md has a todo for Subscriptions debt type milestone"
  artifacts:
    - path: "index.html"
      provides: "Reconciliation button hidden; expSearch element removed"
    - path: "src/ui/expenses.js"
      provides: "expSearch handler removed; reconciliationMode state and toggleReconciliationMode preserved"
    - path: ".planning/STATE.md"
      provides: "Two todos recorded"
  key_links:
    - from: "index.html"
      to: "src/ui/expenses.js"
      via: "getElementById('expSearch') — now returns null; null guard already in place at line 162"
    - from: "index.html"
      to: "src/ui/transactions.js"
      via: "getElementById('toggleIncReconBtn') — button removed from HTML; null guard already in place at line 71"
---

<objective>
Three-part cleanup: hide the Reconciliation Mode button (preserve underlying JS), remove the legacy expSearch input and its handler, and record two todos in STATE.md.

Purpose: Reduces UI noise — the reconciliation button is non-functional as intended, and expSearch duplicates Search Transaction. Todos prevent the work from being forgotten.
Output: Cleaner Transactions tab HTML, trimmed expenses.js handler block, two STATE.md todos.
</objective>

<execution_context>
@C:/Users/brito/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/brito/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/1-remove-reconciliation-mode-remove-legacy/1-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Hide Reconciliation button and remove expSearch from index.html</name>
  <files>index.html</files>
  <action>
    Two changes in index.html (both in the Transactions tab section, lines ~155-177):

    1. Reconciliation Mode button (line 159):
       Remove the `<button id="toggleIncReconBtn" ...>` element entirely from the HTML.
       Do NOT touch any JS in transactions.js — the null guard at line 71 (`if (reconBtn)`) already handles a missing element safely.
       Reasoning: hiding via CSS display:none is valid but removing from DOM is cleaner and leaves zero chance of accidental activation. The JS logic is preserved in transactions.js for future re-implementation.

    2. expSearch input (line 172):
       Remove the entire `<input type="text" id="expSearch" .../>` element.
       The `expCategoryFilterContainer` div on line 173 and `expReconHeader` div on line 174 are NOT removed — they may still be populated by expenses.js.
       Reasoning: the input is legacy; search is covered by #incSearch.
  </action>
  <verify>
    grep -n "toggleIncReconBtn\|expSearch" D:/code/github/budget-app/index.html
    Expected output: no matches (both elements gone).
  </verify>
  <done>index.html contains neither `toggleIncReconBtn` nor `expSearch`.</done>
</task>

<task type="auto">
  <name>Task 2: Remove expSearch handler from expenses.js</name>
  <files>src/ui/expenses.js</files>
  <action>
    In `src/ui/expenses.js`, remove the expSearch event-listener block (lines ~160-167):

    ```js
    // Search Input
    const searchInput = document.getElementById('expSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.render();
      };
    }
    ```

    Remove this entire block. The `this.searchQuery` property may still be referenced elsewhere for filtering — do NOT remove it or any other usage. Only remove the DOM binding for `#expSearch`.

    Do NOT touch any `reconciliationMode` state, `toggleReconciliationMode()`, or any other reconciliation logic — all of that must be preserved per user decision.
  </action>
  <verify>
    grep -n "expSearch" D:/code/github/budget-app/src/ui/expenses.js
    Expected output: no matches.
    Then run: cd D:/code/github/budget-app && npm test -- --reporter=verbose 2>&1 | tail -20
    Expected: test suite passes (no new failures).
  </verify>
  <done>expenses.js has no expSearch references; test suite is green.</done>
</task>

<task type="auto">
  <name>Task 3: Add todos to STATE.md</name>
  <files>.planning/STATE.md</files>
  <action>
    Append a `## Todos / Future Backlog` section at the end of STATE.md (or add to it if it already exists) with the following two entries:

    ```markdown
    ## Todos / Future Backlog

    - [Reconciliation Mode] Reconciliation Mode button removed from UI (Quick 01). The JS logic in transactions.js (toggleReconciliationMode, reconciliationMode state) and expenses.js is intentionally preserved. Needs proper re-implementation in a future milestone with correct UX design.

    - [Subscriptions Debt Type] Future milestone idea: a "Subscriptions" debt type where each subscription is a card showing stats such as monthly cost, annual cost, renewal date, etc. Currently users work around this by adding subscriptions as recurrent transactions.
    ```
  </action>
  <verify>
    grep -n "Reconciliation Mode\|Subscriptions Debt" D:/code/github/budget-app/.planning/STATE.md
    Expected: both lines present.
  </verify>
  <done>STATE.md contains both todo entries.</done>
</task>

</tasks>

<verification>
After all tasks:
1. `grep -n "toggleIncReconBtn\|expSearch" index.html` — no output
2. `grep -n "expSearch" src/ui/expenses.js` — no output
3. `npm test` passes with no new failures
4. Browser: open Transactions tab — no Reconciliation Mode button visible, no legacy Search Expenses input visible
</verification>

<success_criteria>
- Reconciliation Mode button absent from Transactions tab HTML (button removed, JS preserved)
- expSearch input absent from HTML and its handler removed from expenses.js
- Vitest suite green (no regressions)
- STATE.md records both todos
</success_criteria>

<output>
After completion, create `.planning/quick/1-remove-reconciliation-mode-remove-legacy/1-SUMMARY.md`
</output>
