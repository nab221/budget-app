# Codebase Concerns

**Analysis Date:** 2026-02-28

## Tech Debt

**Monolithic HTML File:**
- Issue: Entire application (HTML, CSS, JavaScript) is in a single 796-line file with no separation of concerns or modularization
- Files: `budget-app.html`
- Impact: Difficult to maintain, test, reuse, or version-control individual components; any change requires editing the full file
- Fix approach: Refactor into modular structure with separate HTML template, CSS file, and JavaScript modules (ES6 classes for data models, services layer, UI controllers)

**Global Variables & Namespace Pollution:**
- Issue: Multiple global variables (`db`, `anchorYear`, `anchorMonth`, `currentDebtId`) pollute the global scope; window object used for exposing functions (`window.del`, `window.deleteCat`, `window.openStmtModal`, `window.delStmt`)
- Files: `budget-app.html` (lines 298, 322, 559, 597, 604)
- Impact: Namespace collisions possible; harder to test and reason about state; accidental overwrites of globals
- Fix approach: Wrap in immediately-invoked function expression (IIFE) or module pattern; use explicit API object for public functions

**Inline Event Handlers in HTML:**
- Issue: Event listeners mixed with table rendering (`onclick="del('income',${r.id})"` inline in template strings); also used for modal operations
- Files: `budget-app.html` (lines 415, 440, 463, 549, 604, 707)
- Impact: Tight coupling of HTML generation and event logic; XSS vulnerability if data contains quotes; harder to add event delegation or batch listeners
- Fix approach: Use event delegation with data attributes; separate event binding from template rendering

**Magic Numbers Throughout:**
- Issue: Hard-coded values scattered in business logic: `maxMonths=600` (line 624), `2.25` repeated multiple times (lines 514, 516, 634), minimum payment formulas duplicated in multiple places
- Files: `budget-app.html` (lines 514-620, 624, 634)
- Impact: Rules appear inconsistent if not kept in sync; difficult to change debt calculation rules globally
- Fix approach: Extract all constants to configuration object at module top; use single source of truth for business rules

**Unvalidated User Input:**
- Issue: No sanitization or validation of user inputs before database insertion or HTML rendering
- Files: `budget-app.html` (lines 404, 426, 451, 471, 495, 696)
- Impact: Potential for stored XSS if malicious data is entered in text fields (e.g., `incSource`, `fixLabel`, `varNote`, `subName`); data consistency issues with type coercion
- Fix approach: Add input validation function; sanitize HTML when rendering; validate required fields; coerce types explicitly

**Duplicate Business Logic:**
- Issue: Minimum payment calculation appears in two places with slightly different implementations (lines 508-521 vs lines 634 in simulation)
- Files: `budget-app.html` (lines 508-521, 634)
- Impact: Diverging behavior between display and simulation; hard to fix bugs in debt calculations
- Fix approach: Extract to single shared function; use in both contexts

**No Error Handling:**
- Issue: No try-catch blocks around database operations, file parsing, or calculations; silent failures on invalid input
- Files: `budget-app.html` (throughout database calls and Promise chains)
- Impact: User doesn't know if operations succeed; corrupted data could be saved silently; JSON parse error handling only for import (line 768)
- Fix approach: Wrap async database operations in try-catch; provide user feedback on failures; validate calculation results

**Query String Parsing Missing:**
- Issue: Month picker and view select are controlled via form inputs, but there's no URL state persistence
- Files: `budget-app.html` (lines 323-331)
- Impact: User loses selected month/view and filter state on page refresh
- Fix approach: Serialize view state to localStorage or URL params; restore on load

---

## Known Bugs

**Debt Calculation Inconsistency:**
- Symptoms: `calcMinPayment()` uses different formula than simulation loop in payoff planner; simulation doesn't account for all cases
- Files: `budget-app.html` (lines 508-521 vs 621-648)
- Trigger: Adding debt with `minRule='pct_plus_interest'` and then running payoff planner shows different minimum payment values
- Workaround: Manually verify minimum payment values match between main view and planner

**Statement History Sorting Not Stable:**
- Symptoms: Statements may display out of order if months are identical or nearby
- Files: `budget-app.html` (lines 596-597)
- Trigger: Add multiple statements for same month; sorting compares month strings lexicographically, not chronologically
- Impact: User sees reversed chronological order when reverse() is applied after sorting

**Missing Date Defaults:**
- Symptoms: Date input fields are not pre-populated with today's date
- Files: `budget-app.html` (lines 157, 168, 181, 235)
- Trigger: User opens Income/Fixed/Variable tab and must manually enter date each time
- Workaround: Manually enter date or use browser date input defaults

**Category Dropdown Doesn't Reset After Custom Entry:**
- Symptoms: After user enters custom category via prompt (lines 425, 451), the `fixCat` or `varCat` dropdown reverts to first option instead of showing entered value
- Files: `budget-app.html` (lines 424-426, 450-451)
- Trigger: Select `__other` option and enter custom category name
- Impact: UX confusion; custom category created but doesn't appear to be saved to the category shown in input

