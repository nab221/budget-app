# Architecture

**Analysis Date:** 2026-02-28

## Pattern Overview

**Overall:** Single-page application (SPA) with client-side state management and local-first data persistence

**Key Characteristics:**
- Monolithic HTML file (single source of truth)
- Client-side only — no backend server required
- IndexedDB for persistent local data storage
- Dexie.js ORM abstraction over IndexedDB
- Event-driven UI with DOM manipulation
- Module-like organization within single file using sections and global functions

## Layers

**Presentation Layer:**
- Purpose: Render UI components and handle user interactions
- Location: `budget-app.html` — `<style>` block (lines 8-106) and DOM structure (lines 108-292)
- Contains: CSS variables, grid layouts, card/modal components, tab-based navigation
- Depends on: None (base HTML/CSS)
- Used by: DOM event listeners and JavaScript render functions

**View Logic Layer:**
- Purpose: Render data into DOM, manage tab switching, form handling
- Location: `budget-app.html` — `<script>` block render functions (lines 412-748)
- Contains: `renderIncome()`, `renderFixed()`, `renderVariable()`, `renderSubs()`, `renderDebts()`, `renderAssets()`, `renderCategories()`, `renderSummary()`, `renderStmtHistory()`
- Depends on: Database layer, utility functions
- Used by: `refreshAll()` orchestrator and direct event listeners

**Business Logic Layer:**
- Purpose: Calculate derived values, debt payoff strategies, minimum payments
- Location: `budget-app.html` — utility and calculation functions (lines 508-690)
- Contains: `calcMinPayment()`, `getLatestBalance()`, payoff simulation logic in `calcPayoff` listener
- Depends on: Data layer
- Used by: View logic and event listeners

**Data Access Layer:**
- Purpose: CRUD operations and database queries
- Location: `budget-app.html` — database interactions (lines 298-308, 753-787)
- Contains: Dexie schema definition, table access via `db.{table}.add()`, `.toArray()`, `.where()`, `.delete()`, bulk operations
- Depends on: Dexie.js library
- Used by: Business logic and view logic

## Data Flow

**User Input → Add Record:**

1. User fills form (e.g., income date, source, amount)
2. Event listener attached to button (e.g., `addIncBtn`) fires
3. Handler extracts form values from DOM input elements
4. Validation checks (date required, amount not NaN)
5. `db.income.add()` inserts to IndexedDB
6. Form fields cleared
7. `refreshAll()` called to re-render all views

**Display Data:**

1. `refreshAll()` calls all `render*()` functions in parallel using `Promise.all()`
2. Each render function:
   - Queries database (e.g., `db.income.orderBy('date').toArray()`)
   - Filters data based on view mode (current month, YTD, all)
   - Maps rows to HTML table rows or list items
   - Sets `innerHTML` to render
   - Returns aggregated total for summary dashboard
3. `renderSummary()` receives totals and calculates derived metrics
4. Dashboard displays income, expenses, net position, net worth, ratios

**Delete Record:**

1. User clicks delete button with record ID in `onclick` attribute
2. Global `window.del()` function called
3. `db[table].delete(id)` removes from database
4. `refreshAll()` re-renders all affected views

**State Management:**

- **View state:** Stored in DOM (active tab, month picker value, view mode select)
- **Data state:** Stored in IndexedDB, queried on-demand (no in-memory cache)
- **Computed state:** Calculated on every render (totals, ratios, minimum payments)
- **Modal state:** Class toggle on overlay element (`.hidden` class)

## Key Abstractions

**Dexie Database Object (`db`):**
- Purpose: ORM abstraction over IndexedDB tables
- Examples: `db.income`, `db.fixedSpends`, `db.debts`, `db.statements`, `db.assets`, `db.categories`
- Pattern: Each table has CRUD methods (`.add()`, `.toArray()`, `.where()`, `.delete()`, `.bulkAdd()`, `.clear()`)

**Render Functions:**
- Purpose: Query data and generate DOM HTML
- Examples: `renderIncome()`, `renderFixed()`, `renderVariable()`, `renderSubs()`, `renderDebts()`, `renderAssets()`, `renderCategories()`
- Pattern: Async function that queries DB, maps to HTML, sets innerHTML, returns totals

**Period/View Filtering:**
- Purpose: Filter records by date range (current month, YTD, all-time)
- Examples: `inRange()`, `viewSelect` listener, `monthPicker` listener
- Pattern: `anchorYear` and `anchorMonth` globals drive filtering; `inRange()` comparator used in array filters

**Debt Payoff Simulation:**
- Purpose: Calculate Avalanche and Snowball payoff strategies
- Examples: `calcMinPayment()`, `simulate()` closure in `calcPayoff` listener
- Pattern: Orders debts by balance (Snowball) or APR (Avalanche), loops through 600 months, accumulates interest and payments

## Entry Points

**Initial Load:**
- Location: `budget-app.html` — lines 791-793
- Triggers: Browser opens HTML file
- Responsibilities: Initialize period (month picker), fetch all data, render all views

**Modal Operations:**
- Location: `budget-app.html` — statement modal (lines 266-292)
- Triggers: User clicks `+ Statement` button on debt row
- Responsibilities: Open modal, pre-fill latest balance, save statement to DB, render history

**Export/Import/Reset:**
- Location: `budget-app.html` — lines 753-787
- Triggers: User clicks export, import, or reset buttons
- Responsibilities: Serialize data to JSON, parse imported JSON, bulk insert/clear all tables

## Error Handling

**Strategy:** Defensive validation with silent failures and user alerts

**Patterns:**
- Form validation: Check required fields and data types before DB insert (lines 406, 429, 454, 476, 502, 699)
- JSON parsing: Try/catch with alert on invalid import (line 768)
- Database queries: Assume success; no explicit error handling
- Date parsing: `isNaN()` checks on date inputs and calculations
- Division by zero: Guard checks for `b>0` in percentage calculations (line 320)

## Cross-Cutting Concerns

**Logging:** None — no logging framework; errors surfaced via browser console only

**Validation:** Inline in event listeners:
- Required fields checked before insert
- Type coercion with `parseFloat()` and `isNaN()`
- String trimming on text inputs to prevent empty entries

**Authentication:** None — local-only app with no user accounts

**Data Persistence:** Automatic via IndexedDB; user must manually export/import for backups

**Currency Formatting:** `£()` utility function (lines 313-317) formats numbers as GBP strings with 2 decimal places

**Date Formatting:** `fmtDate()` and `fmtMonth()` utilities (lines 318-319) format dates using Intl API for en-GB locale

---

*Architecture analysis: 2026-02-28*
