# Technology Stack

**Analysis Date:** 2026-02-28

## Languages

**Primary:**
- JavaScript (ES6+) - All application logic embedded in single HTML file
- HTML5 - Document structure and markup
- CSS3 - Styling and responsive layout with CSS variables

## Runtime

**Environment:**
- Browser-based (Client-side only, no server required)

**Supported Browsers:**
- Chrome 80+
- Edge 80+
- Firefox 78+
- Safari 15+

**Package Manager:**
- None - External dependencies loaded from CDN only

## Frameworks

**Core:**
- Dexie.js 4.0.8 - IndexedDB wrapper for local database
  - Loaded from CDN: `https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js`
  - Single external dependency

**No frameworks for:**
- UI rendering (vanilla DOM manipulation)
- State management (direct database queries)
- Build tools (none - runs as single file)

## Key Dependencies

**Critical:**
- Dexie.js 4.0.8 - Database abstraction layer
  - Why it matters: Provides IndexedDB wrapper for CRUD operations and queries
  - File reference: `budget-app.html` line 7

## Configuration

**Environment:**
- No environment configuration required
- Application works offline after initial Dexie.js CDN load
- Browser's IndexedDB provides all data persistence

**Build:**
- No build process
- Single `budget-app.html` file contains all HTML, CSS, and JavaScript

**Offline Mode:**
- Optional: User can download `dexie.min.js` from CDN and host locally
- Instructions in README.md lines 43-56

## Platform Requirements

**Development:**
- Text editor to modify HTML file
- Browser with JavaScript console for debugging
- Optional: Local HTTP server to serve file (not required but recommended)

**Production:**
- Modern web browser (Chrome 80+, Edge 80+, Firefox 78+, Safari 15+)
- Web server to host static HTML file (can be GitHub Pages, any static hosting)
- Internet for first-load CDN fetch of Dexie.js (~45 KB)

## Data Persistence

**Storage:**
- Browser IndexedDB (client-side database)
- Capacity: Hundreds of MB per origin
- Persistence: Until user clears site data or exports/imports

**Backup/Export:**
- JSON export functionality built-in
- Manual backup recommended
- Import/export handled via JavaScript File API

## Key Code Patterns

**Database Initialization:**
```javascript
const db = new Dexie('BudgetConsoleDB');
db.version(1).stores({
  income: '++id, date, source, amount',
  fixedSpends: '++id, date, category, label, status, amount',
  variableSpends: '++id, date, category, note, amount',
  subscriptions: '++id, name, amount, frequency, nextDate, method',
  debts: '++id, name, type, limit, apr, minRule, minValue, minFloor',
  statements: '++id, debtId, month, openBal, purchases, payments, interest, fees, closeBal, notes',
  assets: '++id, name, amount, asOf',
  categories: '++id, group, name'
});
```
Location: `budget-app.html` lines 296-308

**DOM Manipulation:**
- Event delegation on button clicks
- innerHTML for rendering tables and lists
- Template literals for HTML generation
- No shadow DOM or Web Components

**Asynchronous Operations:**
- Async/await throughout for Dexie database operations
- Promise.all() for parallel renders (line 743)
- File API for import/export

---

*Stack analysis: 2026-02-28*