**Import Merges Instead of Replacing:**
- Symptoms: Import button adds data to existing database instead of replacing it
- Files: `budget-app.html` (lines 765-780)
- Trigger: Import a backup file into existing budget
- Impact: Duplicate data; no way to cleanly restore a backup without manual deletion
- Workaround: Use Reset button before Import, but user might forget

---

## Security Considerations

**Stored XSS Vulnerability:**
- Risk: User-entered text in fields like `incSource`, `fixLabel`, `subName`, `debtName` is rendered directly into HTML strings without sanitization
- Files: `budget-app.html` (lines 415, 440, 463, 549, 651-671, 678)
- Current mitigation: IndexedDB is same-origin only, and app is loaded from file (no network injection); still possible if data is exported and imported with malicious values
- Recommendations: Use `textContent` instead of `innerHTML` where possible; sanitize output with DOMPurify or escape HTML entities; use template literals with proper escaping

**External CDN Dependency:**
- Risk: Application loads Dexie.js from `cdn.jsdelivr.net` (line 7); network failure or CDN compromise breaks functionality
- Files: `budget-app.html` (line 7)
- Current mitigation: README mentions offline mode by downloading `dexie.min.js`; however, documentation is outside the app
- Recommendations: Include SRI hash in script tag; provide fallback error message if CDN fails; consider bundling Dexie with the app

**No Data Encryption:**
- Risk: All data stored in IndexedDB in plaintext; browser history, cache, and file backups contain sensitive financial data
- Files: `budget-app.html` (lines 754-762)
- Current mitigation: Local-first design means data stays on user's machine; README mentions "Encrypted export" as future feature
- Recommendations: Implement optional encryption for exported backups; add warning about data exposure if browser is shared; use IndexedDB encryption libraries if available

**Reset Button Has Weak Confirmation:**
- Risk: Single `confirm()` dialog with standard browser UI can be dismissed accidentally
- Files: `budget-app.html` (line 782)
- Current mitigation: Confirmation message says "Permanently delete ALL data"; user must read carefully
- Recommendations: Implement stricter confirmation (e.g., type "DELETE" or enter a code); add undo feature with short time window; require export before reset

