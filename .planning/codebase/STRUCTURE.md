# Codebase Structure

**Analysis Date:** 2025-03-04

## Directory Layout

```
budget-app/
├── index.html          # Main HTML entry point
├── package.json        # Dependencies and scripts (Vite, etc.)
├── vite.config.js      # Build configuration
├── css/
│   └── main.css        # Global styles and CSS variables
├── src/
│   ├── app.js          # Main app entry point (init logic)
│   ├── db/             # Data access and schema
│   │   ├── schema.js       # IndexedDB schema (Dexie)
│   │   └── repository.js   # Main data access objects
│   ├── ui/             # Feature-specific UI modules
│   │   ├── transactions.js # Income management
│   │   ├── expenses.js     # Expense management (recurrent/one-off)
│   │   ├── debts.js        # Debt and statement management
│   │   ├── dashboard.js    # Dashboard rendering
│   │   └── ...             # Other feature modules
│   └── utils/          # Shared utilities
│       ├── currency.js     # Money formatting and conversion
│       ├── finance.js      # Complex financial calculations
│       └── storage.js      # Low-level storage helpers
└── tests/              # Test suites
```

## Directory Purposes

**src/db/:**
- Purpose: Handles all data storage and retrieval.
- Contains: Dexie.js schema definition and repository classes/objects.
- Key files: `src/db/repository.js`, `src/db/schema.js`.

**src/ui/:**
- Purpose: Encapsulates all DOM manipulation and user interaction for specific features.
- Contains: Module objects with `render()` and event handling.
- Key files: `src/ui/transactions.js`, `src/ui/expenses.js`, `src/ui/dashboard.js`.

**src/utils/:**
- Purpose: Pure functions for shared logic.
- Contains: Math, formatting, and data transformation helpers.
- Key files: `src/utils/currency.js`, `src/utils/finance.js`.

## Key File Locations

**Entry Points:**
- `index.html`: Main HTML file that loads `src/app.js`.
- `src/app.js`: Orchestrates the initialization and global events.

**Configuration:**
- `package.json`: Project dependencies and metadata.
- `vite.config.js`: Development server and build settings.
- `css/main.css`: Theme variables and global styles.

**Core Logic:**
- `src/db/repository.js`: Where business logic meets data access.
- `src/utils/finance.js`: Complex calculations (e.g., balance projections, debt-free countdown).

## Naming Conventions

**Files:**
- [Modules]: `camelCase.js` (e.g., `transactions.js`).
- [Tests]: `name.test.js` (e.g., `repository.test.js`).

**Directories:**
- [All]: lowercase (e.g., `ui`, `db`, `utils`).

## Where to Add New Code

**New Feature:**
- Primary code: New module in `src/ui/`, initialized in `src/app.js`.
- Tests: Co-located in `src/ui/` or in `tests/`.

**New Data Model:**
- Implementation: Update `src/db/schema.js` and add methods to `src/db/repository.js`.

**Utilities:**
- Shared helpers: `src/utils/` for generic logic, `src/db/repository.js` for data-heavy logic.

## Special Directories

**.planning/:**
- Purpose: Project documentation and roadmap tracking.
- Committed: Yes.

**dist/:**
- Purpose: Compiled assets for production.
- Generated: Yes (by `npm run build`).
- Committed: No.

---

*Structure analysis: 2025-03-04*
