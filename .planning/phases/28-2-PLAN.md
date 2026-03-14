---
phase: 28-mobile-navigation-overhaul
plan: 02
type: execute
wave: 1
depends_on: []
files_modified: [index.html, src/app.js]
autonomous: true
requirements: [NAV-02, MOB-01]
user_setup: []

# Goal-backward verification (derived during planning, verified after execution)
must_haves:
  truths:
    - "Screen readers announce each tab correctly by name at all viewport sizes, including when CSS hides the visible label at ≤360px"
    - "All 354+ Vitest tests continue to pass after JS changes"
    - "The hamburger button is not visible on mobile (CSS-hidden) and its JS toggle does not interfere with the bottom bar"
  artifacts:
    - path: "index.html"
      provides: "Accessible tab buttons with aria-label and tab-label spans"
      contains: "aria-label=\"Dashboard\""
    - path: "index.html"
      provides: "Tab label spans for CSS truncation at narrow viewports"
      contains: "tab-label"
    - path: "src/app.js"
      provides: "Documented hamburger JS state"
      contains: "hamburger"
  key_links:
    - from: "index.html"
      to: "css/main.css"
      via: ".tab-label span enables 420px/360px truncation rules from Plan 28-1"
      pattern: "class=\"tab-label\""
    - from: "index.html"
      to: "src/app.js"
      via: "Tab buttons have data-tab attribute consumed by existing click handler"
      pattern: "data-tab="
---

<objective>
Add `aria-label` attributes and `.tab-label` span wrappers to all 8 tab buttons in `index.html`, and document the now-inert hamburger toggle logic in `src/app.js`.

Purpose: Screen reader accessibility requires `aria-label` on every tab button — especially critical at ≤360px where CSS hides the visible text. The `.tab-label` span wrappers are also required so the 420px/360px CSS truncation rules (added in Plan 28-1) can target the label text independently of the `::before` icon. The hamburger JS comment prevents future confusion about why the toggle code appears unreachable on mobile.
Output: Updated `index.html` with accessible, span-wrapped tab buttons. Updated `src/app.js` with a clarifying comment on the hamburger block.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@index.html
@src/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add aria-label and tab-label spans to all 8 tab buttons</name>
  <files>index.html</files>
  <read_first>index.html</read_first>
  <action>
Read `index.html` and locate the 8 tab buttons (lines ~45–52). They look like:
```html
<button class="tab active" data-tab="dashboard">Dashboard</button>
<button class="tab" data-tab="income">Income</button>
...
```

For EACH tab button, make two changes:
1. Add `aria-label="[Tab Name]"` attribute to the `<button>` element.
2. Wrap the visible text content in `<span class="tab-label">[Tab Name]</span>`.

The `aria-label` value must exactly match the visible text label. Apply to all 8 tabs using this mapping:

| data-tab    | aria-label    | span text     |
|-------------|---------------|---------------|
| dashboard   | Dashboard     | Dashboard     |
| income      | Income        | Income        |
| expenses    | Expenses      | Expenses      |
| debts       | Debts         | Debts         |
| payoff      | Payoff        | Payoff        |
| assets      | Assets        | Assets        |
| childcare   | Childcare     | Childcare     |
| settings    | Settings      | Settings      |

Result for each button (example):
```html
<button class="tab active" data-tab="dashboard" aria-label="Dashboard"><span class="tab-label">Dashboard</span></button>
<button class="tab" data-tab="income" aria-label="Income"><span class="tab-label">Income</span></button>
```

Do NOT change any other attributes (class, data-tab, id if present). Do NOT change the hamburger button (`#mobileMenuBtn`). Do NOT reformat other parts of the HTML.

