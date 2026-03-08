---
phase: 14-ui-polish-and-layout
plan: 01
type: execute
wave: 1
depends_on: ["13-03"]
files_modified: [css/main.css, src/ui/render.js, src/ui/expenses.js, src/ui/transactions.js, src/ui/assets.js, src/ui/dashboard.js, src/ui/debts.js, index.html]
autonomous: true
requirements: [UI-POLISH-01, UI-POLISH-02, UI-POLISH-03, UI-POLISH-04]
must_haves:
  truths:
    - "Entry forms appear in modals instead of inline containers"
    - "Dashboard cards share a unified visual style"
    - "Table rows adjust height dynamically to content"
    - "Dashboard cards are hidden if data is unavailable"
    - "Currency values scale down if they exceed card width"
    - "Large values (>£100k) use 'k' notation"
    - "Legacy debt/expense/income form functions and HTML containers are removed"
  artifacts:
    - path: "css/main.css"
      provides: "Unified card and table styles"
    - path: "src/ui/expenses.js"
      provides: "Modal-based entry creation"
    - path: "src/ui/dashboard.js"
      provides: "Conditional card visibility and font scaling"
  key_links:
    - "src/ui/expenses.js -> src/ui/render.js (modalUI)"
    - "src/ui/transactions.js -> src/ui/render.js (modalUI)"
    - "src/ui/assets.js -> src/ui/render.js (modalUI)"
---

# Phase 14: UI Polish & Layout - PLAN.md

<objective>
Unify the visual language of the application by standardizing cards, tables, and moving all entry interactions to modals. Refine dashboard logic for data visibility and content scaling. Clean up legacy inline forms and dead code.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: CSS Foundation & Component Unification</name>
  <files>css/main.css</files>
  <action>
    - Define `.dashboard-card` to unify 'Running Balance', 'Next Month Forecast', and '3-Month Forecast'.
    - Ensure all three use the same background, borders, and font weights.
    - Update `.tbl td` to remove `white-space: nowrap` and ensure `line-height` is dynamic for text wrapping.
    - Add media queries to stack `.sum-grid` items vertically on mobile (< 768px).
    - Ensure `.sum-grid` supports horizontal wrapping (`flex-wrap: wrap`) on large screens as per CONTEXT.md.
    - Ensure `.tbl` rows have a distinct visual separation but no "banner-style" layout.
  </action>
  <verify>Check CSS for .dashboard-card definition. Verify layout at 375px (mobile) and >1024px (desktop) using DevTools.</verify>
  <done>CSS supports unified cards and wrapping table rows across breakpoints.</done>
</task>

<task type="auto">
  <name>Task 2: Modal Refactoring for Expenses, Income & Assets</name>
  <files>src/ui/expenses.js, src/ui/transactions.js, src/ui/assets.js, src/ui/render.js, index.html</files>
  <action>
    - Replace `toggleForm` and inline rendering in `expenses.js`, `transactions.js`, and `assets.js` with `modalUI.show()`.
    - Map existing form fields (including asset-specific ones) to modal body content.
    - Implement `autofocus` on the first relevant input field in all modals.
    - Add numeric placeholders (e.g., "0.00", "0.00%") to all amount and rate fields for polish.
    - Ensure 'Add' and 'Update' actions are correctly wired to modal footer buttons.
    - Remove `incomeFormContainer`, `expenseFormContainer`, and any asset-specific form containers from `index.html`.
  </action>
  <verify>Open 'Add Expense', 'Add Income', and 'Add Asset' confirming modals appear with autofocus and placeholders.</verify>
  <done>Forms are moved to modals; inline containers are removed; polish elements (autofocus, placeholders) are added.</done>
</task>

<task type="auto">
  <name>Task 3: Dashboard Refinement (Visibility & Scaling)</name>
  <files>src/ui/dashboard.js, src/ui/render.js</files>
  <action>
    - Modify `renderDashboard` to filter out cards with null/undefined values.
    - Apply the unified `.dashboard-card` class to all three balance cards.
    - Centralize `adjustFontSize` in `render.js` and ensure it handles `formatGBPShort` for amounts >= 100,000.
    - Ensure `adjustFontSize` is called for every balance card value on the dashboard.
    - Add clear visual indicators for forecasted values (e.g., italics or icons).
  </action>
  <verify>Mock missing forecast data and confirm card is hidden. Inject £150k and verify 'k' notation and scaling.</verify>
  <done>Dashboard logic is robust and follows UI-POLISH-03/04.</done>
</task>

<task type="auto">
  <name>Task 4: Table Layout Correction & Dead Code Removal</name>
  <files>src/ui/debts.js, src/ui/expenses.js, index.html</files>
  <action>
    - Review all tables to ensure entries are single-line rows with dynamic heights.
    - Explicitly remove `toggleDebtForm()`, `renderDebtForm()`, and any legacy `toggleForm` logic in `expenses.js`.
    - Remove `#debtFormContainer` and other legacy form containers from `index.html`.
    - Remove any remaining "banner-style" headers or overlapping inline fields in `src/ui/debts.js` and `src/ui/expenses.js`.
  </action>
  <verify>Confirm `toggleDebtForm` is removed. Check 'Debts' and 'Expenses' tabs for clean table row layout.</verify>
  <done>Legacy code is removed; tables follow UI-POLISH-01.</done>
</task>
</tasks>

---

## Verification Plan
1. **Visual Consistency:** Inspect dashboard cards for identical styles.
2. **Responsiveness:** Test on mobile (stacking) and desktop (wrapping/horizontal).
3. **Modals:** Confirm adding expenses/income/assets/debts uses `modalUI`.
4. **Data Handling:** Confirm missing forecasts hide cards.
5. **Formatting:** Confirm £100k+ shows as 'k' and scales to fit.
6. **Cleanup:** Ensure no legacy inline form containers exist in the DOM.
