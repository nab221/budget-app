# Milestone v2.2 Requirements: Navigation, Dashboard & Bug Fixes

## Goal
Implement a major navigation overhaul with the Dashboard as a top-level tab, a redesigned daily-granularity graph, consolidated summary boxes, and critical bug fixes for the Debts tab statement history and PDF import.

## 1. Navigation & Layout

### 1a. Dashboard as a Tab
- **NAV-01**: Remove the fixed Dashboard section from the top of the shell.
- **NAV-02**: Add "Dashboard" as the FIRST tab in `#mainTabs` (active by default).
- **NAV-03**: Create a corresponding `#dashboard-panel` (active by default) in `#tab-content`.
- **NAV-04**: Move all Dashboard HTML (Chart, Summary Grid) into the new panel.
- **NAV-05**: Ensure `#mainTabs` sits at the very top of the `.shell` container.

### 1b. Mobile Navigation
- **NAV-06**: Implement a horizontally scrollable tab bar for tablet/mobile.
- **NAV-07**: For screens < 768px, provide a mobile-responsive "hamburger" menu (☰) to navigate tabs.

## 2. Dashboard Redesign

### 2a. Daily Granularity Graph
- **DASH-01**: The "Rolling Financial Overview" chart MUST show daily data points for the past 365 days.
- **DASH-02**: Use a cumulative running total (account balance) for the Y-axis.
- **DASH-03**: Distinct visual styles for Historical (solid) vs. Forecast (dashed) data.
- **DASH-04**: Forecast data is driven by the `RecurrenceManager` engine.
- **DASH-05**: Fix current-month duplication bug.

### 2b. Period Selector & Reordering
- **DASH-06**: Move Period Selector (Month Navigator + View Select) below the graph and above the summary grid.
- **DASH-07**: Period Selector ONLY affects the summary boxes, NOT the graph.
- **DASH-08**: Replace `<input type="month">` with a dropdown + ◀▶ navigation widget.
- **DASH-09**: Reorder summary boxes: Balance → Income → Expenses → Net Position → Debt → Debt Stats → Assets → Childcare → Net Worth.

### 2c. Consolidated Banners
- **DASH-10**: Integrate "Debt Repayment Impact" data into the "Debt Repayment Statistics" summary box.
- **DASH-11**: Integrate "Childcare Funding" data (per account) into the "Childcare" summary box.
- **DASH-12**: Integrate "Account Balance" data into the "Current Balance" box.
- **DASH-13**: **Fix**: Use `calculateBalanceChain()` logic for accurate "Current Balance" values.
- **DASH-14**: "Next Negative" alert appears as a warning state (red border + ⚠️) on the Balance box.
- **DASH-15**: Move "Set Current Balance" from Income/Expenses tabs to an edit icon (✏️) on the Balance box.

## 3. Tab-Specific Summaries
- **TAB-01**: Add a summary banner at the top of Income, Expenses, Debts, Assets, and Childcare tabs.
- **TAB-02**: Move budget target progress bars from the Dashboard to the Expenses tab banner.
- **TAB-03**: Move "Debt-Free In" and "Recurrent-to-Income" ratio from the Dashboard to the Debts tab banner.
- **TAB-04**: Implement via a shared `renderTabSummary` utility to ensure visual consistency.

## 4. Debts Tab Bug Fixes
- **FIX-01**: Restore statement history rendering. Clicking a debt card MUST reveal `#statementSection` and populate `#stmtBody`.
- **FIX-02**: Fix `#addStmtBtn` ("Log Statement") handler to show the manual entry form.
- **FIX-03**: Restore the PDF statement import pipeline specifically for debt accounts.

## Success Criteria
- [ ] Dashboard is the default active tab.
- [ ] Graph shows 365 days of daily balance progression (no duplication).
- [ ] Period selector (dropdown + buttons) correctly filters summary boxes below.
- [ ] "Current Balance" box accurately reflects the bank balance (calculated via balance chain).
- [ ] All standalone dashboard banners are gone (integrated into boxes).
- [ ] Each primary tab has a relevant summary banner at the top.
- [ ] Debt statement history and PDF import are fully functional.
- [ ] App is responsive with a mobile menu on small screens.
