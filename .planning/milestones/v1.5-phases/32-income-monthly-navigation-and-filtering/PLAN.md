---
phase: 32
plan: "32-01"
type: "ui"
wave: 1
depends_on: []
files_modified:
  - "src/ui/transactions.js"
  - "index.html"
requirements:
  - "INCOME-NAV-01"
  - "INCOME-NAV-02"
  - "INCOME-FILTER-01"
  - "INCOME-FILTER-02"
  - "INCOME-UI-01"
must_haves:
  truths:
    - "Income tab has independent month navigation (Prev/Next/Dropdown)"
    - "Selected income month persists in localStorage ('transaction_month')"
    - "Income tab has category filter dropdown"
    - "Income list is strictly filtered by the selected month"
    - "Search and Category filters work together on the month's data"
  artifacts:
    - "src/ui/transactions.js"
  key_links:
    - "incomeMonthPicker"
    - "incCategoryFilterContainer"
autonomous: true
---

# Phase 32-01 PLAN: UI - Income Monthly Navigation & Filtering

## Goal
Implement independent month navigation and category filtering for the Income tab in `src/ui/transactions.js`, bringing it in line with the Expenses tab user experience.

## Tasks

<task id="32-01-01" requirements="INCOME-NAV-02">
Initialize `transactionUI` state with `currentMonth` from `localStorage` and `selectedCategories = []`. Update `init()` to load these values.
</task>

<task id="32-01-02" requirements="INCOME-NAV-01">
Implement `renderMonthPicker()` in `transactionUI` and the global helpers `incPrevMonth`, `incNextMonth`, and `handleIncMonthChange`.
</task>

<task id="32-01-03" requirements="INCOME-FILTER-01">
Implement `renderCategoryFilter()` and associated handlers (`toggleCategoryDropdown`, `handleCategoryChange`, `clearCategoryFilter`) in `transactionUI`.
</task>

<task id="32-01-04" requirements="INCOME-FILTER-02, INCOME-UI-01">
Refactor `renderIncome()` to use `incomeRepository.getByMonth(this.currentMonth)` and apply `filterTransactions` for combined search and category filtering.
</task>

<task id="32-01-05">
Update `index.html` to ensure containers for the new controls are present or correctly handled by the injection logic.
</task>

<task id="32-01-06">
Verify all requirements using the manual test plan:
1. Month navigation (Prev/Next/Dropdown) works and persists.
2. Search and Category filters correctly limit the displayed income.
3. Income tab month is independent of Dashboard/Expenses.
</task>
