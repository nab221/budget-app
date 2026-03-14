# Coding Conventions

**Analysis Date:** 2026-02-28

## Naming Patterns

**Files:**
- Single file format: `budget-app.html` - monolithic, no module splitting

**Functions:**
- camelCase for all function names: `renderIncome()`, `calcMinPayment()`, `refreshAll()`
- Async functions prefixed with `async`: `async function renderIncome()`, `async function getLatestBalance()`
- Event handlers use arrow functions with `addEventListener`: `document.getElementById('addIncBtn').addEventListener('click', async ()=>{ ... })`
- Global window functions exposed for inline onclick handlers: `window.del`, `window.deleteCat`, `window.openStmtModal`, `window.delStmt`

**Variables:**
- camelCase for all variables: `anchorYear`, `anchorMonth`, `monthPicker`, `viewSelect`, `currentDebtId`
- Constants in UPPER_CASE with const: `DEFAULT_CATS` (line 355)
- Short variable names in tight scopes: `d` for debt, `r` for row, `s` for sum/total, `y` for year, `m` for month, `mo` for monthOnly
- Prefix variables with data type hints where needed: `debtData` (line 613), `stmtHistory` (line 596)

**Types:**
- No TypeScript; raw JavaScript with implicit typing
- Database schema defined inline via Dexie: `db.version(1).stores({ ... })` (line 299)
- No type annotations or JSDoc comments

**CSS Custom Properties (Design Tokens):**
- Use `:root` CSS variables with `--` prefix: `--bg`, `--accent`, `--danger`, `--text`, `--border` (lines 9-15)
- Colors follow semantic naming: `--accent`, `--accent-soft`, `--accent-border`
- Utility classes for color application: `.green`, `.red`, `.amber`, `.blue`, `.purple` (line 104)

## Code Style

**Formatting:**
- Minified/compressed style in `<style>` block - single-line CSS rules
- JavaScript uses inline formatting with heavy use of ternaries and arrow functions
- No trailing semicolons in style block; semicolons present in script block
- Template literals for HTML generation: `` `<tr><td>${fmtDate(r.date)}</td>...` `` (line 415)

**Linting:**
- No ESLint configuration detected
- No Prettier configuration
- Code style is developer-driven; follows common patterns but not strictly enforced

**Indentation:**
- HTML: 2-space indentation in structure (lines 109-264)
- CSS: Minified/single-line (lines 8-106)
- JavaScript: Minified comments followed by formatted code blocks (line 294+)

## Import Organization

**Order:**
- No ES6 imports/exports - monolithic single-file structure
- External library loaded via CDN: `<script src="https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js"></script>` (line 7)
- Dexie library accessed globally as `Dexie` (line 298)

**Path Aliases:**
- Not applicable - no module system

## Error Handling

**Patterns:**
- Minimal error handling; relies on early returns: `if(!date||isNaN(amount))return;` (line 406)
- User confirmation via `confirm()` dialogs for destructive operations: `if(!confirm('...'))return;` (lines 361, 769, 783)
- JSON parse wrapped in try-catch for import: `try{data=JSON.parse(await file.text())}catch{alert('Invalid JSON');return}` (line 768)
- No formal error objects or custom error classes
- Silent failures for validation mismatches (missing fields simply don't add records)

**Validation:**
- Input validation via checks: `if(!name||isNaN(amount))return;` (multiple locations)
- Date validation: `isNaN(dt)` checks (line 318)
- Type coercion handled implicitly: `parseFloat()` used for numeric inputs

## Logging

**Framework:** `console` - not explicitly used in codebase
- No log statements visible in production code
- Silent operation; user feedback via UI updates only

**Patterns:**
- No structured logging
- No debug/info/warn/error levels
- Database operations are synchronous and assumed successful

## Comments

**When to Comment:**
- Section headers use ASCII art dividers: `// ════════ HEADER ════════` (lines 21, 111, 343, etc.)
- Comments mark major functional areas: `// DATABASE SCHEMA`, `// UTILITIES`, `// INCOME`, `// DEBTS + STATEMENTS`
- No inline comments explaining complex logic
- Comment-to-code ratio is very low (mostly section headers)

**JSDoc/TSDoc:**
- Not used - no type documentation

## Function Design

**Size:**
- Functions typically 5-50 lines
- Longer functions for complex calculations (e.g., `renderDebts()` is ~26 lines, `simulate()` is ~25 lines)
- Prefer single responsibility: each render function handles one data type

**Parameters:**
- Functions take minimal parameters (0-2 typically)
- IDs passed as single parameter: `openStmtModal(debtId)` (line 560)
- Destructuring used where needed: `const [y,m]=monthPicker.value.split('-').map(Number)` (line 330)
- No default parameters; fallback logic in function body

**Return Values:**
- Most render functions return a single aggregate value: `return rows.reduce((s,r)=>s+(r.amount||0),0)` (line 416)
- Helper functions return calculated results: `return Math.min(min, balance + interest)` (line 520)
- Async functions return Promise results implicitly

## Module Design

**Exports:**
- No ES6 exports - single file with global scope
- Functions attached to `window` for onclick access: `window.deleteCat`, `window.openStmtModal`, `window.delStmt`, `window.del` (lines 397, 560, 604, 737)

**Barrel Files:**
- Not applicable - monolithic structure

## Formatting & Whitespace

**Template Literals:**
- Multi-line HTML strings used extensively:
  ```javascript
  document.getElementById('strategyGrid').innerHTML=`
    <div class="strategy-box">
      <h4>🏔️ Avalanche...</h4>
      ...
    </div>
  `; // (lines 665-680)
  ```
- No escaping needed; backticks allow quotes inside

**Ternary Operators:**
- Heavy use for conditional inline rendering: `${r.status==='paid'?'chip-paid':'chip-pending'}` (line 439)
- Three-part ternaries for multiple conditions: `const typeChip=d.type==='credit_card'?'chip-cc':d.type==='loan'?'chip-loan':'chip-mortgage'` (line 539)

**Arrow Functions:**
- Preferred for event listeners and array methods: `rows.filter(r=>inRange(r.date,mode))` (line 414)
- Single-expression arrow functions omit braces: `.map(c=>c.name)` (line 671)
- Multi-line arrow functions with braces: `addEventListener('click', async ()=>{ ... })` (line 402)

## Data Access Pattern

**Database Queries:**
- Dexie methods used with `.toArray()` to get all records: `await db.income.toArray()` (line 414)
- Filtering applied in JavaScript, not at database level: `rows.filter(r=>inRange(r.date,mode))`
- Sorting in JavaScript: `stmts.sort((a,b)=>...)` (line 526)
- Single-record fetches: `const debt=await db.debts.get(debtId)` (line 562)

---

*Convention analysis: 2026-02-28*