The `active` class will be on whichever tab is currently active — preserve it as-is.
  </action>
  <verify>grep -n "aria-label\|tab-label" index.html</verify>
  <acceptance_criteria>
    - `index.html` contains `aria-label="Dashboard"` on the dashboard tab button
    - `index.html` contains `aria-label="Income"` on the income tab button
    - `index.html` contains `aria-label="Expenses"` on the expenses tab button
    - `index.html` contains `aria-label="Debts"` on the debts tab button
    - `index.html` contains `aria-label="Payoff"` on the payoff tab button
    - `index.html` contains `aria-label="Assets"` on the assets tab button
    - `index.html` contains `aria-label="Childcare"` on the childcare tab button
    - `index.html` contains `aria-label="Settings"` on the settings tab button
    - `index.html` contains exactly 8 occurrences of `class="tab-label"` (one per tab button)
    - `grep -c "aria-label" index.html` returns at least 8 (the 8 tab buttons; the hamburger button already has aria-label and must not be double-counted)
  </acceptance_criteria>
  <done>All 8 tab buttons have aria-label and tab-label span; screen readers can announce tabs at all viewport sizes</done>
</task>

<task type="auto">
  <name>Task 2: Document hamburger JS as desktop-only / CSS-inert on mobile</name>
  <files>src/app.js</files>
  <read_first>src/app.js</read_first>
  <action>
Read `src/app.js` and locate the hamburger toggle logic block (lines ~135–151). It handles clicks on `#mobileMenuBtn` and toggles the `open` class on `#mainTabs`.

Add a comment block immediately ABOVE the hamburger event listener (or at the top of the handler function, whichever is more readable) that reads:

```js
// HAMBURGER TOGGLE — desktop narrow-width only.
// On mobile (≤768px), #mobileMenuBtn is hidden via CSS (display: none) and this
// handler is inert. The bottom tab bar (Phase 28) replaces the hamburger pattern
// on mobile. This code is retained for any future desktop narrow-width use case.
// Do NOT remove without verifying desktop behaviour.
```

Do NOT change any logic, variable names, or other code. This is a comment-only change.

Do NOT add guards like `if (window.matchMedia(...))` — the button being CSS-hidden is sufficient, and adding a JS guard would be a logic change that could affect test coverage.
  </action>
  <verify>grep -n "hamburger\|HAMBURGER\|inert\|bottom tab" src/app.js</verify>
  <acceptance_criteria>
    - `src/app.js` contains the word "hamburger" (or "HAMBURGER") in a comment near the toggle handler
    - `src/app.js` contains a comment explaining the handler is CSS-inert on mobile
    - No logic changes were made — `grep -c "mobileMenuBtn" src/app.js` returns the same count as before this task
  </acceptance_criteria>
  <done>Hamburger JS is annotated; future developers understand why the toggle code exists alongside the bottom bar</done>
</task>

<task type="auto">
  <name>Task 3: Verify all Vitest tests still pass</name>
  <files></files>
  <read_first></read_first>
  <action>
Run the full Vitest test suite to confirm the HTML and JS changes have not broken any existing tests:

```bash
npx vitest run
```

Expect all 354+ tests to pass. If any tests fail, read the failure output carefully:
- If a test fails because it queries for a tab button's text content and that text is now wrapped in a `<span>`, update ONLY the test's selector or text assertion to match the new DOM structure (e.g., change `button.textContent` to `button.querySelector('.tab-label').textContent` or use `aria-label` for lookup instead). Do NOT change test logic beyond adapting to the new DOM structure.
- If a test fails for any other reason, investigate and fix — but do not suppress or skip tests.

Do NOT modify `src/app.js` logic to make tests pass; adapt only HTML structure references in tests if needed.
  </action>
  <verify>npx vitest run 2>&1 | tail -20</verify>
  <acceptance_criteria>
    - `npx vitest run` exits with code 0
    - Test output shows 354 or more passing tests
    - Zero failing tests
  </acceptance_criteria>
  <done>All existing Vitest tests pass; no regressions introduced</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `grep -c "aria-label" index.html` returns at least 9 (8 tabs + 1 hamburger button)
- [ ] `grep -c "tab-label" index.html` returns exactly 8
- [ ] `grep -n "HAMBURGER\|hamburger" src/app.js` shows the explanatory comment
- [ ] `npx vitest run` exits 0 with 354+ passing tests
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings introduced
- Each of the 8 `.tab` buttons in `index.html` has an `aria-label` attribute matching its visible label
- Each of the 8 `.tab` buttons has a `<span class="tab-label">` wrapping its text content
- `src/app.js` hamburger block has an explanatory comment — no logic changes
- All 354+ Vitest tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/28-mobile-navigation-overhaul/28-02-SUMMARY.md`
</output>
