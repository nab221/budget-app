# Codebase Structure

**Analysis Date:** 2026-02-28

## Directory Layout

```
budget-app/
├── budget-app.html       # Single monolithic SPA file
├── dexie.min.js          # Optional local copy (for fully offline mode)
└── README.md             # User-facing documentation
```

This is a single-file application. All HTML, CSS, and JavaScript are contained in `/d/code/github/budget-app/budget-app.html`.

## Directory Purposes

**Project Root:**
- Purpose: Distribution and entry point
- Contains: HTML application file, optional offline Dexie library, documentation
- Key files: `budget-app.html` (complete app), `README.md` (user guide)

## Key File Locations

**Entry Points:**
- `budget-app.html` (lines 791-793): Initialization on page load — calls `initPeriod()` then `refreshAll()`

**Configuration:**
- `budget-app.html` (lines 298-308): Dexie database schema definition with 8 object stores
- `budget-app.html` (lines 355-358): Default spending categories (fixed and variable)
- `budget-app.html` (lines 9-16): CSS custom properties (colors, spacing, transitions)

**Core Logic:**
- **Database schema:** Lines 298-308 define tables: `income`, `fixedSpends`, `variableSpends`, `subscriptions`, `debts`, `statements`, `assets`, `categories`
- **Utility functions:** Lines 313-340 contain formatting and period logic (`£()`, `fmtDate()`, `fmtMonth()`, `pct()`, `inRange()`)
- **Event listeners:** Lines 345-787 contain all form handling and CRUD operations
- **Render functions:** Lines 381-748 contain view rendering logic for all tabs

**Testing:**
- No test files — application is single file with no automated testing

## Naming Conventions

**Files:**
- Single file: `budget-app.html` — conventional naming, `.html` extension

**Directories:**
- N/A — no directory structure within application

**HTML Identifiers (ID Attributes):**
- Pattern: Camel case with abbreviations — `incDate`, `fixAmt`, `varNote`, `debtName`, `subFreq`, `astDate`
- Form inputs: `[action][field]` — `incDate` (income date), `fixLabel` (fixed label), `varNote` (variable note)
- Tables: `[action]Body` — `incBody`, `fixBody`, `varBody`, `debtBody`
- Buttons: `[action]Btn` — `addIncBtn`, `addFixBtn`, `addDebtBtn`
- Containers: Semantic names — `summaryGrid`, `strategyGrid`, `mainTabs`
- Modal: `stmtModal` (statement modal)

**CSS Classes:**
- Pattern: Kebab case with semantic meaning
- Layout: `.card`, `.card-hd`, `.grid2`, `.form-row`, `.tabs`, `.tab-panel`, `.tbl`
- States: `.active`, `.hidden`, `.chip-paid`, `.chip-pending`, `.chip-cc`, `.chip-loan`, `.chip-mortgage`
- Colors/Styles: `.green`, `.red`, `.amber`, `.blue`, `.purple`, `.ghost`, `.primary`, `.danger`, `.info`

**JavaScript Functions:**
- Render functions: `render[Entity]()` — `renderIncome()`, `renderFixed()`, `renderCategories()`, `renderSummary()`
- Global window functions: `window.[action]` — `window.del()`, `window.openStmtModal()`, `window.deleteCat()`, `window.delStmt()`
- Event listeners: Attached inline via `.addEventListener()` or `onclick` attributes
- Utilities: Lowercase names — `£()`, `fmtDate()`, `fmtMonth()`, `pct()`, `inRange()`, `initPeriod()`
- Calculations: Semantic names — `calcMinPayment()`, `getLatestBalance()`, `simulate()`

**Database Collections:**
- Singular table names: `income`, `fixedSpends`, `variableSpends`, `subscriptions`, `debts`, `statements`, `assets`, `categories`
- Accessed as `db.tableName.method()` throughout

## Where to Add New Code

**New Feature (e.g., "Add investment tracker"):**
- **HTML form:** Add form row in appropriate tab or new tab (lines 144-261)
- **Database table:** Add to schema in `db.version(1).stores()` (lines 299-308)
- **Event listener:** Add `document.getElementById('[button-id]').addEventListener('click', async () => { ... })` after existing listeners
- **Render function:** Create new `async function render[Entity]() { ... }` following pattern of `renderIncome()` (lines 412-417)
- **Summary calculation:** Add to `renderSummary()` parameters and display items (lines 714-732)
- **Refresh integration:** Add promise to `Promise.all()` in `refreshAll()` (lines 743-745)

**New Component/Tab:**
- Create tab button in tabs container (line 144-151)
- Create corresponding `.tab-panel` (example at lines 155-163)
- Add form inputs and table or list display
- Create render function
- Wire into `refreshAll()`

**Utilities (e.g., new formatter):**
- Add near existing utilities (lines 313-320)
- Export by assigning to `window` object if globally needed
- Reference in render functions and event listeners

**Modal Dialogs (e.g., edit record modal):**
- Create `.modal-overlay` and `.modal` divs following statement modal pattern (lines 266-292)
- Create global `window.open[Modal]()` function to populate and show
- Create save and cancel event listeners
- Trigger from action buttons with `onclick="window.open[Modal](id)"`

## Special Directories

**None:** This is a single-file application with no special directories or generated content.

**Optional Offline Mode:**
- `dexie.min.js`: User can optionally download Dexie library and place in root to enable fully offline operation
- Not committed to repository; users add on demand

## Configuration Management

**CSS Custom Properties** (lines 9-16):
- `--bg`, `--bg-alt`: Background colors
- `--accent`, `--accent-soft`: Primary accent and soft variant
- `--text`, `--text-soft`, `--text-dim`: Text colors at different contrast levels
- `--danger`, `--warn`, `--info`: Status/action colors
- `--border`, `--border-light`: Border colors
- `--radius`: Border radius value (10px)
- `--tr`: Transition timing (0.15s ease-out)

**Database Schema** (lines 299-308):
- Each table defines primary key (`++id`), indices for fast queries
- Example: `income: '++id, date, source, amount'` enables filtering by date, source, or amount

**Default Categories** (lines 355-358):
- Fixed: Housing, Utilities, Credit Cards & Loans, Insurance, Health, Childcare, Professional Subscriptions, Savings, Other Fixed
- Variable: Groceries, Eating Out / Takeaway, Clothing, Fuel / Transport, Miscellaneous, Entertainment, Gifts, Home / Garden
- User can add/edit/delete via Settings tab

**Debt Minimum Payment Defaults** (lines 500-501, 513-514):
- Default rule: `pct_plus_interest` (1% of balance + interest, minimum 2.25% of balance, floor £5)
- User can override per debt when adding

## Content Sections (Logical Organization)

The script block in `budget-app.html` is organized with clear comment dividers (lines 295-793):

1. **DATABASE SCHEMA** (298-308)
2. **UTILITIES** (313-340)
3. **TABS** (345-350)
4. **CATEGORIES** (353-397)
5. **INCOME** (400-417)
6. **FIXED SPENDS** (420-443)
7. **VARIABLE** (446-465)
8. **SUBSCRIPTIONS** (468-489)
9. **DEBTS + STATEMENTS** (492-603)
10. **PAYOFF PLANNER** (607-690)
11. **ASSETS** (693-709)
12. **SUMMARY DASHBOARD** (712-732)
13. **GENERIC DELETE** (736-737)
14. **REFRESH ALL** (741-748)
15. **EXPORT / IMPORT / RESET** (751-787)
16. **BOOT** (790-793)

---

*Structure analysis: 2026-02-28*