**No Authentication:**
- Risk: Anyone with browser access to the file can view all financial data
- Files: Entire `budget-app.html`
- Current mitigation: File is loaded from local filesystem (file://) in user's browser
- Recommendations: Add optional password protection for sensitive sections; use IndexedDB encryption; document shared-browser risk in README

---

## Performance Bottlenecks

**Inefficient Payoff Simulation:**
- Problem: `simulate()` function iterates up to 600 months for each debt; with multiple debts, this is slow (potentially 600 * N iterations)
- Files: `budget-app.html` (lines 621-648)
- Cause: Naive month-by-month simulation without optimization; no early termination for fully-paid debts
- Improvement path: Break loop if all debts paid; cache interest calculations; use analytical formula for single-debt payoff instead of simulation

**Full Table Re-render on Every Change:**
- Problem: `refreshAll()` queries all 8 database tables and re-renders all visible tables even if only one record changed
- Files: `budget-app.html` (lines 742-748)
- Cause: No change detection or incremental updates; all Promise.all queries always run
- Improvement path: Track which table changed; only re-render affected table; debounce refresh calls if user rapidly adds entries

**No Pagination for Large Datasets:**
- Problem: If user has thousands of transactions, entire table is rendered in DOM at once
- Files: `budget-app.html` (lines 414-417, 436-443, 461-465)
- Cause: `.toArray()` loads all records; no `.limit()` or `.offset()` applied
- Improvement path: Implement pagination or virtual scrolling; load first 100 rows; add "Load more" button

**Summary Calculations Not Memoized:**
- Problem: Dashboard recalculates totals on every view change (month select, filter toggle) by re-querying all data
- Files: `budget-app.html` (lines 330-331, 742-748)
- Cause: `refreshAll()` runs all render functions unconditionally
- Improvement path: Cache computed totals; only recalculate if source data changed; use computed properties

---

## Fragile Areas

**Payoff Planner Simulation Logic:**
- Files: `budget-app.html` (lines 621-648)
- Why fragile: Complex nested loops with multiple debt state mutations; minimum payment logic appears in two different places (lines 508-521 and 634); edge cases around zero balance not clearly handled (line 616); interest calculation assumes monthly compounding but user might expect daily
- Safe modification: Add unit tests for specific debt scenarios; extract minimum payment to shared function; document assumptions about interest calculation; test edge cases (zero balance, single payment, high APR)
- Test coverage: Only implicit testing via UI; no unit tests for simulation logic

**Statement Modal State Management:**
- Files: `budget-app.html` (lines 559-603)
- Why fragile: Global `currentDebtId` variable is used to track which debt's modal is open; modal can't be opened for multiple debts; if `openStmtModal()` is called before previous modal closes, state gets confused
- Safe modification: Use data attributes or form values instead of globals; validate `currentDebtId` is set before save; don't mutate global state directly
- Test coverage: No way to unit test modal state; only manual browser testing

**Category Management Dual State:**
- Files: `budget-app.html` (lines 381-397)
- Why fragile: Categories stored in database, but dropdowns are re-rendered from database on every change; if dropdown loses sync with database (e.g., exception during update), UI shows stale list
- Safe modification: Validate categories exist before rendering; add error handling to `addCatBtn` click; test that deleted categories are removed from all dropdowns
- Test coverage: No validation that deleted categories are purged from related records

**Date Parsing Assumes ISO Format:**
- Files: `budget-app.html` (lines 318-319, 333-340)
- Why fragile: `fmtDate()` and `inRange()` assume date strings are ISO format (YYYY-MM-DD); no validation if date is malformed
- Safe modification: Add date validation; use `Date.parse()` with fallback; document expected format; consider using date library (date-fns, Day.js)
- Test coverage: No unit tests for date parsing edge cases (empty string, invalid format, null)

**Export/Import Data Version Mismatch:**
- Files: `budget-app.html` (lines 753-780)
- Why fragile: Export includes version (line 754), but import doesn't validate it; if app schema changes, import will silently fail or corrupt data
- Safe modification: Add version check in import handler; provide migration logic for old backups; warn user if importing different version
- Test coverage: No migration testing

**Debt Type Filtering Missing:**
- Files: `budget-app.html` (lines 530-556)
- Why fragile: `renderDebts()` shows all debts; no way to filter or sort by type (credit card, loan, mortgage); if user has many debts, finding specific one is hard
- Safe modification: Add filter buttons or dropdown; consider grouping debts by type
- Test coverage: No testing of large debt datasets

---

## Scaling Limits

**IndexedDB Storage Quota:**
- Current capacity: Browser typically allows 50MB-1GB depending on device; JSON backups are uncompressed
- Limit: With 50MB limit and average transaction size ~200 bytes, app supports ~250K transactions before quota exceeded
- Scaling path: Implement data archiving (move old transactions to cold storage); compress export backups; warn user at 80% quota; consider cloud sync with optional backup

**UI Rendering Performance:**
- Current capacity: Tables with 1K+ rows start to lag; DOM is not virtual-scrolled
- Limit: ~10K total records across all tables before noticeable slowdown
- Scaling path: Implement pagination (100 per page); virtual scrolling for large tables; lazy-load month's data on demand

**Payoff Simulation Accuracy:**
- Current capacity: Handles up to ~50 debts in payoff planner before simulation takes >1 second
- Limit: `maxMonths=600` hardcoded; edge cases with very low APR or very high balance may not converge
- Scaling path: Use binary search for convergence; cache intermediate results; set timeout on simulation; use analytical formula for single debts

---

## Dependencies at Risk

**Dexie.js (External CDN):**
- Risk: Version 4.0.8 pinned, but CDN could be unavailable; no npm/package manager dependency management
- Impact: App won't load without CDN; no way to track security updates
- Migration plan: Bundle Dexie.js locally; use npm/bundler if migrating to modular structure; add fallback to alternate CDN (e.g., unpkg)

---

## Test Coverage Gaps

**No Automated Tests:**
- What's not tested: Database operations, debt calculations, date filtering, export/import logic, UI event handling
- Files: `budget-app.html` (entire file)
- Risk: Regressions introduced silently; payoff planner bugs not caught; data corruption edge cases undetected
- Priority: High — Start with unit tests for `calcMinPayment()`, `simulate()`, and date range filtering

**Manual Testing Only:**
- Fragility: Complex features like payoff planner, statement history, and category management are only tested via UI
- Missing: Test for concurrent operations (rapid clicks), boundary conditions (zero balance, negative amounts), data validation

**No E2E Testing:**
- Missing: User workflows like "add income → add fixed spend → check summary" not validated
- Missing: Export/import cycle testing with real data; reset functionality verification

---

## Missing Critical Features

**Data Persistence Warning:**
- Problem: Users may not understand that data is lost if they clear browser cache; README mentions this but it's not in-app warning
- Blocks: Peace of mind for users; recovery from accidental deletion
- Impact: Users lose data without realizing why

**Backup Scheduling:**
- Problem: Export must be done manually; no reminder or automatic backups
- Blocks: Long-term data retention; disaster recovery
- Impact: Users forget to export; data loss on device failure

---

## Code Quality Issues

**Inconsistent Code Formatting:**
- Issue: Minified CSS and semi-minified JavaScript in single file; variable naming inconsistent (e.g., `fixCat` vs `catGroup`)
- Files: `budget-app.html`
- Impact: Harder to read and maintain; no consistency for future contributors

**No Comments Beyond Section Headers:**
- Issue: Only high-level comments like `// ═══════════════════════════════════════════` and no inline documentation
- Files: `budget-app.html`
- Impact: Business logic (especially debt calculations) not documented; assumptions about interest calculation unclear

**Implicit Type Coercion:**
- Issue: `parseFloat()` used without validation; `isNaN()` checks but no error messages to user
- Files: `budget-app.html` (lines 405, 428, 453, 472, etc.)
- Impact: Silent failures; invalid data could be stored

---

*Concerns audit: 2026-02-28*
